import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS } from '../scripts/lib.mjs';
import { run, pickFlexible, pickIntelligentGo, isFresh } from '../scripts/fetch-tariffs.mjs';
import { evCost } from '../scripts/tariff-pages.mjs';
import { build } from '../scripts/build-site.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const NOW = new Date('2026-10-13T16:00:00Z');

// Shapes copied from the live API (13 Oct 2026): Flexible uses a "varying" payment key,
// Intelligent Octopus Go keeps its rates under four_rate_ev_electricity_tariffs,
// and Tracker isn't in the product list.
const PRODUCTS = [
  { code: 'AGILE-24-10-01', display_name: 'Agile Octopus', direction: 'IMPORT', available_from: '2024-10-01T00:00:00+01:00' },
  { code: 'VAR-22-11-01', display_name: 'Flexible Octopus', direction: 'IMPORT', available_from: '2023-03-28T10:35:00+01:00' },
  { code: 'SMART-PREPAY-VAR-22-10-22', display_name: 'Flexible Octopus Smart Pay as You Go', direction: 'IMPORT', is_prepay: true, available_from: '2022-10-22T00:00:00+01:00' },
  { code: 'IOG-SMB-FIX-12M-26-10-01', display_name: 'Intelligent Octopus Go 12M Fixed', direction: 'IMPORT', available_from: '2026-10-01T00:00:00+01:00' },
  { code: 'IOG-SMB-FIX-OEV-12M-26-10-01', display_name: 'Intelligent Octopus Go 12M Fixed - EV Saver', direction: 'IMPORT', available_from: '2026-10-01T00:00:00+01:00' },
  { code: 'INTELLI-FLUX-IMPORT-23-07-14', display_name: 'Intelligent Octopus Flux Import', direction: 'IMPORT', available_from: '2023-07-13T00:00:00+01:00' },
];

function regions(fn) { return Object.fromEntries(Object.keys(REGIONS).map((k, i) => [`_${k}`, fn(k, i)])); }

function mockApi({ trackerFails = false } = {}) {
  let count = 0;
  const server = http.createServer((req, res) => {
    count++;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const send = (obj, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    const path = url.pathname;
    if (path === '/v1/products/') return send({ count: PRODUCTS.length, next: null, results: PRODUCTS });
    if (path === '/v1/products/AGILE-24-10-01/') return send({ code: 'AGILE-24-10-01', display_name: 'Agile Octopus', single_register_electricity_tariffs: regions((k, i) => ({ direct_debit_monthly: { code: `E-1R-AGILE-24-10-01-${k}`, standing_charge_inc_vat: 40 + i } })) });
    if (path === '/v1/products/VAR-22-11-01/') return send({ code: 'VAR-22-11-01', display_name: 'Flexible Octopus', single_register_electricity_tariffs: regions((k, i) => ({ varying: { code: `E-1R-VAR-22-11-01-${k}`, standard_unit_rate_inc_vat: 26.5956 + i / 10, standing_charge_inc_vat: 41.3869 } })) });
    if (path === '/v1/products/IOG-SMB-FIX-12M-26-10-01/') return send({ code: 'IOG-SMB-FIX-12M-26-10-01', display_name: 'Intelligent Octopus Go 12M Fixed', is_variable: false, term: 12, single_register_electricity_tariffs: {}, four_rate_ev_electricity_tariffs: regions((k) => ({ direct_debit_monthly: { code: `E-1R-IOG-${k}`, day_unit_rate_inc_vat: 35.8812, night_unit_rate_inc_vat: 7.6, standing_charge_inc_vat: 42.29, exit_fees_inc_vat: 5000 } })) });
    if (path === '/v1/products/SILVER-OLD/') return send({ code: 'SILVER-OLD', available_to: '2026-04-01T00:00:00+01:00' });
    if (path === '/v1/products/SILVER-26-04-01/') {
      if (trackerFails) return send({ detail: 'down' }, 404);
      return send({ code: 'SILVER-26-04-01', available_to: null, single_register_electricity_tariffs: regions((k) => ({ direct_debit_monthly: { code: `E-1R-SILVER-26-04-01-${k}`, standing_charge_inc_vat: 40.4025 } })) });
    }
    if (/SILVER-26-04-01\/electricity-tariffs\/.+\/standard-unit-rates\/$/.test(path)) {
      // Newest first, one record per UK day (23:00Z to 23:00Z in summer time).
      const results = Array.from({ length: 31 }, (_, i) => {
        const start = new Date(Date.UTC(2026, 9, 13, 23) - i * 86400000);
        return { value_inc_vat: 20 + (i % 10), valid_from: start.toISOString(), valid_to: new Date(start.getTime() + 86400000).toISOString() };
      });
      return send({ count: results.length, next: null, results });
    }
    send({ detail: 'not found' }, 404);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/v1`, calls: () => count })));
}

test("charging cost matches Octopus Energy's own example (7,000 miles, 0.301 kWh/mile, 7.6p = £160.13)", () => {
  assert.equal(Math.round(evCost(7000, 0.301, 7.6) * 100) / 100, 160.13);
});

test('picks the right Flexible and Intelligent Octopus Go products', () => {
  assert.equal(pickFlexible(PRODUCTS, NOW).code, 'VAR-22-11-01');
  assert.equal(pickIntelligentGo(PRODUCTS, NOW).code, 'IOG-SMB-FIX-12M-26-10-01');
});

test('fetches all four tariffs, skips closed Tracker codes, then stays quiet when fresh', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'plunge-tariffs-'));
  const { server, base, calls } = await mockApi();
  try {
    const r = await run({ base, outDir: tmp, now: NOW, trackerCodes: ['SILVER-OLD', 'SILVER-26-04-01'], log: () => {} });
    assert.equal(r.changed, true);
    assert.deepEqual(r.failures, []);
    const d = JSON.parse(await readFile(join(tmp, 'tariffs.json'), 'utf8'));
    assert.equal(d.products.tracker.code, 'SILVER-26-04-01');
    assert.equal(d.products.go.exitFee, 50);
    assert.deepEqual(d.regions.C.go, { day: 35.88, night: 7.6, standing: 42.29 });
    assert.equal(d.regions.A.flexible.unit, 26.6);
    assert.equal(d.regions.C.tracker.rates[0].d, '2026-10-14', 'tomorrow first, dated in UK time');
    assert.equal(d.regions.C.tracker.rates.length, 31);
    assert.ok(isFresh(d, NOW));
    const before = calls();
    const r2 = await run({ base, outDir: tmp, now: NOW, log: () => {} });
    assert.equal(r2.reason, 'cached');
    assert.equal(calls(), before);
  } finally { server.close(); }
});

test('keeps the last good Tracker rates when the API fails', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'plunge-tariffs-'));
  const old = { generatedAt: '2026-10-10T16:00:00Z', products: { tracker: { code: 'SILVER-26-04-01' } }, regions: { C: { tracker: { standing: 40, rates: [{ d: '2026-10-10', p: 22 }] } } } };
  await writeFile(join(tmp, 'tariffs.json'), JSON.stringify(old));
  const { server, base } = await mockApi({ trackerFails: true });
  try {
    const r = await run({ base, outDir: tmp, now: NOW, log: () => {} });
    assert.equal(r.failures.length, 1);
    assert.match(r.failures[0], /tracker/);
    const d = JSON.parse(await readFile(join(tmp, 'tariffs.json'), 'utf8'));
    assert.deepEqual(d.regions.C.tracker, old.regions.C.tracker);
    assert.equal(d.regions.C.flexible.unit, 26.8);
  } finally { server.close(); }
});

test('builds the tariff hub and four tariff pages with referral links, disclosures and real numbers', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'plunge-tpages-'));
  const siteDir = join(tmp, 'site');
  const outDir = join(tmp, 'out');
  await cp(SITE, siteDir, { recursive: true });
  const { server, base } = await mockApi();
  try { await run({ base, outDir: join(siteDir, 'data'), now: NOW, force: true, log: () => {} }); } finally { server.close(); }
  const res = await build({ siteDir, outDir, now: NOW, siteUrl: 'https://plungeradar.co.uk', log: () => {} });
  for (const slug of ['', 'agile/', 'intelligent-octopus-go/', 'tracker/', 'flexible/']) {
    assert.ok(res.pages.includes(`https://plungeradar.co.uk/octopus-tariffs/${slug}`), slug);
    const h = await readFile(join(outDir, 'octopus-tariffs', slug, 'index.html'), 'utf8');
    const refs = h.match(/class="btn-cta[^"]*ref-link"[^>]*href="([^"]+)"/g) || [];
    assert.ok(refs.length >= 3, `${slug}: at least 3 referral buttons`);
    assert.ok(refs.every((a) => a.includes('href="https://share.octopus.energy/silk-snail-210"')), `${slug}: buttons use the referral link`);
    assert.ok(h.includes('rel="sponsored noopener"'));
    assert.ok(h.includes('Referral link') && h.includes('not affiliated with Octopus Energy'));
    assert.ok(h.includes('id="ref-copy"') && h.includes('value="https://share.octopus.energy/silk-snail-210"'), `${slug}: copy-link box`);
    assert.ok(h.includes('"@type":"FAQPage"') && h.includes('"@type":"BreadcrumbList"'));
    assert.ok(!h.includes('{{REF}}') && !h.includes('Octopus Agile'));
  }
  const hub = await readFile(join(outDir, 'octopus-tariffs', 'index.html'), 'utf8');
  assert.ok(hub.includes('id="quiz-form"') && hub.includes('data-cta="quiz"'));
  assert.ok(hub.includes('<span data-v="goNight">7.6p</span>'), 'London off-peak rate written into the page');
  const go = await readFile(join(outDir, 'octopus-tariffs', 'intelligent-octopus-go', 'index.html'), 'utf8');
  assert.ok(go.includes('35.9p') && go.includes('£50 exit fee'));
  const ev = await readFile(join(outDir, 'electric-car-charging-cost', 'index.html'), 'utf8');
  assert.ok(res.pages.includes('https://plungeradar.co.uk/electric-car-charging-cost/'));
  assert.ok(ev.includes('id="ev-form"') && ev.includes('data-cta="hero"') && ev.includes('id="ref-copy"'));
  assert.ok(ev.includes('£160'), "Octopus Energy's own 7,000-mile example at 7.6p");
  assert.ok(ev.includes('Referral link') && ev.includes('not affiliated with Octopus Energy'));
  const home = await readFile(join(outDir, 'index.html'), 'utf8');
  assert.ok(home.includes('href="/octopus-tariffs/"'), 'home page links to the tariff guide');
});
