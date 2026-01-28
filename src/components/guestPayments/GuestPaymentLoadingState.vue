<template>
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p class="text-gray-600">Loading payments...</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GuestPaymentLoadingState'
};
</script>