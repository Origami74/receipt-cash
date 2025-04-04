<template>
  <div class="h-full">
    <settlement-view v-if="receiptId" :event-id="receiptId" />
    <template v-else>
      <div v-if="!capturedReceipt" class="camera-container">
        <video ref="videoElement" class="h-full w-full object-cover"></video>
        
        <div class="camera-overlay">
          <div class="p-4 bg-black/50">
            <h1 class="text-white text-center text-xl font-bold">Receipt Cash</h1>
          </div>
          
          <div v-if="permissionError" class="p-4 bg-red-500/80 text-white text-center">
            {{ permissionError }}
            <button @click="requestCameraPermission" class="btn-primary mt-2">
              Grant Camera Access
            </button>
          </div>
          
          <div v-else class="p-4 bg-black/50 flex justify-between">
            <button @click="toggleFlash" class="btn-secondary">
              <span class="material-icons">flash_on</span>
            </button>
            <button @click="captureReceipt" class="btn-primary">
              Capture Receipt
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
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import QrScanner from 'qr-scanner';
import ReceiptDisplay from '../components/ReceiptDisplay.vue';
import SettlementView from './SettlementView.vue';

export default {
  name: 'HomeView',
  components: {
    ReceiptDisplay,
    SettlementView
  },
  setup() {
    const route = useRoute();
    const videoElement = ref(null);
    const qrScanner = ref(null);
    const capturedReceipt = ref(null);
    const hasPermission = ref(false);
    const permissionError = ref(null);
    const receiptId = computed(() => route.query.receipt);
    
    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after getting permission
        hasPermission.value = true;
        initializeCamera();
      } catch (error) {
        console.error('Camera permission error:', error);
        permissionError.value = 'Camera access is required to scan receipts. Please enable camera access in your browser settings.';
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
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true
          }
        );
        await qrScanner.value.start();
      } catch (error) {
        console.error('Error initializing camera:', error);
        permissionError.value = 'Failed to initialize camera. Please try refreshing the page.';
      }
    };

    const toggleFlash = async () => {
      if (qrScanner.value) {
        try {
          await qrScanner.value.toggleFlash();
        } catch (error) {
          console.error('Error toggling flash:', error);
        }
      }
    };

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
        
        // Show loading state
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        loadingMessage.innerHTML = `
          <div class="bg-white p-4 rounded-lg text-center">
            <div class="text-lg font-bold mb-2">Processing Receipt...</div>
            <div class="text-sm text-gray-600">Please wait while we analyze your receipt</div>
          </div>
        `;
        document.body.appendChild(loadingMessage);
        
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
                    text: "Please analyze this receipt and extract the items (with prices and quantities), tax, total amount and currency (in ISO 4217). Output the result as RAW JSON (no markdown) of the following format: {  \"items\": [    {      \"name\": \"Item1\",      \"quantity\": 3,      \"price\": 0.90,      \"total\": 2.70    }  ],  \"tax\": {    \"rate_percent\": \"22.00\",    \"amount\": 0.85  },  \"currency\": \"EUR\"  \"total_amount\": 4.70}"
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
          const errorText = await response.text();
          console.error('API Error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Failed to process receipt: ${response.status} ${response.statusText}`);
        }
        
        const receiptData = await response.json();
        console.log('API Response:', receiptData);
        
        // Parse the response text to extract receipt data
        const responseText = receiptData.choices[0].message.content;
        console.log('Response text:', responseText);

        try {
          // Try to parse the response as JSON
          const parsedData = JSON.parse(responseText);
          
          // Validate the required fields
          if (!Array.isArray(parsedData.items) || 
              !parsedData.tax || 
              typeof parsedData.tax.rate_percent !== 'string' ||
              typeof parsedData.tax.amount !== 'number' ||
              typeof parsedData.currency !== 'string' ||
              typeof parsedData.total_amount !== 'number') {
            throw new Error('Invalid receipt data format');
          }

          // Validate each item
          parsedData.items.forEach(item => {
            if (!item.name || 
                typeof item.quantity !== 'number' || 
                typeof item.price !== 'number' || 
                typeof item.total !== 'number') {
              throw new Error('Invalid item format');
            }
          });

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
            taxRate: parsedData.tax.rate_percent,
            currency: parsedData.currency,
            total: parsedData.total_amount
          };
        } catch (error) {
          console.error('Error parsing receipt data:', error);
          alert('Failed to parse receipt data. Please try again.');
          throw error;
        }
        
        // Stop the camera since we don't need it anymore
        if (qrScanner.value) {
          qrScanner.value.stop();
        }
        
      } catch (error) {
        console.error('Error capturing receipt:', error);
        alert('Failed to process receipt. Please try again.');
      } finally {
        // Remove loading message
        const loadingMessage = document.querySelector('.fixed.inset-0');
        if (loadingMessage) {
          loadingMessage.remove();
        }
      }
    };

    const resetCapture = () => {
      capturedReceipt.value = null;
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
      permissionError,
      receiptId,
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