<script setup lang="ts">
import AppShell from '@/modules/layout/components/AppShell.vue';
import CardSurface from '@/shared/ui/CardSurface.vue';
import MetricForm from '../components/MetricForm.vue';
import MetricResultsPanel from '../components/MetricResultsPanel.vue';
import { useMetricRunner } from '../composables/useMetricRunner';

const {
  definitions,
  isLoadingDefinitions,
  isCollecting,
  results,
  errorMessage,
  collectAll,
} = useMetricRunner();
</script>

<template>
  <AppShell>
    <div class="grid">
      <CardSurface>
        <template #header>
          <div class="card-header">
            <p class="card-header__label">Сценарий</p>
            <h2 class="card-header__title">Настрой замер</h2>
          </div>
        </template>
        <MetricForm
          :metric-labels="definitions.map((definition) => definition.label)"
          :is-loading-definitions="isLoadingDefinitions"
          :is-collecting="isCollecting"
          @submit="collectAll"
        />
      </CardSurface>

      <MetricResultsPanel
        :results="results"
        :error-message="errorMessage"
        :is-collecting="isCollecting"
      />
    </div>
  </AppShell>
</template>

<style scoped>
.grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .grid {
    flex-direction: row;
  }

  .grid > * {
    flex: 1;
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
</style>

