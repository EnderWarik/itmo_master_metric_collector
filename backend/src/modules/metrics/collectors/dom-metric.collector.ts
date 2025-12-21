import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import {
    MetricCollector,
    MetricGroup,
    MetricResult,
} from './metric-collector.interface';

export interface NavigationTimingBreakdown {
    /** Время на редиректы */
    redirectMs: number;
    /** true если редирект был cross-origin (тайминги скрыты) */
    redirectHidden: boolean;
    /** DNS lookup */
    dnsMs: number;
    /** true если DNS был из кеша */
    dnsCached: boolean;
    /** TCP соединение */
    connectMs: number;
    /** true если соединение переиспользовано (keep-alive) */
    connectionReused: boolean;
    /** TLS handshake (null для HTTP) */
    sslMs: number | null;
    /** Ожидание ответа сервера (TTFB после соединения) */
    requestMs: number;
    /** Скачивание ответа */
    responseMs: number;
    /** Парсинг HTML до DOM Interactive */
    domParseMs: number;
    /** Выполнение синхронных скриптов */
    executeScriptsMs: number;
    /** Загрузка ресурсов (CSS, JS, images) */
    subResourcesMs: number;
    /** DOMContentLoaded относительно navigationStart */
    domContentLoadedMs: number;
    /** Load event относительно navigationStart */
    loadEventMs: number;
}

export interface DomMetricPayload {
    timing: NavigationTimingBreakdown;
    /** Общее время загрузки */
    totalMs: number;
    error?: string;
}

@Injectable()
export class DomMetricCollector
    implements MetricCollector<DomMetricPayload>, OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(DomMetricCollector.name);

    readonly key = 'page.dom';
    readonly label = 'Navigation Timing';
    readonly group = MetricGroup.Browser;
    readonly description =
        'Полная разбивка времени загрузки страницы: редиректы, DNS, TCP, TLS, запрос, ответ, парсинг DOM, скрипты, ресурсы.';

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
                headless: true,
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

    private createEmptyTiming(): NavigationTimingBreakdown {
        return {
            redirectMs: 0,
            redirectHidden: false,
            dnsMs: 0,
            dnsCached: false,
            connectMs: 0,
            connectionReused: false,
            sslMs: null,
            requestMs: 0,
            responseMs: 0,
            domParseMs: 0,
            executeScriptsMs: 0,
            subResourcesMs: 0,
            domContentLoadedMs: 0,
            loadEventMs: 0,
        };
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
                    timing: this.createEmptyTiming(),
                    totalMs: 0,
                    error: 'Browser not available',
                },
                collectedAt: new Date(),
            };
        }

        let page;
        try {
            page = await browser.newPage();


            await page.goto(url, {
                waitUntil: 'load',
                timeout: 30000,
            });


            const metrics = await page.evaluate(() => {
                const entries = performance.getEntriesByType('navigation');
                if (!entries.length) return null;

                const nav = entries[0] as PerformanceNavigationTiming;


                const redirectMs = nav.redirectEnd - nav.redirectStart;
                const dnsMs = nav.domainLookupEnd - nav.domainLookupStart;
                const connectMs = nav.connectEnd - nav.connectStart;


                const sslMs = nav.secureConnectionStart && nav.secureConnectionStart > 0
                    ? nav.connectEnd - nav.secureConnectionStart
                    : null;

                return {

                    redirectMs,
                    redirectHidden: redirectMs === 0 && nav.redirectCount > 0,
                    dnsMs,
                    dnsCached: dnsMs === 0,
                    connectMs,
                    connectionReused: connectMs === 0,
                    sslMs,
                    requestMs: nav.responseStart - nav.requestStart,
                    responseMs: nav.responseEnd - nav.responseStart,
                    domParseMs: nav.domInteractive - nav.responseEnd,
                    executeScriptsMs: nav.domContentLoadedEventStart - nav.domInteractive,
                    subResourcesMs: nav.loadEventStart - nav.domContentLoadedEventEnd,

                    // Ключевые моменты (у navigation-entries это уже от startTime)
                    domContentLoadedMs: nav.domContentLoadedEventEnd,
                    loadEventMs: nav.loadEventEnd,
                    totalMs: nav.loadEventEnd,
                };
            });

            if (!metrics) {
                return {
                    key: this.key,
                    label: this.label,
                    group: this.group,
                    description: this.description,
                    payload: {
                        timing: this.createEmptyTiming(),
                        totalMs: 0,
                        error: 'Navigation timing not available',
                    },
                    collectedAt: new Date(),
                };
            }

            const timing: NavigationTimingBreakdown = {
                redirectMs: Math.round(metrics.redirectMs),
                redirectHidden: metrics.redirectHidden,
                dnsMs: Math.round(metrics.dnsMs),
                dnsCached: metrics.dnsCached,
                connectMs: Math.round(metrics.connectMs),
                connectionReused: metrics.connectionReused,
                sslMs: metrics.sslMs !== null ? Math.round(metrics.sslMs) : null,
                requestMs: Math.round(metrics.requestMs),
                responseMs: Math.round(metrics.responseMs),
                domParseMs: Math.round(metrics.domParseMs),
                executeScriptsMs: Math.round(metrics.executeScriptsMs),
                subResourcesMs: Math.round(metrics.subResourcesMs),
                domContentLoadedMs: Math.round(metrics.domContentLoadedMs),
                loadEventMs: Math.round(metrics.loadEventMs),
            };

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                payload: {
                    timing,
                    totalMs: Math.round(metrics.totalMs),
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
                    timing: this.createEmptyTiming(),
                    totalMs: 0,
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
