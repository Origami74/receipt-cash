<template>
  <div class="bg-white rounded-lg shadow p-3">
    <div class="grid grid-cols-3 gap-3">
      <!-- Receipts Card -->
      <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded p-3 border border-blue-200">
        <div class="flex items-center justify-center gap-2 mb-2">
          <div class="w-8 h-8 bg-blue-200 rounded flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5l-3-3H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v4.586a1 1 0 01-.293.707l-1.414 1.414A1 1 0 0018 13v4.586a1 1 0 01-.293.707L15 21z" />
            </svg>
          </div>
          <p class="text-xl font-bold text-blue-700">{{ receiptsCount }}</p>
        </div>
        <h3 class="text-xs font-bold text-blue-900 text-center">Receipts</h3>
      </div>

      <!-- Handling Card -->
      <div class="bg-gradient-to-r from-orange-50 to-orange-100 rounded p-3 border border-orange-200">
        <div class="flex items-center justify-center gap-2 mb-2">
          <div class="w-8 h-8 bg-orange-200 rounded flex items-center justify-center">
            <svg v-if="handlingCount > 0" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-700 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-xl font-bold text-orange-700">{{ handlingCount }}</p>
        </div>
        <h3 class="text-xs font-bold text-orange-900 text-center">Handling</h3>
      </div>

      <!-- Errors Card -->
      <div class="bg-gradient-to-r from-red-50 to-red-100 rounded p-3 border border-red-200">
        <div class="flex items-center justify-center gap-2 mb-2">
          <div class="w-8 h-8 bg-red-200 rounded flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-xl font-bold text-red-700">{{ errorsCount }}</p>
        </div>
        <h3 class="text-xs font-bold text-red-900 text-center">ERRORS</h3>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActivitySummaryCards',
  props: {
    receiptsCount: {
      type: Number,
      default: 0
    },
    handlingCount: {
      type: Number,
      default: 0
    },
    errorsCount: {
      type: Number,
      default: 0
    },
    statusMessage: {
      type: String,
      default: ''
    }
  }
};
</script>