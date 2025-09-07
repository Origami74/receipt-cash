<template>
  <div class="bg-white shadow-sm p-4">
    <div class="flex items-center justify-between">
      <button @click="goBack" class="btn flex items-center text-gray-700 hover:text-gray-900">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>
      <h1 class="text-xl font-bold">Activity Monitor</h1>
      <div class="w-16"></div> <!-- Spacer for center alignment -->
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActivityHeader',
  emits: ['back'],
  setup(props, { emit }) {
    const goBack = () => {
      emit('back');
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