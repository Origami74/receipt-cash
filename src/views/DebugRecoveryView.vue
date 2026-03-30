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
                  Status: <span class="font-medium" :class="{
                    'text-amber-600': session.status !== 'failed',
                    'text-red-600': session.status === 'failed'
                  }">{{ session.status }}</span>
                </div>
                <div v-if="session.status === 'failed' && session.error" class="text-xs text-red-600 mt-1">
                  Reason: {{ session.error }}
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

            <!-- Rounds Details (Collapsible) -->
            <div v-if="session.rounds && session.rounds.length > 0" class="mt-3">
              <button
                @click="toggleRounds(session.sessionId)"
                class="w-full flex items-center justify-between text-xs text-gray-700 hover:text-gray-900 bg-gray-100 px-3 py-2 rounded"
              >
                <span class="font-medium">View Rounds ({{ session.rounds.length }})</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" :class="{ 'rotate-180': expandedRounds[session.sessionId] }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div v-if="expandedRounds[session.sessionId]" class="mt-2 space-y-2">
                <div v-for="(round, index) in session.rounds" :key="index" class="border border-gray-200 rounded p-2 bg-white">
                  <div class="flex justify-between items-start mb-2">
                    <div class="text-xs font-medium text-gray-900">
                      Round {{ index + 1 }}
                    </div>
                    <div class="text-xs" :class="{
                      'text-green-600': round.success,
                      'text-red-600': !round.success,
                      'text-amber-600': round.success === undefined
                    }">
                      {{ round.success ? '✅ Success' : round.success === false ? '❌ Failed' : '⏳ Pending' }}
                    </div>
                  </div>

                  <div class="text-xs text-gray-600 space-y-1 mb-2">
                    <div><span class="font-medium">Input:</span> {{ calculateProofAmount(round.inputProofs) }} sats ({{ round.inputProofs.length }} proofs)</div>
                    <div v-if="round.meltedAmount"><span class="font-medium">Melted:</span> {{ round.meltedAmount }} sats</div>
                    <div v-if="round.changeProofs"><span class="font-medium">Change:</span> {{ calculateProofAmount(round.changeProofs) }} sats ({{ round.changeProofs.length }} proofs)</div>
                    <div v-if="round.quote"><span class="font-medium">Quote:</span> {{ round.quote.slice(0, 16) }}...</div>
                    <div v-if="round.error" class="text-red-600"><span class="font-medium">Error:</span> {{ round.error }}</div>
                  </div>

                  <div class="flex space-x-2">
                    <button
                      @click="copyRoundInputProofs(session, round, index)"
                      class="flex-1 text-xs bg-blue-100 text-blue-800 px-2 py-1.5 rounded hover:bg-blue-200 transition-colors"
                    >
                      Copy Input Token
                    </button>
                    <button
                      @click="copyRoundInputProofsRaw(round.inputProofs)"
                      class="flex-1 text-xs bg-gray-100 text-gray-800 px-2 py-1.5 rounded hover:bg-gray-200 transition-colors"
                    >
                      Copy Input JSON
                    </button>
                  </div>
                </div>
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
              <div class="space-y-2">
                <div class="flex space-x-2">
                  <button
                    @click="checkMeltSessionTokenStatus(session)"
                    :disabled="checkingProofs[session.sessionId]"
                    class="flex-1 text-xs px-3 py-2 rounded transition-colors"
                    :class="checkingProofs[session.sessionId]
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
                  >
                    <span v-if="checkingProofs[session.sessionId]">Checking...</span>
                    <span v-else>Check Token Status</span>
                  </button>
                  <button
                    v-if="session.status === 'failed'"
                    @click="recoverMeltSession(session)"
                    :disabled="checkingProofs[`recover-${session.sessionId}`]"
                    class="flex-1 text-xs px-3 py-2 rounded transition-colors"
                    :class="checkingProofs[`recover-${session.sessionId}`]
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-100 text-purple-800 hover:bg-purple-200'"
                  >
                    <span v-if="checkingProofs[`recover-${session.sessionId}`]">Recovering...</span>
                    <span v-else>Recover Session</span>
                  </button>
                </div>
                <div class="flex space-x-2">
                  <button
                    @click="moveToWallet(session)"
                    class="flex-1 text-xs bg-green-100 text-green-800 px-3 py-2 rounded hover:bg-green-200 transition-colors"
                  >
                    Move to Wallet
                  </button>
                  <button
                    @click="deleteMeltSession(session.sessionId)"
                    class="text-xs bg-red-100 text-red-800 px-3 py-2 rounded hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div v-if="proofCheckResults[session.sessionId]" class="text-xs p-2 rounded mt-2" :class="{
                'bg-green-50 text-green-800': proofCheckResults[session.sessionId].success,
                'bg-red-50 text-red-800': !proofCheckResults[session.sessionId].success
              }">
                {{ proofCheckResults[session.sessionId].message }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recover Locked Proofs Section -->
      <div class="bg-white rounded-lg shadow p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Recover Locked Proofs
        </h2>
        <p class="text-sm text-gray-600 mb-4">
          If proofs are stuck in prepared/pending operations (e.g. after a failed melt), use these tools to release them back to your wallet.
        </p>

        <div class="space-y-3">
          <!-- Auto Recovery -->
          <button
            @click="runAutoRecovery"
            :disabled="recoveryRunning"
            class="w-full text-sm px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
            :class="recoveryRunning
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'"
          >
            <span v-if="recoveryRunning">Running recovery...</span>
            <span v-else>Run Auto Recovery</span>
          </button>

          <!-- List Stuck Operations -->
          <button
            @click="listStuckOperations"
            :disabled="listingOps"
            class="w-full text-sm px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
            :class="listingOps
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'"
          >
            <span v-if="listingOps">Listing...</span>
            <span v-else>List Stuck Operations</span>
          </button>
        </div>

        <!-- Recovery Result -->
        <div v-if="recoveryResult" class="text-sm p-3 rounded mt-3" :class="{
          'bg-green-50 text-green-800': recoveryResult.success,
          'bg-red-50 text-red-800': !recoveryResult.success
        }">
          {{ recoveryResult.message }}
        </div>

        <!-- Stuck Operations List -->
        <div v-if="stuckOperations.length > 0" class="mt-3 space-y-2">
          <div class="text-sm font-medium text-gray-700 mb-2">
            {{ stuckOperations.length }} stuck operation(s) found:
          </div>
          <div v-for="op in stuckOperations" :key="op.id" class="border border-gray-200 rounded p-3">
            <div class="text-xs space-y-1">
              <div><span class="font-medium">ID:</span> <span class="font-mono">{{ op.id.substring(0, 16) }}...</span></div>
              <div><span class="font-medium">State:</span> <span class="font-medium" :class="{
                'text-amber-600': op.state === 'prepared',
                'text-orange-600': op.state === 'pending' || op.state === 'executing',
                'text-red-600': op.state === 'failed'
              }">{{ op.state }}</span></div>
              <div v-if="op.amount"><span class="font-medium">Amount:</span> {{ op.amount }} sats</div>
            </div>
            <div class="flex space-x-2 mt-2">
              <button
                @click="cancelOperation(op)"
                :disabled="cancellingOp[op.id]"
                class="flex-1 text-xs px-3 py-2 rounded transition-colors"
                :class="cancellingOp[op.id]
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'"
              >
                {{ cancellingOp[op.id] ? 'Cancelling...' : (op.state === 'pending' ? 'Reclaim Proofs' : 'Cancel & Release') }}
              </button>
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
          Delete Database
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
import cashuService from '../services/flows/shared/cashuService';
import { cocoService } from '../services/cocoService';

export default {
  name: 'DebugRecoveryView',
  setup() {
    const router = useRouter();
    const incompleteMeltSessions = ref([]);
    const showConfirmModal = ref(false);
    const confirmMessage = ref('');
    const confirmAction = ref(null);
    const showToast = ref(false);
    const toastMessage = ref('');
    const fileInput = ref(null);
    const importStatus = ref(null);
    const checkingProofs = reactive({});
    const proofCheckResults = reactive({});
    const expandedRounds = reactive({});
    const recoveryRunning = ref(false);
    const recoveryResult = ref(null);
    const stuckOperations = ref([]);
    const listingOps = ref(false);
    const cancellingOp = reactive({});

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

    const moveToWallet = async (session) => {
      confirmMessage.value = `Move ${session.remainingAmount} sats from melt session to wallet? This will receive the remaining proofs into your main wallet.`;
      confirmAction.value = async () => {
        try {
          if (!session.remainingProofs || session.remainingProofs.length === 0) {
            showToastMessage('No remaining proofs to move');
            return;
          }

          // Get coco instance
          const coco = await import('../services/cocoService').then(m => m.cocoService.getCoco());
          
          // Add mint if not already added (auto-trust)
          const mints = await coco.mint.getAllMints();
          const mintExists = mints.some(m => m.url === session.mintUrl);
          
          if (!mintExists) {
            await coco.mint.addMint(session.mintUrl, { trusted: true });
            console.log(`✅ Auto-trusted mint: ${session.mintUrl}`);
          }
          
          // Construct token for coco
          const tokenData = {
            mint: session.mintUrl,
            proofs: session.remainingProofs
          };
          const token = getEncodedToken(tokenData);
          
          // Receive into coco wallet
          await coco.wallet.receive(token);
          console.log(`💰 Received ${session.remainingAmount} sats into wallet`);
          
          // Delete the melt session after successfully moving proofs
          meltSessionStorageManager.removeByKey(session.sessionId);
          loadMeltSessions();
          showToastMessage(`Moved ${session.remainingAmount} sats to wallet`);
        } catch (error) {
          console.error('Error moving to wallet:', error);
          showToastMessage(`Error moving to wallet: ${error.message}`);
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


    const checkMeltSessionTokenStatus = async (session) => {
      const key = session.sessionId;
      checkingProofs[key] = true;
      delete proofCheckResults[key];
      
      try {
        const isSpent = await cashuService.checkProofsClaimed(session.remainingProofs, session.mintUrl);
        
        if (isSpent) {
          proofCheckResults[key] = {
            success: true,
            message: `✅ All ${session.remainingProofs.length} remaining proofs are SPENT`
          };
          showToastMessage(`✅ All ${session.remainingProofs.length} remaining proofs are SPENT`);
        } else {
          proofCheckResults[key] = {
            success: false,
            message: `⚠️ Some proofs are still UNSPENT (${session.remainingAmount} sats)`
          };
          showToastMessage(`⚠️ Some proofs are still UNSPENT (${session.remainingAmount} sats)`);
        }
      } catch (error) {
        console.error('Error checking melt session token:', error);
        proofCheckResults[key] = {
          success: false,
          message: `❌ Error: ${error.message || 'Failed to check token status'}`
        };
        showToastMessage(`❌ Error checking token: ${error.message || 'Unknown error'}`);
      } finally {
        checkingProofs[key] = false;
      }
    };
    const recoverMeltSession = async (session) => {
      const key = `recover-${session.sessionId}`;
      checkingProofs[key] = true;
      delete proofCheckResults[session.sessionId];
      
      try {
        // Get wallet to check proof states
        const cashuWallet = await import('../services/flows/shared/cashuWalletManager.js');
        const walletInstance = await cashuWallet.default.getWallet(session.mintUrl);
        
        // Check which proofs are actually unspent
        const stateCheckResult = await walletInstance.checkProofsStates(session.remainingProofs);
        
        const unspentResults = stateCheckResult.filter(result => result.state !== 'SPENT');
        const spentResults = stateCheckResult.filter(result => result.state === 'SPENT');
        
        // Get the actual unspent proofs
        const unspentProofs = unspentResults
          .map(result => session.remainingProofs.find(p => p.secret === result.secret))
          .filter(Boolean);
        
        const unspentAmount = unspentProofs.reduce((sum, p) => sum + p.amount, 0);
        const spentAmount = session.remainingAmount - unspentAmount;
        
        console.log(`Recovery check: ${spentResults.length} spent (${spentAmount} sats), ${unspentResults.length} unspent (${unspentAmount} sats)`);
        
        if (unspentProofs.length === 0) {
          // All proofs are spent, mark session as completed
          const meltSessionManager = await import('../services/new/storage/meltSessionStorageManager.js');
          meltSessionManager.default.completeSession(session.sessionId, {
            success: true,
            totalMelted: session.initialAmount,
            remainingProofs: [],
            remainingAmount: 0
          });
          
          proofCheckResults[session.sessionId] = {
            success: true,
            message: `✅ Recovered: All proofs were spent. Session marked as completed.`
          };
          showToastMessage('✅ Session recovered and marked as completed');
          loadMeltSessions();
        } else if (unspentProofs.length < session.remainingProofs.length) {
          // Some proofs are spent, update session with only unspent proofs
          const meltSessionManager = await import('../services/new/storage/meltSessionStorageManager.js');
          meltSessionManager.default.updateSession(
            session.sessionId,
            'active',
            unspentProofs,
            session.totalMelted + spentAmount
          );
          
          proofCheckResults[session.sessionId] = {
            success: true,
            message: `✅ Recovered: Updated session with ${unspentProofs.length} unspent proofs (${unspentAmount} sats). ${spentResults.length} spent proofs (${spentAmount} sats) removed.`
          };
          showToastMessage(`✅ Session recovered: ${unspentAmount} sats remaining`);
          loadMeltSessions();
        } else {
          // All proofs are still unspent
          proofCheckResults[session.sessionId] = {
            success: false,
            message: `⚠️ All ${unspentProofs.length} proofs are still UNSPENT (${unspentAmount} sats). No recovery needed.`
          };
          showToastMessage('⚠️ All proofs still unspent, no recovery needed');
        }
      } catch (error) {
        console.error('Error recovering melt session:', error);
        proofCheckResults[session.sessionId] = {
          success: false,
          message: `❌ Recovery failed: ${error.message || 'Unknown error'}`
        };
        showToastMessage(`❌ Recovery failed: ${error.message || 'Unknown error'}`);
      } finally {
        checkingProofs[key] = false;
      }
    };

    const runAutoRecovery = async () => {
      recoveryRunning.value = true;
      recoveryResult.value = null;

      try {
        const coco = cocoService.getCoco();
        await coco.ops.melt.recovery.run();
        recoveryResult.value = {
          success: true,
          message: '✅ Auto recovery completed. Stuck operations should be resolved.'
        };
        showToastMessage('Auto recovery completed');
      } catch (error) {
        console.error('Auto recovery failed:', error);
        recoveryResult.value = {
          success: false,
          message: `❌ Recovery failed: ${error.message || 'Unknown error'}`
        };
        showToastMessage(`Recovery failed: ${error.message}`);
      } finally {
        recoveryRunning.value = false;
      }
    };

    const listStuckOperations = async () => {
      listingOps.value = true;
      stuckOperations.value = [];

      try {
        const coco = cocoService.getCoco();
        const prepared = await coco.ops.melt.listPrepared();
        const inFlight = await coco.ops.melt.listInFlight();

        const allStuck = [
          ...prepared.map(op => ({ ...op, state: op.state || 'prepared' })),
          ...inFlight.map(op => ({ ...op, state: op.state || 'in_flight' }))
        ];

        stuckOperations.value = allStuck;

        if (allStuck.length === 0) {
          showToastMessage('No stuck operations found');
        } else {
          showToastMessage(`Found ${allStuck.length} stuck operation(s)`);
        }
      } catch (error) {
        console.error('Error listing stuck operations:', error);
        showToastMessage(`Error: ${error.message}`);
      } finally {
        listingOps.value = false;
      }
    };

    const cancelOperation = async (op) => {
      cancellingOp[op.id] = true;

      try {
        const coco = cocoService.getCoco();
        if (op.state === 'pending') {
          await coco.ops.melt.reclaim(op.id, 'Manual recovery');
        } else {
          await coco.ops.melt.cancel(op.id, 'Manual recovery');
        }
        showToastMessage(`✅ Operation ${op.id.substring(0, 8)}... released`);
        // Refresh the list
        await listStuckOperations();
      } catch (error) {
        console.error('Error cancelling operation:', error);
        showToastMessage(`❌ Failed: ${error.message}`);
      } finally {
        cancellingOp[op.id] = false;
      }
    };

    const toggleRounds = (sessionId) => {
      expandedRounds[sessionId] = !expandedRounds[sessionId];
    };

    const copyRoundInputProofs = async (session, round, index) => {
      try {
        if (!round.inputProofs || round.inputProofs.length === 0) {
          showToastMessage('No input proofs to copy');
          return;
        }

        const tokenData = {
          mint: session.mintUrl,
          proofs: round.inputProofs
        };
        const token = getEncodedToken(tokenData);
        
        await navigator.clipboard.writeText(token);
        const amount = calculateProofAmount(round.inputProofs);
        showToastMessage(`Copied round ${index + 1} input token (${amount} sats)`);
      } catch (error) {
        console.error('Error copying round input proofs:', error);
        showToastMessage('Error copying round input token');
      }
    };

    const copyRoundInputProofsRaw = async (inputProofs) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(inputProofs, null, 2));
        showToastMessage('Copied round input proofs JSON');
      } catch (error) {
        console.error('Error copying round input proofs raw:', error);
        showToastMessage('Error copying round input proofs');
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
      loadMeltSessions();
    });

    return {
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
      loadMeltSessions,
      formatTransactionId,
      formatSessionId,
      formatDate,
      calculateProofAmount,
      copyMeltSessionProofs,
      copyMeltSessionRaw,
      moveToWallet,
      deleteMeltSession,
      checkMeltSessionTokenStatus,
      recoverMeltSession,
      checkingProofs,
      proofCheckResults,
      expandedRounds,
      toggleRounds,
      copyRoundInputProofs,
      copyRoundInputProofsRaw,
      exportLocalStorage,
      handleFileSelect,
      confirmClearAll,
      cancelConfirm,
      executeConfirm,
      recoveryRunning,
      recoveryResult,
      stuckOperations,
      listingOps,
      cancellingOp,
      runAutoRecovery,
      listStuckOperations,
      cancelOperation
    };
  }
};
</script>

<style scoped>
/* Add any component-specific styles here */
</style>