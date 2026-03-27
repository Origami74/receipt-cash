<template>
  <div class="h-full">
    <PaymentView
      v-if="receiptId"
      :event-id="receiptId"
      :decryption-key="decryptionKey"
    />
    <template v-else>
      <!-- Camera Tip (first time) -->
      <ContextualTip
        :show="showCameraTip"
        tip-name="CameraTip"
        :image="tipCameraImg"
        title="Capture Receipt"
        description="Take a clear photo of your receipt - our AI will extract items automatically!"
        :bullets="['Point camera at receipt', 'Ensure good lighting', 'Tap capture button']"
        primary-button-text="Got it!"
        @dismiss="showCameraTip = false"
      />
      
      <!-- Show captured image immediately after taking photo -->
      <div v-if="capturedImage" class="h-full flex flex-col bg-gray-900">
        <div class="flex-1 flex items-center justify-center p-4">
          <img :src="capturedImage" alt="Captured receipt" class="max-w-full max-h-full object-contain" />
        </div>
        <div class="p-4 bg-black/50 text-white text-center">
          <p class="text-sm">Processing receipt...</p>
        </div>
      </div>
      
      <div v-else-if="!capturedImage" class="camera-container">
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
                :src="logoImg"
                :alt="labelConfig.appName + ' Logo'"
                class="w-8 h-8"
              />
              <h1 class="text-white text-center text-xl font-bold">{{ labelConfig.appName }}</h1>
            </div>
          </div>
          
          <camera-controls
            @toggle-flash="toggleFlash"
            @capture-receipt="captureReceipt"
            @toggle-settings="$emit('toggle-settings')"
            @file-selected="handleFileSelected"
          />
        </div>
        
        <!-- Camera Quick Nav outside of camera-overlay for proper z-index -->
        <camera-quick-nav
          @toggle-activity="handleToggleActivity"
          @toggle-settings="$emit('toggle-settings')"
        />
      </div>
    </template>
    
    <Spinner v-if="isProcessing" message="Processing receipt..." />
    
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QrScanner from 'qr-scanner';
import Notification from '../components/Notification.vue';
import Spinner from '../components/Spinner.vue';
import CameraControls from '../components/cameraView/CameraControls.vue';
import CameraPermissionOverlay from '../components/cameraView/CameraPermissionOverlay.vue';
import CameraQuickNav from '../components/cameraView/CameraQuickNav.vue';
import ContextualTip from '../components/onboarding/ContextualTip.vue';
import PaymentView from './PaymentView.vue';
import { showNotification, useNotification } from '../services/notificationService';
import receiptService from '../services/aiService';
import { getCameraPermission, saveCameraPermission } from '../services/storageService';
import { onboardingService } from '../services/onboardingService';
import { tipCameraImg, logoImg } from '../assets/images/onboard';
import { labelConfig } from '../config/label';

export default {
  name: 'HomeView',
  emits: ['toggle-settings'],
  components: {
    Notification,
    Spinner,
    CameraControls,
    CameraPermissionOverlay,
    CameraQuickNav,
    ContextualTip,
    PaymentView
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const videoElement = ref(null);
    const qrScanner = ref(null);
    const hasPermission = ref(false);
    const receiptId = computed(() => route.query.receipt);
    const decryptionKey = computed(() => route.query.key);
    const isProcessing = ref(false);
    const cameraInitializing = ref(false);
    const isRequestingCameraPermission = ref(false); // Guard flag to prevent concurrent requests
    
    // Use the global notification system
    const { notification, clearNotification } = useNotification();
    
    // Onboarding: Camera tip only (notification tip is in ReceiptView)
    const showCameraTip = ref(false);
    
    const requestCameraPermission = async () => {
      // Prevent concurrent permission requests
      if (isRequestingCameraPermission.value) {
        console.log('⚠️ Camera permission request already in progress, skipping duplicate');
        return;
      }
      
      try {
        isRequestingCameraPermission.value = true;
        cameraInitializing.value = true;
        console.log('Requesting camera permission...');
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        hasPermission.value = true;
        
        // Save the permission preference
        saveCameraPermission(true);
        console.log('Camera permission granted and saved');
        
        // Use nextTick to ensure DOM is updated before initializing camera
        await new Promise(resolve => setTimeout(resolve, 100));
        await initializeCamera();
      } catch (error) {
        console.error('Camera permission error:', error);
        
        // Check if the user explicitly denied permission
        const isPermissionDenied = error.name === 'NotAllowedError' ||
                                   error.name === 'PermissionDeniedError' ||
                                   error.message.includes('Permission denied');
        
        // Save denial preference
        if (isPermissionDenied) {
          saveCameraPermission(false);
          console.log('Camera permission explicitly denied by user and saved');
        }
        
        // Only show notification if it's not an explicit denial
        if (!isPermissionDenied) {
          showNotification('Camera access failed. Please check your browser settings and try again.');
        }
        
        hasPermission.value = false;
        cameraInitializing.value = false;
      } finally {
        isRequestingCameraPermission.value = false;
      }
    };

    const initializeCamera = async () => {
      // Don't request permission here - that's handled by requestCameraPermission()
      // This function should only be called when permission is already granted
      if (!hasPermission.value) {
        console.warn('initializeCamera called without permission');
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

    const capturedImage = ref(null);
    
    const captureReceipt = async () => {
      if (!hasPermission.value) {
        await requestCameraPermission();
        return;
      }

      try {
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
        
        // Stop the camera immediately after capture
        if (qrScanner.value) {
          qrScanner.value.stop();
        }
        
        // Show the captured image immediately
        capturedImage.value = `data:image/jpeg;base64,${base64Image}`;
        
        isProcessing.value = true;
        showNotification('Processing receipt...', 'info');
        
        // Process the image in the background
        try {
          const processedReceipt = await receiptService.processReceiptImage(base64Image);
          
          // Clear the image
          capturedImage.value = null;
          
          showNotification('Receipt processed successfully!', 'success');
          
          // Navigate to receipt review view with data in URL
          const receiptDataEncoded = encodeURIComponent(JSON.stringify(processedReceipt));
          router.push({
            path: '/create/review',
            query: { data: receiptDataEncoded }
          });
        } catch (processingError) {
          console.error('Error processing receipt:', processingError);
          showNotification(processingError.message);
          // Clear the image on error and restart camera
          capturedImage.value = null;
          if (hasPermission.value && qrScanner.value) {
            qrScanner.value.start();
          }
        }
        
      } catch (error) {
        console.error('Error capturing receipt:', error);
        showNotification(error.message);
      } finally {
        isProcessing.value = false;
      }
    };

    const handleToggleActivity = () => {
      console.log('Activity toggle requested from camera quick nav');
      router.push('/activity');
    };

    // Watch for changes to receiptId
    watch(receiptId, (newValue, oldValue) => {
      // If we're transitioning from having a receipt to no receipt,
      // don't automatically request camera - let user click button
      if (oldValue && !newValue) {
        console.log('Returned to camera view, waiting for user to enable camera');
      }
    });

    // Auto-enable camera on mount if permission was previously granted
    onMounted(async () => {
      const savedPermission = getCameraPermission();
      console.log('Saved camera permission:', savedPermission);
      
      if (savedPermission === true && !receiptId.value) {
        console.log('Auto-enabling camera based on saved preference');
        await requestCameraPermission();
      }
      
      // Show camera tip if first time and welcome is complete
      if (!receiptId.value &&
          onboardingService.hasSeenHostWelcome() &&
          !onboardingService.hasSeen('CameraTip')) {
        // Delay to let camera initialize first
        setTimeout(() => {
          showCameraTip.value = true;
        }, 1000);
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

    const handleFileSelected = async (file) => {
      try {
        // Show the uploaded image preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
          capturedImage.value = e.target.result;
        };
        reader.readAsDataURL(file);
        
        // Stop the camera
        if (qrScanner.value) {
          qrScanner.value.stop();
        }
        
        isProcessing.value = true;
        showNotification('Processing uploaded image...', 'info');
        
        // Convert file to base64 for processing
        const base64Image = await new Promise((resolve) => {
          const fileReader = new FileReader();
          fileReader.onloadend = () => resolve(fileReader.result.split(',')[1]);
          fileReader.readAsDataURL(file);
        });
        
        // Process the image
        const processedReceipt = await receiptService.processReceiptImage(base64Image);
        
        // Clear the preview image
        capturedImage.value = null;
        
        showNotification('Receipt processed successfully!', 'success');
        
        // Navigate to receipt review view with data in URL
        const receiptDataEncoded = encodeURIComponent(JSON.stringify(processedReceipt));
        router.push({
          path: '/create/review',
          query: { data: receiptDataEncoded }
        });
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        showNotification(error.message || 'Failed to process uploaded image');
        capturedImage.value = null;
        // Restart camera
        if (hasPermission.value && qrScanner.value) {
          qrScanner.value.start();
        }
      } finally {
        isProcessing.value = false;
      }
    };


    return {
      videoElement,
      capturedImage,
      hasPermission,
      notification,
      clearNotification,
      receiptId,
      decryptionKey,
      isProcessing,
      cameraInitializing,
      showCameraTip,
      toggleFlash,
      captureReceipt,
      handleToggleActivity,
      handleQrCodeResult,
      handleFileSelected,
      requestCameraPermission,
      tipCameraImg,
      logoImg,
      labelConfig
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 