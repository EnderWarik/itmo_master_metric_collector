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
  totalLongTasks: number;
  totalLongTasksMs: number;
  avgInputDelayMs: number;
  maxInputDelayMs: number;
  success: boolean;
  error?: string;
}

defineProps<{
  result: E2EResult | null;
  isRunning: boolean;
}>();

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
            <span class="metric-value">{{ formatMs(result.totalDurationMs) }}</span>
            <span class="metric-label">Общее время</span>
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
        </div>

        <div v-if="result.error" class="error-message">
          {{ result.error }}
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
</style>
