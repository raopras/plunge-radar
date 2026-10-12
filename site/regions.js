// Region names, the places in them, and the "Which region am I in?" logic.
// Works in the browser (window.PlungeRegions) and in Node tests (globalThis.PlungeRegions).
(function (root) {
  'use strict';

  // The 14 electricity regions (distribution areas) Octopus prices by.
  // mpan = the first two digits of the MPAN on an electricity bill, which pins the region exactly.
  var REGIONS = {
    A: { name: 'Eastern England', places: 'Norfolk, Suffolk, Essex, Cambridgeshire, Hertfordshire', mpan: '10' },
    B: { name: 'East Midlands', places: 'Nottingham, Leicester, Derby, Northampton, Lincoln', mpan: '11' },
    C: { name: 'London', places: 'Greater London', mpan: '12' },
    D: { name: 'North Wales and Merseyside', places: 'Liverpool, Chester, Wirral, North Wales', mpan: '13' },
    E: { name: 'West Midlands', places: 'Birmingham, Coventry, Wolverhampton, Worcester, Hereford', mpan: '14' },
    F: { name: 'North East', places: 'Newcastle, Sunderland, Durham, Teesside', mpan: '15' },
    G: { name: 'North West', places: 'Manchester, Lancashire, Cumbria', mpan: '16' },
    H: { name: 'Southern', places: 'Hampshire, Oxfordshire, Berkshire, Wiltshire', mpan: '20' },
    J: { name: 'South East', places: 'Kent, Sussex, much of Surrey', mpan: '19' },
    K: { name: 'South Wales', places: 'Cardiff, Swansea, Newport', mpan: '21' },
    L: { name: 'South West', places: 'Bristol, Somerset, Devon, Cornwall', mpan: '22' },
    M: { name: 'Yorkshire', places: 'Leeds, Sheffield, York, Hull', mpan: '23' },
    N: { name: 'South Scotland', places: 'Glasgow, Edinburgh, the Borders', mpan: '18' },
    P: { name: 'North Scotland', places: 'Aberdeen, Dundee, Highlands and Islands', mpan: '17' },
  };

  // Postcode area -> likely regions, most likely first. Areas that straddle a
  // boundary list more than one; the exact answer comes from the full postcode
  // (via the Octopus API) or the MPAN on a bill.
  var AREAS = {
    AL: 'A', CB: 'A', CM: 'A', CO: 'A', IP: 'A', LU: 'A', NR: 'A', SG: 'A', SS: 'A', WD: 'A',
    PE: 'AB', MK: 'AH', EN: 'AC', RM: 'AC',
    DE: 'B', LE: 'B', LN: 'B', NG: 'B', NN: 'B',
    E: 'C', EC: 'C', N: 'C', NW: 'C', SE: 'C', SW: 'C', W: 'C', WC: 'C', HA: 'C',
    IG: 'CA', UB: 'CH', TW: 'CH', KT: 'CJH', SM: 'CJ', CR: 'CJ', BR: 'CJ',
    CH: 'D', CW: 'D', L: 'D', LL: 'D', SY: 'DE',
    B: 'E', DY: 'E', HR: 'E', TF: 'E', WR: 'E', WS: 'E', WV: 'E', CV: 'EB', ST: 'EB', GL: 'EL',
    DH: 'F', DL: 'F', NE: 'F', SR: 'F', TS: 'F',
    BB: 'G', BL: 'G', CA: 'G', FY: 'G', LA: 'G', M: 'G', OL: 'G', PR: 'G', WN: 'G', SK: 'GB', WA: 'GD',
    BH: 'H', OX: 'H', PO: 'H', RG: 'H', SL: 'H', SN: 'H', SO: 'H', SP: 'H', HP: 'HA', GU: 'HJ',
    BN: 'J', CT: 'J', ME: 'J', RH: 'J', TN: 'J', DA: 'JC',
    CF: 'K', NP: 'K', SA: 'K', LD: 'KD',
    BS: 'L', EX: 'L', PL: 'L', TA: 'L', TQ: 'L', TR: 'L', BA: 'LH', DT: 'LH',
    BD: 'M', HD: 'M', HG: 'M', HU: 'M', HX: 'M', LS: 'M', WF: 'M', YO: 'M', DN: 'MB', S: 'MB',
    DG: 'N', EH: 'N', FK: 'N', G: 'N', KA: 'N', KY: 'N', ML: 'N', TD: 'N', PA: 'NP',
    AB: 'P', DD: 'P', HS: 'P', IV: 'P', KW: 'P', PH: 'P', ZE: 'P',
  };
  var NOT_COVERED = {
    BT: 'Northern Ireland has its own electricity market, so Agile Octopus isn’t available there.',
    JE: 'Jersey isn’t covered by Octopus Energy’s GB tariffs.',
    GY: 'Guernsey isn’t covered by Octopus Energy’s GB tariffs.',
    IM: 'The Isle of Man isn’t covered by Octopus Energy’s GB tariffs.',
  };
  var MPAN_TO_REGION = {};
  Object.keys(REGIONS).forEach(function (k) { MPAN_TO_REGION[REGIONS[k].mpan] = k; });

  var FULL = /^([A-Z]{1,2})([0-9][A-Z0-9]?)([0-9][A-Z]{2})$/;
  var OUTWARD = /^([A-Z]{1,2})([0-9][A-Z0-9]?)$/;

  /**
   * Read what someone typed. Returns one of:
   *  {kind:'postcode', area, outward, full, display}  full UK postcode
   *  {kind:'outward', area, outward, display}          first half only, e.g. "CR8"
   *  {kind:'mpan', region}                             MPAN or its first two digits
   *  {kind:'error', message}
   */
  function parse(input) {
    var raw = String(input || '').trim();
    if (!raw) return { kind: 'error', message: 'Enter your postcode, for example CR8 2AB.' };

    var digits = raw.replace(/[\s-]/g, '');
    if (/^\d+$/.test(digits)) {
      var id = digits.length === 21 ? digits.slice(8, 10) : digits.length === 13 || digits.length === 2 ? digits.slice(0, 2) : null;
      if (!id) return { kind: 'error', message: 'An MPAN is 13 digits (or 21 with the top line). You can also enter just its first two digits.' };
      if (!MPAN_TO_REGION[id]) return { kind: 'error', message: 'The first two digits of an MPAN should be between 10 and 23. Please check your bill.' };
      return { kind: 'mpan', region: MPAN_TO_REGION[id] };
    }

    var s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    var m = s.match(FULL);
    if (m) return withArea({ kind: 'postcode', area: m[1], outward: m[1] + m[2], full: s, display: m[1] + m[2] + ' ' + m[3] });
    m = s.match(OUTWARD);
    if (m) return withArea({ kind: 'outward', area: m[1], outward: s, display: s });
    if (/^[A-Z]{1,2}$/.test(s)) return { kind: 'error', message: 'Add the numbers too, for example ' + s + '1 or the full postcode.' };
    return { kind: 'error', message: 'That doesn’t look like a UK postcode. Try something like CR8 2AB.' };
  }

  function withArea(p) {
    if (NOT_COVERED[p.area]) return { kind: 'error', message: NOT_COVERED[p.area] };
    if (!AREAS[p.area]) return { kind: 'error', message: 'We don’t recognise “' + p.area + '” as a UK postcode area. Please check it.' };
    p.candidates = AREAS[p.area].split('');
    return p;
  }

  /**
   * Find the region. Tries the Octopus API for an exact answer on a full postcode,
   * then falls back to the postcode area. Resolves:
   *  {status:'exact', region, source}  |  {status:'likely', region, display}
   *  {status:'choose', candidates, display}  |  {status:'error', message}
   */
  function lookup(input, opts) {
    opts = opts || {};
    var p = parse(input);
    if (p.kind === 'error') return Promise.resolve({ status: 'error', message: p.message });
    if (p.kind === 'mpan') return Promise.resolve({ status: 'exact', region: p.region, source: 'mpan' });

    var fallback = function () {
      return p.candidates.length === 1
        ? { status: 'likely', region: p.candidates[0], display: p.display }
        : { status: 'choose', candidates: p.candidates, display: p.display };
    };
    var fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch : null);
    if (p.kind !== 'postcode' || !fetchFn) return Promise.resolve(fallback());

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 5000) : null;
    var url = 'https://api.octopus.energy/v1/industry/grid-supply-points/?postcode=' + encodeURIComponent(p.full);
    return Promise.resolve()
      .then(function () { return fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined); })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (json) {
        var id = json && json.results && json.results[0] && json.results[0].group_id;
        var letter = id ? String(id).replace('_', '') : '';
        if (REGIONS[letter]) return { status: 'exact', region: letter, display: p.display, source: 'postcode' };
        if (json && Array.isArray(json.results) && json.results.length === 0) {
          return { status: 'error', message: 'Octopus doesn’t recognise ' + p.display + '. Please check the postcode and try again.' };
        }
        return fallback();
      })
      .catch(fallback)
      .then(function (r) { if (timer) clearTimeout(timer); return r; });
  }

  root.PlungeRegions = { REGIONS: REGIONS, AREAS: AREAS, parse: parse, lookup: lookup };
})(typeof window !== 'undefined' ? window : globalThis);
