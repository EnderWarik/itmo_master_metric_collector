<script setup lang="ts">
import { computed } from 'vue';
import { MetricGroup, type MetricResult } from '@/shared/types/metrics';
import CardSurface from '@/shared/ui/CardSurface.vue';

interface TtfbTiming {
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsHandshakeMs: number | null;
  serverProcessingMs: number;
}

interface DomTiming {
  redirectMs: number;
  redirectHidden: boolean;
  dnsMs: number;
  dnsCached: boolean;
  connectMs: number;
  connectionReused: boolean;
  sslMs: number | null;
  requestMs: number;
  responseMs: number;
  domParseMs: number;
  executeScriptsMs: number;
  subResourcesMs: number;
  domContentLoadedMs: number;
  loadEventMs: number;
}

interface LighthousePayload {
  speedIndexMs: number;
  speedIndexScore: number;
  fcpMs: number;
  lcpMs: number;
  ttiMs: number;
  tbtMs: number;
  cls: number;
  performanceScore: number;
  error?: string;
}

interface FpsPayload {
  avgFps: number;
  minFps: number;
  maxFps: number;
  totalFrames: number;
  durationMs: number;
  droppedFrames: number;
  droppedFramesPercent: number;
  error?: string;
}

interface ResourceTimingPayload {
  totalResources: number;
  totalTransferSize: number;
  apiRequests: number;
  totalApiDurationMs: number;
  avgApiDurationMs: number;
  maxApiDurationMs: number;
  apiDetails: { url: string; duration: number; size: number }[];
  scriptDurationMs: number;
  scriptsCount: number;
  scriptsTotalSize: number;

  cssCount: number;
  cssTotalSize: number;

  taskDurationMs: number;
  jsHeapUsedSize: number;
  jsHeapTotalSize: number;
  heapUsagePercent: number;
  layoutCount: number;
  layoutDurationMs: number;
  recalcStyleCount: number;
  recalcStyleDurationMs: number;
  domNodes: number;
  jsEventListeners: number;

  gcCount: number;
  gcTotalDurationMs: number;
  gcMaxDurationMs: number;

  unusedJsPercent: number;
  unusedCssPercent: number;
  jsTotalBytes: number;
  jsUnusedBytes: number;
  cssTotalBytes: number;
  cssUnusedBytes: number;

  jsParseMs: number;
  jsCompileMs: number;

  avgContentDownloadMs: number;
  maxContentDownloadMs: number;
  http2Percent: number;
  http3Percent: number;
  cacheHitPercent: number;
  cacheHitCount: number;
  swUsed: boolean;
  swStartMs: number;

  chunkedJsCount: number;
  largestChunkSize: number;
  uniqueDomains: number;
  domainsList: string[];
  error?: string;
}

const props = defineProps<{
  results: MetricResult[];
  allResults?: MetricResult[][];
  errorMessage: string | null;
  isCollecting: boolean;
}>();

// Функция экспорта всех замеров в CSV
function exportMetrics() {
  // Используем allResults если есть, иначе текущие results как один замер
  const runs = props.allResults?.length ? props.allResults : [props.results];
  const firstRun = runs[0];
  if (!firstRun || !firstRun.length) return;
  
  // Собираем все уникальные ключи метрик в формате "метрика:поле"
  const allKeys: string[] = [];
  const keySet = new Set<string>();
  
  firstRun.forEach(result => {
    const payload = result.payload as Record<string, unknown>;
    Object.keys(payload).forEach(key => {
      const value = payload[key];
      if (typeof value === 'number') {
        const fullKey = `${result.label}|${key}`;
        if (!keySet.has(fullKey)) {
          keySet.add(fullKey);
          allKeys.push(fullKey);
        }
      }
    });
  });
  
  const headers = ['Замер', ...allKeys.map(k => k.replace('|', ' - '))];
  
  // Строки данных по каждому замеру
  const dataRows: (string | number)[][] = runs.map((run, i) => {
    const row: (string | number)[] = [i + 1];
    allKeys.forEach(fullKey => {
      const [label, payloadKey] = fullKey.split('|');
      const result = run.find(r => r.label === label);
      if (result && payloadKey) {
        const payload = result.payload as Record<string, unknown>;
        const value = payload[payloadKey];
        row.push(typeof value === 'number' ? Math.round(value * 100) / 100 : '');
      } else {
        row.push('');
      }
    });
    return row;
  });
  
  // Строка со средним значением
  const avgRow: (string | number)[] = ['Среднее'];
  allKeys.forEach((_, colIndex) => {
    const values = dataRows
      .map(row => row[colIndex + 1])
      .filter(v => typeof v === 'number') as number[];
    if (values.length) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgRow.push(Math.round(avg * 100) / 100);
    } else {
      avgRow.push('');
    }
  });
  
  const allRows = runs.length > 1 ? [...dataRows, avgRow] : dataRows;
  
  const bom = '\uFEFF';
  const csv = bom + [headers.join(';'), ...allRows.map(row => row.join(';'))].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metrics-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const lastRunTime = computed(() => {
  if (!props.results.length) return null;
  const latest = props.results
    .map((r) => new Date(r.collectedAt).getTime())
    .reduce((a, b) => Math.max(a, b), 0);
  return new Date(latest).toLocaleTimeString();
});

const groupedResults = computed(() => {
  const groups: Record<MetricGroup, MetricResult[]> = {
    [MetricGroup.Server]: [],
    [MetricGroup.Browser]: [],
  };
  
  for (const result of props.results) {
    const group = result.group || MetricGroup.Server;
    groups[group].push(result);
  }
  
  return groups;
});

const groupLabels: Record<MetricGroup, string> = {
  [MetricGroup.Server]: '🖥️ Серверные метрики',
  [MetricGroup.Browser]: '🌐 Браузерные метрики',
};

function formatMs(ms: number): string {
  const seconds = ms / 1000;
  return seconds.toFixed(3);
}

function formatMsShort(ms: number | null | undefined): string {
  if (ms == null) return '—';
  return ms.toFixed(0);
}

function getMainValue(result: MetricResult): number | null {
  const payload = result.payload as Record<string, unknown>;
  if (typeof payload.elapsedMs === 'number') return payload.elapsedMs;
  if (typeof payload.ttfbMs === 'number') return payload.ttfbMs;

  if (typeof payload.totalMs === 'number') return payload.totalMs;

  if (typeof payload.speedIndexMs === 'number') return payload.speedIndexMs;

  if (typeof payload.avgFps === 'number') return null;
  return null;
}

function getTtfbTiming(result: MetricResult): TtfbTiming | null {
  if (result.key !== 'page.ttfb') return null;
  const payload = result.payload as Record<string, unknown>;
  if (payload.timing && typeof payload.timing === 'object') {
    return payload.timing as TtfbTiming;
  }
  return null;
}

function getDomTiming(result: MetricResult): DomTiming | null {
  if (result.key !== 'page.dom') return null;
  const payload = result.payload as Record<string, unknown>;
  if (payload.timing && typeof payload.timing === 'object') {
    return payload.timing as DomTiming;
  }
  return null;
}

function getLighthousePayload(result: MetricResult): LighthousePayload | null {
  if (result.key !== 'page.lighthouse') return null;
  return result.payload as LighthousePayload;
}

function getScoreClass(score: number): string {
  if (score >= 90) return 'score--good';
  if (score >= 50) return 'score--average';
  return 'score--poor';
}

function getFpsPayload(result: MetricResult): FpsPayload | null {
  if (result.key !== 'page.fps') return null;
  return result.payload as FpsPayload;
}

function getFpsClass(fps: number): string {
  if (fps >= 55) return 'fps--good';
  if (fps >= 30) return 'fps--average';
  return 'fps--poor';
}

function getResourceTimingPayload(result: MetricResult): ResourceTimingPayload | null {
  if (result.key !== 'page.resources') return null;
  return result.payload as ResourceTimingPayload;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function getHeapClass(percent: number): string {
  if (percent <= 50) return 'heap--good';
  if (percent <= 80) return 'heap--average';
  return 'heap--poor';
}

function getUnusedClass(percent: number): string {
  if (percent <= 20) return 'unused--good';
  if (percent <= 50) return 'unused--average';
  return 'unused--poor';
}
</script>

<template>
  <CardSurface>
    <template #header>
      <div class="header">
        <div>
          <p class="header__eyebrow">Результаты измерений</p>
          <h2 class="header__title">Последний запуск</h2>
        </div>
        <div class="header__actions">
          <button 
            v-if="results.length" 
            class="btn btn--export" 
            @click="exportMetrics"
          >
            📥 Экспорт CSV{{ allResults && allResults.length > 1 ? ` (${allResults.length})` : '' }}
          </button>
          <span v-if="lastRunTime" class="badge">
            {{ lastRunTime }}
          </span>
        </div>
      </div>
    </template>

    <div v-if="errorMessage" class="error">
      {{ errorMessage }}
    </div>

    <template v-else-if="props.results.length">
      <div
        v-for="(groupResults, groupKey) in groupedResults"
        :key="groupKey"
        class="group"
      >
        <template v-if="groupResults.length">
          <h3 class="group__title">{{ groupLabels[groupKey] }}</h3>
          
          <ul class="results">
            <li v-for="result in groupResults" :key="result.key" class="result">
              <div class="result__main">
                <div class="result__info">
                  <p class="result__label">{{ result.label }}</p>
                  <p v-if="result.description" class="result__description">{{ result.description }}</p>
                </div>
                <div class="result__value">
                  <template v-if="getFpsPayload(result)">
                    <span class="value__number" :class="getFpsClass(getFpsPayload(result)!.avgFps)">
                      {{ getFpsPayload(result)!.avgFps }}
                    </span>
                    <span class="value__unit">FPS</span>
                  </template>
                  <template v-else-if="getMainValue(result) !== null">
                    <span class="value__number">{{ formatMs(getMainValue(result)!) }}</span>
                    <span class="value__unit">сек</span>
                  </template>
                  <span v-else class="value__na">—</span>
                </div>
              </div>

              <!-- TTFB Timing Breakdown -->
              <div v-if="getTtfbTiming(result)" class="timing-breakdown">
                <div class="timing-bar">
                  <div
                    class="timing-segment timing-segment--dns"
                    :style="{ flex: getTtfbTiming(result)!.dnsLookupMs }"
                    :title="`DNS: ${formatMsShort(getTtfbTiming(result)!.dnsLookupMs)} мс`"
                  ></div>
                  <div
                    class="timing-segment timing-segment--tcp"
                    :style="{ flex: getTtfbTiming(result)!.tcpConnectMs }"
                    :title="`TCP: ${formatMsShort(getTtfbTiming(result)!.tcpConnectMs)} мс`"
                  ></div>
                  <div
                    v-if="getTtfbTiming(result)!.tlsHandshakeMs !== null"
                    class="timing-segment timing-segment--tls"
                    :style="{ flex: getTtfbTiming(result)!.tlsHandshakeMs ?? 0 }"
                    :title="`TLS: ${formatMsShort(getTtfbTiming(result)!.tlsHandshakeMs!)} мс`"
                  ></div>
                  <div
                    class="timing-segment timing-segment--server"
                    :style="{ flex: getTtfbTiming(result)!.serverProcessingMs }"
                    :title="`Server: ${formatMsShort(getTtfbTiming(result)!.serverProcessingMs)} мс`"
                  ></div>
                </div>
                <div class="timing-legend">
                  <span class="legend-item legend-item--dns">
                    DNS: {{ formatMsShort(getTtfbTiming(result)!.dnsLookupMs) }} мс
                  </span>
                  <span class="legend-item legend-item--tcp">
                    TCP: {{ formatMsShort(getTtfbTiming(result)!.tcpConnectMs) }} мс
                  </span>
                  <span v-if="getTtfbTiming(result)!.tlsHandshakeMs !== null" class="legend-item legend-item--tls">
                    TLS: {{ formatMsShort(getTtfbTiming(result)!.tlsHandshakeMs!) }} мс
                  </span>
                  <span class="legend-item legend-item--server">
                    Server: {{ formatMsShort(getTtfbTiming(result)!.serverProcessingMs) }} мс
                  </span>
                </div>
              </div>

              <!-- DOM Timing Breakdown -->
              <div v-if="getDomTiming(result)" class="timing-breakdown">
                <p class="timing-section-title">⏱️ Фазы загрузки</p>
                <div class="dom-metrics">
                  <div class="dom-metric dom-metric--redirect">
                    <span class="dom-metric__label">Redirect</span>
                    <span class="dom-metric__value">
                      {{ formatMsShort(getDomTiming(result)!.redirectMs) }} мс
                      <span v-if="getDomTiming(result)!.redirectHidden" class="badge badge--hidden">hidden</span>
                    </span>
                  </div>
                  <div class="dom-metric dom-metric--dns">
                    <span class="dom-metric__label">DNS</span>
                    <span class="dom-metric__value">
                      {{ formatMsShort(getDomTiming(result)!.dnsMs) }} мс
                      <span v-if="getDomTiming(result)!.dnsCached" class="badge badge--cached">cached</span>
                    </span>
                  </div>
                  <div class="dom-metric dom-metric--connect">
                    <span class="dom-metric__label">Connect</span>
                    <span class="dom-metric__value">
                      {{ formatMsShort(getDomTiming(result)!.connectMs) }} мс
                      <span v-if="getDomTiming(result)!.connectionReused" class="badge badge--reused">reused</span>
                    </span>
                  </div>
                  <div v-if="getDomTiming(result)!.sslMs !== null" class="dom-metric dom-metric--ssl">
                    <span class="dom-metric__label">SSL/TLS</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.sslMs!) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--request">
                    <span class="dom-metric__label">Request</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.requestMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--response">
                    <span class="dom-metric__label">Response</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.responseMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--parse">
                    <span class="dom-metric__label">DOM Parse</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.domParseMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--scripts">
                    <span class="dom-metric__label">Scripts</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.executeScriptsMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--resources">
                    <span class="dom-metric__label">Resources</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.subResourcesMs) }} мс</span>
                  </div>
                </div>
                
                <p class="timing-section-title">🎨 Ключевые моменты</p>
                <div class="dom-metrics">
                  <div class="dom-metric dom-metric--dcl">
                    <span class="dom-metric__label">DOMContentLoaded</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.domContentLoadedMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--load">
                    <span class="dom-metric__label">Load</span>
                    <span class="dom-metric__value">{{ formatMsShort(getDomTiming(result)!.loadEventMs) }} мс</span>
                  </div>
                </div>
              </div>

              <!-- Lighthouse Metrics -->
              <div v-if="getLighthousePayload(result)" class="timing-breakdown">
                <p class="timing-section-title">🚀 Performance Score</p>
                <div class="performance-score">
                  <span class="score-value" :class="getScoreClass(getLighthousePayload(result)!.performanceScore)">
                    {{ getLighthousePayload(result)!.performanceScore }}
                  </span>
                  <span class="score-label">/ 100</span>
                </div>
                
                <p class="timing-section-title">⚡ Web Vitals</p>
                <div class="dom-metrics">
                  <div class="dom-metric dom-metric--speed">
                    <span class="dom-metric__label">Speed Index</span>
                    <span class="dom-metric__value">{{ formatMsShort(getLighthousePayload(result)!.speedIndexMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--lcp">
                    <span class="dom-metric__label">LCP</span>
                    <span class="dom-metric__value">{{ formatMsShort(getLighthousePayload(result)!.lcpMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--fcp">
                    <span class="dom-metric__label">FCP</span>
                    <span class="dom-metric__value">{{ formatMsShort(getLighthousePayload(result)!.fcpMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--tti">
                    <span class="dom-metric__label">TTI</span>
                    <span class="dom-metric__value">{{ formatMsShort(getLighthousePayload(result)!.ttiMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--tbt">
                    <span class="dom-metric__label">TBT</span>
                    <span class="dom-metric__value">{{ formatMsShort(getLighthousePayload(result)!.tbtMs) }} мс</span>
                  </div>
                  <div class="dom-metric dom-metric--cls">
                    <span class="dom-metric__label">CLS</span>
                    <span class="dom-metric__value">{{ getLighthousePayload(result)!.cls.toFixed(3) }}</span>
                  </div>
                </div>
              </div>

              <!-- Resource Timing Breakdown -->
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">📊 Resource Timing</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Ресурсов</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.totalResources }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Всего скачано</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.totalTransferSize) }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">API запросов</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.apiRequests }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Общее время API</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.totalApiDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Avg API</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.avgApiDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Max API</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.maxApiDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Script Duration</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.scriptDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Скриптов</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.scriptsCount }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Размер скриптов</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.scriptsTotalSize) }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">CSS файлов</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.cssCount }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Размер CSS</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.cssTotalSize) }}</span>
                  </div>
                </div>
              </div>

              <!-- CDP Performance Metrics -->
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">🧠 V8 Performance</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Task Duration</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.taskDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">JS Heap Used</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.jsHeapUsedSize) }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">JS Heap Total</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.jsHeapTotalSize) }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Layout Count</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.layoutCount }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Layout Duration</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.layoutDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Style Recalc</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.recalcStyleCount }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Style Duration</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.recalcStyleDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">DOM Nodes</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.domNodes }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Event Listeners</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.jsEventListeners }}</span>
                  </div>
                </div>
              </div>

              <!-- GC Metrics -->
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">🗑️ Garbage Collection</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Heap Usage</span>
                    <span class="dom-metric__value" :class="getHeapClass(getResourceTimingPayload(result)!.heapUsagePercent)">
                      {{ getResourceTimingPayload(result)!.heapUsagePercent }}%
                    </span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">GC Count</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.gcCount }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">GC Total</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.gcTotalDurationMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">GC Max</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.gcMaxDurationMs }} мс</span>
                  </div>
                </div>
              </div>

              <!-- Code Coverage - disabled, not working reliably -->
              <!--
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">📊 Code Coverage</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Unused JS</span>
                    <span class="dom-metric__value" :class="getUnusedClass(getResourceTimingPayload(result)!.unusedJsPercent)">
                      {{ getResourceTimingPayload(result)!.unusedJsPercent }}%
                    </span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Unused CSS</span>
                    <span class="dom-metric__value" :class="getUnusedClass(getResourceTimingPayload(result)!.unusedCssPercent)">
                      {{ getResourceTimingPayload(result)!.unusedCssPercent }}%
                    </span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">JS Unused</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.jsUnusedBytes) }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">CSS Unused</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.cssUnusedBytes) }}</span>
                  </div>
                </div>
              </div>
              -->

              <!-- JS Parse/Compile -->
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">⚡ JS Parse/Compile</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Parse Time</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.jsParseMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Compile Time</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.jsCompileMs }} мс</span>
                  </div>
                </div>
              </div>

              <!-- Network Metrics -->
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">🌐 Network</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Avg Download</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.avgContentDownloadMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Max Download</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.maxContentDownloadMs }} мс</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">HTTP/2</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.http2Percent }}%</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Cache Hit</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.cacheHitPercent }}% ({{ getResourceTimingPayload(result)!.cacheHitCount }})</span>
                  </div>
                  <div v-if="getResourceTimingPayload(result)!.swUsed" class="dom-metric">
                    <span class="dom-metric__label">Service Worker</span>
                    <span class="dom-metric__value">✓ {{ getResourceTimingPayload(result)!.swStartMs }} мс</span>
                  </div>
                </div>
              </div>

              <!-- MFE Comparison Metrics -->
              <div v-if="getResourceTimingPayload(result)" class="timing-breakdown">
                <p class="timing-section-title">📦 MFE Comparison</p>
                <div class="dom-metrics">
                  <div class="dom-metric">
                    <span class="dom-metric__label">Lazy Chunks</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.chunkedJsCount }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Largest Chunk</span>
                    <span class="dom-metric__value">{{ formatBytes(getResourceTimingPayload(result)!.largestChunkSize) }}</span>
                  </div>
                  <div class="dom-metric">
                    <span class="dom-metric__label">Domains</span>
                    <span class="dom-metric__value">{{ getResourceTimingPayload(result)!.uniqueDomains }}</span>
                  </div>
                </div>
                <div v-if="getResourceTimingPayload(result)!.domainsList.length > 1" class="domains-list">
                  <small>{{ getResourceTimingPayload(result)!.domainsList.join(' · ') }}</small>
                </div>
              </div>

              <details class="details">
                <summary class="details__summary">Техническая информация</summary>
                <pre class="payload__code">{{ JSON.stringify(result.payload, null, 2) }}</pre>
              </details>
            </li>
          </ul>
        </template>
      </div>
    </template>

    <p v-else class="placeholder">
      {{ isCollecting ? 'Идёт замер…' : 'Запусти первый замер, чтобы увидеть результат.' }}
    </p>
  </CardSurface>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.header__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn--export {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--export:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.header__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.75rem;
  color: #94a3b8;
}

.header__title {
  margin: 0.25rem 0 0;
  color: #0f172a;
}

.badge {
  background: #eef2ff;
  color: #4f46e5;
  font-size: 0.75rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  white-space: nowrap;
}

.error {
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  margin: 0;
}

.placeholder {
  margin: 0;
  color: #94a3b8;
}

.group {
  margin-bottom: 1.5rem;
}

.group:last-child {
  margin-bottom: 0;
}

.group__title {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
}

.results {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result {
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 1rem;
  padding: 1rem;
  background: #f8fafc;
}

.result__main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.result__info {
  flex: 1;
  min-width: 0;
}

.result__label {
  margin: 0;
  font-weight: 600;
  color: #0f172a;
}

.result__description {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.4;
}

.result__value {
  text-align: right;
  flex-shrink: 0;
}

.value__number {
  font-size: 1.75rem;
  font-weight: 700;
  color: #4f46e5;
  font-variant-numeric: tabular-nums;
}

.value__unit {
  margin-left: 0.25rem;
  font-size: 0.9rem;
  color: #64748b;
}

.value__na {
  font-size: 1.5rem;
  color: #94a3b8;
}

/* Timing Breakdown */
.timing-breakdown {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.timing-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: #e2e8f0;
}

.timing-segment {
  min-width: 2px;
  transition: flex 0.3s ease;
}

.timing-segment--dns {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
}

.timing-segment--tcp {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.timing-segment--tls {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.timing-segment--server {
  background: linear-gradient(135deg, #10b981, #059669);
}

.timing-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #64748b;
}

.legend-item::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-item--dns::before {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
}

.legend-item--tcp::before {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.legend-item--tls::before {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.legend-item--server::before {
  background: linear-gradient(135deg, #10b981, #059669);
}

/* DOM Metrics */
.timing-section-title {
  margin: 0.75rem 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}

.timing-section-title:first-child {
  margin-top: 0;
}

.dom-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
}

.dom-metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: #e2e8f0;
  border-radius: 0.5rem;
}

.dom-metric__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.dom-metric__value {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.6rem;
  font-weight: 500;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge--cached {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge--reused {
  background: #dcfce7;
  color: #15803d;
}

.badge--hidden {
  background: #fef3c7;
  color: #b45309;
}

/* Performance Score */
.performance-score {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.score-value {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  font-size: 1rem;
  color: #64748b;
}

.score--good {
  color: #22c55e;
}

.score--average {
  color: #f59e0b;
}

.score--poor {
  color: #ef4444;
}

/* Heap Usage */
.heap--good {
  color: #22c55e;
}

.heap--average {
  color: #f59e0b;
}

.heap--poor {
  color: #ef4444;
}

/* Unused Code (lower = better) */
.unused--good {
  color: #22c55e;
}

.unused--average {
  color: #f59e0b;
}

.unused--poor {
  color: #ef4444;
}

.details {
  margin-top: 0.75rem;
}

.details__summary {
  cursor: pointer;
  font-size: 0.85rem;
  color: #64748b;
  user-select: none;
  padding: 0.25rem 0;
}

.details__summary:hover {
  color: #4f46e5;
}

.payload__code {
  background: #0f172a;
  color: #f8fafc;
  border-radius: 0.75rem;
  padding: 1rem;
  margin: 0.5rem 0 0;
  overflow: auto;
  font-size: 0.85rem;
}

/* FPS Metrics */
.fps-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 1rem;
  margin-top: 0.75rem;
}

.fps-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
}

.fps-metric__value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}

.fps-metric__label {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.fps--good {
  color: #22c55e !important;
}

.fps--average {
  color: #f59e0b !important;
}

.fps--poor {
  color: #ef4444 !important;
}

.domains-list {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(100, 116, 139, 0.1);
  border-radius: 0.375rem;
  word-break: break-all;
}

.domains-list small {
  color: #64748b;
  font-size: 0.75rem;
}
</style>
