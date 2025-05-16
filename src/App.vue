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
    />
    
    <router-view />
  </div>
</template>

<script>
import { onMounted } from 'vue';
import { showNotification, useNotification } from './utils/notification';
import Notification from './components/Notification.vue';
import ExperimentalBanner from './components/ExperimentalBanner.vue';
import recoveryService from './services/recovery';

export default {
  name: 'App',
  components: {
    Notification,
    ExperimentalBanner
  },
  setup() {
    const { notification, clearNotification } = useNotification();
    
    // Check for unprocessed mint quotes when the app starts
    onMounted(() => {
      // Run after a short delay to ensure app is fully initialized
      setTimeout(async () => {
        try {
          const recovered = await recoveryService.checkPendingLightningPayments();
          if (recovered && recovered.length > 0) {
            console.log(`Successfully recovered ${recovered.length} payments`);
            showNotification(`Successfully recovered ${recovered.length} payments`, "success")
          }
        } catch (error) {
          console.error('Error running recovery service:', error);
        }
      }, 1000);
    });
    
    return {
      notification,
      clearNotification
    };
  }
}
</script>

<style>
/* Any app-wide styles go here */
</style>