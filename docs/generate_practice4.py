#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор отчёта "Практика 4. Москалёв А.Д.docx"
Стили копируются из Практики 3; контент берётся из practice-report.md
"""

import copy
import re
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Mm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from lxml import etree

SOURCE_DOCX = "/Users/enderwar/Documents/Programming/itmo/nir3/docs/practice3_source.docx"
MD_FILE     = "/Users/enderwar/Documents/Programming/itmo/nir3/docs/practice-report.md"
OUTPUT_DOCX = "/Users/enderwar/Documents/Programming/itmo/nir3/docs/Практика 4. Москалёв А.Д.docx"

# ── 1. Загрузка источника стилей ────────────────────────────────────────────
src = Document(SOURCE_DOCX)

# ── 2. Создание нового документа ────────────────────────────────────────────
doc = Document()

# Копируем стили из источника одним блоком через XML
STYLES_TO_COPY = ["ITMO", "IMTO_H1", "ITMO_H2", "HTML Preformatted", "HTML Code", "breadcrumb-item"]

def copy_style(src_doc, dst_doc, style_name):
    """Копирует стиль из src_doc в dst_doc, если его там нет."""
    # Проверяем, есть ли уже такой стиль
    existing_ids = {s.style_id for s in dst_doc.styles}
    existing_names = {s.name for s in dst_doc.styles}

    src_style = None
    for s in src_doc.styles:
        if s.name == style_name:
            src_style = s
            break
    if src_style is None:
        print(f"  WARN: стиль {style_name!r} не найден в источнике")
        return

    if src_style.name in existing_names:
        return  # уже есть

    new_elem = copy.deepcopy(src_style.element)
    dst_doc.styles.element.append(new_elem)

# Сначала копируем ITMO (базовый), потом остальные
for sname in STYLES_TO_COPY:
    copy_style(src, doc, sname)
    print(f"  Скопирован стиль: {sname}")

# ── 3. Настройка полей и колонтитулов ───────────────────────────────────────
section = doc.sections[0]
section.page_width  = Mm(210)
section.page_height = Mm(297)
section.left_margin   = Mm(30)
section.right_margin  = Mm(15)
section.top_margin    = Mm(20)
section.bottom_margin = Mm(20)

# Нумерация страниц по центру снизу
def add_page_number_footer(section):
    footer = section.footer
    # Удаляем существующие параграфы
    for p in footer.paragraphs:
        p._element.getparent().remove(p._element)

    fp = OxmlElement("w:p")
    fpr = OxmlElement("w:pPr")
    jc = OxmlElement("w:jc")
    jc.set(qn("w:val"), "center")
    fpr.append(jc)
    fp.append(fpr)

    run = OxmlElement("w:r")
    fld = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "begin")
    run.append(fld)
    fp.append(run)

    run2 = OxmlElement("w:r")
    instrText = OxmlElement("w:instrText")
    instrText.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    instrText.text = " PAGE "
    run2.append(instrText)
    fp.append(run2)

    run3 = OxmlElement("w:r")
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run3.append(fld2)
    fp.append(run3)

    footer._element.append(fp)

add_page_number_footer(section)

# ── 4. Вспомогательные функции ──────────────────────────────────────────────

def add_paragraph(text, style_name, alignment=None, bold=False, italic=False):
    p = doc.add_paragraph(style=style_name)
    if alignment is not None:
        p.alignment = alignment
    if text:
        run = p.add_run(text)
        if bold:
            run.bold = True
        if italic:
            run.italic = True
    return p

def add_page_break_before(paragraph):
    """Добавляет разрыв страницы перед параграфом через pPr/pageBreakBefore."""
    pPr = paragraph._element.get_or_add_pPr()
    pb = OxmlElement("w:pageBreakBefore")
    pb.set(qn("w:val"), "true")
    pPr.append(pb)

def add_toc(doc):
    """Вставляет поле оглавления Word (обновляется при открытии)."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("СОДЕРЖАНИЕ")
    run.bold = True

    # Пустая строка
    doc.add_paragraph()

    # Поле TOC
    para = doc.add_paragraph()
    fldBegin = OxmlElement("w:fldChar")
    fldBegin.set(qn("w:fldCharType"), "begin")
    fldBegin.set(qn("w:dirty"), "true")

    instrText = OxmlElement("w:instrText")
    instrText.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    instrText.text = ' TOC \\o "1-2" \\h \\z \\u '

    fldEnd = OxmlElement("w:fldChar")
    fldEnd.set(qn("w:fldCharType"), "end")

    r1 = OxmlElement("w:r")
    r1.append(fldBegin)
    r2 = OxmlElement("w:r")
    r2.append(instrText)
    r3 = OxmlElement("w:r")
    r3.append(fldEnd)

    para._element.append(r1)
    para._element.append(r2)
    para._element.append(r3)

def add_inline_formatted(paragraph, text):
    """
    Разбирает текст с **bold** и `code` и добавляет runs в параграф.
    Также обрабатывает [текст](url).
    """
    # Паттерн для bold, code, link
    pattern = re.compile(r'\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]+\)')
    pos = 0
    for m in pattern.finditer(text):
        # Обычный текст до совпадения
        if m.start() > pos:
            paragraph.add_run(text[pos:m.start()])
        if m.group(1) is not None:  # **bold**
            r = paragraph.add_run(m.group(1))
            r.bold = True
        elif m.group(2) is not None:  # `code`
            r = paragraph.add_run(m.group(2))
            r.font.name = "Courier New"
            r.font.size = Pt(10)
        elif m.group(3) is not None:  # [text](url)
            paragraph.add_run(m.group(3))
        pos = m.end()
    if pos < len(text):
        paragraph.add_run(text[pos:])

# ── 5. Титульный лист ───────────────────────────────────────────────────────

def add_title_page(doc):
    # Шапка
    lines_top = [
        "Министерство науки и высшего образования Российской Федерации",
        "федеральное государственное автономное образовательное учреждение высшего образования",
        "«Национальный исследовательский университет ИТМО»",
        "(Университет ИТМО)",
    ]
    for line in lines_top:
        p = doc.add_paragraph(style="ITMO")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(line)

    doc.add_paragraph(style="ITMO")

    for line in [
        "Факультет систем управления и робототехники (СУиР)",
        "Направление 09.04.04 Программная инженерия",
    ]:
        p = doc.add_paragraph(style="ITMO")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run(line)

    # Несколько пустых строк для отступа
    for _ in range(3):
        doc.add_paragraph(style="ITMO")

    # Заголовок отчёта
    p = doc.add_paragraph(style="ITMO")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("ОТЧЁТ")
    r.bold = True

    p = doc.add_paragraph(style="breadcrumb-item")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run("по производственной, технологической практике (4 семестр)")

    doc.add_paragraph(style="ITMO")

    p = doc.add_paragraph(style="ITMO")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Тема: Развёртывание стенда сбора метрик с настройкой CI/CD на отечественной платформе")
    r.bold = True

    for _ in range(4):
        doc.add_paragraph(style="ITMO")

    # Автор и руководитель — выравнивание по правому краю
    p = doc.add_paragraph(style="ITMO")
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run("Обучающийся: Москалёв Алексей Дмитриевич")

    p = doc.add_paragraph(style="ITMO")
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run("Научный руководитель: ____________________")

    for _ in range(5):
        doc.add_paragraph(style="ITMO")

    # Город и год
    p = doc.add_paragraph(style="ITMO")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run("Санкт-Петербург, 2025")

    # Разрыв страницы после титульника
    doc.add_page_break()

# ── 6. Парсинг и рендеринг MD ───────────────────────────────────────────────

def parse_and_render_md(doc, md_text):
    lines = md_text.splitlines()
    i = 0
    first_h2 = True  # первый ## не требует разрыва (после TOC уже новая страница)

    while i < len(lines):
        line = lines[i]

        # Пропускаем горизонтальные разделители
        if re.match(r'^---+\s*$', line):
            i += 1
            continue

        # Заголовок H1 (# ...) — пропускаем, он уже на титуле
        if re.match(r'^# ', line):
            i += 1
            continue

        # Блок кода ```
        if line.startswith('```'):
            lang = line[3:].strip()
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # пропускаем закрывающий ```
            for cl in code_lines:
                cp = doc.add_paragraph(style="HTML Preformatted")
                cp.add_run(cl if cl else " ")
            continue

        # Заголовок H2 (## ...) — новая страница
        m2 = re.match(r'^## (.+)', line)
        if m2:
            title = m2.group(1).strip()
            p = doc.add_paragraph(style="IMTO_H1")
            if not first_h2:
                add_page_break_before(p)
            first_h2 = False
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.add_run(title)
            i += 1
            continue

        # Заголовок H3 (### ...) — ITMO_H2
        m3 = re.match(r'^### (.+)', line)
        if m3:
            title = m3.group(1).strip()
            p = doc.add_paragraph(style="ITMO_H2")
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.add_run(title)
            i += 1
            continue

        # Скриншот-заглушка (может быть многострочным — до закрывающей ']')
        m_ss_start = re.match(r'^\[СКРИНШОТ (\d+): (.+)', line)
        if m_ss_start:
            n = m_ss_start.group(1)
            # Собираем все строки до закрывающей ']'
            block = line.rstrip('\n')
            while not block.rstrip().endswith(']') and i + 1 < len(lines):
                i += 1
                block += ' ' + lines[i].rstrip('\n').strip()
            # Убираем обрамляющие скобки
            block = block.strip()
            if block.startswith('['):
                block = block[1:]
            if block.endswith(']'):
                block = block[:-1]
            p = doc.add_paragraph(style="ITMO")
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(f"[место для скриншота {n}: {block[len('СКРИНШОТ ' + n + ': '):].strip()}]")
            r.italic = True
            i += 1
            continue

        # Пустая строка
        if line.strip() == '':
            i += 1
            continue

        # Список с дефисом/звёздочкой
        m_li = re.match(r'^[-*]\s+(.+)', line)
        if m_li:
            p = doc.add_paragraph(style="ITMO")
            p.style.name  # ensure style applied
            # Убираем первую строку отступа для списков
            pPr = p._element.get_or_add_pPr()
            ind = pPr.find(qn("w:ind"))
            if ind is None:
                ind = OxmlElement("w:ind")
                pPr.append(ind)
            ind.set(qn("w:firstLine"), "0")
            ind.set(qn("w:left"), "360")
            p.add_run("• ")
            add_inline_formatted(p, m_li.group(1).strip())
            i += 1
            continue

        # Нумерованный список
        m_num = re.match(r'^(\d+)\.\s+(.+)', line)
        if m_num:
            p = doc.add_paragraph(style="ITMO")
            pPr = p._element.get_or_add_pPr()
            ind = pPr.find(qn("w:ind"))
            if ind is None:
                ind = OxmlElement("w:ind")
                pPr.append(ind)
            ind.set(qn("w:firstLine"), "0")
            ind.set(qn("w:left"), "360")
            add_inline_formatted(p, f"{m_num.group(1)}. {m_num.group(2).strip()}")
            i += 1
            continue

        # Обычный текст
        p = doc.add_paragraph(style="ITMO")
        add_inline_formatted(p, line.strip())
        i += 1

# ── 7. Сборка документа ─────────────────────────────────────────────────────

# Читаем MD
with open(MD_FILE, "r", encoding="utf-8") as f:
    md_text = f.read()

# Титульный лист
add_title_page(doc)

# Содержание
add_toc(doc)
doc.add_page_break()

# Основной контент
parse_and_render_md(doc, md_text)

# ── 8. Сохранение ───────────────────────────────────────────────────────────
doc.save(OUTPUT_DOCX)
print(f"\nСохранено: {OUTPUT_DOCX}")
