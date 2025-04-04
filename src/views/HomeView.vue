<template>
  <div class="h-full">
    <settlement-view v-if="receiptId" :event-id="receiptId" />
    <template v-else>
      <div v-if="!capturedReceipt" class="camera-container">
        <video ref="videoElement" class="h-full w-full object-cover"></video>
        
        <div class="camera-overlay">
          <div class="p-4 bg-black/50">
            <h1 class="text-white text-center text-xl font-bold">Receipt.Cash</h1>
          </div>
          
          <Notification
            v-if="notification"
            :message="notification.message"
            :type="notification.type"
            @close="notification = null"
          />
          
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
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import QrScanner from 'qr-scanner';
import ReceiptDisplay from '../components/ReceiptDisplay.vue';
import SettlementView from './SettlementView.vue';
import Notification from '../components/Notification.vue';
import Spinner from '../components/Spinner.vue';

export default {
  name: 'HomeView',
  components: {
    ReceiptDisplay,
    SettlementView,
    Notification,
    Spinner
  },
  setup() {
    const route = useRoute();
    const videoElement = ref(null);
    const qrScanner = ref(null);
    const capturedReceipt = ref(null);
    const hasPermission = ref(false);
    const notification = ref(null);
    const receiptId = computed(() => route.query.receipt);
    const isProcessing = ref(false);
    
    const showNotification = (message, type = 'error') => {
      notification.value = { message, type };
    };
    
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
        qrScanner.value = new QrScanner(
          videoElement.value,
          (result) => {
            console.log('QR Code detected:', result);
            // Handle QR code result
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
        
        // Send to ppq.ai API
        const response = await fetch('https://api.ppq.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_PPQ_API_KEY ?? "sk-uh7yDIMONkvLmreJgw0bDA"}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Please analyze this receipt and extract the items (with prices and quantities), tax, total amount and currency (in ISO 4217). Output the result as RAW JSON (no markdown) of the following format:
{
  "items": [
    {
      "name": "Item1",
      "quantity": 3,
      "price": 0.90,
      "total": 2.70
    }
  ],
  "tax": {
    "amount": 0.85
  },
  "currency": "EUR",
  "total_amount": 4.70
}

Here are some things to keep in mind:
- The receipt can be in any language
- The receipt can be blurry or have a low resolution
- NEVER use a column indicating tax (tx) as the quantity of an item!
- Some receipts don't show the price per item, only the total price for that line item
`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`
                    }
                  }
                ]
              }
            ]
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to process receipt: ${response.status} ${response.statusText}`);
        }
        
        const receiptData = await response.json();
        const responseText = receiptData.choices[0].message.content;

        try {
          // Try to parse the response as JSON
          const parsedData = JSON.parse(responseText);
          
          // Transform the data to match our component's format
          capturedReceipt.value = {
            merchant: "Store", // We'll get this from the API later
            date: new Date().toISOString().split('T')[0],
            items: parsedData.items.map(item => ({
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.total
            })),
            tax: parsedData.tax.amount,
            currency: parsedData.currency,
            total: parsedData.total_amount
          };

          showNotification('Receipt processed successfully!', 'success');
        } catch (error) {
          console.log("Response:", responseText);
          console.error('Error parsing receipt data:', error);
          throw new Error('Failed to read receipt data. Please try again, make sure the receipt is in focus and not blurry.');
        }
        
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

    onMounted(() => {
      requestCameraPermission();
    });

    onUnmounted(() => {
      if (qrScanner.value) {
        qrScanner.value.destroy();
      }
    });

    return {
      videoElement,
      capturedReceipt,
      hasPermission,
      notification,
      receiptId,
      isProcessing,
      toggleFlash,
      captureReceipt,
      resetCapture
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style> 