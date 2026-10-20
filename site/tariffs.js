/*! Plunge Radar. © 2026 Pras Rao. All rights reserved. Not licensed for copying, reuse or redistribution. plungeradar.co.uk */
// The /octopus-tariffs/ pages: region switch, the tariff quiz, the tariff finder, the copy-link box,
// the phone sticky bar and anonymous click counting. The figures for every region
// are embedded in the page (window.TARIFF_PAGE), so nothing else is downloaded.
(function () {
  'use strict';

  var CFG = window.PLUNGE_CONFIG || {};
  var PAGE = window.TARIFF_PAGE || { page: 'tariffs', data: {} };
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var region = null;
  var lastAnswers = null;

  function store(key, value) {
    try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (e) { return null; }
  }

  // ---- Analytics (Umami: anonymous, no cookies) ---------------------------
  var queue = [];
  function track(name, data) {
    if (!/^[0-9a-f-]{36}$/i.test(CFG.umamiWebsiteId || '')) return;
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
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.ref-link');
      if (!a) return;
      track('referral-click', { button: a.getAttribute('data-cta') || 'other', region: region || '', page: PAGE.page, tariff: a.getAttribute('data-tariff') || '' });
    });
  }

  // ---- Referral link -------------------------------------------------------
  function setupReferral() {
    var ok = /^https:\/\/share\.octopus\.energy\/[\w-]+\/?$/.test(CFG.referralUrl || '');
    all('.reward').forEach(function (el) { el.textContent = CFG.referralReward || '£50'; });
    all('.ref-link').forEach(function (a) { if (ok) a.href = CFG.referralUrl; });
    all('.ref-only').forEach(function (el) { if (!ok) el.hidden = true; });
    var input = $('ref-url');
    if (input && ok) input.value = CFG.referralUrl;
    return ok;
  }

  function setupCopy() {
    var btn = $('ref-copy');
    var input = $('ref-url');
    var msg = $('ref-copy-msg');
    if (!btn || !input) return;
    btn.addEventListener('click', function () {
      var done = function () {
        btn.textContent = 'Copied';
        msg.textContent = 'Link copied. Paste it into your browser when you\'re ready to join Octopus Energy.';
        setTimeout(function () { btn.textContent = 'Copy link'; }, 2500);
        track('referral-copy', { page: PAGE.page, region: region || '' });
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); });
      } else {
        input.select();
        try { if (document.execCommand('copy')) done(); } catch (e) { /* the text stays selected */ }
      }
    });
    input.addEventListener('focus', function () { input.select(); });
  }

  // ---- Region --------------------------------------------------------------
  function setRegion(k, remember) {
    var d = PAGE.data[k];
    if (!d) return;
    region = k;
    all('[data-v]').forEach(function (el) {
      var key = el.getAttribute('data-v');
      if (d[key] !== undefined && d[key] !== '') el.textContent = d[key];
    });
    var sel = $('t-region');
    if (sel) sel.value = k;
    if (remember) store('plunge-region', k);
    if (lastAnswers) showResult(lastAnswers, false);
    if (finderAnswers) showFinder(finderAnswers, false);
    if ($('ev-form')) renderEv();
  }

  function setupRegion() {
    var sel = $('t-region');
    var saved = store('plunge-region');
    setRegion(PAGE.data[saved] ? saved : (CFG.defaultRegion || 'C'), false);
    if (sel) sel.addEventListener('change', function () { setRegion(sel.value, true); });
  }

  // ---- Quiz (hub page) -----------------------------------------------------
  var RESULTS = {
    'intelligent-octopus-go': {
      name: 'Intelligent Octopus Go',
      why: function (d, a) {
        return (a.ev === 'soon' ? 'Once your car arrives, ' : '') + 'Intelligent Octopus Go is Octopus Energy\'s tariff for charging an electric car at home. You pay ' + d.goNight + ' per kWh from 11:30pm to 5:30am ' + d.inRegion + ', and up to 6 hours a day of smart charging at that rate. Other times cost ' + d.goDay + ', and the rates are fixed for 12 months (£50 exit fee). Check your car or charger is supported first; if it isn\'t, Octopus Energy suggests its Octopus Go tariff.';
      },
    },
    agile: {
      name: 'Agile Octopus',
      why: function (d) {
        return 'You can move a lot of your use to cheap times, which is what Agile rewards. ' + (d.agileWhen ? 'O' + d.agileWhen.slice(1) + ', ' : '') + 'Agile averaged ' + d.agileToday + ' per kWh ' + d.inRegion + ', from ' + d.agileLow + ' to ' + d.agileHigh + '. The 4pm to 7pm peak can cost more than a standard tariff, so plan around it.';
      },
    },
    tracker: {
      name: 'Octopus Tracker',
      why: function (d) {
        return 'You\'re happy with a changing price and can use less on pricey days, without planning around half-hours. Tracker sets one price a day from the wholesale market: ' + d.trackerToday + ' per kWh ' + d.trackerWhen + ' ' + d.inRegion + ', ' + d.trackerAvg30 + ' on average over 30 days. Octopus Energy says prices typically increase, likely double, in colder months.';
      },
    },
    flexible: {
      name: 'Flexible Octopus',
      why: function (d) {
        return 'You\'d rather keep things predictable and simple. Flexible Octopus has one unit rate (' + d.flexUnit + ' per kWh ' + d.inRegion + '), usually reviewed every three months, and no exit fees. You can move to a smart tariff later.';
      },
    },
  };

  /** The rules behind the quiz. Kept simple and explainable on purpose. */
  function pickTariff(a) {
    if (a.ev === 'yes' || a.ev === 'soon') return 'intelligent-octopus-go';
    if (a.change === 'fixed') return 'flexible';
    // Octopus Energy's own guidance: Agile for homes that shift a lot, Tracker for homes that
    // can use less on pricey days, Flexible for everyone else.
    if (a.shift === 'lot') return 'agile';
    if (a.shift === 'some') return 'tracker';
    return 'flexible';
  }
  window.PlungePickTariff = pickTariff;

  function showResult(a, scroll) {
    var slug = pickTariff(a);
    var r = RESULTS[slug];
    var d = PAGE.data[region] || PAGE.data.C;
    $('qr-name').textContent = r.name;
    $('qr-why').textContent = r.why(d, a);
    var note = $('qr-note');
    var needsMeter = slug !== 'flexible' && a.meter !== 'yes';
    note.hidden = !needsMeter;
    note.textContent = needsMeter ? 'You\'ll need a smart meter that Octopus Energy can read. Join on Flexible Octopus, ask Octopus Energy about a smart meter, then switch to ' + r.name + ' once it\'s working.' : '';
    $('qr-more').href = '/octopus-tariffs/' + slug + '/';
    $('qr-more').textContent = 'Read about ' + r.name;
    all('#quiz-result a.ref-link').forEach(function (el) { el.setAttribute('data-tariff', slug); });
    var box = $('quiz-result');
    box.hidden = false;
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return slug;
  }

  function setupQuiz() {
    var form = $('quiz-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = {};
      var missing = [];
      ['ev', 'shift', 'change', 'meter'].forEach(function (n, i) {
        var c = form.querySelector('input[name="' + n + '"]:checked');
        if (c) a[n] = c.value; else missing.push(i + 1);
      });
      if (missing.length) {
        $('quiz-msg').textContent = 'Please answer question' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ') + '.';
        return;
      }
      $('quiz-msg').textContent = '';
      lastAnswers = a;
      var slug = showResult(a, true);
      track('tariff-quiz', { result: slug, ev: a.ev, shift: a.shift, change: a.change, meter: a.meter, region: region || '' });
    });
  }


  // ---- Tariff finder ---------------------------------------------------------
  var finderAnswers = null;
  var FQ = ['ev', 'heat', 'solar', 'home', 'shift', 'price', 'meter'];
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function para(box, text, cls) { box.appendChild(el('p', cls || '', text)); }
  // Today's figures for the four tariffs we track, in the visitor's region.
  function liveLine(id, d) {
    if (id === 'agile-octopus' && d.agileToday !== '–') return 'Agile Octopus ' + d.agileWhen + ' ' + d.inRegion + ': ' + d.agileToday + ' per kWh on average, ' + d.agileAvg30 + ' over recent days.';
    if (id === 'octopus-tracker' && d.trackerToday !== '–') return 'Octopus Tracker ' + d.trackerWhen + ' ' + d.inRegion + ': ' + d.trackerToday + ' per kWh, ' + d.trackerAvg30 + ' on average over 30 days.';
    if (id === 'flexible-octopus' && d.flexUnit !== '–') return 'Flexible Octopus ' + d.inRegion + ': ' + d.flexUnit + ' per kWh and ' + d.flexStanding + ' a day.';
    if (id === 'intelligent-octopus-go' && d.goNight !== '–') return 'Intelligent Octopus Go ' + d.inRegion + ': ' + d.goNight + ' per kWh at the cheap rate, ' + d.goDay + ' at other times, and ' + d.goStanding + ' a day.';
    return '';
  }
  function tariffLink(t) { return t.page || t.official; }
  function miniCard(box, heading, t, extra) {
    box.textContent = '';
    box.className = 'fr-mini';
    box.appendChild(el('p', 'fr-mini-k', heading));
    var h = el('p', 'fr-mini-name'); var a = el('a', '', t.name); a.href = tariffLink(t);
    if (!t.page) { a.rel = 'noopener'; a.target = '_blank'; }
    h.appendChild(a); box.appendChild(h);
    para(box, t.what);
    if (extra) para(box, extra, 'hint');
    box.hidden = false;
  }
  function showFinder(a, scroll) {
    var F = window.PlungeFinder;
    if (!F) return null;
    var r = F.recommend(a);
    var T = F.TARIFFS;
    var t = T[r.main];
    var d = PAGE.data[region] || PAGE.data.C;
    $('fr-name').textContent = t.name;
    $('fr-what').textContent = t.what;
    var why = $('fr-why'); why.textContent = '';
    r.why.forEach(function (w) { para(why, w); });
    var facts = $('fr-facts'); facts.textContent = '';
    var live = liveLine(r.main, d);
    [['How it works', t.rates], ['Today', live], ['Contract', t.contract], ['You need', t.needs.join('; ')]].forEach(function (f) {
      if (!f[1]) return;
      var row = el('div'); row.appendChild(el('dt', '', f[0])); row.appendChild(el('dd', '', f[1])); facts.appendChild(row);
    });
    var evBox = $('fr-ev'); evBox.textContent = '';
    var isEv = r.main === 'intelligent-octopus-go' || r.main === 'octopus-go';
    if (isEv) {
      evBox.className = 'fr-mini';
      evBox.appendChild(el('p', 'fr-mini-k', 'Charging your car'));
      var raw = d.raw || {};
      if (a.miles && r.main === 'intelligent-octopus-go' && raw.goNight != null && raw.flexUnit != null) {
        var kwh = a.miles * 0.301;
        para(evBox, 'Driving ' + a.miles.toLocaleString('en-GB') + ' miles a year at 0.301 kWh per mile (about ' + Math.round(kwh).toLocaleString('en-GB') + ' kWh) costs about ' + gbp(kwh * raw.goNight / 100) + ' a year at Intelligent Octopus Go\'s cheap rate ' + d.inRegion + ', against ' + gbp(kwh * raw.flexUnit / 100) + ' on Flexible Octopus. This assumes all your charging is smart charging within the 6 cheap hours a day, and 0.301 kWh per mile is an example: your car may use more or less.');
      }
      var calc = el('a', '', a.miles ? 'See your whole bill with the charging cost calculator' : 'Work out your charging cost with the calculator');
      calc.href = '/electric-car-charging-cost/' + (a.miles ? '?miles=' + a.miles : '');
      var cp = el('p'); cp.appendChild(calc); evBox.appendChild(cp);
      evBox.hidden = false;
    } else evBox.hidden = true;
    var ex = $('fr-export');
    if (r.exportTariff) miniCard(ex, 'For the power you export', T[r.exportTariff], T[r.exportTariff].rates); else ex.hidden = true;
    var add = $('fr-addon');
    if (r.addOn) { add.textContent = ''; add.className = 'fr-mini'; add.appendChild(el('p', 'fr-mini-k', 'Optional add-on for your battery')); para(add, r.addOn); add.hidden = false; } else add.hidden = true;
    var notes = $('fr-notes'); notes.textContent = '';
    if (r.notes.length) { notes.appendChild(el('p', 'fr-mini-k', 'Good to know')); var ul = el('ul'); r.notes.forEach(function (n) { ul.appendChild(el('li', '', n)); }); notes.appendChild(ul); }
    notes.hidden = !r.notes.length;
    var alt = $('fr-alt'); alt.textContent = '';
    if (r.alt.length) {
      alt.className = 'fr-alt';
      alt.appendChild(el('p', 'fr-mini-k', 'Also worth a look'));
      var list = el('ul');
      r.alt.forEach(function (id) {
        var li = el('li'); var link = el('a', '', T[id].name); link.href = tariffLink(T[id]);
        if (!T[id].page) { link.rel = 'noopener'; link.target = '_blank'; }
        li.appendChild(link); li.appendChild(document.createTextNode(': ' + T[id].what)); list.appendChild(li);
      });
      alt.appendChild(list);
    }
    alt.hidden = !r.alt.length;
    var gas = $('fr-gas'); gas.textContent = '';
    if (r.gas) { gas.className = 'fr-alt'; gas.appendChild(el('p', 'fr-mini-k', 'For your gas')); para(gas, 'Octopus Energy\'s gas tariffs are Flexible Octopus, Fixed Octopus and Octopus Tracker.' + (r.main === 'cosy-octopus' || r.main === 'octopus-flux' ? ' ' + t.name + ' is for electricity only.' : '')); }
    gas.hidden = !r.gas;
    var steps = $('fr-steps'); steps.textContent = '';
    steps.appendChild(el('p', 'fr-mini-k', 'How to get it'));
    var ol = el('ol');
    var first = 'Join Octopus Energy with our referral link. You start on a standard tariff such as Flexible Octopus while your supply moves over.';
    var s = [first];
    if (r.needsMeter) s.push(a.meter === 'none' ? 'Ask Octopus Energy to fit a smart meter, which it does at no extra cost.' : 'Check Octopus Energy can read your smart meter: it usually takes around 14 days to connect.');
    if (r.main === 'octopus-flux') s.push('Join Outgoing Octopus for your export. Octopus Energy applies to your network operator for an export MPAN, which takes 1 to 4 weeks, and needs your MCS certificate.');
    else if (r.exportTariff) s.push('Apply for Outgoing Octopus. Octopus Energy applies to your network operator for an export MPAN, which takes 1 to 4 weeks.');
    if (r.main !== 'flexible-octopus') s.push('Switch to ' + t.name + ' from its page on Octopus Energy\'s website or in your account.' + (t.smart ? ' Octopus Energy emails you to accept the terms once it can read your meter.' : ''));
    s.forEach(function (x) { ol.appendChild(el('li', '', x)); });
    steps.appendChild(ol);
    var more = $('fr-more');
    more.href = tariffLink(t);
    more.textContent = (t.page ? 'Read our guide to ' : 'See ') + t.name + (t.page ? '' : ' on Octopus Energy\'s website');
    if (!t.page) { more.rel = 'noopener'; more.target = '_blank'; } else { more.removeAttribute('target'); more.removeAttribute('rel'); }
    all('#finder-result a.ref-link').forEach(function (x) { x.setAttribute('data-tariff', r.main); });
    var box = $('finder-result');
    box.hidden = false;
    if (scroll) { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); box.focus({ preventScroll: true }); }
    return r;
  }
  function setupFinder() {
    var form = $('finder-form');
    if (!form) return;
    if (!window.PlungeFinder) {
      // Not on plungeradar.co.uk: send people to the real tool.
      var msg = $('finder-msg');
      msg.textContent = 'This tariff finder only works on ';
      var home = el('a', '', 'plungeradar.co.uk'); home.href = 'https://plungeradar.co.uk/octopus-tariffs/tariff-finder/';
      msg.appendChild(home); msg.appendChild(document.createTextNode('.'));
      form.querySelector('button[type=submit]').disabled = true;
      return;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = {}, missing = [];
      FQ.forEach(function (n, i) {
        var c = form.querySelector('input[name="' + n + '"]:checked');
        if (c) a[n] = c.value; else missing.push(i + 1);
        $('fq-' + n).classList.toggle('is-missing', !c);
      });
      if (missing.length) {
        $('finder-msg').textContent = 'Please answer question' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ') + '.';
        var firstMissing = $('fq-' + FQ[missing[0] - 1]);
        if (firstMissing) firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      $('finder-msg').textContent = '';
      var mi = parseFloat(($('f-miles') || {}).value);
      if (a.ev !== 'none' && !isNaN(mi) && mi > 0) { a.miles = Math.round(Math.min(50000, Math.max(500, mi))); $('f-miles').value = a.miles; }
      finderAnswers = a;
      var r = showFinder(a, true);
      if (r) track('tariff-finder', { result: r.main, export: r.exportTariff || '', miles: a.miles ? (a.miles < 5000 ? 'under-5k' : a.miles < 10000 ? '5-10k' : '10k-plus') : '', ev: a.ev, heat: a.heat, solar: a.solar, home: a.home, shift: a.shift, price: a.price, meter: a.meter, region: region || '' });
    });
    form.addEventListener('change', function (e) {
      var fs = e.target.closest('fieldset'); if (fs) fs.classList.remove('is-missing');
      if (e.target.name === 'ev') $('fq-miles').hidden = e.target.value === 'none';
    });
  }


  // ---- Electric car charging cost --------------------------------------------
  var evTracked = false;
  function gbp(n) { return '£' + Math.round(n).toLocaleString('en-GB'); }
  function num(id, lo, hi, dflt) {
    var el = $(id);
    var v = parseFloat(el.value);
    if (isNaN(v)) v = dflt;
    v = Math.min(hi, Math.max(lo, v));
    return v;
  }
  function renderEv() {
    if (!$('ev-form')) return;
    var d = PAGE.data[region] || PAGE.data.C;
    var r = d.raw || {};
    if (r.goNight == null || r.flexUnit == null) { $('ev-out').textContent = 'Rates for this region aren\'t available right now.'; return; }
    var miles = num('ev-miles', 500, 50000, 7000);
    var eff = num('ev-eff', 0.15, 0.6, 0.301);
    var bump = parseFloat($('ev-bump').value) || 0;
    var home = num('ev-home', 0, 20000, 2500);
    var night = parseFloat($('ev-night').value) || 0;
    var car = miles * eff;
    var goCar = (car * (1 - bump) * r.goNight + car * bump * r.goDay) / 100;
    var flexCar = car * r.flexUnit / 100;
    var goHome = (home * night * r.goNight + home * (1 - night) * r.goDay) / 100;
    var flexHome = home * r.flexUnit / 100;
    var goTotal = goCar + goHome + 365 * r.goStanding / 100;
    var flexTotal = flexCar + flexHome + 365 * r.flexStanding / 100;
    var diff = flexTotal - goTotal;
    var out = '<p class="calc-big ' + (diff >= 0 ? 'save' : 'cost') + '">' +
      (diff >= 0 ? 'About ' + gbp(diff) + ' a year less on Intelligent Octopus Go' : 'About ' + gbp(-diff) + ' a year more on Intelligent Octopus Go') + '</p>' +
      '<p class="calc-detail">Charging your car (' + Math.round(car).toLocaleString('en-GB') + ' kWh): <b>' + gbp(goCar) + '</b> on Intelligent Octopus Go, <b>' + gbp(flexCar) + '</b> on Flexible Octopus.</p>' +
      (home > 0 ? '<p class="calc-detail">Whole electricity bill, including standing charges: <b>' + gbp(goTotal) + '</b> on Intelligent Octopus Go, <b>' + gbp(flexTotal) + '</b> on Flexible Octopus ' + d.inRegion + '.</p>' : '');
    $('ev-out').innerHTML = out;
    all('[data-ev="goCar"]').forEach(function (el) { el.textContent = gbp(7000 * 0.301 * r.goNight / 100); });
    all('[data-ev="flexCar"]').forEach(function (el) { el.textContent = gbp(7000 * 0.301 * r.flexUnit / 100); });
    all('tr[data-region]').forEach(function (tr) { tr.classList.toggle('is-current', tr.getAttribute('data-region') === region); });
    $('ev').dataset.result = diff >= 0 ? 'saves' : 'costs';
  }
  function setupEv() {
    var form = $('ev-form');
    if (!form) return;
    var qm = parseFloat((location.search.match(/[?&]miles=(\d+)/) || [])[1]);
    if (!isNaN(qm)) $('ev-miles').value = Math.min(50000, Math.max(500, qm));
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('input', renderEv);
    form.addEventListener('change', function (e) {
      // Show the number actually used when a typed value was out of range.
      if (e.target.id === 'ev-miles') e.target.value = num('ev-miles', 500, 50000, 7000);
      if (e.target.id === 'ev-eff') e.target.value = num('ev-eff', 0.15, 0.6, 0.301);
      if (e.target.id === 'ev-home') e.target.value = num('ev-home', 0, 20000, 2500);
      renderEv();
      if (!evTracked) { evTracked = true; track('ev-estimate', { region: region || '', result: $('ev').dataset.result || '' }); }
    });
    renderEv();
  }

  // ---- Sticky bar on phones ------------------------------------------------
  function setupStickyBar(enabled) {
    var bar = $('stickybar');
    if (!bar || !enabled || typeof IntersectionObserver !== 'function') return;
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('plunge-bar') === 'off'; } catch (e) { /* ignore */ }
    if (dismissed) return;
    var targets = all('.hero-cta, #switch, #quiz-result, #finder-result');
    var seen = targets.map(function (t, i) { return i === 0; });
    var update = function () {
      var show = !dismissed && !seen.some(Boolean);
      bar.hidden = !show;
      document.body.classList.toggle('has-bar', show);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[targets.indexOf(e.target)] = e.isIntersecting && !e.target.hidden; });
      update();
    });
    targets.forEach(function (t) { io.observe(t); });
    $('sb-close').addEventListener('click', function () {
      dismissed = true;
      try { sessionStorage.setItem('plunge-bar', 'off'); } catch (e) { /* ignore */ }
      update();
    });
  }

  var ok = setupReferral();
  setupAnalytics();
  setupRegion();
  setupCopy();
  setupQuiz();
  setupFinder();
  setupEv();
  setupStickyBar(ok);
})();
