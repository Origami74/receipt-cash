<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Payout Address Tip (first time on payment request step) -->
    <ContextualTip
      :show="showPayoutTip"
      tip-name="PayoutTip"
      image="/onboard/screen-6-payment-address.png"
      title="Where to Send Money"
      description="Enter your Lightning address or Cashu payment request to receive payments when friends pay their share."
      :bullets="['Lightning address (user@domain.com)', 'Or Cashu payment request', 'Funds sent automatically', 'You can change this later']"
      primary-button-text="Got it!"
      @dismiss="showPayoutTip = false"
    />
    
    <!-- Header with Back Button -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="$emit('back')" class="flex items-center text-blue-500 hover:text-blue-600">
          <span class="mr-1">←</span> Back
        </button>
        <h1 class="text-xl font-bold">Payment Setup</h1>
        <div class="text-sm text-gray-500">Step 2 of 2</div>
      </div>
    </div>
    
    <!-- Payment Setup Form (scrollable) -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Receipt Summary -->
      <div class="bg-blue-50 rounded-lg p-4 mb-4">
        <div class="text-sm text-blue-800">
          <div class="font-medium mb-1">Receipt Summary</div>
          <div>{{ itemCount }} items • {{ formatPrice(totalForOthers) }}</div>
          <div class="text-xs text-blue-600 mt-0.5">{{ formatSats(convertToSats(totalForOthers)) }} sats</div>
          <div v-if="selectedItemsTotal > 0" class="text-xs text-blue-600 mt-1">
            (Your portion: {{ formatPrice(selectedItemsTotal) }} deducted)
          </div>
        </div>
      </div>
      
      <!-- Lightning/Cashu Address -->
      <div class="mb-4">
        <ReceiveAddressInput
          v-model="receiveAddress"
          label="Receive Address"
          placeholder="Lightning address (user@domain.com) or Cashu payment request"
          @validation-change="handleAddressValidation"
          @focus="handleAddressFocus"
        />
      </div>
      
      <!-- Developer Split -->
      <div class="mb-4">
        <DeveloperSplitSlider v-model="developerSplit" />
      </div>
      
      <!-- Breakdown -->
      <div class="bg-white rounded-lg p-4">
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span>Total to collect:</span>
            <div class="text-right">
              <div class="font-medium">{{ formatPrice(totalForOthers) }}</div>
              <div class="text-xs text-gray-500">{{ formatSats(convertToSats(totalForOthers)) }} sats</div>
            </div>
          </div>
          <div class="flex justify-between text-gray-600">
            <span>Developer fee ({{ developerSplit }}%):</span>
            <div class="text-right">
              <div>{{ formatPrice(devFee) }}</div>
              <div class="text-xs text-gray-500">{{ formatSats(convertToSats(devFee)) }} sats</div>
            </div>
          </div>
          <div class="flex justify-between text-lg font-bold border-t pt-2">
            <span>You receive:</span>
            <div class="text-right text-green-600">
              <div>{{ formatPrice(youReceive) }}</div>
              <div class="text-sm font-normal text-gray-500">{{ formatSats(convertToSats(youReceive)) }} sats</div>
            </div>
          </div>
          <div class="text-xs text-gray-500 mt-3 pt-2 border-t">
            Note: Amounts shown do not include network fees
          </div>
        </div>
      </div>
    </div>
    
    <!-- Create Button (sticky) -->
    <div class="bg-white border-t p-4">
      <button
        @click="handleCreate"
        :disabled="!isValid || isCreating"
        :class="[
          'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors',
          isValid && !isCreating
            ? 'bg-orange-500 hover:bg-orange-600 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
      >
        <svg
          v-if="isCreating"
          class="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span>{{ isCreating ? 'Creating...' : 'Create Receipt →' }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import ReceiveAddressInput from '../ReceiveAddressInput.vue';
import DeveloperSplitSlider from '../DeveloperSplitSlider.vue';
import ContextualTip from '../onboarding/ContextualTip.vue';
import btcPriceService from '../../services/btcPriceService';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatSats, convertToSats as convertToSatsUtil } from '../../utils/pricingUtils';
import { saveReceiveAddress, getReceiveAddress } from '../../services/storageService';
import { showNotification } from '../../services/notificationService';
import { onboardingService } from '../../services/onboardingService';

export default {
  name: 'PaymentSetupForm',
  components: {
    ReceiveAddressInput,
    DeveloperSplitSlider,
    ContextualTip
  },
  props: {
    receiptData: {
      type: Object,
      required: true
    }
  },
  emits: ['back', 'create'],
  setup(props, { emit }) {
    const receiveAddress = ref('');
    const addressValid = ref(false);
    const addressError = ref('');
    const addressType = ref('');
    const addressVerifying = ref(false);
    const developerSplit = ref(2.1);
    const isCreating = ref(false);
    const currentBtcPrice = ref(0);
    const showPayoutTip = ref(false);
    
    const selectedCurrency = computed(() => props.receiptData.currency || 'EUR');
    
    const itemCount = computed(() => {
      return props.receiptData.items.filter(item => {
        const remainingQty = item.quantity - (item.selectedQuantity || 0);
        return remainingQty > 0;
      }).length;
    });
    
    const selectedItemsTotal = computed(() => {
      return props.receiptData.items
        .reduce((sum, item) => sum + (item.price * (item.selectedQuantity || 0)), 0);
    });
    
    const totalForOthers = computed(() => {
      const total = props.receiptData.items
        .reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return total - selectedItemsTotal.value;
    });
    
    const devFee = computed(() => {
      return totalForOthers.value * (developerSplit.value / 100);
    });
    
    const youReceive = computed(() => {
      return totalForOthers.value - devFee.value;
    });
    
    const isValid = computed(() => {
      return addressValid.value && 
             receiveAddress.value && 
             !addressVerifying.value &&
             itemCount.value > 0;
    });
    
    onMounted(async () => {
      // Try to load the last used receive address
      const lastReceiveAddress = getReceiveAddress();
      if (lastReceiveAddress) {
        receiveAddress.value = lastReceiveAddress;
      }
      
      // Fetch current BTC price
      try {
        currentBtcPrice.value = await btcPriceService.fetchBtcPrice(selectedCurrency.value);
      } catch (error) {
        console.error('Error fetching BTC price:', error);
      }
      
      // Show payout tip if first time
      if (onboardingService.hasSeenWelcome() && !onboardingService.hasSeen('PayoutTip')) {
        setTimeout(() => {
          showPayoutTip.value = true;
        }, 500);
      }
    });
    
    const formatPrice = (amount) => {
      return formatCurrency(amount, selectedCurrency.value);
    };
    
    const convertToSats = (amount) => {
      return convertToSatsUtil(amount, currentBtcPrice.value);
    };
    
    const handleAddressValidation = (validationResult) => {
      addressValid.value = validationResult.isValid;
      addressError.value = validationResult.error;
      addressType.value = validationResult.type;
      addressVerifying.value = validationResult.isVerifying || false;
    };
    
    const handleAddressFocus = () => {
      if (onboardingService.hasSeenWelcome() && !onboardingService.hasSeen('PayoutTip')) {
        showPayoutTip.value = true;
      }
    };
    
    const handleCreate = async () => {
      if (!receiveAddress.value) {
        showNotification('Please enter a receive address', 'error');
        return;
      }
      
      if (addressVerifying.value) {
        showNotification('Please wait for address verification to complete', 'warning');
        return;
      }
      
      if (!addressValid.value) {
        showNotification('Please enter a valid receive address', 'error');
        return;
      }
      
      if (isCreating.value) {
        return; // Prevent multiple clicks
      }
      
      try {
        isCreating.value = true;
        
        // Save the receive address for future use
        saveReceiveAddress(receiveAddress.value);
        
        // Emit create event with payment setup data
        emit('create', {
          receiveAddress: receiveAddress.value,
          addressType: addressType.value,
          developerSplit: developerSplit.value
        });
      } catch (error) {
        console.error('Error in handleCreate:', error);
        showNotification('Failed to create receipt', 'error');
        isCreating.value = false;
      }
    };
    
    return {
      receiveAddress,
      addressValid,
      addressError,
      addressType,
      addressVerifying,
      developerSplit,
      isCreating,
      showPayoutTip,
      itemCount,
      selectedItemsTotal,
      totalForOthers,
      devFee,
      youReceive,
      isValid,
      formatPrice,
      formatSats,
      convertToSats,
      handleAddressValidation,
      handleAddressFocus,
      handleCreate
    };
  }
};
</script>