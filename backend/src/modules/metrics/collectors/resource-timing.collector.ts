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
    responseStart: number;
    responseEnd: number;
    nextHopProtocol: string;
    workerStart: number;
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

    // CSS Metrics
    /** Количество CSS файлов */
    cssCount: number;
    /** Общий размер CSS (bytes) */
    cssTotalSize: number;

    // CDP Performance Metrics
    /** Время всех задач в main thread (мс) */
    taskDurationMs: number;
    /** Использованная память JS heap (bytes) */
    jsHeapUsedSize: number;
    /** Общий размер JS heap (bytes) */
    jsHeapTotalSize: number;
    /** Процент использования heap */
    heapUsagePercent: number;
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

    // GC Metrics
    /** Количество сборок мусора */
    gcCount: number;
    /** Суммарное время GC (мс) */
    gcTotalDurationMs: number;
    /** Максимальная длительность одной GC (мс) */
    gcMaxDurationMs: number;

    // Coverage Metrics
    /** % неиспользуемого JS кода */
    unusedJsPercent: number;
    /** % неиспользуемого CSS кода */
    unusedCssPercent: number;
    /** Общий размер JS (bytes) */
    jsTotalBytes: number;
    /** Неиспользованный JS (bytes) */
    jsUnusedBytes: number;
    /** Общий размер CSS (bytes) - Coverage */
    cssTotalBytes: number;
    /** Неиспользованный CSS (bytes) */
    cssUnusedBytes: number;

    // JS Parse/Compile Metrics
    /** Время парсинга JS (мс) */
    jsParseMs: number;
    /** Время компиляции JS (мс) */
    jsCompileMs: number;

    // Network Metrics
    /** Среднее время загрузки контента (мс) */
    avgContentDownloadMs: number;
    /** Максимальное время загрузки контента (мс) */
    maxContentDownloadMs: number;
    /** % ресурсов по HTTP/2 */
    http2Percent: number;
    /** % ресурсов по HTTP/3 */
    http3Percent: number;
    /** % ресурсов из кэша */
    cacheHitPercent: number;
    /** Количество ресурсов из кэша */
    cacheHitCount: number;
    /** Service Worker использовался */
    swUsed: boolean;
    /** Время инициализации Service Worker (мс) */
    swStartMs: number;

    // MFE Comparison Metrics
    /** Количество ленивых JS чанков */
    chunkedJsCount: number;
    /** Размер самого большого скрипта (bytes) */
    largestChunkSize: number;
    /** Количество уникальных доменов */
    uniqueDomains: number;
    /** Список уникальных доменов */
    domainsList: string[];

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

            // Собираем GC и Compile события через Tracing
            const gcEvents: { name: string; dur: number }[] = [];
            const compileEvents: { name: string; dur: number }[] = [];
            client.on('Tracing.dataCollected', (data) => {
                for (const event of data.value || []) {
                    // GC события
                    if (event.cat?.includes('v8.gc') || event.name?.includes('GC')) {
                        gcEvents.push({
                            name: event.name,
                            dur: event.dur ? event.dur / 1000 : 0, // микросекунды → мс
                        });
                    }
                    // Compile/Parse события
                    if (event.cat?.includes('v8') &&
                        (event.name === 'V8.Compile' || event.name === 'V8.CompileCode' ||
                            event.name === 'v8.compile' || event.name === 'V8.ParseFunction' ||
                            event.name === 'V8.Parse' || event.name === 'v8.parseOnBackground')) {
                        compileEvents.push({
                            name: event.name,
                            dur: event.dur ? event.dur / 1000 : 0,
                        });
                    }
                }
            });

            await client.send('Tracing.start', {
                categories: 'v8,v8.gc,v8.compile,disabled-by-default-v8.gc,disabled-by-default-v8.compile',
                transferMode: 'ReportEvents',
            });

            // Включаем Coverage для JS и CSS
            await client.send('Profiler.enable');
            await client.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
            await client.send('DOM.enable');
            await client.send('CSS.enable');
            await client.send('CSS.startRuleUsageTracking');

            // Переходим на страницу
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            // Ждём дополнительно для полной загрузки
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Останавливаем tracing
            await client.send('Tracing.end');
            // Ждём завершения сбора данных
            await new Promise(resolve => setTimeout(resolve, 200));

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
                    responseStart: entry.responseStart || 0,
                    responseEnd: entry.responseEnd || 0,
                    nextHopProtocol: entry.nextHopProtocol || '',
                    workerStart: entry.workerStart || 0,
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

            // Фильтруем CSS
            const cssEntries = resourceEntries.filter(
                e => e.initiatorType === 'css' || e.initiatorType === 'link'
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
            const cssTotalSize = cssEntries.reduce((sum, e) => sum + e.transferSize, 0);
            const totalTransferSize = resourceEntries.reduce((sum, e) => sum + e.transferSize, 0);

            // Расчёт heap usage %
            const heapUsagePercent = jsHeapTotalSize > 0
                ? Math.round((jsHeapUsedSize / jsHeapTotalSize) * 100)
                : 0;

            // GC метрики
            const gcCount = gcEvents.length;
            const gcTotalDurationMs = Math.round(gcEvents.reduce((sum, e) => sum + e.dur, 0));
            const gcMaxDurationMs = gcEvents.length > 0
                ? Math.round(Math.max(...gcEvents.map(e => e.dur)))
                : 0;

            // JS Parse/Compile метрики
            const parseEvents = compileEvents.filter(e =>
                e.name.includes('Parse') || e.name.includes('parse'));
            const compileOnlyEvents = compileEvents.filter(e =>
                e.name.includes('Compile') || e.name.includes('compile'));
            const jsParseMs = Math.round(parseEvents.reduce((sum, e) => sum + e.dur, 0));
            const jsCompileMs = Math.round(compileOnlyEvents.reduce((sum, e) => sum + e.dur, 0));

            // Собираем Coverage данные
            let jsTotalBytes = 0;
            let jsUnusedBytes = 0;
            let cssTotalBytes = 0;
            let cssUnusedBytes = 0;

            try {
                // JS Coverage - используем endOffset из функций для определения размера
                const jsCoverage = await client.send('Profiler.takePreciseCoverage');
                for (const entry of jsCoverage.result || []) {
                    // Находим максимальный endOffset как приближение к размеру скрипта
                    let scriptSize = 0;
                    let usedBytes = 0;

                    for (const func of entry.functions || []) {
                        for (const range of func.ranges || []) {
                            // Первый range каждой функции - весь код функции
                            // Последующие - использованные части
                            if (range.endOffset > scriptSize) {
                                scriptSize = range.endOffset;
                            }
                            // count > 0 означает код был выполнен
                            if (range.count > 0) {
                                usedBytes += range.endOffset - range.startOffset;
                            }
                        }
                    }

                    if (scriptSize > 0) {
                        jsTotalBytes += scriptSize;
                        jsUnusedBytes += Math.max(0, scriptSize - usedBytes);
                    }
                }

                // CSS Coverage
                const cssCoverage = await client.send('CSS.stopRuleUsageTracking');
                for (const rule of cssCoverage.ruleUsage || []) {
                    cssTotalBytes += rule.endOffset - rule.startOffset;
                    if (!rule.used) {
                        cssUnusedBytes += rule.endOffset - rule.startOffset;
                    }
                }
            } catch (coverageError) {
                this.logger.warn('Coverage collection failed:', (coverageError as Error).message);
            }

            // Останавливаем Profiler
            await client.send('Profiler.stopPreciseCoverage').catch(() => { });
            await client.send('Profiler.disable').catch(() => { });

            const unusedJsPercent = jsTotalBytes > 0 ? Math.round((jsUnusedBytes / jsTotalBytes) * 100) : 0;
            const unusedCssPercent = cssTotalBytes > 0 ? Math.round((cssUnusedBytes / cssTotalBytes) * 100) : 0;

            // Network Metrics
            const contentDownloadTimes = resourceEntries
                .filter(e => e.responseStart > 0 && e.responseEnd > 0)
                .map(e => Math.round(e.responseEnd - e.responseStart));
            const avgContentDownloadMs = contentDownloadTimes.length > 0
                ? Math.round(contentDownloadTimes.reduce((a, b) => a + b, 0) / contentDownloadTimes.length)
                : 0;
            const maxContentDownloadMs = contentDownloadTimes.length > 0
                ? Math.max(...contentDownloadTimes)
                : 0;

            // HTTP Protocol distribution
            const http2Count = resourceEntries.filter(e => e.nextHopProtocol === 'h2' || e.nextHopProtocol === 'h2c').length;
            const http3Count = resourceEntries.filter(e => e.nextHopProtocol === 'h3').length;
            const http2Percent = resourceEntries.length > 0 ? Math.round((http2Count / resourceEntries.length) * 100) : 0;
            const http3Percent = resourceEntries.length > 0 ? Math.round((http3Count / resourceEntries.length) * 100) : 0;

            // Cache metrics
            const cacheHitCount = resourceEntries.filter(e => e.transferSize === 0).length;
            const cacheHitPercent = resourceEntries.length > 0 ? Math.round((cacheHitCount / resourceEntries.length) * 100) : 0;

            // Service Worker
            const swUsed = resourceEntries.some(e => e.workerStart > 0);
            const swStartMs = swUsed
                ? Math.round(Math.min(...resourceEntries.filter(e => e.workerStart > 0).map(e => e.workerStart)))
                : 0;

            // MFE Comparison Metrics
            // Количество JS файлов (чем больше — тем больше code-split)
            const chunkedJsCount = scriptEntries.length;

            // Самый большой скрипт
            const largestChunkSize = scriptEntries.length > 0
                ? Math.max(...scriptEntries.map(e => e.transferSize))
                : 0;

            // Уникальные домены
            const domains = new Set<string>();
            for (const entry of resourceEntries) {
                try {
                    const url = new URL(entry.name);
                    domains.add(url.hostname);
                } catch {
                    // пропускаем невалидные URL (data:, blob:, etc)
                }
            }
            const domainsList = Array.from(domains).sort();
            const uniqueDomains = domainsList.length;

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
                    // CSS Metrics
                    cssCount: cssEntries.length,
                    cssTotalSize,
                    // CDP Performance Metrics
                    taskDurationMs,
                    jsHeapUsedSize,
                    jsHeapTotalSize,
                    heapUsagePercent,
                    layoutCount,
                    layoutDurationMs,
                    recalcStyleCount,
                    recalcStyleDurationMs,
                    domNodes,
                    jsEventListeners,
                    // GC Metrics
                    gcCount,
                    gcTotalDurationMs,
                    gcMaxDurationMs,
                    // Coverage Metrics
                    unusedJsPercent,
                    unusedCssPercent,
                    jsTotalBytes,
                    jsUnusedBytes,
                    cssTotalBytes,
                    cssUnusedBytes,
                    // JS Parse/Compile Metrics
                    jsParseMs,
                    jsCompileMs,
                    // Network Metrics
                    avgContentDownloadMs,
                    maxContentDownloadMs,
                    http2Percent,
                    http3Percent,
                    cacheHitPercent,
                    cacheHitCount,
                    swUsed,
                    swStartMs,
                    // MFE Comparison Metrics
                    chunkedJsCount,
                    largestChunkSize,
                    uniqueDomains,
                    domainsList,
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
                    cssCount: 0,
                    cssTotalSize: 0,
                    taskDurationMs: 0,
                    jsHeapUsedSize: 0,
                    jsHeapTotalSize: 0,
                    heapUsagePercent: 0,
                    layoutCount: 0,
                    layoutDurationMs: 0,
                    recalcStyleCount: 0,
                    recalcStyleDurationMs: 0,
                    domNodes: 0,
                    jsEventListeners: 0,
                    gcCount: 0,
                    gcTotalDurationMs: 0,
                    gcMaxDurationMs: 0,
                    unusedJsPercent: 0,
                    unusedCssPercent: 0,
                    jsTotalBytes: 0,
                    jsUnusedBytes: 0,
                    cssTotalBytes: 0,
                    cssUnusedBytes: 0,
                    jsParseMs: 0,
                    jsCompileMs: 0,
                    avgContentDownloadMs: 0,
                    maxContentDownloadMs: 0,
                    http2Percent: 0,
                    http3Percent: 0,
                    cacheHitPercent: 0,
                    cacheHitCount: 0,
                    swUsed: false,
                    swStartMs: 0,
                    chunkedJsCount: 0,
                    largestChunkSize: 0,
                    uniqueDomains: 0,
                    domainsList: [],
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
