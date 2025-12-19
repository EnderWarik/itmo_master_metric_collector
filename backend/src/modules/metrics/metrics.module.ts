import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricRegistry } from './metric-registry.service';
import { METRIC_COLLECTORS } from './metrics.tokens';
import { PingMetricCollector } from './collectors/ping-metric.collector';
import { TtfbMetricCollector } from './collectors/ttfb-metric.collector';
import { DomMetricCollector } from './collectors/dom-metric.collector';
import { LighthouseMetricCollector } from './collectors/lighthouse-metric.collector';
import { FpsMetricCollector } from './collectors/fps-metric.collector';
import { E2EMetricCollector } from './collectors/e2e-metric.collector';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    MetricRegistry,
    PingMetricCollector,
    TtfbMetricCollector,
    DomMetricCollector,
    LighthouseMetricCollector,
    FpsMetricCollector,
    E2EMetricCollector,
    {
      provide: METRIC_COLLECTORS,
      useFactory: (
        pingCollector: PingMetricCollector,
        ttfbCollector: TtfbMetricCollector,
        domCollector: DomMetricCollector,
        lighthouseCollector: LighthouseMetricCollector,
        fpsCollector: FpsMetricCollector,
      ) => [pingCollector, ttfbCollector, domCollector, lighthouseCollector, fpsCollector],
      inject: [PingMetricCollector, TtfbMetricCollector, DomMetricCollector, LighthouseMetricCollector, FpsMetricCollector],
    },
  ],
  exports: [MetricsService, E2EMetricCollector],
})
export class MetricsModule { }
