import { createRouter, createWebHistory } from 'vue-router';
import MetricsDashboard from '@/modules/metrics/views/MetricsDashboard.vue';
import CompareView from '@/modules/compare/views/CompareView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'metrics-dashboard',
      component: MetricsDashboard,
    },
    {
      path: '/compare',
      name: 'compare',
      component: CompareView,
    },
  ],
});

export default router;
