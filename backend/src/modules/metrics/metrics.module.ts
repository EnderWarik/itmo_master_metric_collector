import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricRegistry } from './metric-registry.service';
import { METRIC_COLLECTORS } from './metrics.tokens';
import { PingMetricCollector } from './collectors/ping-metric.collector';
import { TtfbMetricCollector } from './collectors/ttfb-metric.collector';
import { DomMetricCollector } from './collectors/dom-metric.collector';
import { LighthouseMetricCollector } from './collectors/lighthouse-metric.collector';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricRegistry,
    PingMetricCollector,
    TtfbMetricCollector,
    DomMetricCollector,
    LighthouseMetricCollector,
    {
      provide: METRIC_COLLECTORS,
      useFactory: (
        pingCollector: PingMetricCollector,
        ttfbCollector: TtfbMetricCollector,
        domCollector: DomMetricCollector,
        lighthouseCollector: LighthouseMetricCollector,
      ) => [pingCollector, ttfbCollector, domCollector, lighthouseCollector],
      inject: [PingMetricCollector, TtfbMetricCollector, DomMetricCollector, LighthouseMetricCollector],
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule { }
