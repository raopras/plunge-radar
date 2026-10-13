(function () {
  'use strict';

  var CFG = window.PLUNGE_CONFIG || {};
  // Region landing pages set PLUNGE_PAGE = { region, base: '../' }; the home page doesn't.
  var PAGE = window.PLUNGE_PAGE || {};
  var BASE = PAGE.base || '';
  var PR = window.PlungeRegions || { REGIONS: {}, lookup: null };
  var SLOT = 30 * 60 * 1000;
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  var fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });
  var fmtShortDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });
  var fmtStamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  var fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

  function store(key, value) {
    try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (e) { return null; }
  }
  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }
  function pence(p, dp) {
    if (p === null || p === undefined) return '–';
    var s = Math.abs(p).toFixed(dp === undefined ? 1 : dp) + 'p';
    return p < 0 ? '−' + s : s;
  }
  function slotStart(day, i) { return new Date(Date.parse(day.start) + i * SLOT); }
  function range(day, a, b) { return fmtTime.format(slotStart(day, a)) + '–' + fmtTime.format(slotStart(day, b)); }
  function regionName(k) { return (PR.REGIONS[k] && PR.REGIONS[k].name) || (state.data && state.data.regions[k]) || k; }

  var state = { data: null, region: null, which: 'today' };
  var dates = {};

  function setStatus(msg) { var el = $('status'); el.textContent = msg || ''; el.hidden = !msg; }

  // ---- Analytics (Umami: anonymous, no cookies) ---------------------------
  // Off unless config.js has an umamiWebsiteId. Events queue until the script loads.
  var queue = [];
  function track(name, data) {
    if (!CFG.umamiWebsiteId) return;
    if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data);
    else queue.push([name, data]);
  }
  function setupAnalytics() {
    if (!/^[0-9a-f-]{36}$/i.test(CFG.umamiWebsiteId || '')) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://cloud.umami.is/script.js';
    s.setAttribute('data-website-id', CFG.umamiWebsiteId);
    s.setAttribute('data-domains', 'plungeradar.co.uk,www.plungeradar.co.uk');
    s.onload = function () { queue.splice(0).forEach(function (e) { track(e[0], e[1]); }); };
    document.head.appendChild(s);
    var note = $('analytics-note');
    if (note) note.hidden = false;

    // Every referral button: which one, on which page, for which region.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.ref-link');
      if (!a) return;
      track('referral-click', { button: a.getAttribute('data-cta') || 'other', region: state.region || '', page: PAGE.region ? 'region' : 'home' });
    });
  }

  // ---- Referral links ----------------------------------------------------

  function setupReferral() {
    var reward = CFG.referralReward || '£50';
    all('.reward').forEach(function (el) { el.textContent = reward; });
    var ok = /^https:\/\/share\.octopus\.energy\/[\w-]+\/?$/.test(CFG.referralUrl || '');
    all('.ref-link').forEach(function (a) { a.href = ok ? CFG.referralUrl : '#'; });
    all('.ref-only').forEach(function (el) { if (!ok) el.hidden = true; });
    if (!ok && CFG.referralUrl) console.warn('Plunge Radar: referralUrl in config.js should look like https://share.octopus.energy/your-code');
    return ok;
  }

  // Sticky bar on phones: shows once the hero button has scrolled away,
  // hides while the main switch section is on screen or after it's dismissed.
  function setupStickyBar(enabled) {
    var bar = $('stickybar');
    if (!bar || !enabled) return;
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('plunge-bar') === 'off'; } catch (e) { /* ignore */ }
    if (dismissed || typeof IntersectionObserver !== 'function') return;
    // Hide the bar whenever another switch button is already on screen.
    var targets = [$('hero-cta'), $('switch'), document.querySelector('.plunge-actions')].filter(Boolean);
    var seen = targets.map(function (t, i) { return i === 0; });
    var update = function () {
      var show = !dismissed && !seen.some(Boolean);
      bar.hidden = !show;
      document.body.classList.toggle('has-bar', show);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[targets.indexOf(e.target)] = e.isIntersecting; });
      update();
    });
    targets.forEach(function (t) { io.observe(t); });
    $('sb-close').addEventListener('click', function () {
      dismissed = true;
      try { sessionStorage.setItem('plunge-bar', 'off'); } catch (e) { /* ignore */ }
      update();
    });
  }

  // ---- Region picker and postcode checker -------------------------------

  function setRegion(k, remember) {
    if (!state.data || !state.data.regions[k]) return;
    state.region = k;
    $('region').value = k;
    var info = PR.REGIONS[k];
    var hint = $('region-places');
    hint.textContent = info && info.places ? 'Covers ' + info.places + '. ' : '';
    if (!PAGE.region && info && info.slug) {
      var a = document.createElement('a');
      a.href = BASE + info.slug + '/';
      a.textContent = 'See the ' + info.name + ' page →';
      hint.appendChild(a);
    }
    if (remember) store('plunge-region', k);
    render();
  }

  // On a region page, choosing a different region opens that region's page.
  function goRegion(k) {
    var info = PR.REGIONS[k];
    if (PAGE.region && k !== PAGE.region && info && info.slug) {
      location.href = BASE + info.slug + '/';
      return true;
    }
    setRegion(k, true);
    return false;
  }

  function pcMessage(kind, nodes) {
    var box = $('pc-msg');
    box.className = 'pc-msg ' + kind;
    box.innerHTML = '';
    nodes.forEach(function (n) { box.appendChild(typeof n === 'string' ? document.createTextNode(n) : n); });
    box.hidden = false;
    $('pc').setAttribute('aria-invalid', String(kind === 'err'));
  }
  function para(parts) {
    var p = document.createElement('div');
    parts.forEach(function (x) {
      if (typeof x === 'string') p.appendChild(document.createTextNode(x));
      else { var b = document.createElement('b'); b.textContent = x.b; p.appendChild(b); }
    });
    return p;
  }

  function setupPostcode() {
    var form = $('pc-form'), input = $('pc'), btn = $('pc-btn');
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') { input.removeAttribute('aria-invalid'); $('pc-msg').hidden = true; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (typeof PR.lookup !== 'function') return;
      btn.disabled = true; btn.textContent = 'Checking…';
      PR.lookup(input.value).then(function (r) {
        track('postcode-check', { result: r.status, region: r.region || '' });
        btn.disabled = false; btn.textContent = 'Check';
        if (r.status === 'error') { pcMessage('err', [r.message]); input.focus(); return; }
        if (r.status === 'exact') {
          var where = r.source === 'mpan' ? 'Your MPAN shows you’re in ' : r.display + ' is in ';
          pcMessage('ok', [para([where, { b: regionName(r.region) }, ' (region ' + r.region + '). Showing its prices below.'])]);
          goRegion(r.region);
          return;
        }
        if (r.status === 'likely') {
          pcMessage('ok', [para([r.display + ' is in ', { b: regionName(r.region) }, ' (region ' + r.region + '), based on the postcode area. Showing its prices below.'])]);
          goRegion(r.region);
          return;
        }
        // On a boundary: let them pick, and say how to get an exact answer.
        var names = r.candidates.map(regionName);
        var choices = document.createElement('div');
        choices.className = 'choices';
        r.candidates.forEach(function (k) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = regionName(k);
          b.addEventListener('click', function () {
            if (goRegion(k)) return;
            pcMessage('ok', [para(['Showing prices for ', { b: regionName(k) }, ' (region ' + k + ').'])]);
          });
          choices.appendChild(b);
        });
        var isFull = /\s/.test(r.display);
        var area = r.display.split(' ')[0];
        pcMessage('warn', [
          para([(isFull ? 'We couldn’t confirm the exact region online. ' : '') + area + ' covers parts of '
            + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + '. Pick one, or '
            + (isFull ? 'enter the MPAN from your electricity bill' : 'enter your full postcode or the MPAN from your bill') + ' for an exact answer.']),
          choices,
        ]);
        if (!PAGE.region) setRegion(r.candidates[0], false);
      });
    });
  }

  // ---- Init ---------------------------------------------------------------

  function init(data) {
    state.data = data;
    var today = fmtDate.format(new Date());
    dates = { today: today, tomorrow: addDays(today, 1) };

    var sel = $('region');
    Object.keys(data.regions).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = regionName(k);
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { $('pc-msg').hidden = true; goRegion(sel.value); });

    var hasTomorrow = !!data.days[dates.tomorrow];
    $('day-tomorrow').disabled = !hasTomorrow;
    $('day-tomorrow').title = hasTomorrow ? '' : "Octopus Energy publishes tomorrow's prices between 4pm and 8pm, usually nearer 4pm";
    var hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    state.which = hasTomorrow && hour >= 16 ? 'tomorrow' : 'today';
    ['today', 'tomorrow'].forEach(function (w) {
      $('day-' + w).addEventListener('click', function () { state.which = w; render(); });
    });

    $('updated').textContent = 'Last updated ' + fmtStamp.format(new Date(data.generatedAt)) + '.';
    $('live-text').textContent = hasTomorrow ? 'Tomorrow’s prices are in' : 'Updated ' + fmtStamp.format(new Date(data.generatedAt));

    var saved = store('plunge-region');
    if (PAGE.region && data.regions[PAGE.region]) setRegion(PAGE.region, true);
    else setRegion(data.regions[saved] ? saved : (data.regions[CFG.defaultRegion] ? CFG.defaultRegion : 'C'), false);
  }

  // ---- Render -------------------------------------------------------------

  function render() {
    var data = state.data;
    if (!data) return;
    var day = data.days[dates[state.which]];
    ['today', 'tomorrow'].forEach(function (w) { $('day-' + w).setAttribute('aria-pressed', String(w === state.which)); });

    var ageHours = (Date.now() - Date.parse(data.generatedAt)) / 36e5;
    if (!day) {
      setStatus(state.which === 'tomorrow'
        ? "Tomorrow's prices aren't out yet. Octopus Energy publishes them between 4pm and 8pm, usually nearer 4pm; this page updates shortly after."
        : "Today's prices haven't loaded yet. The page updates itself every afternoon, so please check back soon.");
      clearAll();
      return;
    }
    var region = day.regions[state.region];
    var s = region && region.summary;
    if (!s) { setStatus('No prices for this area yet. Please check back soon.'); clearAll(); return; }
    setStatus(ageHours > 36 ? 'These prices may be out of date: the last update was ' + Math.round(ageHours) + ' hours ago.' : '');

    var label = fmtDay.format(slotStart(day, 0));
    var area = regionName(state.region);
    $('daylabel').textContent = area + ' · ' + fmtShortDay.format(slotStart(day, 0));
    $('results-h').textContent = 'Cheapest times to use electricity in ' + area + ' ' + (state.which === 'tomorrow' ? 'tomorrow' : 'today');

    renderPlunge(day, region.prices, s, area);

    $('best-time').textContent = s.cheapest2h ? range(day, s.cheapest2h.start, s.cheapest2h.end) : '–';
    $('best-price').textContent = s.cheapest2h ? 'averages ' + pence(s.cheapest2h.avg) + ' per kWh. ' + windowAdvice(day, s.cheapest2h) : '';
    $('worst-time').textContent = s.priciest2h ? range(day, s.priciest2h.start, s.priciest2h.end) : '–';
    $('worst-price').textContent = s.priciest2h ? 'averages ' + pence(s.priciest2h.avg) + ' per kWh. Avoid big appliances if you can.' : '';
    $('avg').textContent = pence(s.avg);
    $('min').textContent = pence(s.min) + ' at ' + fmtTime.format(slotStart(day, s.minAt));
    $('max').textContent = pence(s.max) + ' at ' + fmtTime.format(slotStart(day, s.maxAt));
    $('chart-caption').textContent = area + ', ' + label + ': price for each half-hour, pence per kWh including any VAT due'
      + (s.count < day.slots ? '. The last ' + (day.slots - s.count) + ' half-hours arrive with the next day\u2019s prices.' : '');
    renderCap(s, area);
    renderHero(day, s, area);
    renderCalc(area);

    var tags = tagsFor(day, region.prices, s);
    drawChart(day, region.prices, tags);
    drawStrip(region.prices);
    fillTable(day, region.prices, tags);
  }

  // ---- Price cap, hero answer and savings calculator ----------------------

  var CAP = CFG.priceCap || null;
  function capActive() {
    if (!CAP || typeof CAP.unitRate !== 'number') return false;
    var d = fmtDate.format(new Date());
    return d >= CAP.from && d <= CAP.to;
  }

  // Advice for the cheapest window that matches when it is.
  function windowAdvice(day, w) {
    var start = slotStart(day, w.start).getTime(), end = slotStart(day, w.end).getTime(), now = Date.now();
    if (now >= end) return 'That window has passed; check tomorrow’s prices after 4pm.';
    if (now >= start) return 'Run the washing machine, dishwasher or car charger now.';
    return 'Plan the washing machine, dishwasher or car charger for then.';
  }

  function renderCap(s, area) {
    var on = capActive();
    $('cap-fact').hidden = !on; $('cap-legend').hidden = !on; $('cap-note').hidden = !on;
    if (!on) return;
    $('cap').textContent = pence(CAP.unitRate);
    var diff = s.avg - CAP.unitRate;
    var when = state.which === 'tomorrow' ? 'Tomorrow’s' : 'Today’s';
    $('cap-note').textContent = when + ' Agile average in ' + area + ' is ' + pence(Math.abs(diff)) + (diff <= 0 ? ' below' : ' above')
      + ' the price cap rate of ' + pence(CAP.unitRate) + ' (GB average, ' + CAP.label + '). '
      + (s.cheapest2h ? 'The cheapest 2 hours are ' + Math.round((1 - s.cheapest2h.avg / CAP.unitRate) * 100) + '% below the cap.' : '');
  }

  function renderHero(day, s, area) {
    var el = $('hero-answer');
    if (!s.cheapest2h) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = '';
    var lead = document.createElement('span'); lead.className = 'ha-k';
    lead.textContent = (state.which === 'tomorrow' ? 'Tomorrow' : 'Today') + ' in ' + area + ', the cheapest 2 hours are';
    var main = document.createElement('b');
    main.textContent = range(day, s.cheapest2h.start, s.cheapest2h.end) + ' at ' + pence(s.cheapest2h.avg);
    el.appendChild(lead); el.appendChild(main);
    if (capActive()) {
      var cap = document.createElement('span'); cap.className = 'ha-s';
      cap.textContent = 'Price cap: ' + pence(CAP.unitRate);
      el.appendChild(cap);
    }
  }

  // A typical household's day (relative use per hour, UK time): low overnight,
  // a morning bump and an evening peak. Used only for the estimate.
  var PROFILE = [0.55,0.5,0.45,0.45,0.45,0.5,0.8,1.2,1.3,1.05,1,1,1.05,1,0.95,0.95,1.2,1.7,1.85,1.75,1.5,1.3,1.05,0.75];
  var history = {};

  function estimate(days, kwhYear, shift) {
    var agile = 0, capCost = 0, kwhTotal = 0;
    days.forEach(function (d) {
      var p = d.p, n = p.length, perDay = kwhYear / 365;
      var w = p.map(function (_, i) { return PROFILE[Math.min(23, Math.floor(i * 24 / n))]; });
      var sum = w.reduce(function (a, b) { return a + b; }, 0);
      var use = w.map(function (x) { return perDay * (1 - shift) * x / sum; });
      // Move the flexible share into the day's 8 cheapest half-hours.
      var order = p.map(function (v, i) { return i; }).sort(function (a, b) { return p[a] - p[b]; }).slice(0, 8);
      order.forEach(function (i) { use[i] += perDay * shift / 8; });
      use.forEach(function (k, i) { agile += k * p[i]; });
      capCost += perDay * CAP.unitRate;
      kwhTotal += perDay;
    });
    return { agile: agile, cap: capCost, rate: agile / kwhTotal, days: days.length };
  }

  function gbp(pence) { return '£' + Math.round(Math.abs(pence) / 100).toLocaleString('en-GB'); }

  function renderCalc(area) {
    var box = $('calc');
    if (!capActive()) { box.hidden = true; return; }
    all('.calc-area').forEach(function (e) { e.textContent = area; });
    all('.calc-since').forEach(function (e) { e.textContent = fmtDay.format(new Date(CAP.from + 'T12:00:00Z')); });
    var k = state.region;
    function show() {
      var h = history[k];
      if (!h || !h.days.length) { box.hidden = true; return; }
      box.hidden = false;
      var kwh = Math.min(20000, Math.max(500, Math.round(Number($('calc-kwh').value) || 2700)));
      if (String(kwh) !== $('calc-kwh').value) $('calc-kwh').value = kwh;
      var shift = Number($('calc-shift').value) || 0;
      var r = estimate(h.days, kwh, shift);
      var perYear = (r.cap - r.agile) / r.days * 365;
      var out = $('calc-out'); out.textContent = '';
      var big = document.createElement('p'); big.className = 'calc-big ' + (perYear >= 0 ? 'save' : 'cost');
      big.textContent = perYear >= 0 ? 'About ' + gbp(perYear) + ' a year cheaper on Agile' : 'About ' + gbp(perYear) + ' a year dearer on Agile';
      var detail = document.createElement('p'); detail.className = 'calc-detail';
      detail.textContent = 'Over the last ' + r.days + ' day' + (r.days === 1 ? '' : 's') + ' in ' + area + ', you would have paid an average of '
        + pence(r.rate) + ' per kWh on Agile, against the price cap rate of ' + pence(CAP.unitRate) + '.'
        + (r.days < 14 ? ' That’s only a short stretch so far, so treat it as a rough early guide.' : '');
      out.appendChild(big); out.appendChild(detail);
      $('calc-fine').textContent = 'Estimate only. It assumes a typical household’s daily pattern, moves the share you choose into each day’s cheapest four hours, and compares unit costs only: standing charges are left out. Winter prices are usually higher, and past prices don’t predict future ones. Price cap: Ofgem GB average for ' + CAP.label + '.';
      box.dataset.result = perYear >= 0 ? 'save' : 'cost';
    }
    if (history[k]) { show(); return; }
    fetch(BASE + 'data/history/' + k + '.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { history[k] = j; if (state.region === k) show(); } })
      .catch(function () { box.hidden = true; });
    if (!renderCalc.bound) {
      renderCalc.bound = true;
      var changed = function () {
        renderCalc(regionName(state.region));
        track('calc-estimate', { region: state.region, shift: $('calc-shift').value, result: $('calc').dataset.result || '' });
      };
      $('calc-kwh').addEventListener('change', changed);
      $('calc-shift').addEventListener('change', changed);
    }
  }

  // Money in pence -> "87p" or "£1.23".
  function money(p) { return p >= 100 ? '£' + (p / 100).toFixed(2) : Math.round(p) + 'p'; }

  // The plunge alert says whether it's coming up, happening now or over,
  // shows what it's worth in real terms, and is honest that switching takes time.
  function renderPlunge(day, prices, s, area) {
    var box = $('plunge');
    if (!s.negatives.length) { box.hidden = true; return; }

    var now = Date.now();
    var startMs = function (i) { return slotStart(day, i).getTime(); };
    var runs = s.negatives;
    var live = runs.filter(function (r) { return startMs(r.start) <= now && now < startMs(r.end); })[0];
    var upcoming = runs.filter(function (r) { return startMs(r.start) > now; });
    var phase = live ? 'live' : upcoming.length ? 'next' : 'past';

    var times = joinList(runs.map(function (r) { return range(day, r.start, r.end); }));
    var lowest = Math.min.apply(null, runs.map(function (r) { return r.min; }));
    var isTomorrow = state.which === 'tomorrow';

    // What a 7 kW EV charger would be paid across the negative half-hours still to come
    // (or all of them, for a plunge that's over): 3.5 kWh per half-hour.
    var slotsToCount = [];
    runs.forEach(function (r) {
      for (var i = r.start; i < r.end; i++) if (phase === 'past' || startMs(i) + SLOT > now) slotsToCount.push(i);
    });
    var evEarn = slotsToCount.reduce(function (sum, i) { return sum + 3.5 * -prices[i]; }, 0);

    var when = $('plunge-when'), head, text;
    when.className = 'plunge-when ' + phase;
    if (phase === 'live') {
      when.textContent = 'Happening now';
      head = 'Electricity is below zero right now, until ' + fmtTime.format(slotStart(day, live.end)) + '.';
    } else if (phase === 'next') {
      when.textContent = isTomorrow ? 'Tomorrow' : 'Later today';
      head = 'Get paid to use electricity ' + (isTomorrow ? 'tomorrow' : 'today') + ', ' + times + '.';
    } else {
      when.textContent = 'Earlier today';
      head = 'Electricity went below zero earlier today, ' + times + '.';
    }

    text = 'Prices in ' + area + (phase === 'past' ? ' dropped' : ' drop') + ' as low as ' + pence(lowest, 2) + ' per kWh. Agile customers are paid for every unit they use, '
      + (phase === 'past' ? 'so it was' : 'so it’s') + ' the time to charge an EV, run the washing machine and dishwasher, or heat water.';
    if (evEarn >= 50) {
      text += phase === 'past'
        ? ' A 7 kW car charger running through it would have been paid about ' + money(evEarn) + '.'
        : ' A 7 kW car charger running through ' + (phase === 'live' ? 'the rest of it' : 'it') + ' would be paid about ' + money(evEarn) + '.';
    }
    $('plunge-h').textContent = head;
    $('plunge-text').textContent = text;
    $('plunge-cta-lead').textContent = phase === 'past' ? 'Missed this one?' : 'Not on Agile yet?';
    box.hidden = false;
  }

  function joinList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  function tagsFor(day, prices, s) {
    var nowIdx = state.which === 'today' ? Math.floor((Date.now() - Date.parse(day.start)) / SLOT) : -1;
    return prices.map(function (p, i) {
      var t = { kind: 'bar', now: i === nowIdx };
      if (p !== null && p < 0) t.kind = 'plunge';
      else if (s.cheapest2h && i >= s.cheapest2h.start && i < s.cheapest2h.end) t.kind = 'cheap';
      else if (s.priciest2h && i >= s.priciest2h.start && i < s.priciest2h.end) t.kind = 'peak';
      return t;
    });
  }

  function clearAll() {
    $('plunge').hidden = true;
    ['best-time', 'worst-time', 'avg', 'min', 'max'].forEach(function (id) { $(id).textContent = '–'; });
    ['best-price', 'worst-price', 'daylabel'].forEach(function (id) { $(id).textContent = ''; });
    $('chart').innerHTML = ''; $('rows').innerHTML = ''; $('strip').innerHTML = '';
  }

  // ---- Charts -------------------------------------------------------------

  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceStep(span) {
    var raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  }
  function roundedBar(x, w, y0, y1) {
    var top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0)), rx = Math.min(4, w / 2, h / 2);
    // Round only the data end; keep the baseline end square.
    return y1 <= y0
      ? 'M' + x + ',' + (top + h) + 'V' + (top + rx) + 'Q' + x + ',' + top + ' ' + (x + rx) + ',' + top + 'H' + (x + w - rx) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + rx) + 'V' + (top + h) + 'Z'
      : 'M' + x + ',' + top + 'V' + (top + h - rx) + 'Q' + x + ',' + (top + h) + ' ' + (x + rx) + ',' + (top + h) + 'H' + (x + w - rx) + 'Q' + (x + w) + ',' + (top + h) + ' ' + (x + w) + ',' + (top + h - rx) + 'V' + top + 'Z';
  }

  // The hero's thin price strip: the day's shape at a glance, plunges in bright green.
  function drawStrip(prices) {
    var svg = $('strip');
    svg.innerHTML = '';
    var known = prices.filter(function (p) { return p !== null; });
    if (!known.length) return;
    var W = 480, H = 44, n = prices.length, w = W / n;
    var lo = Math.min(0, Math.min.apply(null, known)), hi = Math.max(1, Math.max.apply(null, known));
    var y = function (v) { return 4 + (hi - v) / (hi - lo) * (H - 8); };
    prices.forEach(function (p, i) {
      if (p === null) return;
      var y0 = y(0), y1 = y(p);
      el('rect', { x: i * w + 0.6, width: Math.max(0.8, w - 1.2), y: Math.min(y0, y1), height: Math.max(1, Math.abs(y1 - y0)),
        fill: p < 0 ? 'var(--plunge-bright)' : 'var(--hero-bar)' }, svg);
    });
  }

  function drawChart(day, prices, tags) {
    var svg = $('chart');
    svg.innerHTML = '';
    // Draw at the chart's real pixel width so text stays 11px on phones.
    var W = Math.max(300, Math.min(900, Math.round(svg.parentNode.clientWidth) || 720));
    var H = W < 500 ? 220 : 260, L = 40, R = 8, T = 12, B = 26;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var known = prices.filter(function (p) { return p !== null; });
    var capOn = capActive();
    var lo = Math.min(0, Math.min.apply(null, known)), hi = Math.max(0, Math.max.apply(null, known), capOn ? CAP.unitRate : 0);
    var step = niceStep(hi - lo || 10);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    if (hi === lo) hi = lo + step;
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var n = prices.length, slotW = (W - L - R) / n, gap = Math.min(2, slotW * 0.25);

    for (var v = lo; v <= hi + 1e-9; v += step) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: Math.abs(v) < 1e-9 ? 'zero' : 'grid' }, svg);
      var t = el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg);
      t.textContent = (v < -1e-9 ? '−' : '') + Math.abs(Math.round(v * 10) / 10) + 'p';
    }
    var every = W < 500 ? /^(00|06|12|18):00$/ : /^(00|03|06|09|12|15|18|21):00$/;
    for (var i = 0; i < n; i++) {
      var hhmm = fmtTime.format(slotStart(day, i));
      if (every.test(hhmm)) {
        var tx = el('text', { x: L + i * slotW, y: H - 8, 'text-anchor': i === 0 ? 'start' : 'middle' }, svg);
        tx.textContent = hhmm;
      }
    }
    var hover = el('rect', { class: 'hover', y: T, height: H - T - B, width: slotW, x: -100 }, svg);
    var colour = { plunge: 'var(--plunge)', cheap: 'var(--cheap)', peak: 'var(--peak)', bar: 'var(--bar)' };
    prices.forEach(function (p, i) {
      if (p === null) return;
      var x = L + i * slotW + gap / 2, w = Math.max(1, slotW - gap);
      el('path', { d: roundedBar(x, w, y(0), y(p)), fill: colour[tags[i].kind] }, svg);
    });
    if (capOn) {
      el('line', { x1: L, x2: W - R, y1: y(CAP.unitRate), y2: y(CAP.unitRate), class: 'cap' }, svg);
      var ct = el('text', { x: W - R - 2, y: y(CAP.unitRate) - 4, 'text-anchor': 'end', class: 'cap-label' }, svg);
      ct.textContent = 'Cap ' + pence(CAP.unitRate);
    }
    var nowI = tags.findIndex(function (t) { return t.now; });
    if (nowI >= 0) {
      var nx = L + (nowI + 0.5) * slotW;
      el('line', { x1: nx, x2: nx, y1: T, y2: H - B, class: 'now' }, svg);
      var nt = el('text', { x: Math.min(nx + 4, W - R - 24), y: T + 10 }, svg); nt.textContent = 'Now';
    }

    var tip = $('tip'), fig = svg.closest('figure');
    function show(evt) {
      var pt = svg.getBoundingClientRect();
      var sx = (evt.clientX - pt.left) / pt.width * W;
      var k = Math.floor((sx - L) / slotW);
      if (k < 0 || k >= n || prices[k] === null) { hide(); return; }
      hover.setAttribute('x', L + k * slotW);
      var fr = fig.getBoundingClientRect();
      tip.textContent = range(day, k, k + 1) + '  ' + pence(prices[k], 2);
      tip.style.left = Math.max(70, Math.min(fr.width - 70, (L + (k + 0.5) * slotW) / W * pt.width + pt.left - fr.left)) + 'px';
      tip.style.top = (y(Math.max(prices[k], 0)) / H * pt.height + pt.top - fr.top - 8) + 'px';
      tip.hidden = false;
    }
    function hide() { tip.hidden = true; hover.setAttribute('x', -100); }
    svg.onpointermove = show; svg.onpointerdown = show; svg.onpointerleave = hide;
  }

  // ---- Table --------------------------------------------------------------

  function fillTable(day, prices, tags) {
    var body = $('rows');
    body.innerHTML = '';
    var names = { plunge: ['Below zero', 'plunge-c'], cheap: ['Cheapest 2 hours', 'cheap-c'], peak: ['Dearest 2 hours', 'peak-c'] };
    prices.forEach(function (p, i) {
      var tr = document.createElement('tr');
      if (p !== null && p < 0) tr.className = 'neg';
      var t = document.createElement('td'); t.className = 't'; t.textContent = range(day, i, i + 1);
      var v = document.createElement('td'); v.className = 'p'; v.textContent = p === null ? 'Not published' : pence(p, 2);
      var note = document.createElement('td');
      var k = names[tags[i].kind];
      if (k) { var c = document.createElement('span'); c.className = 'chip ' + k[1]; c.textContent = k[0]; note.appendChild(c); }
      if (tags[i].now) { var nc = document.createElement('span'); nc.className = 'chip now-c'; nc.textContent = 'Now'; note.appendChild(document.createTextNode(' ')); note.appendChild(nc); }
      tr.appendChild(t); tr.appendChild(v); tr.appendChild(note);
      body.appendChild(tr);
    });
  }

  // ---- Start --------------------------------------------------------------

  var resizeTimer, lastWidth = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = $('chart').parentNode.clientWidth;
      if (state.data && Math.abs(w - lastWidth) > 20) { lastWidth = w; render(); }
    }, 150);
  });

  setupAnalytics();
  setupStickyBar(setupReferral());
  setupPostcode();

  // Installable web app: cache the page so it opens offline with the last prices.
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.PLUNGE_SAMPLE) {
    navigator.serviceWorker.register(BASE + 'sw.js').catch(function () { /* optional */ });
  }

  if (window.PLUNGE_SAMPLE) { init(window.PLUNGE_SAMPLE); return; }
  fetch(BASE + 'data/latest.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () {
      setStatus("Prices aren't available yet. They're added automatically every afternoon; please check back soon.");
    });
})();
