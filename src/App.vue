<template>
  <div class="h-full flex flex-col">
    <!-- Experimental warning banner -->
    <ExperimentalModal />
    
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
    
    <!-- Main content area with conditional bottom padding for tab bar -->
    <div class="flex-1 overflow-auto" :class="{ 'pb-20': shouldShowTabBar }">
      <router-view @toggle-settings="handleToggleSettings" />
    </div>
    
    <!-- Global Settings Menu -->
    <SettingsMenu
      :is-open="isSettingsOpen"
      @close="isSettingsOpen = false"
    />
    
    <!-- Bottom Tab Bar - hidden on home/camera view -->
    <BottomTabBar
      v-if="shouldShowTabBar"
      @toggle-monitor="handleToggleMonitor"
      @toggle-settings="handleToggleSettings"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { showNotification, useNotification } from './services/notificationService';
import Notification from './components/Notification.vue';
import ExperimentalModal from './components/ExperimentalModal.vue';
import ReportModal from './components/ReportModal.vue';
import BottomTabBar from './components/BottomTabBar.vue';
import SettingsMenu from './components/SettingsMenu.vue';
import mintQuoteRecoveryService from './services/flows/outgoing/mintQuoteRecovery';
import debugLogger from './services/debugService';
import { checkForVersionUpdate } from './services/updaterService';
import { v1DevProofsMigration } from './services/migrations/v1DevProofsMigration';

export default {
  name: 'App',
  components: {
    Notification,
    ExperimentalModal,
    ReportModal,
    BottomTabBar,
    SettingsMenu
  },
  setup() {
    const route = useRoute();
    const { notification, clearNotification } = useNotification();
    const showReportModal = ref(false);
    const currentErrorMessage = ref('');
    const isSettingsOpen = ref(false);
    
    // Hide tab bar on home/camera view
    const shouldShowTabBar = computed(() => {
      return route.path !== '/';
    });
    
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
      
      // Run v1 developer proofs migration
      try {
        console.log('🔄 Running v1 developer proofs migration...');
        const migrationResult = await v1DevProofsMigration.migrate();
        
        if (migrationResult.success) {
          if (migrationResult.alreadyMigrated) {
            console.log('✅ V1 dev proofs migration already completed');
          } else if (migrationResult.processed > 0) {
            console.log(`✅ V1 dev proofs migration complete: ${migrationResult.sent} sent, ${migrationResult.failed} failed`);
            if (migrationResult.sent > 0) {
              showNotification(`Sent ${migrationResult.sent} stranded developer payment(s) to developer`, 'success');
            }
          } else {
            console.log('✅ No v1 developer proofs to migrate');
          }
        } else {
          console.error('❌ V1 dev proofs migration failed:', migrationResult.error);
        }
      } catch (migrationError) {
        console.error('❌ Error during v1 dev proofs migration:', migrationError);
      }
      
      // Listen for report-logs events from the SettingsMenu
      window.addEventListener('report-logs', (event) => {
        openReportModal('User-initiated log report');
      });
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
    
    // Handle monitor toggle from bottom tab bar
    const handleToggleMonitor = () => {
      console.log('Monitor toggle requested');
      // TODO: Implement monitor functionality
    };
    
    // Handle settings toggle from bottom tab bar
    const handleToggleSettings = () => {
      isSettingsOpen.value = !isSettingsOpen.value;
    };
    
    return {
      notification,
      clearNotification,
      showReportModal,
      currentErrorMessage,
      openReportModal,
      handleReportSubmitted,
      shouldShowTabBar,
      handleToggleMonitor,
      handleToggleSettings,
      isSettingsOpen
    };
  }
}
</script>

<style>
/* Any app-wide styles go here */
</style>