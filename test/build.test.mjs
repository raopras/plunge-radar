import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cp, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS, dayIsPublished, expectedSlots } from '../scripts/lib.mjs';
import { run } from '../scripts/fetch-prices.mjs';
import { build } from '../scripts/build-site.mjs';
import { audit } from '../scripts/seo-audit.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');

test('tomorrow counts as published when only its last hour is missing', () => {
  const n = expectedSlots('2026-10-13');
  const mk = (prices) => ({ days: { '2026-10-13': { regions: Object.fromEntries(Object.keys(REGIONS).map((k) => [k, { prices }])) } } });
  const full = Array.from({ length: n }, () => 10);
  assert.equal(dayIsPublished(mk(full), '2026-10-13'), true);
  assert.equal(dayIsPublished(mk([...full.slice(0, n - 2), null, null]), '2026-10-13'), true);
  assert.equal(dayIsPublished(mk([...full.slice(0, n - 3), null, null, null]), '2026-10-13'), false);
  assert.equal(dayIsPublished(mk([null, ...full.slice(1)]), '2026-10-13'), false);
});

// Mock API: every region priced, with a midday dip below zero; region C slightly cheaper.
function mockApi() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (url.pathname === '/v1/products/') return send({ next: null, results: [{ code: 'AGILE-24-10-01', available_from: '2024-10-01T00:00:00Z' }] });
    if (url.pathname === '/v1/products/AGILE-24-10-01/') {
      const t = {}; for (const r of Object.keys(REGIONS)) t[`_${r}`] = { direct_debit_monthly: { code: `E-1R-AGILE-24-10-01-${r}` } };
      return send({ display_name: 'Agile Octopus', single_register_electricity_tariffs: t });
    }
    const m = url.pathname.match(/-([A-P])\/standard-unit-rates\/$/);
    if (m) {
      const from = Date.parse(url.searchParams.get('period_from')), to = Date.parse(url.searchParams.get('period_to'));
      const out = [];
      for (let t = from; t < to; t += 1800000) {
        const h = new Date(t).getUTCHours();
        const p = (h >= 11 && h < 13 ? -3 : 15 + (h >= 16 && h < 19 ? 15 : 0)) + (m[1] === 'C' ? -1 : 'ABDEFGHJKLMNP'.indexOf(m[1]) * 0.1);
        out.push({ valid_from: new Date(t).toISOString(), valid_to: new Date(t + 1800000).toISOString(), value_inc_vat: p });
      }
      return send({ next: null, results: out.reverse() });
    }
    res.statusCode = 404; res.end('{}');
  });
  return new Promise((r) => server.listen(0, () => r({ server, base: `http://localhost:${server.address().port}/v1` })));
}

test('build writes a landing page per region with real numbers, links and structured data', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'plunge-build-'));
  const siteDir = join(tmp, 'site');
  const outDir = join(tmp, 'out');
  await cp(SITE, siteDir, { recursive: true });
  const { server, base } = await mockApi();
  const now = new Date('2026-10-13T17:00:00Z');
  try {
    await run({ base, outDir: join(siteDir, 'data'), now, force: true, log: () => {} });
  } finally { server.close(); }

  const res = await build({ siteDir, outDir, now, siteUrl: 'https://plungeradar.co.uk', log: () => {} });
  assert.equal(res.pages.length, 16);

  const sitemap = await readFile(join(outDir, 'sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, 16);
  assert.ok(sitemap.includes('<loc>https://plungeradar.co.uk/disclaimer/</loc>'));
  const legal = await readFile(join(outDir, 'disclaimer', 'index.html'), 'utf8');
  assert.ok(legal.includes('Your statutory rights are not affected'));
  assert.ok(legal.includes('law of England and Wales'));
  assert.ok(legal.includes('&#109;&#97;&#105;&#108;&#116;&#111;&#58;'), 'encoded mailto link on the disclaimer');
  assert.ok(!legal.includes('raoprasji@gmail.com'), 'address is not in plain text');
  assert.ok(sitemap.includes('<loc>https://plungeradar.co.uk/south-east-england/</loc>'));

  const london = await readFile(join(outDir, 'london', 'index.html'), 'utf8');
  assert.match(london, /<title>Agile Octopus Prices Today: London \| Plunge Radar<\/title>/);
  assert.match(london, /<link rel="canonical" href="https:\/\/plungeradar.co.uk\/london\/">/);
  assert.match(london, /<h1>Agile Octopus tariff prices today in London<\/h1>/);
  assert.match(london, /id="best-time">\d\d:\d\d–\d\d:\d\d</, 'cheapest window is written into the HTML');
  assert.match(london, /<meta name="description" content="\d\d:\d\d–\d\d:\d\d is the cheapest time for electricity in London on /);
  assert.match(london, /id="results-h">Cheapest times to use electricity in London today</);
  assert.ok(!london.includes('id="ld-home"'), 'home structured data removed from region pages');
  assert.ok(london.includes('window.PLUNGE_PAGE = { region: "C", base: "../" }'));
  assert.ok(london.includes('href="../styles.css"') && london.includes('src="../app.js"'));
  assert.ok(london.includes('href="../south-east-england/"'), 'links to other regions');
  assert.match(london, /class="is-current" aria-current="page"><td class="n">1<\/td><td><a href="..\/london\/">London</, 'London is cheapest in the mock and marked current');
  assert.ok(london.includes('<dt>MPAN starts with</dt><dd>12</dd>'));
  assert.ok(london.includes('UK Power Networks'));
  assert.ok(london.includes('Recent days in London'), 'history table from archive');

  const ld = JSON.parse(london.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(ld.map((x) => x['@type']), ['BreadcrumbList', 'WebPage', 'FAQPage']);
  assert.equal(ld[2].mainEntity.length, 5);

  for (const r of Object.values(globalThis.PlungeRegions.REGIONS)) {
    const html = await readFile(join(outDir, r.slug, 'index.html'), 'utf8');
    assert.ok(html.includes(`<h1>Agile Octopus tariff prices today in ${r.inName.replace("'", '&#39;')}</h1>`), r.slug);
  }

  // Every title and description fits in a search result.
  for (const f of ['index.html', ...Object.values(globalThis.PlungeRegions.REGIONS).map((r) => `${r.slug}/index.html`)]) {
    const h = await readFile(join(outDir, f), 'utf8');
    const t = h.match(/<title>([^<]*)/)[1].replace(/&amp;/g, '&');
    const d = h.match(/name="description" content="([^"]*)/)[1].replace(/&amp;|&#39;/g, 'x');
    assert.ok(t.length <= 60, `${f} title ${t.length}: ${t}`);
    assert.ok(d.length <= 155, `${f} description ${d.length}`);
  }
  assert.ok((await readFile(join(outDir, '404.html'), 'utf8')).includes('noindex'));

  assert.deepEqual(audit(outDir).issues, [], 'publish-time SEO audit');

  const home = await readFile(join(outDir, 'index.html'), 'utf8');
  assert.ok(home.includes('href="london/"') && !home.includes('PLUNGE_PAGE'));
  assert.ok(!home.includes('<!--build:compare-->'));
  assert.ok((await readdir(outDir)).includes('robots.txt'));
});
