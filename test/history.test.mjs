import { existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cp, mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS } from '../scripts/lib.mjs';
import { backfill } from '../scripts/backfill-history.mjs';
import { build } from '../scripts/build-site.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');

function mockApi() {
  let rateCalls = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (url.pathname === '/v1/products/') return send({ next: null, results: [{ code: 'AGILE-24-10-01', available_from: '2024-10-01T00:00:00Z' }] });
    if (url.pathname === '/v1/products/AGILE-24-10-01/') {
      const t = {}; for (const r of Object.keys(REGIONS)) t[`_${r}`] = { direct_debit_monthly: { code: `E-1R-AGILE-24-10-01-${r}` } };
      return send({ display_name: 'Agile Octopus', single_register_electricity_tariffs: t });
    }
    if (/standard-unit-rates/.test(url.pathname)) {
      rateCalls++;
      const from = Date.parse(url.searchParams.get('period_from')), to = Date.parse(url.searchParams.get('period_to'));
      const out = [];
      for (let t = from; t < to; t += 1800000) out.push({ valid_from: new Date(t).toISOString(), valid_to: new Date(t + 1800000).toISOString(), value_inc_vat: new Date(t).getUTCHours() < 6 ? 12 : 30 });
      return send({ next: null, results: out.reverse() });
    }
    res.statusCode = 404; res.end('{}');
  });
  return new Promise((r) => server.listen(0, () => r({ server, base: `http://localhost:${server.address().port}/v1`, calls: () => rateCalls })));
}

test('backfill fills missing days once, then makes no calls; build no longer writes calculator history', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'plunge-hist-'));
  const siteDir = join(tmp, 'site');
  // Never use the live data in site/data: it changes every day, so tests would drift.
  await cp(SITE, siteDir, { recursive: true, filter: (src) => !/[\\/]data([\\/]|$)/.test(src.slice(SITE.length)) });
  const dataDir = join(siteDir, 'data');
  // Start from an empty archive: the real one in site/data grows every day.
  await rm(join(dataDir, 'archive'), { recursive: true, force: true });
  await mkdir(join(dataDir, 'archive'), { recursive: true });
  const { server, base, calls } = await mockApi();
  try {
    const now = new Date('2026-10-13T10:00:00Z');
    const r1 = await backfill({ base, outDir: dataDir, now, from: '2026-10-01', log: () => {} });
    const files = (await readdir(join(dataDir, 'archive'))).filter((f) => f >= '2026-10-01' && f < '2026-10-13');
    assert.equal(files.length, 12, 'one archive file per day from 1 to 12 October');
    assert.ok(r1.written >= 11);
    const before = calls();
    const r2 = await backfill({ base, outDir: dataDir, now, from: '2026-10-01', log: () => {} });
    assert.equal(r2.written, 0);
    assert.equal(calls(), before, 'no API calls once the archive is complete');

    const outDir = join(tmp, 'out');
    await build({ siteDir, outDir, now, siteUrl: 'https://plungeradar.co.uk', log: () => {} });
    assert.ok(!existsSync(join(outDir, 'data', 'history')), 'no calculator history files');
    const london = await readFile(join(outDir, 'london', 'index.html'), 'utf8');
    assert.ok(!london.includes('Would Agile have saved you money'), 'calculator removed from region pages');
    const home = await readFile(join(outDir, 'index.html'), 'utf8');
    assert.ok(!home.includes('id="calc"') && home.includes('id="hero-answer"') && home.includes('id="cap-note"'));
    assert.ok(!home.includes('include 5% VAT'), 'VAT wording updated');
  } finally { server.close(); }
});
