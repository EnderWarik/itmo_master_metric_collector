<script setup lang="ts">
import { computed, reactive } from 'vue';
import InputField from '@/shared/ui/InputField.vue';
import ButtonPrimary from '@/shared/ui/ButtonPrimary.vue';
import type { CollectMetricsPayload } from '../services/metricsApi';

const props = defineProps<{
  metricLabels: string[];
  isLoadingDefinitions: boolean;
  isCollecting: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: CollectMetricsPayload];
}>();

const form = reactive<CollectMetricsPayload>({
  url: '',
});

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

  emit('submit', { ...form });
}
</script>

<template>
  <form class="form" @submit="handleSubmit">
    <InputField
      v-model="form.url"
      label="Ссылка на сайт"
      placeholder="https://example.com"
    />

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
</style>

