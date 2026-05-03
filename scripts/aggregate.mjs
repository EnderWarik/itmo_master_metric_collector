#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const OUT = '/Users/enderwar/Documents/Programming/itmo/nir3/scripts/out';

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m-1] + s[m]) / 2 : s[m];
}
function mean(arr) { return arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0; }
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s,n) => s + (n-m)**2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}
function cv(arr) { const m = mean(arr); return m === 0 ? 0 : (stdDev(arr) / m) * 100; }

function fmtNum(v, decimals = 1) {
  if (typeof v !== 'number' || isNaN(v)) return '-';
  if (Number.isInteger(v) && Math.abs(v) < 1000) return String(v);
  return v.toFixed(decimals);
}
function fmtBytes(v) {
  if (typeof v !== 'number') return '-';
  if (v > 1048576) return (v/1048576).toFixed(2) + ' MB';
  if (v > 1024) return (v/1024).toFixed(1) + ' KB';
  return v + ' B';
}
function calcDelta(a, b, higherBetter = false) {
  if (typeof a !== 'number' || typeof b !== 'number' || a === 0) return '-';
  const pct = ((b - a) / Math.abs(a)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function getPayload(metrics, key) {
  const r = metrics.find(m => m.key === key);
  return r ? r.payload : null;
}

// Extract value by metric path: "page.lighthouse.lcpMs" → from metrics array
function extractByPath(metricsArray, key, ...subkeys) {
  let v = getPayload(metricsArray, key);
  for (const k of subkeys) {
    if (v && typeof v === 'object') v = v[k];
    else return undefined;
  }
  return typeof v === 'number' ? v : undefined;
}

const runsA = readJsonl(path.join(OUT, 'runs_a.jsonl'));
const runsB = readJsonl(path.join(OUT, 'runs_b.jsonl'));
const e2eA = readJsonl(path.join(OUT, 'e2e_a.jsonl'));
const e2eB = readJsonl(path.join(OUT, 'e2e_b.jsonl'));

// Definition of all metrics to extract
// [group, label, extractor (returns number per run), format, higherBetter]
const METRICS = [
  ['Ping', 'Elapsed, ms', r => extractByPath(r, 'availability.ping', 'elapsedMs'), 'num', false],
  ['TTFB', 'TTFB, ms', r => extractByPath(r, 'page.ttfb', 'ttfbMs'), 'num', false],
  ['TTFB', 'DNS Lookup, ms', r => extractByPath(r, 'page.ttfb', 'timing', 'dnsLookupMs'), 'num', false],
  ['TTFB', 'TCP Connect, ms', r => extractByPath(r, 'page.ttfb', 'timing', 'tcpConnectMs'), 'num', false],
  ['TTFB', 'TLS Handshake, ms', r => extractByPath(r, 'page.ttfb', 'timing', 'tlsHandshakeMs'), 'num', false],
  ['TTFB', 'Server Processing, ms', r => extractByPath(r, 'page.ttfb', 'timing', 'serverProcessingMs'), 'num', false],
  ['Navigation Timing', 'Response, ms', r => extractByPath(r, 'page.dom', 'timing', 'responseMs'), 'num', false],
  ['Navigation Timing', 'DOM Parse, ms', r => extractByPath(r, 'page.dom', 'timing', 'domParseMs'), 'num', false],
  ['Navigation Timing', 'Execute Scripts, ms', r => extractByPath(r, 'page.dom', 'timing', 'executeScriptsMs'), 'num', false],
  ['Navigation Timing', 'Sub Resources, ms', r => extractByPath(r, 'page.dom', 'timing', 'subResourcesMs'), 'num', false],
  ['Navigation Timing', 'DOMContentLoaded, ms', r => extractByPath(r, 'page.dom', 'timing', 'domContentLoadedMs'), 'num', false],
  ['Navigation Timing', 'Load Event, ms', r => extractByPath(r, 'page.dom', 'timing', 'loadEventMs'), 'num', false],
  ['Navigation Timing', 'Total, ms', r => extractByPath(r, 'page.dom', 'totalMs'), 'num', false],
  ['Lighthouse', 'Speed Index, ms', r => extractByPath(r, 'page.lighthouse', 'speedIndexMs'), 'num', false],
  ['Lighthouse', 'FCP, ms', r => extractByPath(r, 'page.lighthouse', 'fcpMs'), 'num', false],
  ['Lighthouse', 'LCP, ms', r => extractByPath(r, 'page.lighthouse', 'lcpMs'), 'num', false],
  ['Lighthouse', 'TTI, ms', r => extractByPath(r, 'page.lighthouse', 'ttiMs'), 'num', false],
  ['Lighthouse', 'TBT, ms', r => extractByPath(r, 'page.lighthouse', 'tbtMs'), 'num', false],
  ['Lighthouse', 'CLS', r => extractByPath(r, 'page.lighthouse', 'cls'), 'num', false],
  ['Lighthouse', 'Performance Score', r => extractByPath(r, 'page.lighthouse', 'performanceScore'), 'num', true],
  ['Resources', 'Total Resources', r => extractByPath(r, 'page.resources', 'totalResources'), 'num', false],
  ['Resources', 'Transfer Size', r => extractByPath(r, 'page.resources', 'totalTransferSize'), 'bytes', false],
  ['Resources', 'Scripts Count', r => extractByPath(r, 'page.resources', 'scriptsCount'), 'num', false],
  ['Resources', 'Scripts Size', r => extractByPath(r, 'page.resources', 'scriptsTotalSize'), 'bytes', false],
  ['Resources', 'Unique Domains', r => extractByPath(r, 'page.resources', 'uniqueDomains'), 'num', false],
  ['V8 / Rendering', 'JS Parse, ms', r => extractByPath(r, 'page.resources', 'jsParseMs'), 'num', false],
  ['V8 / Rendering', 'JS Compile, ms', r => extractByPath(r, 'page.resources', 'jsCompileMs'), 'num', false],
  ['V8 / Rendering', 'Task Duration, ms', r => extractByPath(r, 'page.resources', 'taskDurationMs'), 'num', false],
  ['V8 / Rendering', 'Layout Count', r => extractByPath(r, 'page.resources', 'layoutCount'), 'num', false],
  ['V8 / Rendering', 'Recalc Style Count', r => extractByPath(r, 'page.resources', 'recalcStyleCount'), 'num', false],
  ['V8 / Rendering', 'JS Heap Used', r => extractByPath(r, 'page.resources', 'jsHeapUsedSize'), 'bytes', false],
  ['V8 / Rendering', 'DOM Nodes', r => extractByPath(r, 'page.resources', 'domNodes'), 'num', false],
];

const E2E_METRICS = [
  ['E2E Scenario', 'Scenario Duration, ms', r => r?.scenarioDurationMs, 'num', false],
  ['E2E Scenario', 'Avg Input Delay, ms', r => r?.avgInputDelayMs, 'num', false],
  ['E2E Scenario', 'Max Input Delay, ms', r => r?.maxInputDelayMs, 'num', false],
  ['E2E Scenario', 'Total Long Tasks', r => r?.totalLongTasks, 'num', false],
  ['E2E Scenario', 'Avg Heap Usage, %', r => r?.avgHeapUsagePercent, 'num', false],
  ['E2E Scenario', 'Max Heap Usage, %', r => r?.maxHeapUsagePercent, 'num', false],
];

console.log('# Сравнение: Monolith vs Shell-MFE\n');
console.log(`Всего повторов: ${runsA.length} A / ${runsB.length} B (interleaved, без холодного замера)\n`);

// === STABILITY ===
const pingsA = runsA.map(r => extractByPath(r, 'availability.ping', 'elapsedMs')).filter(v => typeof v === 'number');
const pingsB = runsB.map(r => extractByPath(r, 'availability.ping', 'elapsedMs')).filter(v => typeof v === 'number');
const ttfbsA = runsA.map(r => extractByPath(r, 'page.ttfb', 'ttfbMs')).filter(v => typeof v === 'number');
const ttfbsB = runsB.map(r => extractByPath(r, 'page.ttfb', 'ttfbMs')).filter(v => typeof v === 'number');

console.log('## Стабильность сети (mean ± σ, CV)\n');
console.log(`| Metric | Monolith | Shell-MFE |`);
console.log(`|--------|----------|-----------|`);
console.log(`| Ping, ms | ${mean(pingsA).toFixed(1)} ± ${stdDev(pingsA).toFixed(1)} (${cv(pingsA).toFixed(1)}%) | ${mean(pingsB).toFixed(1)} ± ${stdDev(pingsB).toFixed(1)} (${cv(pingsB).toFixed(1)}%) |`);
console.log(`| TTFB, ms | ${mean(ttfbsA).toFixed(1)} ± ${stdDev(ttfbsA).toFixed(1)} (${cv(ttfbsA).toFixed(1)}%) | ${mean(ttfbsB).toFixed(1)} ± ${stdDev(ttfbsB).toFixed(1)} (${cv(ttfbsB).toFixed(1)}%) |`);
console.log('');

// === AGGREGATED TABLE: median + mean side by side ===
console.log('## Результаты: медиана и среднее\n');
console.log(`| Metric | Monolith (median) | MFE (median) | Δ med | Monolith (mean) | MFE (mean) | Δ mean |`);
console.log(`|--------|--------|--------|------|--------|--------|------|`);

const allMetrics = [...METRICS];
for (const m of E2E_METRICS) allMetrics.push([m[0], m[1], m[2], m[3], m[4], true]);

const csvRows = ['Group;Metric;Monolith_median;MFE_median;Delta_median;Monolith_mean;MFE_mean;Delta_mean;Monolith_std;MFE_std'];

let lastGroup = '';
for (const [group, label, extractor, fmt, higherBetter, isE2E] of allMetrics) {
  const dataA = (isE2E ? e2eA : runsA).map(extractor).filter(v => typeof v === 'number');
  const dataB = (isE2E ? e2eB : runsB).map(extractor).filter(v => typeof v === 'number');
  if (!dataA.length || !dataB.length) continue;

  const medA = median(dataA), medB = median(dataB);
  const meanA = mean(dataA), meanB = mean(dataB);
  const stdA = stdDev(dataA), stdB = stdDev(dataB);
  const f = fmt === 'bytes' ? fmtBytes : fmtNum;

  if (group !== lastGroup) {
    console.log(`| **${group}** | | | | | | |`);
    lastGroup = group;
  }
  console.log(`| ${label} | ${f(medA)} | ${f(medB)} | ${calcDelta(medA, medB, higherBetter)} | ${f(meanA)} | ${f(meanB)} | ${calcDelta(meanA, meanB, higherBetter)} |`);

  csvRows.push(`${group};${label};${medA};${medB};${calcDelta(medA, medB, higherBetter)};${meanA};${meanB};${calcDelta(meanA, meanB, higherBetter)};${stdA.toFixed(2)};${stdB.toFixed(2)}`);
}

fs.writeFileSync(path.join(OUT, 'compare-aggregated.csv'), '﻿' + csvRows.join('\n'));

// === RAW RUNS CSV ===
const rawHeader = ['Run', 'URL', ...allMetrics.map(([g,l]) => `${g}: ${l}`)];
const rawRows = [rawHeader.join(';')];
const writeRaw = (label, runs, e2eRuns) => {
  for (let i = 0; i < runs.length; i++) {
    const row = [i + 1, label];
    for (const [group, mLabel, extractor, fmt, hb, isE2E] of allMetrics) {
      const v = extractor(isE2E ? e2eRuns[i] : runs[i]);
      row.push(typeof v === 'number' ? v : '');
    }
    rawRows.push(row.join(';'));
  }
};
writeRaw('Monolith', runsA, e2eA);
writeRaw('Shell-MFE', runsB, e2eB);
fs.writeFileSync(path.join(OUT, 'compare-raw.csv'), '﻿' + rawRows.join('\n'));

console.log('');
console.log('## Файлы:');
console.log(`- Сырые данные (все замеры по строкам): ${path.join(OUT, 'compare-raw.csv')}`);
console.log(`- Агрегированная таблица (медиана + среднее + σ): ${path.join(OUT, 'compare-aggregated.csv')}`);
console.log(`- JSON-исходники: ${OUT}/{runs_a,runs_b,e2e_a,e2e_b}.jsonl`);
