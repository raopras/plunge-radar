#!/usr/bin/env node
// Fills gaps in site/data/archive/ so the savings calculator has enough history.
//
// It looks for complete days missing between FROM (default: the start of the current
// price cap period in site/config.js) and yesterday, then fetches each region's prices
// for that whole range in one paged request. Days that already have an archive file are
// never refetched, so once the archive is complete this script makes no API calls.
//
// It runs before fetch-prices.mjs in CI with continue-on-error, so a failure here never
// stops the hourly price update.

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  REGIONS, addDays, apiTime, londonDateString, londonMidnightUTC,
  pickAgileProduct, regionTariffCodes, slotPrices,
} from './lib.mjs';
import { getAllPages, getJSON } from './fetch-prices.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', 'site');

export async function capStart(siteDir = SITE) {
  globalThis.window ??= globalThis;
  await import(pathToFileURL(join(siteDir, 'config.js')).href + `?t=${Date.now()}`);
  return globalThis.PLUNGE_CONFIG?.priceCap?.from || null;
}

export async function backfill({
  base = process.env.OCTOPUS_API_BASE || 'https://api.octopus.energy/v1',
  outDir = process.env.OUT_DIR || join(SITE, 'data'),
  now = process.env.PLUNGE_NOW ? new Date(process.env.PLUNGE_NOW) : new Date(),
  from = process.env.BACKFILL_FROM || null,
  maxDays = 120,
  log = console.log,
} = {}) {
  from = from || (await capStart());
  if (!from) { log('No start date (priceCap.from) set; nothing to backfill.'); return { written: 0 }; }

  const yesterday = addDays(londonDateString(now), -1);
  const earliest = addDays(yesterday, -(maxDays - 1));
  if (from < earliest) from = earliest;

  const dir = join(outDir, 'archive');
  await mkdir(dir, { recursive: true });
  const have = new Set((await readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, 10)));
  const missing = [];
  for (let d = from; d <= yesterday; d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
  if (!missing.length) { log(`Archive complete from ${from} to ${yesterday}. No API calls made.`); return { written: 0 }; }
  log(`Backfilling ${missing.length} day(s): ${missing[0]} to ${missing[missing.length - 1]}`);

  const products = await getAllPages(`${base}/products/?brand=OCTOPUS_ENERGY&is_business=false&page_size=100`, { log });
  const product = pickAgileProduct(products, now);
  if (!product) throw new Error('No current Agile product found.');
  const detail = await getJSON(`${base}/products/${encodeURIComponent(product.code)}/`, { log });
  const tariffs = regionTariffCodes({ ...detail, code: product.code });

  const periodFrom = londonMidnightUTC(missing[0]);
  const periodTo = londonMidnightUTC(addDays(missing[missing.length - 1], 1));
  const byDate = Object.fromEntries(missing.map((d) => [d, {}]));
  for (const letter of Object.keys(REGIONS)) {
    const url = `${base}/products/${encodeURIComponent(product.code)}/electricity-tariffs/${encodeURIComponent(tariffs[letter])}`
      + `/standard-unit-rates/?period_from=${apiTime(periodFrom)}&period_to=${apiTime(periodTo)}&page_size=1500`;
    const records = await getAllPages(url, { log });
    for (const d of missing) byDate[d][letter] = slotPrices(records, d);
    log(`  ${letter} ${REGIONS[letter]}: ${records.length} half-hours`);
  }

  let written = 0;
  for (const d of missing) {
    const regions = byDate[d];
    const complete = Object.keys(REGIONS).every((k) => regions[k] && regions[k].every((p) => p !== null));
    if (!complete) { log(`  ${d}: incomplete, skipped`); continue; }
    await writeFile(join(dir, `${d}.json`), JSON.stringify({ date: d, product: product.code, start: londonMidnightUTC(d).toISOString(), regions }) + '\n');
    written++;
  }
  log(`Wrote ${written} archive file(s).`);
  return { written };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  backfill().catch((err) => { console.error(`Backfill failed: ${err.message}`); process.exit(1); });
}
