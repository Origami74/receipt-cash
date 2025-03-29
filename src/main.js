import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import nostrService from './services/nostr';

// Initialize Nostr
nostrService.initializeKeys();
nostrService.connect();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app'); 