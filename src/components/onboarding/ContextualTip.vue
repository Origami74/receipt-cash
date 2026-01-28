<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    @click.self="handleDismiss"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
    
    <!-- Tip Card -->
    <div 
      class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-slide-up"
      @click.stop
    >
      <!-- Icon/Image -->
      <div v-if="image || icon" class="flex justify-center">
        <img 
          v-if="image"
          :src="image" 
          :alt="title"
          class="max-w-full max-h-48 object-contain"
        />
        <div 
          v-else-if="icon"
          class="text-6xl"
        >
          {{ icon }}
        </div>
      </div>
      
      <!-- Title -->
      <h2 class="text-2xl font-bold text-gray-900 text-center">
        {{ title }}
      </h2>
      
      <!-- Description -->
      <p class="text-lg text-gray-600 text-center leading-relaxed">
        {{ description }}
      </p>
      
      <!-- Bullet Points (optional) -->
      <ul v-if="bullets && bullets.length > 0" class="space-y-2 text-left">
        <li 
          v-for="(bullet, index) in bullets" 
          :key="index"
          class="flex items-start space-x-2 text-gray-700"
        >
          <span class="text-green-500 font-bold mt-0.5">✓</span>
          <span>{{ bullet }}</span>
        </li>
      </ul>
      
      <!-- Actions -->
      <div class="flex flex-col space-y-2 pt-2">
        <!-- Primary Action -->
        <button
          @click="handlePrimaryAction"
          class="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {{ primaryButtonText }}
        </button>
        
        <!-- Secondary Action (optional) -->
        <button
          v-if="secondaryButtonText"
          @click="handleSecondaryAction"
          class="w-full text-gray-600 hover:text-gray-800 font-medium py-2 px-6 rounded-lg transition-colors"
        >
          {{ secondaryButtonText }}
        </button>
      </div>
      
      <!-- Don't show again (optional) -->
      <div v-if="showDontShowAgain" class="flex items-center justify-center pt-2">
        <label class="flex items-center space-x-2 text-sm text-gray-500 cursor-pointer">
          <input 
            type="checkbox" 
            v-model="dontShowAgain"
            class="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span>Don't show this again</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue';
import { onboardingService } from '../../services/onboardingService';

export default {
  name: 'ContextualTip',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    tipName: {
      type: String,
      required: true
    },
    autoMarkSeen: {
      type: Boolean,
      default: true
    },
    icon: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    bullets: {
      type: Array,
      default: () => []
    },
    primaryButtonText: {
      type: String,
      default: 'Got it!'
    },
    secondaryButtonText: {
      type: String,
      default: ''
    },
    showDontShowAgain: {
      type: Boolean,
      default: false
    },
    autoDismiss: {
      type: Number,
      default: 0 // 0 = no auto dismiss, otherwise milliseconds
    }
  },
  emits: ['dismiss', 'primary-action', 'secondary-action'],
  setup(props, { emit }) {
    const dontShowAgain = ref(false);
    let autoDismissTimer = null;

    const handleDismiss = () => {
      // Auto-mark as seen if enabled, or if "don't show again" is checked
      if (props.autoMarkSeen || dontShowAgain.value) {
        onboardingService.markTipSeen(props.tipName);
      }
      emit('dismiss');
    };

    const handlePrimaryAction = () => {
      // Auto-mark as seen if enabled, or if "don't show again" is checked
      if (props.autoMarkSeen || dontShowAgain.value) {
        onboardingService.markTipSeen(props.tipName);
      }
      emit('primary-action');
      emit('dismiss');
    };

    const handleSecondaryAction = () => {
      // Auto-mark as seen if enabled, or if "don't show again" is checked
      if (props.autoMarkSeen || dontShowAgain.value) {
        onboardingService.markTipSeen(props.tipName);
      }
      emit('secondary-action');
      emit('dismiss');
    };

    // Auto-dismiss timer
    watch(() => props.show, (newShow) => {
      if (newShow && props.autoDismiss > 0) {
        autoDismissTimer = setTimeout(() => {
          handleDismiss();
        }, props.autoDismiss);
      } else if (!newShow && autoDismissTimer) {
        clearTimeout(autoDismissTimer);
        autoDismissTimer = null;
      }
    });

    return {
      dontShowAgain,
      handleDismiss,
      handlePrimaryAction,
      handleSecondaryAction
    };
  }
};
</script>

<style scoped>
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
</style>