import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { CollectMetricsDto } from './dto/collect-metrics.dto';
import { E2EMetricCollector } from './collectors/e2e-metric.collector';
import { TaskRegistry } from './task-registry.service';
import type { Scenario } from './types/e2e-scenario.types';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly e2eCollector: E2EMetricCollector,
    private readonly tasks: TaskRegistry,
  ) { }

  @Get()
  list() {
    return this.metricsService.listAvailableMetrics();
  }

  @Post('collect')
  collect(@Body() dto: CollectMetricsDto) {
    const taskId = this.tasks.create(() => this.metricsService.collectAllMetrics(dto));
    return { taskId };
  }

  @Post('e2e')
  runE2EScenario(@Body() scenario: Scenario) {
    const taskId = this.tasks.create(() => this.e2eCollector.runScenario(scenario));
    return { taskId };
  }

  @Get('task/:id')
  getTask(@Param('id') id: string) {
    const task = this.tasks.get(id);
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return {
      id: task.id,
      status: task.status,
      result: task.result,
      error: task.error,
    };
  }
}
