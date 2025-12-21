<script setup lang="ts">
import { ref, computed } from 'vue';

/** Тип действия */
type ScenarioAction = 'click' | 'type' | 'wait' | 'navigate' | 'scroll';

/** Шаг сценария */
interface ScenarioStep {
  action: ScenarioAction;
  selector?: string;
  value?: string | number;
  label?: string;
}

/** E2E сценарий */
interface Scenario {
  name: string;
  url: string;
  steps: ScenarioStep[];
}

const emit = defineEmits<{
  (e: 'run-scenario', scenario: Scenario): void;
}>();


const targetUrl = ref('');
const scenarioName = ref('Мой сценарий');
const steps = ref<ScenarioStep[]>([]);
const isRecording = ref(false);
const iframeRef = ref<HTMLIFrameElement | null>(null);


const newStep = ref<ScenarioStep>({
  action: 'click',
  selector: '',
  value: '',
  label: '',
});

const canRunScenario = computed(() => 
  targetUrl.value.trim() !== '' && steps.value.length > 0
);

function addStep() {
  if (!newStep.value.selector && newStep.value.action !== 'wait' && newStep.value.action !== 'navigate') {
    return;
  }
  
  steps.value.push({ ...newStep.value });
  

  newStep.value = {
    action: 'click',
    selector: '',
    value: '',
    label: '',
  };
}

function removeStep(index: number) {
  steps.value.splice(index, 1);
}

function clearSteps() {
  steps.value = [];
}

function runScenario() {
  if (!canRunScenario.value) return;
  
  const scenario: Scenario = {
    name: scenarioName.value || 'Unnamed Scenario',
    url: targetUrl.value,
    steps: steps.value,
  };
  
  emit('run-scenario', scenario);
}

function exportScenario() {
  const scenario: Scenario = {
    name: scenarioName.value || 'Unnamed Scenario',
    url: targetUrl.value,
    steps: steps.value,
  };
  
  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scenarioName.value.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importScenario(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const scenario = JSON.parse(e.target?.result as string) as Scenario;
      scenarioName.value = scenario.name;
      targetUrl.value = scenario.url;
      steps.value = scenario.steps;
    } catch (err) {
      console.error('Failed to parse scenario:', err);
    }
  };
  reader.readAsText(file);
}

function loadPresetPizzaScenario() {
  scenarioName.value = 'Заказ пиццы';
  targetUrl.value = 'https:
  steps.value = [
    { action: 'type', selector: 'input[name="pizza_name"]', value: 'my pizza', label: 'Ввод названия пиццы' },
    { action: 'click', selector: 'div[class*="result"] button', label: 'Клик Готовьте' },
    { action: 'wait', value: 500, label: 'Ожидание' },
    { action: 'type', selector: 'input[name="street"]', value: 'Ленина', label: 'Ввод улицы' },
    { action: 'type', selector: 'input[name="house"]', value: '43', label: 'Ввод дома' },
    { action: 'type', selector: 'input[name="tel"]', value: '+79141234567', label: 'Ввод телефона' },
    { action: 'click', selector: 'button[type="submit"]', label: 'Оформить заказ' },
    { action: 'wait', value: 1000, label: 'Ожидание ответа' },
  ];
}

const actionLabels: Record<ScenarioAction, string> = {
  click: 'Клик',
  type: 'Ввод текста',
  wait: 'Ожидание',
  navigate: 'Переход',
  scroll: 'Скролл',
};
</script>

<template>
  <div class="scenario-recorder">
    <div class="recorder-header">
      <h3>📹 E2E Сценарий</h3>
      <div class="header-actions">
        <button class="btn btn--secondary" @click="loadPresetPizzaScenario">
          Загрузить пример
        </button>
        <label class="btn btn--secondary">
          📁 Импорт
          <input type="file" accept=".json" hidden @change="importScenario">
        </label>
        <button v-if="steps.length > 0" class="btn btn--secondary" @click="exportScenario">
          💾 Экспорт
        </button>
      </div>
    </div>

    <div class="scenario-config">
      <div class="form-group">
        <label>Название сценария</label>
        <input v-model="scenarioName" type="text" placeholder="Мой сценарий">
      </div>
      <div class="form-group">
        <label>URL страницы</label>
        <input v-model="targetUrl" type="url" placeholder="https:
      </div>
    </div>

    <div class="add-step-form">
      <h4>➕ Добавить шаг</h4>
      <div class="step-form-row">
        <select v-model="newStep.action">
          <option v-for="(label, action) in actionLabels" :key="action" :value="action">
            {{ label }}
          </option>
        </select>
        <input 
          v-if="newStep.action !== 'wait'" 
          v-model="newStep.selector" 
          type="text" 
          placeholder="CSS селектор"
        >
        <input 
          v-model="newStep.value" 
          type="text" 
          :placeholder="newStep.action === 'wait' ? 'мс' : 'Значение'"
        >
        <input v-model="newStep.label" type="text" placeholder="Описание">
        <button class="btn btn--primary" @click="addStep">+</button>
      </div>
    </div>

    <div class="steps-list">
      <h4>📋 Шаги ({{ steps.length }})</h4>
      <div v-if="steps.length === 0" class="empty-steps">
        Добавьте шаги вручную или загрузите пример
      </div>
      <ul v-else>
        <li v-for="(step, index) in steps" :key="index" class="step-item">
          <span class="step-index">{{ index + 1 }}</span>
          <span class="step-action">{{ actionLabels[step.action] }}</span>
          <span v-if="step.selector" class="step-selector">{{ step.selector }}</span>
          <span v-if="step.value" class="step-value">{{ step.value }}</span>
          <span v-if="step.label" class="step-label">{{ step.label }}</span>
          <button class="btn-remove" @click="removeStep(index)">✕</button>
        </li>
      </ul>
      <button v-if="steps.length > 0" class="btn btn--danger btn--small" @click="clearSteps">
        🗑️ Очистить все
      </button>
    </div>

    <div class="scenario-actions">
      <button 
        class="btn btn--primary btn--large" 
        :disabled="!canRunScenario" 
        @click="runScenario"
      >
        ▶️ Запустить замер E2E
      </button>
    </div>
  </div>
</template>

<style scoped>
.scenario-recorder {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.recorder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.recorder-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.scenario-config {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.85rem;
  color: #64748b;
}

.form-group input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

.add-step-form {
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.add-step-form h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
}

.step-form-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.step-form-row select,
.step-form-row input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.85rem;
}

.step-form-row select {
  min-width: 120px;
}

.step-form-row input {
  flex: 1;
  min-width: 100px;
}

.steps-list {
  margin-bottom: 1.5rem;
}

.steps-list h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
}

.empty-steps {
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 1rem;
  text-align: center;
  background: #f8fafc;
  border-radius: 0.5rem;
}

.steps-list ul {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem 0;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.step-index {
  background: #4f46e5;
  color: white;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.step-action {
  font-weight: 500;
  color: #4f46e5;
}

.step-selector {
  font-family: monospace;
  background: #e2e8f0;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
}

.step-value {
  color: #059669;
}

.step-label {
  color: #64748b;
  margin-left: auto;
}

.btn-remove {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem;
}

.scenario-actions {
  display: flex;
  justify-content: center;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn--primary {
  background: #4f46e5;
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: #4338ca;
}

.btn--primary:disabled {
  background: #c7d2fe;
  cursor: not-allowed;
}

.btn--secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn--secondary:hover {
  background: #e2e8f0;
}

.btn--danger {
  background: #fee2e2;
  color: #dc2626;
}

.btn--small {
  font-size: 0.8rem;
  padding: 0.375rem 0.75rem;
}

.btn--large {
  padding: 0.75rem 2rem;
  font-size: 1rem;
}
</style>
