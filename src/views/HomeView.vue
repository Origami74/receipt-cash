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

      <div v-else-if="!capturedImage" class="camera-container" :class="{ 'native-camera': isNative }">
        <!-- Web-only: video element for getUserMedia -->
        <video v-if="!isNative" ref="videoElement" class="h-full w-full object-cover"></video>

        <!-- Camera Permission Overlay Component -->
        <CameraPermissionOverlay
          :hasPermission="hasPermission"
          :isInitializing="cameraInitializing"
          @request-permission="requestCameraPermission"
        />

        <div class="camera-overlay">
          <div class="px-4 pb-4 bg-black/50 camera-overlay-header">
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
import { Capacitor } from '@capacitor/core';
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

const isNative = Capacitor.isNativePlatform();

// Eagerly load native camera plugin so it's ready by onMounted
let CameraPreview = null;
const cameraPreviewReady = isNative
  ? import('@capgo/camera-preview').then(mod => {
      CameraPreview = mod.CameraPreview;
    })
  : Promise.resolve();

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
    const isRequestingCameraPermission = ref(false);
    const nativeCameraRunning = ref(false);

    // Use the global notification system
    const { notification, clearNotification } = useNotification();

    // Onboarding: Camera tip only (notification tip is in ReceiptView)
    const showCameraTip = ref(false);

    const maybeShowCameraTip = () => {
      if (!onboardingService.hasSeen('CameraTip')) {
        setTimeout(() => { showCameraTip.value = true; }, 500);
      }
    };

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

        if (isNative) {
          // Ensure the plugin is loaded
          await cameraPreviewReady;
          const status = await CameraPreview.requestPermissions({ disableAudio: true });
          if (status.camera === 'granted') {
            hasPermission.value = true;
            saveCameraPermission(true);
            maybeShowCameraTip();
            console.log('Native camera permission granted');
            await new Promise(resolve => setTimeout(resolve, 100));
            await initializeCamera();
          } else {
            saveCameraPermission(false);
            hasPermission.value = false;
            cameraInitializing.value = false;
          }
        } else {
          // Web: use getUserMedia
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          hasPermission.value = true;
          saveCameraPermission(true);
          maybeShowCameraTip();
          console.log('Camera permission granted and saved');
          await new Promise(resolve => setTimeout(resolve, 100));
          await initializeCamera();
        }
      } catch (error) {
        console.error('Camera permission error:', error);

        const isPermissionDenied = error.name === 'NotAllowedError' ||
                                   error.name === 'PermissionDeniedError' ||
                                   error.message?.includes('Permission denied');

        if (isPermissionDenied) {
          saveCameraPermission(false);
          console.log('Camera permission explicitly denied by user and saved');
        }

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
      if (!hasPermission.value) {
        console.warn('initializeCamera called without permission');
        return;
      }

      try {
        cameraInitializing.value = true;

        if (isNative) {
          // Native: start camera preview behind the WebView
          await cameraPreviewReady;
          if (nativeCameraRunning.value) {
            cameraInitializing.value = false;
            console.log('Native camera already running, reusing');
            return;
          }
          document.documentElement.classList.add('native-camera-active');
          await CameraPreview.start({
            position: 'rear',
            toBack: true,
            disableAudio: true,
            aspectMode: 'cover',
            x: 0,
            y: 0,
            width: window.screen.width,
            height: window.screen.height,
          });
          nativeCameraRunning.value = true;
          cameraInitializing.value = false;
          console.log('Native camera preview started');
        } else {
          // Web: use QrScanner with getUserMedia
          let retries = 0;
          const maxRetries = 20;

          while (!videoElement.value && retries < maxRetries) {
            console.log(`Waiting for video element... attempt ${retries + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }

          if (!videoElement.value) {
            throw new Error('Video element not available after waiting');
          }

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
        }
      } catch (error) {
        console.error('Error initializing camera:', error);
        showNotification('Failed to initialize camera. Please try refreshing the page.');
        hasPermission.value = false;
        cameraInitializing.value = false;
      }
    };

    const toggleFlash = async () => {
      try {
        if (isNative && nativeCameraRunning.value) {
          const { flashMode } = await CameraPreview.getFlashMode();
          await CameraPreview.setFlashMode({
            flashMode: flashMode === 'torch' ? 'off' : 'torch'
          });
        } else if (qrScanner.value) {
          await qrScanner.value.toggleFlash();
        }
      } catch (error) {
        console.error('Error toggling flash:', error);
        showNotification('Failed to toggle flash. Your device may not support this feature.', "warning");
      }
    };

    const capturedImage = ref(null);

    const captureReceipt = async () => {
      if (!hasPermission.value) {
        await requestCameraPermission();
        return;
      }

      try {
        let base64Image;

        // Show processing state immediately for fast feedback
        isProcessing.value = true;
        showNotification('Processing receipt...', 'info');

        if (isNative && nativeCameraRunning.value) {
          // Native: capture via plugin with reduced quality for speed
          const result = await CameraPreview.capture({ quality: 85, format: 'jpeg' });
          base64Image = result.value;

          // Stop the native camera after capture
          CameraPreview.stop(); // Don't await — let it tear down in background
          nativeCameraRunning.value = false;
          document.documentElement.classList.remove('native-camera-active');
        } else {
          // Web: capture from video element
          const canvas = document.createElement('canvas');
          const video = videoElement.value;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));

          base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          });

          if (qrScanner.value) {
            qrScanner.value.stop();
          }
        }

        // Show the captured image
        capturedImage.value = `data:image/jpeg;base64,${base64Image}`;

        // Process the image in the background
        try {
          const processedReceipt = await receiptService.processReceiptImage(base64Image);

          capturedImage.value = null;

          showNotification('Receipt processed successfully!', 'success');

          const receiptDataEncoded = encodeURIComponent(JSON.stringify(processedReceipt));
          router.push({
            path: '/create/review',
            query: { data: receiptDataEncoded }
          });
        } catch (processingError) {
          console.error('Error processing receipt:', processingError);
          showNotification(processingError.message);
          capturedImage.value = null;
          // Restart camera on error
          if (isNative) {
            await initializeCamera();
          } else if (hasPermission.value && qrScanner.value) {
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

      // Camera tip is shown after first permission grant (see requestCameraPermission)
    });

    // Pause/resume camera when app is backgrounded/foregrounded
    const handleAppStateChange = async (e) => {
      const { isActive } = e.detail;
      if (!isActive) {
        // App backgrounded — stop camera to free resources
        if (isNative && nativeCameraRunning.value) {
          try { await CameraPreview.stop(); } catch (e) { /* ignore */ }
          nativeCameraRunning.value = false;
          document.documentElement.classList.remove('native-camera-active');
        }
      } else {
        // App foregrounded — restart camera if we had permission
        if (isNative && hasPermission.value && !nativeCameraRunning.value && !receiptId.value && !capturedImage.value) {
          await initializeCamera();
        }
      }
    };

    onMounted(() => {
      document.addEventListener('app-state-change', handleAppStateChange);
    });

    onUnmounted(async () => {
      document.removeEventListener('app-state-change', handleAppStateChange);
      if (isNative && nativeCameraRunning.value) {
        try {
          await CameraPreview.stop();
          nativeCameraRunning.value = false;
          document.documentElement.classList.remove('native-camera-active');
        } catch (e) {
          console.error('Error stopping native camera:', e);
        }
      }
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
        const qrData = result.data;

        if (!qrData.startsWith('http://') && !qrData.startsWith('https://')) {
          return;
        }

        const qrUrl = new URL(qrData);
        // Match against both the current hostname and the label's canonical host
        const validHosts = [window.location.hostname, labelConfig.host];
        if (!validHosts.includes(qrUrl.hostname)) {
          return;
        }

        console.log('Detected QR code with URL to current domain:', qrUrl.href);

        if (qrScanner.value) {
          qrScanner.value.stop();
        }

        // Navigate using the path from the QR URL (works on both web and native)
        const path = qrUrl.pathname + qrUrl.search;
        router.push(path);
      } catch (error) {
        console.error('Error processing QR code URL:', error);
      }
    };

    const handleFileSelected = async (file) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          capturedImage.value = e.target.result;
        };
        reader.readAsDataURL(file);

        // Stop the camera
        if (isNative && nativeCameraRunning.value) {
          await CameraPreview.stop();
          nativeCameraRunning.value = false;
          document.documentElement.classList.remove('native-camera-active');
        } else if (qrScanner.value) {
          qrScanner.value.stop();
        }

        isProcessing.value = true;
        showNotification('Processing uploaded image...', 'info');

        const base64Image = await new Promise((resolve) => {
          const fileReader = new FileReader();
          fileReader.onloadend = () => resolve(fileReader.result.split(',')[1]);
          fileReader.readAsDataURL(file);
        });

        const processedReceipt = await receiptService.processReceiptImage(base64Image);

        capturedImage.value = null;

        showNotification('Receipt processed successfully!', 'success');

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
        if (isNative) {
          await initializeCamera();
        } else if (hasPermission.value && qrScanner.value) {
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
      isNative,
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
/* Native camera renders behind the WebView — make container transparent */
.native-camera {
  background: transparent !important;
}

/* Header background extends to the very top edge, with content pushed below the safe area */
.camera-overlay-header {
  padding-top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 1rem);
}
</style>
