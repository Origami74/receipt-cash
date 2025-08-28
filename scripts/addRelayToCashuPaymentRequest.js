#!/usr/bin/env node

/**
 * Script to add a relay to a Cashu payment request's nprofile
 * 
 * Usage: node scripts/addRelayToCashuPaymentRequest.js <payment_request> <relay_url>
 * 
 * Example:
 * node scripts/addRelayToCashuPaymentRequest.js "creqA..." "wss://relay.example.com"
 */

import { PaymentRequest } from '@cashu/cashu-ts';
import { nip19 } from 'nostr-tools';

/**
 * Add a relay to the nprofile in a Cashu payment request's nostr transport
 * @param {String} paymentRequestStr - The encoded Cashu payment request
 * @param {String} newRelay - The relay URL to add
 * @returns {String} The re-encoded payment request with the added relay
 */
function addRelayToPaymentRequest(paymentRequestStr, newRelay) {
  try {
    console.log('🔍 Decoding payment request...');
    
    // 1. Decode the payment request
    const paymentRequest = PaymentRequest.fromEncodedRequest(paymentRequestStr);
    
    console.log('📋 Payment Request Details:');
    console.log(`  ID: ${paymentRequest.id}`);
    console.log(`  Amount: ${paymentRequest.amount} ${paymentRequest.unit}`);
    console.log(`  Mints: ${paymentRequest.mints?.join(', ') || 'Any'}`);
    console.log(`  Transport methods: ${paymentRequest.transport?.length || 0}`);
    
    // 2. Find the nostr transport
    const nostrTransport = paymentRequest.getTransport('nostr');
    
    if (!nostrTransport) {
      throw new Error('❌ No nostr transport found in payment request');
    }
    
    console.log(`🔗 Found nostr transport: ${nostrTransport.target.slice(0, 20)}...`);
    
    // 3. Decode the nprofile
    const decoded = nip19.decode(nostrTransport.target);
    
    if (decoded.type !== 'nprofile') {
      throw new Error(`❌ Expected nprofile but got ${decoded.type}`);
    }
    
    const { pubkey, relays } = decoded.data;
    console.log(`👤 Pubkey: ${pubkey.slice(0, 16)}...`);
    console.log(`📡 Current relays: ${relays?.length || 0}`);
    
    if (relays) {
      relays.forEach((relay, index) => {
        console.log(`  ${index + 1}. ${relay}`);
      });
    }
    
    // 4. Add the new relay if it's not already present
    const updatedRelays = relays ? [...relays] : [];
    
    if (updatedRelays.includes(newRelay)) {
      console.log(`⚠️  Relay ${newRelay} is already present`);
    } else {
      updatedRelays.push(newRelay);
      console.log(`✅ Adding relay: ${newRelay}`);
    }
    
    // 5. Create new nprofile with updated relays
    const newNprofile = nip19.nprofileEncode({
      pubkey: pubkey,
      relays: updatedRelays
    });
    
    console.log(`🆕 New nprofile: ${newNprofile.slice(0, 20)}...`);
    console.log(`📡 Updated relays: ${updatedRelays.length}`);
    updatedRelays.forEach((relay, index) => {
      console.log(`  ${index + 1}. ${relay}`);
    });
    
    // 6. Update the transport target
    nostrTransport.target = newNprofile;
    
    // 7. Re-encode the payment request
    const encodedRequest = paymentRequest.toEncodedRequest();
    
    console.log('✅ Payment request updated successfully!');
    console.log(`📤 New payment request: ${encodedRequest.slice(0, 50)}...`);
    
    return encodedRequest;
    
  } catch (error) {
    console.error('❌ Error processing payment request:', error.message);
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, paymentRequest, newRelay] = process.argv;
  
  if (!paymentRequest || !newRelay) {
    console.error('❌ Usage: node addRelayToCashuPaymentRequest.js <payment_request> <relay_url>');
    console.error('');
    console.error('Example:');
    console.error('  node addRelayToCashuPaymentRequest.js "creqA..." "wss://relay.example.com"');
    process.exit(1);
  }
  
  if (!newRelay.startsWith('wss://') && !newRelay.startsWith('ws://')) {
    console.error('❌ Relay URL must start with wss:// or ws://');
    process.exit(1);
  }
  
  try {
    console.log('🚀 Starting relay addition process...');
    console.log('');
    
    const result = addRelayToPaymentRequest(paymentRequest, newRelay);
    
    console.log('');
    console.log('🎉 SUCCESS! Copy the updated payment request below:');
    console.log('');
    console.log(result);
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('💥 FAILED:', error.message);
    process.exit(1);
  }
}

export { addRelayToPaymentRequest };