// Investment Calculator — runs entirely in the browser.

// ----- i18n state -----
let currentLang = localStorage.getItem('investcalc.lang') || detectLang();
let t = I18N[currentLang] || I18N.en;

function detectLang() {
  const nav = (navigator.language || 'en').toLowerCase();
  for (const key of Object.keys(I18N)) {
    if (nav.startsWith(key)) return key;
  }
  return 'en';
}

let fmtCurrency;
let fmtCurrencyPrecise;

function buildFormatters() {
  fmtCurrency = new Intl.NumberFormat(t._locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  fmtCurrencyPrecise = new Intl.NumberFormat(t._locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t.title.replace(/^[^\w]+/, '') || 'Investment Calculator';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t[key];
    if (typeof val === 'string') el.textContent = val;
  });
}

function buildLanguageSelect() {
  const sel = document.getElementById('languageSelect');
  sel.innerHTML = '';
  for (const [code, data] of Object.entries(I18N)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = data._name;
    if (code === currentLang) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    currentLang = sel.value;
    t = I18N[currentLang];
    localStorage.setItem('investcalc.lang', currentLang);
    buildFormatters();
    applyStaticTranslations();
    rebuildChartLabels();
    update();
  });
}

// ----- Input wiring -----

function bindInputPair(numberId, rangeId, onChange) {
  const numberEl = document.getElementById(numberId);
  const rangeEl = document.getElementById(rangeId);

  const syncFromNumber = () => {
    const v = parseFloat(numberEl.value);
    if (!Number.isNaN(v)) {
      const clamped = Math.min(Math.max(v, rangeEl.min), rangeEl.max);
      rangeEl.value = clamped;
    }
    onChange();
  };
  const syncFromRange = () => {
    numberEl.value = rangeEl.value;
    onChange();
  };

  numberEl.addEventListener('input', syncFromNumber);
  rangeEl.addEventListener('input', syncFromRange);
}

function readParams() {
  return {
    S: Math.max(0, parseFloat(document.getElementById('startingCapital').value) || 0),
    I: Math.max(0, parseFloat(document.getElementById('monthlyInvestment').value) || 0),
    R: parseFloat(document.getElementById('yearlyReturn').value) || 0,
    Y: Math.max(1, Math.min(80, parseInt(document.getElementById('years').value, 10) || 1)),
    F: Math.max(0.01, parseFloat(document.getElementById('factor').value) || 1),
  };
}

/**
 * Simulate growth month-by-month. Returns per-year snapshots and milestone years.
 */
function simulate({ S, I, R, Y, F }) {
  const monthlyRate = Math.pow(1 + R / 100, 1 / 12) - 1;
  const months = Y * 12;

  const labels = [0];
  const networth = [S];
  const contributed = [S];

  let balance = S;
  let totalContrib = S;

  let yearReturns = 0;
  let yearContrib = 0;
  let milestone1Year = null;
  let milestoneFYear = null;

  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    balance = balance + interest + I;
    totalContrib += I;
    yearReturns += interest;
    yearContrib += I;

    if (m % 12 === 0) {
      const yearIdx = m / 12;
      labels.push(yearIdx);
      networth.push(balance);
      contributed.push(totalContrib);

      if (milestone1Year === null && yearReturns > yearContrib && yearContrib > 0) {
        milestone1Year = yearIdx;
      }
      if (milestoneFYear === null && yearReturns > F * yearContrib && yearContrib > 0) {
        milestoneFYear = yearIdx;
      }
      if (yearContrib === 0 && yearReturns > 0) {
        if (milestone1Year === null) milestone1Year = yearIdx;
        if (milestoneFYear === null) milestoneFYear = yearIdx;
      }

      yearReturns = 0;
      yearContrib = 0;
    }
  }

  return {
    labels,
    networth,
    contributed,
    finalBalance: balance,
    totalContributed: totalContrib,
    milestone1Year,
    milestoneFYear,
  };
}

// ----- Chart -----

let chart;

function buildChart() {
  const ctx = document.getElementById('chart').getContext('2d');

  const networthGradient = ctx.createLinearGradient(0, 0, 0, 420);
  networthGradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  networthGradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

  const contribGradient = ctx.createLinearGradient(0, 0, 0, 420);
  contribGradient.addColorStop(0, 'rgba(129, 140, 248, 0.30)');
  contribGradient.addColorStop(1, 'rgba(129, 140, 248, 0.02)');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: t.netWorth,
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: networthGradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#38bdf8',
          pointHoverBorderColor: '#0f172a',
          pointHoverBorderWidth: 2,
        },
        {
          label: t.totalContributions,
          data: [],
          borderColor: '#818cf8',
          backgroundColor: contribGradient,
          borderWidth: 2,
          borderDash: [6, 4],
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#818cf8',
          pointHoverBorderColor: '#0f172a',
          pointHoverBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#e2e8f0', usePointStyle: true, padding: 16 },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: '#334155',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (items) => t.yearLabel(items[0].label),
            label: (item) => ` ${item.dataset.label}: ${fmtCurrencyPrecise.format(item.parsed.y)}`,
            afterBody: (items) => {
              if (items.length < 2) return '';
              const networth = items[0].parsed.y;
              const contrib = items[1].parsed.y;
              const interest = networth - contrib;
              return `\n ${t.interestEarned}: ${fmtCurrencyPrecise.format(interest)}`;
            },
          },
        },
        annotation: { annotations: {} },
      },
      scales: {
        x: {
          title: { display: true, text: t.chartYears, color: '#94a3b8' },
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          title: { display: true, text: t.chartValue, color: '#94a3b8' },
          ticks: {
            color: '#94a3b8',
            callback: (v) => fmtCurrency.format(v),
          },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
      },
    },
  });
}

function rebuildChartLabels() {
  if (!chart) return;
  chart.data.datasets[0].label = t.netWorth;
  chart.data.datasets[1].label = t.totalContributions;
  chart.options.scales.x.title.text = t.chartYears;
  chart.options.scales.y.title.text = t.chartValue;
}

function buildMilestoneAnnotations(result, params) {
  const annotations = {};

  const make = (year, color, label, position) => ({
    type: 'line',
    xMin: year,
    xMax: year,
    borderColor: color,
    borderWidth: 2,
    borderDash: [6, 4],
    label: {
      display: true,
      content: label,
      position, // 'end' = top, 'start' = bottom
      yAdjust: position === 'end' ? 22 : -6,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: color,
      borderWidth: 1,
      borderRadius: 6,
      color: '#e2e8f0',
      font: { size: 12, weight: '600' },
      padding: { top: 4, bottom: 4, left: 8, right: 8 },
    },
  });

  if (result.milestone1Year !== null) {
    annotations.m1 = make(result.milestone1Year, '#38bdf8', t.chartMilestone1, 'end');
  }
  if (result.milestoneFYear !== null) {
    annotations.mF = make(
      result.milestoneFYear,
      '#a78bfa',
      t.chartMilestoneF(params.F),
      'start'
    );
  }
  return annotations;
}

function update() {
  const params = readParams();
  const result = simulate(params);

  chart.data.labels = result.labels;
  chart.data.datasets[0].data = result.networth;
  chart.data.datasets[1].data = result.contributed;
  chart.options.plugins.annotation.annotations = buildMilestoneAnnotations(result, params);
  chart.update('none');

  document.getElementById('finalValue').textContent = fmtCurrency.format(result.finalBalance);
  document.getElementById('totalContributed').textContent = fmtCurrency.format(result.totalContributed);
  document.getElementById('totalInterest').textContent =
    fmtCurrency.format(result.finalBalance - result.totalContributed);

  document.getElementById('milestone1Title').textContent = t.milestone1Title;
  document.getElementById('milestone1Text').textContent = t.milestone1Text;
  document.getElementById('milestoneFTitle').textContent = t.milestoneFTitle(params.F);
  document.getElementById('milestoneFText').textContent = t.milestoneFText;

  const m1 = document.getElementById('milestone1Result');
  if (result.milestone1Year !== null) {
    m1.textContent = t.reachedYear(result.milestone1Year);
    m1.classList.remove('unreached');
  } else {
    m1.textContent = t.notReached(params.Y);
    m1.classList.add('unreached');
  }

  const mF = document.getElementById('milestoneFResult');
  if (result.milestoneFYear !== null) {
    mF.textContent = t.reachedYear(result.milestoneFYear);
    mF.classList.remove('unreached');
  } else {
    mF.textContent = t.notReached(params.Y);
    mF.classList.add('unreached');
  }
}

// ----- Init -----

buildFormatters();
applyStaticTranslations();
buildLanguageSelect();
buildChart();
bindInputPair('startingCapital', 'startingCapitalRange', update);
bindInputPair('monthlyInvestment', 'monthlyInvestmentRange', update);
bindInputPair('yearlyReturn', 'yearlyReturnRange', update);
bindInputPair('years', 'yearsRange', update);
bindInputPair('factor', 'factorRange', update);
update();
