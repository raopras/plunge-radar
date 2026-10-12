import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../site/regions.js';
import { REGIONS as BUILD_REGIONS } from '../scripts/lib.mjs';

const { parse, lookup, REGIONS, AREAS } = globalThis.PlungeRegions;

test('page and build script use the same region names', () => {
  for (const k of Object.keys(BUILD_REGIONS)) assert.equal(REGIONS[k].name, BUILD_REGIONS[k]);
  for (const v of Object.values(AREAS)) for (const r of v) assert.ok(REGIONS[r], `unknown region ${r}`);
});

test('postcode validation', () => {
  assert.equal(parse('cr8 2ab').display, 'CR8 2AB');
  assert.equal(parse('SW1A1AA').display, 'SW1A 1AA');
  assert.equal(parse('M1 1AE').area, 'M');
  assert.equal(parse('CR8').kind, 'outward');
  assert.equal(parse('').kind, 'error');
  assert.equal(parse('CR').kind, 'error');
  assert.equal(parse('hello').kind, 'error');
  assert.equal(parse('QQ1 1AA').kind, 'error'); // not a real area
  assert.match(parse('BT1 1AA').message, /Northern Ireland/);
});

test('MPAN input', () => {
  assert.deepEqual(parse('19'), { kind: 'mpan', region: 'J' });
  assert.deepEqual(parse('12 3456 7890 123'), { kind: 'mpan', region: 'C' });
  assert.deepEqual(parse('00 801 123 19 1234 5678 901'), { kind: 'mpan', region: 'J' }); // 21-digit, ID in digits 9-10
  assert.equal(parse('99').kind, 'error');
});

test('lookup: exact via API, fallback when offline, choices on borders', async () => {
  const ok = async () => ({ ok: true, json: async () => ({ count: 1, results: [{ group_id: '_J' }] }) });
  assert.deepEqual(await lookup('CR8 2AB', { fetch: ok }), { status: 'exact', region: 'J', display: 'CR8 2AB', source: 'postcode' });

  const offline = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await lookup('CR8 2AB', { fetch: offline }), { status: 'choose', candidates: ['C', 'J'], display: 'CR8 2AB' });
  assert.deepEqual(await lookup('LS1 4AP', { fetch: offline }), { status: 'likely', region: 'M', display: 'LS1 4AP' });

  const unknown = async () => ({ ok: true, json: async () => ({ count: 0, results: [] }) });
  assert.equal((await lookup('ZZ1 1ZZ', { fetch: unknown })).status, 'error');
  assert.equal((await lookup('LS1 4ZZ', { fetch: unknown })).status, 'error');
});
