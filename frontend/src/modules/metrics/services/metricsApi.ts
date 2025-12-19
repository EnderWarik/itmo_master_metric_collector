import { httpClient } from '@/shared/api/httpClient';
import type {
  MetricDefinition,
  MetricResult,
} from '@/shared/types/metrics';

export interface CollectMetricsPayload {
  url: string;
}

export const metricsApi = {
  listDefinitions: () =>
    httpClient<MetricDefinition[]>('/metrics'),
  collectAll: (payload: CollectMetricsPayload) =>
    httpClient<MetricResult[]>('/metrics/collect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

