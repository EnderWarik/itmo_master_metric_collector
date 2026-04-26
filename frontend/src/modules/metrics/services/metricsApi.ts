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
  scenarioDurationMs: number;
  totalLongTasks: number;
  totalLongTasksMs: number;
  avgInputDelayMs: number;
  maxInputDelayMs: number;
  avgFps?: number;
  minFps?: number;
  totalFrames?: number;
  droppedFrames?: number;
  fpsTimeline?: { timeMs: number; fps: number }[];
  avgHeapUsagePercent?: number;
  maxHeapUsagePercent?: number;
  heapTimeline?: { time: number; usedSize: number; totalSize: number; usagePercent: number }[];
  success: boolean;
  error?: string;
}

interface TaskResponse<T> {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: T;
  error?: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 600;

async function pollTask<T>(taskId: string): Promise<T> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const task = await httpClient<TaskResponse<T>>(`/metrics/task/${taskId}`);
    if (task.status === 'done') {
      return task.result as T;
    }
    if (task.status === 'error') {
      throw new Error(task.error || 'Task failed');
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('Task polling timeout');
}

export const metricsApi = {
  listDefinitions: () =>
    httpClient<MetricDefinition[]>('/metrics'),
  collectAll: async (payload: CollectMetricsPayload): Promise<MetricResult[]> => {
    const { taskId } = await httpClient<{ taskId: string }>('/metrics/collect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return pollTask<MetricResult[]>(taskId);
  },
  runE2EScenario: async (scenario: Scenario): Promise<E2EResult> => {
    const { taskId } = await httpClient<{ taskId: string }>('/metrics/e2e', {
      method: 'POST',
      body: JSON.stringify(scenario),
    });
    return pollTask<E2EResult>(taskId);
  },
};
