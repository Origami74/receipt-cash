<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="goBack" class="btn flex items-center text-gray-700 hover:text-gray-900">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <h1 class="text-xl font-bold">Paid Receipts</h1>
        <div class="w-16"></div> <!-- Spacer for center alignment -->
      </div>
    </div>

    <!-- Coming Soon Message -->
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-700 mb-2">Coming Soon</h2>
        <p class="text-gray-500">This feature is currently under development</p>
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router';

export default {
  name: 'PaidReceiptsView',
  setup() {
    const router = useRouter();

    const goBack = () => {
      router.push('/');
    };

    return {
      goBack
    };
  }
};
</script>

<style scoped>
.btn {
  @apply px-3 py-1 rounded transition-colors;
}
</style>