# Bundle сравнение: Monolith vs MFE

## По проектам

| Project | Files | JS | CSS | Other | Total | JS gzip | Total gzip |
|---|---|---|---|---|---|---|---|
| frontend | 91 | 202 KB (13) | 51 KB (11) | 67 | 1208 KB | 79 KB | 629 KB |
| shell | 24 | 230 KB (14) | 9 KB (2) | 8 | 502 KB | 86 KB | 347 KB |
| auth | 26 | 220 KB (13) | 7 KB (1) | 12 | 251 KB | 85 KB | 98 KB |
| cart | 19 | 259 KB (12) | 14 KB (1) | 6 | 275 KB | 98 KB | 103 KB |
| profile | 19 | 252 KB (12) | 9 KB (1) | 6 | 263 KB | 96 KB | 100 KB |
| order | 18 | 223 KB (12) | 9 KB (1) | 5 | 234 KB | 86 KB | 89 KB |
| pizza-builder | 76 | 231 KB (13) | 30 KB (1) | 62 | 886 KB | 88 KB | 346 KB |

## Сводка

**Монолит (frontend):**
- Файлов: 91 (JS: 13, CSS: 1)
- Total dist: 1208 KB (gzip: 629 KB)
- JS only: 202 KB (gzip: 79 KB)

**MFE (сумма всех 6 remotes):**
- Файлов: 182 (JS: 76)
- Total dist: 2415 KB (gzip: 1086 KB)
- JS only: 1418 KB (gzip: 540 KB)

**Дельты:**
- Файлов: 91 → 182 (×2.0)
- JS-чанков: 13 → 76 (×5.8)
- Total dist: 1208 KB → 2415 KB (×2.00)
- JS bundle: 202 KB → 1418 KB (×7.02)
- JS gzip: 79 KB → 540 KB (×6.83)
