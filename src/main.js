import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import debugLogger from './services/debugService';
import { tabLockService } from './services/tabLockService';
import { incomingPaymentSplitter } from './services/new/incomingPaymentSplitter';
import { devPayoutManager } from './services/new/payout/devPayoutManager';
import { cashuDmSender } from './services/new/payout/cashuDmSender';
import { payerPayoutManager } from './services/new/payout/payerPayoutManager';
import mintQuoteRecoveryService from './services/flows/outgoing/mintQuoteRecovery';
import lightningMelter from './services/new/payout/lightningMelter';
import { receiptLifecycleManager } from './services/new/receiptLifecycleManager';
import { cocoService } from './services/cocoService';
import { proofSafetyService } from './services/proofSafetyService';
import { migrationService } from './services/migrationService';
import { paymentNotificationService } from './services/paymentNotificationService';

// CRITICAL: Acquire tab lock FIRST before any initialization
// This prevents multiple tabs from running simultaneously
tabLockService.acquireLock().then(lockAcquired => {
  if (!lockAcquired) {
    console.warn('⛔ Tab blocked - another instance is already running');
    // Mount a minimal app that only shows the blocked overlay
    const app = createApp(App);
    app.use(createPinia());
    app.use(router);
    app.mount('#app');
    return; // Stop here, don't initialize any services
  }

  console.log('✅ Tab lock acquired, initializing app...');

  // Initialize debug logging if it was previously enabled
  if (localStorage.getItem('debug-logging-enabled') === 'true') {
    debugLogger.startCapturingLogs();
    console.info('Debug logging initialized on startup');
  }

  // Initialize Coco before starting services
  cocoService.initialize()
  .then(async () => {
    // Migrate existing proofs from old storage
    await migrationService.migrate();
    
    // Recover any pending payouts from previous session
    await proofSafetyService.recoverPendingPayouts();
    
    // Clean up old payouts
    proofSafetyService.cleanupOldPayouts();
    
    // Start all services
    receiptLifecycleManager.start();
    incomingPaymentSplitter.start();
    devPayoutManager.start();
    payerPayoutManager.start();
    cashuDmSender.start();

    // Run recovery services after a short delay
    setTimeout(async () => {
      lightningMelter.start();
    }, 1000);

    setTimeout(async () => {
      mintQuoteRecoveryService.start();
    }, 1000);

    // Mount Vue app
    const app = createApp(App);
    app.use(createPinia());
    app.use(router);
    app.mount('#app');
    
    console.log('✅ App mounted successfully');
    
    })
    .catch(error => {
      console.error('❌ Failed to initialize Coco:', error);
      // Show error UI
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h1>Initialization Error</h1>
          <p>Failed to initialize wallet. Please refresh the page.</p>
          <pre style="text-align: left; background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.message}</pre>
        </div>
      `;
    });
});