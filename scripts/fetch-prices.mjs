#!/usr/bin/env node
// Fetches today's and tomorrow's Agile Octopus prices for all 14 regions and
// writes them to site/data/latest.json (plus one small archive file per day).
//
// Uses only the public, no-key endpoints:
//   GET /v1/products/                                   (find the current Agile product)
//   GET /v1/products/{code}/                            (its regional tariff codes)
//   GET /v1/products/{code}/electricity-tariffs/{tariff}/standard-unit-rates/
//
// Safe to run as often as you like: if tomorrow's prices are already stored
// for every region it exits without calling the API.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REGIONS, addDays, apiTime, dayIsComplete, dayIsPublished, expectedSlots, londonDateString,
  londonMidnightUTC, pickAgileProduct, regionTariffCodes, slotPrices, summariseDay,
} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = join(HERE, '..', 'site', 'data');
const DEFAULT_BASE = 'https://api.octopus.energy/v1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, { attempts = 4, log = console.log } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'plunge-radar/1.0 (static price page)' },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return await res.json();
      // Client errors other than rate limiting won't fix themselves.
      if (res.status !== 429 && res.status < 500) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (err.fatal) throw err;
      lastErr = err;
    }
    const wait = 2000 * 2 ** i;
    log(`  retrying in ${wait / 1000}s (${lastErr.message})`);
    await sleep(wait);
  }
  throw lastErr;
}

/** Follow the API's `next` links until every page is collected. */
async function getAllPages(url, opts) {
  const results = [];
  let next = url;
  let guard = 0;
  while (next && guard++ < 50) {
    const page = await getJSON(next, opts);
    results.push(...(page.results ?? []));
    next = page.next;
  }
  return results;
}

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

export async function run({
  base = process.env.OCTOPUS_API_BASE || DEFAULT_BASE,
  outDir = process.env.OUT_DIR || DEFAULT_OUT,
  now = process.env.PLUNGE_NOW ? new Date(process.env.PLUNGE_NOW) : new Date(),
  productCode = process.env.AGILE_PRODUCT_CODE || '',
  force = process.env.FORCE === '1',
  log = console.log,
} = {}) {
  const latestPath = join(outDir, 'latest.json');
  const cached = await readJSON(latestPath);

  const today = londonDateString(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  // Cache check: nothing to do if both days are already complete.
  // Today must be complete; tomorrow only needs everything up to its final hour (see dayIsPublished).
  if (!force && dayIsComplete(cached, today) && dayIsPublished(cached, tomorrow)) {
    log(`Up to date: prices for ${today} and ${tomorrow} already stored. No API calls made.`);
    return { changed: false, reason: 'cached' };
  }

  // 1. Find the current Agile product.
  let product;
  if (productCode) {
    product = { code: productCode };
  } else {
    const products = await getAllPages(`${base}/products/?brand=OCTOPUS_ENERGY&is_business=false&page_size=100`, { log });
    product = pickAgileProduct(products, now);
    if (!product) throw new Error('No current Agile product found in /products/. Set AGILE_PRODUCT_CODE to override.');
  }
  log(`Agile product: ${product.code}`);

  // 2. Regional tariff codes.
  const detail = await getJSON(`${base}/products/${encodeURIComponent(product.code)}/`, { log });
  const tariffs = regionTariffCodes({ ...detail, code: product.code });

  // 3. Prices from UK midnight today to UK midnight the day after tomorrow, all in UTC.
  const from = londonMidnightUTC(today);
  const to = londonMidnightUTC(addDays(tomorrow, 1));

  const days = {
    [today]: { start: from.toISOString(), slots: expectedSlots(today), regions: {} },
    [tomorrow]: { start: londonMidnightUTC(tomorrow).toISOString(), slots: expectedSlots(tomorrow), regions: {} },
  };

  for (const letter of Object.keys(REGIONS)) {
    const tariff = tariffs[letter];
    const url = `${base}/products/${encodeURIComponent(product.code)}/electricity-tariffs/${encodeURIComponent(tariff)}`
      + `/standard-unit-rates/?period_from=${apiTime(from)}&period_to=${apiTime(to)}&page_size=100`;
    const records = await getAllPages(url, { log });
    for (const date of [today, tomorrow]) {
      const prices = slotPrices(records, date);
      days[date].regions[letter] = { tariff, prices, summary: summariseDay(prices) };
    }
    log(`  ${letter} ${REGIONS[letter]}: ${records.length} half-hours`);
  }

  // Tomorrow is published around 4pm UK time; before then it's empty, so leave it out.
  if (!Object.values(days[tomorrow].regions).some((r) => r.summary)) delete days[tomorrow];

  const dataset = {
    generatedAt: now.toISOString(),
    product: product.code,
    productName: detail.display_name ?? 'Agile Octopus',
    units: 'pence per kWh, including 5% VAT',
    regions: REGIONS,
    days,
  };

  // Keep yesterday if we had it, so the page still works just after midnight.
  if (cached?.days?.[yesterday]) dataset.days = { [yesterday]: cached.days[yesterday], ...dataset.days };

  const before = cached ? JSON.stringify({ ...cached, generatedAt: null }) : '';
  const after = JSON.stringify({ ...dataset, generatedAt: null });
  if (before === after && !force) {
    log('Prices unchanged since last run; not rewriting files.');
    return { changed: false, reason: 'unchanged' };
  }

  await mkdir(join(outDir, 'archive'), { recursive: true });
  await writeFile(latestPath, JSON.stringify(dataset) + '\n');

  // Compact archive: one file per complete day, prices only (times follow from the date).
  for (const date of Object.keys(dataset.days)) {
    if (!dayIsComplete(dataset, date)) continue;
    const regions = Object.fromEntries(Object.entries(dataset.days[date].regions).map(([k, v]) => [k, v.prices]));
    await writeFile(join(outDir, 'archive', `${date}.json`), JSON.stringify({ date, product: product.code, start: dataset.days[date].start, regions }) + '\n');
  }

  log(`Wrote ${latestPath} (${Object.keys(dataset.days).join(', ')})`);
  return { changed: true, dataset };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((err) => {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  });
}
