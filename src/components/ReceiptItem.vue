<template>
  <div
    class="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
    @click="viewReceipt"
  >
    <div class="flex justify-between items-start mb-2">
      <div>
        <h3 class="font-semibold text-lg">{{ receipt.merchant || 'Unknown Merchant' }}</h3>
        <p class="text-sm text-gray-500">{{ formatDate(receipt.created_at) }}</p>
      </div>
      <div class="text-right">
        <div class="font-bold">{{ formatSats(receipt.totalAmount) }} sats</div>
        <div class="text-sm text-gray-500">{{ convertFromSats(receipt.totalAmount, receipt.btcPrice, receipt.currency) }}</div>
      </div>
    </div>

    <!-- Settlement Progress -->
    <div class="mt-3">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>Settlement Progress</span>
        <span>{{ receipt.settledAmount || 0 }} / {{ receipt.totalAmount }} sats</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div 
          class="bg-green-500 h-2 rounded-full transition-all duration-300"
          :style="{ width: getSettlementProgress(receipt) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Status Badge -->
    <div class="mt-2 flex justify-between items-center">
      <span 
        class="px-2 py-1 rounded-full text-xs font-medium"
        :class="getStatusClass(receipt)"
      >
        {{ getStatusText(receipt) }}
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
import { formatSats, convertFromSats } from '../utils/pricing';
import { formatDate } from '../utils/dateUtils';
import { KIND_SETTLEMENT, KIND_SETTLEMENT_CONFIRMATION } from '../services/nostr/constants';
import { DEFAULT_RELAYS, globalEventStore, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';

export default {
  name: 'ReceiptItem',
  props: {
    receiptEvent: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const router = useRouter();
    const settlementEvents = ref([]);
    const settlementConfirmationEvents = ref([]);

    // const settledAmount

    // Convert the tuple [event, parsedContent] to receipt format
    const receipt = computed(() => {
      const [eventData, parsedContent] = props.receiptEvent;
      
      // Calculate total from parsed items
      const totalAmount = parsedContent.items.reduce((sum, item) => sum + item.total, 0);
      
      return {
        id: eventData.id,
        eventId: eventData.id,
        merchant: 'Unknown Merchant', // No merchant in simplified model
        created_at: eventData.created_at,
        totalAmount,
        currency: parsedContent.currency,
        btcPrice: 0, // Will be fetched separately if needed
        itemCount: parsedContent.items.length,
        settledAmount: 0, // Will be calculated separately if needed
        decryptionKey: '', // Not needed in this context
        status: 'pending'
      };
    });

    const viewReceipt = () => {
      // Navigate to the receipt view
      router.push(`/?receipt=${receipt.value.id}&key=${receipt.value.decryptionKey}`);
    };

    const getSettlementProgress = (receipt) => {
      if (!receipt.totalAmount) return 0;
      return Math.round((receipt.settledAmount || 0) / receipt.totalAmount * 100);
    };

    const getStatusClass = (receipt) => {
      const progress = getSettlementProgress(receipt);
      if (progress === 100) return 'bg-green-100 text-green-800';
      if (progress > 0) return 'bg-yellow-100 text-yellow-800';
      return 'bg-gray-100 text-gray-800';
    };

    const getStatusText = (receipt) => {
      const progress = getSettlementProgress(receipt);
      if (progress === 100) return 'Fully Settled';
      if (progress > 0) return 'Partially Settled';
      return 'Pending Settlement';
    };


    const loadSettlements = async () => {
      try {

        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT],
            "#e": [props.receiptEvent.id],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe((event) => {
            console.log("settlement event", event);
            settlementEvents.value.push(event);
          })

        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: [props.receiptEvent.pubkey],
            "#e": [props.receiptEvent.id],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe((event) => {
            console.log("confirmation event", event);
            settlementConfirmationEvents.value.push(event);
          })


        // // Get NDK instance
        // const ndk = await nostrService.getNdk();
        
        // // Get the receipt author's public key from the receipt event
        // const receiptAuthorPubkey = receiptEvent.authorPubkey;
        // if (!receiptAuthorPubkey) {
        //   console.warn('No author pubkey found in receipt event');
        //   return 0;
        // }
        
        // // Query for confirmation events (kind 9569) for this receipt
        // const confirmationEvents = await ndk.fetchEvents({
        //   kinds: [9569],
        //   authors: [receiptAuthorPubkey],
        //   '#e': [receiptEventId],
        //   limit: 100
        // });
        
        // console.log(`Found ${confirmationEvents.size} confirmations for receipt ${receiptEventId}`);
        
        // // For each confirmation, get the settlement event it references
        // let totalSettledAmount = 0;
        // const processedSettlements = new Set();
        
        // for (const confirmationEvent of confirmationEvents) {
        //   const eTags = confirmationEvent.tags.filter(tag => tag[0] === 'e');
        //   if (eTags.length >= 2) {
        //     const settlementEventId = eTags[1][1]; // Second 'e' tag is the settlement event ID
            
        //     // Skip if we've already processed this settlement
        //     if (processedSettlements.has(settlementEventId)) {
        //       continue;
        //     }
        //     processedSettlements.add(settlementEventId);
            
        //     try {
        //       // Fetch the settlement event to get the settled items
        //       const settlementEvent = await ndk.fetchEvent(settlementEventId);
        //       if (settlementEvent) {
        //         // We need the receipt encryption key to decrypt the settlement
        //         const encryptionKey = receiptKeyManager.getEncryptionKey(receiptEventId);
        //         if (encryptionKey) {
        //           const decryptionKey = Uint8Array.from(Buffer.from(encryptionKey, 'hex'));
        //           const { nip44 } = await import('nostr-tools');
                  
        //           const decryptedContent = await nip44.decrypt(settlementEvent.content, decryptionKey);
        //           const { settledItems } = JSON.parse(decryptedContent);
                  
        //           // Calculate the total amount for this settlement
        //           const settlementAmount = settledItems.reduce((sum, item) => {
        //             const quantity = item.selectedQuantity || item.quantity || 0;
        //             const price = item.price || 0;
        //             return sum + (quantity * price);
        //           }, 0);
                  
        //           totalSettledAmount += settlementAmount;
        //           console.log(`Added ${settlementAmount} sats from settlement ${settlementEventId}`);
        //         }
        //       }
        //     } catch (error) {
        //       console.error('Error processing settlement event:', error);
        //     }
        //   }
        // }
        
        // return totalSettledAmount;
        
      } catch (error) {
        console.error('Error calculating settled amount:', error);
        return 0;
      }
    };


    onMounted(() => {
      loadSettlements();
    });

    return {
      receipt,
      viewReceipt,
      formatDate,
      formatSats,
      convertFromSats,
      getSettlementProgress,
      getStatusClass,
      getStatusText
    };
  }
};
</script>
