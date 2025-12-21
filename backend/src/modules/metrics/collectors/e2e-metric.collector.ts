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


            await page.setViewport({ width: 1920, height: 1080 });


            await page.evaluateOnNewDocument(() => {
                (window as any).__longTasks = [];
                (window as any).__longTasksObserver = new PerformanceObserver((list) => {
                    (window as any).__longTasks.push(...list.getEntries());
                });
                (window as any).__longTasksObserver.observe({ type: 'longtask', buffered: true });


                (window as any).__heapMeter = {
                    running: false,
                    timeline: [] as { time: number; usedSize: number; totalSize: number; usagePercent: number }[],
                    startTime: 0,
                    intervalId: null as any,
                    start() {
                        this.timeline = [];
                        this.startTime = performance.now();
                        this.running = true;
                        this.measure();

                        this.intervalId = setInterval(() => this.measure(), 200);
                    },
                    measure() {
                        if (!this.running) return;
                        const memory = (performance as any).memory;
                        if (memory) {
                            const usedSize = memory.usedJSHeapSize;
                            const totalSize = memory.totalJSHeapSize;
                            this.timeline.push({
                                time: Math.round(performance.now() - this.startTime),
                                usedSize,
                                totalSize,
                                usagePercent: totalSize > 0 ? Math.round((usedSize / totalSize) * 100) : 0,
                            });
                        }
                    },
                    stop() {
                        this.running = false;
                        if (this.intervalId) clearInterval(this.intervalId);
                        return {
                            timeline: this.timeline,
                            avgUsagePercent: this.timeline.length > 0
                                ? Math.round(this.timeline.reduce((sum, t) => sum + t.usagePercent, 0) / this.timeline.length)
                                : 0,
                            maxUsagePercent: this.timeline.length > 0
                                ? Math.max(...this.timeline.map(t => t.usagePercent))
                                : 0,
                        };
                    },
                };


                (window as any).__fpsMeter = {
                    frames: 0,
                    startTime: 0,
                    frameTimes: [] as number[],
                    lastFrameTime: 0,
                    running: false,
                    start() {
                        this.frames = 0;
                        this.startTime = performance.now();
                        this.lastFrameTime = this.startTime;
                        this.frameTimes = [];
                        this.running = true;
                        this.measure();
                    },
                    measure() {
                        if (!this.running) return;
                        const now = performance.now();
                        const delta = now - this.lastFrameTime;
                        if (delta > 0) {
                            this.frameTimes.push(delta);
                        }
                        this.frames++;
                        this.lastFrameTime = now;
                        requestAnimationFrame(() => this.measure());
                    },
                    stop() {
                        this.running = false;
                        const duration = performance.now() - this.startTime;
                        const fpsValues = this.frameTimes.filter((t: number) => t > 0).map((t: number) => 1000 / t);
                        return {
                            avgFps: fpsValues.length > 0 ? Math.round(fpsValues.reduce((a: number, b: number) => a + b, 0) / fpsValues.length) : 0,
                            minFps: fpsValues.length > 0 ? Math.round(Math.min(...fpsValues)) : 0,
                            totalFrames: this.frames,
                            durationMs: Math.round(duration),
                            frameTimes: this.frameTimes.slice(),
                        };
                    }
                };
            });


            this.logger.log(`Navigating to ${scenario.url}`);
            await page.goto(scenario.url, { waitUntil: 'networkidle0', timeout: 60000 });


            await new Promise(resolve => setTimeout(resolve, 500));


            await page.evaluate(() => {
                (window as any).__fpsMeter?.start();
                (window as any).__heapMeter?.start();
            });


            const scenarioStartTime = Date.now();


            for (let i = 0; i < scenario.steps.length; i++) {
                const step = scenario.steps[i];
                const stepResult = await this.executeStep(page, step, i);
                stepMetrics.push(stepResult);

                if (!stepResult.success) {
                    this.logger.warn(`Step ${i} failed: ${stepResult.error}`);
                }
            }


            const scenarioDurationMs = Date.now() - scenarioStartTime;


            const fpsResult = await page.evaluate(() => {
                return (window as any).__fpsMeter?.stop() || { avgFps: 0, minFps: 0, totalFrames: 0, durationMs: 0, frameTimes: [] };
            });


            const heapResult = await page.evaluate(() => {
                return (window as any).__heapMeter?.stop() || { timeline: [], avgUsagePercent: 0, maxUsagePercent: 0 };
            });


            const fpsTimeline: { timeMs: number; fps: number }[] = [];
            if (fpsResult.frameTimes && fpsResult.frameTimes.length > 0) {
                const intervalMs = 500;
                let currentTime = 0;
                let intervalFrames = 0;
                let intervalStart = 0;

                for (const frameTime of fpsResult.frameTimes as number[]) {
                    currentTime += frameTime;
                    intervalFrames++;

                    if (currentTime - intervalStart >= intervalMs) {
                        const intervalDuration = currentTime - intervalStart;
                        const fps = Math.round((intervalFrames / intervalDuration) * 1000);
                        fpsTimeline.push({
                            timeMs: Math.round(currentTime),
                            fps: Math.min(fps, 120),
                        });
                        intervalStart = currentTime;
                        intervalFrames = 0;
                    }
                }
            }


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


            const expectedFrames = Math.round((fpsResult.durationMs / 1000) * 60);
            const droppedFrames = Math.max(0, expectedFrames - fpsResult.totalFrames);

            // Вычисляем avgFps и minFps из fpsTimeline (более стабильные значения)
            const avgFps = fpsTimeline.length > 0
                ? Math.round(fpsTimeline.reduce((sum, p) => sum + p.fps, 0) / fpsTimeline.length)
                : 0;
            const minFps = fpsTimeline.length > 0
                ? Math.min(...fpsTimeline.map(p => p.fps))
                : 0;

            return {
                scenarioName: scenario.name,
                url: scenario.url,
                steps: stepMetrics,
                totalDurationMs,
                scenarioDurationMs,
                totalLongTasks,
                totalLongTasksMs,
                avgInputDelayMs,
                maxInputDelayMs,
                avgFps,
                minFps,
                totalFrames: fpsResult.totalFrames,
                droppedFrames,
                fpsTimeline,
                avgHeapUsagePercent: heapResult.avgUsagePercent,
                maxHeapUsagePercent: heapResult.maxUsagePercent,
                heapTimeline: heapResult.timeline,
                success: stepMetrics.every(s => s.success),
            };
        } catch (error) {
            this.logger.error('Scenario execution failed:', (error as Error).message);

            return {
                scenarioName: scenario.name,
                url: scenario.url,
                steps: stepMetrics,
                totalDurationMs: Date.now() - startTime,
                scenarioDurationMs: 0,
                totalLongTasks: 0,
                totalLongTasksMs: 0,
                avgInputDelayMs: 0,
                maxInputDelayMs: 0,
                avgFps: 0,
                minFps: 0,
                totalFrames: 0,
                droppedFrames: 0,
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
            const isFirstStep = stepIndex === 0;

            switch (step.action) {
                case 'click':
                    if (!step.selector) throw new Error('Selector required for click');
                    // Первый шаг ждёт visible:true, остальные — просто наличие элемента
                    await page.waitForSelector(step.selector, { timeout: 10000, visible: isFirstStep });
                    inputDelayMs = Date.now() - actionStart;
                    await page.click(step.selector);
                    break;

                case 'type':
                    if (!step.selector) throw new Error('Selector required for type');
                    if (!step.value) throw new Error('Value required for type');
                    // Первый шаг ждёт visible:true, остальные — просто наличие элемента
                    await page.waitForSelector(step.selector, { timeout: 10000, visible: isFirstStep });
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
                '--disable-software-rasterizer',
                '--no-zygote',
                '--js-flags=--max-old-space-size=512',
            ],
            protocolTimeout: 60000,
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
