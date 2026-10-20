// The tariff finder must give Octopus Energy's own picks ("Which smart tariff should I
// choose?", octopus.energy/blog/which-smart-tariff/, updated 20 Oct 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../site/finder-rules.js';

const { recommend, TARIFFS } = globalThis.PlungeFinder;
const base = { ev: 'none', heat: 'gas', solar: 'none', home: 'some', shift: 'some', price: 'either', meter: 'smart' };
const pick = (a) => recommend({ ...base, ...a });

test("Octopus Energy's table: one piece of tech", () => {
  assert.equal(pick({ ev: 'compatible' }).main, 'intelligent-octopus-go');
  assert.equal(pick({ heat: 'heatpump' }).main, 'cosy-octopus');
  assert.equal(pick({ heat: 'electric' }).main, 'cosy-octopus', 'Cosy also covers electric boilers and electric radiators');
  const solar = pick({ solar: 'panels' });
  assert.equal(solar.exportTariff, 'outgoing-octopus', 'solar panels → Outgoing Octopus');
});

test("Octopus Energy's table: combinations", () => {
  assert.equal(pick({ solar: 'battery' }).main, 'octopus-flux');
  assert.equal(pick({ solar: 'battery', heat: 'heatpump' }).main, 'octopus-flux');
  assert.equal(pick({ ev: 'compatible', heat: 'heatpump' }).main, 'intelligent-octopus-go');
  for (const heat of ['gas', 'heatpump']) {
    const r = pick({ ev: 'compatible', solar: 'battery', heat });
    assert.equal(r.main, 'intelligent-octopus-go');
    assert.equal(r.exportTariff, 'outgoing-octopus');
    assert.match(r.addOn, /Charge Pack/);
  }
});

test('no smart tech: Agile Octopus or Octopus Tracker, by how much you can shift', () => {
  assert.equal(pick({ shift: 'lot', home: 'allday' }).main, 'agile-octopus');
  assert.equal(pick({ shift: 'some' }).main, 'octopus-tracker');
  assert.equal(pick({ shift: 'lot', home: 'out' }).main, 'octopus-tracker');
  assert.ok(pick({ shift: 'lot', home: 'allday' }).alt.includes('octopus-tracker'));
});

test("electric car that isn't compatible → Octopus Go, the next best option", () => {
  assert.equal(pick({ ev: 'incompatible' }).main, 'octopus-go');
  assert.ok(pick({ ev: 'incompatible', heat: 'heatpump' }).alt.includes('cosy-octopus'));
  assert.ok(pick({ ev: 'incompatible', solar: 'battery' }).alt.includes('octopus-flux'));
  const unsure = pick({ ev: 'unsure' });
  assert.equal(unsure.main, 'intelligent-octopus-go');
  assert.ok(unsure.alt.includes('octopus-go'));
});

test('storage heaters → Snug Octopus, with a fallback because not every meter works', () => {
  const r = pick({ heat: 'storage' });
  assert.equal(r.main, 'snug-octopus');
  assert.equal(r.alt.length, 1);
});

test('standard tariffs for certainty, no smart meter or little flexibility', () => {
  assert.equal(pick({ price: 'certain' }).main, 'fixed-octopus');
  assert.equal(pick({ meter: 'none', shift: 'lot', home: 'allday' }).main, 'flexible-octopus');
  assert.equal(pick({ shift: 'little' }).main, 'flexible-octopus');
});

test('smart tariffs flag the smart meter; Agile carries the winter warning', () => {
  assert.equal(pick({ heat: 'heatpump', meter: 'none' }).needsMeter, true);
  assert.equal(pick({ heat: 'heatpump' }).needsMeter, false);
  assert.equal(pick({ shift: 'little', meter: 'none' }).needsMeter, false);
  assert.ok(pick({ shift: 'lot', home: 'allday' }).notes.some((n) => /winter/.test(n)));
});

test('every combination of answers gives a known tariff, at most 2 alternatives, never itself', () => {
  const opts = { ev: ['compatible', 'unsure', 'incompatible', 'none'], heat: ['heatpump', 'electric', 'storage', 'gas', 'other'], solar: ['none', 'panels', 'battery'], home: ['allday', 'some', 'out'], shift: ['lot', 'some', 'little'], price: ['certain', 'market', 'either'], meter: ['smart', 'none', 'unsure'] };
  let n = 0;
  const walk = (keys, a) => {
    if (!keys.length) {
      const r = recommend(a); n++;
      assert.ok(TARIFFS[r.main], JSON.stringify(a));
      assert.ok(r.alt.length <= 2 && !r.alt.includes(r.main) && r.alt.every((x) => TARIFFS[x]));
      assert.ok(r.why.length >= 1);
      if (r.exportTariff) assert.equal(TARIFFS[r.exportTariff].export, true);
      return;
    }
    const [k, ...rest] = keys;
    for (const v of opts[k]) walk(rest, { ...a, [k]: v });
  };
  walk(Object.keys(opts), {});
  assert.equal(n, 4 * 5 * 3 * 3 * 3 * 3 * 3);
});

test('tariff names are written the way Octopus Energy writes them', () => {
  const text = JSON.stringify(TARIFFS) + JSON.stringify(recommend({ ...base, shift: 'lot', home: 'allday' }));
  assert.doesNotMatch(text, /Octopus Agile|Octopus Intelligent Go|Tracker Octopus|Octopus Flexible|Octopus Cosy|Octopus Snug/);
});
