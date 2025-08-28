import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import debugLogger from './services/debugService';
import { receiptLifecycleManager } from './services/new/receiptLifecycleManager';
import { incomingPaymentSplitter } from './services/new/incomingPaymentSplitter';
import { devPayoutManager } from './services/new/payout/devPayoutManager';
import { cashuDmSender } from './services/new/payout/cashuDmSender';
import { payerPayoutManager } from './services/new/payout/payerPayoutManager';

// Initialize services
receiptLifecycleManager.start()

incomingPaymentSplitter.start()

devPayoutManager.start()
payerPayoutManager.start()

cashuDmSender.start()


// Initialize debug logging if it was previously enabled
if (localStorage.getItem('debug-logging-enabled') === 'true') {
  debugLogger.startCapturingLogs();
  console.info('Debug logging initialized on startup');
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app'); 