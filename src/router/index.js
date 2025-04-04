import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/receipt/:eventId',
    name: 'Settlement',
    component: () => import('../views/SettlementView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router; 