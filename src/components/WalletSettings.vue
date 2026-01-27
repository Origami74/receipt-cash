<template>
  <div class="space-y-4">
    <!-- Total Balance -->
    <div class="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
      <div class="flex justify-between items-center mb-2">
        <h5 class="text-sm font-medium text-gray-700">Total Balance</h5>
        <button
          @click="refreshBalances"
          class="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          title="Refresh balances"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      <div class="text-3xl font-bold text-gray-900">
        {{ formatSats(totalBalance) }}
      </div>
      <div class="text-xs text-gray-500 mt-1">
        Across {{ mintBalances.length }} mint{{ mintBalances.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Per-Mint Balances -->
    <div v-if="mintBalances.length > 0">
      <h5 class="text-sm font-medium text-gray-700 mb-2">Balance by Mint</h5>
      <div class="space-y-2">
        <div
          v-for="mint in mintBalances"
          :key="mint.url"
          class="bg-gray-50 rounded-lg p-3"
        >
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">
                {{ formatMintUrl(mint.url) }}
              </div>
              <div class="text-xs text-gray-500 break-all">
                {{ mint.url }}
              </div>
            </div>
            <div class="text-right ml-2">
              <div class="text-lg font-semibold text-gray-900">
                {{ formatSats(mint.balance) }}
              </div>
            </div>
          </div>
          
          <div class="flex justify-end space-x-2 mt-2">
            <button
              @click="showDrainConfirmation(mint)"
              class="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200"
            >
              Drain Mint
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-sm text-gray-500 italic text-center py-4">
      No balance available
    </div>

    <!-- Seedphrase Backup -->
    <div class="pt-4 border-t border-gray-200">
      <h5 class="text-sm font-medium text-gray-700 mb-2">Backup & Recovery</h5>
      <p class="text-xs text-gray-600 mb-3">
        Your 12-word recovery phrase allows you to restore your wallet on any device.
        Keep it safe and never share it with anyone.
      </p>
      
      <button
        v-if="!showSeedphrase"
        @click="revealSeedphrase"
        class="w-full bg-blue-100 text-blue-800 px-4 py-2 rounded hover:bg-blue-200 text-sm font-medium"
      >
        Show Recovery Phrase
      </button>
      
      <div v-else class="space-y-3">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div class="flex items-start mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="text-xs text-yellow-800">
              <strong>Warning:</strong> Anyone with this phrase can access your funds. Store it securely offline.
            </div>
          </div>
          
          <div class="bg-white rounded p-3 font-mono text-sm break-all select-all">
            {{ seedphrase }}
          </div>
        </div>
        
        <div class="flex space-x-2">
          <button
            @click="copySeedphrase"
            class="flex-1 bg-blue-100 text-blue-800 px-4 py-2 rounded hover:bg-blue-200 text-sm font-medium"
          >
            {{ seedphraseCopied ? '✓ Copied!' : 'Copy to Clipboard' }}
          </button>
          <button
            @click="hideSeedphrase"
            class="flex-1 bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200 text-sm font-medium"
          >
            Hide
          </button>
        </div>
      </div>
    </div>

    <!-- Drained Tokens History -->
    <div v-if="drainedTokens.length > 0" class="pt-4 border-t border-gray-200">
      <h5 class="text-sm font-medium text-gray-700 mb-2">Drained Tokens</h5>
      <p class="text-xs text-gray-600 mb-3">
        Tokens you've drained from mints. Copy them to import into another wallet.
      </p>
      
      <div class="space-y-2">
        <div
          v-for="(token, index) in drainedTokens"
          :key="index"
          class="bg-gray-50 rounded-lg p-3"
        >
          <div class="flex justify-between items-start mb-2">
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-500">
                {{ formatDate(token.timestamp) }}
              </div>
              <div class="text-sm font-medium text-gray-900">
                {{ formatSats(token.amount) }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ formatMintUrl(token.mintUrl) }}
              </div>
            </div>
          </div>
          
          <div class="flex justify-end space-x-2">
            <button
              @click="copyToken(token)"
              class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
            >
              {{ token.copied ? '✓ Copied!' : 'Copy Token' }}
            </button>
            <button
              @click="removeToken(index)"
              class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Drain Confirmation Modal -->
    <div v-if="showDrainModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-medium mb-2">⚠️ Drain Mint</h3>
        <p class="text-sm text-gray-600 mb-4">
          You are about to drain <strong>{{ formatSats(drainTarget?.balance || 0) }}</strong> from:
        </p>
        <div class="bg-gray-50 rounded p-2 mb-4 text-xs break-all">
          {{ drainTarget?.url }}
        </div>
        <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p class="text-sm text-yellow-800">
            <strong>Warning:</strong> Draining a mint may cause problems with pending receipt payouts. 
            Only drain if you're sure no payments are pending from this mint, or if you want to move 
            funds to another wallet.
          </p>
        </div>
        <p class="text-xs text-gray-600 mb-4">
          The token will be saved in your "Drained Tokens" history so you can copy it later.
        </p>
        <div class="flex space-x-3 justify-end">
          <button
            @click="cancelDrain"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            @click="confirmDrain"
            :disabled="draining"
            class="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
          >
            {{ draining ? 'Draining...' : 'Drain Mint' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { cocoService } from '../services/cocoService';
import { seedphraseService } from '../services/seedphraseService';

export default {
  name: 'WalletSettings',
  data() {
    return {
      totalBalance: 0,
      mintBalances: [],
      showSeedphrase: false,
      seedphrase: '',
      seedphraseCopied: false,
      showDrainModal: false,
      drainTarget: null,
      draining: false,
      drainedTokens: [],
    };
  },
  mounted() {
    this.refreshBalances();
    this.loadDrainedTokens();
  },
  methods: {
    async refreshBalances() {
      try {
        this.totalBalance = await cocoService.getTotalBalance();
        this.mintBalances = await cocoService.getBalancePerMint();
      } catch (error) {
        console.error('Failed to refresh balances:', error);
      }
    },
    
    formatSats(amount) {
      return `${amount.toLocaleString()} sats`;
    },
    
    formatMintUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch {
        return url;
      }
    },
    
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    
    revealSeedphrase() {
      this.seedphrase = seedphraseService.getSeedphrase() || 'No seedphrase found';
      this.showSeedphrase = true;
      this.seedphraseCopied = false;
    },
    
    hideSeedphrase() {
      this.showSeedphrase = false;
      this.seedphrase = '';
      this.seedphraseCopied = false;
    },
    
    async copySeedphrase() {
      try {
        await navigator.clipboard.writeText(this.seedphrase);
        this.seedphraseCopied = true;
        setTimeout(() => {
          this.seedphraseCopied = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy seedphrase:', error);
        alert('Failed to copy to clipboard');
      }
    },
    
    showDrainConfirmation(mint) {
      this.drainTarget = mint;
      this.showDrainModal = true;
    },
    
    cancelDrain() {
      this.showDrainModal = false;
      this.drainTarget = null;
    },
    
    async confirmDrain() {
      if (!this.drainTarget) return;
      
      this.draining = true;
      try {
        // Send all balance from this mint
        const token = await cocoService.getCoco().wallet.send(
          this.drainTarget.mintUrl,
          this.drainTarget.balance
        );
        
        // Save to drained tokens history
        const drainedToken = {
          timestamp: Date.now(),
          amount: this.drainTarget.balance,
          mintUrl: this.drainTarget.mintUrl,
          token: token,
          copied: false
        };
        
        this.drainedTokens.unshift(drainedToken);
        this.saveDrainedTokens();
        
        // Refresh balances
        await this.refreshBalances();
        
        this.showDrainModal = false;
        this.drainTarget = null;
        
        alert(`Successfully drained ${this.formatSats(drainedToken.amount)}. Token saved to history.`);
      } catch (error) {
        console.error('Failed to drain mint:', error);
        alert(`Failed to drain mint: ${error.message}`);
      } finally {
        this.draining = false;
      }
    },
    
    async copyToken(token) {
      try {
        await navigator.clipboard.writeText(token.token);
        token.copied = true;
        setTimeout(() => {
          token.copied = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy token:', error);
        alert('Failed to copy to clipboard');
      }
    },
    
    removeToken(index) {
      if (confirm('Remove this token from history? Make sure you\'ve copied it first!')) {
        this.drainedTokens.splice(index, 1);
        this.saveDrainedTokens();
      }
    },
    
    loadDrainedTokens() {
      try {
        const stored = localStorage.getItem('drained-tokens');
        if (stored) {
          this.drainedTokens = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Failed to load drained tokens:', error);
      }
    },
    
    saveDrainedTokens() {
      try {
        localStorage.setItem('drained-tokens', JSON.stringify(this.drainedTokens));
      } catch (error) {
        console.error('Failed to save drained tokens:', error);
      }
    }
  }
};
</script>