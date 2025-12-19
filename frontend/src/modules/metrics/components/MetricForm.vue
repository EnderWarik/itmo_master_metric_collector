<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import InputField from '@/shared/ui/InputField.vue';
import ButtonPrimary from '@/shared/ui/ButtonPrimary.vue';
import type { CollectMetricsPayload } from '../services/metricsApi';

export interface MetricFormPayload extends CollectMetricsPayload {
  runE2E: boolean;
}

const props = defineProps<{
  metricLabels: string[];
  isLoadingDefinitions: boolean;
  isCollecting: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: MetricFormPayload];
}>();

const form = reactive<CollectMetricsPayload>({
  url: '',
});

const runE2E = ref(true);

const metricSummary = computed(() => {
  if (props.isLoadingDefinitions) {
    return 'список метрик загружается…';
  }
  if (!props.metricLabels.length) {
    return 'нет активных метрик';
  }
  return props.metricLabels.join(' · ');
});

function handleSubmit(event: Event) {
  event.preventDefault();
  if (!form.url) {
    return;
  }

  emit('submit', { ...form, runE2E: runE2E.value });
}
</script>

<template>
  <form class="form" @submit="handleSubmit">
    <InputField
      v-model="form.url"
      label="Ссылка на сайт"
      placeholder="https://example.com"
    />

    <label class="e2e-toggle">
      <input v-model="runE2E" type="checkbox">
      <span>Запустить E2E тест (пицца)</span>
    </label>

    <ButtonPrimary
      class="form__action"
      type="submit"
      :loading="isCollecting"
      :disabled="isCollecting || !form.url"
    >
      {{ isCollecting ? 'Измеряем…' : 'Запустить замер' }}
    </ButtonPrimary>

    <p class="form__hint">
      Будут измерены: <span class="form__hint-em">{{ metricSummary }}</span>
      <template v-if="runE2E"> + E2E сценарий</template>
    </p>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form__action {
  align-self: flex-start;
}

.form__hint {
  margin: 0;
  font-size: 0.85rem;
  color: #6b7280;
}

.form__hint-em {
  font-weight: 600;
  color: #111827;
}

.e2e-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #374151;
}

.e2e-toggle input {
  width: 1rem;
  height: 1rem;
  accent-color: #4f46e5;
}
</style>
