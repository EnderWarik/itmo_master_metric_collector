import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { MetricCollector, MetricResult, MetricGroup } from './metric-collector.interface';

export interface FpsMetricsPayload {
    /** Средний FPS за период измерения */
    avgFps: number;
    /** Минимальный FPS */
    minFps: number;
    /** Максимальный FPS */
    maxFps: number;
    /** Количество кадров */
    totalFrames: number;
    /** Длительность измерения (мс) */
    durationMs: number;
    /** Количество пропущенных кадров (dropped) */
    droppedFrames: number;
    /** Процент пропущенных кадров */
    droppedFramesPercent: number;
    /** Ошибка если есть */
    error?: string;
}

@Injectable()
export class FpsMetricCollector
    implements MetricCollector<FpsMetricsPayload>, OnModuleInit, OnModuleDestroy {
    readonly key = 'page.fps';
    readonly label = 'FPS';
    readonly group = MetricGroup.Browser;
    readonly description =
        'FPS в покое — средний, минимальный и максимальный FPS за 3 секунды после загрузки страницы.';

    private readonly logger = new Logger(FpsMetricCollector.name);
    private browser: puppeteer.Browser | null = null;

    async onModuleInit(): Promise<void> {
        await this.launchBrowser();
    }

    async onModuleDestroy(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private async launchBrowser(): Promise<void> {
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
        this.logger.log('Browser launched for FPS metrics');
    }

    async collect(url: string): Promise<MetricResult<FpsMetricsPayload>> {
        let page: puppeteer.Page | null = null;

        try {
            if (!this.browser || !this.browser.connected) {
                await this.launchBrowser();
            }

            page = await this.browser!.newPage();
            await page.setViewport({ width: 1920, height: 1080 });


            await page.goto(url, { waitUntil: 'load', timeout: 30000 });


            await new Promise(resolve => setTimeout(resolve, 1000));


            const measurementDuration = 3000;

            const fpsData = await page.evaluate((duration: number) => {
                return new Promise<{
                    avgFps: number;
                    minFps: number;
                    maxFps: number;
                    totalFrames: number;
                    durationMs: number;
                    frameTimes: number[];
                }>((resolve) => {
                    const frameTimes: number[] = [];
                    let lastTime = performance.now();
                    const startTime = lastTime;
                    let frameCount = 0;

                    function measureFrame(currentTime: number) {
                        const delta = currentTime - lastTime;
                        if (delta > 0) {
                            frameTimes.push(delta);
                        }
                        lastTime = currentTime;
                        frameCount++;

                        if (currentTime - startTime >= duration) {

                            const fpsValues = frameTimes
                                .filter(t => t > 0)
                                .map(t => 1000 / t);

                            const avgFps = fpsValues.length > 0
                                ? Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length)
                                : 0;
                            const minFps = fpsValues.length > 0
                                ? Math.round(Math.min(...fpsValues))
                                : 0;
                            const maxFps = fpsValues.length > 0
                                ? Math.round(Math.max(...fpsValues))
                                : 0;

                            resolve({
                                avgFps,
                                minFps,
                                maxFps,
                                totalFrames: frameCount,
                                durationMs: Math.round(currentTime - startTime),
                                frameTimes,
                            });
                        } else {
                            requestAnimationFrame(measureFrame);
                        }
                    }

                    requestAnimationFrame(measureFrame);
                });
            }, measurementDuration);


            const expectedFrames = Math.round((fpsData.durationMs / 1000) * 60);
            const droppedFrames = Math.max(0, expectedFrames - fpsData.totalFrames);
            const droppedFramesPercent = Math.round((droppedFrames / expectedFrames) * 100);

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                collectedAt: new Date(),
                payload: {
                    avgFps: fpsData.avgFps,
                    minFps: fpsData.minFps,
                    maxFps: fpsData.maxFps,
                    totalFrames: fpsData.totalFrames,
                    durationMs: fpsData.durationMs,
                    droppedFrames,
                    droppedFramesPercent,
                },
            };
        } catch (error) {
            this.logger.error('Error collecting FPS metrics:', (error as Error).message);

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                collectedAt: new Date(),
                payload: {
                    avgFps: 0,
                    minFps: 0,
                    maxFps: 0,
                    totalFrames: 0,
                    durationMs: 0,
                    droppedFrames: 0,
                    droppedFramesPercent: 0,
                    error: (error as Error).message,
                },
            };
        } finally {
            if (page) {
                await page.close().catch(() => { });
            }
        }
    }
}
