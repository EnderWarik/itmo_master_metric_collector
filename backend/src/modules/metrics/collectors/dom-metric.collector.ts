import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import {
    MetricCollector,
    MetricGroup,
    MetricResult,
} from './metric-collector.interface';

export interface DomTimingBreakdown {
    /** Время до окончания загрузки DOM (DOMContentLoaded) */
    domContentLoadedMs: number;
    /** Время до полной загрузки страницы (load event) */
    loadEventMs: number;
    /** Время до первой отрисовки (First Paint) */
    firstPaintMs: number | null;
    /** Время до первой значимой отрисовки (First Contentful Paint) */
    firstContentfulPaintMs: number | null;
}

export interface DomMetricPayload {
    timing: DomTimingBreakdown;
    navigationStart: number;
    error?: string;
}

@Injectable()
export class DomMetricCollector
    implements MetricCollector<DomMetricPayload>, OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DomMetricCollector.name);

    readonly key = 'page.dom';
    readonly label = 'DOM & Paint Metrics';
    readonly group = MetricGroup.Browser;
    readonly description =
        'Измеряет время до готовности DOM (DOMContentLoaded), полной загрузки (load) и первой отрисовки (FCP).';

    private browser: Browser | null = null;

    async onModuleInit() {
        await this.launchBrowser();
    }

    async onModuleDestroy() {
        await this.closeBrowser();
    }

    private async launchBrowser(): Promise<void> {
        try {
            const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            this.browser = await puppeteer.launch({
                headless: 'shell',
                executablePath: executablePath || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-accelerated-2d-canvas',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-default-browser-check',
                    '--font-render-hinting=none',
                ],
                protocolTimeout: 30000,
            });
            this.logger.log('Browser launched successfully');
        } catch (error) {
            this.logger.error('Failed to launch browser:', (error as Error).message);
            this.browser = null;
        }
    }

    private async closeBrowser(): Promise<void> {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch {
                // Ignore close errors
            }
            this.browser = null;
        }
    }

    private async ensureBrowser(): Promise<Browser | null> {
        if (!this.browser || !this.browser.connected) {
            this.logger.warn('Browser disconnected, restarting...');
            await this.closeBrowser();
            await this.launchBrowser();
        }
        return this.browser;
    }

    async collect(url: string): Promise<MetricResult<DomMetricPayload>> {
        const browser = await this.ensureBrowser();

        if (!browser) {
            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                payload: {
                    timing: {
                        domContentLoadedMs: 0,
                        loadEventMs: 0,
                        firstPaintMs: null,
                        firstContentfulPaintMs: null,
                    },
                    navigationStart: 0,
                    error: 'Browser not available',
                },
                collectedAt: new Date(),
            };
        }

        let page;
        try {
            page = await browser.newPage();

            // Переходим на страницу и ждём полной загрузки
            await page.goto(url, {
                waitUntil: 'load',
                timeout: 30000,
            });

            // Получаем метрики из Performance API
            const metrics = await page.evaluate(() => {
                const timing = performance.timing;
                const navigationStart = timing.navigationStart;

                // Paint metrics
                const paintEntries = performance.getEntriesByType('paint');
                const firstPaint = paintEntries.find((e) => e.name === 'first-paint');
                const firstContentfulPaint = paintEntries.find(
                    (e) => e.name === 'first-contentful-paint',
                );

                return {
                    timing: {
                        domContentLoadedMs:
                            timing.domContentLoadedEventEnd - navigationStart,
                        loadEventMs: timing.loadEventEnd - navigationStart,
                        firstPaintMs: firstPaint ? Math.round(firstPaint.startTime) : null,
                        firstContentfulPaintMs: firstContentfulPaint
                            ? Math.round(firstContentfulPaint.startTime)
                            : null,
                    },
                    navigationStart,
                };
            });

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                payload: {
                    timing: {
                        domContentLoadedMs: Math.round(metrics.timing.domContentLoadedMs),
                        loadEventMs: Math.round(metrics.timing.loadEventMs),
                        firstPaintMs: metrics.timing.firstPaintMs,
                        firstContentfulPaintMs: metrics.timing.firstContentfulPaintMs,
                    },
                    navigationStart: metrics.navigationStart,
                },
                collectedAt: new Date(),
            };
        } catch (error) {
            this.logger.error('Error collecting DOM metrics:', (error as Error).message);

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                payload: {
                    timing: {
                        domContentLoadedMs: 0,
                        loadEventMs: 0,
                        firstPaintMs: null,
                        firstContentfulPaintMs: null,
                    },
                    navigationStart: 0,
                    error: (error as Error).message,
                },
                collectedAt: new Date(),
            };
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch {
                    // Ignore close errors
                }
            }
        }
    }
}
