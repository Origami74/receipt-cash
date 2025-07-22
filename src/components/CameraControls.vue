<template>
  <div class="camera-controls">
    <!-- Top-left: Historical receipts button -->
    <button
      @click="$emit('view-history')"
      class="absolute left-4 top-2 w-12 h-12 rounded-full bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors"
      title="View Receipt History"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="w-6 h-6 text-white"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    </button>
    
    <!-- Left side: Upload button -->
    <button
      @click="openFileUpload"
      class="absolute left-8 w-12 h-12 rounded-lg bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors overflow-hidden"
      style="bottom: 3rem;"
    >
      <div v-if="!lastCapturedImage" class="flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="w-6 h-6 text-white"
        >
          <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd" />
        </svg>
      </div>
      <img
        v-else
        :src="lastCapturedImage"
        alt="Last captured image"
        class="w-full h-full object-cover rounded-lg"
      />
    </button>
    
    <!-- Center: Capture button (absolutely centered) -->
    <button
      @click="$emit('capture-receipt')"
      class="absolute left-1/2 -translate-x-1/2 bottom-8 w-20 h-20 rounded-full bg-red-500 border-4 border-white flex items-center justify-center hover:bg-red-600 active:bg-red-700 transition-colors"
    >
      <div class="w-16 h-16 rounded-full bg-red-500"></div>
    </button>
    
    <!-- Left of capture: Flash button -->
    <button
      @click="$emit('toggle-flash')"
      class="absolute w-12 h-12 rounded-full bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors"
      style="bottom: 3rem; left: calc(50% - 6rem);"
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
    
    <!-- Right of capture: Settings button -->
    <button
      @click="$emit('toggle-settings')"
      class="absolute w-12 h-12 rounded-full bg-black/50 border-2 border-white/50 flex items-center justify-center hover:bg-black/70 active:bg-black/90 transition-colors"
      style="bottom: 3rem; right: calc(50% - 6rem);"
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
    
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      @change="handleFileUpload"
      class="hidden"
    />
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { showNotification } from '../services/notificationService';
import receiptService from '../services/aiService';

export default {
  name: 'CameraControls',
  emits: ['toggle-flash', 'capture-receipt', 'toggle-settings', 'image-uploaded'],
  setup(props, { emit }) {
    const fileInput = ref(null);
    const lastCapturedImage = ref(null);
    
    // Load last captured image from localStorage on mount
    onMounted(() => {
      const savedImage = localStorage.getItem('lastCapturedImagePreview');
      if (savedImage) {
        lastCapturedImage.value = savedImage;
      }
    });
    
    const openFileUpload = () => {
      fileInput.value?.click();
    };
    
    const handleFileUpload = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        showNotification('Image file is too large. Please select a file smaller than 10MB.', 'error');
        return;
      }
      
      try {
        // Create a preview image URL
        const previewUrl = URL.createObjectURL(file);
        lastCapturedImage.value = previewUrl;
        
        // Save preview to localStorage (as data URL for persistence)
        const reader = new FileReader();
        reader.onload = (e) => {
          localStorage.setItem('lastCapturedImagePreview', e.target.result);
        };
        reader.readAsDataURL(file);
        
        // Convert file to base64 for processing
        const base64Image = await convertFileToBase64(file);
        
        showNotification('Processing uploaded image...', 'info');
        
        // Process the uploaded image
        const processedReceipt = await receiptService.processReceiptImage(base64Image);
        
        // Emit the processed receipt to parent
        emit('image-uploaded', processedReceipt);
        
        showNotification('Image processed successfully!', 'success');
        
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        showNotification(error.message || 'Failed to process uploaded image', 'error');
      }
      
      // Reset file input
      event.target.value = '';
    };
    
    const convertFileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Remove the data URL prefix to get just the base64 string
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };
    
    return {
      fileInput,
      lastCapturedImage,
      openFileUpload,
      handleFileUpload
    };
  }
};
</script>

<style scoped>
.camera-controls {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.camera-controls button {
  pointer-events: auto;
}

.camera-controls input {
  pointer-events: auto;
}
</style>