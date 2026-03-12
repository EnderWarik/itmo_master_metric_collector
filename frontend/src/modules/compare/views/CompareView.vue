<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import AppShell from '@/modules/layout/components/AppShell.vue';
import CardSurface from '@/shared/ui/CardSurface.vue';
import InputField from '@/shared/ui/InputField.vue';
import ButtonPrimary from '@/shared/ui/ButtonPrimary.vue';
import type { MetricResult } from '@/shared/types/metrics';
import { metricsApi, type E2EResult, type Scenario } from '@/modules/metrics/services/metricsApi';

const form = reactive({
  urlA: '',
  urlB: '',
  labelA: 'Site A',
  labelB: 'Site B',
  runE2E: true,
  repeatCount: 3,
});

const isRunning = ref(false);
const progress = ref('');
const error = ref('');

interface CompareData {
  metrics: MetricResult[];
  e2e: E2EResult | null;
}

const dataA = ref<CompareData | null>(null);
const dataB = ref<CompareData | null>(null);

const pizzaScenario = (url: string): Scenario => ({
  name: 'Pizza order',
  url,
  steps: [
    { action: 'type', selector: 'input[name="pizza_name"]', value: 'my pizza', label: 'Name' },
    { action: 'click', selector: 'div[class*="result"] button', label: 'Cook' },
    { action: 'wait', value: 500, label: 'Wait' },
    { action: 'type', selector: 'input[name="street"]', value: 'Lenina', label: 'Street' },
    { action: 'type', selector: 'input[name="house"]', value: '43', label: 'House' },
    { action: 'type', selector: 'input[name="tel"]', value: '+79141234567', label: 'Phone' },
    { action: 'click', selector: 'button[type="submit"]', label: 'Submit' },
    { action: 'wait', value: 1000, label: 'Wait response' },
  ],
});

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function averageMetrics(runs: MetricResult[][]): MetricResult[] {
  if (!runs.length) return [];
  const first = runs[0]!;
  return first.map((metric, idx) => {
    const payloads = runs.map(r => r[idx]?.payload as Record<string, unknown>).filter(Boolean);
    if (!payloads.length) return metric;
    const averaged: Record<string, unknown> = {};
    for (const key of Object.keys(payloads[0]!)) {
      const vals = payloads.map(p => p[key]).filter(v => typeof v === 'number') as number[];
      if (vals.length === payloads.length) {
        averaged[key] = avg(vals);
      } else {
        averaged[key] = payloads[0]![key];
      }
    }
    // Handle nested timing objects
    const firstPayload = payloads[0] as Record<string, unknown>;
    for (const key of Object.keys(firstPayload)) {
      if (typeof firstPayload[key] === 'object' && firstPayload[key] !== null && !Array.isArray(firstPayload[key])) {
        const nested = firstPayload[key] as Record<string, unknown>;
        const avgNested: Record<string, unknown> = {};
        for (const nk of Object.keys(nested)) {
          const nvals = payloads.map(p => (p[key] as Record<string, unknown>)?.[nk]).filter(v => typeof v === 'number') as number[];
          if (nvals.length === payloads.length) {
            avgNested[nk] = avg(nvals);
          } else {
            avgNested[nk] = nested[nk];
          }
        }
        averaged[key] = avgNested;
      }
    }
    return { ...metric, payload: averaged };
  });
}

function averageE2E(runs: E2EResult[]): E2EResult | null {
  const valid = runs.filter(r => r.success);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0]!;
  const f = valid[0]!;
  return {
    ...f,
    totalDurationMs: Math.round(avg(valid.map(r => r.totalDurationMs))),
    scenarioDurationMs: Math.round(avg(valid.map(r => r.scenarioDurationMs))),
    totalLongTasks: Math.round(avg(valid.map(r => r.totalLongTasks))),
    totalLongTasksMs: Math.round(avg(valid.map(r => r.totalLongTasksMs))),
    avgInputDelayMs: +avg(valid.map(r => r.avgInputDelayMs)).toFixed(1),
    maxInputDelayMs: +avg(valid.map(r => r.maxInputDelayMs)).toFixed(1),
    avgFps: Math.round(avg(valid.filter(r => r.avgFps).map(r => r.avgFps!))),
    minFps: Math.round(avg(valid.filter(r => r.minFps).map(r => r.minFps!))),
    totalFrames: Math.round(avg(valid.filter(r => r.totalFrames).map(r => r.totalFrames!))),
    droppedFrames: Math.round(avg(valid.filter(r => r.droppedFrames != null).map(r => r.droppedFrames!))),
    avgHeapUsagePercent: +avg(valid.filter(r => r.avgHeapUsagePercent).map(r => r.avgHeapUsagePercent!)).toFixed(1),
    maxHeapUsagePercent: +avg(valid.filter(r => r.maxHeapUsagePercent).map(r => r.maxHeapUsagePercent!)).toFixed(1),
    success: true,
  };
}

async function collectSite(url: string, label: string): Promise<CompareData> {
  const allMetrics: MetricResult[][] = [];
  const allE2E: E2EResult[] = [];

  for (let i = 0; i < form.repeatCount; i++) {
    progress.value = `${label}: замер ${i + 1}/${form.repeatCount} — метрики`;
    const metrics = await metricsApi.collectAll({ url });
    allMetrics.push(metrics);

    if (form.runE2E) {
      progress.value = `${label}: замер ${i + 1}/${form.repeatCount} — E2E`;
      try {
        const e2e = await metricsApi.runE2EScenario(pizzaScenario(url));
        allE2E.push(e2e);
      } catch (err) {
        allE2E.push({
          scenarioName: 'Pizza', url, steps: [],
          totalDurationMs: 0, scenarioDurationMs: 0,
          totalLongTasks: 0, totalLongTasksMs: 0,
          avgInputDelayMs: 0, maxInputDelayMs: 0,
          success: false, error: (err as Error).message,
        });
      }
    }
  }

  return {
    metrics: form.repeatCount > 1 ? averageMetrics(allMetrics) : allMetrics[0]!,
    e2e: allE2E.length ? (form.repeatCount > 1 ? averageE2E(allE2E) : allE2E[0] ?? null) : null,
  };
}

async function handleCompare() {
  if (!form.urlA || !form.urlB) return;
  isRunning.value = true;
  error.value = '';
  dataA.value = null;
  dataB.value = null;

  try {
    dataA.value = await collectSite(form.urlA, form.labelA);
    dataB.value = await collectSite(form.urlB, form.labelB);
    progress.value = '';
  } catch (err) {
    error.value = (err as Error).message;
    progress.value = '';
  } finally {
    isRunning.value = false;
  }
}

// --- Comparison table logic ---

interface CompareRow {
  group: string;
  metric: string;
  valueA: string;
  valueB: string;
  delta: string;
  deltaClass: string;
}

function fmtNum(v: unknown, decimals = 1): string {
  if (typeof v !== 'number' || isNaN(v)) return '-';
  if (Number.isInteger(v) && Math.abs(v) < 1000) return String(v);
  return v.toFixed(decimals);
}

function fmtBytes(v: unknown): string {
  if (typeof v !== 'number') return '-';
  if (v > 1048576) return (v / 1048576).toFixed(2) + ' MB';
  if (v > 1024) return (v / 1024).toFixed(1) + ' KB';
  return v + ' B';
}

function calcDelta(a: unknown, b: unknown): { text: string; cls: string } {
  if (typeof a !== 'number' || typeof b !== 'number' || a === 0) {
    if (a === b) return { text: '=', cls: 'neutral' };
    return { text: '-', cls: 'neutral' };
  }
  const pct = ((b - a) / Math.abs(a)) * 100;
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    cls: Math.abs(pct) < 2 ? 'neutral' : pct > 0 ? 'worse' : 'better',
  };
}

// For metrics where higher is better (like performance score), invert delta coloring
function calcDeltaInverted(a: unknown, b: unknown): { text: string; cls: string } {
  const d = calcDelta(a, b);
  if (d.cls === 'worse') d.cls = 'better';
  else if (d.cls === 'better') d.cls = 'worse';
  return d;
}

function getPayload(results: MetricResult[], key: string): Record<string, unknown> | null {
  const r = results.find(m => m.key === key);
  return r ? (r.payload as Record<string, unknown>) : null;
}

const rows = computed<CompareRow[]>(() => {
  if (!dataA.value || !dataB.value) return [];
  const a = dataA.value.metrics;
  const b = dataB.value.metrics;
  const result: CompareRow[] = [];

  // Helper
  const add = (group: string, metric: string, valA: unknown, valB: unknown, format: 'num' | 'bytes' | 'score' = 'num', higherBetter = false) => {
    const fmt = format === 'bytes' ? fmtBytes : fmtNum;
    const d = higherBetter ? calcDeltaInverted(valA, valB) : calcDelta(valA, valB);
    result.push({
      group,
      metric,
      valueA: fmt(valA) as string,
      valueB: fmt(valB) as string,
      delta: d.text,
      deltaClass: d.cls,
    });
  };

  // Ping
  const pingA = getPayload(a, 'availability.ping');
  const pingB = getPayload(b, 'availability.ping');
  if (pingA && pingB) {
    add('Ping', 'Elapsed, ms', pingA.elapsedMs, pingB.elapsedMs);
  }

  // TTFB
  const ttfbA = getPayload(a, 'page.ttfb');
  const ttfbB = getPayload(b, 'page.ttfb');
  if (ttfbA && ttfbB) {
    add('TTFB', 'TTFB, ms', ttfbA.ttfbMs, ttfbB.ttfbMs);
    const tA = ttfbA.timing as Record<string, unknown> | undefined;
    const tB = ttfbB.timing as Record<string, unknown> | undefined;
    if (tA && tB) {
      add('TTFB', 'DNS Lookup, ms', tA.dnsLookupMs, tB.dnsLookupMs);
      add('TTFB', 'TCP Connect, ms', tA.tcpConnectMs, tB.tcpConnectMs);
      add('TTFB', 'TLS Handshake, ms', tA.tlsHandshakeMs, tB.tlsHandshakeMs);
      add('TTFB', 'Server Processing, ms', tA.serverProcessingMs, tB.serverProcessingMs);
    }
  }

  // Navigation Timing
  const domA = getPayload(a, 'page.dom');
  const domB = getPayload(b, 'page.dom');
  if (domA && domB) {
    const tA = domA.timing as Record<string, unknown> | undefined;
    const tB = domB.timing as Record<string, unknown> | undefined;
    if (tA && tB) {
      add('Navigation Timing', 'Response, ms', tA.responseMs, tB.responseMs);
      add('Navigation Timing', 'DOM Parse, ms', tA.domParseMs, tB.domParseMs);
      add('Navigation Timing', 'Execute Scripts, ms', tA.executeScriptsMs, tB.executeScriptsMs);
      add('Navigation Timing', 'Sub Resources, ms', tA.subResourcesMs, tB.subResourcesMs);
      add('Navigation Timing', 'DOMContentLoaded, ms', tA.domContentLoadedMs, tB.domContentLoadedMs);
      add('Navigation Timing', 'Load Event, ms', tA.loadEventMs, tB.loadEventMs);
    }
    add('Navigation Timing', 'Total, ms', domA.totalMs, domB.totalMs);
  }

  // Lighthouse
  const lhA = getPayload(a, 'page.lighthouse');
  const lhB = getPayload(b, 'page.lighthouse');
  if (lhA && lhB) {
    add('Lighthouse', 'Speed Index, ms', lhA.speedIndexMs, lhB.speedIndexMs);
    add('Lighthouse', 'FCP, ms', lhA.fcpMs, lhB.fcpMs);
    add('Lighthouse', 'LCP, ms', lhA.lcpMs, lhB.lcpMs);
    add('Lighthouse', 'TTI, ms', lhA.ttiMs, lhB.ttiMs);
    add('Lighthouse', 'TBT, ms', lhA.tbtMs, lhB.tbtMs);
    add('Lighthouse', 'CLS', lhA.cls, lhB.cls);
    add('Lighthouse', 'Performance Score', lhA.performanceScore, lhB.performanceScore, 'num', true);
  }

  // Resource Timing
  const rtA = getPayload(a, 'page.resources');
  const rtB = getPayload(b, 'page.resources');
  if (rtA && rtB) {
    add('Resources', 'Total Resources', rtA.totalResources, rtB.totalResources);
    add('Resources', 'Transfer Size', rtA.totalTransferSize, rtB.totalTransferSize, 'bytes');
    add('Resources', 'Scripts Count', rtA.scriptsCount, rtB.scriptsCount);
    add('Resources', 'Scripts Size', rtA.scriptsTotalSize, rtB.scriptsTotalSize, 'bytes');
    add('Resources', 'Unique Domains', rtA.uniqueDomains, rtB.uniqueDomains);

    add('V8 / Rendering', 'JS Parse, ms', rtA.jsParseMs, rtB.jsParseMs);
    add('V8 / Rendering', 'JS Compile, ms', rtA.jsCompileMs, rtB.jsCompileMs);
    add('V8 / Rendering', 'Task Duration, ms', rtA.taskDurationMs, rtB.taskDurationMs);
    add('V8 / Rendering', 'Layout Count', rtA.layoutCount, rtB.layoutCount);
    add('V8 / Rendering', 'Recalc Style Count', rtA.recalcStyleCount, rtB.recalcStyleCount);
    add('V8 / Rendering', 'JS Heap Used', rtA.jsHeapUsedSize, rtB.jsHeapUsedSize, 'bytes');
    add('V8 / Rendering', 'DOM Nodes', rtA.domNodes, rtB.domNodes);
  }

  // E2E
  const eA = dataA.value.e2e;
  const eB = dataB.value.e2e;
  if (eA && eB && eA.success && eB.success) {
    add('E2E Scenario', 'Scenario Duration, ms', eA.scenarioDurationMs, eB.scenarioDurationMs);
    add('E2E Scenario', 'Avg Input Delay, ms', eA.avgInputDelayMs, eB.avgInputDelayMs);
    add('E2E Scenario', 'Max Input Delay, ms', eA.maxInputDelayMs, eB.maxInputDelayMs);
    add('E2E Scenario', 'Total Long Tasks', eA.totalLongTasks, eB.totalLongTasks);
    add('E2E Scenario', 'Avg Heap Usage, %', eA.avgHeapUsagePercent, eB.avgHeapUsagePercent);
    add('E2E Scenario', 'Max Heap Usage, %', eA.maxHeapUsagePercent, eB.maxHeapUsagePercent);
  }

  return result;
});

// Group rows for display
const groupedRows = computed(() => {
  const groups: { name: string; rows: CompareRow[] }[] = [];
  let current: { name: string; rows: CompareRow[] } | null = null;
  for (const row of rows.value) {
    if (!current || current.name !== row.group) {
      current = { name: row.group, rows: [] };
      groups.push(current);
    }
    current.rows.push(row);
  }
  return groups;
});

// CSV Export
function exportCSV() {
  if (!rows.value.length) return;
  const sep = ';';
  const header = ['Group', 'Metric', form.labelA, form.labelB, 'Delta'].join(sep);
  const lines = rows.value.map(r => [r.group, r.metric, r.valueA, r.valueB, r.delta].join(sep));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compare-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <AppShell>
    <div class="compare">
      <!-- Form -->
      <CardSurface>
        <template #header>
          <h2 style="margin: 0;">Сравнение двух сайтов</h2>
        </template>

        <form class="form" @submit.prevent="handleCompare">
          <div class="form-row">
            <div class="form-group">
              <InputField v-model="form.labelA" label="Название A" placeholder="Monolith" />
              <InputField v-model="form.urlA" label="URL A" placeholder="https://site-a.com" />
            </div>
            <div class="form-group">
              <InputField v-model="form.labelB" label="Название B" placeholder="MFE" />
              <InputField v-model="form.urlB" label="URL B" placeholder="https://site-b.com" />
            </div>
          </div>

          <div class="form-options">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.runE2E">
              <span>E2E тест</span>
            </label>
            <div class="repeat-row">
              <span>Повторений:</span>
              <input v-model.number="form.repeatCount" type="number" min="1" max="20" class="repeat-input">
            </div>
          </div>

          <ButtonPrimary
            type="submit"
            :loading="isRunning"
            :disabled="isRunning || !form.urlA || !form.urlB"
          >
            {{ isRunning ? progress || 'Измеряем...' : 'Сравнить' }}
          </ButtonPrimary>
        </form>
      </CardSurface>

      <!-- Error -->
      <div v-if="error" class="error-banner">{{ error }}</div>

      <!-- Results -->
      <CardSurface v-if="groupedRows.length">
        <template #header>
          <div class="results-header">
            <h2 style="margin: 0;">Результаты</h2>
            <button class="export-btn" @click="exportCSV">CSV</button>
          </div>
        </template>

        <div class="table-wrap">
          <table class="compare-table">
            <thead>
              <tr>
                <th class="col-metric">Metric</th>
                <th class="col-val">{{ form.labelA }}</th>
                <th class="col-val">{{ form.labelB }}</th>
                <th class="col-delta">Delta</th>
              </tr>
            </thead>
            <tbody v-for="group in groupedRows" :key="group.name">
              <tr class="group-row">
                <td colspan="4">{{ group.name }}</td>
              </tr>
              <tr v-for="row in group.rows" :key="row.metric">
                <td class="col-metric">{{ row.metric }}</td>
                <td class="col-val mono">{{ row.valueA }}</td>
                <td class="col-val mono">{{ row.valueB }}</td>
                <td class="col-delta mono" :class="'delta-' + row.deltaClass">{{ row.delta }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardSurface>
    </div>
  </AppShell>
</template>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-options {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.75rem 1rem;
  background: #f0f9ff;
  border-radius: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: #1e40af;
}

.checkbox-label input { width: 1.1rem; height: 1.1rem; accent-color: #4f46e5; }

.repeat-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #1e40af;
  font-weight: 500;
}

.repeat-input {
  width: 60px;
  padding: 0.375rem 0.5rem;
  border: 1px solid #bfdbfe;
  border-radius: 0.375rem;
  font-size: 0.9rem;
  text-align: center;
}

.error-banner {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 0.5rem;
  font-weight: 500;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.export-btn {
  padding: 0.375rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}

.export-btn:hover { background: #f9fafb; }

.table-wrap {
  overflow-x: auto;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.compare-table th {
  background: #1e293b;
  color: #fff;
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.compare-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.compare-table tr:hover td { background: #f8fafc; }

.group-row td {
  background: #f1f5f9;
  font-weight: 700;
  color: #334155;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.75rem;
}

.col-metric { min-width: 180px; }
.col-val { min-width: 100px; text-align: right; }
.col-delta { min-width: 80px; text-align: right; font-weight: 600; }

.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.85rem; }

.delta-better { color: #16a34a; }
.delta-worse { color: #dc2626; }
.delta-neutral { color: #6b7280; }

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
}
</style>
