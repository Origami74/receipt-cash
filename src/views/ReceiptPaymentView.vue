<template>
  <div class="h-full">
    <PaymentSetupForm
      v-if="receiptData"
      :receipt-data="receiptData"
      @back="handleBack"
      @create="handleCreate"
    />
    <div v-else class="h-full flex items-center justify-center">
      <div class="text-center text-gray-500">
        <p>No receipt data found</p>
        <button
          @click="$router.push('/create/review')"
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Review
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import PaymentSetupForm from '../components/receipt/PaymentSetupForm.vue';
import { getReceiptDraft, clearReceiptDraft } from '../services/receiptDraftService';
import nostrService from '../services/flows/shared/nostr';
import cashuService from '../services/flows/shared/cashuService';
import { extractPreferredMints } from '../utils/cashuUtils';
import btcPriceService from '../services/btcPriceService';
import receiptKeyManager from '../services/keyManagementService';
import { showNotification } from '../services/notificationService';
import { ownedReceiptsStorageManager } from '../services/new/storage/ownedReceiptsStorageManager';
import { Buffer } from 'buffer';

export default {
  name: 'ReceiptPaymentView',
  components: {
    PaymentSetupForm
  },
  setup() {
    const router = useRouter();
    const receiptData = ref(null);

    onMounted(() => {
      // Load receipt data from draft
      receiptData.value = getReceiptDraft();
      
      if (!receiptData.value) {
        // No draft found, redirect to review page
        router.push('/create/review');
      }
    });

    const handleBack = () => {
      // Navigate back to review page (draft is preserved)
      router.push('/create/review');
    };

    const handleCreate = async (paymentSetup) => {
      try {
        // Clean up items data for publishing
        // Reduce quantities by what the creator selected
        const cleanedItems = receiptData.value.items
          .map(item => {
            const remainingQuantity = item.quantity - (item.selectedQuantity || 0);
            return {
              name: item.name,
              quantity: remainingQuantity,
              price: item.price,
              total: item.price * remainingQuantity,
              title: item.merchant
            };
          })
          .filter(item => item.quantity > 0); // Only include items with remaining quantity
        
        if (cleanedItems.length === 0) {
          showNotification('No items remaining to share. You selected all items!', 'error');
          return;
        }
        
        const receiptWithDevSplit = {
          ...receiptData.value,
          items: cleanedItems,
          currency: receiptData.value.currency,
          total_amount: cleanedItems.reduce((sum, item) => sum + item.total, 0),
          splitPercentage: parseFloat(paymentSetup.developerSplit)
        };
        
        const btcPrice = await btcPriceService.fetchBtcPrice(receiptData.value.currency);
        
        // Extract preferred mints from payment request if it's a Cashu request
        const preferredMints = (paymentSetup.addressType === 'cashu' && paymentSetup.receiveAddress)
          ? extractPreferredMints(paymentSetup.receiveAddress)
          : [];
        
        const publishedReceiptEvent = await nostrService.publishReceiptEvent(
          receiptWithDevSplit,
          preferredMints,
          parseFloat(paymentSetup.developerSplit),
          btcPrice
        );
        
        const receiptPrivateKey = new Uint8Array(Buffer.from(publishedReceiptEvent.receiptPrivateKey, 'hex'));
        receiptKeyManager.storeReceiptKey(
          publishedReceiptEvent.id,
          receiptPrivateKey,
          publishedReceiptEvent.encryptionPrivateKey
        );

        ownedReceiptsStorageManager.addReceipt({
          privateKey: publishedReceiptEvent.receiptPrivateKey,
          pubkey: publishedReceiptEvent.pubkey,
          eventId: publishedReceiptEvent.id,
          sharedEncryptionKey: publishedReceiptEvent.encryptionPrivateKey
        });
        
        console.log('Started payer monitoring for receipt:', publishedReceiptEvent.id);
        
        // Clear the draft
        clearReceiptDraft();
        
        // Navigate to the receipt view to show the QR
        router.push({
          name: 'ReceiptView',
          params: {
            eventId: publishedReceiptEvent.id,
            decryptionKey: publishedReceiptEvent.encryptionPrivateKey
          },
          query: {
            showQR: 'true'
          }
        });
      } catch (error) {
        console.error('Error creating receipt:', error);
        showNotification('Failed to create receipt', 'error');
      }
    };

    return {
      receiptData,
      handleBack,
      handleCreate
    };
  }
};
</script>