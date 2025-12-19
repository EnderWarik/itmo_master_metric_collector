import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import {
    MetricCollector,
    MetricGroup,
    MetricResult,
} from './metric-collector.interface';

interface ResourceEntry {
    name: string;
    initiatorType: string;
    duration: number;
    transferSize: number;
    startTime: number;
}

export interface ResourceTimingPayload {
    /** Общее количество ресурсов */
    totalResources: number;
    /** Общий размер скачанных данных (bytes) */
    totalTransferSize: number;
    /** Количество XHR/fetch запросов */
    apiRequests: number;
    /** Общее время загрузки API запросов (мс) */
    totalApiDurationMs: number;
    /** Среднее время API запроса (мс) */
    avgApiDurationMs: number;
    /** Максимальное время API запроса (мс) */
    maxApiDurationMs: number;
    /** Детали API запросов */
    apiDetails: { url: string; duration: number; size: number }[];
    /** Время выполнения скриптов (мс) */
    scriptDurationMs: number;
    /** Количество скриптов */
    scriptsCount: number;
    /** Общий размер скриптов (bytes) */
    scriptsTotalSize: number;

    // CDP Performance Metrics
    /** Время всех задач в main thread (мс) */
    taskDurationMs: number;
    /** Использованная память JS heap (bytes) */
    jsHeapUsedSize: number;
    /** Общий размер JS heap (bytes) */
    jsHeapTotalSize: number;
    /** Количество layout операций */
    layoutCount: number;
    /** Время на layout (мс) */
    layoutDurationMs: number;
    /** Количество пересчётов стилей */
    recalcStyleCount: number;
    /** Время на пересчёт стилей (мс) */
    recalcStyleDurationMs: number;
    /** Количество DOM nodes */
    domNodes: number;
    /** Количество event listeners */
    jsEventListeners: number;

    error?: string;
}

@Injectable()
export class ResourceTimingCollector
    implements MetricCollector<ResourceTimingPayload> {
    private readonly logger = new Logger(ResourceTimingCollector.name);

    readonly key = 'page.resources';
    readonly label = 'Resource Timing';
    readonly group = MetricGroup.Browser;
    readonly description =
        'Время загрузки ресурсов: API запросы, скрипты, общая статистика.';

    async collect(url: string): Promise<MetricResult<ResourceTimingPayload>> {
        let browser: puppeteer.Browser | null = null;

        try {
            const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            browser = await puppeteer.launch({
                executablePath: executablePath || undefined,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });

            // Создаем CDP сессию для получения Performance metrics
            const client = await page.target().createCDPSession();
            await client.send('Performance.enable');

            // Переходим на страницу
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            // Ждём дополнительно для полной загрузки
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Получаем Performance metrics через CDP
            const metrics = await client.send('Performance.getMetrics');

            const getMetric = (name: string): number => {
                const metric = metrics.metrics.find(m => m.name === name);
                return metric ? metric.value : 0;
            };

            // CDP метрики (времена в секундах, конвертируем в мс)
            const scriptDurationMs = Math.round(getMetric('ScriptDuration') * 1000);
            const taskDurationMs = Math.round(getMetric('TaskDuration') * 1000);
            const layoutDurationMs = Math.round(getMetric('LayoutDuration') * 1000);
            const recalcStyleDurationMs = Math.round(getMetric('RecalcStyleDuration') * 1000);

            // CDP метрики (количество/размер)
            const jsHeapUsedSize = Math.round(getMetric('JSHeapUsedSize'));
            const jsHeapTotalSize = Math.round(getMetric('JSHeapTotalSize'));
            const layoutCount = Math.round(getMetric('LayoutCount'));
            const recalcStyleCount = Math.round(getMetric('RecalcStyleCount'));
            const domNodes = Math.round(getMetric('Nodes'));
            const jsEventListeners = Math.round(getMetric('JSEventListeners'));

            // Получаем Resource Timing через Performance API
            const resourceEntries = await page.evaluate(() => {
                const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
                return entries.map(entry => ({
                    name: entry.name,
                    initiatorType: entry.initiatorType,
                    duration: Math.round(entry.duration),
                    transferSize: entry.transferSize || 0,
                    startTime: Math.round(entry.startTime),
                }));
            }) as ResourceEntry[];

            // Фильтруем API запросы (fetch, xmlhttprequest)
            const apiEntries = resourceEntries.filter(
                e => e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest'
            );

            // Фильтруем скрипты
            const scriptEntries = resourceEntries.filter(
                e => e.initiatorType === 'script'
            );

            // Вычисляем статистику
            const apiDurations = apiEntries.map(e => e.duration);
            const totalApiDurationMs = apiDurations.reduce((a, b) => a + b, 0);
            const avgApiDurationMs = apiDurations.length > 0
                ? Math.round(totalApiDurationMs / apiDurations.length)
                : 0;
            const maxApiDurationMs = apiDurations.length > 0
                ? Math.max(...apiDurations)
                : 0;

            // Детали API (топ-10 по длительности)
            const apiDetails = apiEntries
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 10)
                .map(e => ({
                    url: e.name.length > 80 ? e.name.substring(0, 77) + '...' : e.name,
                    duration: e.duration,
                    size: e.transferSize,
                }));

            const scriptsTotalSize = scriptEntries.reduce((sum, e) => sum + e.transferSize, 0);
            const totalTransferSize = resourceEntries.reduce((sum, e) => sum + e.transferSize, 0);

            await browser.close();
            browser = null;

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                collectedAt: new Date(),
                payload: {
                    totalResources: resourceEntries.length,
                    totalTransferSize,
                    apiRequests: apiEntries.length,
                    totalApiDurationMs,
                    avgApiDurationMs,
                    maxApiDurationMs,
                    apiDetails,
                    scriptDurationMs,
                    scriptsCount: scriptEntries.length,
                    scriptsTotalSize,
                    // CDP Performance Metrics
                    taskDurationMs,
                    jsHeapUsedSize,
                    jsHeapTotalSize,
                    layoutCount,
                    layoutDurationMs,
                    recalcStyleCount,
                    recalcStyleDurationMs,
                    domNodes,
                    jsEventListeners,
                },
            };
        } catch (error) {
            this.logger.error('Resource timing collection failed:', (error as Error).message);
            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                collectedAt: new Date(),
                payload: {
                    totalResources: 0,
                    totalTransferSize: 0,
                    apiRequests: 0,
                    totalApiDurationMs: 0,
                    avgApiDurationMs: 0,
                    maxApiDurationMs: 0,
                    apiDetails: [],
                    scriptDurationMs: 0,
                    scriptsCount: 0,
                    scriptsTotalSize: 0,
                    taskDurationMs: 0,
                    jsHeapUsedSize: 0,
                    jsHeapTotalSize: 0,
                    layoutCount: 0,
                    layoutDurationMs: 0,
                    recalcStyleCount: 0,
                    recalcStyleDurationMs: 0,
                    domNodes: 0,
                    jsEventListeners: 0,
                    error: (error as Error).message,
                },
            };
        } finally {
            if (browser) {
                await browser.close().catch(() => { });
            }
        }
    }
}
