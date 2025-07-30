<template>
  <div class="space-y-2">
    <label v-if="label" :for="inputId" class="block text-sm font-medium text-gray-700">
      {{ label }}
    </label>
    
    <div class="relative">
      <!-- Input field with emoji indicator -->
      <div class="relative flex">
        <!-- Emoji indicator -->
        <div 
          :class="[
            'flex items-center justify-center w-10 h-10 rounded-l-md border-l border-t border-b text-lg transition-colors duration-200',
            borderColorClass,
            backgroundColorClass
          ]"
        >
          {{ statusEmoji }}
        </div>
        
        <!-- Input field -->
        <input
          :id="inputId"
          :value="modelValue"
          type="text"
          :class="[
            'flex-1 px-3 py-2 border-t border-r border-b rounded-r-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-colors duration-200',
            borderColorClass,
            focusRingClass
          ]"
          :placeholder="placeholder"
          @input="handleInput"
          @change="handleChange"
        />
      </div>
    </div>
    
    <!-- Status message -->
    <div class="min-h-[1.25rem]">
      <p v-if="statusMessage" :class="statusMessageClass" class="text-xs">
        {{ statusMessage }}
      </p>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue';
import addressValidation, { AddressType } from '../utils/receiveAddressValidationUtils';

export default {
  name: 'ReceiveAddressInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    },
    inputId: {
      type: String,
      default: 'receive-address'
    }
  },
  emits: ['update:modelValue', 'validation-change'],
  setup(props, { emit }) {
    const validationResult = ref({ isValid: true, type: '', error: '' });
    
    const validateAddress = (address) => {
      if (!address || address.trim() === '') {
        validationResult.value = { isValid: true, type: '', error: '' };
      } else {
        validationResult.value = addressValidation.validateReceiveAddress(address);
      }
      
      // Emit validation result for parent component
      emit('validation-change', validationResult.value);
    };
    
    // Validate address whenever modelValue changes
    watch(() => props.modelValue, (newValue) => {
      validateAddress(newValue);
    }, { immediate: true });
    
    const handleInput = (event) => {
      emit('update:modelValue', event.target.value);
    };
    
    const handleChange = (event) => {
      validateAddress(event.target.value);
    };
    
    // Computed properties for styling
    const statusEmoji = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return '⚠️';
      }
      
      if (!validationResult.value.isValid) {
        return '❌';
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return '⚡️';
        case AddressType.CASHU:
          return '🥜';
        default:
          return '⚠️';
      }
    });
    
    const borderColorClass = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return 'border-orange-300'; // Warning orange
      }
      
      if (!validationResult.value.isValid) {
        return 'border-red-300'; // Error red
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'border-orange-500'; // Bitcoin orange
        case AddressType.CASHU:
          return 'border-purple-500'; // Nostr purple
        default:
          return 'border-orange-300'; // Warning orange
      }
    });
    
    const backgroundColorClass = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return 'bg-orange-50'; // Warning orange background
      }
      
      if (!validationResult.value.isValid) {
        return 'bg-red-50'; // Error red background
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'bg-orange-50'; // Bitcoin orange background
        case AddressType.CASHU:
          return 'bg-purple-50'; // Nostr purple background
        default:
          return 'bg-orange-50'; // Warning orange background
      }
    });
    
    const focusRingClass = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return 'focus:ring-orange-500'; // Warning orange ring
      }
      
      if (!validationResult.value.isValid) {
        return 'focus:ring-red-500'; // Error red ring
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'focus:ring-orange-500'; // Bitcoin orange ring
        case AddressType.CASHU:
          return 'focus:ring-purple-500'; // Nostr purple ring
        default:
          return 'focus:ring-orange-500'; // Warning orange ring
      }
    });
    
    const statusMessage = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return 'Enter Lightning address (user@domain.com) or Cashu payment request';
      }
      
      if (!validationResult.value.isValid) {
        return validationResult.value.error;
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'Lightning Address - Used for receiving Lightning payments';
        case AddressType.CASHU:
          return 'Cashu Payment Request - Used for receiving Cashu payments';
        default:
          return '';
      }
    });
    
    const statusMessageClass = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return 'text-gray-500';
      }
      
      if (!validationResult.value.isValid) {
        return 'text-red-500';
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'text-orange-600';
        case AddressType.CASHU:
          return 'text-purple-600';
        default:
          return 'text-gray-500';
      }
    });
    
    return {
      handleInput,
      handleChange,
      statusEmoji,
      borderColorClass,
      backgroundColorClass,
      focusRingClass,
      statusMessage,
      statusMessageClass,
      validationResult
    };
  }
};
</script>

<style scoped>
/* Component-specific styles go here */
</style>