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

      <!-- Connect Button -->
      <div v-if="!isConnected" class="bg-white rounded-lg shadow-sm p-6 mb-6 text-center">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">System Wallet Connection</h2>
        <p class="text-gray-600 mb-6">Connect to your system wallet to enable lightning payments</p>
        
        <button
          @click="connect"
          :disabled="isConnecting"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          <span v-if="isConnecting" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </span>
          <span v-else>Connect to System Wallet</span>
        </button>
        
        <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-700">{{ error }}</p>
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
            <div class="flex items-center justify-between">
              <p class="text-sm text-gray-500">Balance</p>
              <button
                @click="getBalance"
                :disabled="isLoadingBalance"
                class="text-blue-600 hover:text-blue-800 p-1"
                title="Refresh balance"
              >
                <svg class="w-4 h-4" :class="{ 'animate-spin': isLoadingBalance }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </button>
            </div>
            <p v-if="balance" class="font-medium text-green-600">{{ formatSats(balance.balance) }} sats</p>
            <p v-else-if="isLoadingBalance" class="text-gray-500">Loading...</p>
            <p v-else class="text-gray-500">Click refresh to load balance</p>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Connection String</p>
            <div class="flex items-center space-x-2">
              <p class="font-mono text-xs text-gray-700 break-all flex-1">{{ connectedWallet.connectionString }}</p>
              <button
                @click="copyConnectionString"
                class="text-blue-600 hover:text-blue-800 p-1"
                title="Copy connection string"
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

      <!-- Get Token from System Wallet -->
      <div v-if="isConnected" class="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Get Token from System Wallet</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Amount (sats)
          </label>
          <input
            v-model.number="cashuAmount"
            type="number"
            min="1"
            placeholder="1000"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          @click="getTokenFromSystemWallet"
          :disabled="!cashuAmount || isGeneratingToken"
          class="w-full bg-orange-600 text-white py-2 px-4 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-orange-700 transition-colors mb-4"
        >
          <span v-if="isGeneratingToken" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Getting Token...
          </span>
          <span v-else>Get Token from Wallet</span>
        </button>

        <!-- Token Display with QR Code -->
        <div v-if="generatedToken" class="mt-4">
          <div class="bg-gray-50 rounded-lg p-4 text-center">
            <h3 class="text-md font-semibold text-gray-900 mb-3">Cashu Token from System Wallet</h3>
            
            <!-- QR Code -->
            <div class="flex justify-center mb-4">
              <div class="p-4 border-4 border-orange-500 rounded-2xl bg-white shadow-lg">
                <QRCodeVue
                  :value="generatedToken"
                  :size="200"
                  level="M"
                  render-as="svg"
                />
              </div>
            </div>
            
            <!-- Token String -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Token String</label>
              <div class="flex items-center space-x-2">
                <textarea
                  :value="generatedToken"
                  readonly
                  rows="3"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                ></textarea>
                <button
                  @click="copyToken"
                  class="text-blue-600 hover:text-blue-800 p-2"
                  title="Copy token"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <p class="text-sm text-gray-600">
              Share this QR code or token string to receive {{ formatSats(cashuAmount) }} sats
            </p>
          </div>
        </div>

        <!-- Token Error Display -->
        <div v-if="tokenError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex">
            <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Token Generation Error</h3>
              <p class="text-sm text-red-700 mt-1">{{ tokenError }}</p>
            </div>
          </div>
        </div>
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
import QRCodeVue from 'qrcode.vue'
import { createPaymentRequest } from '../utils/cashuUtils.js'
import { PaymentRequest as CashuPaymentRequest } from '@cashu/cashu-ts'
import { firstValueFrom } from 'rxjs'

export default {
  name: 'CashuWalletConnectView',
  components: {
    QRCodeVue
  },
  setup() {
    const walletServiceUrl = ref('http://localhost:3737')
    const isConnected = ref(false)
    const isConnecting = ref(false)
    const isTestingPayment = ref(false)
    const connectedWallet = ref(null)
    const testAmount = ref(1000)
    const error = ref('')
    const balance = ref(null)
    const isLoadingBalance = ref(false)
    
    // Cashu token generation
    const cashuAmount = ref(21)
    const generatedToken = ref('')
    const isGeneratingToken = ref(false)
    const tokenError = ref('')
    
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
        
        // For the new polling API, we might get different response format
        // Set default values if not provided
        walletServiceInfo.value = {
          relays: data.relays || ['ws://localhost:4869'],
          supported_commands: data.supported_commands || ['pay_invoice', 'get_balance', 'make_invoice', 'get_info']
        }
        
        // Pre-select common commands
        selectedCommands.value = walletServiceInfo.value.supported_commands.filter(cmd =>
          ['pay_invoice', 'get_balance', 'make_invoice'].includes(cmd)
        )
        
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

    const pollForConnectionString = async (requestId, maxAttempts = 30) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          console.log(`Poll attempt ${attempt + 1}/${maxAttempts}...`)
          const response = await fetch(`${walletServiceUrl.value}/poll/${requestId}`)
          
          if (!response.ok) {
            throw new Error(`Poll failed with status ${response.status}`)
          }
          
          const data = await response.json()
          console.log('Poll response:', data)
          
          switch (data.status) {
            case 'approved':
              if (data.nwc_uri) {
                console.log('🎉 Connection approved!')
                return data.nwc_uri
              } else {
                throw new Error('Connection approved but NWC URI not available')
              }
            case 'rejected':
              throw new Error('Connection rejected by user')
            case 'pending':
              console.log('Status: pending (waiting for user approval)')
              break
            case 'not_found':
              throw new Error('Connection request not found or expired')
            default:
              console.log(`Unknown status: ${data.status}`)
          }
          
          // Wait 2 seconds before next poll (matching shell script)
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (err) {
          if (err.message.includes('rejected') || err.message.includes('not found') || err.message.includes('not available')) {
            throw err // Don't retry these errors
          }
          console.warn(`Poll attempt ${attempt + 1} failed:`, err)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      throw new Error('Timeout: Connection was not approved within 60 seconds')
    }

    const connect = async () => {
      isConnecting.value = true
      error.value = ''

      try {
        // Step 1: Send empty GET request to get request_id
        console.log('Step 1 - Requesting wallet connection...')
        const response = await fetch(walletServiceUrl.value, {
          method: 'GET'
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        console.log('Step 2 - Got request ID:', result)
        
        if (!result.request_id) {
          throw new Error('No request_id received from wallet service')
        }
        
        // Step 2: Poll for NWC URI
        console.log('Step 3 - Polling for NWC URI...')
        const nwcUri = await pollForConnectionString(result.request_id)
        console.log('Step 4 - Got NWC URI:', nwcUri)
        
        // Step 3: Create WalletConnect from NWC URI
        WalletConnect.pool = globalPool
        walletConnect = WalletConnect.fromConnectURI(nwcUri, {
          relay: ["ws://localhost:4869"],
          pool: globalPool
        })

        // try {
        //   const info = await walletConnect.getInfo();
        //   console.warn("wallet info", info)
        // } catch (infoErr) {
        //   console.warn("Failed to get wallet info, but continuing:", infoErr)
        // }
        
        // Get public key for display
        publicKey = await walletConnect.signer.getPublicKey()
        
        isConnected.value = true
        connectedWallet.value = {
          name: 'System Wallet',
          publicKey: publicKey,
          connectionString: nwcUri,
          commands: ['pay_invoice', 'get_balance', 'make_invoice', 'get_info'],
          budget: 0,
          walletConnect: walletConnect
        }

        // Store connection for persistence
        localStorage.setItem('wallet_auth', JSON.stringify({
          connectionString: nwcUri,
          publicKey: publicKey,
          serviceUrl: walletServiceUrl.value,
          commands: ['pay_invoice', 'get_balance', 'make_invoice', 'get_info'],
          budget: 0
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

    const getBalance = async () => {
      if (!walletConnect) {
        error.value = 'No wallet connected'
        return
      }

      isLoadingBalance.value = true
      error.value = ''

      try {
        console.log('Fetching wallet balance...')
        const balanceResult = await walletConnect.getBalance()
        console.log('Balance result:', balanceResult)
        
        balance.value = balanceResult
        
      } catch (err) {
        console.error('Failed to get balance:', err)
        error.value = `Failed to get balance: ${err.message}`
      } finally {
        isLoadingBalance.value = false
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

    const getTokenFromSystemWallet = async () => {
      if (!walletConnect || !cashuAmount.value) {
        tokenError.value = 'No wallet connected or invalid amount'
        return
      }

      isGeneratingToken.value = true
      tokenError.value = ''
      generatedToken.value = ''

      try {
        console.log(`Getting cashu token from system wallet for ${cashuAmount.value} sats...`)
        
        // Create a simple payment request without transport (wallet doesn't support nostr transport)
        const requestId = 'token_request_' + Date.now()
        
        // Create a simple cashu payment request without transport
        const request = new CashuPaymentRequest(
          [], // Empty transport array - no nostr transport
          requestId,
          cashuAmount.value,
          'sat',
          [], // Use default mints
          `Token request for ${cashuAmount.value} sats`,
          false // Not single use
        )
        
        const paymentRequest = request.toEncodedRequest()
        
        console.log('Created payment request:', paymentRequest)
        
        // Use the wallet's pay_cashu_request method to get a token
        const responseObservable = walletConnect.request({
          method: 'pay_cashu_request',
          params: {
            payment_request: paymentRequest,
            amount: cashuAmount.value
          }
        })
        
        console.log('Response observable:', responseObservable)
        
        // Convert Observable to Promise and get the actual response
        const response = await firstValueFrom(responseObservable)
        
        console.log('Wallet response:', response)
        console.log('Response type:', typeof response)
        console.log('Response keys:', Object.keys(response || {}))
        
        // Extract the token from the response
        if (response && response.result && response.result.token) {
          generatedToken.value = response.result.token
          console.log('✅ Cashu token received from system wallet successfully')
          console.log('Token preview:', response.result.token.substring(0, 50) + '...')
        } else if (response && response.token) {
          generatedToken.value = response.token
          console.log('✅ Cashu token received from system wallet successfully')
          console.log('Token preview:', response.token.substring(0, 50) + '...')
        } else {
          console.error('Unexpected response format:', response)
          throw new Error(`No token found in wallet response. Response: ${JSON.stringify(response, null, 2)}`)
        }
        
      } catch (err) {
        console.error('Token generation failed:', err)
        tokenError.value = `Failed to get token from wallet: ${err.message}`
      } finally {
        isGeneratingToken.value = false
      }
    }

    const copyToken = async () => {
      if (!generatedToken.value) return
      
      try {
        await navigator.clipboard.writeText(generatedToken.value)
        console.log('Token copied to clipboard')
      } catch (err) {
        console.error('Failed to copy token:', err)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = generatedToken.value
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
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

    const copyConnectionString = async () => {
      if (connectedWallet.value?.connectionString) {
        try {
          await navigator.clipboard.writeText(connectedWallet.value.connectionString)
          alert('Connection string copied to clipboard!')
        } catch (err) {
          console.error('Failed to copy to clipboard:', err)
        }
      }
    }

    // Check for existing connection on mount
    onMounted(async () => {
      // Check for existing connection
      const savedAuth = localStorage.getItem('wallet_auth')
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth)
          
          // Handle both old and new format
          if (authData.connectionString) {
            // New format with connection string
            WalletConnect.pool = globalPool
            walletConnect = WalletConnect.fromConnectURI(authData.connectionString, {
              pool: globalPool
            })
            
            publicKey = authData.publicKey
            walletServiceUrl.value = authData.serviceUrl
            selectedCommands.value = authData.commands
            budget.value = authData.budget
            
            isConnected.value = true
            connectedWallet.value = {
              name: 'System Wallet',
              publicKey: publicKey,
              connectionString: authData.connectionString,
              commands: authData.commands,
              budget: authData.budget,
              walletConnect: walletConnect
            }
          } else {
            // Old format - clear it
            localStorage.removeItem('wallet_auth')
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
      isConnected,
      isConnecting,
      isTestingPayment,
      connectedWallet,
      testAmount,
      error,
      balance,
      isLoadingBalance,
      cashuAmount,
      generatedToken,
      isGeneratingToken,
      tokenError,
      connect,
      disconnect,
      testPayment,
      getBalance,
      getTokenFromSystemWallet,
      copyToken,
      formatSats,
      copyConnectionString
    }
  }
}
</script>

<style scoped>
/* Add any custom styles here */
</style>