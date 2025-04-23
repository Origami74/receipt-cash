<template>
  <div class="h-full">
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
import { useNotification } from './utils/notification';
import Notification from './components/Notification.vue';

export default {
  name: 'App',
  components: {
    Notification
  },
  setup() {
    const { notification, clearNotification } = useNotification();
    
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