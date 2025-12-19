import { onMounted, ref } from 'vue';
import type {
  MetricDefinition,
  MetricResult,
} from '@/shared/types/metrics';
import { metricsApi } from '../services/metricsApi';
import type { CollectMetricsPayload } from '../services/metricsApi';

export function useMetricRunner() {
  const definitions = ref<MetricDefinition[]>([]);
  const isLoadingDefinitions = ref(false);
  const isCollecting = ref(false);
  const results = ref<MetricResult[]>([]);
  const errorMessage = ref<string | null>(null);

  onMounted(async () => {
    await loadDefinitions();
  });

  async function loadDefinitions() {
    isLoadingDefinitions.value = true;
    try {
      definitions.value = await metricsApi.listDefinitions();
    } catch (error) {
      errorMessage.value = (error as Error).message;
    } finally {
      isLoadingDefinitions.value = false;
    }
  }

  async function collectAll(payload: CollectMetricsPayload) {
    isCollecting.value = true;
    errorMessage.value = null;
    try {
      results.value = await metricsApi.collectAll(payload);
    } catch (error) {
      errorMessage.value = (error as Error).message;
    } finally {
      isCollecting.value = false;
    }
  }

  return {
    definitions,
    isLoadingDefinitions,
    isCollecting,
    results,
    errorMessage,
    loadDefinitions,
    collectAll,
  };
}

