<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  label: string;
  placeholder?: string;
  type?: string;
  error?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <label class="field">
    <span class="field__label">{{ props.label }}</span>
    <input
      class="field__input"
      :value="modelValue"
      :placeholder="placeholder"
      :type="type ?? 'text'"
      @input="onInput"
    />
    <span v-if="error" class="field__error">{{ error }}</span>
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

.field__input {
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.field__input:focus {
  border-color: #2563eb;
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.field__error {
  font-size: 0.75rem;
  color: #b91c1c;
}
</style>

