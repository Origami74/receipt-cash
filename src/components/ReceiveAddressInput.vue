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
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import addressValidation, { AddressType, verifyLightningAddress } from '../utils/receiveAddressValidationUtils';
import { saveReceiveAddress, getReceiveAddress } from '../services/storageService';

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
    },
    skipInitialVerification: {
      type: Boolean,
      default: true
    },
    autoSave: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue', 'validation-change'],
  setup(props, { emit }) {
    const validationResult = ref({ isValid: true, type: '', error: '' });
    const isVerifying = ref(false);
    const isInitialLoad = ref(true);
    const lastValidatedValue = ref('');
    let verificationTimeout = null;
    
    // Load saved address on mount - always from storage
    onMounted(() => {
      const savedAddress = getReceiveAddress();
      if (savedAddress && savedAddress !== props.modelValue) {
        emit('update:modelValue', savedAddress);
        console.log('📥 Loaded saved receive address:', savedAddress);
        // Trigger validation for the loaded address
        validateAddress(savedAddress);
      }
    });
    
    const validateAddress = async (address) => {
      // Update last validated value
      lastValidatedValue.value = address;
      
      // Clear any pending verification
      if (verificationTimeout) {
        clearTimeout(verificationTimeout);
        verificationTimeout = null;
      }
      
      if (!address || address.trim() === '') {
        validationResult.value = { isValid: true, type: '', error: '', isVerifying: false };
        isVerifying.value = false;
        
        // Don't clear saved address when input is empty - user might be temporarily clearing it
        // They can explicitly clear it by entering and saving an empty value if needed
        
        emit('validation-change', validationResult.value);
        return;
      }
      
      // First do format validation
      const formatValidation = addressValidation.validateReceiveAddress(address);
      validationResult.value = { ...formatValidation, isVerifying: false };
      
      // If it's a Lightning address and format is valid, verify it actually works
      if (formatValidation.isValid && formatValidation.type === AddressType.LIGHTNING) {
        // Set verifying state but don't emit yet
        isVerifying.value = true;
        validationResult.value = { ...formatValidation, isVerifying: true };
        emit('validation-change', validationResult.value);
        
        // Debounce verification to avoid too many requests while typing
        verificationTimeout = setTimeout(async () => {
          try {
            const verificationResult = await verifyLightningAddress(address);
            
            if (!verificationResult.isValid) {
              validationResult.value = {
                isValid: false,
                type: AddressType.LIGHTNING,
                error: verificationResult.error,
                isVerifying: false
              };
            } else {
              validationResult.value = {
                isValid: true,
                type: AddressType.LIGHTNING,
                isVerifying: false
              };
            }
            
            // Auto-save if enabled and validation successful
            if (props.autoSave && validationResult.value.isValid && address && address.trim() !== '') {
              saveReceiveAddress(address);
              console.log('✅ Receive address auto-saved:', address);
            }
            
            // Emit final validation result after network verification
            emit('validation-change', validationResult.value);
          } catch (error) {
            console.error('Lightning address verification error:', error);
            // Don't fail validation on network errors, just warn
            validationResult.value = {
              isValid: true,
              type: AddressType.LIGHTNING,
              warning: 'Could not verify Lightning address (network error)',
              isVerifying: false
            };
            emit('validation-change', validationResult.value);
          } finally {
            isVerifying.value = false;
          }
        }, 1000); // Wait 1 second after user stops typing
      } else {
        // For non-Lightning addresses, auto-save if enabled and valid
        if (props.autoSave && validationResult.value.isValid && address && address.trim() !== '') {
          saveReceiveAddress(address);
          console.log('✅ Receive address auto-saved:', address);
        }
        
        // Emit immediately after format validation
        emit('validation-change', validationResult.value);
      }
    };
    
    // Validate address whenever modelValue changes
    watch(() => props.modelValue, (newValue) => {
      validateAddress(newValue);
    }, { immediate: true });
    
    const handleInput = (event) => {
      emit('update:modelValue', event.target.value);
    };
    
    const handleChange = (event) => {
      // Only validate if value actually changed (avoid re-validation on blur)
      if (event.target.value !== lastValidatedValue.value) {
        lastValidatedValue.value = event.target.value;
        validateAddress(event.target.value);
      }
    };
    
    // Computed properties for styling
    const statusEmoji = computed(() => {
      if (!props.modelValue || props.modelValue.trim() === '') {
        return '⚠️';
      }
      
      if (isVerifying.value) {
        return '🔄';
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
      
      if (isVerifying.value) {
        return 'Verifying Lightning address...';
      }
      
      if (!validationResult.value.isValid) {
        return validationResult.value.error;
      }
      
      if (validationResult.value.warning) {
        return validationResult.value.warning;
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'Lightning Address - Verified and ready to receive payments';
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
      
      if (isVerifying.value) {
        return 'text-blue-500';
      }
      
      if (!validationResult.value.isValid) {
        return 'text-red-500';
      }
      
      if (validationResult.value.warning) {
        return 'text-yellow-600';
      }
      
      switch (validationResult.value.type) {
        case AddressType.LIGHTNING:
          return 'text-green-600';
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