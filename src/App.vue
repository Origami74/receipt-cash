<template>
  <div class="h-full flex flex-col">
    <!-- Welcome Onboarding (shows first, blocks everything) -->
    <WelcomeOnboarding
      v-if="showWelcomeOnboarding"
      @complete="handleWelcomeComplete"
      @skip="handleWelcomeComplete"
    />
    
    <!-- Tab blocked overlay -->
    <TabBlockedOverlay v-if="isTabBlocked" />
    
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
    
    <!-- Bottom Tab Bar - hidden on home/camera view and during onboarding -->
    <BottomTabBar
      v-if="shouldShowTabBar && !showWelcomeOnboarding"
      @toggle-monitor="handleToggleMonitor"
      @toggle-settings="handleToggleSettings"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { showNotification, useNotification } from './services/notificationService';
import { onboardingService } from './services/onboardingService';
import Notification from './components/Notification.vue';
import ExperimentalModal from './components/ExperimentalModal.vue';
import ReportModal from './components/ReportModal.vue';
import BottomTabBar from './components/BottomTabBar.vue';
import SettingsMenu from './components/SettingsMenu.vue';
import TabBlockedOverlay from './components/TabBlockedOverlay.vue';
import WelcomeOnboarding from './components/onboarding/WelcomeOnboarding.vue';
import mintQuoteRecoveryService from './services/flows/outgoing/mintQuoteRecovery';
import debugLogger from './services/debugService';
import { checkForVersionUpdate } from './services/updaterService';
import { tabLockService } from './services/tabLockService';

export default {
  name: 'App',
  components: {
    Notification,
    ExperimentalModal,
    ReportModal,
    BottomTabBar,
    SettingsMenu,
    TabBlockedOverlay,
    WelcomeOnboarding
  },
  setup() {
    const route = useRoute();
    const { notification, clearNotification } = useNotification();
    const showReportModal = ref(false);
    const currentErrorMessage = ref('');
    const isSettingsOpen = ref(false);
    const isTabBlocked = ref(false);
    const showWelcomeOnboarding = ref(false);
    
    // Hide tab bar on home/camera view
    const shouldShowTabBar = computed(() => {
      return route.path !== '/';
    });
    
    // Set up callback for if we get blocked later (can happen if another tab takes over)
    tabLockService.onBlocked(() => {
      isTabBlocked.value = true;
    });
    
    // Handle welcome onboarding completion
    const handleWelcomeComplete = () => {
      showWelcomeOnboarding.value = false;
      showNotification('Welcome to Receipt.Cash! 🎉', 'success');
    };
    
    // Initialize on mount
    onMounted(async () => {
      // Check if we have the lock (should already be acquired in main.js)
      if (!tabLockService.hasLock()) {
        isTabBlocked.value = true;
        return;
      }
      
      // Check if user needs to see welcome screens
      if (!onboardingService.hasSeenWelcome()) {
        showWelcomeOnboarding.value = true;
      }
      
      // Check for version updates
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
      isTabBlocked,
      openReportModal,
      handleReportSubmitted,
      shouldShowTabBar,
      handleToggleMonitor,
      handleToggleSettings,
      isSettingsOpen,
      showWelcomeOnboarding,
      handleWelcomeComplete
    };
  }
}
</script>

<style>
/* Any app-wide styles go here */
</style>