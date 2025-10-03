<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-md mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <button
            @click="$router.back()"
            class="p-2 rounded-lg bg-white shadow-sm"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h1 class="text-xl font-bold text-gray-900">Wallet Connect</h1>
          <div class="w-9"></div>
        </div>
        <p class="text-gray-600 text-sm">
          Connect to your system wallet service to enable lightning payments
        </p>
      </div>

      <!-- Connection Status -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div :class="[
              'w-3 h-3 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-gray-300'
            ]"></div>
            <div>
              <p class="font-medium text-gray-900">
                {{ isConnected ? 'Connected' : 'Not Connected' }}
              </p>
              <p class="text-sm text-gray-500" v-if="connectedWallet">
                {{ connectedWallet.name }}
              </p>
            </div>
          </div>
          <button
            v-if="isConnected"
            @click="disconnect"
            class="text-red-600 text-sm font-medium"
          >
            Disconnect
          </button>
        </div>
      </div>

      <!-- Wallet Service Status -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-gray-900">Local Wallet Service</h2>
          <button
            @click="getWalletServiceInfo"
            :disabled="isLoadingServiceInfo"
            class="text-blue-600 hover:text-blue-800 p-1"
            title="Refresh wallet service info"
          >
            <svg class="w-5 h-5" :class="{ 'animate-spin': isLoadingServiceInfo }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>

        <!-- No Wallet Warning -->
        <div v-if="!walletServiceInfo && !isLoadingServiceInfo" class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div class="flex">
            <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">No System Wallet Found</h3>
              <p class="text-sm text-yellow-700 mt-1">
                No system wallet detected Make sure your wallet is running.
              </p>
            </div>
          </div>
        </div>

        <!-- Wallet Service Info -->
        <div v-if="walletServiceInfo" class="space-y-3">
          <div>
            <p class="text-sm text-gray-500">Status</p>
            <p class="font-medium text-green-600">System wallet available</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Relays</p>
            <div class="text-xs text-gray-700">
              <div v-for="relay in walletServiceInfo.relays" :key="relay" class="truncate">
                {{ relay }}
              </div>
            </div>
          </div>
          <div v-if="walletServiceInfo.supported_commands?.length">
            <p class="text-sm text-gray-500">Supported Commands</p>
            <div class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="command in walletServiceInfo.supported_commands"
                :key="command"
                class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
              >
                {{ command }}
              </span>
            </div>
          </div>
        </div>

        <!-- Advanced Settings (Collapsible) -->
        <div class="mt-4 pt-3 border-t border-gray-200">
          <button
            @click="showAdvancedSettings = !showAdvancedSettings"
            class="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            <svg class="w-4 h-4 mr-1" :class="{ 'transform rotate-90': showAdvancedSettings }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            Advanced Settings
          </button>
          
          <div v-if="showAdvancedSettings" class="mt-3">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Wallet Service URL
            </label>
            <input
              v-model="walletServiceUrl"
              type="text"
              placeholder="http://localhost:3737"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <p class="text-gray-500 text-xs mt-1">
              URL of your local wallet service
            </p>
          </div>
        </div>
      </div>

      <!-- Connection Form -->
      <div v-if="!isConnected && walletServiceInfo" class="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Create Wallet Connection</h2>
        
        <!-- Commands Selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Requested Commands
          </label>
          <div class="space-y-2">
            <label v-for="command in walletServiceInfo.supported_commands" :key="command" class="flex items-center">
              <input
                type="checkbox"
                :value="command"
                v-model="selectedCommands"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="ml-2 text-sm text-gray-700">{{ command }}</span>
            </label>
          </div>
        </div>

        <!-- Budget and Expiry -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Budget (sats)
            </label>
            <input
              v-model.number="budget"
              type="number"
              min="0"
              placeholder="10000"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Expiry (days)
            </label>
            <input
              v-model.number="expiryDays"
              type="number"
              min="1"
              placeholder="30"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Connect Button -->
        <button
          @click="connect"
          :disabled="selectedCommands.length === 0 || isConnecting"
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          <span v-if="isConnecting" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </span>
          <span v-else>Create Wallet Auth</span>
        </button>
      </div>

      <!-- Connected Wallet Info -->
      <div v-if="isConnected && connectedWallet" class="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Connected Wallet</h2>
        
        <div class="space-y-3">
          <div>
            <p class="text-sm text-gray-500">Public Key</p>
            <p class="font-mono text-xs text-gray-700 break-all">{{ connectedWallet.publicKey }}</p>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Commands</p>
            <div class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="command in connectedWallet.commands"
                :key="command"
                class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
              >
                {{ command }}
              </span>
            </div>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Budget</p>
            <p class="font-medium">{{ formatSats(connectedWallet.budget) }} sats</p>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Wallet Auth URI</p>
            <div class="flex items-center space-x-2">
              <p class="font-mono text-xs text-gray-700 break-all flex-1">{{ connectedWallet.authUri }}</p>
              <button
                @click="copyWalletAuthUri"
                class="text-blue-600 hover:text-blue-800 p-1"
                title="Copy wallet auth URI"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Test Payment -->
      <div v-if="isConnected" class="bg-white rounded-lg shadow-sm p-4">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Test Payment</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Amount (sats)
          </label>
          <input
            v-model.number="testAmount"
            type="number"
            min="1"
            placeholder="1000"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          @click="testPayment"
          :disabled="!testAmount || isTestingPayment"
          class="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
        >
          <span v-if="isTestingPayment">Testing...</span>
          <span v-else>Test Payment</span>
        </button>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
          </svg>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error</h3>
            <p class="text-sm text-red-700 mt-1">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { WalletConnect } from 'applesauce-wallet-connect'
import { globalPool } from '../services/nostr/applesauce.js'

export default {
  name: 'CashuWalletConnectView',
  setup() {
    const walletServiceUrl = ref('http://localhost:3737')
    const walletServiceInfo = ref(null)
    const isLoadingServiceInfo = ref(false)
    const isConnected = ref(false)
    const isConnecting = ref(false)
    const isTestingPayment = ref(false)
    const connectedWallet = ref(null)
    const selectedCommands = ref([])
    const budget = ref(10000)
    const expiryDays = ref(30)
    const testAmount = ref(1000)
    const error = ref('')
    const showAdvancedSettings = ref(false)
    
    let privateKey = null
    let publicKey = null
    let walletAuthUri = null
    let walletConnect = null

    const getWalletServiceInfo = async () => {
      if (!walletServiceUrl.value) return

      isLoadingServiceInfo.value = true
      error.value = ''
      walletServiceInfo.value = null

      try {
        const response = await fetch(walletServiceUrl.value, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        
        // Validate response format
        if (!data.relays || !data.supported_commands) {
          throw new Error('Invalid response format from wallet service')
        }
        
        walletServiceInfo.value = data
        
        // Pre-select common commands
        if (data.supported_commands) {
          selectedCommands.value = data.supported_commands.filter(cmd =>
            ['pay_invoice', 'get_balance', 'make_invoice'].includes(cmd)
          )
        }
        
      } catch (err) {
        console.error('Failed to get wallet service info:', err)
        walletServiceInfo.value = null
        // Don't show error in UI for initial load, just log it
        if (!isLoadingServiceInfo.value) {
          error.value = `Failed to connect to wallet service: ${err.message}`
        }
      } finally {
        isLoadingServiceInfo.value = false
      }
    }

    // const generateWalletAuth = () => {
    //   // Generate new keypair
    //   privateKey = generateSecretKey()
    //   publicKey = getPublicKey(privateKey)
      
    //   // Generate a random secret for this connection (NIP-67 requirement)
    //   const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    //     .map(b => b.toString(16).padStart(2, '0'))
    //     .join('')
      
    //   // Create wallet auth URI following NIP-67 spec (no encoding)
    //   const relayParams = walletServiceInfo.value.relays.map(relay => `relay=${relay}`).join('&')
    //   const requiredCommands = selectedCommands.value.join(' ')
    //   const budgetParam = budget.value ? `budget=${budget.value}/daily` : ''
      
    //   walletAuthUri = `nostr+walletauth://${publicKey}?` +
    //     `${relayParams}&` +
    //     `secret=${secret}&` +
    //     `required_commands=${requiredCommands}` +
    //     (budgetParam ? `&${budgetParam}` : '')
      
    //   // Store the secret for later validation
    //   localStorage.setItem('wallet_auth_secret', secret)
      
    //   return walletAuthUri
    // }

    const connect = async () => {
      if (selectedCommands.value.length === 0) {
        error.value = 'Please select at least one command'
        return
      }

      isConnecting.value = true
      error.value = ''

      try {
        // Step 1: Create a new WalletConnect client with random secret key
        privateKey = generateSecretKey()

        WalletConnect.pool = globalPool;
        walletConnect = new WalletConnect(
          { 
            secret: privateKey,
            service: publicKey,
            globalPool,
            relays: walletServiceInfo.value.relays
          
          }
        )

      
        // Step 2: Get the auth URI
        const authUri = walletConnect.getAuthURI()
        console.log('Step 1 - Generated auth URI:', authUri)
        
        // Step 3: Send auth string to :3737
        const response = await fetch(walletServiceUrl.value, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nwa: authUri
          })
        })

        if (!response.ok) {
          console.error("Error sending authUri:", await response.text())
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('Step 2 - Sent to wallet service:', result)
        
        // Step 4: Wait for the service to respond
        console.log('Step 3 - Waiting for wallet service to respond...')
        await walletConnect.waitForService()
        console.log('Step 4 - Connected to wallet service!')
        
        // Get public key for display
        publicKey = await walletConnect.signer.getPublicKey()
        
        isConnected.value = true
        connectedWallet.value = {
          name: 'Local Wallet Service',
          publicKey: publicKey,
          authUri: authUri,
          commands: selectedCommands.value,
          budget: budget.value,
          walletConnect: walletConnect
        }

        // Store connection for persistence
        localStorage.setItem('wallet_auth', JSON.stringify({
          privateKey: Array.from(privateKey),
          publicKey: publicKey,
          authUri: authUri,
          serviceUrl: walletServiceUrl.value,
          commands: selectedCommands.value,
          budget: budget.value
        }))
        
        console.log('Wallet connect established successfully!')
        
      } catch (err) {
        console.error('Connection failed:', err)
        error.value = `Connection failed: ${err.message}`
        // Clean up on error
        if (walletConnect) {
          walletConnect = null
        }
      } finally {
        isConnecting.value = false
      }
    }

    const disconnect = () => {
      // Clean up wallet connect instance
      if (walletConnect) {
        try {
          walletConnect.disconnect()
        } catch (err) {
          console.error('Error disconnecting wallet:', err)
        }
        walletConnect = null
      }
      
      isConnected.value = false
      connectedWallet.value = null
      privateKey = null
      publicKey = null
      walletAuthUri = null
      
      localStorage.removeItem('wallet_auth')
      localStorage.removeItem('wallet_auth_secret')
    }

    const testPayment = async () => {
      if (!connectedWallet.value || !testAmount.value || !walletConnect) return

      isTestingPayment.value = true
      error.value = ''

      try {
        // Use applesauce WalletConnect to make a test payment
        console.log('Making test payment with applesauce NWC, amount:', testAmount.value)
        
        // First try to get wallet info
        const info = await walletConnect.getInfo()
        console.log('Wallet info:', info)
        
        // Try to get balance
        const balance = await walletConnect.getBalance()
        console.log('Wallet balance:', balance)
        
        alert(`Test successful! Wallet balance: ${balance} sats. Ready to make payments.`)
        
      } catch (err) {
        console.error('Payment test failed:', err)
        error.value = `Payment test failed: ${err.message}`
      } finally {
        isTestingPayment.value = false
      }
    }

    const formatSats = (sats) => {
      return new Intl.NumberFormat().format(sats)
    }

    const copyWalletAuthUri = async () => {
      if (walletAuthUri) {
        try {
          await navigator.clipboard.writeText(walletAuthUri)
          alert('Wallet Auth URI copied to clipboard!')
        } catch (err) {
          console.error('Failed to copy to clipboard:', err)
        }
      }
    }

    // Check for existing connection on mount and load wallet service info
    onMounted(async () => {
      // Load wallet service info immediately
      await getWalletServiceInfo()
      
      // Check for existing connection
      const savedAuth = localStorage.getItem('wallet_auth')
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth)
          privateKey = new Uint8Array(authData.privateKey)
          publicKey = authData.publicKey
          walletAuthUri = authData.authUri
          walletServiceUrl.value = authData.serviceUrl
          selectedCommands.value = authData.commands
          budget.value = authData.budget
          
          // Reinitialize applesauce WalletConnect
          walletConnect = new WalletConnect(walletAuthUri)
          
          isConnected.value = true
          connectedWallet.value = {
            name: 'Local Wallet Service',
            publicKey: publicKey,
            authUri: walletAuthUri,
            commands: authData.commands,
            budget: authData.budget,
            walletConnect: walletConnect
          }
        } catch (err) {
          console.error('Failed to restore saved auth:', err)
          localStorage.removeItem('wallet_auth')
          localStorage.removeItem('wallet_auth_secret')
        }
      }
    })

    return {
      walletServiceUrl,
      walletServiceInfo,
      isLoadingServiceInfo,
      isConnected,
      isConnecting,
      isTestingPayment,
      connectedWallet,
      selectedCommands,
      budget,
      expiryDays,
      testAmount,
      error,
      showAdvancedSettings,
      getWalletServiceInfo,
      connect,
      disconnect,
      testPayment,
      formatSats,
      copyWalletAuthUri
    }
  }
}
</script>

<style scoped>
/* Add any custom styles here */
</style>