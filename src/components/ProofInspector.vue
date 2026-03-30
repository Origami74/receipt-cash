<template>
  <div class="bg-white rounded-lg shadow p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Proof Inspector
      </h2>
      <button
        @click="loadProofStats"
        :disabled="loading"
        class="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {{ loading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>
    <p class="text-sm text-gray-600 mb-4">
      View all proofs in the coco database grouped by state.
    </p>

    <div v-if="!stats" class="text-sm text-gray-500 italic text-center py-4">
      Loading proof data...
    </div>

    <div v-else class="space-y-3">
      <!-- Summary -->
      <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-indigo-700 font-medium">Ready:</span>
            <span class="ml-1">{{ stats.ready.total }} sats ({{ stats.ready.count }} proofs)</span>
          </div>
          <div>
            <span class="text-indigo-700 font-medium">Available:</span>
            <span class="ml-1">{{ stats.available.total }} sats ({{ stats.available.count }} proofs)</span>
          </div>
          <div>
            <span class="text-amber-700 font-medium">Reserved:</span>
            <span class="ml-1">{{ stats.reserved.total }} sats ({{ stats.reserved.count }} proofs)</span>
          </div>
          <div>
            <span class="text-orange-700 font-medium">In-flight:</span>
            <span class="ml-1">{{ stats.inflight.total }} sats ({{ stats.inflight.count }} proofs)</span>
          </div>
        </div>
        <div v-if="stats.reserved.total > 0 || stats.inflight.total > 0" class="text-xs text-amber-700 mt-2 pt-2 border-t border-indigo-200">
          {{ stats.reserved.total + stats.inflight.total }} sats locked (reserved + in-flight)
        </div>
      </div>

      <!-- Per-mint breakdown -->
      <div v-for="mint in stats.mints" :key="mint.url" class="border border-gray-200 rounded p-3">
        <div class="text-xs font-medium text-gray-900 break-all mb-2">{{ mint.url }}</div>
        <div class="text-xs text-gray-600 space-y-1">
          <div><span class="font-medium">Ready:</span> {{ mint.ready }} sats</div>
          <div><span class="font-medium">Available:</span> {{ mint.available }} sats</div>
          <div v-if="mint.reserved > 0" class="text-amber-700"><span class="font-medium">Reserved:</span> {{ mint.reserved }} sats</div>
          <div v-if="mint.inflight > 0" class="text-orange-700"><span class="font-medium">In-flight:</span> {{ mint.inflight }} sats</div>
          <div v-if="mint.locked > 0" class="text-red-700"><span class="font-medium">Total locked:</span> {{ mint.locked }} sats</div>
        </div>
        <button
          @click="copyMintProofs(mint.url)"
          class="mt-2 w-full text-xs px-3 py-2 rounded transition-colors bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
        >
          Copy All Proofs for This Mint
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="toast" class="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-50">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { getEncodedToken } from '@cashu/cashu-ts';
import { cocoService } from '../services/cocoService';

export default {
  name: 'ProofInspector',
  setup() {
    const loading = ref(false);
    const stats = ref(null);
    const toast = ref(null);

    const sumProofs = (proofs) => proofs.reduce((sum, p) => sum + p.amount, 0);

    const showToast = (message) => {
      toast.value = message;
      setTimeout(() => { toast.value = null; }, 3000);
    };

    const dedupeProofs = (proofs) => {
      const seen = new Set();
      const result = [];
      for (const proof of proofs) {
        if (!seen.has(proof.secret)) {
          seen.add(proof.secret);
          result.push(proof);
        }
      }
      return result;
    };

    const loadProofStats = async () => {
      loading.value = true;
      try {
        const repo = cocoService.getRepo();
        const ready = await repo.proofRepository.getAllReadyProofs();
        const reserved = await repo.proofRepository.getReservedProofs();
        const inflight = await repo.proofRepository.getInflightProofs();

        const coco = cocoService.getCoco();
        const mints = await coco.mint.getAllMints();
        const mintStats = [];
        for (const mint of mints) {
          const mintReady = await repo.proofRepository.getReadyProofs(mint.mintUrl);
          const mintAvailable = await repo.proofRepository.getAvailableProofs(mint.mintUrl);
          const mintInflight = inflight.filter(p => p.mintUrl === mint.mintUrl);
          const mintReserved = reserved.filter(p => p.mintUrl === mint.mintUrl);
          const readyTotal = sumProofs(mintReady);
          const availableTotal = sumProofs(mintAvailable);
          mintStats.push({
            url: mint.mintUrl,
            ready: readyTotal,
            available: availableTotal,
            reserved: sumProofs(mintReserved),
            inflight: sumProofs(mintInflight),
            locked: readyTotal - availableTotal + sumProofs(mintInflight)
          });
        }

        const reservedSecrets = new Set(reserved.map(p => p.secret));
        const availableProofs = ready.filter(p => !reservedSecrets.has(p.secret));

        stats.value = {
          ready: { total: sumProofs(ready), count: ready.length },
          available: { total: sumProofs(availableProofs), count: availableProofs.length },
          reserved: { total: sumProofs(reserved), count: reserved.length },
          inflight: { total: sumProofs(inflight), count: inflight.length },
          mints: mintStats,
          _readyProofs: ready,
          _inflightProofs: inflight,
          _reservedProofs: reserved
        };
      } catch (error) {
        console.error('Error loading proof stats:', error);
        showToast(`Error: ${error.message}`);
      } finally {
        loading.value = false;
      }
    };

    const getAllDeduped = (mintUrl) => {
      if (!stats.value) return [];
      let proofs = [
        ...stats.value._readyProofs,
        ...stats.value._inflightProofs,
        ...stats.value._reservedProofs
      ];
      if (mintUrl) {
        proofs = proofs.filter(p => p.mintUrl === mintUrl);
      }
      return dedupeProofs(proofs);
    };

    const copyMintProofs = async (mintUrl) => {
      try {
        const deduped = getAllDeduped(mintUrl);
        if (deduped.length === 0) {
          showToast('No proofs for this mint');
          return;
        }
        const token = getEncodedToken({ mint: mintUrl, proofs: deduped });
        await navigator.clipboard.writeText(token);
        showToast(`Copied ${sumProofs(deduped)} sats (${deduped.length} proofs)`);
      } catch (error) {
        console.error('Error copying mint proofs:', error);
        showToast(`Error: ${error.message}`);
      }
    };

    onMounted(() => {
      loadProofStats();
    });

    return {
      loading,
      stats,
      toast,
      loadProofStats,
      copyMintProofs
    };
  }
};
</script>
