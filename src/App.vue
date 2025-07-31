<template>
  <div class="h-full flex flex-col">
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
import ExperimentalBanner from './components/ExperimentalBanner.vue';
import ReportModal from './components/ReportModal.vue';
import BottomTabBar from './components/BottomTabBar.vue';
import SettingsMenu from './components/SettingsMenu.vue';
import mintQuoteRecoveryService from './services/flows/outgoing/mintQuoteRecovery';
import debugLogger from './services/debugService';
import { checkForVersionUpdate } from './services/updaterService';

export default {
  name: 'App',
  components: {
    Notification,
    ExperimentalBanner,
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