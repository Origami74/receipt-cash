<template>
  <div class="h-full flex flex-col">
    <!-- Host Welcome Onboarding (shows first on home page only) -->
    <WelcomeOnboarding
      v-if="showHostWelcome && isHomePage"
      @complete="handleHostWelcomeComplete"
      @skip="handleHostWelcomeComplete"
    />
    
    <!-- Tab blocked overlay -->
    <TabBlockedOverlay v-if="isTabBlocked" />
    
    <!-- Global notification component -->
    <Notification
      v-if="notification"
      :message="notification.message"
      :type="notification.type"
      @close="clearNotification"
      @report="openReportModal(notification.message)"
    />
    
    <!-- PWA update prompt -->
    <UpdatePrompt />

    <!-- Report modal -->
    <ReportModal
      :is-open="showReportModal"
      :error-message="currentErrorMessage"
      @close="showReportModal = false"
      @submitted="handleReportSubmitted"
    />
    
    <!-- Main content area with conditional bottom padding for tab bar -->
    <div class="flex-1 overflow-auto transition-[padding] duration-300" :class="[isHomePage ? '' : 'safe-area-padded', { 'pb-20': shouldShowTabBar && !isTabBarHidden }]">
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
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { showNotification, useNotification } from './services/notificationService';
import { labelConfig } from './config/label';
import { onboardingService } from './services/onboardingService';
import Notification from './components/Notification.vue';
import ReportModal from './components/ReportModal.vue';
import UpdatePrompt from './components/UpdatePrompt.vue';
import { tabBarHidden } from './components/BottomTabBar.vue';
import BottomTabBar from './components/BottomTabBar.vue';
import SettingsMenu from './components/SettingsMenu.vue';
import TabBlockedOverlay from './components/TabBlockedOverlay.vue';
import WelcomeOnboarding from './components/onboarding/WelcomeOnboarding.vue';
import mintQuoteRecoveryService from './services/flows/outgoing/mintQuoteRecovery';
import debugLogger from './services/debugService';
import { globalPool } from './services/nostr/applesauce';
import { checkForVersionUpdate } from './services/updaterService';
import { tabLockService } from './services/tabLockService';

export default {
  name: 'App',
  components: {
    Notification,
    ReportModal,
    UpdatePrompt,
    BottomTabBar,
    SettingsMenu,
    TabBlockedOverlay,
    WelcomeOnboarding
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { notification, clearNotification } = useNotification();
    const showReportModal = ref(false);
    const currentErrorMessage = ref('');
    const isSettingsOpen = ref(false);
    const isTabBlocked = ref(false);
    const showHostWelcome = ref(false);
    let backButtonListener = null;
    let appStateListener = null;
    
    // Check if current route is home page
    const isHomePage = computed(() => {
      return route.path === '/';
    });
    
    // Hide tab bar on home/camera view or during host onboarding
    const shouldShowTabBar = computed(() => {
      // Don't show on home page
      if (route.path === '/') return false;
      // Don't show during host onboarding (only relevant on home page anyway)
      if (showHostWelcome.value && isHomePage.value) return false;
      // Show on all other pages
      return true;
    });
    
    // Set up callback for if we get blocked later (can happen if another tab takes over)
    // Not relevant on native — single instance app
    if (!Capacitor.isNativePlatform()) {
      tabLockService.onBlocked(() => {
        isTabBlocked.value = true;
      });
    }
    
    // Handle host welcome onboarding completion
    const handleHostWelcomeComplete = () => {
      showHostWelcome.value = false;
      onboardingService.completeHostWelcome();
      showNotification(`Welcome to ${labelConfig.appName}! 🎉`, 'success');
    };
    
    // Initialize on mount
    onMounted(async () => {
      // Check if we have the lock (should already be acquired in main.js)
      // Native apps are single-instance, no lock needed
      if (!Capacitor.isNativePlatform() && !tabLockService.hasLock()) {
        isTabBlocked.value = true;
        return;
      }
      
      // Check if user needs to see host welcome screens (only on home page)
      if (!onboardingService.hasSeenHostWelcome() && isHomePage.value) {
        showHostWelcome.value = true;
      }
      
      // Check for version updates (web only — native updates via app store)
      if (!Capacitor.isNativePlatform()) {
        try {
          const updatePerformed = await checkForVersionUpdate();
          if (updatePerformed) {
            // If update was performed, the app will reload
            return;
          }
        } catch (error) {
          console.error('Error checking for version update:', error);
        }
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

      // Android back button: navigate back or minimize app on home
      if (Capacitor.isNativePlatform()) {
        const { App: CapApp } = await import('@capacitor/app');
        backButtonListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (isSettingsOpen.value) {
            isSettingsOpen.value = false;
          } else if (canGoBack) {
            router.back();
          } else {
            CapApp.minimizeApp();
          }
        });

        // Pause/resume: manage camera and force-reconnect stale relay sockets
        appStateListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            // Android silently kills WebSockets on background without firing close events.
            // Close each relay so the library's built-in reconnect/resubscribe logic kicks in.
            for (const relay of globalPool.relays.values()) {
              relay.close();
            }
          }
          document.dispatchEvent(new CustomEvent('app-state-change', { detail: { isActive } }));
        });
      }
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
      isTabBarHidden: tabBarHidden,
      handleToggleMonitor,
      handleToggleSettings,
      isSettingsOpen,
      showHostWelcome,
      isHomePage,
      handleHostWelcomeComplete
    };
  }
}
</script>

<style>
/* Safe area insets for non-camera views.
   Camera view goes fully edge-to-edge and handles its own insets. */
.safe-area-padded {
  padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  padding-left: var(--safe-area-inset-left, env(safe-area-inset-left, 0px));
  padding-right: var(--safe-area-inset-right, env(safe-area-inset-right, 0px));
}

</style>