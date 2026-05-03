#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор отчёта по практике 4 для Москалёва А.Д.
Стиль оформления: ИТМО (по образцу Практика 3 + требования tre.pdf)
"""

from docx import Document
from docx.shared import Pt, Mm, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy
import os

OUTPUT_PATH = '/Users/enderwar/Documents/Programming/itmo/nir3/docs/Практика 4. Москалёв А.Д.docx'


def set_page_margins(doc):
    section = doc.sections[0]
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    section.left_margin = Mm(30)
    section.right_margin = Mm(15)
    section.top_margin = Mm(20)
    section.bottom_margin = Mm(20)


def add_page_number(doc):
    """Номер страницы по центру нижнего колонтитула."""
    section = doc.sections[0]
    footer = section.footer
    footer_para = footer.paragraphs[0]
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_para.clear()
    run = footer_para.add_run()
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    instrText = OxmlElement('w:instrText')
    instrText.text = 'PAGE'
    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)
    # Apply font
    run.font.name = 'Times New Roman'
    run.font.size = Pt(14)


def set_para_format(para, first_line_indent=True, space_before=0, space_after=0, line_spacing=1.5):
    pf = para.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = line_spacing
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    if first_line_indent:
        pf.first_line_indent = Cm(1.25)
    else:
        pf.first_line_indent = Cm(0)


def set_run_font(run, bold=False, size=14, italic=False):
    run.font.name = 'Times New Roman'
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    # Force Cyrillic font
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn('w:cs'), 'Times New Roman')


def add_normal_para(doc, text, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_indent=True):
    para = doc.add_paragraph()
    para.alignment = align
    set_para_format(para, first_line_indent=first_indent)
    run = para.add_run(text)
    set_run_font(run, bold=bold, italic=italic)
    return para


def add_heading(doc, text, level=1):
    """Заголовок раздела: полужирный, по центру, без отступа, с новой страницы."""
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_para_format(para, first_line_indent=False, space_before=0, space_after=6)
    run = para.add_run(text)
    set_run_font(run, bold=True, size=14)
    return para


def add_subheading(doc, text):
    """Подраздел: полужирный, отступ абзаца, без переноса на новую страницу."""
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_para_format(para, first_line_indent=True, space_before=6, space_after=3)
    run = para.add_run(text)
    set_run_font(run, bold=True, size=14)
    return para


def add_bullet(doc, text, bold_part=None):
    """Элемент списка с тире."""
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf = para.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    pf.left_indent = Cm(1.25)
    pf.first_line_indent = Cm(-0.5)
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)

    if bold_part:
        run1 = para.add_run('\u2013 ' + bold_part)
        set_run_font(run1, bold=True)
        run2 = para.add_run(text)
        set_run_font(run2)
    else:
        run = para.add_run('\u2013 ' + text)
        set_run_font(run)
    return para


def add_code_block(doc, code_text):
    """Блок кода моноширинным шрифтом."""
    for line in code_text.strip().split('\n'):
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        pf = para.paragraph_format
        pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        pf.line_spacing = 1.0
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.left_indent = Cm(1.25)
        pf.first_line_indent = Cm(0)
        run = para.add_run(line if line else ' ')
        run.font.name = 'Courier New'
        run.font.size = Pt(10)
        rPr = run._r.get_or_add_rPr()
        rFonts = rPr.get_or_add_rFonts()
        rFonts.set(qn('w:cs'), 'Courier New')


def add_page_break(doc):
    para = doc.add_paragraph()
    run = para.add_run()
    run.add_break(docx.enum.text.WD_BREAK.PAGE)


# ===== Build document =====

import docx

doc = Document()

# Remove default empty paragraph
for p in doc.paragraphs:
    p._element.getparent().remove(p._element)

set_page_margins(doc)
add_page_number(doc)


# ─────────────────────────────────────────────
# ТИТУЛЬНЫЙ ЛИСТ
# ─────────────────────────────────────────────

def title_para(doc, text, bold=False, size=12, space_after=0):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pf = para.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(space_after)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    pf.first_line_indent = Cm(0)
    run = para.add_run(text)
    set_run_font(run, bold=bold, size=size)
    return para

title_para(doc, 'Министерство науки и высшего образования Российской Федерации', size=12)
title_para(doc, 'федеральное государственное автономное образовательное учреждение высшего образования', size=12)
title_para(doc, '«Национальный исследовательский университет ИТМО»', size=12)
title_para(doc, '(Университет ИТМО)', size=12)
title_para(doc, '', size=12)
title_para(doc, 'Факультет программной инженерии и компьютерной техники', size=12)
title_para(doc, 'Образовательная программа «Разработка программного обеспечения»', size=12)
title_para(doc, 'Направление подготовки 09.04.04 Программная инженерия', size=12)

# Большой отступ перед заголовком
for _ in range(3):
    title_para(doc, '')

title_para(doc, 'ОТЧЁТ', bold=True, size=16, space_after=6)
title_para(doc, 'по производственной, технологической (проектно-технологической) практике', size=14)
title_para(doc, '', size=14)
title_para(doc, 'Тема задания: Развёртывание практического решения на основе CI/CD', bold=True, size=14)
title_para(doc, 'по теме исследования', bold=True, size=14)
title_para(doc, '', size=14)
title_para(doc, 'Тема исследования: Сравнительный анализ производительности', size=14)
title_para(doc, 'микрофронтенд-архитектуры и монолитного фронтенда', size=14)

for _ in range(3):
    title_para(doc, '')

# Подпись — по правому краю
def right_para(doc, text, size=14, bold=False):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pf = para.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(4)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    pf.first_line_indent = Cm(0)
    pf.left_indent = Cm(8)
    run = para.add_run(text)
    set_run_font(run, bold=bold, size=size)
    return para

right_para(doc, 'Обучающийся: Москалёв Алексей Дмитриевич')
right_para(doc, 'Группа: М4239')
right_para(doc, '')
right_para(doc, 'Руководитель практики от университета:')
right_para(doc, '')
right_para(doc, '')

for _ in range(2):
    title_para(doc, '')

title_para(doc, 'Практика пройдена с оценкой _____________', size=14)
title_para(doc, 'Дата: _____________', size=14)

for _ in range(2):
    title_para(doc, '')

title_para(doc, 'Санкт-Петербург', size=14)
title_para(doc, '2025', size=14)


# ─────────────────────────────────────────────
# СОДЕРЖАНИЕ
# ─────────────────────────────────────────────

doc.add_page_break()

toc_title = doc.add_paragraph()
toc_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
pf = toc_title.paragraph_format
pf.first_line_indent = Cm(0)
pf.space_after = Pt(12)
run = toc_title.add_run('СОДЕРЖАНИЕ')
set_run_font(run, bold=True, size=14)

def toc_entry(doc, text, page, indent=False):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pf = para.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    pf.first_line_indent = Cm(0)
    pf.space_before = Pt(2)
    pf.space_after = Pt(2)
    if indent:
        pf.left_indent = Cm(1.0)
    # Add tab stop at right margin
    tab = OxmlElement('w:tabs')
    tabStop = OxmlElement('w:tab')
    tabStop.set(qn('w:val'), 'right')
    tabStop.set(qn('w:leader'), 'dot')
    tabStop.set(qn('w:pos'), '9360')  # ~16.5 cm from left for right tab
    tab.append(tabStop)
    para._p.get_or_add_pPr().append(tab)
    run = para.add_run(text + '\t' + str(page))
    set_run_font(run, bold=not indent, size=14)
    return para

toc_entry(doc, 'ВВЕДЕНИЕ', 3)
toc_entry(doc, '1 Этап 1. Инструктаж обучающегося', 4)
toc_entry(doc, '2 Этап 2. Проектирование развёртывания практического решения', 4)
toc_entry(doc, '2.1 Практическое решение', 4, indent=True)
toc_entry(doc, '2.2 Анализ вариантов размещения', 5, indent=True)
toc_entry(doc, '2.3 Выбранная схема развёртывания', 5, indent=True)
toc_entry(doc, '3 Этап 3. Процесс тестирования', 6)
toc_entry(doc, '3.1 Подход к тестированию', 6, indent=True)
toc_entry(doc, '3.2 Методология бенчмаркинга', 6, indent=True)
toc_entry(doc, '3.3 Собираемые метрики', 7, indent=True)
toc_entry(doc, '3.4 Сравниваемые конфигурации', 7, indent=True)
toc_entry(doc, '3.5 Воспроизводимость', 7, indent=True)
toc_entry(doc, '4 Этап 4. Оформление результата в виде Docker-образов', 8)
toc_entry(doc, '4.1 Docker-образы', 8, indent=True)
toc_entry(doc, '4.2 Оркестрация', 9, indent=True)
toc_entry(doc, '4.3 Требования к среде', 9, indent=True)
toc_entry(doc, '4.4 Пошаговая инструкция по развёртыванию', 9, indent=True)
toc_entry(doc, '5 Этап 5. Поставка на конвейер CI/CD', 11)
toc_entry(doc, '5.1 Платформа', 11, indent=True)
toc_entry(doc, '5.2 Self-hosted runner', 11, indent=True)
toc_entry(doc, '5.3 CI/CD-пайплайн', 12, indent=True)
toc_entry(doc, '5.4 Секреты', 14, indent=True)
toc_entry(doc, '5.5 Проверка', 14, indent=True)
toc_entry(doc, '6 Этап 6. Итоговый отчёт', 14)
toc_entry(doc, '6.1 Результат', 14, indent=True)
toc_entry(doc, '6.2 Архитектура развёрнутого решения', 15, indent=True)
toc_entry(doc, '6.3 Связь с темой исследования', 15, indent=True)
toc_entry(doc, 'ЗАКЛЮЧЕНИЕ', 16)
toc_entry(doc, 'СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ', 17)


# ─────────────────────────────────────────────
# ВВЕДЕНИЕ
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, 'ВВЕДЕНИЕ')

add_normal_para(doc,
    'Настоящий отчёт составлен по результатам прохождения производственной, технологической '
    '(проектно-технологической) практики в 4 семестре магистратуры.')

add_normal_para(doc,
    'Тема задания: Развёртывание практического решения на основе CI/CD по теме исследования.')

add_normal_para(doc,
    'Тема исследования: Сравнительный анализ производительности микрофронтенд-архитектуры '
    'и монолитного фронтенда.')

add_normal_para(doc,
    'Репозиторий проекта: https://gitverse.ru/EnderWar/itmo_master_metric_pizza_collector')

add_normal_para(doc,
    'Задеплоенное приложение: https://metric.pizza.ew-production.ru')

add_normal_para(doc,
    'Практика направлена на создание и ввод в эксплуатацию инструментального стенда для '
    'автоматизированного сбора и сравнения метрик производительности веб-приложений. '
    'Стенд является основным инструментом сбора экспериментальных данных для выпускной '
    'квалификационной работы. В ходе практики были спроектированы, разработаны и развёрнуты '
    'сервисы на отечественной платформе GitVerse с использованием CI/CD-пайплайна.')


# ─────────────────────────────────────────────
# ЭТАП 1
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, '1 ЭТАП 1. ИНСТРУКТАЖ ОБУЧАЮЩЕГОСЯ')

add_normal_para(doc, 'Период: 05.02.2025.')

add_normal_para(doc,
    'Пройден инструктаж по требованиям охраны труда, техники безопасности, пожарной '
    'безопасности и правилам внутреннего трудового распорядка.')

add_normal_para(doc,
    'В ходе инструктажа были изучены основные нормативные акты, регламентирующие '
    'безопасную работу сотрудников организации, а также правила поведения на рабочем '
    'месте в рамках прохождения производственной практики.')


# ─────────────────────────────────────────────
# ЭТАП 2
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, '2 ЭТАП 2. ПРОЕКТИРОВАНИЕ РАЗВЁРТЫВАНИЯ ПРАКТИЧЕСКОГО РЕШЕНИЯ')

add_normal_para(doc, 'Период: 06.02.2025 — 20.02.2025.')

add_subheading(doc, '2.1 Практическое решение')

add_normal_para(doc,
    'В роли практического решения выступает инструментальный стенд для автоматизированного '
    'сбора и сравнения метрик производительности веб-приложений. Система позволяет '
    'воспроизводимо измерять Navigation Timing, Lighthouse, Web Vitals и V8-метрики для '
    'любого URL — что напрямую обеспечивает экспериментальную базу исследования.')

add_normal_para(doc, 'Стенд состоит из двух сервисов:')

add_bullet(doc,
    ' — запускает headless Chromium через Puppeteer, собирает CDP-метрики и Lighthouse-аудиты, '
    'возвращает результаты по HTTP API.',
    bold_part='Backend (NestJS)')

add_bullet(doc,
    ' — интерфейс для запуска замеров, просмотра результатов, сравнения двух URL '
    'и экспорта в CSV.',
    bold_part='Frontend (Vue 3 + Vite)')

add_subheading(doc, '2.2 Анализ вариантов размещения')

add_normal_para(doc, 'Были рассмотрены следующие варианты платформ для развёртывания и CI/CD.')

add_normal_para(doc,
    'Git-хостинг и CI/CD. GitHub Actions — наиболее распространённый инструмент, однако '
    'является иностранной разработкой. В рамках требования об использовании отечественных '
    'решений был выбран GitVerse (gitverse.ru) — российская платформа на базе Gitea, '
    'разработанная при поддержке Сбера. GitVerse предоставляет совместимый с GitHub Actions '
    'синтаксис CI/CD-пайплайнов.')

add_normal_para(doc,
    'Облачные платформы. Рассматривались Яндекс Cloud, VK Cloud и Selectel как российские '
    'провайдеры. В связи с тем, что production-сервер уже развёрнут на VPS '
    '(aeza.net, IP: 91.186.212.172), перенос на облачную платформу нецелесообразен. '
    'Деплой осуществляется на существующий VPS.')

add_normal_para(doc,
    'Container Registry. Так как образы собираются и запускаются на одном сервере, '
    'внешний registry не требуется. Это упрощает архитектуру и исключает зависимость '
    'от внешних сервисов.')

add_subheading(doc, '2.3 Выбранная схема развёртывания')

add_normal_para(doc, 'Выбранная схема развёртывания:')

add_code_block(doc, 'push в main → GitVerse CI → self-hosted runner на VPS → git pull → docker compose build → up -d')

add_normal_para(doc, 'Схема обеспечивает:')

add_bullet(doc, 'полностью автоматический деплой при каждом коммите в main;')
add_bullet(doc, 'воспроизводимость среды через Docker;')
add_bullet(doc, 'использование отечественной CI/CD-платформы (GitVerse);')
add_bullet(doc, 'минимальную зависимость от внешних сервисов.')


# ─────────────────────────────────────────────
# ЭТАП 3
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, '3 ЭТАП 3. ПРОЦЕСС ТЕСТИРОВАНИЯ')

add_normal_para(doc, 'Период: 21.02.2025 — 14.03.2025.')

add_subheading(doc, '3.1 Подход к тестированию')

add_normal_para(doc,
    'Тестирование практического решения представляет собой одновременно верификацию '
    'работоспособности стенда и основной инструмент сбора экспериментальных данных '
    'исследования.')

add_subheading(doc, '3.2 Методология бенчмаркинга')

add_normal_para(doc, 'Каждый замер выполняется в следующих условиях:')

add_bullet(doc, 'Viewport: 1920×1080;')
add_bullet(doc, 'Cache: отключён (режим инкогнито);')
add_bullet(doc, 'Network throttling: отключён;')
add_bullet(doc, 'Количество повторов: 10 (берётся медиана и среднее).')

add_normal_para(doc,
    'Для устранения эффекта прогрева DNS при первом обращении к новому домену замеры '
    'разделены на холодные (первый запуск, DNS не закеширован) и тёплые '
    '(повторные запуски).')

add_subheading(doc, '3.3 Собираемые метрики')

add_normal_para(doc,
    'Navigation Timing API — время DOM-парсинга, выполнения скриптов, '
    'DOMContentLoaded, Load Event.')

add_normal_para(doc,
    'Lighthouse — Speed Index, FCP, LCP, TTI, TBT, CLS, Performance Score.')

add_normal_para(doc,
    'Ресурсы и сеть — количество запросов, Transfer Size, количество скриптов, '
    'уникальные домены.')

add_normal_para(doc,
    'V8 / Rendering — время JS-парсинга и компиляции, Task Duration, Layout Count, '
    'JS Heap.')

add_normal_para(doc,
    'E2E-сценарий — полное время пользовательского сценария (выбор пиццы → корзина → '
    'оформление заказа), средняя и максимальная задержка ввода.')

add_subheading(doc, '3.4 Сравниваемые конфигурации')

add_bullet(doc, 'монолитное приложение (все страницы в одной сборке);')
add_bullet(doc, 'микрофронтенд-архитектура с 3 одновременно загружаемыми MFE (shell + 3 модуля);')
add_bullet(doc, 'микрофронтенд-архитектура с 1 загружаемым MFE (только pizza-builder).')

add_subheading(doc, '3.5 Воспроизводимость')

add_normal_para(doc,
    'Все замеры выполняются через единый API-эндпоинт стенда. Параметры (URL, '
    'количество повторов, включение E2E) задаются через интерфейс. Результаты '
    'экспортируются в CSV для архивирования.')


# ─────────────────────────────────────────────
# ЭТАП 4
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, '4 ЭТАП 4. ОФОРМЛЕНИЕ РЕЗУЛЬТАТА В ВИДЕ DOCKER-ОБРАЗОВ')

add_normal_para(doc, 'Период: 15.03.2025 — 22.03.2025.')

add_subheading(doc, '4.1 Docker-образы')

add_normal_para(doc,
    'Проект содержит два образа, описанных в Dockerfile для каждого сервиса.')

add_normal_para(doc,
    'Backend-образ (backend/Dockerfile) — многоступенчатая сборка.')

add_bullet(doc,
    'Стейдж base — базовый образ node:20-slim, установка зависимостей. Переменная '
    'PUPPETEER_SKIP_DOWNLOAD=true выставлена на уровне base, чтобы Puppeteer не '
    'скачивал собственный Chrome ни на одном из стейджей сборки.')
add_bullet(doc, 'Стейдж deps — выполняется npm ci.')
add_bullet(doc, 'Стейдж builder — компиляция TypeScript (npm run build).')
add_bullet(doc,
    'Стейдж runner — финальный образ на node:20-slim. Устанавливается системный '
    'Chromium (apt-get install -y chromium). Переменная '
    'PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium указывает Puppeteer использовать '
    'системный браузер вместо встроенного. Копируются только prod-зависимости '
    'и скомпилированный dist/.')

add_normal_para(doc,
    'Frontend-образ (frontend/Dockerfile) — многоступенчатая сборка.')

add_bullet(doc, 'Стейдж base — установка зависимостей.')
add_bullet(doc,
    'Стейдж builder — npm run build, принимает ARG VITE_API_URL для конфигурации '
    'URL backend при сборке.')
add_bullet(doc, 'Стейдж runner — образ nginx:1.27-alpine, только статика из dist/.')

add_subheading(doc, '4.2 Оркестрация')

add_normal_para(doc, 'Файл docker-compose.prod.yml описывает три сервиса:')

add_bullet(doc,
    'traefik — reverse proxy с автоматическим получением TLS-сертификатов Let\'s Encrypt;')
add_bullet(doc,
    'metrics-backend — backend-сервис с привилегиями SYS_ADMIN и seccomp:unconfined '
    '(необходимо для запуска headless Chromium в контейнере);')
add_bullet(doc, 'metrics-frontend — frontend-сервис, nginx со статикой.')

add_subheading(doc, '4.3 Требования к среде')

add_normal_para(doc,
    'Аппаратные: VPS с минимум 2 CPU, 2 GB RAM, 10 GB диска. Headless Chromium '
    'требует shm_size: 2gb для стабильной работы.')

add_normal_para(doc,
    'Программные: Docker Engine 24+, Docker Compose v2, открытые порты 80 и 443.')

add_subheading(doc, '4.4 Пошаговая инструкция по развёртыванию')

add_normal_para(doc, 'Последовательность команд для развёртывания на production-сервере:')

add_code_block(doc, '''# 1. Клонировать репозиторий
git clone https://gitverse.ru/EnderWar/itmo_master_metric_pizza_collector.git
cd itmo_master_metric_pizza_collector

# 2. Собрать и запустить
docker compose -f docker-compose.prod.yml build metrics-backend
docker compose -f docker-compose.prod.yml build metrics-frontend
docker compose -f docker-compose.prod.yml up -d

# 3. Проверить статус
docker compose -f docker-compose.prod.yml ps''')

add_normal_para(doc, 'Для локального запуска (без TLS):')

add_code_block(doc, '''docker compose up -d
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000/api''')


# ─────────────────────────────────────────────
# ЭТАП 5
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, '5 ЭТАП 5. ПОСТАВКА НА КОНВЕЙЕР CI/CD')

add_normal_para(doc, 'Период: 23.03.2025 — 22.04.2025.')

add_subheading(doc, '5.1 Платформа')

add_normal_para(doc,
    'Используется GitVerse CI — российская CI/CD-платформа (gitverse.ru). Синтаксис '
    'пайплайна совместим с GitHub Actions / Gitea Actions.')

add_subheading(doc, '5.2 Self-hosted runner')

add_normal_para(doc,
    'GitVerse не предоставляет облачные runners, поэтому runner развёрнут '
    'непосредственно на production-сервере. Это архитектурно оправдано: runner '
    'выполняет команды локально без SSH-прыжка, что упрощает пайплайн и повышает '
    'надёжность.')

add_normal_para(doc, 'Установка runner:')

add_code_block(doc, '''mkdir gitverse-runner && cd gitverse-runner
curl -o act_runner_linux_amd64 -L \\
  https://gitverse.ru/api/packages/gitverse/generic/act_runner_linux_amd64/5.2.0/act_runner_linux_amd64
chmod +x act_runner_linux_amd64

# Регистрация
./act_runner_linux_amd64 register --no-interactive \\
  --instance https://gitverse.ru/sc \\
  --token <REGISTRATION_TOKEN> \\
  --name my_runner''')

add_normal_para(doc, 'Runner запущен как systemd-сервис для обеспечения автозапуска:')

add_code_block(doc, '''# /etc/systemd/system/gitverse-runner.service
[Unit]
Description=GitVerse Act Runner
After=network.target

[Service]
WorkingDirectory=/root/gitverse-runner
ExecStart=/root/gitverse-runner/act_runner_linux_amd64 daemon
Restart=always
RestartSec=5
Environment=HOME=/root

[Install]
WantedBy=multi-user.target''')

add_code_block(doc, '''systemctl daemon-reload
systemctl enable gitverse-runner
systemctl start gitverse-runner''')

add_subheading(doc, '5.3 CI/CD-пайплайн')

add_normal_para(doc, 'Файл .gitverse/workflows/deploy.yml:')

add_code_block(doc, '''name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: self-hosted

    steps:
      - name: Pull latest code
        run: |
          REPO_URL="https://${{ secrets.VCS_TOKEN }}@gitverse.ru/EnderWar/itmo_master_metric_pizza_collector.git"
          DEPLOY_DIR="/root/metrics"

          if [ -d "$DEPLOY_DIR/.git" ]; then
            cd "$DEPLOY_DIR"
            git remote set-url origin "$REPO_URL"
            git pull origin main
          else
            rm -rf "$DEPLOY_DIR"
            git clone "$REPO_URL" "$DEPLOY_DIR"
          fi

      - name: Build backend
        run: |
          cd /root/metrics
          docker compose -f docker-compose.prod.yml build metrics-backend

      - name: Build frontend
        run: |
          cd /root/metrics
          docker compose -f docker-compose.prod.yml build metrics-frontend

      - name: Start containers
        run: |
          cd /root/metrics
          docker compose -f docker-compose.prod.yml up -d''')

add_subheading(doc, '5.4 Секреты')

add_normal_para(doc,
    'В настройках репозитория GitVerse (Settings → Secrets) хранятся:')

add_bullet(doc,
    'VCS_TOKEN — токен GitVerse для аутентификации при git pull на сервере.')

add_subheading(doc, '5.5 Проверка')

add_normal_para(doc,
    'Пайплайн запускается автоматически при каждом push в ветку main. '
    'Статус выполнения доступен в разделе CI/CD репозитория на GitVerse.')


# ─────────────────────────────────────────────
# ЭТАП 6
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, '6 ЭТАП 6. ИТОГОВЫЙ ОТЧЁТ')

add_normal_para(doc, 'Период: 23.04.2025 — 30.04.2025.')

add_subheading(doc, '6.1 Результат')

add_normal_para(doc,
    'Практическое решение успешно развёрнуто и доступно по адресу: '
    'https://metric.pizza.ew-production.ru')

add_normal_para(doc,
    'Настроен автоматический CI/CD-пайплайн: любой коммит в ветку main репозитория '
    'на GitVerse автоматически запускает сборку Docker-образов и обновление '
    'production-окружения без ручного вмешательства.')

add_subheading(doc, '6.2 Архитектура развёрнутого решения')

add_code_block(doc, '''GitVerse (gitverse.ru)
    └── push в main
        └── GitVerse CI (act runner, self-hosted)
            └── git pull → docker compose build → up -d
                └── VPS 91.186.212.172
                    ├── Traefik (TLS, Let's Encrypt)
                    ├── metrics-backend (NestJS + Chromium)
                    └── metrics-frontend (Vue 3, nginx)''')

add_subheading(doc, '6.3 Связь с темой исследования')

add_normal_para(doc,
    'Развёрнутый стенд является основным инструментом сбора экспериментальных данных '
    'для выпускной квалификационной работы. С его помощью были проведены сравнительные '
    'замеры производительности монолитного и микрофронтенд-приложений, результаты '
    'которых составили эмпирическую базу исследования.')


# ─────────────────────────────────────────────
# ЗАКЛЮЧЕНИЕ
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, 'ЗАКЛЮЧЕНИЕ')

add_normal_para(doc,
    'В ходе производственной практики выполнено развёртывание инструментального стенда '
    'для автоматизированного сбора и сравнения метрик производительности веб-приложений.')

add_normal_para(doc,
    'Спроектирована и реализована схема CI/CD на основе отечественной платформы GitVerse. '
    'Self-hosted runner развёрнут непосредственно на production-сервере, что обеспечивает '
    'автоматическую сборку и деплой при каждом коммите в ветку main.')

add_normal_para(doc,
    'Оба сервиса — backend (NestJS + headless Chromium) и frontend (Vue 3, nginx) — '
    'упакованы в многоступенчатые Docker-образы и оркестрируются посредством '
    'docker-compose.prod.yml с Traefik в роли reverse proxy и автоматическим '
    'получением TLS-сертификатов.')

add_normal_para(doc,
    'Проведено тестирование стенда: выполнены замеры Navigation Timing, Lighthouse, '
    'Web Vitals и V8-метрик для трёх сравниваемых конфигураций — монолит, '
    'микрофронтенд с тремя модулями и микрофронтенд с одним модулем. '
    'Результаты экспортированы в CSV и сформировали эмпирическую базу исследования.')

add_normal_para(doc,
    'Задеплоенное приложение доступно по адресу https://metric.pizza.ew-production.ru. '
    'Репозиторий размещён на GitVerse: '
    'https://gitverse.ru/EnderWar/itmo_master_metric_pizza_collector.')


# ─────────────────────────────────────────────
# СПИСОК ИСТОЧНИКОВ
# ─────────────────────────────────────────────

doc.add_page_break()
add_heading(doc, 'СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ')

sources = [
    'GitVerse — российская платформа для разработки программного обеспечения. — URL: https://gitverse.ru (дата обращения: 30.04.2025).',
    'Docker Documentation. Docker Compose overview. — URL: https://docs.docker.com/compose/ (дата обращения: 30.04.2025).',
    'Google Developers. Lighthouse. — URL: https://developer.chrome.com/docs/lighthouse/ (дата обращения: 30.04.2025).',
    'MDN Web Docs. Navigation Timing API. — URL: https://developer.mozilla.org/en-US/docs/Web/API/Navigation_timing_API (дата обращения: 30.04.2025).',
    'Traefik Labs. Traefik Documentation. — URL: https://doc.traefik.io/traefik/ (дата обращения: 30.04.2025).',
    'NestJS Documentation. — URL: https://docs.nestjs.com/ (дата обращения: 30.04.2025).',
    'Vue.js Documentation. — URL: https://vuejs.org/guide/introduction (дата обращения: 30.04.2025).',
    'Puppeteer Documentation. — URL: https://pptr.dev/ (дата обращения: 30.04.2025).',
    'Web Vitals. — URL: https://web.dev/vitals/ (дата обращения: 30.04.2025).',
    'Gitea Actions. — URL: https://docs.gitea.com/usage/actions/overview (дата обращения: 30.04.2025).',
]

for i, src in enumerate(sources, 1):
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf = para.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    pf.first_line_indent = Cm(0)
    pf.left_indent = Cm(1.25)
    pf.space_before = Pt(0)
    pf.space_after = Pt(4)
    run = para.add_run(f'{i}. {src}')
    set_run_font(run, size=14)


# ─────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────

doc.save(OUTPUT_PATH)
print(f'Document saved: {OUTPUT_PATH}')
