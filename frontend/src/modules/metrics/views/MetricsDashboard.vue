<script setup lang="ts">
import { ref } from 'vue';
import AppShell from '@/modules/layout/components/AppShell.vue';
import CardSurface from '@/shared/ui/CardSurface.vue';
import MetricForm from '../components/MetricForm.vue';
import type { MetricFormPayload } from '../components/MetricForm.vue';
import MetricResultsPanel from '../components/MetricResultsPanel.vue';
import ScenarioRecorder from '../components/ScenarioRecorder.vue';
import E2EResultsPanel from '../components/E2EResultsPanel.vue';
import { useMetricRunner } from '../composables/useMetricRunner';
import { metricsApi, type Scenario, type E2EResult } from '../services/metricsApi';
import { median } from '@/shared/utils/stats';

const {
  definitions,
  isLoadingDefinitions,
  isCollecting,
  results,
  errorMessage,
  collectAll,
} = useMetricRunner();


type TabType = 'metrics' | 'e2e';
const activeTab = ref<TabType>('metrics');


const metricsE2EResult = ref<E2EResult | null>(null);
const isMetricsE2ERunning = ref(false);


const pizzaScenario: Scenario = {
  name: 'Заказ пиццы',
  url: 'https://pizza.ew-production.ru/',
  steps: [
    { action: 'type', selector: 'input[name="pizza_name"]', value: 'my pizza', label: 'Ввод названия пиццы' },
    { action: 'click', selector: 'div[class*="result"] button', label: 'Клик Готовьте' },
    { action: 'wait', value: 500, label: 'Ожидание' },
    { action: 'type', selector: 'input[name="street"]', value: 'Ленина', label: 'Ввод улицы' },
    { action: 'type', selector: 'input[name="house"]', value: '43', label: 'Ввод дома' },
    { action: 'type', selector: 'input[name="tel"]', value: '+79141234567', label: 'Ввод телефона' },
    { action: 'click', selector: 'button[type="submit"]', label: 'Оформить заказ' },
    { action: 'wait', value: 1000, label: 'Ожидание ответа' },
  ],
};
// Переменные для повторных замеров
const metricsProgress = ref({ current: 0, total: 0, phase: '' });
const metricsAllResults = ref<{ metrics: any[], e2e: E2EResult | null }[]>([]);

async function handleCollect(payload: MetricFormPayload) {
  metricsE2EResult.value = null;
  metricsAllResults.value = [];
  
  const repeatCount = payload.repeatCount || 1;
  metricsProgress.value = { current: 0, total: repeatCount, phase: '' };
  
  const allMetrics: any[][] = [];
  const allE2E: E2EResult[] = [];
  
  for (let i = 0; i < repeatCount; i++) {
    metricsProgress.value.current = i + 1;
    
    // Статичные метрики
    metricsProgress.value.phase = `Замер ${i + 1}/${repeatCount}: метрики`;
    await collectAll({ url: payload.url });
    
    // Ждём завершения сбора
    while (isCollecting.value) {
      await new Promise(r => setTimeout(r, 100));
    }
    
    allMetrics.push([...results.value]);
    
    // E2E если включён
    if (payload.runE2E) {
      metricsProgress.value.phase = `Замер ${i + 1}/${repeatCount}: E2E`;
      isMetricsE2ERunning.value = true;
      try {
        const e2eRes = await metricsApi.runE2EScenario(pizzaScenario);
        allE2E.push(e2eRes);
      } catch (err) {
        allE2E.push({
          scenarioName: pizzaScenario.name,
          url: pizzaScenario.url,
          steps: [],
          totalDurationMs: 0,
          scenarioDurationMs: 0,
          totalLongTasks: 0,
          totalLongTasksMs: 0,
          avgInputDelayMs: 0,
          maxInputDelayMs: 0,
          success: false,
          error: (err as Error).message,
        });
      } finally {
        isMetricsE2ERunning.value = false;
      }
    }
    
    metricsAllResults.value.push({
      metrics: [...results.value],
      e2e: allE2E[i] || null,
    });
  }
  
  // Усредняем E2E если были повторения
  if (allE2E.length > 1) {
    metricsE2EResult.value = averageE2EResults(allE2E);
  } else if (allE2E.length === 1) {
    metricsE2EResult.value = allE2E[0] ?? null;
  }
  
  metricsProgress.value = { current: 0, total: 0, phase: '' };
}



const e2eResult = ref<E2EResult | null>(null);
const e2eAllResults = ref<E2EResult[]>([]);
const isE2ERunning = ref(false);
const e2eProgress = ref({ current: 0, total: 0 });

function med(nums: number[]): number {
  return Math.round(median(nums));
}

function averageE2EResults(results: E2EResult[]): E2EResult | null {
  if (results.length === 0) return null;
  const first = results[0];
  if (!first) return null;
  if (results.length === 1) return first;

  return {
    scenarioName: first.scenarioName,
    url: first.url,
    steps: first.steps,
    totalDurationMs: med(results.map(r => r.totalDurationMs)),
    scenarioDurationMs: med(results.map(r => r.scenarioDurationMs)),
    totalLongTasks: med(results.map(r => r.totalLongTasks)),
    totalLongTasksMs: med(results.map(r => r.totalLongTasksMs)),
    avgInputDelayMs: med(results.map(r => r.avgInputDelayMs)),
    maxInputDelayMs: med(results.map(r => r.maxInputDelayMs)),
    avgFps: med(results.filter(r => r.avgFps).map(r => r.avgFps!)),
    minFps: med(results.filter(r => r.minFps).map(r => r.minFps!)),
    totalFrames: med(results.filter(r => r.totalFrames).map(r => r.totalFrames!)),
    droppedFrames: med(results.filter(r => r.droppedFrames).map(r => r.droppedFrames!)),
    avgHeapUsagePercent: med(results.filter(r => r.avgHeapUsagePercent).map(r => r.avgHeapUsagePercent!)),
    maxHeapUsagePercent: med(results.filter(r => r.maxHeapUsagePercent).map(r => r.maxHeapUsagePercent!)),
    success: results.every(r => r.success),
  };
}

async function runE2EScenario(scenario: Scenario, repeatCount: number = 1) {
  isE2ERunning.value = true;
  e2eResult.value = null;
  e2eAllResults.value = [];
  e2eProgress.value = { current: 0, total: repeatCount };

  try {
    const allResults: E2EResult[] = [];
    
    for (let i = 0; i < repeatCount; i++) {
      e2eProgress.value.current = i + 1;
      const result = await metricsApi.runE2EScenario(scenario);
      allResults.push(result);
    }
    
    e2eAllResults.value = allResults;
    e2eResult.value = repeatCount > 1 ? averageE2EResults(allResults) : (allResults[0] ?? null);
  } catch (err) {
    e2eResult.value = {
      scenarioName: scenario.name,
      url: scenario.url,
      steps: [],
      totalDurationMs: 0,
      scenarioDurationMs: 0,
      totalLongTasks: 0,
      totalLongTasksMs: 0,
      avgInputDelayMs: 0,
      maxInputDelayMs: 0,
      success: false,
      error: (err as Error).message,
    };
  } finally {
    isE2ERunning.value = false;
    e2eProgress.value = { current: 0, total: 0 };
  }
}
</script>

<template>
  <AppShell>
    <!-- Tabs -->
    <div class="tabs">
      <button 
        class="tab" 
        :class="{ 'tab--active': activeTab === 'metrics' }" 
        @click="activeTab = 'metrics'"
      >
        📊 Метрики
      </button>
      <button 
        class="tab" 
        :class="{ 'tab--active': activeTab === 'e2e' }" 
        @click="activeTab = 'e2e'"
      >
        🎬 E2E Сценарии
      </button>
    </div>

    <!-- Metrics Tab -->
    <div v-if="activeTab === 'metrics'" class="grid">
      <CardSurface class="sticky-card">
        <template #header>
          <div class="card-header">
            <p class="card-header__label">Сценарий</p>
            <h2 class="card-header__title">Настрой замер</h2>
          </div>
        </template>
        <MetricForm
          :metric-labels="definitions.map((definition) => definition.label)"
          :is-loading-definitions="isLoadingDefinitions"
          :is-collecting="isCollecting || isMetricsE2ERunning"
          @submit="handleCollect"
        />
      </CardSurface>

      <div class="results-column">
        <!-- Progress indicator -->
        <div v-if="metricsProgress.total > 1" class="progress-banner">
          <div class="spinner-small"></div>
          <span>{{ metricsProgress.phase }}</span>
        </div>

        <MetricResultsPanel
          :results="results"
          :all-results="metricsAllResults.map(r => r.metrics)"
          :error-message="errorMessage"
          :is-collecting="isCollecting"
        />
        
        <!-- E2E Results inline -->
        <E2EResultsPanel 
          v-if="metricsE2EResult || isMetricsE2ERunning"
          :result="metricsE2EResult" 
          :all-results="metricsAllResults.map(r => r.e2e).filter(Boolean) as E2EResult[]"
          :is-running="isMetricsE2ERunning" 
          :progress="metricsProgress.total > 1 ? { current: metricsProgress.current, total: metricsProgress.total } : undefined"
        />
      </div>
    </div>

    <!-- E2E Tab -->
    <div v-else class="grid">
      <ScenarioRecorder @run-scenario="runE2EScenario" />
      <E2EResultsPanel 
        :result="e2eResult" 
        :all-results="e2eAllResults"
        :is-running="isE2ERunning" 
        :progress="e2eProgress"
      />
    </div>
  </AppShell>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tab {
  padding: 0.75rem 1.5rem;
  border: none;
  background: #f1f5f9;
  color: #475569;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tab:hover {
  background: #e2e8f0;
}

.tab--active {
  background: #4f46e5;
  color: white;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .grid {
    flex-direction: row;
    align-items: flex-start;
  }

  .grid > * {
    flex: 1;
  }

  .sticky-card {
    position: sticky;
    top: 1.5rem;
  }
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.card-header__label {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
}

.card-header__title {
  margin: 0;
  color: #111827;
}

.results-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.progress-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 0.5rem;
  color: #1e40af;
  font-weight: 500;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid #bfdbfe;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
