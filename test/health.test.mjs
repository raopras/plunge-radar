import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../scripts/health-check.mjs';
import { REGIONS, expectedSlots } from '../scripts/lib.mjs';

const REF = 'https://share.octopus.energy/silk-snail-210';
const day = (d) => ({ regions: Object.fromEntries(Object.keys(REGIONS).map((k) => [k, { prices: new Array(expectedSlots(d)).fill(10) }])) });

function site({ latestDays, tariffsAge = 2, trackerDate = '2026-10-14', brokenPage = null }) {
  const now = new Date('2026-10-13T20:30:00Z'); // 9:30pm UK time
  return async (url) => {
    const path = new URL(url).pathname;
    if (path === brokenPage) return { ok: false, status: 404 };
    if (path === '/data/latest.json') return { ok: true, json: async () => ({ days: latestDays }) };
    if (path === '/data/tariffs.json') return { ok: true, json: async () => ({
      generatedAt: new Date(now - tariffsAge * 36e5).toISOString(),
      regions: { C: { agile: {}, go: {}, flexible: {}, tracker: { rates: [{ d: trackerDate, p: 20 }] } } } }) };
    return { ok: true, text: async () => `<a href="${REF}">Join</a>` };
  };
}
const NOW = new Date('2026-10-13T20:30:00Z');

test('a healthy site passes', async () => {
  const problems = await check({ now: NOW, fetchImpl: site({ latestDays: { '2026-10-13': day('2026-10-13'), '2026-10-14': day('2026-10-14') } }) });
  assert.deepEqual(problems, []);
});

test('stale prices, old tariff data, a dead page and a stuck Tracker code are all reported', async () => {
  const problems = await check({ now: NOW, fetchImpl: site({ latestDays: { '2026-10-12': day('2026-10-12') }, tariffsAge: 50, trackerDate: '2026-10-01', brokenPage: '/octopus-tariffs/' }) });
  const text = problems.join(' | ');
  assert.match(text, /today \(2026-10-13\)/);
  assert.match(text, /tomorrow \(2026-10-14\)/);
  assert.match(text, /50 hours old/);
  assert.match(text, /Tracker prices stop at 2026-10-01/);
  assert.match(text, /\/octopus-tariffs\/ returned HTTP 404/);
});
