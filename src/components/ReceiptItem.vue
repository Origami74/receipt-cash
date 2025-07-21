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
        <div class="text-sm text-gray-500">🔒 {{ convertFromSats(receipt.totalAmount, receipt.btcPrice, receipt.currency) }}</div>
      </div>
    </div>

    <!-- Settlement Progress -->
    <div class="mt-3">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>Settlement Progress</span>
        <span>
          <span class="text-green-600 font-medium">{{ receipt.confirmedSettledAmount || 0 }}</span> /
          <span class="text-yellow-600 font-medium">{{ receipt.settledAmount || 0 }}</span> /
          <span class="text-gray-600">{{ receipt.totalAmount }}</span> sats
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2 relative">
        <!-- Total settled amount (orange/yellow background) -->
        <div
          class="bg-yellow-500 h-2 rounded-full transition-all duration-300 absolute"
          :style="{ width: getSettlementProgress(receipt) + '%' }"
        ></div>
        <!-- Confirmed settled amount (green overlay) -->
        <div
          class="bg-green-500 h-2 rounded-full transition-all duration-300 absolute"
          :style="{ width: Math.round((receipt.confirmedSettledAmount || 0) / receipt.totalAmount * 100) + '%' }"
        ></div>
      </div>
      <div class="flex justify-between text-xs text-gray-500 mt-1">
        <span>Confirmed: {{ Math.round((receipt.confirmedSettledAmount || 0) / receipt.totalAmount * 100) }}%</span>
        <span>Total Settled: {{ getSettlementProgress(receipt) }}%</span>
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
import { safeParseSettlementContent } from '../parsing/settlementparser.js';
import { Buffer } from 'buffer';
import { nip44 } from 'nostr-tools'


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

    // Convert the tuple [event, parsedContent, contentDecryptionKey] to receipt format
    const [receiptEvent, parsedContent, contentDecryptionKey] = props.receiptEvent;

    // Calculate total settled amount from all settlement events
    const totalSettledAmount = computed(() => {
      return settlementEvents.value.reduce((total, [settlementEvent, parsedSettlement]) => {
        const settlementTotal = parsedSettlement.settledItems.reduce((sum, item) => sum + item.total, 0);
        return total + settlementTotal;
      }, 0);
    });

    // Calculate confirmed settled amount (settlements that have been confirmed)
    const confirmedSettledAmount = computed(() => {
      // Get settlement IDs that have been confirmed
      const confirmedSettlementIds = new Set(
        settlementConfirmationEvents.value.map(event => {
          // Find the settlement event ID from the confirmation event tags
          const eTags = event.tags.filter(tag => tag[0] === 'e');
          // The second 'e' tag should be the settlement event ID
          return eTags.length >= 2 ? eTags[1][1] : null;
        }).filter(Boolean)
      );

      // Sum up only the confirmed settlements
      return settlementEvents.value.reduce((total, [settlementEvent, parsedSettlement]) => {
        if (confirmedSettlementIds.has(settlementEvent.id)) {
          const settlementTotal = parsedSettlement.settledItems.reduce((sum, item) => sum + item.total, 0);
          return total + settlementTotal;
        }
        return total;
      }, 0);
    });

    const receipt = computed(() => {
      
      // Calculate total from parsed items
      const totalAmount = parsedContent.items.reduce((sum, item) => sum + item.total, 0);
      
      console.log("ggggggg", parsedContent)

      return {
        id: receiptEvent.id,
        eventId: receiptEvent.id,
        merchant: 'Unknown Merchant', // No merchant in simplified model
        created_at: receiptEvent.created_at,
        totalAmount,
        currency: parsedContent.currency,
        btcPrice: parsedContent.btcPrice,
        itemCount: parsedContent.items.length,
        settledAmount: totalSettledAmount.value,
        confirmedSettledAmount: confirmedSettledAmount.value,
        status: 'pending'
      };
    });

    const viewReceipt = () => {
      // Convert Uint8Array to hex string for URL
      const keyHex = Buffer.from(contentDecryptionKey).toString('hex');
      // Navigate to the receipt view
      router.push(`/?receipt=${receipt.value.id}&key=${keyHex}`);
    };

    const getSettlementProgress = (receipt) => {
      if (!receipt.totalAmount) return 0;
      return Math.round((receipt.settledAmount || 0) / receipt.totalAmount * 100);
    };

    const getStatusClass = (receipt) => {
      const confirmedProgress = Math.round((receipt.confirmedSettledAmount || 0) / receipt.totalAmount * 100);
      const totalProgress = getSettlementProgress(receipt);
      
      if (confirmedProgress === 100) return 'bg-green-100 text-green-800';  // Fully confirmed
      if (confirmedProgress > 0) return 'bg-green-100 text-green-800';      // Partially confirmed (green)
      if (totalProgress > 0) return 'bg-yellow-100 text-yellow-800';        // Settled but unconfirmed (orange)
      return 'bg-gray-100 text-gray-800';                                   // Pending
    };

    const getStatusText = (receipt) => {
      const confirmedProgress = Math.round((receipt.confirmedSettledAmount || 0) / receipt.totalAmount * 100);
      const totalProgress = getSettlementProgress(receipt);
      
      if (confirmedProgress === 100) return 'Fully Confirmed';
      if (confirmedProgress > 0) return 'Partially Confirmed';
      if (totalProgress > 0) return 'Settled (Unconfirmed)';
      return 'Pending Settlement';
    };


    const handleSettlementEvent = async (settlementEvent) => {
      console.log("settlement event", settlementEvent);
      
      try {
        // Decrypt the content using the same encryption key as the receipt
        const decryptedContent = await nip44.decrypt(settlementEvent.content, contentDecryptionKey);
        
        // Validate and parse the decrypted settlement content
        const parsedSettlement = safeParseSettlementContent(decryptedContent);
        
        if (parsedSettlement) {
          // Save as tuple: [settlementEvent, parsedSettlement]
          settlementEvents.value.push([settlementEvent, parsedSettlement]);
        } else {
          console.warn("Invalid settlement content after decryption, skipping event:", settlementEvent.id);
        }
        
      } catch (error) {
        console.error("Error processing settlement event:", error, "Settlement Event ID:", settlementEvent.id);
      }
    };

    const loadSettlements = async () => {
      try {

        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT],
            "#e": [receiptEvent.id],
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe(handleSettlementEvent)

        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [KIND_SETTLEMENT_CONFIRMATION],
            authors: [receiptEvent.pubkey],
            "#e": [receiptEvent.id],
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
