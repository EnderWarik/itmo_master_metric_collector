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
  url: 'https:
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

async function handleCollect(payload: MetricFormPayload) {

  metricsE2EResult.value = null;
  

  collectAll({ url: payload.url });
  

  if (payload.runE2E) {
    isMetricsE2ERunning.value = true;
    try {
      metricsE2EResult.value = await metricsApi.runE2EScenario(pizzaScenario);
    } catch (err) {
      metricsE2EResult.value = {
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
      };
    } finally {
      isMetricsE2ERunning.value = false;
    }
  }
}


const e2eResult = ref<E2EResult | null>(null);
const isE2ERunning = ref(false);

async function runE2EScenario(scenario: Scenario) {
  isE2ERunning.value = true;
  e2eResult.value = null;

  try {
    e2eResult.value = await metricsApi.runE2EScenario(scenario);
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
        <MetricResultsPanel
          :results="results"
          :error-message="errorMessage"
          :is-collecting="isCollecting"
        />
        
        <!-- E2E Results inline -->
        <E2EResultsPanel 
          v-if="metricsE2EResult || isMetricsE2ERunning"
          :result="metricsE2EResult" 
          :is-running="isMetricsE2ERunning" 
        />
      </div>
    </div>

    <!-- E2E Tab -->
    <div v-else class="grid">
      <ScenarioRecorder @run-scenario="runE2EScenario" />
      <E2EResultsPanel :result="e2eResult" :is-running="isE2ERunning" />
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
</style>
