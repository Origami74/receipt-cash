<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="flex items-center justify-between p-4">
        <button
          @click="goBack"
          class="text-gray-600 hover:text-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-lg font-semibold">Advanced Debug & Recovery</h1>
        <div class="w-6"></div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-6">
      <!-- Database Export/Import Section -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          Database Backup
        </h2>
        <p class="text-sm text-gray-600 mb-4">
          Export all app data to a file for backup or debugging. Import to restore from a previous backup.
        </p>
        
        <div class="space-y-3">
          <button
            @click="exportLocalStorage"
            class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Database
          </button>
          
          <div class="relative">
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              @change="handleFileSelect"
              class="hidden"
            />
            <button
              @click="$refs.fileInput.click()"
              class="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Database
            </button>
          </div>
          
          <div v-if="importStatus" class="text-sm p-3 rounded" :class="{
            'bg-green-50 text-green-800': importStatus.success,
            'bg-red-50 text-red-800': !importStatus.success
          }">
            {{ importStatus.message }}
          </div>
        </div>
      </div>

      <!-- Proofs Section -->
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Proofs
          </h2>
          <button
            @click="loadV2Proofs"
            class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        
        <p class="text-sm text-gray-600 mb-4">
          All Cashu proofs stored in the app. Copy individual proofs or export all at once.
        </p>

        <div v-if="Object.keys(v2Proofs).length === 0" class="text-sm text-gray-500 italic text-center py-8">
          No proofs found in storage
        </div>

        <div v-else class="space-y-4">
          <!-- Summary Card -->
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div class="text-sm font-medium text-purple-900 mb-1">Summary</div>
            <div class="text-xs text-purple-700">
              {{ Object.keys(v2Proofs).length }} transaction(s) with proofs
            </div>
          </div>

          <!-- Export All Button -->
          <button
            @click="exportAllProofs"
            class="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Export All Proofs to File
          </button>

          <!-- Individual Transactions -->
          <div v-for="(transaction, txId) in v2Proofs" :key="txId" class="border border-gray-200 rounded-lg p-3">
            <div class="flex justify-between items-start mb-2">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900 break-all">
                  {{ formatTransactionId(txId) }}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ formatDate(transaction.timestamp) }}
                </div>
              </div>
            </div>

            <!-- Categories -->
            <div v-for="(category, catName) in transaction.categories" :key="catName" class="mt-3 bg-gray-50 rounded p-2">
              <div class="flex justify-between items-center mb-2">
                <div>
                  <div class="text-sm font-medium capitalize text-gray-700">{{ catName }}</div>
                  <div class="text-xs text-gray-500">
                    {{ category.proofs.length }} proof(s) • {{ calculateProofAmount(category.proofs) }} sats
                  </div>
                  <div class="text-xs text-gray-500 break-all mt-1">
                    Mint: {{ category.mintUrl }}
                  </div>
                </div>
              </div>

              <div class="space-y-2 mt-2">
                <div class="flex space-x-2">
                  <button
                    @click="copyProofs(txId, catName, category)"
                    class="flex-1 text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded hover:bg-blue-200 transition-colors"
                  >
                    Copy Token
                  </button>
                  <button
                    @click="copyProofsRaw(category.proofs)"
                    class="flex-1 text-xs bg-gray-100 text-gray-800 px-3 py-2 rounded hover:bg-gray-200 transition-colors"
                  >
                    Copy Raw JSON
                  </button>
                </div>
                <button
                  @click="checkProofsSpent(txId, catName, category)"
                  :disabled="checkingProofs[`${txId}-${catName}`]"
                  class="w-full text-xs px-3 py-2 rounded transition-colors"
                  :class="checkingProofs[`${txId}-${catName}`]
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
                >
                  <span v-if="checkingProofs[`${txId}-${catName}`]">Checking...</span>
                  <span v-else>Check if Spent</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Incomplete Melt Sessions Section -->
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Incomplete Melt Sessions
          </h2>
          <button
            @click="loadMeltSessions"
            class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        
        <p class="text-sm text-gray-600 mb-4">
          Lightning melt sessions that were not completed and still have remaining proofs.
        </p>

        <div v-if="incompleteMeltSessions.length === 0" class="text-sm text-gray-500 italic text-center py-8">
          No incomplete melt sessions found
        </div>

        <div v-else class="space-y-4">
          <!-- Summary Card -->
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div class="text-sm font-medium text-amber-900 mb-1">Summary</div>
            <div class="text-xs text-amber-700">
              {{ incompleteMeltSessions.length }} incomplete session(s) with {{ totalIncompleteSats }} sats remaining
            </div>
          </div>

          <!-- Individual Sessions -->
          <div v-for="session in incompleteMeltSessions" :key="session.sessionId" class="border border-gray-200 rounded-lg p-3">
            <div class="flex justify-between items-start mb-2">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-900 break-all">
                  {{ formatSessionId(session.sessionId) }}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  Created: {{ formatDate(session.createdAt) }}
                </div>
                <div class="text-xs text-gray-500">
                  Status: <span class="font-medium text-amber-600">{{ session.status }}</span>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 rounded p-2 mt-2">
              <div class="text-xs text-gray-600 space-y-1">
                <div><span class="font-medium">Target:</span> {{ session.lightningAddress }}</div>
                <div><span class="font-medium">Mint:</span> {{ session.mintUrl }}</div>
                <div><span class="font-medium">Initial:</span> {{ session.initialAmount }} sats</div>
                <div><span class="font-medium">Melted:</span> {{ session.totalMelted }} sats</div>
                <div><span class="font-medium">Remaining:</span> {{ session.remainingAmount }} sats ({{ session.remainingProofs.length }} proofs)</div>
                <div><span class="font-medium">Rounds:</span> {{ session.rounds.length }}</div>
              </div>
            </div>

            <div class="space-y-2 mt-3">
              <div class="flex space-x-2">
                <button
                  @click="copyMeltSessionProofs(session)"
                  class="flex-1 text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded hover:bg-blue-200 transition-colors"
                >
                  Copy Remaining Token
                </button>
                <button
                  @click="copyMeltSessionRaw(session.remainingProofs)"
                  class="flex-1 text-xs bg-gray-100 text-gray-800 px-3 py-2 rounded hover:bg-gray-200 transition-colors"
                >
                  Copy Raw JSON
                </button>
              </div>
              <div class="flex space-x-2">
                <button
                  @click="moveToChangeJar(session)"
                  class="flex-1 text-xs bg-green-100 text-green-800 px-3 py-2 rounded hover:bg-green-200 transition-colors"
                >
                  Move to Change Jar
                </button>
                <button
                  @click="deleteMeltSession(session.sessionId)"
                  class="text-xs bg-red-100 text-red-800 px-3 py-2 rounded hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Storage Info Section -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Storage Information
        </h2>
        
        <div class="space-y-2 text-sm">
          <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-600">Total Keys:</span>
            <span class="font-medium">{{ storageInfo.totalKeys }}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="text-gray-600">Estimated Size:</span>
            <span class="font-medium">{{ storageInfo.estimatedSize }}</span>
          </div>
          <div class="flex justify-between py-2">
            <span class="text-gray-600">Last Updated:</span>
            <span class="font-medium">{{ storageInfo.lastUpdated }}</span>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-2 text-red-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Danger Zone
        </h2>
        <p class="text-sm text-red-800 mb-3">
          Warning: These actions cannot be undone. Make sure to export your data first!
        </p>
        <button
          @click="confirmClearAll"
          class="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors"
        >
          Clear All Database
        </button>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg p-6 max-w-sm w-full">
        <h3 class="text-lg font-medium mb-2">Confirm Action</h3>
        <p class="text-sm text-gray-600 mb-4">
          {{ confirmMessage }}
        </p>
        <div class="flex space-x-3 justify-end">
          <button
            @click="cancelConfirm"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            @click="executeConfirm"
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>

    <!-- Success Toast -->
    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showToast" class="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-50">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script>
import { ref, onMounted, computed, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { getEncodedToken } from '@cashu/cashu-ts';
import meltSessionStorageManager from '../services/new/storage/meltSessionStorageManager';
import { storeChangeForMint } from '../services/storageService';
import cashuService from '../services/flows/shared/cashuService';

export default {
  name: 'DebugRecoveryView',
  setup() {
    const router = useRouter();
    const v2Proofs = ref({});
    const incompleteMeltSessions = ref([]);
    const showConfirmModal = ref(false);
    const confirmMessage = ref('');
    const confirmAction = ref(null);
    const showToast = ref(false);
    const toastMessage = ref('');
    const fileInput = ref(null);
    const importStatus = ref(null);
    const checkingProofs = reactive({});

    const totalIncompleteSats = computed(() => {
      return incompleteMeltSessions.value.reduce((sum, session) => sum + session.remainingAmount, 0);
    });

    const storageInfo = computed(() => {
      const keys = Object.keys(localStorage);
      let totalSize = 0;
      
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        totalSize += key.length + (value ? value.length : 0);
      });

      return {
        totalKeys: keys.length,
        estimatedSize: formatBytes(totalSize),
        lastUpdated: new Date().toLocaleString()
      };
    });

    const goBack = () => {
      router.back();
    };

    const loadMeltSessions = () => {
      try {
        // Get all sessions and filter for those with remaining proofs
        const allSessions = meltSessionStorageManager.getAllItems();
        const sessionsWithRemainingProofs = allSessions.filter(session => {
          return session.remainingProofs &&
                 session.remainingProofs.length > 0 &&
                 session.remainingAmount > 0;
        });
        
        incompleteMeltSessions.value = sessionsWithRemainingProofs;
        console.log('Loaded melt sessions with remaining proofs:', sessionsWithRemainingProofs);
      } catch (error) {
        console.error('Error loading melt sessions:', error);
        showToastMessage('Error loading melt sessions');
      }
    };

    const formatSessionId = (sessionId) => {
      if (sessionId.length <= 20) return sessionId;
      return `${sessionId.substring(0, 10)}...${sessionId.substring(sessionId.length - 10)}`;
    };

    const copyMeltSessionProofs = async (session) => {
      try {
        if (!session.remainingProofs || session.remainingProofs.length === 0) {
          showToastMessage('No remaining proofs to copy');
          return;
        }

        const tokenData = {
          mint: session.mintUrl,
          proofs: session.remainingProofs
        };
        const token = getEncodedToken(tokenData);
        
        await navigator.clipboard.writeText(token);
        showToastMessage(`Copied ${session.remainingAmount} sats token to clipboard`);
      } catch (error) {
        console.error('Error copying melt session proofs:', error);
        showToastMessage('Error copying token');
      }
    };

    const copyMeltSessionRaw = async (proofs) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(proofs, null, 2));
        showToastMessage('Copied raw proofs to clipboard');
      } catch (error) {
        console.error('Error copying raw proofs:', error);
        showToastMessage('Error copying raw proofs');
      }
    };

    const moveToChangeJar = async (session) => {
      confirmMessage.value = `Move ${session.remainingAmount} sats from melt session to change jar? This will store the remaining proofs for later use.`;
      confirmAction.value = async () => {
        try {
          if (!session.remainingProofs || session.remainingProofs.length === 0) {
            showToastMessage('No remaining proofs to move');
            return;
          }

          // Store proofs in change jar
          const success = await storeChangeForMint(session.mintUrl, session.remainingProofs);
          
          if (success) {
            // Delete the melt session after successfully storing proofs
            meltSessionStorageManager.removeByKey(session.sessionId);
            loadMeltSessions();
            showToastMessage(`Moved ${session.remainingAmount} sats to change jar`);
          } else {
            showToastMessage('Error storing proofs in change jar');
          }
        } catch (error) {
          console.error('Error moving to change jar:', error);
          showToastMessage('Error moving to change jar');
        }
      };
      showConfirmModal.value = true;
    };

    const deleteMeltSession = (sessionId) => {
      confirmMessage.value = `Delete melt session ${formatSessionId(sessionId)}? This will remove the session but proofs can still be recovered from the token.`;
      confirmAction.value = () => {
        try {
          meltSessionStorageManager.removeByKey(sessionId);
          loadMeltSessions();
          showToastMessage('Melt session deleted');
        } catch (error) {
          console.error('Error deleting melt session:', error);
          showToastMessage('Error deleting session');
        }
      };
      showConfirmModal.value = true;
    };

    const loadV2Proofs = () => {
      try {
        const allProofs = {};
        
        // Load from v2 storage keys
        const v2Keys = {
          'incoming': 'receipt-cash-v2-money-incoming',
          'dev': 'receipt-cash-v2-money-dev',
          'payer': 'receipt-cash-v2-money-payer'
        };
        
        Object.entries(v2Keys).forEach(([category, storageKey]) => {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            try {
              const data = JSON.parse(stored);
              // The v2 storage uses a Map structure with keys like "receiptId-settlementId"
              Object.entries(data).forEach(([key, item]) => {
                // Skip items that are marked as spent
                if (item && item.isSpent === true) {
                  return;
                }
                
                if (item && item.proofs && Array.isArray(item.proofs) && item.proofs.length > 0) {
                  // Use the key as transaction ID
                  if (!allProofs[key]) {
                    allProofs[key] = {
                      timestamp: item.timestamp || Date.now(),
                      categories: {}
                    };
                  }
                  
                  allProofs[key].categories[category] = {
                    proofs: item.proofs,
                    mintUrl: item.mintUrl || item.mint || 'Mint URL not stored',
                    status: 'v2-storage',
                    lastUpdated: item.timestamp || Date.now()
                  };
                }
              });
            } catch (e) {
              console.error(`Error parsing ${storageKey}:`, e);
            }
          }
        });
        
        v2Proofs.value = allProofs;
        console.log('Loaded v2 proofs:', v2Proofs.value);
      } catch (error) {
        console.error('Error loading v2 proofs:', error);
        showToastMessage('Error loading proofs');
      }
    };

    const formatTransactionId = (txId) => {
      if (txId.length <= 16) return txId;
      return `${txId.substring(0, 8)}...${txId.substring(txId.length - 8)}`;
    };

    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleString();
    };

    const calculateProofAmount = (proofs) => {
      return proofs.reduce((sum, proof) => sum + proof.amount, 0);
    };

    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const copyProofs = async (txId, catName, category) => {
      try {
        const tokenData = {
          mint: category.mintUrl,
          proofs: category.proofs
        };
        const token = getEncodedToken(tokenData);
        
        await navigator.clipboard.writeText(token);
        showToastMessage(`Copied ${catName} token to clipboard`);
      } catch (error) {
        console.error('Error copying proofs:', error);
        showToastMessage('Error copying token');
      }
    };

    const copyProofsRaw = async (proofs) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(proofs, null, 2));
        showToastMessage('Copied raw proofs to clipboard');
      } catch (error) {
        console.error('Error copying raw proofs:', error);
        showToastMessage('Error copying raw proofs');
      }
    };

    const checkProofsSpent = async (txId, catName, category) => {
      const key = `${txId}-${catName}`;
      checkingProofs[key] = true;
      
      try {
        const isSpent = await cashuService.checkProofsClaimed(category.proofs, category.mintUrl);
        
        if (isSpent) {
          showToastMessage(`✅ All ${category.proofs.length} proofs are SPENT`);
        } else {
          showToastMessage(`⚠️ Some proofs are still UNSPENT - check console for details`);
        }
      } catch (error) {
        console.error('Error checking proofs:', error);
        showToastMessage('❌ Error checking proofs with mint');
      } finally {
        checkingProofs[key] = false;
      }
    };

    const exportAllProofs = () => {
      try {
        const dataStr = JSON.stringify(v2Proofs.value, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt-cash-proofs-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToastMessage('Proofs exported successfully');
      } catch (error) {
        console.error('Error exporting proofs:', error);
        showToastMessage('Error exporting proofs');
      }
    };

    const exportLocalStorage = () => {
      try {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `receipt-cash-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToastMessage('LocalStorage exported successfully');
      } catch (error) {
        console.error('Error exporting localStorage:', error);
        showToastMessage('Error exporting data');
      }
    };

    const handleFileSelect = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          importLocalStorage(data);
        } catch (error) {
          console.error('Error parsing import file:', error);
          importStatus.value = {
            success: false,
            message: 'Invalid JSON file'
          };
        }
      };
      reader.readAsText(file);
    };

    const importLocalStorage = (data) => {
      confirmMessage.value = 'This will overwrite all current data. Are you sure you want to import?';
      confirmAction.value = () => {
        try {
          Object.keys(data).forEach(key => {
            localStorage.setItem(key, data[key]);
          });
          importStatus.value = {
            success: true,
            message: `Successfully imported ${Object.keys(data).length} items`
          };
          loadV2Proofs();
          showToastMessage('Data imported successfully');
        } catch (error) {
          console.error('Error importing localStorage:', error);
          importStatus.value = {
            success: false,
            message: 'Error importing data'
          };
        }
      };
      showConfirmModal.value = true;
    };

    const confirmClearAll = () => {
      confirmMessage.value = 'This will permanently delete ALL app data including proofs, settings, and history. This action cannot be undone!';
      confirmAction.value = () => {
        localStorage.clear();
        showToastMessage('All data cleared');
        loadV2Proofs();
      };
      showConfirmModal.value = true;
    };

    const cancelConfirm = () => {
      showConfirmModal.value = false;
      confirmAction.value = null;
    };

    const executeConfirm = () => {
      if (confirmAction.value) {
        confirmAction.value();
      }
      showConfirmModal.value = false;
      confirmAction.value = null;
    };

    const showToastMessage = (message) => {
      toastMessage.value = message;
      showToast.value = true;
      setTimeout(() => {
        showToast.value = false;
      }, 3000);
    };

    onMounted(() => {
      loadV2Proofs();
      loadMeltSessions();
    });

    return {
      v2Proofs,
      incompleteMeltSessions,
      totalIncompleteSats,
      storageInfo,
      showConfirmModal,
      confirmMessage,
      showToast,
      toastMessage,
      fileInput,
      importStatus,
      goBack,
      loadV2Proofs,
      loadMeltSessions,
      formatTransactionId,
      formatSessionId,
      formatDate,
      calculateProofAmount,
      copyProofs,
      copyProofsRaw,
      copyMeltSessionProofs,
      copyMeltSessionRaw,
      moveToChangeJar,
      deleteMeltSession,
      checkProofsSpent,
      checkingProofs,
      exportAllProofs,
      exportLocalStorage,
      handleFileSelect,
      confirmClearAll,
      cancelConfirm,
      executeConfirm
    };
  }
};
</script>

<style scoped>
/* Add any component-specific styles here */
</style>