// Tariff finder: the rules and the facts behind them. No page code here, so the tests can
// run it directly. Every tariff fact and every rule comes from Octopus Energy's own pages,
// read word for word on 20 Oct 2026 and recorded in docs/tariff-facts.md:
//  - octopus.energy/blog/which-smart-tariff/ ("Your tech → Smart pick" table, updated 20 Oct 2026)
//  - octopus.energy/tariffs/ ("Choose ... if you" lists)
//  - each tariff's own page (rates, contract, what you need)
(function (root) {
  'use strict';

  var T = {
    'intelligent-octopus-go': {
      name: 'Intelligent Octopus Go',
      page: '/octopus-tariffs/intelligent-octopus-go/',
      official: 'https://octopus.energy/smart/intelligent-octopus-go/',
      what: 'Octopus Energy\'s tariff for electric cars, with smart charging at a low rate and 6 cheap hours a night for your whole home.',
      rates: 'Up to 6 hours of smart car charging a day from 8p per kWh, even outside the night window, plus the cheap rate for your whole home from 11:30pm to 5:30am every night.',
      contract: 'Fixed rates for 12 months, with a £50 exit fee.',
      needs: ['A compatible electric car or charger (Octopus Energy says over 280 cars work)', 'A smart meter sending half-hourly readings', 'A compatible iPhone or Android phone for the Octopus app'],
      smart: true,
    },
    'octopus-go': {
      name: 'Octopus Go',
      official: 'https://octopus.energy/smart/go/',
      what: 'Cheap electricity for your home and car for five hours every night. Octopus Energy says it works with all electric cars and chargers.',
      rates: 'A cheap rate for your whole home from 00:30 to 05:30 every night.',
      contract: 'Octopus Energy is only offering fixed rates at the moment, with a £50 early exit fee.',
      needs: ['An electric car you charge at home (you don\'t need a home charger)', 'A smart meter Octopus Energy can connect to'],
      smart: true,
    },
    'cosy-octopus': {
      name: 'Cosy Octopus',
      official: 'https://octopus.energy/smart/cosy-octopus/',
      what: 'Octopus Energy\'s heat pump tariff, with three cheap periods every day.',
      rates: 'Cheap rates from 04:00 to 07:00, 13:00 to 16:00 and 22:00 to 00:00, 51% cheaper than the day rate in your region. A peak rate from 16:00 to 19:00, 50% above the day rate.',
      contract: 'Fixed and variable versions. The fixed version has a £50 early exit fee. Electricity only.',
      needs: ['A heat pump, electric boiler or electric radiators (they don\'t need to have been installed by Octopus Energy)', 'A smart meter Octopus Energy can connect to'],
      smart: true,
    },
    'octopus-flux': {
      name: 'Octopus Flux',
      official: 'https://octopus.energy/smart/flux/',
      what: 'An import and export tariff for homes with solar panels and a battery: cheap overnight power to top up the battery, and good rates for the energy you sell.',
      rates: 'Cheap rates from 02:00 to 05:00 every day. A peak rate from 16:00 to 19:00, when Octopus Energy suggests using your battery and exporting.',
      contract: 'Variable, with no exit fees or tie-ins.',
      needs: ['Solar panels and a home battery (Octopus Energy says it works with all systems)', 'A smart meter sending half-hourly readings', 'To be on an Octopus Energy import tariff and Outgoing Octopus for export first', 'A copy of your MCS certificate, and an export MPAN (Octopus Energy can apply for one)'],
      smart: true,
    },
    'snug-octopus': {
      name: 'Snug Octopus',
      official: 'https://octopus.energy/smart/snug-octopus/',
      what: 'Octopus Energy\'s tariff for storage heaters: cheap power for 6 hours a night, plus an afternoon boost.',
      rates: '9.5p per kWh for your whole home from 00:30 to 06:30, whenever your storage heaters are smart charging, and during a one-hour afternoon boost. The day rate at other times.',
      contract: 'Variable: prices can rise and fall with wholesale energy.',
      needs: ['Storage heaters controlled by your smart meter (Octopus Energy checks during sign-up)', 'A compatible second-generation (SMETS2) smart meter', 'To be the account holder and live at the property'],
      smart: true,
    },
    'agile-octopus': {
      name: 'Agile Octopus',
      page: '/octopus-tariffs/agile/',
      official: 'https://octopus.energy/smart/agile/',
      what: 'A tariff with a new price every half-hour, tied to wholesale prices and published the day before.',
      rates: 'Never more than 100p per kWh, and sometimes below zero, when you\'re paid to use electricity. Prices are usually highest from 4pm to 7pm.',
      contract: 'No exit fee.',
      needs: ['A smart meter Octopus Energy can connect to'],
      smart: true,
    },
    'octopus-tracker': {
      name: 'Octopus Tracker',
      page: '/octopus-tariffs/tracker/',
      official: 'https://octopus.energy/smart/tracker/',
      what: 'A tariff with one price for each day, following the wholesale market.',
      rates: 'A new price every day, capped at 100p per kWh. Octopus Energy says prices tend to be lower in warmer months and typically increase, likely double, in colder months.',
      contract: 'A 12-month term with no exit fee. If you leave during the term, you wait 9 months to rejoin.',
      needs: ['A working smart meter'],
      smart: true,
    },
    'flexible-octopus': {
      name: 'Flexible Octopus',
      page: '/octopus-tariffs/flexible/',
      official: 'https://octopus.energy/tariffs/',
      what: 'A variable tariff: Octopus Energy says prices rise or fall every three months with wholesale energy.',
      rates: 'One unit rate for every hour of the day.',
      contract: 'No exit fees.',
      needs: ['No smart meter needed'],
      smart: false,
    },
    'fixed-octopus': {
      name: 'Fixed Octopus',
      official: 'https://octopus.energy/tariffs/',
      what: 'Your price won\'t change for 12 or 18 months, whatever the market does.',
      rates: 'One unit rate, fixed for the term.',
      contract: 'Exit fees might apply. Octopus Energy says any exit fee is clearly stated before you switch.',
      needs: [],
      smart: false,
    },
    'outgoing-octopus': {
      name: 'Outgoing Octopus',
      official: 'https://octopus.energy/smart/outgoing/',
      what: 'An export tariff that pays you for the solar power you send to the grid.',
      rates: 'Outgoing Octopus pays 12p per kWh for every unit you export. Prime Outgoing Octopus pays 16p from 4pm to 7pm and 9p the rest of the day, for homes with a battery. Agile Outgoing Octopus pays half-hourly prices, for homes with storage.',
      contract: 'Outgoing Octopus is variable. Prime and Agile Outgoing are 12-month terms with no exit fees.',
      needs: ['A smart meter that sends half-hourly export data', 'An export MPAN: Octopus Energy applies to your network operator, which takes 1 to 4 weeks', 'If you started receiving Feed-in Tariff payments in the last 12 months, you can\'t switch yet'],
      smart: true,
      export: true,
    },
  };

  var CHARGE_PACK = 'Charge Pack is Octopus Energy\'s smart-battery add-on: if you\'re eligible, Octopus Energy says it takes care of your battery charging and exporting, and you make at least £12 a month. You need a smart meter and a supported battery.';

  /**
   * Answers:
   *  ev:    'compatible' | 'unsure' | 'incompatible' | 'none'
   *  heat:  'heatpump' | 'electric' | 'storage' | 'gas' | 'other'
   *  solar: 'none' | 'panels' | 'battery'   (battery = solar panels and a home battery)
   *  home:  'allday' | 'some' | 'out'       (is someone at home in the daytime?)
   *  shift: 'lot' | 'some' | 'little'       (how much use could move to cheap times?)
   *  price: 'certain' | 'market' | 'either'
   *  meter: 'smart' | 'none' | 'unsure'
   * Returns ids from T plus the reasons and notes to show, in order.
   */
  function recommend(a) {
    var r = { main: null, alt: [], exportTariff: null, addOn: null, why: [], notes: [], gas: a.heat === 'gas' };
    var solar = a.solar === 'panels' || a.solar === 'battery';
    var battery = a.solar === 'battery';
    var heating = a.heat === 'heatpump' || a.heat === 'electric';

    if (a.ev === 'compatible' || a.ev === 'unsure') {
      // Octopus Energy's table: EV → Intelligent Octopus Go, also with a heat pump, solar or a battery.
      r.main = 'intelligent-octopus-go';
      r.why.push('Octopus Energy recommends Intelligent Octopus Go for electric car owners, including homes that also have a heat pump, solar panels or a battery.');
      if (a.heat === 'heatpump') r.why.push('Octopus Energy says that with an electric car and a heat pump, Intelligent Octopus Go is usually the cheapest option, because your whole home gets the cheap overnight rate.');
      if (a.ev === 'unsure') {
        r.alt.push('octopus-go');
        r.notes.push('Check that your car or charger works with Intelligent Octopus Go on Octopus Energy\'s website. If it doesn\'t yet, Octopus Energy says Octopus Go is the next best option.');
      }
      if (solar) { r.exportTariff = 'outgoing-octopus'; r.why.push('For the solar power you sell, Octopus Energy pairs it with Outgoing Octopus.'); }
      if (battery) r.addOn = CHARGE_PACK;
    } else if (a.ev === 'incompatible') {
      r.main = 'octopus-go';
      r.why.push('Octopus Energy says that if your car or charger isn\'t compatible with Intelligent Octopus Go, Octopus Go is the next best option. Your whole home gets the cheap overnight rate.');
      // Octopus Energy's tariffs page: Cosy and Flux are for homes without an IOGo-compatible car.
      if (battery) r.alt.push('octopus-flux');
      if (heating) r.alt.push('cosy-octopus');
      if (a.heat === 'storage') r.alt.push('snug-octopus');
      if (solar) r.notes.push('Octopus Energy says you can only pair Octopus Go with certain export tariffs, so check which export tariff works with it before you switch.');
    } else if (battery) {
      r.main = 'octopus-flux';
      r.why.push(a.heat === 'heatpump'
        ? 'Octopus Energy recommends Octopus Flux for homes with a heat pump, solar panels and a battery: you can charge the battery on cheap overnight power, run your heat pump from it and sell any extra at peak prices.'
        : 'Octopus Energy recommends Octopus Flux for homes with solar panels and a battery: store sunlight or cheap overnight power, use it at home, and sell any extra at peak prices.');
      r.notes.push('On Octopus Flux you schedule your battery yourself. If you\'d rather Octopus Energy controlled a compatible battery for you, it points to Intelligent Octopus Flux.');
      if (heating && a.heat !== 'heatpump') r.alt.push('cosy-octopus');
    } else if (heating) {
      r.main = 'cosy-octopus';
      r.why.push('Octopus Energy recommends Cosy Octopus for homes with a heat pump, electric boiler or electric radiators: three cheap periods a day let you heat your home for less.');
      if (solar) { r.exportTariff = 'outgoing-octopus'; r.why.push('For the solar power you sell, Octopus Energy recommends Outgoing Octopus.'); }
    } else if (a.heat === 'storage') {
      r.main = 'snug-octopus';
      r.why.push('Octopus Energy\'s tariffs page points homes with storage heaters to Snug Octopus, which charges them at the cheapest times and adds an afternoon boost.');
      r.notes.push('Snug Octopus needs a compatible SMETS2 smart meter, and not all are. Octopus Energy runs the checks when you sign up. If yours isn\'t compatible, the options below still apply.');
      r.alt.push(pickEveryday(a).main);
      if (solar) { r.exportTariff = 'outgoing-octopus'; r.why.push('Octopus Energy says you can be on Snug Octopus and Outgoing Octopus at the same time.'); }
    } else {
      var e = pickEveryday(a);
      r.main = e.main; r.alt = e.alt; r.why = r.why.concat(e.why);
      if (solar) {
        r.exportTariff = 'outgoing-octopus';
        r.why.push('With solar panels and no battery, Octopus Energy recommends Outgoing Octopus for the power you export. For the power you buy, it says your options are the same as anyone else\'s.');
      }
    }

    if (r.main === 'agile-octopus' || r.alt.indexOf('agile-octopus') !== -1) {
      r.notes.push('Octopus Energy\'s Agile page says Agile prices can spike up to 100p per kWh at any time, and that when wholesale prices are high you\'re likely to save more on a standard variable or fixed tariff through the winter.');
    }
    var smartPick = T[r.main].smart || (r.exportTariff && T[r.exportTariff].smart);
    r.needsMeter = Boolean(smartPick) && a.meter !== 'smart';
    if (r.needsMeter) {
      var exportOnly = !T[r.main].smart;
      var which = exportOnly ? T[r.exportTariff].name : T[r.main].name;
      var note;
      if (exportOnly) note = which + ' needs a smart meter that sends half-hourly export data.' + (a.meter === 'none' ? ' Octopus Energy says it installs smart meters at no extra cost.' : ' Octopus Energy says this includes almost all SMETS2 meters and most SMETS1 meters.');
      else if (a.meter === 'none') note = which + ' needs a smart meter. Octopus Energy says it installs one at no extra cost: join on Flexible Octopus, get the smart meter fitted, then switch.';
      else if (r.main === 'snug-octopus') note = null; // the Snug note below covers its SMETS2 rule
      else note = which + ' needs a smart meter Octopus Energy can read: a second-generation (SMETS2) meter, or a first-generation (SMETS1) meter made by Secure. Your current supplier can tell you which you have.';
      if (note) r.notes.unshift(note);
    }
    if (r.alt.indexOf(r.main) !== -1) r.alt.splice(r.alt.indexOf(r.main), 1);
    r.alt = r.alt.filter(function (x, i, arr) { return x && arr.indexOf(x) === i; }).slice(0, 2);
    return r;
  }

  // For homes without an electric car, heat pump, storage heaters or battery: Octopus
  // Energy's "no smart tech" advice (Agile or Tracker) and its standard tariffs.
  function pickEveryday(a) {
    if (a.price === 'certain') return { main: 'fixed-octopus', alt: ['flexible-octopus'], why: ['You\'d like to know what you\'ll pay. Octopus Energy suggests Fixed Octopus if you value certainty in your budget: your price won\'t change for 12 or 18 months.'] };
    if (a.meter === 'none' || a.shift === 'little') return { main: 'flexible-octopus', alt: [a.meter === 'none' ? 'fixed-octopus' : 'octopus-tracker'], why: [a.meter === 'none'
      ? 'Without a smart meter, Octopus Energy\'s standard tariffs are the place to start. Octopus Energy suggests Flexible Octopus if you might want to change your mind, as it has no exit fees.'
      : 'Octopus Energy suggests Flexible Octopus if you don\'t think a smart tariff is right for you. It has no exit fees, so you can move to a smart tariff later.'] };
    if (a.shift === 'lot' && (a.home === 'allday' || a.home === 'some')) return { main: 'agile-octopus', alt: ['octopus-tracker'], why: ['Octopus Energy says Agile Octopus is worth it if you can shift a big chunk of your use to less busy times of day, and that it\'s great if you work from home, for example putting the washing on in the middle of the day.'] };
    return { main: 'octopus-tracker', alt: ['agile-octopus'], why: ['Octopus Energy says Octopus Tracker suits homes that can use energy flexibly, cutting down on pricey days and using more on cheap days, without thinking about energy use half-hour by half-hour.'] };
  }

  var api = { TARIFFS: T, recommend: recommend };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlungeFinder = api;
})(typeof window !== 'undefined' ? window : globalThis);
