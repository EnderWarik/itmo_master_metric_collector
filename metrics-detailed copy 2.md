# Детальное описание метрик производительности

Этот документ содержит исчерпывающее описание каждой метрики, собираемой системой: что это, как работает, как считается в браузере, математические формулы, что влияет на значение, пороги оценки и ссылки на официальные источники.

---

## Оглавление

1. [HTTP Ping (availability.ping)](#1-http-ping-availabilityping)
2. [Time To First Byte (page.ttfb)](#2-time-to-first-byte-pagettfb)
3. [Navigation Timing (page.dom)](#3-navigation-timing-pagedom)
4. [Lighthouse Metrics (page.lighthouse)](#4-lighthouse-metrics-pagelighthouse)
   - 4.1 [Performance Score](#41-performance-score)
   - 4.2 [First Contentful Paint (FCP)](#42-first-contentful-paint-fcp)
   - 4.3 [Largest Contentful Paint (LCP)](#43-largest-contentful-paint-lcp)
   - 4.4 [Speed Index (SI)](#44-speed-index-si)
   - 4.5 [Time to Interactive (TTI)](#45-time-to-interactive-tti)
   - 4.6 [Total Blocking Time (TBT)](#46-total-blocking-time-tbt)
   - 4.7 [Cumulative Layout Shift (CLS)](#47-cumulative-layout-shift-cls)
5. [FPS Metrics (page.fps)](#5-fps-metrics-pagefps)
6. [Resource Timing (page.resources)](#6-resource-timing-pageresources)
   - 6.1 [Resource Timing API](#61-resource-timing-api)
   - 6.2 [CDP Performance Metrics (V8)](#62-cdp-performance-metrics-v8)
   - 6.3 [Garbage Collection (GC)](#63-garbage-collection-gc)
   - 6.4 [JS Coverage / CSS Coverage](#64-js-coverage--css-coverage)
   - 6.5 [JS Parse / Compile](#65-js-parse--compile)
   - 6.6 [Network Metrics](#66-network-metrics)
   - 6.7 [Service Worker и Cache](#67-service-worker-и-cache)
   - 6.8 [MFE Comparison Metrics](#68-mfe-comparison-metrics)
7. [E2E Metrics (сценарии взаимодействия)](#7-e2e-metrics-сценарии-взаимодействия)
   - 7.1 [Long Tasks API](#71-long-tasks-api)
   - 7.2 [Input Delay / FID / INP](#72-input-delay--fid--inp)
   - 7.3 [FPS во время взаимодействия](#73-fps-во-время-взаимодействия)
   - 7.4 [Heap Memory Monitoring](#74-heap-memory-monitoring)
8. [Bundle Analysis (статический анализ бандлов)](#8-bundle-analysis-статический-анализ-бандлов)
9. [Оценка применимости метрик для сравнения Монолит vs Микрофронтенды](#оценка-применимости-метрик-для-сравнения-монолит-vs-микрофронтенды)

---

## 1. HTTP Ping (availability.ping)

### Что это

HTTP Ping — простейшая проверка доступности веб-сервера. Отправляется HTTP GET-запрос на указанный URL, измеряется время полного цикла запрос-ответ и проверяется код ответа сервера.

В отличие от ICMP ping (сетевой уровень, Layer 3), HTTP ping работает на уровне приложения (Layer 7) и проверяет не просто сетевую доступность, а работоспособность самого веб-сервера. Сервер может отвечать на ICMP, но при этом иметь упавший веб-процесс — HTTP ping это обнаружит.

### Как измеряется

Используется Node.js `fetch` API с обёрткой вокруг `performance.now()`:

```
const start = performance.now();
const response = await fetch(url, { method: 'GET', redirect: 'follow' });
const end = performance.now();
const elapsedMs = end - start;
```

**`performance.now()`** возвращает `DOMHighResTimeStamp` — число с плавающей точкой в миллисекундах с микросекундной точностью. В отличие от `Date.now()`:
- **Монотонный** — никогда не идёт назад, не зависит от синхронизации часов (NTP).
- **Субмиллисекундная точность** — например, `142.37ms`.
- **Создан для бенчмаркинга** — не подвержен корректировкам системных часов.

### Что включает измеренное время

Когда мы оборачиваем `fetch()` в `performance.now()`, измеренное `elapsedMs` включает:
- DNS-резолвинг (если не закэширован)
- TCP-соединение (если не переиспользуется)
- TLS-хэндшейк (для HTTPS, если не переиспользуется)
- Передачу запроса
- Обработку сервером
- Передачу полного ответа (заголовки + тело)

### Собираемые метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `elapsedMs` | number | Полное время HTTP-запроса в миллисекундах |
| `status` | number \| null | HTTP статус-код ответа (null при ошибке сети) |
| `ok` | boolean | Успешность запроса (статус 2xx) |
| `error` | string \| null | Текст ошибки при сбое |

### HTTP статус-коды и доступность

| Категория | Коды | Интерпретация |
|-----------|------|---------------|
| **2xx — Успех** | 200 OK, 204 No Content | Сервер работает и отвечает корректно |
| **3xx — Редирект** | 301, 302, 307 | Сервер работает, перенаправляет (мы следуем: `redirect: 'follow'`) |
| **4xx — Ошибка клиента** | 401, 403, 404 | Сервер работает, но ресурс недоступен/не найден |
| **5xx — Ошибка сервера** | 500, 502, 503, 504 | Сервер отвечает, но с ошибками |
| **Нет ответа** | — | DNS failure, Connection refused, Timeout — сервер недоступен |

### Что влияет на ping time

1. **Географическое расстояние** — основной фактор. Свет в оптоволокне ~200 000 км/с. New York → London (11 200 км) = минимум ~56ms RTT, реально 70-80ms.
2. **Сетевая задержка (латентность)** — количество хопов, качество маршрутизации, перегрузка.
3. **Нагрузка на сервер** — CPU, память, I/O, очередь подключений.
4. **DNS** — холодный lookup может добавить 50-200ms.
5. **Протокол** — HTTPS добавляет 1-2 RTT на TLS handshake.
6. **CDN** — edge-нода в 20ms vs origin-сервер в 200ms.
7. **HTTP Keep-Alive** — переиспользование TCP-соединения убирает DNS + TCP + TLS overhead.

### Ссылки

- MDN — Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- MDN — performance.now(): https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- Node.js Performance Hooks: https://nodejs.org/api/perf_hooks.html

---

## 2. Time To First Byte (page.ttfb)

### Что это

**TTFB (Time To First Byte)** — время от начала запроса до получения первого байта ответа от сервера. Это **фундаментальная метрика**, которая предшествует всем остальным пользовательским метрикам (FCP, LCP и т.д.). Плохой TTFB делает принципиально невозможным достижение хороших значений downstream-метрик.

TTFB — **не только "скорость сервера"**. Он включает весь сетевой путь от клиента: DNS, TCP, TLS и время обработки сервером.

Формально в Navigation Timing API:
```
TTFB = responseStart - startTime
```

### Полная декомпозиция фаз

```
|--- DNS ---|--- TCP ---|--- TLS ---|-- Запрос --|--- Обработка сервером ---|-- Первый байт --|
t0          t1          t2          t3            t4                         t5                t6

TTFB = t6 - t0
```

### Фаза 1: DNS Lookup

DNS-резолвинг — преобразование доменного имени (например, `example.com`) в IP-адрес. Цепочка: кэш браузера → кэш ОС → рекурсивный DNS-резолвер → root nameserver → TLD nameserver → авторитативный nameserver.

**Длительность:** 0ms (из кэша) до 100+ ms (холодный lookup, особенно с DNSSEC).

### Фаза 2: TCP Connection (Three-Way Handshake)

Установка TCP-соединения: SYN → SYN-ACK → ACK.

**Длительность:** ~1 RTT (round-trip time) до сервера.

### Фаза 3: TLS Handshake (только HTTPS)

- **TLS 1.2**: 2 дополнительных RTT (ClientHello → ServerHello + Certificate → Key Exchange → Finished).
- **TLS 1.3**: 1 дополнительный RTT. Поддерживает 0-RTT resumption при повторных соединениях.

Включает верификацию сертификата, обмен ключами, согласование cipher suite.

### Фаза 4: HTTP Request

Клиент отправляет HTTP-запрос (метод, путь, заголовки). Для GET-запросов практически мгновенно.

### Фаза 5: Server Processing

Сервер получает запрос, обрабатывает его (логика приложения, запросы к БД, рендеринг шаблонов) и начинает формировать ответ. Эта фаза полностью контролируется серверным разработчиком.

### Важно: это серверное (server-side) измерение

В нашей системе TTFB измеряется **не в браузере**, а на **серверной стороне** — из процесса Node.js. Наш бэкенд сам делает HTTP-запрос к целевому URL через стандартные модули `node:http` / `node:https` и замеряет каждую фазу через события сокета.

Это принципиальное отличие от браузерного `performance.getEntriesByType('navigation')`. Мы измеряем сетевой путь **от нашего сервера до целевого хоста**, а не от пользователя. Это даёт «чистый» TTFB без влияния клиентского устройства и его сетевого окружения.

### Реализация: код коллектора

Файл: `backend/src/modules/metrics/collectors/ttfb-metric.collector.ts`

**Импорты:**
```typescript
import { Injectable } from '@nestjs/common';
import { performance } from 'node:perf_hooks';     // Высокоточный таймер (микросекунды)
import { request as httpRequest } from 'node:http';  // HTTP-клиент
import { request as httpsRequest } from 'node:https'; // HTTPS-клиент
import { URL } from 'node:url';                       // Парсинг URL
```

- `performance.now()` — возвращает `DOMHighResTimeStamp` (монотонный таймер с точностью до микросекунд). Не подвержен коррекциям системных часов (`Date.now()` может «прыгнуть» при NTP-синхронизации).
- `node:http` и `node:https` — низкоуровневые HTTP-клиенты Node.js, дающие доступ к сырому TCP/TLS сокету.

**Ключевая часть — подписка на события сокета:**
```typescript
const req = requester({ hostname, path, protocol, port, method: 'GET', timeout: 10000 }, (res) => {
  // Колбэк вызывается при получении ПЕРВОГО БАЙТА ответа (заголовки)
  firstByteTime = performance.now();
  // ...
});

req.on('socket', (socket) => {
  // Событие 'socket' — сокет назначен запросу (может быть новый или из пула keep-alive)

  socket.on('lookup', () => {
    dnsLookupTime = performance.now();       // DNS-резолвинг завершён
  });

  socket.on('connect', () => {
    tcpConnectTime = performance.now();      // TCP three-way handshake завершён
  });

  socket.on('secureConnect', () => {
    tlsHandshakeTime = performance.now();    // TLS handshake завершён (только HTTPS)
  });

  // Обработка keep-alive: сокет уже подключён, события lookup/connect не сработают
  if (socket.connecting === false) {
    const now = performance.now();
    if (!dnsLookupTime) dnsLookupTime = now;
    if (!tcpConnectTime) tcpConnectTime = now;
    if (isHttps && !tlsHandshakeTime) tlsHandshakeTime = now;
  }
});

requestStartTime = performance.now();
req.end();  // Отправляем запрос
```

**Обработка редиректов** — рекурсивный вызов `measure()` при статусе 3xx, до `MAX_REDIRECTS = 5`:
```typescript
if (status >= 300 && status < 400 && res.headers.location && redirectCount < MAX_REDIRECTS) {
  const nextUrl = new URL(res.headers.location, target).toString();
  res.resume();  // Дочитываем тело, чтобы освободить сокет
  this.measure(nextUrl, redirectCount + 1).then(settle);
  return;
}
```

### Откуда приходят события сокета: от Node.js до ядра ОС

Чтобы понять, почему `socket.on('connect')` срабатывает именно тогда, когда TCP-соединение установлено, нужно пройти весь стек:

#### Уровень 1: JavaScript — `net.Socket`

`net.Socket` (класс из модуля `node:net`) — это **Duplex Stream**, обёртка вокруг файлового дескриптора операционной системы. Когда вы создаёте HTTP-запрос через `http.request()`, Node.js внутри создаёт `net.Socket` (или `tls.TLSSocket` для HTTPS), который представляет TCP-соединение.

`net.Socket` наследует от `stream.Duplex` → `EventEmitter`. Все события (`lookup`, `connect`, `secureConnect`, `data`, `end`, `error`) — это стандартные Node.js-события, которые `emit`-ятся из нативного кода через привязки (bindings).

#### Уровень 2: libuv — асинхронный I/O

Node.js не работает с ОС напрямую. Между JavaScript и системными вызовами находится **libuv** — кроссплатформенная библиотека асинхронного I/O, написанная на C.

libuv оборачивает сокет в структуру `uv_tcp_t` и управляет им через **event loop**:

```
JavaScript (net.Socket)
    ↓ через V8 C++ bindings
libuv (uv_tcp_t, uv_connect, uv_getaddrinfo)
    ↓ через системные вызовы
Kernel (socket(), connect(), getaddrinfo())
```

- **`socket.on('lookup')`** — срабатывает после завершения DNS-резолвинга. Внутри Node.js вызывает `dns.lookup()`, который использует `uv_getaddrinfo()` из libuv. libuv выполняет `getaddrinfo(3)` в **пуле потоков** (по умолчанию 4 потока, настраивается через `UV_THREADPOOL_SIZE`), потому что `getaddrinfo` — блокирующий вызов POSIX. Когда результат готов, libuv через event loop вызывает колбэк → Node.js эмитит `'lookup'`.

- **`socket.on('connect')`** — срабатывает после завершения TCP three-way handshake. Внутри: libuv вызывает `uv_tcp_connect()`, который делает неблокирующий `connect(2)` с `SOCK_NONBLOCK`. Ядро ОС начинает TCP handshake (SYN → SYN-ACK → ACK). libuv подписывается на готовность дескриптора через `epoll` (Linux) / `kqueue` (macOS) / `IOCP` (Windows). Когда ядро завершает handshake и дескриптор становится «writable», libuv получает уведомление → колбэк → Node.js эмитит `'connect'`.

- **`socket.on('secureConnect')`** — срабатывает после TLS handshake. `tls.TLSSocket` — это обёртка поверх `net.Socket`, которая использует OpenSSL (или BoringSSL в некоторых сборках) через C++ биндинги Node.js (`node_crypto.cc`). После TCP `'connect'` начинается TLS negotiation: ClientHello → ServerHello → Certificate → Key Exchange → Finished. Когда OpenSSL завершает handshake и проверяет сертификат сервера, `tls.TLSSocket` эмитит `'secureConnect'`.

#### Уровень 3: Ядро ОС — TCP/IP стек

На уровне ядра (Linux как пример) происходит следующее:

**DNS (`getaddrinfo`):**
1. Читает `/etc/resolv.conf` для адреса DNS-резолвера
2. Проверяет `/etc/hosts` и NSS-кэш (`nscd`/`systemd-resolved`)
3. Отправляет UDP-пакет (или TCP для больших ответов) на порт 53 DNS-сервера
4. Ядро обрабатывает UDP через сетевой стек: приложение → socket buffer → UDP → IP → NIC driver → сетевая карта

**TCP connect (`connect(2)`):**
1. Ядро создаёт структуру `struct sock` и `struct tcp_sock`
2. Формирует SYN-пакет: выбирает начальный sequence number (ISN), устанавливает MSS, window scale, SACK опции
3. Пакет проходит: TCP → IP (маршрутизация через `ip_route_output`) → Netfilter (iptables/nftables) → NIC driver → DMA → сетевая карта
4. Приходит SYN-ACK от сервера: NIC → прерывание (IRQ) → softirq → IP → TCP → обновление `tcp_sock` state на `ESTABLISHED`
5. Ядро отправляет ACK — handshake завершён
6. `epoll_wait()` возвращает событие `EPOLLOUT` на дескрипторе → libuv узнаёт, что соединение готово

**TCP состояния при handshake:**
```
Клиент                    Сервер
  |                         |
  |-------- SYN ----------->|   (состояние: SYN_SENT)
  |                         |   (состояние: SYN_RECV)
  |<------ SYN-ACK --------|
  |                         |
  |-------- ACK ----------->|   (состояние: ESTABLISHED)
  |                         |   (состояние: ESTABLISHED)
```

**TLS handshake (TLS 1.3):**
```
Клиент                         Сервер
  |                              |
  |--- ClientHello + KeyShare -->|   (1 сообщение)
  |                              |
  |<-- ServerHello + KeyShare ---|
  |<-- EncryptedExtensions ------|
  |<-- Certificate --------------|   (всё зашифровано!)
  |<-- CertificateVerify --------|
  |<-- Finished -----------------|
  |                              |
  |--- Finished ---------------->|   (1 RTT total)
```

#### Механизм уведомлений ядра (epoll)

libuv использует `epoll` (Linux) для эффективного мониторинга тысяч сокетов одним потоком:

```c
// Упрощённая схема работы libuv event loop
int epfd = epoll_create1(0);
epoll_ctl(epfd, EPOLL_CTL_ADD, socket_fd, &event);  // Подписка на события дескриптора

while (running) {
  int n = epoll_wait(epfd, events, MAX_EVENTS, timeout);  // Блокируется до события
  for (int i = 0; i < n; i++) {
    // Дескриптор socket_fd готов (EPOLLOUT = connect завершён, EPOLLIN = данные пришли)
    handle_event(events[i]);  // → вызывает JS-колбэк через V8
  }
}
```

На macOS вместо `epoll` используется `kqueue` (аналогичная идея, другой API).

#### Полный путь события `'connect'` (сводка)

```
TCP SYN-ACK от сервера
  → NIC принимает пакет → аппаратное прерывание (IRQ)
    → ядро: softirq → IP-стек → TCP-стек → состояние сокета = ESTABLISHED
      → epoll_wait() возвращает EPOLLOUT на fd
        → libuv: uv__stream_connect() → колбэк
          → Node.js C++: TCPWrap::AfterConnect()
            → JavaScript: socket.emit('connect')
              → наш код: tcpConnectTime = performance.now()
```

### Математические формулы

```
dnsLookupMs       = dnsLookupTime - requestStartTime
tcpConnectMs      = tcpConnectTime - dnsLookupTime
tlsHandshakeMs    = tlsHandshakeTime - tcpConnectTime        (null для HTTP)
serverProcessingMs = firstByteTime - (tlsHandshakeTime || tcpConnectTime)

TTFB = firstByteTime - requestStartTime
     = dnsLookupMs + tcpConnectMs + tlsHandshakeMs + serverProcessingMs
```

**При переиспользовании соединения (keep-alive):**

Когда `socket.connecting === false`, сокет уже подключён (из пула HTTP Agent). Все фазы принудительно устанавливаются в `requestStartTime`:
```
dnsLookupMs    = 0
tcpConnectMs   = 0
tlsHandshakeMs = 0
TTFB           = serverProcessingMs    (только обработка сервером + передача по сети)
```

**Выделение "чистого" серверного времени (без сети):**
```
estimatedNetworkRTT = tcpConnectMs       (TCP handshake ≈ 1 RTT)
serverThinkTime     = serverProcessingMs - (estimatedNetworkRTT / 2)
```
Логика: `serverProcessingMs` включает ~0.5 RTT (запрос летит к серверу) + обработка + ~0 (первый байт начинает лететь обратно, но мы засекли `firstByteTime` = момент получения). На самом деле `serverProcessingMs ≈ 0.5 RTT (запрос) + server_think + 0.5 RTT (ответ)`, поэтому `serverThinkTime ≈ serverProcessingMs - RTT`, но мы вычитаем `RTT/2` как грубую оценку.

### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `ttfbMs` | Полный TTFB | `firstByteTime - requestStartTime` |
| `dnsLookupMs` | DNS-резолвинг | `dnsLookupTime - requestStartTime` |
| `tcpConnectMs` | TCP handshake | `tcpConnectTime - dnsLookupTime` |
| `tlsHandshakeMs` | TLS handshake | `tlsHandshakeTime - tcpConnectTime` (null для HTTP) |
| `serverProcessingMs` | Обработка сервером | `firstByteTime - (tlsHandshakeTime \|\| tcpConnectTime)` |
| `status` | HTTP статус-код | Из ответа |
| `redirectCount` | Количество редиректов | Счётчик (максимум 5) |
| `finalUrl` | Финальный URL после редиректов | Из последнего ответа |

### Флаги

| Флаг | Условие | Значение |
|------|---------|----------|
| `dnsCached` | dnsLookupMs ≈ 0 | DNS из кэша |
| `connectionReused` | tcpConnectMs = 0 | Keep-alive соединение |

### Пороги оценки (web.dev, 75-й перцентиль)

| Оценка | TTFB |
|--------|------|
| Хорошо | < 800 ms |
| Требует улучшения | 800 – 1800 ms |
| Плохо | > 1800 ms |

Порог 800ms — щедрый, учитывает разнообразие сетевых условий по всему миру. На быстром соединении TTFB должен быть < 200ms. Для API-эндпоинтов цель — менее 100-200ms.

### Что влияет на каждую фазу

**DNS:**
- DNS-кэширование (браузер, ОС, ISP) → может быть 0ms
- DNS-провайдер (Cloudflare 1.1.1.1 vs медленный ISP-резолвер)
- TTL DNS-записей — короче TTL = чаще lookups
- DNSSEC — добавляет верификацию
- CNAME-цепочки — каждый CNAME = дополнительный lookup

**TCP:**
- Географическое расстояние (определяет RTT)
- CDN — edge-сервер ближе к пользователю
- TCP Fast Open (TFO) — данные в SYN-пакете
- Загрузка сервера — SYN queue overflow

**TLS:**
- Версия TLS (1.3 экономит 1 RTT vs 1.2)
- 0-RTT resumption (TLS 1.3) — полностью убирает TLS round trip при повторных визитах
- Session tickets (TLS 1.2) — сокращённый handshake
- Длина цепочки сертификатов
- OCSP stapling — избегает отдельного OCSP-запроса

**Server Processing:**
- Сложность приложения (запросы к БД, API-вызовы, рендеринг)
- Серверное кэширование (Redis, Memcached) → до < 1ms
- Нагрузка на сервер (CPU, память, I/O)
- Streaming vs buffering — потоковый ответ снижает TTFB
- Cold starts (serverless/Lambda) — инициализация контейнера +100-500ms

### Связь с Navigation Timing API

В браузере TTFB доступен через Navigation Timing Level 2:
```javascript
const [nav] = performance.getEntriesByType('navigation');
const ttfb = nav.responseStart - nav.startTime;
```

### Ссылки

- web.dev — TTFB: https://web.dev/articles/ttfb
- MDN — PerformanceNavigationTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming
- W3C Navigation Timing Level 2: https://www.w3.org/TR/navigation-timing-2/
- Node.js net.Socket: https://nodejs.org/api/net.html#class-netsocket
- Node.js tls.TLSSocket: https://nodejs.org/api/tls.html#class-tlstlssocket
- Node.js http.request(): https://nodejs.org/api/http.html#httprequestoptions-callback
- Node.js performance.now(): https://nodejs.org/api/perf_hooks.html#performancenow
- libuv Design Overview: https://docs.libuv.org/en/v1.x/design.html
- Linux epoll(7): https://man7.org/linux/man-pages/man7/epoll.7.html
- TCP RFC 793 (Three-Way Handshake): https://www.rfc-editor.org/rfc/rfc793
- TLS 1.3 RFC 8446: https://www.rfc-editor.org/rfc/rfc8446

---

## 3. Navigation Timing (page.dom)

### Что это

**Navigation Timing API Level 2** — браузерный API, предоставляющий высокоточные данные о полном жизненном цикле загрузки документа: от инициации навигации до завершения события `load`. Это встроенная инструментация браузера для измерения реальной производительности загрузки страниц.

### Как работает в браузере

При каждой навигации браузер записывает `DOMHighResTimeStamp` (миллисекунды с микросекундной точностью) на каждом этапе. Все таймстемпы доступны через единый объект `PerformanceNavigationTiming`:

```javascript
const [navEntry] = performance.getEntriesByType('navigation');
// navEntry.startTime === 0 (относительно начала навигации)
// navEntry.duration === navEntry.loadEventEnd
```

### Полная диаграмма жизненного цикла

```
navigationStart (startTime = 0)
  │
  ▼
[Выгрузка предыдущего документа]
  unloadEventStart → unloadEventEnd
  │
  ▼
[Цепочка редиректов, если есть]
  redirectStart → redirectEnd
  │
  ▼
[Начало загрузки]
  fetchStart
  │
  ▼
[DNS-резолвинг]
  domainLookupStart → domainLookupEnd
  │
  ▼
[TCP-соединение]
  connectStart → [secureConnectionStart (TLS)] → connectEnd
  │
  ▼
[HTTP-запрос]
  requestStart → responseStart (TTFB) → responseEnd
  │
  ▼
[Обработка DOM]
  domInteractive
  │
  ▼
[Событие DOMContentLoaded]
  domContentLoadedEventStart → domContentLoadedEventEnd
  │
  ▼
[Подресурсы загружены, readyState = "complete"]
  domComplete
  │
  ▼
[Событие Load]
  loadEventStart → loadEventEnd
```

### Математические формулы для каждой фазы

```
// Редирект
redirectMs = redirectEnd - redirectStart

// App Cache / Service Worker
appCacheMs = domainLookupStart - fetchStart

// DNS-резолвинг
dnsMs = domainLookupEnd - domainLookupStart

// TCP-соединение (включая TLS для HTTPS)
connectMs = connectEnd - connectStart

// Только TLS (0 для HTTP)
sslMs = connectEnd - secureConnectionStart

// TTFB (от отправки запроса до первого байта ответа)
ttfb = responseStart - requestStart

// TTFB от начала навигации
ttfbFromNav = responseStart - startTime

// Скачивание ответа
responseMs = responseEnd - responseStart

// Парсинг DOM (HTML → DOM-дерево)
domParseMs = domInteractive - responseEnd

// Выполнение deferred-скриптов
deferredScriptMs = domContentLoadedEventStart - domInteractive

// Обработчики DOMContentLoaded
dclHandlerMs = domContentLoadedEventEnd - domContentLoadedEventStart

// Загрузка подресурсов (images, CSS, async scripts)
subResourcesMs = domComplete - domContentLoadedEventEnd

// Обработчики Load
loadHandlerMs = loadEventEnd - loadEventStart

// Общее время загрузки
totalMs = loadEventEnd - startTime

// Backend-время (сетевые фазы)
backendMs = responseStart - startTime

// Frontend-время (DOM + подресурсы + события)
frontendMs = loadEventEnd - domInteractive
```

### Собираемые метрики

| Метрика | Формула | Описание |
|---------|---------|----------|
| `redirectMs` | `redirectEnd - redirectStart` | HTTP-редиректы |
| `redirectHidden` | boolean | Cross-origin редирект (таймстемпы скрыты) |
| `dnsMs` | `domainLookupEnd - domainLookupStart` | DNS lookup |
| `dnsCached` | boolean | DNS из кэша (0ms) |
| `connectMs` | `connectEnd - connectStart` | TCP-соединение |
| `connectionReused` | boolean | Keep-alive (0ms) |
| `sslMs` | `connectEnd - secureConnectionStart` | TLS handshake (null для HTTP) |
| `requestMs` | `responseStart - requestStart` | Ожидание ответа сервера (TTFB) |
| `responseMs` | `responseEnd - responseStart` | Скачивание тела ответа |
| `domParseMs` | `domInteractive - responseEnd` | Парсинг HTML в DOM |
| `executeScriptsMs` | `domContentLoadedEventStart - domInteractive` | Deferred-скрипты |
| `subResourcesMs` | `loadEventStart - domContentLoadedEventEnd` | Загрузка CSS, JS, images |
| `domContentLoadedMs` | `domContentLoadedEventEnd` | Время до DOMContentLoaded |
| `loadEventMs` | `loadEventEnd` | Время до полной загрузки |
| `totalMs` | `loadEventEnd` | Общее время загрузки |

### Что означает каждый ключевой момент DOM

**`domInteractive`** — браузер установил `document.readyState = "interactive"`. DOM-дерево полностью построено, HTML-парсер закончил работу. Скрипты могут взаимодействовать с DOM. **НО**: deferred-скрипты ещё не выполнены, DOMContentLoaded не сработал, подресурсы могут ещё грузиться. **Не путать с TTI (Time to Interactive)** — это совсем разные метрики.

**`domContentLoadedEventStart`** — все deferred-скрипты (`<script defer>`) выполнены. Событие `DOMContentLoaded` вот-вот сработает. DOM полностью парсен и готов.

**`domContentLoadedEventEnd`** — все обработчики `DOMContentLoaded` завершили работу. Разница `domContentLoadedEventEnd - domContentLoadedEventStart` = время инициализации фреймворков (React hydration, Vue mounting и т.д.).

**`domComplete`** — `document.readyState = "complete"`. Документ и **все** подресурсы (images, stylesheets, iframes) загружены. Событие `load` вот-вот сработает.

**`loadEventStart` / `loadEventEnd`** — событие `load` на `window`. Разница = время обработчиков `window.onload`.

### Что влияет на каждую фазу

**Redirect:** количество редиректов, серверная логика, same-origin vs cross-origin.

**DNS:** кэш (браузер, ОС, ISP), `<link rel="dns-prefetch">`, TTL записей.

**TCP Connect:** расстояние до сервера (RTT), `<link rel="preconnect">`, TCP Fast Open, keep-alive.

**TLS:** версия TLS (1.2 vs 1.3), session resumption, длина цепочки сертификатов, OCSP stapling.

**Request/Response:** серверная логика, размер ответа, сжатие (gzip/brotli), HTTP/2-3, CDN, Service Worker, кэширование.

**DOM Parsing:** размер HTML, parser-blocking `<script>` (без `async`/`defer`), parser-blocking CSS, inline-скрипты.

**DOMContentLoaded:** количество и стоимость обработчиков, инициализация фреймворков.

**Subresource Loading:** изображения (количество, размер, lazy loading), шрифты, async-скрипты, iframes, `<link rel="preload">`.

### Cross-origin ограничения (Timing-Allow-Origin)

По умолчанию для cross-origin навигаций с редиректами следующие свойства возвращают `0`:
- `redirectStart`, `redirectEnd`
- `domainLookupStart`, `domainLookupEnd`
- `connectStart`, `connectEnd`, `secureConnectionStart`
- `requestStart`, `responseStart`

Чтобы получить детальные тайминги, сервер должен отправлять заголовок:
```http
Timing-Allow-Origin: *
Timing-Allow-Origin: https://example.com
```

### Разница Navigation Timing Level 1 vs Level 2

| Аспект | Level 1 (устаревший) | Level 2 (текущий) |
|--------|---------------------|-------------------|
| Интерфейс | `PerformanceTiming` | `PerformanceNavigationTiming` |
| Доступ | `window.performance.timing` | `performance.getEntriesByType('navigation')[0]` |
| Таймстемпы | Миллисекунды от UNIX epoch (integer) | `DOMHighResTimeStamp` (субмиллисекундная, от `timeOrigin`) |
| Точность | 1 ms | Микросекунды (~5μs с jitter для защиты от Spectre) |
| `domLoading` | Есть | **Удалён** |
| `navigationStart` | Явное свойство | Заменено на `startTime` (всегда = 0) |
| Тип навигации | Числовой (0, 1, 2, 255) | Строковый (`"navigate"`, `"reload"`, `"back_forward"`) |
| Наследование | Нет | Наследует от `PerformanceResourceTiming` (`transferSize`, `encodedBodySize` и др.) |
| PerformanceObserver | Нет | Полная поддержка |

### Поддержка браузерами

**Baseline Widely Available** с октября 2021:

| Браузер | Версия |
|---------|--------|
| Chrome | 57+ |
| Firefox | 58+ |
| Safari | 15+ |
| Edge | 12+ |

### Ссылки

- W3C Navigation Timing Level 2: https://www.w3.org/TR/navigation-timing-2/
- MDN — PerformanceNavigationTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming
- MDN — Navigation Timing Guide: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Navigation_timing

---

## 4. Lighthouse Metrics (page.lighthouse)

### Общее описание

Google Lighthouse — инструмент для аудита производительности веб-страниц. Запускает Chrome, загружает страницу, собирает trace-данные и вычисляет набор метрик. В нашей системе используется:
- Разрешение: 1920x1080
- Режим: Desktop
- Категории: только Performance
- Throttling: отключен (реальные условия)

### 4.1 Performance Score

#### Как считается

Performance Score — **взвешенное среднее** индивидуальных оценок метрик. Каждое сырое значение конвертируется в оценку 0–100 с помощью **лог-нормальной кривой**, затем вычисляется взвешенное среднее.

#### Точные веса (Lighthouse 10/11)

| Метрика | Вес |
|---------|-----|
| First Contentful Paint (FCP) | 10% |
| Speed Index (SI) | 10% |
| Largest Contentful Paint (LCP) | 25% |
| Total Blocking Time (TBT) | **30%** |
| Cumulative Layout Shift (CLS) | 25% |

**Сумма = 100%.** TTI был удалён из скоринга в Lighthouse 10.

#### Лог-нормальная кривая скоринга

Каждая метрика оценивается с помощью **кумулятивной функции распределения (CDF) лог-нормального распределения**. Параметры определяются двумя контрольными точками:
- **median (p50)** — значение, дающее оценку 50
- **p10** — значение на 10-м перцентиле данных HTTP Archive, дающее оценку ~90 ("хорошо")

Формула:
```
score = 1 - logNormalCDF(metricValue, median, p10)
```

Две контрольные точки (median и p10) однозначно определяют параметры формы лог-нормального распределения (μ и σ).

#### Пороги итоговой оценки

| Оценка | Диапазон |
|--------|----------|
| Хорошо (зелёный) | 90–100 |
| Требует улучшения (оранжевый) | 50–89 |
| Плохо (красный) | 0–49 |

#### Ссылки

- Scoring calculator: https://googlechrome.github.io/lighthouse/scorecalc/
- Документация: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring

---

### 4.2 First Contentful Paint (FCP)

#### Что это

FCP отмечает момент от начала навигации до момента, когда браузер **впервые отрисовывает любой контент** из DOM на экране.

#### Что считается "контентом"

- **Текст** (включая текст с веб-шрифтами, даже пока используются fallback-шрифты)
- **Изображения** (включая background images)
- **`<svg>` элементы** (непустые)
- **`<canvas>` элементы** (непустые)

**Не** считается: пустая страница, страница только с background-color, пустой canvas.

#### Как браузер определяет момент отрисовки

Рендеринг-движок браузера отслеживает операции "paint". Когда композитор создаёт кадр, содержащий пиксели из DOM-контента (текстовые ноды, изображения, canvas, SVG), он записывает таймстемп. Это экспонируется через **Paint Timing API**.

#### Browser API

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      console.log('FCP:', entry.startTime);  // мс от начала навигации
    }
  }
}).observe({ type: 'paint', buffered: true });
```

Entry type: **`paint`**, Entry name: **`first-contentful-paint`**.

#### Пороги

| Оценка | Время |
|--------|-------|
| Хорошо | ≤ 1.8 с |
| Требует улучшения | 1.8 – 3.0 с |
| Плохо | > 3.0 с |

Лог-нормальные параметры: p10 = 1800ms, median = 3000ms.

#### Что влияет на FCP

- Время ответа сервера (TTFB)
- Render-blocking CSS и JavaScript
- Стратегия загрузки шрифтов (`font-display`)
- Размер DOM и сложность above-the-fold контента
- Сетевая задержка и размер ресурсов

#### Ссылки

- https://web.dev/articles/fcp
- https://developer.chrome.com/docs/lighthouse/performance/first-contentful-paint

---

### 4.3 Largest Contentful Paint (LCP)

#### Что это

LCP отмечает момент отрисовки **самого большого видимого элемента** во viewport. Это основная метрика воспринимаемой скорости загрузки.

#### Какие элементы рассматриваются

- **`<img>`** — само изображение
- **`<image>` внутри `<svg>`**
- **`<video>`** — poster-изображение или первый отображаемый кадр
- **Элементы с `background-image`** через CSS `url()`
- **Блочные элементы с текстом**

**Не** рассматриваются: `opacity: 0`, `visibility: hidden`, off-screen элементы, мелкие изображения (< 0.05% viewport).

#### Как браузер выбирает "самый большой"

1. Используется **визуальный размер**, не intrinsic. Изображение 4000x3000, отображаемое как 400x300 в CSS, считается 400x300.
2. Учитывается только видимая часть во viewport.
3. Для изображений: `size = min(intrinsic size, visible display size)`. Масштабирование вверх → используется intrinsic size. Масштабирование вниз → используется display size.
4. Margin, padding и border **не** включаются.
5. Браузер может отправлять **несколько** LCP-записей по мере загрузки (новые, более крупные элементы). **Последняя** запись до пользовательского ввода = финальный LCP.

#### Что останавливает отслеживание LCP

LCP прекращает наблюдение при:
- **Пользовательском вводе** (tap, click, scroll, keypress)
- **Фоновом режиме** (изменение видимости вкладки)

#### Browser API

```javascript
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime, lastEntry.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

Каждая запись содержит: `startTime`, `renderTime`, `loadTime`, `size` (площадь в пикселях), `element` (DOM-элемент), `url` (для изображений).

#### Пороги

| Оценка | Время |
|--------|-------|
| Хорошо | ≤ 2.5 с |
| Требует улучшения | 2.5 – 4.0 с |
| Плохо | > 4.0 с |

Лог-нормальные параметры: p10 = 2500ms, median = 4000ms.

#### Что влияет на LCP

- TTFB (время ответа сервера)
- Время загрузки ресурсов (оптимизация изображений, CDN, кэширование)
- Render-blocking ресурсы (CSS, синхронный JS)
- Client-side rendering (если контент генерируется JS)
- Lazy loading (неправильный lazy loading может задержать LCP)
- Загрузка шрифтов для текстового LCP-элемента

#### Ссылки

- https://web.dev/articles/lcp
- https://developer.chrome.com/docs/lighthouse/performance/lighthouse-largest-contentful-paint

---

### 4.4 Speed Index (SI)

#### Что это

Speed Index измеряет **как быстро визуально заполняется содержимое страницы**. Страница, которая рендерит контент прогрессивно и рано, получает лучший результат, чем та, что рендерит всё в конце.

#### Математическая формула

Speed Index вычисляется из **filmstrip** (последовательность кадров) загрузки страницы:

1. Кадры фиксируются через равные интервалы.
2. Для каждого кадра во время `t` вычисляется **visual completeness** `VC(t)` от 0% (пусто) до 100% (полная загрузка) с помощью **SSIM (structural similarity)** или гистограммного сравнения с финальным кадром.
3. Speed Index = **интеграл визуальной незавершённости по времени**:

```
SpeedIndex = ∫₀ᵗₑₙ𝒹 (1 - VC(t)/100) dt
```

В дискретной форме:
```
SpeedIndex = Σᵢ (tᵢ₊₁ - tᵢ) × (1 - VC(tᵢ)/100)
```

**Интуиция:** если страница 0% готова 2 секунды, потом прыгает до 100% — SpeedIndex ≈ 2000ms. Если прогрессирует линейно от 0% до 100% за 2 секунды — SpeedIndex ≈ 1000ms.

#### Как Lighthouse захватывает кадры

Lighthouse использует **trace events** Chrome (paint/composite события рендеринг-пайплайна). Модуль **Speedline** обрабатывает скриншоты из trace:
1. Извлекает кадры
2. Сравнивает каждый кадр с финальным визуальным состоянием
3. Вычисляет процент визуального прогресса
4. Считает интеграл

#### Пороги

| Оценка | Время |
|--------|-------|
| Хорошо | ≤ 3.4 с |
| Требует улучшения | 3.4 – 5.8 с |
| Плохо | > 5.8 с |

Лог-нормальные параметры: p10 = 3387ms, median = 5800ms.

#### Что влияет

- Render-blocking ресурсы (CSS, JS)
- Большие JavaScript-бандлы, задерживающие рендеринг
- Загрузка шрифтов (FOUT/FOIT)
- Прогрессивный рендеринг vs "всё сразу"
- Порядок загрузки изображений
- TTFB

#### Ссылки

- https://developer.chrome.com/docs/lighthouse/performance/speed-index
- Speedline library: https://github.com/nicolo-ribaudo/speedline (ранее paulirish/speedline)

---

### 4.5 Time to Interactive (TTI)

#### Что это

TTI определяет момент, когда страница становится **надёжно интерактивной**.

#### Точный алгоритм

1. Начинаем от **FCP**.
2. Ищем вперёд по времени **"тихое окно"** — период минимум **5 секунд**, где:
   - **Нет Long Tasks** (задач > 50ms на main thread)
   - **Не более 2 незавершённых сетевых запросов** (HTTP GET)
3. TTI = **время окончания последнего Long Task перед тихим окном**. Если Long Tasks не было — TTI = FCP.

#### Почему TTI устаревает

TTI **удалён из скоринга Lighthouse 10** (2023):
1. **Высокая вариативность** — крайне чувствителен к выбросам.
2. **Зависимость от сети** — требование к in-flight запросам не связано чисто с интерактивностью.
3. **Не real-user метрика** — нет PerformanceObserver entry type, только лабораторное измерение.
4. **TBT лучше** — Total Blocking Time лучше отражает блокировку main thread и коррелирует с FID/INP.

#### Пороги (исторические)

| Оценка | Время |
|--------|-------|
| Хорошо | ≤ 3.8 с |
| Требует улучшения | 3.8 – 7.3 с |
| Плохо | > 7.3 с |

#### Ссылки

- https://web.dev/articles/tti
- https://developer.chrome.com/docs/lighthouse/performance/interactive

---

### 4.6 Total Blocking Time (TBT)

#### Что это

TBT измеряет суммарное время, на которое main thread был заблокирован **Long Tasks** между FCP и TTI.

#### Определение Long Task

**Long Task** — любая задача на main thread браузера, длящаяся **более 50 миллисекунд**. Порог 50ms определён моделью RAIL: для поддержания отзывчивости при 60fps main thread должен быть свободен для обработки ввода в пределах 50ms.

#### Как считается blocking time

Для каждого Long Task:
```
blockingTime = max(0, taskDuration - 50ms)
```

**Примеры:**
- Задача 70ms → 20ms blocking time
- Задача 250ms → 200ms blocking time
- Задача 45ms → 0ms (не Long Task)

#### Формула TBT

```
TBT = Σ max(0, taskDurationᵢ - 50)   для всех задач между FCP и TTI
```

**Пример:** Три задачи 250ms, 90ms, 35ms:
- 250 - 50 = 200ms
- 90 - 50 = 40ms
- 35ms → 0ms (не Long Task)
- **TBT = 200 + 40 = 240ms**

#### Связь с FID и INP

- **FID (First Input Delay)** — измеряет задержку при первом реальном взаимодействии пользователя.
- **TBT** — лабораторный аналог FID. Суммирует всё время блокировки, независимо от действий пользователя.
- Страница с высоким TBT очень вероятно будет иметь высокий FID/INP для реальных пользователей.
- TBT несёт **30% веса** в Performance Score — самая влиятельная метрика.

#### Browser API (косвенно)

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const blockingTime = entry.duration - 50;
    console.log('Long task blocking:', blockingTime, 'ms');
  }
}).observe({ type: 'longtask', buffered: true });
```

TBT как композитная метрика вычисляется Lighthouse из trace-данных; нет единого API для прямого получения.

#### Пороги

| Оценка | Время |
|--------|-------|
| Хорошо | ≤ 200 ms |
| Требует улучшения | 200 – 600 ms |
| Плохо | > 600 ms |

Лог-нормальные параметры: p10 = 200ms, median = 600ms.

#### Что влияет на TBT

- Большие JavaScript-бандлы (парсинг, компиляция, выполнение)
- Сторонние скрипты (аналитика, реклама, чаты)
- Неэффективные обработчики событий
- Массовые DOM-манипуляции
- Layout thrashing (forced synchronous layouts)

#### Ссылки

- https://web.dev/articles/tbt
- https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time

---

### 4.7 Cumulative Layout Shift (CLS)

#### Что это

CLS измеряет **визуальную стабильность страницы** — суммарную величину неожиданных сдвигов макета.

#### Что такое layout shift

**Layout shift** происходит, когда видимый элемент меняет свою позицию между двумя последовательными кадрами **без пользовательского ввода**. Примеры:
- Изображение без указанных размеров "выталкивает" текст
- Динамически вставленный баннер сдвигает контент
- Смена шрифта вызывает перерасчёт текста

Сдвиги в пределах **500ms после дискретного пользовательского ввода** (click, tap, keypress — но **не** scroll) **исключаются** из CLS.

#### Формула layout shift score

Для каждого сдвига:
```
layout_shift_score = impact_fraction × distance_fraction
```

#### Impact fraction (доля затронутой области)

```
impact_fraction = площадь объединения старого и нового положения элемента / площадь viewport
```

Пример: элемент занимает 50% viewport, сдвигается на 25% вниз. Объединение покрывает 75% viewport → impact_fraction = 0.75.

#### Distance fraction (доля перемещения)

```
distance_fraction = максимальное расстояние перемещения любого элемента / наибольший размер viewport
```

Пример: перемещение на 200px, высота viewport 800px → distance_fraction = 200/800 = 0.25.

#### Полный расчёт

```
layout_shift_score = 0.75 × 0.25 = 0.1875
```

#### Подход session window

CLS использует **session window** (с 2021), а не сумму всех сдвигов за жизнь страницы:

1. Сдвиги группируются в **сессионные окна**.
2. Окно начинается с первого сдвига и заканчивается, когда:
   - Нет сдвигов **более 1 секунды**, ИЛИ
   - Длительность окна превышает **5 секунд**
3. CLS = **максимальная сумма баллов в одном сессионном окне** (наихудший "всплеск"):

```
CLS = max(Σ layout_shift_scores в каждом сессионном окне)
```

Этот подход принят, потому что:
- Старый подход (сумма всех сдвигов) несправедливо штрафовал долгоживущие страницы и SPA
- Session window отражает наихудший всплеск нестабильности, что лучше соответствует UX

#### Browser API

```javascript
let clsValue = 0;
let sessionValue = 0;
let sessionEntries = [];

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      const firstEntry = sessionEntries[0];
      const lastEntry = sessionEntries[sessionEntries.length - 1];

      if (sessionValue &&
          (entry.startTime - lastEntry.startTime > 1000 ||
           entry.startTime - firstEntry.startTime > 5000)) {
        clsValue = Math.max(clsValue, sessionValue);
        sessionValue = 0;
        sessionEntries = [];
      }
      sessionValue += entry.value;
      sessionEntries.push(entry);
    }
  }
}).observe({ type: 'layout-shift', buffered: true });
```

Entry type: **`layout-shift`**. Каждая запись: `value` (score), `hadRecentInput` (boolean), `sources` (элементы), `startTime`.

#### Пороги

| Оценка | Значение |
|--------|----------|
| Хорошо | ≤ 0.1 |
| Требует улучшения | 0.1 – 0.25 |
| Плохо | > 0.25 |

Лог-нормальные параметры: p10 = 0.1, median = 0.25.

#### Что влияет на CLS

- Изображения и iframes без `width`/`height`
- Динамически вставляемый контент (реклама, баннеры, cookie notices)
- Веб-шрифты, вызывающие FOUT/FOIT
- Поздно загружаемый CSS/JS, меняющий layout
- Анимации, задействующие layout (использовать `transform` вместо `top`/`left`)

#### Ссылки

- https://web.dev/articles/cls
- https://web.dev/articles/evolving-cls (эволюция session window)
- https://developer.chrome.com/docs/lighthouse/performance/lighthouse-cumulative-layout-shift

---

### Сводная таблица Lighthouse-метрик

| Метрика | Вес | Хорошо | Ср. | Плохо | Browser API Entry Type | Лаб/Поле |
|---------|-----|--------|-----|-------|------------------------|-----------|
| FCP | 10% | ≤1.8s | 1.8–3.0s | >3.0s | `paint` | Оба |
| SI | 10% | ≤3.4s | 3.4–5.8s | >5.8s | N/A (trace) | Лаб |
| LCP | 25% | ≤2.5s | 2.5–4.0s | >4.0s | `largest-contentful-paint` | Оба |
| TBT | 30% | ≤200ms | 200–600ms | >600ms | `longtask` (частично) | Лаб |
| CLS | 25% | ≤0.1 | 0.1–0.25 | >0.25 | `layout-shift` | Оба |
| TTI | 0% (удалён) | ≤3.8s | 3.8–7.3s | >7.3s | N/A (вычисляемый) | Лаб |

---

## 5. FPS Metrics (page.fps)

### Что это

FPS (Frames Per Second) — количество кадров, отрисовываемых браузером в секунду. Определяет плавность визуальных обновлений. Стандартная цель — 60fps (16.67ms на кадр).

### Как измеряется: requestAnimationFrame API

`requestAnimationFrame(callback)` запрашивает у браузера вызов callback-функции **перед следующей перерисовкой**. Callback получает `DOMHighResTimeStamp` — время начала текущего batch-а rAF callbacks.

Ключевые свойства:
- Callback вызывается **один раз за кадр**, синхронизирован с частотой обновления дисплея
- **Не вызывается** для фоновых вкладок (браузер тротлит)
- Ограничен частотой дисплея: 60Hz → max 60fps, 120Hz → max 120fps (VSync)

### Методика измерения в нашей системе

1. Загрузка страницы и ожидание **1 секунду** для стабилизации
2. Запуск `requestAnimationFrame` цикла на **3 секунды**
3. Измерение времени между кадрами (frame times)
4. Вычисление FPS из frame times

### Математические формулы

#### Связь frame time и FPS

```
fps = 1000 / frameTimeMs
```

- frameTime = 16.67ms → fps = 60 (идеально)
- frameTime = 33.33ms → fps = 30 (пропущен кадр)
- frameTime = 8.33ms → fps = 120 (120Hz дисплей)

#### Average FPS

```
avgFrameTime = totalDuration / frameCount
avgFps = 1000 / avgFrameTime
```

Эквивалентно:
```
avgFps = (frameCount × 1000) / totalDuration
```

Где `totalDuration = lastTimestamp - firstTimestamp`, `frameCount = количество интервалов`.

#### Minimum FPS (наихудший кадр)

```
maxFrameTime = Math.max(...frameTimes)
minFps = 1000 / maxFrameTime
```

Отражает самый заметный stutter. Часто важнее среднего FPS для восприятия плавности.

#### Maximum FPS (лучший кадр)

```
minFrameTime = Math.min(...frameTimes)
maxFps = 1000 / minFrameTime
```

#### Dropped Frames

При целевых 60Hz ожидаемый интервал ~16.67ms:
```
expectedFrames = totalDurationMs / 16.67
actualFrames = frameCount
droppedFrames = expectedFrames - actualFrames
```

Покадровый подсчёт:
```
droppedInThisInterval = Math.round(frameTime / 16.67) - 1
```
frameTime ~33ms = 1 пропущенный кадр, ~50ms = 2 пропущенных.

#### Dropped Frames Percentage

```
droppedFramesPercent = (droppedFrames / expectedFrames) × 100
```

0% = идеально плавно, 50% = половина кадров пропущена.

### Бюджет кадра: 16.67ms

На 60fps:
```
1000ms / 60 кадров = 16.67ms на кадр
```

Все 5 стадий рендеринг-пайплайна должны уложиться в этот бюджет. С учётом overhead браузера (~2-4ms) реальный бюджет для кода приложения ≈ **10-12ms на кадр**.

### Рендеринг-пайплайн браузера

Каждый кадр браузер проходит до 5 стадий:

```
JavaScript → Style → Layout → Paint → Composite
```

1. **JavaScript** — rAF callbacks, обработчики событий, таймеры. Любое время здесь уменьшает бюджет для остальных стадий.
2. **Style (Recalculate Style)** — сопоставление CSS-селекторов с DOM-элементами, вычисление финальных стилей. Сложные селекторы замедляют.
3. **Layout (Reflow)** — вычисление геометрии (позиция, размер) каждого видимого элемента. Одна из самых дорогих стадий, каскадируется.
4. **Paint** — заполнение пикселей: текст, цвета, изображения, тени. Элементы на отдельных слоях рисуются независимо.
5. **Composite** — объединение слоёв. Выполняется на **compositor thread** (отдельно от main thread). Анимации `transform` и `opacity` обрабатываются только композитором — пропускают JS, Style, Layout, Paint.

**Не каждый кадр задействует все 5 стадий:**
- Анимация `transform`/`opacity` → только Composite (даже если main thread заблокирован)
- Изменение `color`/`background` → Style → Paint → Composite (без Layout)
- Изменение `width`/`height`/`top` → Style → Layout → Paint → Composite (полный пайплайн)

### Что влияет на FPS

#### Main Thread Blocking
- Тяжёлые вычисления (сортировка массивов, JSON.parse больших данных)
- Синхронные XHR
- Цепочки мелких задач без yield
- Сторонние скрипты (аналитика, реклама)

#### Layout Thrashing (Forced Synchronous Layouts)
Чтение layout-свойств и запись в DOM поочерёдно заставляет браузер пересчитывать layout синхронно:
```javascript
// ПЛОХО: вынуждает layout recalculation на каждой итерации
for (let i = 0; i < elements.length; i++) {
  const height = elements[i].offsetHeight;  // READ → forces layout
  elements[i].style.height = (height + 10) + 'px';  // WRITE → invalidates layout
}
```

Свойства, провоцирующие forced layout: `offsetTop`, `offsetHeight`, `scrollTop`, `clientWidth`, `getBoundingClientRect()`, `getComputedStyle()` и др.

Полный список: https://gist.github.com/paulirish/5d52fb081b3570c81e3a

#### Paint Complexity
- Большие области перерисовки
- Дорогой CSS: `box-shadow`, `filter: blur()`, `clip-path`
- Слишком много слоёв (GPU memory)
- Некомпозитные анимации (`width`, `top`, `margin` вместо `transform`)

#### GC Pauses
- Много короткоживущих объектов за кадр
- Major GC может дать паузу 10-50+ ms

### Пороги оценки

| Оценка | FPS | Frame Time | Восприятие |
|--------|-----|------------|------------|
| Отлично | 58-60+ | < 17ms | Идеально плавно |
| Хорошо | 50-57 | 17-20ms | Плавно, мелкие drops незаметны |
| Средне | 30-49 | 20-33ms | Заметные подтормаживания |
| Плохо | 15-29 | 33-67ms | Явный jank |
| Очень плохо | < 15 | > 67ms | Слайдшоу |

**Пороги dropped frames:**

| Оценка | Dropped % |
|--------|-----------|
| Хорошо | 0–5% |
| Средне | 5–15% |
| Плохо | > 15% |

### RAIL Model (Google)

- **Response**: обработка событий < 100ms
- **Animation**: кадр < 16ms (10ms работы + 6ms browser overhead)
- **Idle**: максимизация idle time
- **Load**: контент и интерактивность < 5s

### Long Animation Frames API (LoAF) — Chrome 123+

Современный API для измерения производительности кадров:
```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Frame:', entry.duration, 'ms');
    console.log('Blocking:', entry.blockingDuration, 'ms');
    console.log('Scripts:', entry.scripts);
  }
}).observe({ type: 'long-animation-frame', buffered: true });
```

"Long animation frame" — кадр > 50ms (выравнивание с Long Tasks).

### Ссылки

- MDN — requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- W3C — Long Animation Frames: https://w3c.github.io/long-animation-frames/
- Chrome — Long Animation Frames API: https://developer.chrome.com/docs/web-platform/long-animation-frames
- Google — RAIL Model: https://web.dev/articles/rail
- Google — Rendering Performance: https://web.dev/articles/rendering-performance
- Paul Irish — What Forces Layout: https://gist.github.com/paulirish/5d52fb081b3570c81e3a

---

## 6. Resource Timing (page.resources)

Самый обширный коллектор: **40+ метрик** из 6 источников данных. Комбинирует Resource Timing API, CDP Performance Metrics, CDP Tracing (GC + Parse/Compile), CDP Profiler (JS Coverage) и CDP CSS (CSS Coverage).

### 6.1 Resource Timing API

#### Что это

**Resource Timing API** — W3C спецификация, предоставляющая детальные данные тайминга для каждого ресурса, загруженного страницей (скрипты, стили, изображения, XHR/fetch, шрифты и др.).

#### Как работает

```javascript
const resources = performance.getEntriesByType('resource');
// Массив PerformanceResourceTiming объектов, хронологически по startTime
```

**Лимит буфера:** по умолчанию **250 записей**. После заполнения новые записи теряются. Можно изменить через `performance.setResourceTimingBufferSize(n)`.

#### Полный тайминг каждого ресурса

```
startTime (= fetchStart)
  → redirectStart → redirectEnd           (при редиректах)
  → workerStart                           (при Service Worker)
  → fetchStart
  → domainLookupStart → domainLookupEnd   (DNS)
  → connectStart → secureConnectionStart → connectEnd   (TCP + TLS)
  → requestStart                          (первый байт запроса)
  → responseStart                         (первый байт ответа = TTFB ресурса)
  → responseEnd                           (последний байт)
```

#### Формулы

```
DNS time:         domainLookupEnd - domainLookupStart
TCP handshake:    connectEnd - connectStart
TLS negotiation:  requestStart - secureConnectionStart
TTFB ресурса:     responseStart - requestStart
Content download: responseEnd - responseStart
Total fetch:      responseEnd - fetchStart
SW processing:    fetchStart - workerStart
```

#### Свойства размера

| Свойство | Описание |
|----------|----------|
| `transferSize` | Всего байт по сети (заголовки + тело). **0 если из кэша** или cross-origin без TAO |
| `encodedBodySize` | Размер тела ДО снятия content-encoding (сжатый gzip/br, без заголовков) |
| `decodedBodySize` | Размер тела ПОСЛЕ снятия content-encoding (распакованный) |

Зависимости:
- `transferSize ≈ HTTP headers + encodedBodySize`
- С gzip: `encodedBodySize < decodedBodySize`
- Без сжатия: `encodedBodySize === decodedBodySize`
- Из кэша: `transferSize === 0`, но `decodedBodySize > 0`

#### initiatorType — что инициировало загрузку

| Значение | Источник |
|----------|----------|
| `script` | `<script>` элемент |
| `link` | `<link>` элемент (CSS, preloads, prefetches) |
| `css` | CSS `url()` (background-image, @font-face) |
| `img` | `<img>` src/srcset |
| `fetch` | `fetch()` API |
| `xmlhttprequest` | `XMLHttpRequest` |
| `beacon` | `navigator.sendBeacon()` |
| `video` / `audio` | Медиа-элементы |
| `iframe` | `<iframe>` src |

**Важно:** initiatorType = **HTML-элемент или API, инициировавший загрузку**, не тип контента. CSS через `<link>` = `"link"`, не `"css"`.

#### nextHopProtocol — определение HTTP версии

| Значение | Протокол |
|----------|----------|
| `"h2"` | HTTP/2 |
| `"h3"` | HTTP/3 (QUIC) |
| `"http/1.1"` | HTTP/1.1 |
| `""` | Cross-origin без Timing-Allow-Origin |

#### Собираемые метрики Resource Timing

| Метрика | Описание | Формула |
|---------|----------|---------|
| `totalResources` | Общее кол-во ресурсов | `entries.length` |
| `totalTransferSize` | Общий размер данных (bytes) | `Σ transferSize` |
| `apiRequests` | Кол-во API запросов | `count(initiatorType === 'fetch' \|\| 'xmlhttprequest')` |
| `totalApiDurationMs` | Суммарное время API | `Σ duration` API запросов |
| `avgApiDurationMs` | Среднее время API | `totalApiDurationMs / apiRequests` |
| `maxApiDurationMs` | Макс. время API | `max(duration)` |
| `apiDetails` | Топ-10 API запросов | URL, duration, size |
| `scriptsCount` | Кол-во скриптов | `count(initiatorType === 'script')` |
| `scriptsTotalSize` | Размер скриптов (bytes) | `Σ transferSize` скриптов |
| `cssCount` | Кол-во CSS файлов | `count(initiatorType === 'css' \|\| 'link')` |
| `cssTotalSize` | Размер CSS (bytes) | `Σ transferSize` CSS |

#### Cross-origin ограничения

По умолчанию для cross-origin ресурсов **обнуляются**: все детальные тайминги и размеры. Сервер должен отправлять:
```http
Timing-Allow-Origin: *
```

#### Ссылки

- W3C Resource Timing Level 2: https://www.w3.org/TR/resource-timing-2/
- MDN — PerformanceResourceTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming

---

### 6.2 CDP Performance Metrics (V8)

#### Что это

**Chrome DevTools Protocol (CDP)** предоставляет прямой доступ к внутренним метрикам движка V8 и рендеринга Chrome через `Performance.getMetrics()`.

#### Как получаем

```javascript
const client = await page.target().createCDPSession();
await client.send('Performance.enable');
const { metrics } = await client.send('Performance.getMetrics');
// metrics = [{ name: 'ScriptDuration', value: 0.009 }, ...]
```

**ВАЖНО:** Duration-метрики возвращаются в **секундах**, не миллисекундах. Умножаем на 1000 для ms.

#### Собираемые метрики

| Метрика | Описание | Единица | Как получается |
|---------|----------|---------|----------------|
| `scriptDurationMs` | Время выполнения JS в V8 | ms | `ScriptDuration × 1000` |
| `taskDurationMs` | Время задач main thread | ms | `TaskDuration × 1000` |
| `jsHeapUsedSize` | Используемая heap-память | bytes | `JSHeapUsedSize` |
| `jsHeapTotalSize` | Общий размер heap | bytes | `JSHeapTotalSize` |
| `heapUsagePercent` | % использования heap | % | `(JSHeapUsedSize / JSHeapTotalSize) × 100` |
| `layoutCount` | Количество layout-операций | count | `LayoutCount` |
| `layoutDurationMs` | Суммарное время layout | ms | `LayoutDuration × 1000` |
| `recalcStyleCount` | Количество пересчётов стилей | count | `RecalcStyleCount` |
| `recalcStyleDurationMs` | Суммарное время пересчёта стилей | ms | `RecalcStyleDuration × 1000` |
| `domNodes` | Количество DOM-узлов | count | `Nodes` |
| `jsEventListeners` | Количество JS event listeners | count | `JSEventListeners` |

#### Подробное описание

**ScriptDuration** — чистое время выполнения JavaScript в V8: вызовы функций, eval, обработчики событий, microtasks. **Не** включает время нативных API браузера (DOM, layout, style), сетевое ожидание или idle.

**TaskDuration** — общее время задач main thread, включает: выполнение скриптов, layout, пересчёт стилей, paint, compositing, GC, парсинг HTML/CSS. Всегда `TaskDuration >= ScriptDuration`.

**JSHeapUsedSize** — память V8 heap, занятая живыми JS-объектами. Растёт при аллокации, падает после GC.

**JSHeapTotalSize** — общий размер V8 heap, выделенный ОС. Включает свободное пространство. `JSHeapTotalSize >= JSHeapUsedSize`. Соотношение показывает фрагментацию.

**Nodes** — количество DOM-узлов. > 1500 по рекомендациям Lighthouse = DOM bloat.

**JSEventListeners** — общее число event listeners. Много = потенциальная утечка памяти.

#### Ссылки

- CDP Performance Domain: https://chromedevtools.github.io/devtools-protocol/tot/Performance/

---

### 6.3 Garbage Collection (GC)

#### Что это

Garbage Collection — автоматическое управление памятью в V8. GC-паузы блокируют main thread и могут вызывать jank.

#### Как собираем через CDP Tracing

```javascript
await client.send('Tracing.start', {
  categories: 'v8,v8.gc,disabled-by-default-v8.gc',
  transferMode: 'ReportEvents',
});
// ... загрузка страницы ...
await client.send('Tracing.end');
// Фильтруем события с cat === 'v8.gc' или name.includes('GC')
```

**Важно:** в trace events поле `dur` указано в **микросекундах**. Делим на 1000 для миллисекунд.

#### Генерационная модель GC в V8

V8 использует **генерационный GC**:

**Young Generation (New Space):** ~1-8 MB, недавно созданные объекты. Собирается **Scavenger** (minor GC) — быстро, < 1ms.

**Old Generation (Old Space):** долгоживущие объекты, промотированные из young generation. Собирается **Mark-Compact** (major GC) — 3 фазы:
1. **Marking** — обход графа объектов от корней, пометка всех достижимых (может быть инкрементальным)
2. **Sweeping** — освобождение памяти непомеченных объектов
3. **Compacting** — перемещение выживших для уменьшения фрагментации

#### Типы GC событий в trace

| Событие | Тип | Описание | Типичная пауза |
|---------|-----|----------|----------------|
| `V8.GCScavenger` | Minor GC | Сборка young generation. Быстрая, частая | < 1ms |
| `V8.GCCompactor` | Major GC | Полная сборка heap. Mark-Compact. Медленная | 10-200+ ms |
| `V8.GCIncrementalMarking` | Инкр. маркировка | Часть major GC, разбитая на шаги | Переменная |
| `V8.GCFinalizeMC` | Финализация major GC | Финальная атомарная пауза | 5-50+ ms |

#### Влияние GC на производительность

- **Minor GC**: < 1ms, частый, низкое влияние
- **Major GC**: 10-200+ ms, вызывает frame drops и jank
- GC-паузы **блокируют main thread** — JS не выполняется во время GC

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `gcCount` | Количество GC событий | `count(gc_events)` |
| `gcTotalDurationMs` | Суммарное время GC | `Σ (event.dur / 1000)` |
| `gcMaxDurationMs` | Макс. длительность одного GC | `max(event.dur / 1000)` |

#### Ссылки

- CDP Tracing Domain: https://chromedevtools.github.io/devtools-protocol/tot/Tracing/

---

### 6.4 JS Coverage / CSS Coverage

#### Что это

**Code Coverage** — анализ того, какой процент загруженного кода (JS и CSS) фактически выполняется/используется при загрузке страницы.

#### JS Coverage через CDP Profiler

```javascript
await client.send('Profiler.enable');
await client.send('Profiler.startPreciseCoverage', {
  callCount: true,
  detailed: true   // block-level granularity
});
// ... загрузка страницы ...
const { result } = await client.send('Profiler.takePreciseCoverage');
await client.send('Profiler.stopPreciseCoverage');
```

Структура данных:
```
ScriptCoverage {
  scriptId, url,
  functions: [{
    functionName,
    ranges: [{
      startOffset,  // байтовое смещение от начала скрипта
      endOffset,
      count         // сколько раз выполнено (0 = не использован)
    }]
  }]
}
```

#### Формула unusedJsPercent

```
Для каждого скрипта:
  scriptSize = max(range.endOffset) по всем функциям и диапазонам
  usedBytes  = Σ (range.endOffset - range.startOffset) где count > 0
  unusedBytes = scriptSize - usedBytes

По всем скриптам:
  jsTotalBytes   = Σ scriptSize
  jsUnusedBytes  = Σ unusedBytes
  unusedJsPercent = (jsUnusedBytes / jsTotalBytes) × 100
```

#### CSS Coverage через CDP CSS

```javascript
await client.send('DOM.enable');
await client.send('CSS.enable');
await client.send('CSS.startRuleUsageTracking');
// ... загрузка страницы ...
const { ruleUsage } = await client.send('CSS.stopRuleUsageTracking');
```

Каждая `RuleUsage` запись: `{ styleSheetId, startOffset, endOffset, used: boolean }`.

#### Формула unusedCssPercent

```
cssTotalBytes  = Σ (endOffset - startOffset) для ВСЕХ правил
cssUnusedBytes = Σ (endOffset - startOffset) для правил где used === false
unusedCssPercent = (cssUnusedBytes / cssTotalBytes) × 100
```

**Отличие от JS:** CSS coverage отслеживает **сопоставление селекторов** с DOM (был ли матч), а не выполнение кода.

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `unusedJsPercent` | % неиспользованного JS | `(jsUnusedBytes / jsTotalBytes) × 100` |
| `unusedCssPercent` | % неиспользованного CSS | `(cssUnusedBytes / cssTotalBytes) × 100` |
| `jsTotalBytes` | Общий размер JS | bytes |
| `jsUnusedBytes` | Неиспользованный JS | bytes |
| `cssTotalBytes` | Общий размер CSS | bytes |
| `cssUnusedBytes` | Неиспользованный CSS | bytes |

#### Ссылки

- CDP Profiler Domain: https://chromedevtools.github.io/devtools-protocol/tot/Profiler/
- CDP CSS Domain: https://chromedevtools.github.io/devtools-protocol/tot/CSS/

---

### 6.5 JS Parse / Compile

#### Что это

Перед выполнением JavaScript браузер проходит две обязательные стадии:

**Parsing (парсинг):** Читает исходный текст JS и преобразует в **AST (Abstract Syntax Tree)**. V8 использует **lazy parsing**: только top-level код и немедленно вызываемые функции полностью парсятся ("eager parsing"). Остальные функции "pre-parsed" (проверяется синтаксис) и полностью парсятся только при первом вызове.

**Compilation (компиляция):** Конвертирует AST в исполняемый код. Пайплайн V8:
```
Source → Parse (AST) → Ignition (bytecode) → [TurboFan (оптимизированный машинный код)]
```
- **Ignition** — компилирует в байткод быстро, всегда выполняется
- **TurboFan** — компилирует hot-функции в оптимизированный машинный код (позже, для часто выполняемых функций)

#### Влияние на загрузку

Parse + Compile происходят **до** выполнения кода. Большие скрипты = дольше parse/compile = позже интерактивность. На мобильных устройствах parse/compile может быть в **2-5 раз медленнее**, чем на десктопе.

#### Как собираем через CDP Tracing

```javascript
await client.send('Tracing.start', {
  categories: 'v8,v8.compile,disabled-by-default-v8.compile',
  transferMode: 'ReportEvents',
});
```

Trace events:
| Событие | Описание |
|---------|----------|
| `V8.Parse` | Парсинг на main thread |
| `V8.ParseFunction` | Парсинг отдельной функции |
| `v8.parseOnBackground` | Off-main-thread streaming parse (хорошо — не блокирует main thread) |
| `V8.Compile` / `V8.CompileScript` | Компиляция на main thread |

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `jsParseMs` | Время парсинга JS | `Σ dur` для Parse-событий (dur в мкс → /1000) |
| `jsCompileMs` | Время компиляции JS | `Σ dur` для Compile-событий (dur в мкс → /1000) |

> Значения могут быть 0, если скрипты закэшированы или очень маленькие.

---

### 6.6 Network Metrics

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `avgContentDownloadMs` | Среднее время загрузки контента | `mean(responseEnd - responseStart)` |
| `maxContentDownloadMs` | Макс. время загрузки | `max(responseEnd - responseStart)` |
| `http2Percent` | % ресурсов по HTTP/2 | `count(nextHopProtocol === 'h2') / total × 100` |
| `http3Percent` | % ресурсов по HTTP/3 | `count(nextHopProtocol === 'h3') / total × 100` |

---

### 6.7 Service Worker и Cache

#### Service Worker Detection

```
workerStart > 0 → Service Worker перехватывал запрос
```

`PerformanceResourceTiming.workerStart`:
- SW уже запущен → таймстемп перед dispatch FetchEvent
- SW нужно запустить → таймстемп перед стартом SW thread
- SW не задействован → **0**

SW processing time:
```
swProcessingMs = entry.fetchStart - entry.workerStart
```

#### Cache Detection

```
if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
  // Ресурс из кэша (memory cache или disk cache)
}
```

`transferSize = 0` означает: ничего не передано по сети. Если при этом `decodedBodySize > 0` — контент есть, значит из кэша.

**Отличие от cross-origin restricted:**
```
Кэш:              transferSize === 0 AND decodedBodySize > 0
Cross-origin TAO:  transferSize === 0 AND encodedBodySize === 0 AND decodedBodySize === 0
```

**Виды кэша:**

| Тип | Описание | Как определить |
|-----|----------|----------------|
| Memory cache | В памяти процесса. Быстрый. Теряется при закрытии вкладки | `transferSize === 0` (неотличим от disk cache через API) |
| Disk cache | На диске по HTTP-заголовкам (Cache-Control, ETag). Сохраняется между сессиями | `transferSize === 0` |
| SW cache | Явно кэшировано через Cache Storage API | `workerStart > 0 AND transferSize === 0` |
| 304 Not Modified | Условный запрос, сервер ответил 304 | `transferSize > 0 AND transferSize < encodedBodySize` |

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `cacheHitPercent` | % ресурсов из кэша | `count(transferSize === 0) / total × 100` |
| `cacheHitCount` | Количество из кэша | `count(transferSize === 0)` |
| `swUsed` | SW использовался | `any(workerStart > 0)` |
| `swStartMs` | Время инициализации SW | `min(workerStart)` |

---

### 6.8 MFE Comparison Metrics

Метрики для сравнения **Монолит vs Микрофронтенд** архитектур:

| Метрика | Описание | Формула | Монолит | MFE |
|---------|----------|---------|---------|-----|
| `chunkedJsCount` | Кол-во JS chunks | `scriptEntries.length` | ~10-20 | ~30+ |
| `largestChunkSize` | Макс. размер JS chunk (bytes) | `max(transferSize)` скриптов | 500KB+ | < 200KB |
| `uniqueDomains` | Кол-во уникальных доменов | `Set(hostname).size` | 1-2 | 3+ |
| `domainsList` | Список доменов | sorted `Set(hostname)` | | |

**Интерпретация:**
- Больше chunks + меньше каждый = code splitting (MFE)
- Больше доменов = разные MFE remote hosts
- Меньше самый большой chunk = лучше для загрузки

---

## 7. E2E Metrics (сценарии взаимодействия)

### Что это

E2E (End-to-End) performance testing измеряет **производительность, воспринимаемую пользователем** на протяжении полных сценариев взаимодействия, в отличие от Lighthouse (только загрузка) или синтетических бенчмарков.

### Как работает

1. Puppeteer загружает страницу (ждёт `networkidle0`)
2. Ожидание 500ms для стабилизации
3. Инжектируется `PerformanceObserver` для Long Tasks и FPS meter через `page.evaluateOnNewDocument()`
4. Последовательно выполняются шаги сценария (click, type, wait, scroll, navigate)
5. На каждом шаге собираются метрики

### Поддерживаемые действия

| Действие | Описание | Как Puppeteer выполняет |
|----------|----------|------------------------|
| `click` | Клик по элементу | CDP `Input.dispatchMouseEvent`: mouseMoved → mousePressed → mouseReleased |
| `type` | Ввод текста (50ms между символами) | CDP `Input.dispatchKeyEvent`: keyDown → keyPress → textInput → keyUp для каждого символа |
| `wait` | Ожидание N мс | `setTimeout` |
| `scroll` | Скролл на N пикселей | `page.evaluate(() => window.scrollBy(...))` |
| `navigate` | Переход по URL | `page.goto(url)` |

**Важно:** Puppeteer **не инжектирует** синтетические DOM-события. Он отправляет **low-level input команды** через CDP Input domain, которые обрабатываются браузером идентично реальному аппаратному вводу.

---

### 7.1 Long Tasks API

#### Что такое Long Task

**Long Task** — задача на main thread > **50ms**. Порог из RAIL модели: для 60fps отзывчивости main thread должен быть свободен для обработки ввода в пределах 50ms.

Пока Long Task выполняется, браузер **не может реагировать на пользовательский ввод** (клики, нажатия клавиш).

#### PerformanceObserver

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // entry.startTime — когда задача началась
    // entry.duration — длительность (всегда > 50ms)
    // entry.attribution — TaskAttributionTiming[] (что вызвало)
    console.log(`Long task: ${entry.duration}ms`);
  }
}).observe({ type: 'longtask', buffered: true });
```

#### Что вызывает Long Tasks

1. **Тяжёлый JS** — большие скрипты, сложные вычисления, JSON.parse крупных данных
2. **Layout (Reflow)** — чтение layout-свойств после DOM-мутаций (layout thrashing)
3. **Style Recalculation** — смена CSS-классов на множестве элементов, сложные селекторы
4. **Paint** — большие области перерисовки, сложные фильтры
5. **GC** — паузы сборщика мусора (10-200+ ms для major GC)
6. **Сторонние скрипты** — аналитика, реклама, чаты

#### Ссылки

- W3C Long Tasks API: https://w3c.github.io/longtasks/

---

### 7.2 Input Delay / FID / INP

#### Input Delay

**Input delay** — время между пользовательским действием (click, tap, keypress) и моментом, когда браузер **начинает выполнять** обработчик этого события. Задержка возникает, когда main thread занят другой работой.

```
Input Delay = performance.now() - event.timeStamp
```

В нашей системе измеряется как время `waitForSelector()` — от начала поиска элемента до его готовности.

#### First Input Delay (FID)

FID — input delay **первого** дискретного взаимодействия (click, tap, keypress) после загрузки.

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const fid = entry.processingStart - entry.startTime;
  }
}).observe({ type: 'first-input', buffered: true });
```

**FID был Core Web Vital с 2020 по март 2024**, заменён на INP.

#### Interaction to Next Paint (INP)

INP — преемник FID, стал Core Web Vital в **марте 2024**. Преимущества:
- Учитывает **все** взаимодействия, не только первое
- Измеряет **полную** задержку (input delay + processing + presentation), не только input delay

Для каждого взаимодействия:
```
Interaction Latency = Input Delay + Processing Time + Presentation Delay

Input Delay       = processingStart - startTime
Processing Time   = processingEnd - processingStart
Presentation Delay = next paint - processingEnd
```

INP = **98-й перцентиль** всех взаимодействий:
- ≤ 50 взаимодействий → наихудшее
- > 50 → одно наихудшее отбрасывается на каждые 50

#### Пороги

**FID:**

| Оценка | Значение |
|--------|----------|
| Хорошо | ≤ 100ms |
| Требует улучшения | 100 – 300ms |
| Плохо | > 300ms |

**INP (более высокие пороги, т.к. полная задержка):**

| Оценка | Значение |
|--------|----------|
| Хорошо | ≤ 200ms |
| Требует улучшения | 200 – 500ms |
| Плохо | > 500ms |

100ms = порог "мгновенности" по Jakob Nielsen.

#### Ссылки

- web.dev FID: https://web.dev/articles/fid
- web.dev INP: https://web.dev/articles/inp

---

### 7.3 FPS во время взаимодействия

#### Отличие от статического FPS

В стандартном FPS-замере (`page.fps`) измеряется FPS в покое (idle). В E2E FPS измеряется **во время выполнения сценария** — кликов, ввода текста, скроллинга. Это показывает реальную плавность при использовании.

#### Методика

1. `requestAnimationFrame` цикл запускается через `page.evaluateOnNewDocument()` **до** начала сценария
2. Собирает `frameTimes` на протяжении всего сценария
3. Каждые 500ms формируется точка `fpsTimeline`

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `avgFps` | Средний FPS во время сценария | `mean(fpsTimeline.fps)` |
| `minFps` | Минимальный FPS | `min(fpsTimeline.fps)` |
| `totalFrames` | Количество кадров | Счётчик rAF callbacks |
| `droppedFrames` | Пропущенные кадры | `(duration/1000 × 60) - totalFrames` |
| `fpsTimeline` | Временная шкала FPS | `[{ timeMs, fps }]` каждые 500ms |

---

### 7.4 Heap Memory Monitoring

#### Что это

Мониторинг использования JS heap-памяти во время выполнения сценария. Позволяет обнаружить утечки памяти и избыточное потребление.

#### API: performance.memory (только Chrome)

```javascript
performance.memory = {
  jsHeapSizeLimit,    // макс. размер heap (bytes)
  totalJSHeapSize,    // общий выделенный heap (bytes)
  usedJSHeapSize      // используемый heap живыми объектами (bytes)
}
```

Зависимости:
```
usedJSHeapSize ≤ totalJSHeapSize ≤ jsHeapSizeLimit
```

**Ограничения:** Значения квантованы (~100KB бакеты) для защиты от fingerprinting. Для точных значений нужны заголовки `Cross-Origin-Opener-Policy: same-origin` и `Cross-Origin-Embedder-Policy: require-corp`.

#### Методика

Замер каждые **200ms** во время выполнения сценария через `setInterval`:
```javascript
heapTimeline.push({
  time: performance.now(),
  usedSize: performance.memory.usedJSHeapSize,
  totalSize: performance.memory.totalJSHeapSize,
  usagePercent: (usedJSHeapSize / totalJSHeapSize) × 100
});
```

#### Собираемые метрики

| Метрика | Описание | Формула |
|---------|----------|---------|
| `avgHeapUsagePercent` | Средний % использования heap | `mean(usedSize / totalSize × 100)` |
| `maxHeapUsagePercent` | Пиковый % использования | `max(usedSize / totalSize × 100)` |
| `heapTimeline` | Временная шкала heap | `[{ time, usedSize, totalSize, usagePercent }]` |

**Порог:** `heapUsagePercent > 80%` — предупреждение.

#### Что вызывает рост heap при взаимодействии

1. **Detached DOM nodes** — обработчики/замыкания удерживают ссылки на удалённые DOM-элементы
2. **Accumulation of event listeners** — добавление listeners без удаления
3. **Closures capturing large scopes** — замыкания над большими объектами
4. **Growing data structures** — неограниченные массивы, Map/Set, undo history
5. **Framework leaks** — подписки без отписок в `mounted`/`useEffect`, неочищенные `setInterval`
6. **Web API objects** — IntersectionObserver, MutationObserver без disconnect()

#### Обнаружение утечек

```
Если usedJSHeapSize монотонно растёт после нескольких взаимодействий
  И рост сохраняется даже в idle-периоды (GC должен был собрать)
  → вероятна утечка памяти

leakRate = linearRegression(usedJSHeapSize по времени).slope   // bytes/sec
```

#### Ссылки

- Chrome — memory problems: https://developer.chrome.com/docs/devtools/memory-problems
- web.dev — Monitor memory usage: https://web.dev/articles/monitor-total-page-memory-usage

---

### Агрегированные метрики E2E сценария

| Метрика | Описание | Формула |
|---------|----------|---------|
| `scenarioName` | Имя сценария | — |
| `url` | Начальный URL | — |
| `steps` | Массив метрик по шагам | — |
| `totalDurationMs` | Общее время (с загрузкой) | От начала `runScenario()` до конца |
| `scenarioDurationMs` | Время сценария (без загрузки) | От первого шага до последнего |
| `totalLongTasks` | Всего Long Tasks | `Σ longTasksCount` по шагам |
| `totalLongTasksMs` | Суммарное время Long Tasks | `Σ longTasksTotalMs` по шагам |
| `avgInputDelayMs` | Среднее Input Delay | `Σ inputDelayMs / count` (без wait/navigate) |
| `maxInputDelayMs` | Макс. Input Delay | `max(inputDelayMs)` |

---

## 8. Bundle Analysis (статический анализ бандлов)

### Что это

Bundle Analysis — **статический анализ** артефактов сборки (build output) без запуска браузера. Сравнивает размеры, количество и структуру файлов между монолитной и микрофронтендной архитектурами.

В отличие от runtime-метрик (разделы 1–7), bundle analysis работает с **файлами на диске** после `npm run build`. Это позволяет оценить «стоимость» архитектурного решения ещё до деплоя.

### Контекст: реализация микрофронтендов

Проект реализации: `micro-vue-third-pizza-start-source/`

**Стек:** Vue 3 + Vite + Module Federation v1.9.3

**Архитектура:**
- **Монолит** (`frontend/`) — единое Vue 3 SPA, один Vite-бандл
- **Микрофронтенды** (`micro-frontends/`) — 6 независимых приложений:
  - **Shell** (host) — оркестратор, маршрутизация, загрузка MFE
  - **Auth** — аутентификация
  - **Pizza-Builder** — конструктор пиццы
  - **Cart** — корзина
  - **Profile** — профиль пользователя
  - **Order** — заказы

Каждый MFE — независимый Vite-проект с Module Federation плагином (`@module-federation/vite`). Shell объявляет remotes, MFE экспортируют `./entry` с интерфейсом `mount(container)` / `unmount()`.

**Shared dependencies (singleton):** Vue, Pinia, MF Runtime — загружаются один раз через Module Federation, несмотря на присутствие в каждом бандле.

### Инструмент анализа

Файл: `scripts/analyze-bundle.js` (Node.js скрипт, 477 строк)

**Возможности:**
1. Рекурсивный обход `dist/` директорий (монолит и каждый MFE)
2. Категоризация файлов: JS, CSS, Images, Fonts, HTML, Other
3. Вычисление трёх размеров: raw, gzip (`zlib.gzipSync`), brotli (`zlib.brotliCompressSync`)
4. Определение дублирования shared-зависимостей (Vue Runtime, Pinia, MF SDK)
5. Расчёт **runtime size** — реальный размер загрузки с учётом дедупликации через Module Federation
6. Генерация Markdown-отчёта со сравнительными таблицами

**Формулы:**
```
// Размер файла в gzip
gzipSize = zlib.gzipSync(fs.readFileSync(filePath)).length

// Размер файла в brotli
brotliSize = zlib.brotliCompressSync(fs.readFileSync(filePath)).length

// Runtime size (без дублирования shared deps)
runtimeSize = totalMfeSize - duplicatedSharedDepsSize

// Duplicated size = сумма shared deps кроме первого вхождения
// Vue Runtime: 6 копий в бандлах → 5 дублей → saved = 5 × singleCopyGzip
```

### Собираемые метрики

#### Общие метрики сборки

| Метрика | Описание | Единица |
|---------|----------|---------|
| `totalSize` | Общий размер всех файлов (raw) | bytes |
| `totalGzip` | Общий размер в gzip | bytes |
| `totalBrotli` | Общий размер в brotli | bytes |
| `fileCount` | Количество файлов | count |
| `jsChunksCount` | Количество JS-чанков | count |

#### Метрики по типу файла (JS, CSS, Images, Fonts, HTML)

| Метрика | Описание |
|---------|----------|
| `{type}.count` | Кол-во файлов данного типа |
| `{type}.size` | Суммарный raw-размер |
| `{type}.gzip` | Суммарный gzip-размер |
| `{type}.brotli` | Суммарный brotli-размер |

#### Метрики дедупликации (только MFE)

| Метрика | Описание | Формула |
|---------|----------|---------|
| `runtimeSize` | Реальный runtime-размер | `totalSize - duplicatedSize` |
| `runtimeGzip` | Runtime-размер (gzip) | `totalGzip - duplicatedGzip` |
| `duplicatedSize` | Размер дублей shared deps | `Σ size` дубликатов |
| `duplicatedGzip` | Размер дублей (gzip) | `Σ gzip` дубликатов |
| `{dep}.count` | Сколько раз дублируется зависимость | count |

#### Метрики per-chunk (JS)

| Метрика | Описание |
|---------|----------|
| `chunk.name` | Имя файла |
| `chunk.size` | Raw-размер |
| `chunk.gzip` | Gzip-размер |
| `chunk.brotli` | Brotli-размер |
| `largestChunkGzip` | Наибольший JS-чанк (gzip) |

### Паттерны загрузки MFE

**Eager (при старте Shell):**
- **Auth** — проверка токена, состояние авторизации
- **Cart** — подписка на события `pizza:add-to-cart`

**Lazy (при навигации):**
- **Pizza-Builder** — route `/`
- **Profile** — route `/profile`
- **Order** — routes `/order`, `/orders`

Lazy-loading MFE означает, что при первом визите пользователь загружает только Shell + Auth + Cart. Остальные MFE подгружаются при переходе на соответствующий маршрут.

### Коммуникация между MFE

| Событие | Источник | Получатель | Описание |
|---------|----------|------------|----------|
| `pizza:add-to-cart` | Pizza-Builder | Cart | Пицца добавлена в корзину |
| `cart:total-updated` | Cart | Shell Header | Обновление итога |
| `cart:order-complete` | Cart | Shell | Заказ оформлен |
| `auth:login-success` | Auth | Shell | Пользователь авторизован |
| `auth:close` | Auth | Shell | Окно авторизации закрыто |

Используется **CustomEvent (Event Bus)** + `localStorage` для персистентного состояния.

### Деплой

Каждый MFE — отдельный Docker-контейнер с Nginx:
- Shell → `micro.pizza.ew-production.ru`
- Auth → `auth.pizza.ew-production.ru`
- Cart → `cart.pizza.ew-production.ru`
- и т.д.

Traefik reverse proxy с Let's Encrypt SSL. Независимый деплой каждого MFE.

### Что даёт bundle analysis для сравнения Монолит vs MFE

1. **Overhead MFE** — на сколько увеличивается размер из-за Module Federation runtime, дублирования deps, remoteEntry.js
2. **Эффективность code splitting** — MFE естественно разделяет код по доменам
3. **Initial load** — Shell entry vs Monolith entry (точка входа MFE может быть значительно меньше)
4. **Cacheability** — MFE: изменение одного модуля не инвалидирует кэш остальных
5. **Runtime vs Static** — реальная загрузка меньше статического размера благодаря shared deps

### Ссылки

- Module Federation: https://module-federation.io/
- Vite Module Federation Plugin: https://github.com/module-federation/vite
- Webpack Bundle Analyzer: https://github.com/webpack-contrib/webpack-bundle-analyzer
- Brotli Compression: https://github.com/google/brotli

---

## Сводная таблица всех метрик

| # | Коллектор | Группа | Инструмент | Кол-во метрик |
|---|-----------|--------|------------|---------------|
| 1 | PingMetricCollector | Server | Node.js fetch | 4 |
| 2 | TtfbMetricCollector | Server | Node.js HTTP/HTTPS | 8 |
| 3 | DomMetricCollector | Browser | Puppeteer + Navigation Timing API | 15 |
| 4 | LighthouseMetricCollector | Browser | Lighthouse + Chrome | 8 |
| 5 | FpsMetricCollector | Browser | Puppeteer + rAF | 7 |
| 6 | ResourceTimingCollector | Browser | Puppeteer + CDP | 40+ |
| 7 | E2EMetricCollector | E2E | Puppeteer + PerformanceObserver | 20+ |
| 8 | Bundle Analysis | Static | Node.js (zlib) | 15+ |

**Итого: ~120+ уникальных метрик**

---

## Оценка применимости метрик для сравнения Монолит vs Микрофронтенды

Ниже — полная таблица всех метрик системы. Столбец **MFE** отмечает галочкой метрики, которые дают **значимую разницу** при сравнении монолитной и микрофронтендной архитектур. Столбец **Обоснование** объясняет, почему метрика релевантна или нет для такого сравнения.

### Критерии отбора

Метрика считается **релевантной для сравнения Монолит vs MFE**, если:
- Архитектурное решение (монолит/MFE) **напрямую влияет** на её значение
- Разница в значениях **объяснима** архитектурными различиями, а не внешними факторами
- Метрика **воспроизводимо** различается между двумя подходами при прочих равных

### 1. HTTP Ping (availability.ping)

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `elapsedMs` | | Одинаков: зависит от сети и сервера, не от фронтенд-архитектуры |
| `status` | | HTTP-код определяется сервером |
| `ok` | | Доступность не зависит от архитектуры фронтенда |
| `error` | | Сетевая ошибка не зависит от архитектуры |

**Итог:** Ping не различает монолит и MFE — это серверная метрика, фронтенд-архитектура на неё не влияет.

### 2. TTFB (page.ttfb)

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `ttfbMs` | | Зависит от бэкенда и сети, не от фронтенд-архитектуры |
| `dnsLookupMs` | | DNS одинаков при одинаковом домене |
| `tcpConnectMs` | | TCP handshake одинаков |
| `tlsHandshakeMs` | | TLS handshake одинаков |
| `serverProcessingMs` | | Серверная обработка не зависит от SPA-архитектуры |
| `status` | | HTTP-код не зависит |
| `redirectCount` | | Зависит от серверной конфигурации |
| `finalUrl` | | Информационная, не числовая |

**Итог:** TTFB не различает — мы измеряем серверную сторону, а разница между монолитом и MFE лежит в клиентском коде.

### 3. Navigation Timing (page.dom)

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `redirectMs` | | Серверная конфигурация |
| `dnsMs` | | Сетевая фаза, идентична |
| `connectMs` | | Сетевая фаза |
| `sslMs` | | TLS фаза |
| `requestMs` | | Серверная обработка HTML |
| `responseMs` | **+** | Размер HTML документа может различаться. Shell MFE отдаёт минимальный HTML, монолит — полный |
| `domParseMs` | **+** | MFE Shell HTML минимальный → быстрее парсинг. Монолит — весь DOM в одном документе |
| `executeScriptsMs` | **+** | Ключевое различие: Shell загружает MF Runtime + минимальный JS; монолит выполняет весь бандл сразу |
| `subResourcesMs` | **+** | MFE подгружает ресурсы по мере навигации (lazy), монолит может загружать больше при старте |
| `domContentLoadedMs` | **+** | Суммарный эффект: DOMContentLoaded зависит от количества и размера deferred скриптов |
| `loadEventMs` | **+** | Полная загрузка страницы. MFE Shell быстрее, т.к. загружает только каркас |
| `totalMs` | **+** | Итоговое время загрузки — прямое сравнение двух архитектур |
| `dnsCached` | | Флаг, не архитектурное различие |
| `connectionReused` | | Флаг, не архитектурное различие |
| `redirectHidden` | | Флаг |

**Итог:** 7 из 15 метрик показывают разницу. Navigation Timing хорошо отражает различия в initial load.

### 4. Lighthouse Metrics (page.lighthouse)

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `performanceScore` | **+** | Интегральная оценка — прямое сравнение «итоговой» производительности |
| `firstContentfulPaint` | **+** | MFE Shell рендерит каркас быстрее (меньше JS для парсинга); монолит ждёт полный бандл |
| `largestContentfulPaint` | **+** | LCP-элемент может загрузиться позже в MFE (доп. сетевой запрос к MFE-хосту) или раньше (если lazy-loaded MFE ещё не нужен) |
| `speedIndex` | **+** | Прогрессивный рендеринг MFE (Shell → MFE контент) vs всё-сразу монолита |
| `timeToInteractive` | **+** | Интерактивность Shell наступает раньше, т.к. меньше JS; но полная интерактивность (после загрузки всех MFE) может быть позже |
| `totalBlockingTime` | **+** | Самая весомая метрика (30%). Зависит от объёма JS на main thread. MFE: Shell грузит меньше JS при старте → меньше Long Tasks → меньше TBT. Монолит: весь JS парсится сразу |
| `cumulativeLayoutShift` | **+** | MFE могут вызывать layout shifts при асинхронной подгрузке контента (контейнер пустой → MFE загрузился → сдвиг). Монолит рендерит сразу, меньше шансов на сдвиг |
| `tti` | **+** | См. TTI — аналогично TBT, но с учётом сетевых запросов |

**Итог:** Все 8 метрик релевантны. Lighthouse — главный инструмент сравнения.

### 5. FPS Metrics (page.fps)

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `avgFps` | **+** | Может различаться из-за MF Runtime overhead (доп. обработка событий, роутинг между MFE) |
| `minFps` | **+** | Наихудший кадр: MFE может вызвать jank при асинхронной подгрузке модуля |
| `maxFps` | | Лучший кадр — обычно одинаков (ограничен VSync) |
| `droppedFrames` | **+** | Пропущенные кадры из-за подгрузки MFE во время рендеринга |
| `droppedFramesPercent` | **+** | Процентное выражение dropped frames |
| `totalFrames` | | Зависит от длительности замера, не от архитектуры |
| `frameTimes` | **+** | Распределение frame times показывает стабильность рендеринга |

**Итог:** 5 из 7 метрик релевантны. FPS показывает runtime-стоимость MFE оркестрации.

### 6. Resource Timing (page.resources)

#### 6.1 Resource Timing API

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `totalResources` | **+** | MFE загружает больше ресурсов (remoteEntry.js, MF Runtime chunks, доп. CSS) |
| `totalTransferSize` | **+** | Суммарный объём загрузки — ключевая метрика |
| `apiRequests` | | API-запросы определяются бизнес-логикой, не архитектурой |
| `avgApiDurationMs` | | Зависит от бэкенда |
| `maxApiDurationMs` | | Зависит от бэкенда |
| `apiDetails` | | Бизнес-логика |
| `scriptsCount` | **+** | MFE: ~67 JS chunks vs монолит ~13. Фундаментальное различие |
| `scriptsTotalSize` | **+** | JS — основной источник overhead MFE |
| `cssCount` | **+** | MFE может иметь дублирование CSS из-за изоляции |
| `cssTotalSize` | **+** | Суммарный CSS |

#### 6.2 CDP Performance Metrics (V8)

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `scriptDurationMs` | **+** | Время выполнения JS: MFE добавляет MF Runtime initialization, remote module resolution |
| `taskDurationMs` | **+** | Общее время задач main thread — включает все overhead MFE |
| `jsHeapUsedSize` | **+** | MFE использует больше памяти: несколько Vue instances (хоть shared), MF Runtime state, кэш модулей |
| `jsHeapTotalSize` | **+** | Общий выделенный heap |
| `heapUsagePercent` | **+** | Процент использования — MFE может быть выше |
| `layoutCount` | **+** | MFE: асинхронная вставка контента → доп. layouts при монтировании каждого MFE |
| `layoutDurationMs` | **+** | Суммарное время layout |
| `recalcStyleCount` | **+** | Каждый MFE привносит свои стили → доп. recalc |
| `recalcStyleDurationMs` | **+** | Время пересчёта стилей |
| `domNodes` | **+** | MFE добавляет wrapper-контейнеры, MF-infrastructure DOM |
| `jsEventListeners` | **+** | MFE: CustomEvent listeners для коммуникации, MF Runtime listeners |

#### 6.3 GC

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `gcCount` | **+** | Больше аллокаций из-за MF overhead → потенциально больше GC |
| `gcTotalDurationMs` | **+** | Суммарное время GC |
| `gcMaxDurationMs` | **+** | Максимальная пауза — может быть больше из-за большего heap |

#### 6.4 Coverage

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `unusedJsPercent` | **+** | Критически важно: MFE загружает код модулей, которые могут не использоваться на текущей странице. Но lazy-loading MFE может наоборот снизить unused% |
| `unusedCssPercent` | **+** | MFE: каждый модуль имеет свой CSS → меньше лишнего. Монолит: общий CSS для всех страниц |
| `jsTotalBytes` | **+** | Общий объём JS |
| `jsUnusedBytes` | **+** | Неиспользованный JS |
| `cssTotalBytes` | **+** | Общий объём CSS |
| `cssUnusedBytes` | **+** | Неиспользованный CSS |

#### 6.5 Parse / Compile

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `jsParseMs` | **+** | MFE: больше файлов → потенциально больше parse. Но каждый файл меньше, что может позволить инкрементальный parsing |
| `jsCompileMs` | **+** | Аналогично: суммарная компиляция может отличаться |

#### 6.6 Network

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `avgContentDownloadMs` | **+** | MFE: много мелких файлов vs монолит: меньше крупных. HTTP/2 multiplexing помогает MFE |
| `maxContentDownloadMs` | **+** | Монолит: один большой chunk скачивается дольше |
| `http2Percent` | **+** | MFE требует множество запросов → HTTP/2 мультиплексирование критично |
| `http3Percent` | **+** | HTTP/3 (QUIC) ещё более выгоден для MFE из-за устранения head-of-line blocking |

#### 6.7 Cache / Service Worker

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `cacheHitPercent` | **+** | MFE: при обновлении одного модуля кэш остальных не инвалидируется. Это одно из главных преимуществ MFE |
| `cacheHitCount` | **+** | Количество кэш-попаданий |
| `swUsed` | | Service Worker не зависит от архитектуры |
| `swStartMs` | | Аналогично |

#### 6.8 MFE Comparison Metrics

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `chunkedJsCount` | **+** | Специально создано для сравнения: MFE ~67 chunks vs монолит ~13 |
| `largestChunkSize` | **+** | MFE: chunks меньше → лучше для кэширования и параллельной загрузки |
| `uniqueDomains` | **+** | MFE: 6+ доменов (по одному на MFE) vs монолит: 1-2 |
| `domainsList` | **+** | Список доменов для анализа |

### 7. E2E Metrics

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `totalDurationMs` | **+** | Полное время сценария — прямое сравнение |
| `scenarioDurationMs` | **+** | Время выполнения шагов без загрузки |
| `totalLongTasks` | **+** | MFE может генерировать доп. Long Tasks при подгрузке модулей во время взаимодействия |
| `totalLongTasksMs` | **+** | Суммарное время блокировки |
| `avgInputDelayMs` | **+** | Отзывчивость на ввод — MFE оркестрация может добавить задержку |
| `maxInputDelayMs` | **+** | Наихудшая задержка — при первой загрузке MFE модуля |
| `avgFps` (E2E) | **+** | FPS во время реального взаимодействия |
| `minFps` (E2E) | **+** | Наихудший кадр при взаимодействии |
| `droppedFrames` (E2E) | **+** | Пропущенные кадры |
| `avgHeapUsagePercent` | **+** | Потребление памяти: MFE может использовать больше из-за множества рантаймов |
| `maxHeapUsagePercent` | **+** | Пиковое потребление |
| `longTasksCount` (per step) | **+** | Long Tasks на каждом шаге |
| `longTasksTotalMs` (per step) | **+** | Время Long Tasks на шаге |
| `inputDelayMs` (per step) | **+** | Задержка на каждом шаге |
| `actionDurationMs` (per step) | **+** | Длительность действия |
| `success` (per step) | | Успешность — не числовая метрика производительности |

### 8. Bundle Analysis

| Метрика | MFE | Обоснование |
|---------|-----|-------------|
| `totalSize` | **+** | Полный статический размер — MFE всегда больше из-за дублирования |
| `totalGzip` | **+** | Gzip-размер |
| `totalBrotli` | **+** | Brotli-размер |
| `fileCount` | **+** | Количество файлов — MFE значительно больше |
| `jsChunksCount` | **+** | JS chunks — фундаментальное различие |
| `runtimeSize` / `runtimeGzip` | **+** | Реальный размер загрузки с учётом дедупликации — главная метрика |
| `duplicatedSize` / `duplicatedGzip` | **+** | Overhead дублирования — «стоимость» MFE архитектуры |
| `{type}.size/gzip` | **+** | Разбивка по типу файлов |
| `largestChunkGzip` | **+** | Макс. JS chunk — MFE меньше, монолит больше |
| `entryPointGzip` | **+** | Размер точки входа — Shell vs Monolith |

---

## Итоговая сводка: релевантность по коллекторам

| # | Коллектор | Всего метрик | Релевантных для MFE | % |
|---|-----------|-------------|---------------------|---|
| 1 | HTTP Ping | 4 | 0 | 0% |
| 2 | TTFB | 8 | 0 | 0% |
| 3 | Navigation Timing | 15 | 7 | 47% |
| 4 | Lighthouse | 8 | 8 | 100% |
| 5 | FPS | 7 | 5 | 71% |
| 6 | Resource Timing | 40+ | 35+ | ~85% |
| 7 | E2E Metrics | 20+ | 15+ | ~75% |
| 8 | Bundle Analysis | 15+ | 15+ | 100% |
| | **Итого** | **~120+** | **~85+** | **~70%** |

### Ключевые выводы

**Наиболее информативные метрики для сравнения Монолит vs MFE:**

1. **Lighthouse Performance Score + TBT** — интегральная оценка и главная метрика блокировки. TBT (30% веса) напрямую зависит от объёма JS, парсируемого при загрузке.

2. **Bundle Analysis: runtimeGzip + entryPointGzip** — показывает реальную «стоимость» архитектуры в байтах.

3. **Resource Timing: scriptsCount + scriptsTotalSize + chunkedJsCount** — количественная разница в структуре загрузки.

4. **Coverage: unusedJsPercent + unusedCssPercent** — MFE с lazy-loading теоретически должен иметь меньше неиспользованного кода на каждой конкретной странице.

5. **E2E: totalDurationMs + avgInputDelayMs** — реальная производительность при пользовательском взаимодействии.

6. **CDP: jsHeapUsedSize + layoutCount + scriptDurationMs** — runtime-overhead MFE оркестрации.

7. **Cache: cacheHitPercent** — одно из главных преимуществ MFE: гранулярная инвалидация кэша.

**Нерелевантные метрики (Ping, TTFB)** — измеряют серверную инфраструктуру, которая идентична при обоих архитектурах. Разница между монолитом и MFE полностью лежит в клиентском коде.

---

## Полный список ссылок на официальные источники

### W3C Specifications
- Navigation Timing Level 2: https://www.w3.org/TR/navigation-timing-2/
- Resource Timing Level 2: https://www.w3.org/TR/resource-timing-2/
- Long Tasks API: https://w3c.github.io/longtasks/
- Long Animation Frames: https://w3c.github.io/long-animation-frames/
- Event Timing API: https://w3c.github.io/event-timing/
- User Timing Level 3: https://w3c.github.io/user-timing/
- Paint Timing: https://w3c.github.io/paint-timing/

### web.dev (Google)
- TTFB: https://web.dev/articles/ttfb
- FCP: https://web.dev/articles/fcp
- LCP: https://web.dev/articles/lcp
- CLS: https://web.dev/articles/cls
- CLS Evolution: https://web.dev/articles/evolving-cls
- TBT: https://web.dev/articles/tbt
- TTI: https://web.dev/articles/tti
- Speed Index: https://web.dev/articles/speed-index
- FID: https://web.dev/articles/fid
- INP: https://web.dev/articles/inp
- RAIL Model: https://web.dev/articles/rail
- Rendering Performance: https://web.dev/articles/rendering-performance
- Web Vitals: https://web.dev/articles/vitals

### Chrome DevTools
- Lighthouse Scoring: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- Lighthouse Score Calculator: https://googlechrome.github.io/lighthouse/scorecalc/
- CDP Performance Domain: https://chromedevtools.github.io/devtools-protocol/tot/Performance/
- CDP Tracing Domain: https://chromedevtools.github.io/devtools-protocol/tot/Tracing/
- CDP Profiler Domain: https://chromedevtools.github.io/devtools-protocol/tot/Profiler/
- CDP CSS Domain: https://chromedevtools.github.io/devtools-protocol/tot/CSS/
- Long Animation Frames: https://developer.chrome.com/docs/web-platform/long-animation-frames
- Performance Analysis: https://developer.chrome.com/docs/devtools/performance

### MDN Web Docs
- PerformanceNavigationTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming
- PerformanceResourceTiming: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming
- requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- performance.now(): https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- Navigation Timing Guide: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Navigation_timing

### Node.js
- net.Socket: https://nodejs.org/api/net.html#class-netsocket
- tls.TLSSocket: https://nodejs.org/api/tls.html#class-tlstlssocket
- Performance Hooks: https://nodejs.org/api/perf_hooks.html

### Other
- Layout Thrashing List (Paul Irish): https://gist.github.com/paulirish/5d52fb081b3570c81e3a
- Lighthouse Source Code: https://github.com/GoogleChrome/lighthouse
- Puppeteer API: https://pptr.dev/api
- Module Federation: https://module-federation.io/
- Vite Module Federation Plugin: https://github.com/module-federation/vite
- Brotli Compression: https://github.com/google/brotli
