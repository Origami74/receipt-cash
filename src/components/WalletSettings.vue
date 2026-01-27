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
              @click="attemptRecovery(mint)"
              :disabled="mint.recovering"
              class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 disabled:opacity-50"
            >
              {{ mint.recovering ? 'Recovering...' : '🔄 Attempt Recovery' }}
            </button>
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

    <!-- Drained Tokens (inline with balances) -->
    <transition-group name="list" tag="div" class="space-y-2">
      <div
        v-for="(token, index) in drainedTokens"
        :key="`drained-${token.timestamp}`"
        class="bg-amber-50 border border-amber-200 rounded-lg p-3 transition-all duration-300"
      >
        <div class="flex items-center justify-between">
          <!-- Left: Icon and Details -->
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="text-xl">🥜</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900">
                {{ formatSats(token.amount) }}
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ formatMintUrl(token.mintUrl) }} • Drained
              </div>
            </div>
          </div>
          
          <!-- Right: Action Buttons -->
          <div class="flex items-center space-x-1">
            <button
              @click="copyToken(token)"
              class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              :title="token.copied ? 'Copied!' : 'Copy token'"
            >
              <svg v-if="!token.copied" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              @click="confirmRemoveToken(index)"
              class="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete token"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </transition-group>

    <!-- Manual Mint Recovery -->
    <div class="pt-4 border-t border-gray-200">
      <h5 class="text-sm font-medium text-gray-700 mb-2">Add Mint for Recovery</h5>
      <p class="text-xs text-gray-600 mb-3">
        If you've used a mint before but don't see it above, add it here to recover any unspent funds.
      </p>
      
      <div class="space-y-2">
        <input
          v-model="newMintUrl"
          type="text"
          placeholder="https://mint.example.com"
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          @keyup.enter="addMintForRecovery"
        />
        <button
          @click="addMintForRecovery"
          :disabled="!newMintUrl || addingMint"
          class="w-full bg-green-100 text-green-800 px-4 py-2 rounded hover:bg-green-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ addingMint ? 'Adding Mint...' : '➕ Add Mint & Scan for Funds' }}
        </button>
      </div>
      
      <div v-if="recoveryMessage" class="mt-2 p-2 rounded text-xs" :class="recoveryMessageClass">
        {{ recoveryMessage }}
      </div>
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

    <!-- Delete Token Confirmation Modal -->
    <div v-if="tokenToRemove !== null" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-medium mb-2">🗑️ Delete Drained Token</h3>
        <p class="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this drained token?
        </p>
        <div class="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
          <div class="text-sm font-medium text-gray-900 mb-1">
            {{ formatSats(drainedTokens[tokenToRemove]?.amount || 0) }}
          </div>
          <div class="text-xs text-gray-500">
            {{ formatMintUrl(drainedTokens[tokenToRemove]?.mintUrl || '') }}
          </div>
        </div>
        <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p class="text-sm text-yellow-800">
            <strong>Warning:</strong> Make sure you've copied the token first! Once deleted, you won't be able to recover it from this list.
          </p>
        </div>
        <div class="flex space-x-3 justify-end">
          <button
            @click="cancelRemoveToken"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            @click="confirmDeleteToken"
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete Token
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* List transition animations */
.list-enter-active {
  transition: all 0.3s ease-out;
}

.list-leave-active {
  transition: all 0.3s ease-in;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>

<script>
import { cocoService } from '../services/cocoService';
import { seedphraseService } from '../services/seedphraseService';
import { showNotification } from '../services/notificationService';

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
      newMintUrl: '',
      addingMint: false,
      recoveryMessage: '',
      recoveryMessageClass: '',
      tokenToRemove: null,
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
          this.drainTarget.url,
          this.drainTarget.balance
        );
        
        // Save to drained tokens history
        const drainedToken = {
          timestamp: Date.now(),
          amount: this.drainTarget.balance,
          mintUrl: this.drainTarget.url,
          token: token,
          copied: false
        };
        
        this.drainedTokens.unshift(drainedToken);
        this.saveDrainedTokens();
        
        // Auto-copy the token
        await this.copyToken(drainedToken);
        
        // Refresh balances
        await this.refreshBalances();
        
        this.showDrainModal = false;
        this.drainTarget = null;
        
        showNotification(`Drained ${this.formatSats(drainedToken.amount)} and copied to clipboard`, 'success');
      } catch (error) {
        console.error('Failed to drain mint:', error);
        showNotification(`Failed to drain mint: ${error.message}`, 'error');
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
        showNotification('Failed to copy to clipboard', 'error');
      }
    },
    
    confirmRemoveToken(index) {
      this.tokenToRemove = index;
    },
    
    cancelRemoveToken() {
      this.tokenToRemove = null;
    },
    
    confirmDeleteToken() {
      if (this.tokenToRemove !== null) {
        this.drainedTokens.splice(this.tokenToRemove, 1);
        this.saveDrainedTokens();
        showNotification('Token deleted', 'info');
        this.tokenToRemove = null;
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
    },
    
    async addMintForRecovery() {
      if (!this.newMintUrl) return;
      
      this.addingMint = true;
      this.recoveryMessage = '';
      
      try {
        // Normalize URL
        let mintUrl = this.newMintUrl.trim();
        if (!mintUrl.startsWith('http://') && !mintUrl.startsWith('https://')) {
          mintUrl = 'https://' + mintUrl;
        }
        
        // Add mint to coco
        const coco = cocoService.getCoco();
        await coco.mint.addMint(mintUrl, { trusted: true });
        
        console.log(`✅ Added mint: ${mintUrl}`);
        
        // Get balance before restore
        const oldBalance = this.totalBalance;
        
        // Get the BIP39 seed for sweep operation
        const mnemonic = seedphraseService.getSeedphrase();
        if (!mnemonic) {
          throw new Error('No seedphrase found');
        }
        const seed = seedphraseService.mnemonicToSeed(mnemonic);
        
        // Use coco's restore method to sweep the mint for proofs
        console.log(`🔄 Restoring proofs from ${mintUrl}...`);
        await coco.wallet.restore(mintUrl);
        console.log(`✅ Restore complete for ${mintUrl}`);
        
        // Also run sweep to catch any additional proofs
        console.log(`🧹 Sweeping mint for additional proofs...`);
        await coco.wallet.sweep(mintUrl, seed);
        console.log(`✅ Sweep complete for ${mintUrl}`);
        
        // Wait a moment for proofs to be added
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh balances to see if we recovered anything
        await this.refreshBalances();
        const newBalance = this.totalBalance;
        const recovered = newBalance - oldBalance;
        
        if (recovered > 0) {
          this.recoveryMessage = `✅ Success! Recovered ${this.formatSats(recovered)} from this mint.`;
          this.recoveryMessageClass = 'bg-green-50 text-green-800 border border-green-200';
        } else {
          this.recoveryMessage = `✅ Mint added successfully. No unspent funds found on this mint.`;
          this.recoveryMessageClass = 'bg-blue-50 text-blue-800 border border-blue-200';
        }
        
        this.newMintUrl = '';
        
        // Clear message after 5 seconds
        setTimeout(() => {
          this.recoveryMessage = '';
        }, 5000);
        
      } catch (error) {
        console.error('Failed to add mint:', error);
        this.recoveryMessage = `❌ Failed to add mint: ${error.message}`;
        this.recoveryMessageClass = 'bg-red-50 text-red-800 border border-red-200';
      } finally {
        this.addingMint = false;
      }
    },
    
    async attemptRecovery(mint) {
      // Set recovering flag (Vue 3 way - direct mutation)
      mint.recovering = true;
      
      try {
        console.log(`🔄 Attempting recovery for mint: ${mint.url}`);
        
        // Get current balance before recovery
        const oldBalance = mint.balance;
        
        let restoreError = null;
        let sweepError = null;
        
        // Get the BIP39 seed for sweep operation
        const mnemonic = seedphraseService.getSeedphrase();
        if (!mnemonic) {
          throw new Error('No seedphrase found');
        }
        const seed = seedphraseService.mnemonicToSeed(mnemonic);
        
        // Use coco's built-in restore method
        // This sweeps each keyset and adds swept proofs to the wallet
        const coco = cocoService.getCoco();
        try {
          await coco.wallet.restore(mint.url);
          console.log(`✅ Restore complete for ${mint.url}`);
        } catch (error) {
          // Restore may partially fail if some keysets are unavailable
          // But it might still have recovered some proofs
          console.warn(`⚠️ Restore had issues: ${error.message}`);
          restoreError = error;
        }
        
        // Also run sweep to catch any additional proofs
        try {
          console.log(`🧹 Sweeping mint for additional proofs...`);
          await coco.wallet.sweep(mint.url, seed);
          console.log(`✅ Sweep complete for ${mint.url}`);
        } catch (error) {
          console.warn(`⚠️ Sweep had issues: ${error.message}`);
          sweepError = error;
        }
        
        // Wait a moment for proofs to be added
        // await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh balances to see what was recovered
        await this.refreshBalances();
        
        // Find the updated mint
        const updatedMint = this.mintBalances.find(m => m.url === mint.url);
        const newBalance = updatedMint?.balance || 0;
        const recovered = newBalance - oldBalance;
        
        if (recovered > 0) {
          // Show success even if there were partial errors
          const hasErrors = restoreError || sweepError;
          const message = hasErrors
            ? `Recovered ${this.formatSats(recovered)} from ${this.formatMintUrl(mint.url)} (some keysets unavailable)`
            : `Recovered ${this.formatSats(recovered)} from ${this.formatMintUrl(mint.url)}!`;
          showNotification(message, 'success');
        } else if (restoreError || sweepError) {
          // No recovery and there were errors
          const errorMsg = restoreError?.message || sweepError?.message || 'Unknown error';
          showNotification(`Recovery scan completed with issues. No funds recovered. ${errorMsg}`, 'warning');
        } else {
          // No recovery but no errors
          showNotification(`Scan complete. No additional funds found on ${this.formatMintUrl(mint.url)}.`, 'info');
        }
        
      } catch (error) {
        console.error('Recovery failed:', error);
        showNotification(`Recovery failed: ${error.message}`, 'error');
      } finally {
        // Clear recovering flag
        mint.recovering = false;
      }
    }
  }
};
</script>