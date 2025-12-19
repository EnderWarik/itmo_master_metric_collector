import { httpClient } from '@/shared/api/httpClient';
import type {
  MetricDefinition,
  MetricResult,
} from '@/shared/types/metrics';

export interface CollectMetricsPayload {
  url: string;
}

export interface Scenario {
  name: string;
  url: string;
  steps: { action: string; selector?: string; value?: string | number; label?: string }[];
}

export interface E2EResult {
  scenarioName: string;
  url: string;
  steps: any[];
  totalDurationMs: number;
  totalLongTasks: number;
  totalLongTasksMs: number;
  avgInputDelayMs: number;
  maxInputDelayMs: number;
  success: boolean;
  error?: string;
}

export const metricsApi = {
  listDefinitions: () =>
    httpClient<MetricDefinition[]>('/metrics'),
  collectAll: (payload: CollectMetricsPayload) =>
    httpClient<MetricResult[]>('/metrics/collect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runE2EScenario: (scenario: Scenario) =>
    httpClient<E2EResult>('/metrics/e2e', {
      method: 'POST',
      body: JSON.stringify(scenario),
    }),
};
