<script setup lang="ts">
defineProps<{
  loading?: boolean;
}>();
</script>

<template>
  <button class="button" :disabled="loading" v-bind="$attrs">
    <slot v-if="!loading" />
    <span v-else class="loader" aria-label="loading"></span>
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.8rem;
  border: none;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.button:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.button:not(:disabled):hover {
  background: #1d4ed8;
}

.loader {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

