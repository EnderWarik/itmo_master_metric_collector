/** Тип действия в E2E сценарии */
export type ScenarioAction = 'click' | 'type' | 'wait' | 'navigate' | 'scroll';

/** Шаг сценария */
export interface ScenarioStep {
    /** Тип действия */
    action: ScenarioAction;
    /** CSS селектор элемента (для click, type) */
    selector?: string;
    /** Значение (для type — текст, для wait — мс, для scroll — px) */
    value?: string | number;
    /** Описание шага для отображения */
    label?: string;
}

/** E2E сценарий */
export interface Scenario {
    /** Название сценария */
    name: string;
    /** Начальный URL */
    url: string;
    /** Шаги сценария */
    steps: ScenarioStep[];
}

/** Метрики отдельного шага */
export interface StepMetrics {
    /** Индекс шага */
    stepIndex: number;
    /** Тип действия */
    action: ScenarioAction;
    /** Селектор (если есть) */
    selector?: string;
    /** Описание */
    label?: string;
    /** Время от начала действия до начала обработки (мс) */
    inputDelayMs: number;
    /** Длительность выполнения действия (мс) */
    actionDurationMs: number;
    /** Количество Long Tasks (>50мс) во время шага */
    longTasksCount: number;
    /** Суммарное время Long Tasks (мс) */
    longTasksTotalMs: number;
    /** Успешно выполнен */
    success: boolean;
    /** Ошибка (если есть) */
    error?: string;
}

/** Результат выполнения E2E сценария */
export interface E2EMetricsPayload {
    /** Название сценария */
    scenarioName: string;
    /** URL */
    url: string;
    /** Метрики по каждому шагу */
    steps: StepMetrics[];
    /** Общее время выполнения сценария (мс) */
    totalDurationMs: number;
    /** Общее количество Long Tasks */
    totalLongTasks: number;
    /** Суммарное время Long Tasks (мс) */
    totalLongTasksMs: number;
    /** Среднее Input Delay (мс) */
    avgInputDelayMs: number;
    /** Максимальное Input Delay (мс) */
    maxInputDelayMs: number;
    /** Все шаги успешны */
    success: boolean;
    /** Ошибка (если сценарий упал) */
    error?: string;
}
