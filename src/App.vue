<template>
  <div class="h-full">
    <!-- Experimental warning banner -->
    <ExperimentalBanner />
    
    <!-- Global notification component -->
    <Notification
      v-if="notification"
      :message="notification.message"
      :type="notification.type"
      @close="clearNotification"
      @report="openReportModal(notification.message)"
    />
    
    <!-- Report modal -->
    <ReportModal
      :is-open="showReportModal"
      :error-message="currentErrorMessage"
      @close="showReportModal = false"
      @submitted="handleReportSubmitted"
    />
    
    <router-view />
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { showNotification, useNotification } from './utils/notification';
import Notification from './components/Notification.vue';
import ExperimentalBanner from './components/ExperimentalBanner.vue';
import ReportModal from './components/ReportModal.vue';
import mintQuoteRecoveryService from './services/flows/outgoing/mintQuoteRecovery';
import debugLogger from './utils/debugLogger';
import { checkForVersionUpdate } from './utils/versionManager';

export default {
  name: 'App',
  components: {
    Notification,
    ExperimentalBanner,
    ReportModal
  },
  setup() {
    const { notification, clearNotification } = useNotification();
    const showReportModal = ref(false);
    const currentErrorMessage = ref('');
    
    // Initialize debug logging by default
    onMounted(async () => {
      // Check for version updates first
      try {
        const updatePerformed = await checkForVersionUpdate();
        if (updatePerformed) {
          // If update was performed, the app will reload
          return;
        }
      } catch (error) {
        console.error('Error checking for version update:', error);
      }
      
      // Enable debug logging by default if not already set
      if (!debugLogger.isCapturingLogsEnabled()) {
        debugLogger.startCapturingLogs();
        console.log('Debug logging enabled by default');
      }
      
      // Listen for report-logs events from the SettingsMenu
      window.addEventListener('report-logs', (event) => {
        openReportModal('User-initiated log report');
      });
      
      // Run recovery service after a short delay to ensure app is fully initialized
      setTimeout(async () => {
        mintQuoteRecoveryService.start();
      }, 1000);
    });
    
    // Open the report modal with the current error message
    const openReportModal = (errorMessage) => {
      currentErrorMessage.value = errorMessage || '';
      showReportModal.value = true;
    };
    
    // Handle successful report submission
    const handleReportSubmitted = () => {
      console.log('Report submitted successfully');
    };
    
    return {
      notification,
      clearNotification,
      showReportModal,
      currentErrorMessage,
      openReportModal,
      handleReportSubmitted
    };
  }
}
</script>

<style>
/* Any app-wide styles go here */
</style>