<template>
  <Transition
    enter-active-class="transform ease-out duration-300 transition"
    enter-from-class="translate-y-[-100%] opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transform ease-in duration-200 transition"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-[-100%] opacity-0"
  >
    <div 
      v-if="show"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md"
    >
      <div 
        class="bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 p-4"
        :class="{
          'bg-red-50': type === 'error',
          'bg-yellow-50': type === 'warning',
          'bg-green-50': type === 'success'
        }"
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg 
              v-if="type === 'error'"
              class="h-6 w-6 text-red-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke-width="1.5" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div class="ml-3 w-0 flex-1">
            <p 
              class="text-sm font-medium"
              :class="{
                'text-red-800': type === 'error',
                'text-yellow-800': type === 'warning',
                'text-green-800': type === 'success'
              }"
            >
              {{ message }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, onMounted, watch } from 'vue';

export default {
  name: 'Notification',
  props: {
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: 'error',
      validator: (value) => ['error', 'warning', 'success'].includes(value)
    },
    duration: {
      type: Number,
      default: 3000
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const show = ref(true);
    let timeout;
    let closeTimeout;

    const startTimer = () => {
      // Clear any existing timeouts
      if (timeout) clearTimeout(timeout);
      if (closeTimeout) clearTimeout(closeTimeout);

      // Start new timeouts
      timeout = setTimeout(() => {
        show.value = false;
        closeTimeout = setTimeout(() => emit('close'), 200); // Wait for leave animation
      }, props.duration);
    };

    // Start timer on mount
    onMounted(startTimer);

    // Reset timer when message changes
    watch(() => props.message, startTimer);

    return {
      show
    };
  }
};
</script> 