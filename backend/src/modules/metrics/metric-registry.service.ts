import { Inject, Injectable } from '@nestjs/common';
import { METRIC_COLLECTORS } from './metrics.tokens';
import {
  MetricCollector,
  MetricDefinition,
} from './collectors/metric-collector.interface';

@Injectable()
export class MetricRegistry {
  constructor(
    @Inject(METRIC_COLLECTORS)
    private readonly collectors: MetricCollector[],
  ) { }

  listDefinitions(): MetricDefinition[] {
    return this.collectors.map(({ key, label, group, description }) => ({
      key,
      label,
      group,
      description,
    }));
  }

  getCollectors(): MetricCollector[] {
    return [...this.collectors];
  }
}

