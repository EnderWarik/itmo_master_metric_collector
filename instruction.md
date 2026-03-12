# Инструкция по настройке интеграции формы сайта с Битрикс24

**Компания:** М Сервис

**Где размещается интеграция:** На сервере клиента

**Цель:** Настроить передачу заявок с формы «Демо-версия» на сайте mservice.group в лиды Битрикс24 через REST API методом `crm.lead.add`. Для внешних интеграций Bitrix24 использует входящие вебхуки.

> **Примечание:** Метод `crm.lead.add` продолжает работать и полностью поддерживается. У него есть более новый универсальный аналог `crm.item.add` (с `entityTypeId: 1` для лидов), но для данной задачи `crm.lead.add` подходит и является более простым вариантом.

---

## 1. Создать входящий вебхук в Битрикс24

### Шаг 1. Перейти в раздел вебхуков

В Битрикс24 нужно открыть раздел **Разработчикам / Вебхуки** и создать новый входящий вебхук. Для интеграции сайта, который должен обращаться к Битрикс24 извне, нужен именно входящий вебхук.

### Шаг 2. Выдать права

При создании вебхука нужно выдать права на модуль:

- **CRM**

Этого достаточно, чтобы backend сайта мог создавать лиды через REST API.

### Шаг 3. Сохранить вебхук

После сохранения Bitrix24 покажет готовую основу URL для REST-запросов.

Структура URL:

```
https://<домен_портала>/rest/<user_id>/<webhook_code>/<method>.json
```

Пример для создания лида:

```
https://your-portal.bitrix24.ru/rest/1/xxxxxxxxxxxxxxxx/crm.lead.add.json
```

Bitrix24 разбирает этот URL на части:

1. **user_id** — ID пользователя, который создал вебхук
2. **webhook_code** — секретный код вебхука
3. **method** — REST-метод, например `crm.lead.add`

### Что такое user_id

`user_id` — это идентификатор сотрудника в Битрикс24, от имени которого будет работать вебхук. В URL подставляется идентификатор пользователя, который этот вебхук создал.

То есть:
- вебхук создал пользователь с ID `1`
- значит в URL будет `.../rest/1/...`

### Как узнать user_id

Отдельно искать его обычно не нужно: после создания вебхука Bitrix24 сам показывает уже готовый URL, где `user_id` уже подставлен. Его нужно просто скопировать из интерфейса Bitrix24.

> **Важно:** `webhook_code` — это секрет. Его нельзя размещать в frontend-коде сайта, JavaScript или HTML, потому что он дает доступ к REST API от имени пользователя, создавшего вебхук.

---

## 2. Подготовить backend-обработчик на сервере клиента

### Шаг 1. Создать серверный endpoint

На сервере клиента нужно создать backend-обработчик, который будет принимать данные формы сайта.

Примеры:
- PHP: `/api/bitrix/demo-request.php`
- Node.js: `/api/bitrix/demo-request`
- любой другой backend route

### Шаг 2. Настроить форму сайта на отправку в backend

Форма **не должна** отправлять данные напрямую в Bitrix24. Форма должна отправлять данные на сервер клиента, а уже сервер клиента должен вызывать Bitrix24 по webhook URL. Это безопасная схема для работы с входящим вебхуком.

---

## 3. Какие поля принять с формы сайта

Backend-обработчик должен принять из формы следующие поля:

- `city`
- `phone`
- `email`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

Если на сайте есть другие поля, их также можно передать в лид через стандартные или пользовательские поля CRM.

---

## 4. Какие поля передавать в Битрикс24

Для создания лида используется метод:

```
crm.lead.add.json
```

Bitrix24 в методе `crm.lead.add` принимает объект `fields`, в котором передаются стандартные и пользовательские поля лида. Формат полей можно дополнительно проверить методом `crm.lead.fields`.

### Соответствие полей

| Поле формы     | Поле Битрикс24         | Тип поля     |
|----------------|------------------------|--------------|
| *(заголовок)*  | `TITLE`                | Стандартное  |
| `phone`        | `PHONE`                | Стандартное  |
| `email`        | `EMAIL`                | Стандартное  |
| `city`         | `UF_CRM_XXXXXXXXXXXX`  | Пользовательское |
| `utm_source`   | `UTM_SOURCE`           | Стандартное  |
| `utm_medium`   | `UTM_MEDIUM`           | Стандартное  |
| `utm_campaign` | `UTM_CAMPAIGN`         | Стандартное  |
| `utm_content`  | `UTM_CONTENT`          | Стандартное  |
| `utm_term`     | `UTM_TERM`             | Стандартное  |
| *(комментарий)*| `COMMENTS`             | Стандартное  |

> **Важно:** UTM-метки (`UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT`, `UTM_TERM`) — это **стандартные встроенные поля** лидов в Битрикс24. Для них **не нужно** создавать пользовательские поля `UF_CRM_...`. Только для поля «Город» необходимо использовать пользовательское поле, так как стандартного поля города для лидов нет.

---

## 5. Как передавать телефон и e-mail

Согласно документации Bitrix24, `PHONE` и `EMAIL` передаются не строкой, а **массивом объектов** с полями `VALUE` и `VALUE_TYPE`.

Пример:

```json
{
  "PHONE": [
    {
      "VALUE": "+79999999999",
      "VALUE_TYPE": "WORK"
    }
  ],
  "EMAIL": [
    {
      "VALUE": "test@example.com",
      "VALUE_TYPE": "WORK"
    }
  ]
}
```

Допустимые значения `VALUE_TYPE`: `WORK`, `HOME`, `MOBILE`, `OTHER`.

---

## 6. Какой запрос должен отправлять backend

Backend должен отправить POST-запрос на URL вида:

```
https://<домен_портала>/rest/<user_id>/<webhook_code>/crm.lead.add.json
```

где:
- `<домен_портала>` — домен Битрикс24 клиента
- `<user_id>` — ID пользователя, создавшего вебхук
- `<webhook_code>` — секретный код вебхука

### Пример тела запроса

```json
{
  "fields": {
    "TITLE": "Заявка с формы Демо-версия",
    "PHONE": [
      {
        "VALUE": "+79999999999",
        "VALUE_TYPE": "WORK"
      }
    ],
    "EMAIL": [
      {
        "VALUE": "test@example.com",
        "VALUE_TYPE": "WORK"
      }
    ],
    "UF_CRM_XXXXXXXXXXXX": "Москва",
    "UTM_SOURCE": "google",
    "UTM_MEDIUM": "cpc",
    "UTM_CAMPAIGN": "demo_campaign",
    "UTM_CONTENT": "banner_1",
    "UTM_TERM": "crm",
    "COMMENTS": "Форма: Демо-версия\nСайт: mservice.group"
  },
  "params": {
    "REGISTER_SONET_EVENT": "Y"
  }
}
```

> Метод `crm.lead.add` создает именно лид в CRM. Он не создает отдельно контакт или сделку, если вызывается только этот метод.

---

## 7. Пример на PHP

```php
<?php

$webhookUrl = 'https://your-portal.bitrix24.ru/rest/1/xxxxxxxxxxxxxxxx/crm.lead.add.json';

$city = $_POST['city'] ?? '';
$phone = $_POST['phone'] ?? '';
$email = $_POST['email'] ?? '';

$utmSource   = $_POST['utm_source'] ?? '';
$utmMedium   = $_POST['utm_medium'] ?? '';
$utmCampaign = $_POST['utm_campaign'] ?? '';
$utmContent  = $_POST['utm_content'] ?? '';
$utmTerm     = $_POST['utm_term'] ?? '';

$queryData = http_build_query([
    'fields' => [
        'TITLE' => 'Заявка с формы Демо-версия',
        'PHONE' => [
            [
                'VALUE' => $phone,
                'VALUE_TYPE' => 'WORK'
            ]
        ],
        'EMAIL' => [
            [
                'VALUE' => $email,
                'VALUE_TYPE' => 'WORK'
            ]
        ],

        // Подставить реальный ID пользовательского поля для города
        'UF_CRM_XXXXXXXXXXXX' => $city,

        // UTM-метки — стандартные поля, не требуют создания UF_CRM
        'UTM_SOURCE' => $utmSource,
        'UTM_MEDIUM' => $utmMedium,
        'UTM_CAMPAIGN' => $utmCampaign,
        'UTM_CONTENT' => $utmContent,
        'UTM_TERM' => $utmTerm,

        'COMMENTS' => "Форма: Демо-версия\nСайт: mservice.group"
    ],
    'params' => [
        'REGISTER_SONET_EVENT' => 'Y'
    ]
]);

$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => $webhookUrl,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $queryData,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => false,
]);

$result = curl_exec($curl);
$error = curl_error($curl);

curl_close($curl);

header('Content-Type: application/json; charset=utf-8');

if ($error) {
    echo json_encode([
        'success' => false,
        'message' => $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo $result;
```

---

## 8. Что нужно указать в HTML-форме

На стороне сайта у полей формы должны быть корректные `name`.

Пример:

```html
<input type="text" name="city">
<input type="text" name="phone">
<input type="email" name="email">
<input type="hidden" name="utm_source" value="">
<input type="hidden" name="utm_medium" value="">
<input type="hidden" name="utm_campaign" value="">
<input type="hidden" name="utm_content" value="">
<input type="hidden" name="utm_term" value="">
```

---

## 9. Последовательность действий для разработчика клиента

1. В Битрикс24 создать входящий вебхук с правами **CRM**.
2. Скопировать готовый webhook URL из интерфейса Bitrix24.
3. Проверить, что в URL есть: домен портала, `user_id`, `webhook_code`.
4. На backend сервера создать обработчик формы.
5. Настроить форму сайта так, чтобы она отправляла данные в backend, а не напрямую в Bitrix24.
6. Принять поля формы: `city`, `phone`, `email`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
7. Собрать объект `fields` для Bitrix24.
8. Подставить реальный код пользовательского поля `UF_CRM_...` для города.
9. Выполнить POST-запрос на: `https://<домен_портала>/rest/<user_id>/<webhook_code>/crm.lead.add.json`
10. Проверить, что в CRM создан новый лид и в него передались все значения.

---

## 10. Что проверить после настройки

1. Создается ли лид в Битрикс24.
2. Корректно ли передается телефон.
3. Корректно ли передается e-mail.
4. Заполняется ли город.
5. Передаются ли все UTM-метки.
6. Не опубликован ли `webhook_code` во frontend-коде сайта.

---

## Официальная документация Bitrix24

- [Входящие вебхуки и структура webhook URL](https://apidocs.bitrix24.com/local-integrations/local-webhooks.html)
- [Метод crm.lead.add](https://apidocs.bitrix24.com/api-reference/crm/leads/crm-lead-add.html)
- [Метод crm.item.add (универсальный)](https://apidocs.bitrix24.com/api-reference/crm/universal/crm-item-add.html)
- [Туториал: как добавить лид](https://apidocs.bitrix24.com/tutorials/crm/how-to-add-crm-objects/how-to-add-lead.html)

---

### Краткое пояснение по user_id

`user_id` в webhook URL — это ID пользователя Битрикс24, который создал вебхук. Его не нужно высчитывать вручную: Bitrix24 показывает готовый URL после создания вебхука, и этот ID там уже подставлен.
