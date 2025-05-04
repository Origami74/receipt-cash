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
        
        <div class="camera-overlay">
          <div class="p-4 bg-black/50">
            <h1 class="text-white text-center text-xl font-bold">Receipt.Cash</h1>
          </div>
          
          <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8">
            <button
              @click="toggleFlash"
              class="w-12 h-12 rounded-full bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="w-6 h-6 text-white"
              >
                <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </button>
            
            <button
              @click="captureReceipt"
              class="w-20 h-20 rounded-full bg-red-500 border-4 border-white flex items-center justify-center hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              <div class="w-16 h-16 rounded-full bg-red-500"></div>
            </button>
            
            <button
              @click="toggleSettings"
              class="w-12 h-12 rounded-full bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="w-6 h-6 text-white"
              >
                <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <receipt-display 
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
import { useRoute } from 'vue-router';
import QrScanner from 'qr-scanner';
import ReceiptDisplay from '../components/ReceiptDisplay.vue';
import SettlementView from './SettlementView.vue';
import Notification from '../components/Notification.vue';
import Spinner from '../components/Spinner.vue';
import SettingsMenu from '../components/SettingsMenu.vue';
import { showNotification, useNotification } from '../utils/notification';
import receiptService from '../services/receipt';

export default {
  name: 'HomeView',
  components: {
    ReceiptDisplay,
    SettlementView,
    Notification,
    Spinner,
    SettingsMenu
  },
  setup() {
    const route = useRoute();
    const videoElement = ref(null);
    const qrScanner = ref(null);
    const capturedReceipt = ref(null);
    const hasPermission = ref(false);
    const receiptId = computed(() => route.query.receipt);
    const decryptionKey = computed(() => route.query.key);
    const isProcessing = ref(false);
    const isSettingsOpen = ref(false);
    
    // Use the global notification system
    const { notification, clearNotification } = useNotification();
    
    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        hasPermission.value = true;
        initializeCamera();
      } catch (error) {
        console.error('Camera permission error:', error);
        showNotification('Camera access is required to scan receipts. Please enable camera access in your browser settings.');
        hasPermission.value = false;
      }
    };

    const initializeCamera = async () => {
      if (!hasPermission.value) {
        await requestCameraPermission();
        return;
      }

      try {
        // Check if video element is available
        if (!videoElement.value) {
          console.warn('Video element not available yet, waiting for DOM update');
          // Wait for the next tick to ensure video element is mounted
          setTimeout(initializeCamera, 100);
          return;
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
        await qrScanner.value.start();
      } catch (error) {
        console.error('Error initializing camera:', error);
        showNotification('Failed to initialize camera. Please try refreshing the page.');
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
      toggleFlash,
      captureReceipt,
      resetCapture,
      toggleSettings,
      handleQrCodeResult
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 