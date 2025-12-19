import { Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import {
  MetricCollector,
  MetricResult,
} from './metric-collector.interface';

export interface PingMetricPayload {
  elapsedMs: number;
  status: number | null;
  ok: boolean;
  error?: string;
}

@Injectable()
export class PingMetricCollector
  implements MetricCollector<PingMetricPayload>
{
  readonly key = 'availability.ping';
  readonly label = 'Availability ping';
  readonly description =
    'Выполняет простой GET-запрос и измеряет время отклика.';

  async collect(url: string): Promise<MetricResult<PingMetricPayload>> {
    const startedAt = performance.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
      });
      const elapsedMs = performance.now() - startedAt;

      return {
        key: this.key,
        label: this.label,
        description: this.description,
        payload: {
          elapsedMs: Math.round(elapsedMs),
          status: response.status,
          ok: response.ok,
        },
        collectedAt: new Date(),
      };
    } catch (error) {
      const elapsedMs = performance.now() - startedAt;
      return {
        key: this.key,
        label: this.label,
        description: this.description,
        payload: {
          elapsedMs: Math.round(elapsedMs),
          status: null,
          ok: false,
          error: (error as Error).message,
        },
        collectedAt: new Date(),
      };
    }
  }
}

