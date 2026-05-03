# Аудит функциональной и структурной эквивалентности: Monolith vs MFE

Дата: 2026-04-26
Источник: `/Users/enderwar/Documents/Programming/itmo/micro-vue-third-pizza-start-source/`

---

## 1. Функциональная эквивалентность

### Бизнес-сценарии

| Сценарий | Monolith (`frontend/src`) | MFE | Эквивалентны |
|---|---|---|---|
| Авторизация (login/logout/whoAmI) | `modules/auth/` + `views/LoginView.vue` | `auth/` remote | Да |
| Конструктор пиццы (size/dough/sauces/ingredients) | `modules/pizza/` + `views/HomeView.vue` | `pizza-builder/` remote | Да |
| Корзина (просмотр + checkout) | `modules/cart/` + `views/CartView.vue` | `cart/` remote (включает оформление заказа) | Да |
| История заказов | `modules/order/` + `views/OrdersView.vue` | `order/` remote | Да |
| Профиль (адреса) | `modules/profile/` + `views/ProfileView.vue` | `profile/` remote | Да |

### Сверка компонентов

Все ключевые компоненты совпадают 1:1 по именам и иерархии:

- **Auth**: `LoginContainer.vue`, `FormLine.vue` (оба варианта).
- **Cart**: `AdditionalList`, `AdditionalListItem`, `CartContainer`, `CartFooter`, `CartForm`, `CartList`, `CartListItem`, `CartProduct`, `FormLine`, `OrderThanksModal` — присутствуют в обоих.
- **Pizza**: `PizzaContainer`, `dough/DoughSelector`, `size/SizeSelector`, `ingredient/IngredientsSelector`, `content/ContentPizza`, `content/ContentResult`, `content/PizzaConstructor` — присутствуют в обоих.
- **Order**: `OrderAdditionalItem`, `OrderAdditionalList`, `OrderCard`, `OrderHeader`, `OrderList`, `OrderListItem`, `OrderProduct` — присутствуют в обоих (в MFE добавлен `OrderContainer.vue` как корневой компонент удалённого модуля).
- **Profile**: `AddressCard`, `AddressForm`, `AddressLine`, `UserInfo` — присутствуют в обоих.
- **Header**: `HeaderCart`, `HeaderLogo`, `HeaderUser` — у монолита в `modules/header/`, у MFE в `shell/src/components/`. Дополнительно в shell — `HeaderComponent.vue` и `MfeLoader.vue` (служебные обёртки, бизнес-логике не относятся).

### Маршруты (Vue Router)

Monolith (`frontend/src/router/index.ts`):
- `/`, `/login`, `/cart`, `/orders`, `/profile` (5 маршрутов)
- guard: `authMiddleware` редиректит неавторизованных на `/login`.

MFE shell (`shell/src/router/index.ts`):
- `/`, `/login`, `/cart`, `/order`, `/orders`, `/profile` (6 маршрутов)
- Лишний маршрут `/order` (страница оформления). В монолите оформление встроено в `/cart`.
- В shell нет аналога `authMiddleware`. Защита маршрутов в MFE отсутствует на уровне shell — каждый remote сам проверяет токен (или не проверяет).

**Статус: ТРЕБУЕТ ВНИМАНИЯ.** Бизнес-сценарии совпадают, компоненты совпадают. Расхождения:
1. В MFE есть дополнительный маршрут `/order` (отдельная страница оформления). Не критично для бенчмарка стартовой загрузки, но при сценарном E2E может давать разный путь.
2. В MFE нет общего auth-guard на роутере shell — отличается контракт защиты приватных страниц.

---

## 2. API и бэкенд

| Эндпоинт | Monolith | MFE remote | Совпадает |
|---|---|---|---|
| `POST /login` | `modules/auth/authApi.ts:8` | `auth/api/authApi.ts:15` | Да |
| `DELETE /logout` | `modules/auth/authApi.ts:12` | `auth/api/authApi.ts:19` | Да |
| `GET /whoAmI` | `modules/auth/authApi.ts:16` | `auth/api/authApi.ts:23` | Да |
| `GET /dough,/ingredients,/sauces,/sizes` | `modules/pizza/pizzaApi.ts` | `pizza-builder/api/pizzaApi.ts` | Да |
| `GET /misc` | `modules/cart/cartApi.ts:6` | `cart/api/cartApi.ts:5` | Да |
| `POST/GET/DELETE /orders/...` | `modules/order/orderApi.ts` | `order/api/orderApi.ts` | Да |
| `GET/POST/PUT/DELETE /addresses/...` | `modules/profile/profileApi.ts` | `profile/api/profileApi.ts` | Да |

### Базовый URL

- Monolith: `API_URL = import.meta.env.VITE_API_URL || "/api"` (`frontend/src/http/constants/index.ts:1`). В dev ходит через Vite proxy `/api -> http://backend:3000/` (`frontend/vite.config.ts:18`).
- MFE: `API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"` (`*/src/http/httpClient.ts:4`). Прямой вызов без прокси.

В обоих установлен Bearer-токен из `TokenStorage` / `localStorage["access_token"]` в request interceptor; на 401 токен очищается. Семантически идентично.

### HTTP-клиент

Monolith использует кастомный класс `HttpClient` с собственным `HttpError` (`frontend/src/http/HttpClient.ts`). MFE использует прямой `axios.create()` без обёртки — ошибки пробрасываются как есть (`*/src/http/httpClient.ts`).

**Статус: ПРОЙДЕНО** по эндпоинтам и схемам, **ТРЕБУЕТ ВНИМАНИЯ** по обработке ошибок: монолит нормализует ошибки в `HttpError`, MFE — нет. На метрики стартовой загрузки это не влияет.

---

## 3. Стили / UI

- **Шрифты**: один и тот же набор Roboto woff/woff2 в обоих сборках (см. `bundle-report.md:156-176`, 6 файлов шрифтов по 255.59 KB raw в обоих).
- **Иконки**: SVG-набор пиццы — идентичный (одинаковые имена `parmesan.svg`, `mozzarella.svg`, `bacon.svg` и т. п.).
- **SCSS-токены и общие компоненты**: монолит использует `frontend/src/assets/scss/` (app.scss, ds-system, mixins, scaffolding, wrapper, visually-hidden, fonts.scss, libs). MFE — те же файлы выкачаны в `micro-frontends/packages/shared/src/assets/scss/` (без `fonts.scss` — шрифты подключаются у каждого remote отдельно). Структура каталогов идентична.
- **Общие компоненты**: `TitleComponent`, `ButtonComponent`, `TextInput`, `CloseButton`, `CounterComponent`, `DragComponent`, `DropComponent`, `DropdownComponent`, `InputComponent`, `RadioComponent`, `SheetComponent`, `SidebarComponent`, `SidebarNav` — 13 общих компонентов в обоих (`frontend/src/common/components/` vs `packages/shared/src/common/components/` через экспорты в `packages/shared/src/index.ts:2-14`).

**Статус: ПРОЙДЕНО.** UI-стек идентичен. Единственное конструктивное отличие — в MFE Vue runtime, шрифты и общие компоненты дублируются по 6 раз (по числу самостоятельных Vite-сборок), что и фиксирует bundle-report.md.

---

## 4. Состав MFE

Подтверждено: `shell, auth, cart, profile, order, pizza-builder` — ровно 6 пакетов в `micro-frontends/`. Нет лишних, нет недостающих.

| Remote | dev-port | filename | exposes | shared (singleton) | Где подгружается у shell |
|---|---|---|---|---|---|
| **shell** | 5010 | `remoteEntry.js` (только как host) | — (host, не expose'ит) | `vue ^3.3.0`, `pinia ^2.1.0` | — (host) |
| **auth** | **5001** | `remoteEntry.js` | `./entry: ./src/entry.ts` | `vue ^3.3.0`, `pinia ^2.1.0` | Зарегистрирован статически в `shell/vite.config.ts:22-27`. Загружается lazy через `loadRemote('auth')` в `MfeLoader` при переходе на `/login`. |
| **pizzaBuilder** | **5002** | `remoteEntry.js` | `./entry` | `vue`, `pinia` | Динамический remote (registerRemotes в `federationPlugin.ts:29`). Lazy через `MfeLoader` на `/`. |
| **cart** | **5003** | `remoteEntry.js` | `./entry` | `vue`, `pinia` | Динамический remote. **Eager-импорт** `import('cart/entry').then(({init}) => init())` в `shell/src/main.ts:16-18` для регистрации listener'а `pizza:add-to-cart`. Полный mount всё равно lazy через `MfeLoader` на `/cart`. |
| **profile** | **5004** | `remoteEntry.js` | `./entry` | `vue`, `pinia` | Динамический remote. Lazy через `MfeLoader` на `/profile`. |
| **order** | **5005** | `remoteEntry.js` | `./entry` | `vue`, `pinia` | Динамический remote. Lazy через `MfeLoader` на `/order` и `/orders`. |

> **Замечание по портам.** В описании задачи аудита указано: `cart=5002, profile=5003, pizza-builder=5004, order=5005`. **В реальном коде (vite.config.ts каждого remote и `shell/src/config/remotes.ts:23-49`)**: `pizza-builder=5002, cart=5003, profile=5004, order=5005`. Перепутаны cart/pizza-builder и profile. Шапка задачи ошибочна, реальная конфигурация консистентна.

> **Замечание по shell.** Shell сам выступает host'ом, но в `shell/vite.config.ts` имеет `name: 'shell'` и `filename: 'remoteEntry.js'` — это режим host-as-remote `@module-federation/vite`, когда shell получает свой `remoteEntry.js` для shared-scope, не expose'я экспортов.

**Статус: ПРОЙДЕНО** (с уточнением по портам).

---

## 5. Стратегия подгрузки

Подтверждено по `shell/src/main.ts` и `shell/src/router/index.ts`:

| MFE | Eager / Lazy в shell |
|---|---|
| auth | **Lazy** через `MfeLoader.loadRemote('auth')` при навигации на `/login`. (Поправка к ожиданию: auth НЕ eager.) |
| cart | **Частично eager**: `entry.init()` импортируется eagerly в `main.ts:16-18` для регистрации event-listener'а `pizza:add-to-cart`. Само mount-приложение корзины — lazy через `MfeLoader` на `/cart`. |
| pizzaBuilder | Lazy через `MfeLoader` на `/`. |
| profile | Lazy через `MfeLoader` на `/profile`. |
| order | Lazy через `MfeLoader` на `/order`/`/orders`. |

**Проверка токена при старте.** В отличие от ожидания, проверки токена в shell-приложении нет. `auth/entry.ts:20-25` экспортирует `initAuth()`, но shell его не вызывает. `mfePreloader.ts` существует, но **в `main.ts` не используется**. Файл — мёртвый код.

**Статус: ТРЕБУЕТ ВНИМАНИЯ.**
- Подтверждено: cart eager-импорт `init()` (для слушателя корзины) — да.
- Опровергнуто: auth eager — нет, грузится lazy. Проверка токена при старте shell не происходит.
- pizza-builder/profile/order lazy через маршруты — подтверждено.

---

## 6. Shared deps

Проверены все `vite.config.ts`:

| Пакет | shell | auth | cart | profile | order | pizza-builder |
|---|---|---|---|---|---|---|
| `vue` | `singleton, ^3.3.0` | `^3.3.0` | `^3.3.0` | `^3.3.0` | `^3.3.0` | `^3.3.0` |
| `pinia` | `singleton, ^2.1.0` | `^2.1.0` | `^2.1.0` | `^2.1.0` | `^2.1.0` | `^2.1.0` |
| `vue-router` | закомментировано | не shared | закомментировано | закомментировано | закомментировано | не shared |

Во всех конфигах **`singleton: true` явно указан только у объявленного объекта shared** — синтаксис `vue: { singleton: true, requiredVersion: '^3.3.0' }`. Стоит во всех 6 пакетах, версии идентичны.

`vue-router` НЕ помечен как shared нигде — закомментирован. Это означает, что cart/order/profile, у которых есть собственный router, будут содержать дубль `vue-router` в бандле.

**Статус: ПРОЙДЕНО** для vue/pinia (singleton, идентичные версии). **ТРЕБУЕТ ВНИМАНИЯ:** `vue-router` не shared — это объясняет часть инфляции бандла MFE.

---

## 7. Бандл-аудит

Использованы существующие dist (timestamp 2026-04-26 22:50–22:52, ~30 минут назад).

### Монолит (`frontend/dist/`)

- Total raw: **1.4 MB** (по `du`), **1.18 MB** по точному расчёту (`bundle-report.md:9`).
- JavaScript: 13 чанков, 200.41 KB raw / 78.68 KB gzip.
- Entry chunk: `assets/index-BBXFlLSa.js` — 151.29 KB raw / **59.07 KB gzip**.
- Файлов всего: 91.

### MFE (сумма по 6 dist'ам)

- Total raw: **2.36 MB** (`bundle-report.md:10`), 2.81 MB по `du` (с FS-padding).
- JavaScript: **76 чанков**, 1.39 MB raw / 539.78 KB gzip.
- Файлов всего: 182.
- Shell entry chunk: `assets/index-C-uSXZdh.js` — 33.08 KB raw / **12.77 KB gzip**.
- Размер shell remoteEntry+host bundle (всё, что грузится до первого MFE): index 33.08K + virtual_mf-REMOTE_ENTRY 74.73K + vue.runtime 106.63K + pinia 5.55K + share-загрузчики ≈ 226 KB raw.

### Сравнение с цифрами ВКР

| Метрика | ВКР Monolith | Реально Monolith | ВКР MFE | Реально MFE | Расхождение |
|---|---|---|---|---|---|
| Total Size | 1.18 MB | 1.18 MB | **5.10 MB** | **2.36 MB** | **MFE завышен в 2.16x** |
| Chunks | 13 | 13 | 67 | **76** | +9 чанков |
| Entry JS gzip | 59 KB | 59.07 KB | 19 KB | **12.77 KB** (shell) | -6 KB (MFE на самом деле меньше) |

**Статус: НЕ ПРОЙДЕНО.** Цифра 5.10 MB для MFE в ВКР не подтверждается реальной сборкой — реальный размер 2.36 MB. Возможно в ВКР учитывался размер development-сборки или были включены node_modules. Цифру следует исправить в тексте ВКР до 2.36 MB. Количество чанков 67 — тоже неточно, реально 76. Entry JS gzip 19 KB не соответствует ни одному пакету — реально shell entry 12.77 KB; возможно в ВКР учли entry MFE (например cart entry-COjRzln1.js — 31.54 KB gzip), но 19 KB точно не подтверждается.

> Важно: bundle-report.md в самом репозитории `micro-vue-third-pizza-start-source/` уже содержит правильные цифры. Текст ВКР должен ссылаться на него.

---

## 8. Локальные замеры (compare-raw.csv / compare-aggregated.csv)

Источник: `/Users/enderwar/Documents/Programming/itmo/nir3/scripts/out/compare-aggregated.csv` (медианы 11 запусков).

| Метрика | ВКР M / MFE | Aggregated M / MFE | Расхождение |
|---|---|---|---|
| Performance Score | 64 / 58 | 64 / 58 | — |
| LCP, ms | 5109 / 6630 | 5109 / 6630 | — |
| Scripts Count | 6 / 46 | 6 / 46 | — |
| Total Resources | 42 / 82 | 42 / 82 | — |
| Transfer Size, B | 540 KB / 649 KB | 552419 (≈540KB) / 664810 (≈649KB) | — (округление совпадает) |
| JS Parse, ms | 13 / 55 | 13 / 55 | — |
| DOM Nodes | 1060 / 2091 | 1060 / 2091 | — |

**Статус: ПРОЙДЕНО.** Все медианы из шапки ВКР воспроизводятся 1:1 из `compare-aggregated.csv`. Замеры консистентны.

---

## Сводный отчёт

### Подтверждено эквивалентным

1. Бизнес-сценарии (auth, конструктор, корзина, оформление, история, профиль) присутствуют в обеих версиях с одинаковым набором компонентов 1:1.
2. API-контракты (URL, методы, типы запросов/ответов) идентичны. Один и тот же бэкенд `localhost:3000` (через прокси у монолита, прямо у MFE).
3. UI-стек: шрифты (Roboto), SVG-иконки, SCSS-токены и 13 общих UI-компонентов идентичны (в MFE вынесены в `packages/shared`).
4. Состав MFE: ровно 6 пакетов (shell + 5 remotes) с правильными exposes и идентичными версиями shared `vue`/`pinia` (singleton).
5. Стратегия подгрузки: `cart` действительно eager-импортирует `init()` для слушателя `pizza:add-to-cart`; pizzaBuilder/profile/order/auth — lazy через `MfeLoader`.
6. Локальные замеры из `compare-aggregated.csv` точно совпадают с медианами в ВКР.

### Что расходится

1. **Маршруты shell:** есть лишний `/order` (отдельная страница оформления заказа), которого нет у монолита (там оформление встроено в `/cart`). Это расхождение бизнес-навигации — фиксировать в ВКР как «функциональное отличие, не влияющее на стартовую загрузку».
2. **Auth guard:** в монолите `authMiddleware` глобально защищает приватные роуты; в shell MFE такого guard'а нет — приватные страницы в shell открываются всем, проверка токена делегирована remote'ам. Это **поведенческое расхождение**.
3. **HTTP error handling:** монолит нормализует ошибки в `HttpError` с полями `status/code/details`; MFE пробрасывают raw `AxiosError`. На LCP/TTFB не влияет, но поведение страниц при API-ошибках разное.
4. **Auth eager-загрузка:** в задаче аудита ожидалось что `auth` eager (для проверки токена при старте). Реально — `auth` lazy, `auth/entry.ts:initAuth()` экспортирован, но shell его не вызывает; `shell/src/plugins/mfePreloader.ts` существует как мёртвый код.
5. **Vue Router не shared:** singleton отсутствует, `vue-router` дублируется в каждом remote с собственным router'ом. Часть инфляции бандла MFE объяснена этим.
6. **Порты в шапке задачи аудита** перепутаны (`pizza-builder` и `cart` поменяны местами с `profile` и т. п.). Реальные порты: auth=5001, pizzaBuilder=5002, cart=5003, profile=5004, order=5005.
7. **Цифры из ВКР по бандлу:**
   - MFE Total Size **5.10 MB ≠ 2.36 MB** (реально). Сильное завышение, скорее всего ошибка в ВКР.
   - MFE Chunks **67 ≠ 76** (реально).
   - Entry JS gzip **19 KB ≠ 12.77 KB** (shell index реально меньше).

### Где править

| Что | Где править |
|---|---|
| Total Size MFE 5.10 MB → **2.36 MB** | Текст ВКР |
| Chunks MFE 67 → **76** | Текст ВКР |
| Entry JS gzip MFE 19 KB → **12.77 KB** (shell) или явно указать другой entry | Текст ВКР |
| Порядок портов remote'ов в шапке задачи | Шапка ТЗ аудита (5002↔5003 и 5003↔5004) |
| Auth eager vs lazy | Уточнить в тексте ВКР: shell **не** проверяет токен при старте; вызов `initAuth()` отсутствует |
| Маршрут `/order` отсутствует в монолите | Зафиксировать в ВКР как осознанное архитектурное расхождение и ограничить E2E-сценарии общим путём `/`→`/cart`→`/orders` |
| Auth guard расходится | Зафиксировать в ВКР; для корректности бенчмарка стартовой загрузки приватных страниц либо добавить guard в shell, либо мерить только публичные пути (`/`, `/login`) |
| Vue Router shared | Опционально: добавить `'vue-router': { singleton: true }` во все 6 vite.config.ts, чтобы устранить ~5 KB×N дубликатов и сравнить эффект |

### Итоговый вердикт по эквивалентности

**Условно эквивалентны** на уровне бизнес-логики, API и UI-сток. Замеры стартовой загрузки (LCP, TTFB, JS Parse, DOM Nodes, Transfer Size, Scripts Count) сравнимы — приложения делают одно и то же на одном бэкенде с одним набором компонентов. Разница в метриках (медианы из CSV) объяснима архитектурой: 6× дублей Vue runtime, 12× дублей Pinia, отсутствие shared `vue-router`, оверхед `@module-federation/runtime` (~279 KB суммарно по `bundle-report.md:189`).

**Поправки требуют:**
- цифры totalSize/chunks/entry-JS в ВКР (несоответствие реальной сборке);
- описание стратегии auth (lazy, без проверки токена при старте);
- упоминание дополнительного маршрута `/order` и отсутствия guard'а в shell.
