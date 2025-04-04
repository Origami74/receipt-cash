<template>
  <div class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div class="text-center">
      <div class="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
      <div class="text-white text-lg font-medium">{{ message }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Spinner',
  props: {
    message: {
      type: String,
      default: 'Loading...'
    }
  }
}
</script> 