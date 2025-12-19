# Метрики производительности

## Обзор коллекторов

| Коллектор | Группа | Инструмент | Описание |
|-----------|--------|------------|----------|
| `PingMetricCollector` | Server | Node.js TCP | Сетевая доступность и RTT |
| `TtfbMetricCollector` | Server | Node.js HTTP/HTTPS | Time To First Byte с детализацией |
| `DomMetricCollector` | Browser | Puppeteer | Navigation Timing API |
| `LighthouseMetricCollector` | Browser | Lighthouse | Web Vitals метрики |

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

| Метрика | Описание | Хорошо | Средне | Плохо |
|---------|----------|--------|--------|-------|
| `performanceScore` | Общий балл | ≥90 | 50-89 | <50 |
| `speedIndexMs` | Среднее время отображения контента | <3400 | 3400-5800 | >5800 |
| `fcpMs` | First Contentful Paint | <1800 | 1800-3000 | >3000 |
| `lcpMs` | Largest Contentful Paint | <2500 | 2500-4000 | >4000 |
| `ttiMs` | Time to Interactive | <3800 | 3800-7300 | >7300 |
| `tbtMs` | Total Blocking Time | <200 | 200-600 | >600 |
| `cls` | Cumulative Layout Shift | <0.1 | 0.1-0.25 | >0.25 |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                     MetricsController                        │
│                    POST /api/metrics/collect                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      MetricsService                          │
│              Параллельный запуск коллекторов                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│     Ping      │   │  TTFB + DOM     │   │   Lighthouse    │
│  (TCP Socket) │   │  (Puppeteer)    │   │ (Chrome+Audit)  │
└───────────────┘   └─────────────────┘   └─────────────────┘
     Server              Browser               Browser
```

---

## Группировка на фронтенде

- **Server** (🖥️): Ping, TTFB
- **Browser** (🌐): Navigation Timing, Lighthouse
