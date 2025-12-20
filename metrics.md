# Метрики производительности

## Обзор коллекторов

| Коллектор | Группа | Инструмент | Описание |
|-----------|--------|------------|----------|
| `PingMetricCollector` | Server | Node.js TCP | Сетевая доступность и RTT |
| `TtfbMetricCollector` | Server | Node.js HTTP/HTTPS | Time To First Byte с детализацией |
| `DomMetricCollector` | Browser | Puppeteer | Navigation Timing API |
| `LighthouseMetricCollector` | Browser | Lighthouse | Web Vitals метрики |
| `FpsMetricCollector` | Browser | Puppeteer | FPS в покое (3 сек) |
| `ResourceTimingCollector` | Browser | Puppeteer + CDP | Resource Timing + V8 + Network |
| `E2EMetricCollector` | E2E | Puppeteer | Метрики взаимодействия + FPS |

---

## Сводка метрик ResourceTimingCollector

Этот коллектор собирает наиболее обширный набор метрик — 40+ метрик разбитых на категории:

| Категория | Метрики | Источник |
|-----------|---------|----------|
| **Resource Timing** | totalResources, totalTransferSize, apiRequests, scriptsCount, cssCount | `performance.getEntriesByType('resource')` |
| **CDP V8 Performance** | scriptDurationMs, taskDurationMs, jsHeapUsedSize, layoutCount, domNodes | `Performance.getMetrics()` |
| **GC Metrics** | gcCount, gcTotalDurationMs, gcMaxDurationMs, heapUsagePercent | CDP Tracing `v8.gc` |
| **JS Parse/Compile** | jsParseMs, jsCompileMs | CDP Tracing `v8.compile` |
| **Network** | avgContentDownloadMs, http2Percent, cacheHitPercent, swUsed | Resource Timing API |
| **Coverage** | unusedJsPercent, unusedCssPercent | CDP Profiler + CSS (disabled) |

---

## 1. Ping (`network.ping`)

**Инструмент:** Node.js `net.Socket`

**Что измеряет:**
- `elapsedMs` — время установки TCP-соединения (RTT)

**Как работает:**
```
Создание сокета → connect() → время до события 'connect'
```

---

## 2. Time To First Byte (`page.ttfb`)

**Инструмент:** Node.js `http`/`https` модули + события сокета

**Метрики:**

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `dnsMs` | DNS lookup | `socket.lookup` event |
| `tcpMs` | TCP handshake | `socket.connect` - lookup end |
| `tlsMs` | TLS handshake | `socket.secureConnect` - connect (только HTTPS) |
| `serverMs` | Обработка на сервере | Первый байт ответа - конец TLS/TCP |
| `ttfbMs` | Полный TTFB | Сумма всех фаз |

**Флаги:**
- `dnsCached` — DNS из кеша (0 мс)
- `connectionReused` — keep-alive соединение (0 мс)

---

## 3. Navigation Timing (`page.dom`)

**Инструмент:** Puppeteer + `performance.getEntriesByType('navigation')[0]`

**API:** Navigation Timing Level 2

**Метрики фаз загрузки:**

| Метрика | Формула | Описание |
|---------|---------|----------|
| `redirectMs` | `redirectEnd - redirectStart` | HTTP редиректы |
| `dnsMs` | `domainLookupEnd - domainLookupStart` | DNS lookup |
| `connectMs` | `connectEnd - connectStart` | TCP соединение |
| `sslMs` | `connectEnd - secureConnectionStart` | TLS handshake (null для HTTP) |
| `requestMs` | `responseStart - requestStart` | Ожидание ответа сервера |
| `responseMs` | `responseEnd - responseStart` | Скачивание тела ответа |
| `domParseMs` | `domInteractive - responseEnd` | Парсинг HTML в DOM |
| `executeScriptsMs` | `domContentLoadedEventStart - domInteractive` | Синхронные скрипты |
| `subResourcesMs` | `loadEventStart - domContentLoadedEventEnd` | Загрузка CSS, JS, images |

**Ключевые моменты:**

| Метрика | Описание |
|---------|----------|
| `domContentLoadedMs` | Время до события DOMContentLoaded |
| `loadEventMs` | Время до события load (полная загрузка) |
| `totalMs` | = loadEventMs |

**Флаги:**

| Флаг | Условие | Значение |
|------|---------|----------|
| `redirectHidden` | redirectMs=0 && redirectCount>0 | Cross-origin редирект |
| `dnsCached` | dnsMs = 0 | DNS из кеша |
| `connectionReused` | connectMs = 0 | Keep-alive соединение |

---

## 4. Lighthouse Metrics (`page.lighthouse`)

**Инструмент:** Lighthouse + Chrome Launcher

**Настройки:**
- Разрешение: 1920×1080
- Режим: Desktop
- Категории: только Performance
- Throttling: отключен (реальные условия)

**Метрики:**

| Метрика | Описание | Как измеряется | Хорошо | Средне | Плохо |
|---------|----------|----------------|--------|--------|-------|
| `performanceScore` | Общий балл производительности | Взвешенная сумма: 10% FCP + 10% SI + 25% LCP + 10% TBT + 25% CLS + 30% TTI | ≥90 | 50-89 | <50 |
| `speedIndexMs` | Скорость визуального заполнения viewport | Анализ видеозаписи загрузки, среднее время появления пикселей | <3400 | 3400-5800 | >5800 |
| `fcpMs` | First Contentful Paint — первый контент | `PerformanceObserver` для `paint` записей с именем `first-contentful-paint` | <1800 | 1800-3000 | >3000 |
| `lcpMs` | Largest Contentful Paint — крупнейший элемент | `PerformanceObserver` для `largest-contentful-paint` записей | <2500 | 2500-4000 | >4000 |
| `ttiMs` | Time to Interactive — готовность к взаимодействию | Момент после FCP, когда нет Long Tasks >50мс в течение 5 секунд | <3800 | 3800-7300 | >7300 |
| `tbtMs` | Total Blocking Time — блокировка основного потока | Сумма времени (Long Task - 50мс) для всех Long Tasks между FCP и TTI | <200 | 200-600 | >600 |
| `cls` | Cumulative Layout Shift — сдвиги макета | Сумма `impact_fraction × distance_fraction` для всех неожиданных сдвигов | <0.1 | 0.1-0.25 | >0.25 |

---

## 5. FPS Metrics (`page.fps`)

**Инструмент:** Puppeteer + `requestAnimationFrame`

**Как работает:**
1. Загружает страницу и ждёт 1 секунду "успокоения"
2. Запускает `requestAnimationFrame` цикл на 3 секунды
3. Измеряет время между кадрами и вычисляет FPS

**Метрики:**

| Метрика | Описание | Как измеряется | Хорошо | Средне | Плохо |
|---------|----------|----------------|--------|--------|-------|
| `avgFps` | Средний FPS | `1000 / avgFrameTime` | ≥55 | 30-54 | <30 |
| `minFps` | Минимальный FPS | `1000 / maxFrameTime` | ≥55 | 30-54 | <30 |
| `maxFps` | Максимальный FPS | `1000 / minFrameTime` | — | — | — |
| `totalFrames` | Количество кадров | Счётчик вызовов `requestAnimationFrame` | — | — | — |
| `droppedFrames` | Пропущенные кадры | `(duration/1000 × 60) - totalFrames` | <5% | 5-15% | >15% |
| `droppedFramesPercent` | % пропущенных | `droppedFrames / expectedFrames × 100` | — | — | — |
| `durationMs` | Длительность измерения | Общее время `requestAnimationFrame` цикла | — | — | —|

**Применение:**
- В **стандартном замере** — FPS в покое (без взаимодействия)
- В **E2E** — FPS во время выполнения сценария (клики, ввод)

---

## 7. Resource Timing (`page.resources`)

**Инструмент:** Puppeteer + Chrome DevTools Protocol (CDP)

**Что измеряет:** Загрузку ресурсов и производительность V8 после полной загрузки страницы.

### Resource Timing API

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `totalResources` | Общее кол-во ресурсов | `performance.getEntriesByType('resource').length` |
| `totalTransferSize` | Общий размер данных | Сумма `transferSize` всех ресурсов (bytes) |
| `apiRequests` | Кол-во API запросов | Фильтр: `initiatorType === 'fetch' \| 'xmlhttprequest'` |
| `totalApiDurationMs` | Общее время API | Сумма `duration` всех API запросов |
| `avgApiDurationMs` | Среднее время API | `totalApiDurationMs / apiRequests` |
| `maxApiDurationMs` | Макс. время API | `Math.max(...durations)` |
| `scriptsCount` | Кол-во скриптов | Фильтр: `initiatorType === 'script'` |
| `scriptsTotalSize` | Размер скриптов | Сумма `transferSize` скриптов (bytes) |

**duration** = `entry.responseEnd - entry.startTime` (полное время загрузки ресурса)

---

### CDP Performance Metrics (V8)

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `scriptDurationMs` | Время выполнения JS | `ScriptDuration × 1000` |
| `taskDurationMs` | Время задач main thread | `TaskDuration × 1000` |
| `jsHeapUsedSize` | Использованная память | `JSHeapUsedSize` (bytes) |
| `jsHeapTotalSize` | Общий размер heap | `JSHeapTotalSize` (bytes) |
| `layoutCount` | Кол-во layout операций | `LayoutCount` |
| `layoutDurationMs` | Время на layout | `LayoutDuration × 1000` |
| `recalcStyleCount` | Кол-во пересчётов стилей | `RecalcStyleCount` |
| `recalcStyleDurationMs` | Время на стили | `RecalcStyleDuration × 1000` |
| `domNodes` | Кол-во DOM nodes | `Nodes` |
| `jsEventListeners` | Кол-во event listeners | `JSEventListeners` |

**Как получаем CDP метрики:**
```typescript
const client = await page.target().createCDPSession();
await client.send('Performance.enable');
const metrics = await client.send('Performance.getMetrics');
// metrics.metrics = [{ name: 'ScriptDuration', value: 0.009 }, ...]
```

---

### Garbage Collection (GC) Metrics

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `heapUsagePercent` | % использования heap | `jsHeapUsedSize / jsHeapTotalSize × 100` |
| `gcCount` | Количество сборок мусора | Подсчёт GC событий в trace |
| `gcTotalDurationMs` | Суммарное время GC | Сумма `dur` всех GC событий |
| `gcMaxDurationMs` | Макс. длительность одной GC | `Math.max(...gcEvents.dur)` |

**Как собираем GC метрики:**
```typescript
await client.send('Tracing.start', {
    categories: 'v8,v8.gc,disabled-by-default-v8.gc',
    transferMode: 'ReportEvents',
});
// ... page.goto() ...
await client.send('Tracing.end');
// Фильтруем события с cat === 'v8.gc' или name.includes('GC')
```

**Время измерения:** От `page.goto()` до `networkidle0` + 1 секунда.

---

### CSS Bundle Metrics

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `cssCount` | Количество CSS файлов | Фильтр `initiatorType === 'css' \|\| 'link'` из Resource Timing |
| `cssTotalSize` | Общий размер CSS (bytes) | Сумма `transferSize` всех CSS entries |

**Как получаем:**
```typescript
const cssEntries = resourceEntries.filter(
    e => e.initiatorType === 'css' || e.initiatorType === 'link'
);
const cssTotalSize = cssEntries.reduce((sum, e) => sum + e.transferSize, 0);
```

---

### JS Parse/Compile Metrics

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `jsParseMs` | Время парсинга JS (мс) | CDP Tracing: `V8.Parse`, `V8.ParseFunction` события |
| `jsCompileMs` | Время компиляции JS (мс) | CDP Tracing: `V8.Compile`, `V8.CompileCode` события |

**Как собираем:**
```typescript
await client.send('Tracing.start', {
    categories: 'v8,v8.gc,v8.compile,disabled-by-default-v8.gc,disabled-by-default-v8.compile',
    transferMode: 'ReportEvents',
});
// ... page.goto() ...
// Фильтруем события с name.includes('Parse') или name.includes('Compile')
const jsParseMs = parseEvents.reduce((sum, e) => sum + e.dur, 0);
const jsCompileMs = compileEvents.reduce((sum, e) => sum + e.dur, 0);
```

> ⚠️ **Примечание:** Значения могут быть 0 если скрипты кэшированы или слишком маленькие.

---

### Network Metrics

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `avgContentDownloadMs` | Среднее время загрузки контента (мс) | `responseEnd - responseStart` из Resource Timing |
| `maxContentDownloadMs` | Максимальное время загрузки (мс) | `Math.max(responseEnd - responseStart)` |
| `http2Percent` | % ресурсов по HTTP/2 | `nextHopProtocol === 'h2' \|\| 'h2c'` |
| `http3Percent` | % ресурсов по HTTP/3 | `nextHopProtocol === 'h3'` |
| `cacheHitPercent` | % ресурсов из кэша | `transferSize === 0` |
| `cacheHitCount` | Количество ресурсов из кэша | Подсчёт `transferSize === 0` |
| `swUsed` | Service Worker использовался | `workerStart > 0` |
| `swStartMs` | Время инициализации SW (мс) | `min(workerStart)` из Resource Timing |

**Как получаем:**
```typescript
const resourceEntries = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries.map(entry => ({
        responseStart: entry.responseStart,
        responseEnd: entry.responseEnd,
        nextHopProtocol: entry.nextHopProtocol, // 'h2', 'h3', 'http/1.1'
        transferSize: entry.transferSize,       // 0 = из кэша
        workerStart: entry.workerStart,         // > 0 = Service Worker
    }));
});

// Content Download
const avgContentDownloadMs = mean(entries.map(e => e.responseEnd - e.responseStart));

// HTTP Protocol
const http2Percent = (entries.filter(e => e.nextHopProtocol === 'h2').length / total) * 100;

// Cache Hit
const cacheHitPercent = (entries.filter(e => e.transferSize === 0).length / total) * 100;

// Service Worker
const swUsed = entries.some(e => e.workerStart > 0);
```

---

## 8. E2E Metrics (Сценарии взаимодействия)

**Инструмент:** Puppeteer + PerformanceObserver + requestAnimationFrame

**API:** `POST /api/metrics/e2e`

**Как работает:**
1. Загружает страницу по URL (ждёт `networkidle0`)
2. Ждёт 500мс стабилизации
3. Инжектит PerformanceObserver для Long Tasks и FPS meter
4. Выполняет шаги сценария (click, type, wait, scroll)
5. Измеряет метрики на каждом шаге

---

### Метрики шага

| Метрика | Что измеряет | Как измеряется |
|---------|--------------|----------------|
| `inputDelayMs` | Время ожидания элемента | Время `waitForSelector()` до готовности элемента |
| `actionDurationMs` | Время выполнения действия | Полное время click/type/wait от начала до конца |
| `longTasksCount` | Кол-во Long Tasks (>50мс) | `PerformanceObserver({ type: 'longtask' })` |
| `longTasksTotalMs` | Суммарное время Long Tasks | Сумма `duration` всех записей |

**Код измерения Input Delay:**
```typescript
const actionStart = Date.now();
await page.waitForSelector(selector, { timeout: 10000, visible: isFirstStep });
inputDelayMs = Date.now() - actionStart;
```

---

### FPS метрики (requestAnimationFrame)

| Метрика | Что измеряет | Как измеряется |
|---------|--------------|----------------|
| `avgFps` | Средний FPS | Среднее из `fpsTimeline[]` (каждые 500мс) |
| `minFps` | Минимальный FPS | `Math.min(...fpsTimeline)` |
| `totalFrames` | Количество кадров | Счётчик вызовов `requestAnimationFrame` |
| `droppedFrames` | Пропущенные кадры | `(duration/1000 * 60) - totalFrames` |
| `fpsTimeline` | FPS по времени | Массив `{ timeMs, fps }` для графика |

**Код измерения FPS:**
```typescript
// В браузере через page.evaluateOnNewDocument
let lastFrameTime = performance.now();
let frameTimes = [];

function measure() {
  const now = performance.now();
  const delta = now - lastFrameTime;  // ms между кадрами
  frameTimes.push(delta);
  lastFrameTime = now;
  if (running) requestAnimationFrame(measure);
}

// Расчёт FPS из frameTimes
const fps = 1000 / frameTime;  // если frameTime=16.67мс → fps=60
```

**Агрегация в timeline (каждые 500мс):**
```typescript
for (const frameTime of frameTimes) {
  currentTime += frameTime;
  intervalFrames++;
  
  if (currentTime - intervalStart >= 500) {
    const fps = (intervalFrames / (currentTime - intervalStart)) * 1000;
    fpsTimeline.push({ timeMs: currentTime, fps });
    intervalStart = currentTime;
    intervalFrames = 0;
  }
}
```

---

### Итоговые метрики

| Метрика | Что измеряет | Как измеряется |
|---------|--------------|----------------|
| `scenarioDurationMs` | Время сценария (без загрузки) | От начала первого шага до конца последнего |
| `totalDurationMs` | Общее время (с загрузкой) | От начала `runScenario()` до конца |
| `avgInputDelayMs` | Среднее Input Delay | `sum(inputDelayMs) / count` (без wait/navigate) |
| `maxInputDelayMs` | Максимальное Input Delay | `Math.max(...inputDelayMs)` |
| `totalLongTasks` | Всего Long Tasks | Сумма по всем шагам |
| `totalLongTasksMs` | Общее время Long Tasks | Сумма по всем шагам |

---

### Heap Usage Timeline

| Метрика | Описание | Как измеряется |
|---------|----------|----------------|
| `avgHeapUsagePercent` | Средний % использования heap | `avg(usedSize / totalSize × 100)` |
| `maxHeapUsagePercent` | Макс. % использования heap | `max(usedSize / totalSize × 100)` |
| `heapTimeline` | Массив точек heap по времени | `{ time, usedSize, totalSize, usagePercent }[]` |

**Как измеряем heap:**
```typescript
// В браузере через page.evaluateOnNewDocument
const memory = performance.memory;  // Только Chrome!
const usedSize = memory.usedJSHeapSize;
const totalSize = memory.totalJSHeapSize;
const usagePercent = (usedSize / totalSize) * 100;

// Замер каждые 200мс во время сценария
setInterval(() => {
  heapTimeline.push({ time, usedSize, totalSize, usagePercent });
}, 200);
```

**Порог:** `heapUsagePercent > 80%` — предупреждение (память на пределе).

> ⚠️ **Примечание:** `performance.memory` доступен только в Chrome.

---

### Пороги оценки

**Input Delay:**
| Значение | Оценка |
|----------|--------|
| <100 мс | 🟢 Хорошо |
| 100-300 мс | 🟡 Средне |
| >300 мс | 🔴 Плохо |

**FPS:**
| Значение | Оценка |
|----------|--------|
| ≥55 FPS | 🟢 Хорошо |
| 30-54 FPS | 🟡 Средне |
| <30 FPS | 🔴 Плохо |

---

### Поддерживаемые действия

| Действие | Описание | Параметры |
|----------|----------|-----------|
| `click` | Клик по элементу | `selector` |
| `type` | Ввод текста (50мс задержка между символами) | `selector`, `value` |
| `wait` | Ожидание | `value` (мс) |
| `scroll` | Скролл страницы | `value` (пиксели) |
| `navigate` | Переход по URL | `value` (URL) |

---

## Сравнение: Лабораторные vs RUM метрики

| Метрика | Лабораторно (мы) | RUM (реальные пользователи) |
|---------|------------------|----------------------------|
| **FID** | ⚠️ E2E `inputDelayMs` (симуляция) | ✅ Реальный клик |
| **INP** | ⚠️ E2E `avgInputDelayMs` | ✅ Все взаимодействия |
| **Long Tasks** | ✅ Да | ✅ Да |
| **TTI** | ✅ Lighthouse | — |
| **TBT** | ✅ Lighthouse | — |

> **RUM (Real User Monitoring)** — сбор метрик от реальных пользователей через скрипт на сайте (web-vitals.js). Даёт точные FID/INP, но требует интеграции в код сайта.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     MetricsController                        │
│      POST /api/metrics/collect    POST /api/metrics/e2e     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Ping + TTFB  │   │  DOM+Lighthouse │   │   E2E Scenario  │
│  (TCP/HTTP)   │   │  (Puppeteer)    │   │  (Puppeteer)    │
└───────────────┘   └─────────────────┘   └─────────────────┘
     Server              Browser            User Interaction
```

---

## Группировка на фронтенде

- **Server** (🖥️): Ping, TTFB
- **Browser** (🌐): Navigation Timing, Lighthouse
- **E2E** (🎬): Сценарии взаимодействия
