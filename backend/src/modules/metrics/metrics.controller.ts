import { Body, Controller, Get, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { CollectMetricsDto } from './dto/collect-metrics.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  list() {
    return this.metricsService.listAvailableMetrics();
  }

  @Post('collect')
  collect(@Body() dto: CollectMetricsDto) {
    return this.metricsService.collectAllMetrics(dto);
  }
}

