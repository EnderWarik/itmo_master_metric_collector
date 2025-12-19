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

const props = defineProps<{
  results: MetricResult[];
  errorMessage: string | null;
  isCollecting: boolean;
}>();

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
  // For DOM metrics, use totalMs as main value
  if (typeof payload.totalMs === 'number') return payload.totalMs;
  // For Lighthouse, use speedIndexMs as main value
  if (typeof payload.speedIndexMs === 'number') return payload.speedIndexMs;
  // For FPS, use avgFps as main value (not in ms, so return null to show custom display)
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
</script>

<template>
  <CardSurface>
    <template #header>
      <div class="header">
        <div>
          <p class="header__eyebrow">Результаты измерений</p>
          <h2 class="header__title">Последний запуск</h2>
        </div>
        <span v-if="lastRunTime" class="badge">
          {{ lastRunTime }}
        </span>
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
                    :style="{ flex: getTtfbTiming(result)!.tlsHandshakeMs }"
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
</style>
