import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addDays, expectedSlots, londonMidnightUTC, negativeRuns, pickAgileProduct,
  slotPrices, summariseDay, bestWindow, REGIONS,
} from '../scripts/lib.mjs';
import { run } from '../scripts/fetch-prices.mjs';

test('UK midnight in UTC, summer and winter', () => {
  assert.equal(londonMidnightUTC('2026-10-13').toISOString(), '2026-10-12T23:00:00.000Z');
  assert.equal(londonMidnightUTC('2026-12-01').toISOString(), '2026-12-01T00:00:00.000Z');
});

test('half-hour count handles clock changes', () => {
  assert.equal(expectedSlots('2026-10-13'), 48);
  assert.equal(expectedSlots('2026-10-25'), 50); // clocks go back
  assert.equal(expectedSlots('2026-03-29'), 46); // clocks go forward
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('picks the current Agile import product only', () => {
  const now = new Date('2026-10-12T15:00:00Z');
  const p = pickAgileProduct([
    { code: 'AGILE-OUTGOING-19-05-13', display_name: 'Agile Outgoing Octopus', available_from: '2026-01-01T00:00:00Z' },
    { code: 'AGILE-22-11-25', available_from: '2022-11-25T00:00:00Z', available_to: '2024-10-01T00:00:00Z' },
    { code: 'AGILE-24-10-01', available_from: '2024-10-01T00:00:00Z', available_to: null },
    { code: 'GO-VAR-22-10-14', available_from: '2026-01-01T00:00:00Z' },
  ], now);
  assert.equal(p.code, 'AGILE-24-10-01');
});

test('slots, windows and negative runs', () => {
  const start = londonMidnightUTC('2026-10-13').getTime();
  const records = Array.from({ length: 48 }, (_, i) => ({
    valid_from: new Date(start + i * 1800000).toISOString(),
    valid_to: new Date(start + (i + 1) * 1800000).toISOString(),
    value_inc_vat: i >= 4 && i < 8 ? -2.1 : 10 + (i >= 32 && i < 38 ? 20 : 0),
  })).reverse(); // API returns newest first
  const prices = slotPrices(records, '2026-10-13');
  assert.equal(prices.length, 48);
  assert.equal(prices[0], 10);
  assert.deepEqual(negativeRuns(prices), [{ start: 4, end: 8, min: -2.1 }]);
  assert.equal(bestWindow(prices, 4, 'min').start, 4);
  assert.equal(bestWindow(prices, 4, 'max').start, 32);
  const s = summariseDay(prices);
  assert.equal(s.min, -2.1);
  assert.equal(s.max, 30);
});

// ---- End-to-end against a mock API -----------------------------------------

function mockApi() {
  const calls = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    calls.push(url.pathname + url.search);
    const base = `http://${req.headers.host}/v1`;
    const send = (obj) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };

    if (url.pathname === '/v1/products/') {
      const page = Number(url.searchParams.get('page') || 1);
      if (page === 1) {
        return send({ count: 2, next: `${base}/products/?brand=OCTOPUS_ENERGY&is_business=false&page_size=100&page=2`,
          results: [{ code: 'AGILE-OUTGOING-19-05-13', display_name: 'Agile Outgoing', available_from: '2019-05-13T00:00:00Z' }] });
      }
      return send({ count: 2, next: null, results: [{ code: 'AGILE-24-10-01', display_name: 'Agile Octopus', available_from: '2024-10-01T00:00:00Z' }] });
    }
    if (url.pathname === '/v1/products/AGILE-24-10-01/') {
      const t = {};
      for (const r of Object.keys(REGIONS)) t[`_${r}`] = { direct_debit_monthly: { code: `E-1R-AGILE-24-10-01-${r}` } };
      return send({ code: 'AGILE-24-10-01', display_name: 'Agile Octopus', single_register_electricity_tariffs: t });
    }
    const m = url.pathname.match(/standard-unit-rates\/$/);
    if (m) {
      const from = new Date(url.searchParams.get('period_from')).getTime();
      const to = new Date(url.searchParams.get('period_to')).getTime();
      const all = [];
      for (let t = from; t < to; t += 1800000) {
        const hour = new Date(t).getUTCHours();
        all.push({ valid_from: new Date(t).toISOString(), valid_to: new Date(t + 1800000).toISOString(),
          value_inc_vat: hour === 3 ? -1.5 : 12 + hour, value_exc_vat: 0 });
      }
      all.reverse();
      const page = Number(url.searchParams.get('page') || 1);
      const slice = all.slice((page - 1) * 40, page * 40);
      const next = page * 40 < all.length ? `${base}${url.pathname.replace('/v1', '')}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: String(page + 1) })}` : null;
      return send({ count: all.length, next, results: slice });
    }
    res.statusCode = 404; res.end('{}');
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, calls, base: `http://localhost:${server.address().port}/v1` })));
}

test('end to end: fetch, paging, file output, then cache', async () => {
  const { server, calls, base } = await mockApi();
  const outDir = await mkdtemp(join(tmpdir(), 'plunge-'));
  const now = new Date('2026-10-24T16:30:00Z'); // tomorrow (25th) has 50 half-hours
  try {
    const r1 = await run({ base, outDir, now, log: () => {} });
    assert.equal(r1.changed, true);
    const data = JSON.parse(await readFile(join(outDir, 'latest.json'), 'utf8'));
    assert.equal(data.product, 'AGILE-24-10-01');
    assert.equal(data.days['2026-10-24'].regions.C.prices.length, 48);
    assert.equal(data.days['2026-10-25'].regions.C.prices.length, 50);
    assert.ok(data.days['2026-10-25'].regions.C.prices.every((p) => p !== null));
    assert.ok(data.days['2026-10-25'].regions.C.summary.negatives.length >= 1);
    // The mock serves 40 per page, so 98 half-hours need three pages per region.
    assert.ok(calls.some((c) => c.includes('standard-unit-rates') && c.includes("page=3")));
    // Requests our script builds (not the API's own next links) must use UTC with a trailing Z.
    assert.ok(calls.every((c) => !c.includes('period_from') || c.includes('page=') || /period_from=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z/.test(c)));
    assert.deepEqual((await readdir(join(outDir, 'archive'))).sort(), ['2026-10-24.json', '2026-10-25.json']);

    const before = calls.length;
    const r2 = await run({ base, outDir, now: new Date('2026-10-24T18:00:00Z'), log: () => {} });
    assert.equal(r2.reason, 'cached');
    assert.equal(calls.length, before, 'second run must not call the API');
  } finally {
    server.close();
  }
});
