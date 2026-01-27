<template>
  <div class="h-full">
    <receipt-preview
      v-if="receiptData"
      :receipt-data="receiptData"
      @back="handleBack"
    />
    <div v-else class="h-full flex items-center justify-center">
      <div class="text-center text-gray-500">
        <p>No receipt data found</p>
        <button
          @click="$router.push('/')"
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Camera
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReceiptPreview from '../components/ReceiptPreview.vue';

export default {
  name: 'ReceiptCreateView',
  components: {
    ReceiptPreview
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const receiptData = ref(null);

    onMounted(() => {
      // Get receipt data from route query parameter
      if (route.query.data) {
        try {
          receiptData.value = JSON.parse(decodeURIComponent(route.query.data));
        } catch (error) {
          console.error('Error parsing receipt data:', error);
          // Redirect to home if data is invalid
          router.push('/');
        }
      } else {
        // No data provided, redirect to home
        router.push('/');
      }
    });

    const handleBack = () => {
      // Navigate back to camera view
      router.push('/');
    };

    return {
      receiptData,
      handleBack
    };
  }
};
</script>