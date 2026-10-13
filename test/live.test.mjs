// The browser's self-healing fallback (site/live.js) must work out prices exactly as the
// build does (scripts/lib.mjs), and must never break the page when the API fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expectedSlots, londonMidnightUTC, slotPrices, summariseDay } from '../scripts/lib.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
await import(pathToFileURL(join(SITE, 'live.js')).href);
const L = globalThis.PlungeLive;

function records(dateStr, fn, n = expectedSlots(dateStr)) {
  const start = londonMidnightUTC(dateStr).getTime();
  return Array.from({ length: n }, (_, i) => ({
    valid_from: new Date(start + i * 1800000).toISOString(),
    valid_to: new Date(start + (i + 1) * 1800000).toISOString(),
    value_inc_vat: fn(i),
  })).reverse();
}

test('live.js matches the build library, including clock-change days', () => {
  for (const d of ['2026-10-13', '2026-10-25', '2027-03-28']) {
    const recs = records(d, (i) => (i % 7 === 3 ? -1.5 : 10 + (i % 11) * 1.37));
    assert.equal(L.expectedSlots(d), expectedSlots(d), d);
    assert.equal(L.midnightUTC(d).toISOString(), londonMidnightUTC(d).toISOString(), d);
    assert.deepEqual(L.slotPrices(recs, d), slotPrices(recs, d), d);
    assert.deepEqual(L.summariseDay(L.slotPrices(recs, d)), summariseDay(slotPrices(recs, d)), d);
  }
});

test('nothing to do when the stored file is current', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const prices = new Array(48).fill(12);
  const data = { product: 'AGILE-24-10-01', days: { '2026-10-13': { regions: { C: { prices } } } } };
  assert.equal(L.missing(data, 'C', now), null);
});

test('fills today and tomorrow from the API when the scheduled update was skipped', async () => {
  const now = new Date('2026-10-13T17:30:00Z'); // 6:30pm UK time: tomorrow should be out
  const stale = { product: 'AGILE-24-10-01', generatedAt: '2026-10-12T15:10:00Z',
    days: { '2026-10-12': { regions: { C: { tariff: 'E-1R-AGILE-24-10-01-C', prices: new Array(48).fill(20) } } } } };
  const gap = L.missing(stale, 'C', now);
  assert.deepEqual(gap.need, ['2026-10-13', '2026-10-14']);
  let calledUrl = '';
  const api = [...records('2026-10-13', (i) => 15 + (i % 5)), ...records('2026-10-14', (i) => (i === 6 ? -2 : 18))];
  const out = await L.topUp(stale, 'C', now, async (url) => { calledUrl = url; return { ok: true, json: async () => ({ results: api }) }; });
  assert.match(calledUrl, /AGILE-24-10-01\/electricity-tariffs\/E-1R-AGILE-24-10-01-C\/standard-unit-rates/);
  assert.equal(out.days['2026-10-13'].regions.C.prices.length, 48);
  assert.equal(out.days['2026-10-14'].regions.C.summary.min, -2);
  assert.ok(out.liveAt);
  assert.equal(stale.days['2026-10-13'], undefined, 'the original data is not modified');
});

test('an API failure or timeout leaves the page with the stored data', async () => {
  const now = new Date('2026-10-13T17:30:00Z');
  const stale = { product: 'AGILE-24-10-01', days: {} };
  assert.equal(await L.topUp(stale, 'C', now, async () => { throw new Error('offline'); }), stale);
  assert.equal(await L.topUp(stale, 'C', now, async () => ({ ok: false })), stale);
  assert.equal(await L.topUp(stale, 'C', now, async () => ({ ok: true, json: async () => ({ results: [] }) })), stale);
});
