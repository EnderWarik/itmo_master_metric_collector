import { Body, Controller, Get, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { CollectMetricsDto } from './dto/collect-metrics.dto';
import { E2EMetricCollector } from './collectors/e2e-metric.collector';
import type { Scenario } from './types/e2e-scenario.types';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly e2eCollector: E2EMetricCollector,
  ) { }

  @Get()
  list() {
    return this.metricsService.listAvailableMetrics();
  }

  @Post('collect')
  collect(@Body() dto: CollectMetricsDto) {
    return this.metricsService.collectAllMetrics(dto);
  }

  @Post('e2e')
  async runE2EScenario(@Body() scenario: Scenario) {
    return this.e2eCollector.runScenario(scenario);
  }
}
