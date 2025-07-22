import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/history',
    name: 'ReceiptHistory',
    component: () => import('../views/ReceiptHistoryView.vue')
  },
  {
    path: '/receipt/:eventId/:decryptionKey',
    name: 'ReceiptView',
    component: () => import('../views/ReceiptView.vue'),
    props: true
  },
  {
    path: '/pay/:eventId/:decryptionKey',
    name: 'PaymentView',
    component: () => import('../views/PaymentView.vue'),
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router; 