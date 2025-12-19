import { Injectable } from '@nestjs/common';
import { MetricRegistry } from './metric-registry.service';
import { CollectMetricsDto } from './dto/collect-metrics.dto';
import {
  MetricDefinition,
  MetricResult,
} from './collectors/metric-collector.interface';

@Injectable()
export class MetricsService {
  constructor(private readonly registry: MetricRegistry) {}

  listAvailableMetrics(): MetricDefinition[] {
    return this.registry.listDefinitions();
  }

  async collectAllMetrics(
    dto: CollectMetricsDto,
  ): Promise<MetricResult<unknown>[]> {
    const collectors = this.registry.getCollectors();
    return Promise.all(collectors.map((collector) => collector.collect(dto.url)));
  }
}

