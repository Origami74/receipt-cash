<template>
  <div class="developer-split-container">
    <div class="flex justify-between items-center mb-2">
      <label for="developerSplit" class="text-sm font-medium text-gray-700">
        Developer Share: {{ displayValue }}%
      </label>
      <div class="emoji-container" :class="{ shaking: isShaking }" :style="{ '--shake-duration': shakeSpeed }">
        <span class="emoji" :style="{ 'transform': `scale(${emojiScale})` }">{{ currentEmoji }}</span>
      </div>
    </div>
    
    <div class="text-xs text-gray-500 mt-1 text-left">
     Donate {{ displayValue }}% of this receipt amount to support development of this app
    </div>

    <div class="relative">
      <input
        id="developerSplit"
        v-model="sliderValue"
        type="range"
        min="0"
        max="1000"
        step="1"
        inputmode="none"
        class="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-custom"
        @input="updateValue"
        @mousedown="startDragging"
        @mouseup="stopDragging"
        @touchstart="startDragging"
        @touchend="stopDragging"
      />
      <div class="flex justify-between text-xs text-gray-500 mt-1">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import confetti from 'canvas-confetti';

export default {
  name: 'DeveloperSplitSlider',
  props: {
    modelValue: {
      type: Number,
      default: 2.1
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isDragging = ref(false);
    
    // Convert percentage back to slider position for external updates
    const percentageToSlider = (percent) => {
      if (percent === 0) return 0;
      const scaleFactor = 4;
      const normalized = percent / 100;
      const sliderPos = Math.log(normalized * (Math.exp(scaleFactor) - 1) + 1) / scaleFactor;
      return Math.round(sliderPos * 1000);
    };
    
    const sliderValue = ref(percentageToSlider(props.modelValue));
    
    // Convert slider value (0-1000) to percentage (0-100) using exponential scale
    // This gives more granular control for low percentages
    const percentage = computed(() => {
      const sliderPos = sliderValue.value / 1000; // Normalize to 0-1
      if (sliderPos === 0) return 0;
      
      // Exponential scale: more precision at low values
      const scaleFactor = 4; // Adjust this to control the curve
      const rawPercentage = (Math.exp(scaleFactor * sliderPos) - 1) / (Math.exp(scaleFactor) - 1) * 100;
      
      // Round to nearest 0.1%
      return Math.round(rawPercentage * 10) / 10;
    });
    
    
    // Display value with proper decimal places
    const displayValue = computed(() => {
      const val = percentage.value;
      return val % 1 === 0 ? val.toString() : val.toFixed(1);
    });
    
    // Emoji based on percentage
    const currentEmoji = computed(() => {
      const p = percentage.value;
      if (p === 0) return '🫤';
      if (p < 1) return '🙂';
      if (p < 2) return '☺️';
      if (p < 5) return '😊';
      if (p < 10) return '😄';
      if (p < 20) return '🤩';
      if (p < 30) return '🥳';
      if (p < 50) return '🎉';
      if (p < 70) return '🚀';
      if (p < 90) return '❤️‍🔥';
      return '👑';
    });
    
    // Shaking animation for values > 2% and only when dragging
    const isShaking = computed(() => {
      return isDragging.value && percentage.value > 2;
    });
    
    // Get shake speed based on percentage - faster for higher values
    const shakeSpeed = computed(() => {
      const p = percentage.value;
      if (p < 5) return '0.3s';
      if (p < 10) return '0.2s';
      if (p < 20) return '0.1s';
      if (p < 50) return '0.05s';
      return '0.01s';
    });
    
    // Get emoji scale based on percentage - grows up to 50% larger
    const emojiScale = computed(() => {
      const p = percentage.value;
      if (p < 5) return 1.2;   // 20% larger
      if (p < 10) return 1.4;  // 40% larger
      if (p < 20) return 1.6;  // 60% larger
      if (p < 50) return 1.8;  // 80% larger
      return 2.0;              // 100% larger
    });
    
    // Confetti for values > 50% and only when dragging
    const shouldShowConfetti = computed(() => {
      return isDragging.value && percentage.value > 50;
    });
    
    // Watch for confetti trigger
    watch(shouldShowConfetti, (newValue, oldValue) => {
      if (newValue && !oldValue) {
        // Trigger confetti when we cross the threshold while dragging
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    });
    
    const updateValue = () => {
      const newPercentage = percentage.value;
      emit('update:modelValue', newPercentage);
    };
    
    const startDragging = () => {
      isDragging.value = true;
    };
    
    const stopDragging = () => {
      isDragging.value = false;
    };
    
    // Watch for external changes to modelValue
    watch(() => props.modelValue, (newValue) => {
      sliderValue.value = percentageToSlider(newValue);
    });
    
    return {
      sliderValue,
      percentage,
      displayValue,
      currentEmoji,
      isShaking,
      shakeSpeed,
      emojiScale,
      isDragging,
      updateValue,
      startDragging,
      stopDragging
    };
  }
};
</script>

<style scoped>
.developer-split-container {
  @apply relative;
}

.emoji-container {
  @apply text-2xl relative;
  transition: transform 0.1s ease-in-out;
}

.emoji {
  display: inline-block;
  transition: transform 0.2s ease-in-out;
}

.shaking {
  animation: shake var(--shake-duration, 0.5s) ease-in-out infinite;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px) rotate(-1deg); }
  75% { transform: translateX(2px) rotate(1deg); }
}

.slider-custom {
  background: linear-gradient(to right, #e5e7eb 0%, #10b981 100%);
}

.slider-custom::-webkit-slider-thumb {
  @apply appearance-none w-6 h-6 bg-green-500 rounded-full cursor-pointer shadow-lg;
  transition: all 0.2s ease;
}

.slider-custom::-webkit-slider-thumb:hover {
  @apply bg-green-600 transform scale-110;
}

.slider-custom::-moz-range-thumb {
  @apply w-6 h-6 bg-green-500 rounded-full cursor-pointer border-0 shadow-lg;
  transition: all 0.2s ease;
}

.slider-custom::-moz-range-thumb:hover {
  @apply bg-green-600 transform scale-110;
}

</style>