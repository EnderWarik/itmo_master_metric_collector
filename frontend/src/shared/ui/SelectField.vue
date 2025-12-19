<script setup lang="ts">
export interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

import { computed } from 'vue';

const props = defineProps<{
  modelValue: string;
  label: string;
  options: SelectOption[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue),
);

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <label class="field">
    <span class="field__label">{{ props.label }}</span>
    <select class="field__select" :value="modelValue" @change="onChange">
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="selectedOption?.description" class="field__hint">
      {{ selectedOption.description }}
    </p>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.field__label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #4b5563;
}

.field__select {
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.field__select:focus {
  border-color: #2563eb;
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.field__hint {
  margin: 0;
  font-size: 0.8rem;
  color: #6b7280;
}
</style>

