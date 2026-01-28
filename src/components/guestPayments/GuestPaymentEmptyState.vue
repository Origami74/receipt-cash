<template>
  <div class="flex-1 flex items-center justify-center p-4">
    <div class="text-center">
      <svg class="h-24 w-24 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h2 class="text-2xl font-bold text-gray-700 mb-2">No Payments Yet</h2>
      <p class="text-gray-500">You haven't paid for any receipts yet.</p>
      <p class="text-gray-500">Scan a QR code to get started!</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GuestPaymentEmptyState'
};
</script>