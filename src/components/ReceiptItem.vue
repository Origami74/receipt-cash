<template>
  <div
    class="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
    @click="navigateToReceipt"
  >
    <div class="flex justify-between items-start mb-2">
      <div>
        <h3 class="font-semibold text-lg">{{ receipt.title || 'Untitled Receipt' }}</h3>
        <p class="text-sm text-gray-500">{{ formatDate(receipt.created_at) }}</p>
      </div>
      <div class="text-right">
        <div class="font-bold">{{ formatSats(receipt.totalAmount) }}</div>
        <div class="text-sm text-gray-500">🔒 {{ convertFromSats(receipt.totalAmount, receipt.btcPrice, receipt.currency) }}</div>
      </div>
    </div>

    <!-- Settlement Progress -->
    <div class="mt-3">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>Settlement Progress</span>
        <span>
          <span class="text-yellow-600 font-medium">{{  formatSats(receipt.collectedAmount) || 0 }}</span> /
          <span class="text-green-600 font-medium">{{  formatSats(receipt.distributedAmount) || 0 }}</span> /
          <span class="text-gray-600">{{  formatSats(receipt.totalAmount) }}</span>
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2 relative">
        <!-- Confirmed settled amount (orange/yellow background) -->
        <div
          class="bg-yellow-500 h-2 rounded-full transition-all duration-300 absolute"
          :style="{ width: collectedPercent + '%' }"
        ></div>
        <!-- Paid out amount (green overlay) -->
        <div
          class="bg-green-500 h-2 rounded-full transition-all duration-300 absolute"
          :style="{ width: distributedPercent + '%' }"
        ></div>
      </div>
      <div class="flex justify-between text-xs text-gray-500 mt-1">
        <span>Collected: {{ collectedPercent }}%</span>
        <span>Distributed: {{ distributedPercent }}%</span>
      </div>
    </div>

    <!-- Status Badge -->
    <div class="mt-2 flex justify-between items-center">
      <span
        class="px-2 py-1 rounded-full text-xs font-medium"
        :class="statusClass"
      >
        {{ statusText }}
      </span>
      <div class="text-xs text-gray-500">
        {{ receipt.itemCount || 0 }} items
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { formatSats, convertFromSats } from '../utils/pricingUtils.js';
import { formatDate } from '../utils/dateUtils';
import { fullReceiptModel } from '../services/nostr/receipt.js';
import { decryptAndParseReceipt } from '../utils/receiptUtils.js';
import { decryptAndParseSettlement } from '../utils/settlementUtils.js';
import { isSettlementFullyPaidOut } from '../composables/useSettlementPayoutStatus.ts';

export default {
  name: 'ReceiptItem',
  props: {
    receipt: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const router = useRouter();
    const decryptedContent = ref();
    const receiptEvent = ref();
    const confirmedSettlements = ref([]);

    const {privateKey: receiptPrivateKey, pubkey: receiptPubkey, eventId: receiptEventId, sharedEncryptionKey} = props.receipt;

    // Calculate collected amount (settlements that have been confirmed)
    const collectedAmount = computed(() => {
      return confirmedSettlements.value.reduce((total, settlement) => {
        return total + (settlement.total || 0);
      }, 0);
    });

    // Calculate distributed amount (settlements that are fully paid out)
    // Uses accounting service instead of nostr-based fullyPaidOut flag
    const distributedAmount = computed(() => {
      // Get the actual receipt event ID from the loaded receipt data
      const actualReceiptEventId = receiptEvent.value?.id || receiptEventId;
      
      const distributed = confirmedSettlements.value
        .filter(settlement => {
          // Use accounting service to check if settlement is fully paid out
          const settlementEventId = settlement.event?.id || settlement.id;
          if (!settlementEventId || !actualReceiptEventId) return false;
          return isSettlementFullyPaidOut(actualReceiptEventId, settlementEventId);
        })
        .reduce((total, settlement) => {
          return total + (settlement.total || 0);
        }, 0);
      
      return distributed;
    });

    const receipt = computed(() => {
      
      // Calculate total from parsed items
      const totalAmount = decryptedContent.value?.items?.reduce((sum, item) => sum + (item.total || item.quantity * item.price || 0), 0) || 0;

      return {
        id: receiptEvent.value?.id,
        eventId: receiptEvent.value?.id,
        title: decryptedContent.value?.title,
        created_at: receiptEvent.value?.created_at,
        totalAmount,
        currency: decryptedContent.value?.currency,
        btcPrice: decryptedContent.value?.btcPrice,
        itemCount: decryptedContent.value?.items?.length || 0,
        distributedAmount: distributedAmount.value,
        collectedAmount: collectedAmount.value,
      };
    });

    const navigateToReceipt = () => {
      // Navigate to the receipt view
      router.push(`/receipt/${receiptEventId}/${sharedEncryptionKey}`);
    };

    const statusClass = computed(() => {
      const collectedProgress = collectedPercent.value;
      const distributedProgress = distributedPercent.value;
      
      if (distributedProgress === 100) return 'bg-green-100 text-green-800';  // Fully distributed
      if (distributedProgress > 0) return 'bg-green-100 text-green-800';      // Partially distributed
      if (collectedProgress === 100) return 'bg-yellow-100 text-yellow-800'; // Fully collected
      if (collectedProgress > 0) return 'bg-yellow-100 text-yellow-800';      // Partially collected
      return 'bg-gray-100 text-gray-800';                                   // Pending
    });

    const statusText = computed(() => {
      const collectedProgress = collectedPercent.value;
      const distributedProgress = distributedPercent.value;
      
      if (distributedProgress === 100) return 'Fully Distributed';
      if (distributedProgress > 0) return 'Partially Distributed';
      if (collectedProgress === 100) return 'Fully Collected';
      if (collectedProgress > 0) return 'Partially Collected';
      return 'Pending Collection';
    });

    const collectedPercent = computed(() => {
      if (!receipt.value.totalAmount) return 0;
      const percent = Math.round((receipt.value.collectedAmount || 0) / receipt.value.totalAmount * 100);
      return Math.min(percent, 100); // Cap at 100%
    });

    const distributedPercent = computed(() => {
      if (!receipt.value.totalAmount) return 0;
      const distributedAmt = receipt.value.distributedAmount || 0;
      if (distributedAmt === 0) return 0;
      
      // Calculate percentage - use Math.ceil to show at least 1% if there's any distributed amount
      const percent = Math.ceil((distributedAmt / receipt.value.totalAmount) * 100);
      return Math.min(percent, 100); // Cap at 100%
    });

    onMounted(() => {
      fullReceiptModel(receiptEventId, sharedEncryptionKey)
      .subscribe(fullReceipt => {
        receiptEvent.value = fullReceipt.receiptModel.event
        decryptedContent.value = decryptAndParseReceipt(fullReceipt.receiptModel.event, sharedEncryptionKey)
        
        // Use confirmed settlements from fullReceiptModel
        confirmedSettlements.value = fullReceipt.confirmedSettlements || [];
      })
    });

    return {
      receipt,
      navigateToReceipt,
      formatDate,
      formatSats,
      convertFromSats,
      statusClass,
      statusText,
      collectedPercent,
      distributedPercent
    };
  }
};
</script>
