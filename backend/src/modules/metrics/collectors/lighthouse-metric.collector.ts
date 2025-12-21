import { Injectable, Logger } from '@nestjs/common';
import lighthouse, { Flags } from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import {
    MetricCollector,
    MetricGroup,
    MetricResult,
} from './metric-collector.interface';

export interface LighthouseMetricsPayload {
    /** Speed Index в миллисекундах */
    speedIndexMs: number;
    /** Speed Index score (0-100) */
    speedIndexScore: number;
    /** First Contentful Paint в миллисекундах */
    fcpMs: number;
    /** Largest Contentful Paint в миллисекундах */
    lcpMs: number;
    /** Time to Interactive в миллисекундах */
    ttiMs: number;
    /** Total Blocking Time в миллисекундах */
    tbtMs: number;
    /** Cumulative Layout Shift */
    cls: number;
    /** Performance score (0-100) */
    performanceScore: number;
    error?: string;
}

@Injectable()
export class LighthouseMetricCollector
    implements MetricCollector<LighthouseMetricsPayload> {
    private readonly logger = new Logger(LighthouseMetricCollector.name);

    readonly key = 'page.lighthouse';
    readonly label = 'Lighthouse Metrics';
    readonly group = MetricGroup.Browser;
    readonly description =
        'Web Vitals метрики: Speed Index, LCP, FCP, TTI, TBT, CLS и общий Performance score.';

    async collect(url: string): Promise<MetricResult<LighthouseMetricsPayload>> {
        let chrome: chromeLauncher.LaunchedChrome | null = null;

        try {

            const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            chrome = await chromeLauncher.launch({
                chromeFlags: [
                    '--headless',
                    '--no-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                ],
                chromePath: executablePath || undefined,
            });

            const flags: Flags = {
                port: chrome.port,
                output: 'json',
                onlyCategories: ['performance'],
                formFactor: 'desktop',
                screenEmulation: {
                    mobile: false,
                    width: 1920,
                    height: 1080,
                    deviceScaleFactor: 1,
                    disabled: false,
                },

            };

            const runnerResult = await lighthouse(url, flags);

            if (!runnerResult) {
                throw new Error('Lighthouse did not return results');
            }

            const { lhr } = runnerResult;
            const audits = lhr.audits;

            const payload: LighthouseMetricsPayload = {
                speedIndexMs: Math.round(audits['speed-index']?.numericValue ?? 0),
                speedIndexScore: Math.round((audits['speed-index']?.score ?? 0) * 100),
                fcpMs: Math.round(audits['first-contentful-paint']?.numericValue ?? 0),
                lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue ?? 0),
                ttiMs: Math.round(audits['interactive']?.numericValue ?? 0),
                tbtMs: Math.round(audits['total-blocking-time']?.numericValue ?? 0),
                cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
                performanceScore: Math.round((lhr.categories.performance?.score ?? 0) * 100),
            };

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                payload,
                collectedAt: new Date(),
            };
        } catch (error) {
            this.logger.error('Error collecting Lighthouse metrics:', (error as Error).message);

            return {
                key: this.key,
                label: this.label,
                group: this.group,
                description: this.description,
                payload: {
                    speedIndexMs: 0,
                    speedIndexScore: 0,
                    fcpMs: 0,
                    lcpMs: 0,
                    ttiMs: 0,
                    tbtMs: 0,
                    cls: 0,
                    performanceScore: 0,
                    error: (error as Error).message,
                },
                collectedAt: new Date(),
            };
        } finally {
            if (chrome) {
                await chrome.kill();
            }
        }
    }
}
