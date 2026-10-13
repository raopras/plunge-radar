#!/usr/bin/env node
// Fetches the regional rates for the four Octopus Energy tariffs on the
// /octopus-tariffs/ pages and writes site/data/tariffs.json:
//   Agile Octopus            standing charge (unit prices come from latest.json and the archive)
//   Intelligent Octopus Go   day rate, off-peak rate, standing charge
//   Octopus Tracker          daily electricity unit rate for the last month, standing charge
//   Flexible Octopus         unit rate, standing charge
//
// Fail-safe: if a product can't be fetched, the previous values for it are kept, so
// the pages never lose their numbers because of one bad API call. This script runs
// in CI with continue-on-error, separately from the Agile price fetch.
//
// Uses only public, no-key endpoints of the Octopus Energy API.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS, addDays, apiTime, londonDateString, londonMidnightUTC, pickAgileProduct } from './lib.mjs';
import { getAllPages, getJSON } from './fetch-prices.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = join(HERE, '..', 'site', 'data');
const DEFAULT_BASE = 'https://api.octopus.energy/v1';

// Octopus Tracker isn't listed in /products/, so its code is set here.
// When Octopus launches a new Tracker version, add its code to the front.
export const TRACKER_CODES = ['SILVER-26-04-01'];
const TRACKER_DAYS = 31;

const round = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const current = (p, now) => !p.is_business && !p.is_prepay && (!p.direction || p.direction === 'IMPORT')
  && (!p.available_to || new Date(p.available_to) > now);
const newest = (list) => list.sort((a, b) => new Date(b.available_from) - new Date(a.available_from))[0] ?? null;

export function pickFlexible(products, now = new Date()) {
  return newest(products.filter((p) => current(p, now) && /^Flexible Octopus$/i.test(p.display_name ?? '')));
}

export function pickIntelligentGo(products, now = new Date()) {
  return newest(products.filter((p) => current(p, now)
    && /^Intelligent Octopus Go\b/i.test(p.display_name ?? '')
    && !/EV Saver|Flux/i.test(`${p.display_name} ${p.full_name ?? ''}`)));
}

/** The Direct Debit entry for one region, whichever register type the product uses. */
export function regionEntry(detail, letter, kind = 'single_register_electricity_tariffs') {
  const entry = detail?.[kind]?.[`_${letter}`];
  if (!entry) return null;
  return entry.direct_debit_monthly ?? entry.varying ?? Object.values(entry)[0] ?? null;
}

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

/** Skip the API when the stored file already has tomorrow's Tracker price and is under 12 hours old. */
export function isFresh(cached, now) {
  if (!cached?.generatedAt) return false;
  if (now - new Date(cached.generatedAt) > 12 * 3600 * 1000) return false;
  const tomorrow = addDays(londonDateString(now), 1);
  return Object.keys(REGIONS).every((k) => cached.regions?.[k]?.tracker?.rates?.[0]?.d === tomorrow);
}

export async function run({
  base = process.env.OCTOPUS_API_BASE || DEFAULT_BASE,
  outDir = process.env.OUT_DIR || DEFAULT_OUT,
  now = process.env.PLUNGE_NOW ? new Date(process.env.PLUNGE_NOW) : new Date(),
  trackerCodes = TRACKER_CODES,
  force = process.env.FORCE === '1',
  log = console.log,
} = {}) {
  const path = join(outDir, 'tariffs.json');
  const cached = await readJSON(path);
  if (!force && isFresh(cached, now)) {
    log('Tariff rates are up to date. No API calls made.');
    return { changed: false, reason: 'cached' };
  }

  const out = {
    generatedAt: now.toISOString(),
    units: 'pence, including any VAT due',
    products: { ...(cached?.products ?? {}) },
    regions: Object.fromEntries(Object.keys(REGIONS).map((k) => [k, { ...(cached?.regions?.[k] ?? {}) }])),
  };
  const failures = [];
  const opts = { log };

  let products = [];
  try {
    products = await getAllPages(`${base}/products/?brand=OCTOPUS_ENERGY&is_business=false&page_size=100`, opts);
  } catch (err) {
    failures.push(`product list: ${err.message}`);
  }

  // Agile Octopus: standing charges (unit prices are already in latest.json).
  await step('agile', async () => {
    const p = pickAgileProduct(products, now);
    if (!p) throw new Error('no current Agile product');
    const d = await getJSON(`${base}/products/${p.code}/`, opts);
    for (const k of Object.keys(REGIONS)) {
      const e = regionEntry(d, k);
      if (e) out.regions[k].agile = { standing: round(e.standing_charge_inc_vat) };
    }
    out.products.agile = { code: p.code, name: d.display_name || 'Agile Octopus' };
  });

  // Flexible Octopus: one unit rate and standing charge per region.
  await step('flexible', async () => {
    const p = pickFlexible(products, now);
    if (!p) throw new Error('no current Flexible Octopus product');
    const d = await getJSON(`${base}/products/${p.code}/`, opts);
    for (const k of Object.keys(REGIONS)) {
      const e = regionEntry(d, k);
      if (e) out.regions[k].flexible = { unit: round(e.standard_unit_rate_inc_vat), standing: round(e.standing_charge_inc_vat) };
    }
    out.products.flexible = { code: p.code, name: d.display_name || 'Flexible Octopus', exitFee: 0 };
  });

  // Intelligent Octopus Go: day and off-peak rates sit under four_rate_ev_electricity_tariffs.
  await step('go', async () => {
    const p = pickIntelligentGo(products, now);
    if (!p) throw new Error('no current Intelligent Octopus Go product');
    const d = await getJSON(`${base}/products/${p.code}/`, opts);
    for (const k of Object.keys(REGIONS)) {
      const e = regionEntry(d, k, 'four_rate_ev_electricity_tariffs') ?? regionEntry(d, k, 'dual_register_electricity_tariffs');
      if (e) {
        out.regions[k].go = {
          day: round(e.day_unit_rate_inc_vat), night: round(e.night_unit_rate_inc_vat), standing: round(e.standing_charge_inc_vat),
        };
      }
    }
    const fee = regionEntry(d, 'C', 'four_rate_ev_electricity_tariffs')?.exit_fees_inc_vat;
    out.products.go = {
      code: p.code, name: 'Intelligent Octopus Go', fixed: d.is_variable === false, term: d.term ?? null,
      exitFee: typeof fee === 'number' ? fee / 100 : null,
    };
  });

  // Octopus Tracker: daily unit rate for each region over the last month.
  await step('tracker', async () => {
    let code = null;
    let detail = null;
    for (const c of trackerCodes) {
      try {
        const d = await getJSON(`${base}/products/${c}/`, opts);
        if (!d.available_to || new Date(d.available_to) > now) { code = c; detail = d; break; }
        log(`  Tracker ${c} closed on ${d.available_to}; trying the next code.`);
      } catch (err) { log(`  Tracker ${c}: ${err.message}`); }
    }
    if (!code) throw new Error('no open Tracker product: add the new code to TRACKER_CODES in scripts/fetch-tariffs.mjs');
    const from = londonMidnightUTC(addDays(londonDateString(now), -(TRACKER_DAYS - 2)));
    for (const k of Object.keys(REGIONS)) {
      const e = regionEntry(detail, k);
      if (!e) continue;
      const records = await getAllPages(`${base}/products/${code}/electricity-tariffs/${e.code}/standard-unit-rates/?period_from=${apiTime(from)}&page_size=100`, opts);
      const byDay = new Map();
      for (const r of records) {
        const d = londonDateString(new Date(r.valid_from));
        if (!byDay.has(d)) byDay.set(d, round(r.value_inc_vat));
      }
      const rates = [...byDay].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, TRACKER_DAYS).map(([d, p]) => ({ d, p }));
      out.regions[k].tracker = { standing: round(e.standing_charge_inc_vat), rates };
    }
    out.products.tracker = { code, name: 'Octopus Tracker', exitFee: 0, cap: 100 };
  });

  async function step(name, fn) {
    try { await fn(); log(`  ${name}: ok`); } catch (err) { failures.push(`${name}: ${err.message}`); log(`  ${name}: FAILED (${err.message}); keeping previous values`); }
  }

  const strip = (o) => JSON.stringify({ ...o, generatedAt: null });
  if (cached && strip(cached) === strip(out) && !force) {
    log('Tariff rates unchanged; not rewriting the file.');
    return { changed: false, reason: 'unchanged', failures };
  }
  // Nothing fetched and nothing stored: don't write an empty file.
  if (!Object.keys(out.products).length) throw new Error(`no tariff data fetched (${failures.join('; ')})`);

  await mkdir(outDir, { recursive: true });
  await writeFile(path, JSON.stringify(out) + '\n');
  log(`Wrote ${path}${failures.length ? ` with ${failures.length} failure(s): ${failures.join('; ')}` : ''}`);
  return { changed: true, data: out, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().then((r) => { if (r.failures?.length) process.exitCode = 1; })
    .catch((err) => { console.error(`Failed: ${err.message}`); process.exit(1); });
}
