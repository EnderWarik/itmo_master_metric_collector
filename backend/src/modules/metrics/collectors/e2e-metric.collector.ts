import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import {
    Scenario,
    ScenarioStep,
    StepMetrics,
    E2EMetricsPayload,
} from '../types/e2e-scenario.types';

@Injectable()
export class E2EMetricCollector {
    private readonly logger = new Logger(E2EMetricCollector.name);
    private browser: puppeteer.Browser | null = null;

    async runScenario(scenario: Scenario): Promise<E2EMetricsPayload> {
        const startTime = Date.now();
        const stepMetrics: StepMetrics[] = [];
        let page: puppeteer.Page | null = null;

        try {
            await this.ensureBrowser();
            page = await this.browser!.newPage();

            // Устанавливаем viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Инжектим Long Tasks observer
            await page.evaluateOnNewDocument(() => {
                (window as any).__longTasks = [];
                (window as any).__longTasksObserver = new PerformanceObserver((list) => {
                    (window as any).__longTasks.push(...list.getEntries());
                });
                (window as any).__longTasksObserver.observe({ type: 'longtask', buffered: true });
            });

            // Переходим на страницу
            this.logger.log(`Navigating to ${scenario.url}`);
            await page.goto(scenario.url, { waitUntil: 'load', timeout: 30000 });

            // Выполняем каждый шаг
            for (let i = 0; i < scenario.steps.length; i++) {
                const step = scenario.steps[i];
                const stepResult = await this.executeStep(page, step, i);
                stepMetrics.push(stepResult);

                if (!stepResult.success) {
                    this.logger.warn(`Step ${i} failed: ${stepResult.error}`);
                }
            }

            // Собираем итоговые метрики
            const totalDurationMs = Date.now() - startTime;
            const totalLongTasks = stepMetrics.reduce((sum, s) => sum + s.longTasksCount, 0);
            const totalLongTasksMs = stepMetrics.reduce((sum, s) => sum + s.longTasksTotalMs, 0);

            const inputDelays = stepMetrics
                .filter(s => s.action !== 'wait' && s.action !== 'navigate')
                .map(s => s.inputDelayMs);

            const avgInputDelayMs = inputDelays.length > 0
                ? Math.round(inputDelays.reduce((a, b) => a + b, 0) / inputDelays.length)
                : 0;
            const maxInputDelayMs = inputDelays.length > 0
                ? Math.max(...inputDelays)
                : 0;

            return {
                scenarioName: scenario.name,
                url: scenario.url,
                steps: stepMetrics,
                totalDurationMs,
                totalLongTasks,
                totalLongTasksMs,
                avgInputDelayMs,
                maxInputDelayMs,
                success: stepMetrics.every(s => s.success),
            };
        } catch (error) {
            this.logger.error('Scenario execution failed:', (error as Error).message);

            return {
                scenarioName: scenario.name,
                url: scenario.url,
                steps: stepMetrics,
                totalDurationMs: Date.now() - startTime,
                totalLongTasks: 0,
                totalLongTasksMs: 0,
                avgInputDelayMs: 0,
                maxInputDelayMs: 0,
                success: false,
                error: (error as Error).message,
            };
        } finally {
            if (page) {
                await page.close().catch(() => { });
            }
        }
    }

    private async executeStep(
        page: puppeteer.Page,
        step: ScenarioStep,
        stepIndex: number,
    ): Promise<StepMetrics> {
        const stepStart = Date.now();
        let inputDelayMs = 0;
        let success = true;
        let error: string | undefined;

        try {
            // Очищаем Long Tasks перед шагом
            await page.evaluate(() => {
                (window as any).__longTasks = [];
            });

            const actionStart = Date.now();

            switch (step.action) {
                case 'click':
                    if (!step.selector) throw new Error('Selector required for click');
                    await page.waitForSelector(step.selector, { timeout: 10000 });
                    inputDelayMs = Date.now() - actionStart;
                    await page.click(step.selector);
                    break;

                case 'type':
                    if (!step.selector) throw new Error('Selector required for type');
                    if (!step.value) throw new Error('Value required for type');
                    await page.waitForSelector(step.selector, { timeout: 10000 });
                    inputDelayMs = Date.now() - actionStart;
                    await page.type(step.selector, String(step.value), { delay: 50 });
                    break;

                case 'wait':
                    const waitTime = typeof step.value === 'number' ? step.value : 1000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    break;

                case 'navigate':
                    if (!step.value) throw new Error('URL required for navigate');
                    await page.goto(String(step.value), { waitUntil: 'load', timeout: 30000 });
                    break;

                case 'scroll':
                    const scrollAmount = typeof step.value === 'number' ? step.value : 500;
                    await page.evaluate((amount) => {
                        window.scrollBy(0, amount);
                    }, scrollAmount);
                    break;
            }

            // Даём немного времени на обработку после действия
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err) {
            success = false;
            error = (err as Error).message;
        }

        // Собираем Long Tasks после шага
        const longTasks = await page.evaluate(() => {
            const tasks = (window as any).__longTasks || [];
            return tasks.map((t: PerformanceEntry) => ({
                duration: t.duration,
                startTime: t.startTime,
            }));
        });

        const longTasksCount = longTasks.length;
        const longTasksTotalMs = Math.round(
            longTasks.reduce((sum: number, t: { duration: number }) => sum + t.duration, 0)
        );

        return {
            stepIndex,
            action: step.action,
            selector: step.selector,
            label: step.label,
            inputDelayMs: Math.round(inputDelayMs),
            actionDurationMs: Date.now() - stepStart,
            longTasksCount,
            longTasksTotalMs,
            success,
            error,
        };
    }

    private async ensureBrowser(): Promise<void> {
        if (this.browser && this.browser.connected) {
            return;
        }

        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

        this.browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });

        this.logger.log('Browser launched for E2E scenarios');
    }

    async onModuleDestroy(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
