<template>
  <div class="h-full">
    <settlement-view 
      v-if="receiptId" 
      :event-id="receiptId"
      :decryption-key="decryptionKey"
    />
    <template v-else>
      <div v-if="!capturedReceipt" class="camera-container">
        <video ref="videoElement" class="h-full w-full object-cover"></video>
        
        <!-- Camera Permission Overlay Component -->
        <CameraPermissionOverlay
          :hasPermission="hasPermission"
          :isInitializing="cameraInitializing"
          @request-permission="requestCameraPermission"
        />
        
        <div class="camera-overlay">
          <div class="p-4 bg-black/50">
            <div class="flex items-center justify-center space-x-2">
              <img
                src="/receipt-cash-logo.png"
                alt="Receipt.Cash Logo"
                class="w-8 h-8"
              />
              <h1 class="text-white text-center text-xl font-bold">Receipt.Cash</h1>
            </div>
          </div>
          
          <camera-controls
            @toggle-flash="toggleFlash"
            @capture-receipt="captureReceipt"
            @toggle-settings="toggleSettings"
            @image-uploaded="handleImageUpload"
            @view-history="viewHistory"
          />
        </div>
      </div>
      
      <receipt-preview
        v-if="capturedReceipt"
        :receipt-data="capturedReceipt"
        @back="resetCapture"
      />
    </template>
    
    <Spinner v-if="isProcessing" message="Processing receipt..." />
    
    <SettingsMenu
      :is-open="isSettingsOpen"
      @close="isSettingsOpen = false"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QrScanner from 'qr-scanner';
import ReceiptPreview from '../components/ReceiptPreview.vue';
import SettlementView from './SettlementView.vue';
import Notification from '../components/Notification.vue';
import Spinner from '../components/Spinner.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import CameraControls from '../components/CameraControls.vue';
import CameraPermissionOverlay from '../components/CameraPermissionOverlay.vue';
import { showNotification, useNotification } from '../services/notificationService';
import receiptService from '../services/aiService';

export default {
  name: 'HomeView',
  components: {
    ReceiptPreview,
    SettlementView,
    Notification,
    Spinner,
    SettingsMenu,
    CameraControls,
    CameraPermissionOverlay
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const videoElement = ref(null);
    const qrScanner = ref(null);
    const capturedReceipt = ref(null);
    const hasPermission = ref(false);
    const receiptId = computed(() => route.query.receipt);
    const decryptionKey = computed(() => route.query.key);
    const isProcessing = ref(false);
    const isSettingsOpen = ref(false);
    const cameraInitializing = ref(false);
    
    // Use the global notification system
    const { notification, clearNotification } = useNotification();
    
    const requestCameraPermission = async () => {
      try {
        cameraInitializing.value = true;
        console.log('Requesting camera permission...');
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        hasPermission.value = true;
        
        console.log('Camera permission granted, initializing camera...');
        // Use nextTick to ensure DOM is updated before initializing camera
        await new Promise(resolve => setTimeout(resolve, 100));
        await initializeCamera();
      } catch (error) {
        console.error('Camera permission error:', error);
        
        // Check if the user explicitly denied permission
        const isPermissionDenied = error.name === 'NotAllowedError' ||
                                   error.name === 'PermissionDeniedError' ||
                                   error.message.includes('Permission denied');
        
        // Only show notification if it's not an explicit denial
        if (!isPermissionDenied) {
          showNotification('Camera access failed. Please check your browser settings and try again.');
        } else {
          console.log('Camera permission explicitly denied by user');
        }
        
        hasPermission.value = false;
        cameraInitializing.value = false;
      }
    };

    const initializeCamera = async () => {
      if (!hasPermission.value) {
        await requestCameraPermission();
        return;
      }

      try {
        cameraInitializing.value = true;
        
        // Wait for video element to be available with retries
        let retries = 0;
        const maxRetries = 20; // 2 seconds max wait
        
        while (!videoElement.value && retries < maxRetries) {
          console.log(`Waiting for video element... attempt ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (!videoElement.value) {
          throw new Error('Video element not available after waiting');
        }

        // Clean up any existing scanner
        if (qrScanner.value) {
          qrScanner.value.destroy();
          qrScanner.value = null;
        }

        qrScanner.value = new QrScanner(
          videoElement.value,
          (result) => {
            console.log('QR Code detected:', result);
            handleQrCodeResult(result);
          },
          {
            highlightScanRegion: false,
            highlightCodeOutline: false,
            returnDetailedScanResult: true
          }
        );
        
        console.log('Starting QR Scanner...');
        await qrScanner.value.start();
        console.log('QR Scanner started successfully');
        
        cameraInitializing.value = false;
        
      } catch (error) {
        console.error('Error initializing camera:', error);
        showNotification('Failed to initialize camera. Please try refreshing the page.');
        hasPermission.value = false; // Reset permission on error
        cameraInitializing.value = false;
      }
    };

    const toggleFlash = async () => {
      if (qrScanner.value) {
        try {
          await qrScanner.value.toggleFlash();
        } catch (error) {
          console.error('Error toggling flash:', error);
          showNotification('Failed to toggle flash. Your device may not support this feature.', "warning");
        }
      }
    };

    const captureReceipt = async () => {
      if (!hasPermission.value) {
        await requestCameraPermission();
        return;
      }

      try {
        isProcessing.value = true;
        
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const video = videoElement.value;
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current video frame on the canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob with higher quality
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));
        
        // Convert blob to base64
        const base64Image = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
        
        showNotification('Processing receipt...', 'info');
        
        // Use receipt service to process the image
        const processedReceipt = await receiptService.processReceiptImage(base64Image);
        
        // Store the processed receipt data
        capturedReceipt.value = processedReceipt;
        
        showNotification('Receipt processed successfully!', 'success');
        
        // Stop the camera since we don't need it anymore
        if (qrScanner.value) {
          qrScanner.value.stop();
        }
        
      } catch (error) {
        console.error('Error capturing receipt:', error);
        showNotification(error.message);
      } finally {
        isProcessing.value = false;
      }
    };

    const resetCapture = () => {
      capturedReceipt.value = null;
      // Restart the camera if we have permission
      if (hasPermission.value && qrScanner.value) {
        qrScanner.value.start();
      }
    };
    
    const toggleSettings = () => {
      isSettingsOpen.value = !isSettingsOpen.value;
    };

    // Watch for changes to receiptId
    watch(receiptId, (newValue, oldValue) => {
      // If we're transitioning from having a receipt to no receipt,
      // initialize the camera for scanning a new receipt
      if (oldValue && !newValue) {
        requestCameraPermission();
      }
    });

    onMounted(() => {
      // Only initialize camera if we're not showing a receipt
      if (!receiptId.value) {
        requestCameraPermission();
      }
    });

    onUnmounted(() => {
      if (qrScanner.value) {
        qrScanner.value.destroy();
      }
    });

    /**
     * Handle QR code result by checking if it's a URL to the current domain
     * and automatically redirecting if it is
     */
    const handleQrCodeResult = (result) => {
      try {
        // Extract the data from the QR code
        const qrData = result.data;
        
        // Check if it's a URL
        if (!qrData.startsWith('http://') && !qrData.startsWith('https://')) {
          return; // Not a URL, ignore
        }
        
        // Try to parse the URL
        const qrUrl = new URL(qrData);
        const currentDomain = window.location.hostname;
        
        // Check if this URL is for the current domain
        if (qrUrl.hostname !== currentDomain) {
          return;
        }

        console.log('Detected QR code with URL to current domain:', qrUrl.href);
        
        // Stop scanning before redirecting
        if (qrScanner.value) {
          qrScanner.value.stop();
        }

        // Get the path and query parameters from the URL
        const urlParams = new URLSearchParams(qrUrl.search);
        
        // Redirect to the detected URL (this keeps us on the same tab)
        window.location.href = qrUrl.href;
      } catch (error) {
        console.error('Error processing QR code URL:', error);
      }
    };

    const handleImageUpload = (processedReceipt) => {
      // Store the processed receipt data
      capturedReceipt.value = processedReceipt;
      
      // Stop the camera since we don't need it anymore
      if (qrScanner.value) {
        qrScanner.value.stop();
      }
    };

    const viewHistory = () => {
      // Navigate to the historical receipts view
      router.push('/history');
    };

    return {
      videoElement,
      capturedReceipt,
      hasPermission,
      notification,
      clearNotification,
      receiptId,
      decryptionKey,
      isProcessing,
      isSettingsOpen,
      cameraInitializing,
      toggleFlash,
      captureReceipt,
      resetCapture,
      toggleSettings,
      handleQrCodeResult,
      handleImageUpload,
      viewHistory
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 