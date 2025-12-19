import { createRouter, createWebHistory } from 'vue-router';
import MetricsDashboard from '@/modules/metrics/views/MetricsDashboard.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'metrics-dashboard',
      component: MetricsDashboard,
    },
  ],
});

export default router;
