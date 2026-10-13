// The /octopus-tariffs/ pages: region switch, the tariff quiz, the copy-link box,
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
        return (a.ev === 'soon' ? 'Once your car arrives, ' : '') + 'charging at home overnight is where most homes with an electric car save. You pay ' + d.goNight + ' per kWh from 11:30pm to 5:30am ' + d.inRegion + ', and Octopus Energy schedules your charging at the cheapest times. Other times cost ' + d.goDay + ', and the rates are fixed for 12 months (£50 exit fee).';
      },
    },
    agile: {
      name: 'Agile Octopus',
      why: function (d) {
        return 'You can move a lot of your use to cheap times, which is what Agile rewards. Today Agile averages ' + d.agileToday + ' per kWh ' + d.inRegion + ', from ' + d.agileLow + ' to ' + d.agileHigh + '. The 4pm to 7pm peak can cost more than a standard tariff, so plan around it.';
      },
    },
    tracker: {
      name: 'Octopus Tracker',
      why: function (d) {
        return 'You\'re happy with a changing price but don\'t want to plan around half-hours. Tracker sets one price a day from the wholesale market: ' + d.trackerToday + ' per kWh today ' + d.inRegion + ', ' + d.trackerAvg30 + ' on average over 30 days. Prices tend to rise in colder months, so expect higher winter bills.';
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
    return a.shift === 'lot' ? 'agile' : 'tracker';
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

  // ---- Sticky bar on phones ------------------------------------------------
  function setupStickyBar(enabled) {
    var bar = $('stickybar');
    if (!bar || !enabled || typeof IntersectionObserver !== 'function') return;
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('plunge-bar') === 'off'; } catch (e) { /* ignore */ }
    if (dismissed) return;
    var targets = all('.hero-cta, #switch, #quiz-result');
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
  setupStickyBar(ok);
})();
