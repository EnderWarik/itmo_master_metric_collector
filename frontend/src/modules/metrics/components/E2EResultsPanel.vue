<script setup lang="ts">
/** Метрики шага */
interface StepMetrics {
  stepIndex: number;
  action: string;
  selector?: string;
  label?: string;
  inputDelayMs: number;
  actionDurationMs: number;
  longTasksCount: number;
  longTasksTotalMs: number;
  success: boolean;
  error?: string;
}

/** Результат E2E */
interface E2EResult {
  scenarioName: string;
  url: string;
  steps: StepMetrics[];
  totalDurationMs: number;
  scenarioDurationMs: number;
  totalLongTasks: number;
  totalLongTasksMs: number;
  avgInputDelayMs: number;
  maxInputDelayMs: number;
  avgFps?: number;
  minFps?: number;
  totalFrames?: number;
  droppedFrames?: number;
  fpsTimeline?: { timeMs: number; fps: number }[];
  avgHeapUsagePercent?: number;
  maxHeapUsagePercent?: number;
  heapTimeline?: { time: number; usedSize: number; totalSize: number; usagePercent: number }[];
  success: boolean;
  error?: string;
}

const props = defineProps<{
  result: E2EResult | null;
  isRunning: boolean;
}>();

import { computed } from 'vue';

// SVG chart dimensions
const chartWidth = 400;
const chartHeight = 100;
const chartPadding = 20;

const fpsChartPath = computed(() => {
  if (!props.result?.fpsTimeline?.length) return '';
  const timeline = props.result.fpsTimeline;
  const maxTime = Math.max(...timeline.map(p => p.timeMs));
  const maxFps = Math.max(...timeline.map(p => p.fps), 60);
  
  const points = timeline.map((point, i) => {
    const x = chartPadding + (point.timeMs / maxTime) * (chartWidth - 2 * chartPadding);
    const y = chartHeight - chartPadding - (point.fps / maxFps) * (chartHeight - 2 * chartPadding);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  });
  
  return points.join(' ');
});

const fpsChartArea = computed(() => {
  if (!props.result?.fpsTimeline?.length) return '';
  const timeline = props.result.fpsTimeline;
  const maxTime = Math.max(...timeline.map(p => p.timeMs));
  const maxFps = Math.max(...timeline.map(p => p.fps), 60);
  
  const points = timeline.map((point) => {
    const x = chartPadding + (point.timeMs / maxTime) * (chartWidth - 2 * chartPadding);
    const y = chartHeight - chartPadding - (point.fps / maxFps) * (chartHeight - 2 * chartPadding);
    return `${x},${y}`;
  });
  
  const startX = chartPadding;
  const endX = chartPadding + (chartWidth - 2 * chartPadding);
  const bottomY = chartHeight - chartPadding;
  
  return `${startX},${bottomY} ${points.join(' ')} ${endX},${bottomY}`;
});

// Heap chart computeds
const heapChartPath = computed(() => {
  if (!props.result?.heapTimeline?.length) return '';
  const timeline = props.result.heapTimeline;
  const maxTime = Math.max(...timeline.map(p => p.time));
  
  const points = timeline.map((point, i) => {
    const x = chartPadding + (point.time / maxTime) * (chartWidth - 2 * chartPadding);
    const y = chartHeight - chartPadding - (point.usagePercent / 100) * (chartHeight - 2 * chartPadding);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  });
  
  return points.join(' ');
});

const heapChartArea = computed(() => {
  if (!props.result?.heapTimeline?.length) return '';
  const timeline = props.result.heapTimeline;
  const maxTime = Math.max(...timeline.map(p => p.time));
  
  const points = timeline.map((point) => {
    const x = chartPadding + (point.time / maxTime) * (chartWidth - 2 * chartPadding);
    const y = chartHeight - chartPadding - (point.usagePercent / 100) * (chartHeight - 2 * chartPadding);
    return `${x},${y}`;
  });
  
  const startX = chartPadding;
  const endX = chartPadding + (chartWidth - 2 * chartPadding);
  const bottomY = chartHeight - chartPadding;
  
  return `${startX},${bottomY} ${points.join(' ')} ${endX},${bottomY}`;
});

function getHeapClass(percent: number): string {
  if (percent <= 50) return 'good';
  if (percent <= 80) return 'average';
  return 'poor';
}

// Generate fixed time labels for X-axis (1s, 2s, 3s, ...)
const timeLabels = computed(() => {
  if (!props.result?.fpsTimeline?.length) return [];
  const maxTime = Math.max(...props.result.fpsTimeline.map(p => p.timeMs));
  const maxSeconds = Math.ceil(maxTime / 1000);
  const labels: { second: number; x: number }[] = [];
  
  for (let s = 1; s <= maxSeconds; s++) {
    const x = chartPadding + (s * 1000 / maxTime) * (chartWidth - 2 * chartPadding);
    // Не показываем метку если она выходит за правый край
    if (x <= chartWidth - chartPadding + 10) {
      labels.push({ second: s, x });
    }
  }
  
  return labels;
});

// Generate fixed time labels for heap chart X-axis
const heapTimeLabels = computed(() => {
  if (!props.result?.heapTimeline?.length) return [];
  const maxTime = Math.max(...props.result.heapTimeline.map(p => p.time));
  const maxSeconds = Math.ceil(maxTime / 1000);
  const labels: { second: number; x: number }[] = [];
  
  for (let s = 1; s <= maxSeconds; s++) {
    const x = chartPadding + (s * 1000 / maxTime) * (chartWidth - 2 * chartPadding);
    // Не показываем метку если она выходит за правый край
    if (x <= chartWidth - chartPadding + 10) {
      labels.push({ second: s, x });
    }
  }
  
  return labels;
});

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} с`;
  }
  return `${Math.round(ms)} мс`;
}

function getDelayClass(ms: number): string {
  if (ms < 100) return 'good';
  if (ms < 300) return 'average';
  return 'poor';
}

function getFpsClass(fps: number): string {
  if (fps >= 55) return 'good';
  if (fps >= 30) return 'average';
  return 'poor';
}
</script>

<template>
  <div class="e2e-results">
    <h3>📊 Результаты E2E</h3>

    <div v-if="isRunning" class="running-state">
      <div class="spinner"></div>
      <span>Выполняется сценарий...</span>
    </div>

    <div v-else-if="!result" class="empty-state">
      <p>Создайте сценарий и нажмите "Запустить замер E2E"</p>
    </div>

    <template v-else>
      <!-- Summary -->
      <div class="summary-card" :class="{ 'summary-card--error': !result.success }">
        <div class="summary-header">
          <span class="scenario-name">{{ result.scenarioName }}</span>
          <span class="status-badge" :class="result.success ? 'success' : 'error'">
            {{ result.success ? '✓ Успешно' : '✗ Ошибка' }}
          </span>
        </div>
        <div class="summary-url">{{ result.url }}</div>
        
        <div class="summary-metrics">
          <div class="metric">
            <span class="metric-value">{{ formatMs(result.scenarioDurationMs) }}</span>
            <span class="metric-label">Время сценария</span>
          </div>
          <div class="metric">
            <span class="metric-value">{{ result.steps.length }}</span>
            <span class="metric-label">Шагов</span>
          </div>
          <div class="metric">
            <span class="metric-value" :class="getDelayClass(result.avgInputDelayMs)">
              {{ formatMs(result.avgInputDelayMs) }}
            </span>
            <span class="metric-label">Avg Input Delay</span>
          </div>
          <div class="metric">
            <span class="metric-value" :class="getDelayClass(result.maxInputDelayMs)">
              {{ formatMs(result.maxInputDelayMs) }}
            </span>
            <span class="metric-label">Max Input Delay</span>
          </div>
          <div class="metric">
            <span class="metric-value">{{ result.totalLongTasks }}</span>
            <span class="metric-label">Long Tasks</span>
          </div>
          <div class="metric">
            <span class="metric-value">{{ formatMs(result.totalLongTasksMs) }}</span>
            <span class="metric-label">Long Tasks Time</span>
          </div>
          <div v-if="result.avgFps" class="metric">
            <span class="metric-value" :class="getFpsClass(result.avgFps)">
              {{ result.avgFps }} FPS
            </span>
            <span class="metric-label">Avg FPS</span>
          </div>
          <div v-if="result.minFps" class="metric">
            <span class="metric-value" :class="getFpsClass(result.minFps)">
              {{ result.minFps }} FPS
            </span>
            <span class="metric-label">Min FPS</span>
          </div>
        </div>

        <div v-if="result.error" class="error-message">
          {{ result.error }}
        </div>

        <!-- FPS Timeline Chart -->
        <div v-if="result.fpsTimeline && result.fpsTimeline.length > 0" class="fps-chart-section">
          <h4>📈 FPS Timeline</h4>
          <svg :width="chartWidth" :height="chartHeight" class="fps-chart">
            <!-- Grid lines -->
            <line :x1="chartPadding" :y1="chartHeight - chartPadding" :x2="chartWidth - chartPadding" :y2="chartHeight - chartPadding" stroke="#e2e8f0" />
            <line :x1="chartPadding" :y1="chartPadding" :x2="chartPadding" :y2="chartHeight - chartPadding" stroke="#e2e8f0" />
            
            <!-- Time labels on X axis (fixed at 1s, 2s, 3s...) -->
            <template v-for="label in timeLabels" :key="'tick-' + label.second">
              <line 
                :x1="label.x"
                :y1="chartHeight - chartPadding"
                :x2="label.x"
                :y2="chartHeight - chartPadding + 5"
                stroke="#94a3b8"
              />
              <text 
                :x="label.x"
                :y="chartHeight - 5"
                font-size="9"
                fill="#64748b"
                text-anchor="middle"
              >{{ label.second }}s</text>
            </template>
            
            <!-- 60 FPS reference line -->
            <line 
              :x1="chartPadding" 
              :y1="chartHeight - chartPadding - ((60 / Math.max(...result.fpsTimeline.map(p => p.fps), 60)) * (chartHeight - 2 * chartPadding))"
              :x2="chartWidth - chartPadding" 
              :y2="chartHeight - chartPadding - ((60 / Math.max(...result.fpsTimeline.map(p => p.fps), 60)) * (chartHeight - 2 * chartPadding))"
              stroke="#22c55e" 
              stroke-dasharray="4"
              opacity="0.5"
            />
            <text :x="chartWidth - chartPadding + 5" :y="chartHeight - chartPadding - ((60 / Math.max(...result.fpsTimeline.map(p => p.fps), 60)) * (chartHeight - 2 * chartPadding)) + 4" font-size="10" fill="#22c55e">60</text>
            
            <!-- Area fill -->
            <polygon :points="fpsChartArea" fill="url(#fpsGradient)" opacity="0.3" />
            
            <!-- Line -->
            <path :d="fpsChartPath" fill="none" stroke="#4f46e5" stroke-width="2" />
            
            <!-- Data points with tooltips -->
            <template v-for="(point, i) in result.fpsTimeline" :key="'point-' + i">
              <circle 
                :cx="chartPadding + (point.timeMs / Math.max(...result.fpsTimeline.map(p => p.timeMs))) * (chartWidth - 2 * chartPadding)"
                :cy="chartHeight - chartPadding - (point.fps / Math.max(...result.fpsTimeline.map(p => p.fps), 60)) * (chartHeight - 2 * chartPadding)"
                r="3"
                fill="#4f46e5"
                opacity="0.7"
              >
                <title>{{ (point.timeMs / 1000).toFixed(1) }}s: {{ point.fps }} FPS</title>
              </circle>
            </template>
            
            <!-- Gradient definition -->
            <defs>
              <linearGradient id="fpsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#4f46e5" />
                <stop offset="100%" stop-color="#4f46e5" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Heap Usage Timeline Chart -->
        <div v-if="result.heapTimeline && result.heapTimeline.length > 0" class="heap-chart-section">
          <h4>🧠 Heap Usage Timeline</h4>
          <div class="heap-metrics-row">
            <span class="heap-metric">
              Avg: <strong :class="'heap-' + getHeapClass(result.avgHeapUsagePercent || 0)">{{ result.avgHeapUsagePercent }}%</strong>
            </span>
            <span class="heap-metric">
              Max: <strong :class="'heap-' + getHeapClass(result.maxHeapUsagePercent || 0)">{{ result.maxHeapUsagePercent }}%</strong>
            </span>
          </div>
          <svg :width="chartWidth" :height="chartHeight" class="heap-chart">
            <!-- Grid lines -->
            <line :x1="chartPadding" :y1="chartHeight - chartPadding" :x2="chartWidth - chartPadding" :y2="chartHeight - chartPadding" stroke="#e2e8f0" />
            <line :x1="chartPadding" :y1="chartPadding" :x2="chartPadding" :y2="chartHeight - chartPadding" stroke="#e2e8f0" />
            
            <!-- Time labels on X axis -->
            <template v-for="label in heapTimeLabels" :key="'heap-tick-' + label.second">
              <line 
                :x1="label.x" 
                :y1="chartHeight - chartPadding" 
                :x2="label.x" 
                :y2="chartHeight - chartPadding + 5" 
                stroke="#94a3b8"
              />
              <text 
                :x="label.x" 
                :y="chartHeight - chartPadding + 15" 
                font-size="10" 
                fill="#94a3b8" 
                text-anchor="middle"
              >{{ label.second }}s</text>
            </template>
            
            <!-- 80% warning line -->
            <line 
              :x1="chartPadding" 
              :y1="chartHeight - chartPadding - (0.8 * (chartHeight - 2 * chartPadding))"
              :x2="chartWidth - chartPadding" 
              :y2="chartHeight - chartPadding - (0.8 * (chartHeight - 2 * chartPadding))"
              stroke="#f59e0b" 
              stroke-dasharray="4"
              opacity="0.5"
            />
            <text :x="chartWidth - chartPadding + 5" :y="chartHeight - chartPadding - (0.8 * (chartHeight - 2 * chartPadding)) + 4" font-size="10" fill="#f59e0b">80%</text>
            
            <!-- Area fill -->
            <polygon :points="heapChartArea" fill="url(#heapGradient)" opacity="0.3" />
            
            <!-- Line -->
            <path :d="heapChartPath" fill="none" stroke="#f59e0b" stroke-width="2" />
            
            <!-- Data points with tooltips -->
            <template v-for="(point, i) in result.heapTimeline" :key="'heap-point-' + i">
              <circle 
                :cx="chartPadding + (point.time / Math.max(...result.heapTimeline.map(p => p.time))) * (chartWidth - 2 * chartPadding)"
                :cy="chartHeight - chartPadding - (point.usagePercent / 100) * (chartHeight - 2 * chartPadding)"
                r="3"
                fill="#f59e0b"
                opacity="0.7"
              >
                <title>{{ (point.time / 1000).toFixed(1) }}s: {{ point.usagePercent }}% ({{ (point.usedSize / 1024 / 1024).toFixed(1) }}MB)</title>
              </circle>
            </template>
            
            <!-- Gradient definition -->
            <defs>
              <linearGradient id="heapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <!-- Steps Table -->
      <div class="steps-table">
        <h4>Шаги сценария</h4>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Действие</th>
              <th>Селектор</th>
              <th>Input Delay</th>
              <th>Duration</th>
              <th>Long Tasks</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in result.steps" :key="step.stepIndex" :class="{ 'row-error': !step.success }">
              <td class="cell-index">{{ step.stepIndex + 1 }}</td>
              <td class="cell-action">{{ step.action }}</td>
              <td class="cell-selector">
                <code v-if="step.selector">{{ step.selector }}</code>
                <span v-else class="muted">—</span>
              </td>
              <td class="cell-metric" :class="getDelayClass(step.inputDelayMs)">
                {{ formatMs(step.inputDelayMs) }}
              </td>
              <td class="cell-metric">{{ formatMs(step.actionDurationMs) }}</td>
              <td class="cell-metric">
                {{ step.longTasksCount }}
                <span v-if="step.longTasksTotalMs > 0" class="muted">
                  ({{ formatMs(step.longTasksTotalMs) }})
                </span>
              </td>
              <td class="cell-status">
                <span v-if="step.success" class="status-ok">✓</span>
                <span v-else class="status-fail" :title="step.error">✗</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.e2e-results {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.e2e-results h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
}

.running-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  color: #64748b;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  color: #94a3b8;
  text-align: center;
  padding: 3rem;
}

.summary-card {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.summary-card--error {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.scenario-name {
  font-weight: 600;
  font-size: 1.1rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.success {
  background: #22c55e;
  color: white;
}

.status-badge.error {
  background: #ef4444;
  color: white;
}

.summary-url {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1rem;
}

.summary-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 1rem;
}

.metric {
  text-align: center;
}

.metric-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.metric-value.good { color: #22c55e; }
.metric-value.average { color: #f59e0b; }
.metric-value.poor { color: #ef4444; }

.metric-label {
  font-size: 0.75rem;
  color: #64748b;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.85rem;
}

.steps-table {
  overflow-x: auto;
}

.steps-table h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.steps-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.steps-table th,
.steps-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.steps-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #64748b;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.row-error {
  background: #fef2f2;
}

.cell-index {
  width: 40px;
  text-align: center;
  font-weight: 600;
  color: #4f46e5;
}

.cell-action {
  font-weight: 500;
}

.cell-selector code {
  background: #f1f5f9;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
}

.cell-metric {
  font-variant-numeric: tabular-nums;
}

.cell-metric.good { color: #22c55e; }
.cell-metric.average { color: #f59e0b; }
.cell-metric.poor { color: #ef4444; }

.cell-status {
  text-align: center;
}

.status-ok {
  color: #22c55e;
  font-weight: bold;
}

.status-fail {
  color: #ef4444;
  cursor: help;
}

.muted {
  color: #94a3b8;
}

/* FPS Chart */
.fps-chart-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.fps-chart-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #475569;
}

.fps-chart {
  display: block;
  max-width: 100%;
  background: #f8fafc;
  border-radius: 0.5rem;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 0.25rem 20px;
}

.heap-chart-section {
  margin-top: 1.5rem;
}

.heap-chart-section h4 {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.heap-metrics-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.heap-metric strong {
  font-weight: 600;
}

.heap-good {
  color: #22c55e;
}

.heap-average {
  color: #f59e0b;
}

.heap-poor {
  color: #ef4444;
}

.heap-chart {
  display: block;
  max-width: 100%;
  background: #f8fafc;
  border-radius: 0.5rem;
}
</style>
