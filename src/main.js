import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import nostrService from './services/flows/shared/nostr';
import receiptMonitoringService from './services/flows/incoming/receiptMonitoringService';
import proofCleanup from './services/flows/shared/proofCleanup';
import debugLogger from './utils/debugLogger';

// Initialize Nostr
nostrService.connect();
receiptMonitoringService.initialize();

// Start cleanup services
proofCleanup.start();


// Initialize debug logging if it was previously enabled
if (localStorage.getItem('debug-logging-enabled') === 'true') {
  debugLogger.startCapturingLogs();
  console.info('Debug logging initialized on startup');
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app'); 