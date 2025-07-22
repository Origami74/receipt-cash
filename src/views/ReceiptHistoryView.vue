<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm p-4">
      <div class="flex items-center justify-between">
        <button @click="goBack" class="btn flex items-center text-gray-700 hover:text-gray-900">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <h1 class="text-xl font-bold">Receipt History</h1>
        <div class="w-16"></div> <!-- Spacer for center alignment -->
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-xl font-bold mb-2">Loading Receipts...</div>
        <div class="text-gray-500">Please wait</div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center p-4">
        <div class="text-xl font-bold mb-2 text-red-500">Error</div>
        <div class="text-gray-700 mb-4">{{ error }}</div>
        <button @click="loadReceipts" class="btn-primary">Try Again</button>
      </div>
    </div>

    <!-- Receipts List -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <div v-if="receiptEvents.length === 0" class="text-center py-8">
        <div class="text-gray-500 text-lg">No receipts found</div>
        <div class="text-gray-400 text-sm mt-2">Published receipts will appear here</div>
      </div>
      
      <div v-else class="space-y-4">
        <!-- Display receipt events using the new component -->
        <ReceiptItem
          v-for="[receiptEvent, parsedContent, contentDecryptionKey] in receiptEvents"
          :key="receiptEvent.id"
          :receiptEvent="[receiptEvent, parsedContent, contentDecryptionKey]"
        />
        
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import receiptKeyManager from '../services/keyManagementService.js';
import nostrService from '../services/flows/shared/nostr.js';
import { Buffer } from 'buffer';
import { SimpleSigner } from 'applesauce-signers';
import { DEFAULT_RELAYS, globalEventStore, globalPool } from '../services/nostr/applesauce';
import { onlyEvents } from 'applesauce-relay';
import { mapEventsToStore } from 'applesauce-core';
import ReceiptItem from '../components/ReceiptItem.vue';
import { safeParseReceiptContent } from '../parsing/receiptparser.js';
import { nip44 } from 'nostr-tools';

export default {
  name: 'ReceiptHistoryView',
  components: {
    ReceiptItem
  },
  setup() {
    const router = useRouter();
    const loading = ref(true);
    const error = ref(null);
    const receiptEvents = ref([]);

    const goBack = () => {
      router.push('/');
    };

    const receiptIdentities = [];

    const handleReceiptEvent = async (receiptEvent) => {
      console.log("receiptEvent", receiptEvent);
      
      try {
        // Find the matching signer for this event's author
        let matchingIdentity = null;
        for (const identity of receiptIdentities) {
          const signerPubkey = await identity.receiptSigner.getPublicKey();
          if (signerPubkey === receiptEvent.pubkey) {
            matchingIdentity = identity;
            break;
          }
        }
        
        if (!matchingIdentity) {
          console.warn("No matching identity found for event author:", receiptEvent.pubkey);
          return;
        }
        
        // Get the encryption private key as Uint8Array
        const contentDecryptionKey = Uint8Array.from(Buffer.from(matchingIdentity.contentSigner.key));
        
        // Decrypt using symmetric approach (not two-party)
        //  TODO: remove dpeendency on nostr tools and do this with AppleSauce (Threw invalid MAC eerors)
        const decryptedContent = await nip44.decrypt(receiptEvent.content, contentDecryptionKey);
        
        console.log("Decrypted content:", decryptedContent);
        
        // Validate and parse the decrypted receipt content
        const parsedContent = safeParseReceiptContent(decryptedContent);
        
        if (parsedContent) {
          // Save as tuple: [event, parsedContent, contentDecryptionKey]
          receiptEvents.value.push([receiptEvent, parsedContent, contentDecryptionKey]);
        } else {
          console.warn("Invalid receipt content after decryption, skipping event:", receiptEvent.id);
        }
        
      } catch (error) {
        console.error("Error processing event:", error, "Event ID:", receiptEvent.id);
      }
    };

    const loadReceipts = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        // Get all stored receipt keys
        const allKeys = receiptKeyManager.getAllReceiptKeys();

        // Create a list with signers and encryption keys for each entry
        for (const [eventId, keyData] of allKeys) {
          try {
            // Convert private key hex to Uint8Array for SimpleSigner
            const privateKeyBytes = Uint8Array.from(Buffer.from(keyData.receiptPrivateKey, 'hex'));
            const receiptSigner = new SimpleSigner(privateKeyBytes);

            const contentPrivateKeyBytes = Uint8Array.from(Buffer.from(keyData.encryptionPrivateKey, 'hex'));
            const contentSigner = new SimpleSigner(contentPrivateKeyBytes);
            
            receiptIdentities.push({
              eventId,
              receiptSigner: receiptSigner,
              contentSigner: contentSigner
            });
          } catch (error) {
            console.error(`Error processing keys for event ${eventId}:`, error);
            // Continue with other keys even if one fails
          }
        }
        
        console.log('receiptIdentities:', receiptIdentities);


        // Get all receipt pubkeys for subscription
        const receiptPubkeys = await Promise.all(receiptIdentities.flatMap(async id => await id.receiptSigner.getPublicKey()))

        console.log(receiptPubkeys)

        globalPool
          .subscription(DEFAULT_RELAYS, {
            kinds: [9567],
            authors: receiptPubkeys,
          })
          .pipe(onlyEvents(), mapEventsToStore(globalEventStore))
          .subscribe(handleReceiptEvent);
        
      } catch (err) {
        console.error('Error loading receipts:', err);
        error.value = 'Failed to load receipts. Please try again.';
      } finally {
        loading.value = false;
      }
    };


    onMounted(() => {
      loadReceipts();
    });

    return {
      loading,
      error,
      receiptEvents,
      goBack,
      loadReceipts
    };
  }
};
</script>

<style scoped>
.btn {
  @apply px-3 py-1 rounded transition-colors;
}

.btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}
</style>