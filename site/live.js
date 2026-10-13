// Self-healing prices. The site's price file is refreshed by a scheduled job, and
// scheduled jobs sometimes run late or not at all. When the stored file is missing
// today's or tomorrow's prices for the visitor's region, this fetches them straight
// from Octopus Energy's public API (it allows browser requests) and fills the gap.
//
// The maths mirrors scripts/lib.mjs exactly; test/live.test.mjs checks they agree.
(function (root) {
  'use strict';

  var SLOT = 30 * 60 * 1000;
  var API = 'https://api.octopus.energy/v1';

  function offsetMinutes(date) {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'longOffset' }).formatToParts(date);
    var tz = (parts.find(function (p) { return p.type === 'timeZoneName'; }) || {}).value || 'GMT';
    var m = tz.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
  }
  function dateString(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function midnightUTC(d) { var g = new Date(d + 'T00:00:00Z'); return new Date(g.getTime() - offsetMinutes(g) * 60000); }
  function expectedSlots(d) { return Math.round((midnightUTC(addDays(d, 1)).getTime() - midnightUTC(d).getTime()) / SLOT); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function slotPrices(records, d) {
    var start = midnightUTC(d).getTime();
    var n = expectedSlots(d);
    var prices = new Array(n).fill(null);
    records.forEach(function (r) {
      var from = new Date(r.valid_from).getTime();
      var to = r.valid_to ? new Date(r.valid_to).getTime() : from + SLOT;
      for (var t = from; t < to; t += SLOT) {
        var i = Math.round((t - start) / SLOT);
        if (i >= 0 && i < n && typeof r.value_inc_vat === 'number') prices[i] = round2(r.value_inc_vat);
      }
    });
    return prices;
  }
  function bestWindow(prices, width, mode) {
    var best = null;
    for (var i = 0; i + width <= prices.length; i++) {
      var run = prices.slice(i, i + width);
      if (run.some(function (p) { return p === null; })) continue;
      var avg = run.reduce(function (a, b) { return a + b; }, 0) / width;
      if (!best || (mode === 'min' ? avg < best.avg : avg > best.avg)) best = { start: i, end: i + width, avg: round2(avg) };
    }
    return best;
  }
  function negativeRuns(prices) {
    var runs = [], cur = null;
    prices.forEach(function (p, i) {
      if (p !== null && p < 0) {
        if (!cur) cur = { start: i, end: i + 1, min: p };
        else { cur.end = i + 1; cur.min = Math.min(cur.min, p); }
      } else if (cur) { runs.push(cur); cur = null; }
    });
    if (cur) runs.push(cur);
    return runs;
  }
  function summariseDay(prices) {
    var known = prices.filter(function (p) { return p !== null; });
    if (!known.length) return null;
    var min = Math.min.apply(null, known), max = Math.max.apply(null, known);
    return {
      count: known.length,
      avg: round2(known.reduce(function (a, b) { return a + b; }, 0) / known.length),
      min: min, minAt: prices.indexOf(min), max: max, maxAt: prices.indexOf(max),
      cheapest2h: bestWindow(prices, 4, 'min'), priciest2h: bestWindow(prices, 4, 'max'),
      negatives: negativeRuns(prices),
    };
  }

  /** True when the stored day has every half-hour Octopus will have published for it. */
  function published(day, k, d) {
    var p = day && day.regions && day.regions[k] && day.regions[k].prices;
    var n = expectedSlots(d);
    if (!Array.isArray(p) || p.length !== n) return false;
    var gap = p.indexOf(null);
    return gap === -1 || (gap >= n - 2 && p.slice(gap).every(function (x) { return x === null; }));
  }

  /**
   * What the page is missing for region k at time `now`: today's prices, and from 4pm
   * UK time, tomorrow's. Returns null when nothing is missing.
   */
  function missing(data, k, now) {
    var today = dateString(now), tomorrow = addDays(today, 1);
    var hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(now));
    var days = (data && data.days) || {};
    var need = [];
    if (!published(days[today], k, today)) need.push(today);
    if (hour >= 16 && !published(days[tomorrow], k, tomorrow)) need.push(tomorrow);
    return need.length ? { today: today, tomorrow: tomorrow, need: need } : null;
  }

  function tariffCode(data, k) {
    var days = (data && data.days) || {};
    var keys = Object.keys(days).sort().reverse();
    for (var i = 0; i < keys.length; i++) {
      var r = days[keys[i]].regions && days[keys[i]].regions[k];
      if (r && r.tariff) return r.tariff;
    }
    return data && data.product ? 'E-1R-' + data.product + '-' + k : null;
  }

  /** Merge API records for region k into the dataset. Pure: used by the tests too. */
  function merge(data, k, records, gap) {
    var out = JSON.parse(JSON.stringify(data || { days: {} }));
    out.days = out.days || {};
    var tariff = tariffCode(data, k);
    [gap.today, gap.tomorrow].forEach(function (d) {
      if (gap.need.indexOf(d) === -1) return;
      var prices = slotPrices(records, d);
      var summary = summariseDay(prices);
      if (!summary) return;
      var day = out.days[d] || { start: midnightUTC(d).toISOString(), slots: expectedSlots(d), regions: {} };
      day.regions = day.regions || {};
      day.regions[k] = { tariff: tariff, prices: prices, summary: summary };
      out.days[d] = day;
      out.liveAt = new Date().toISOString();
    });
    return out;
  }

  /** Fill any gap for region k from the API. Never throws: on any failure it returns the data unchanged. */
  function topUp(data, k, now, fetchImpl) {
    now = now || new Date();
    var f = fetchImpl || (typeof fetch === 'function' ? fetch.bind(root) : null);
    var gap = missing(data, k, now);
    if (!gap || !f || !data || !data.product) return Promise.resolve(data);
    var tariff = tariffCode(data, k);
    var from = midnightUTC(gap.today).toISOString().slice(0, 16) + 'Z';
    var to = midnightUTC(addDays(gap.tomorrow, 1)).toISOString().slice(0, 16) + 'Z';
    var url = API + '/products/' + encodeURIComponent(data.product) + '/electricity-tariffs/' + encodeURIComponent(tariff)
      + '/standard-unit-rates/?period_from=' + from + '&period_to=' + to + '&page_size=250';
    var timer = null;
    var timeout = new Promise(function (resolve) { timer = setTimeout(function () { resolve(null); }, 8000); });
    return Promise.race([
      f(url).then(function (r) { return r.ok ? r.json() : null; }),
      timeout,
    ]).then(function (j) {
      clearTimeout(timer);
      if (!j || !Array.isArray(j.results) || !j.results.length) return data;
      return merge(data, k, j.results, gap);
    }).catch(function () { clearTimeout(timer); return data; });
  }

  var api = { topUp: topUp, missing: missing, merge: merge, slotPrices: slotPrices, summariseDay: summariseDay, expectedSlots: expectedSlots, midnightUTC: midnightUTC };
  root.PlungeLive = api;
})(typeof window !== 'undefined' ? window : globalThis);
