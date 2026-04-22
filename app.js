// Investment Calculator — runs entirely in the browser.

const fmtCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const fmtCurrencyPrecise = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

// Pair a number input with a range slider so they stay in sync.
function bindInputPair(numberId, rangeId, onChange) {
  const numberEl = document.getElementById(numberId);
  const rangeEl = document.getElementById(rangeId);

  const syncFromNumber = () => {
    const v = parseFloat(numberEl.value);
    if (!Number.isNaN(v)) {
      // Clamp range visually but allow number input beyond range max.
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
 * Simulate growth month-by-month.
 * Returns per-year snapshots + the year a milestone is first reached.
 */
function simulate({ S, I, R, Y, F }) {
  const monthlyRate = Math.pow(1 + R / 100, 1 / 12) - 1;
  const months = Y * 12;

  const labels = [0];
  const networth = [S];
  const contributed = [S];

  let balance = S;
  let totalContrib = S;

  // Track yearly aggregates to detect milestone years.
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
      // Edge case: zero monthly investment — milestone trivially reached if any return exists.
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

// ----- Chart setup -----

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
          label: 'Net worth',
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
          label: 'Total contributed',
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
      interaction: {
        mode: 'index',
        intersect: false,
      },
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
            title: (items) => `Year ${items[0].label}`,
            label: (item) => {
              const value = fmtCurrencyPrecise.format(item.parsed.y);
              return ` ${item.dataset.label}: ${value}`;
            },
            afterBody: (items) => {
              if (items.length < 2) return '';
              const networth = items[0].parsed.y;
              const contrib = items[1].parsed.y;
              const interest = networth - contrib;
              return `\n Interest earned: ${fmtCurrencyPrecise.format(interest)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Years', color: '#94a3b8' },
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          title: { display: true, text: 'Value (€)', color: '#94a3b8' },
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

function update() {
  const params = readParams();
  const result = simulate(params);

  chart.data.labels = result.labels;
  chart.data.datasets[0].data = result.networth;
  chart.data.datasets[1].data = result.contributed;
  chart.update('none');

  document.getElementById('finalValue').textContent =
    fmtCurrency.format(result.finalBalance);
  document.getElementById('totalContributed').textContent =
    fmtCurrency.format(result.totalContributed);
  document.getElementById('totalInterest').textContent =
    fmtCurrency.format(result.finalBalance - result.totalContributed);

  document.getElementById('factorLabel').textContent = params.F.toString();

  const m1 = document.getElementById('milestone1Result');
  if (result.milestone1Year !== null) {
    m1.textContent = `Reached in year ${result.milestone1Year}`;
    m1.classList.remove('unreached');
  } else {
    m1.textContent = `Not reached within ${params.Y} years`;
    m1.classList.add('unreached');
  }

  const mF = document.getElementById('milestoneFResult');
  if (result.milestoneFYear !== null) {
    mF.textContent = `Reached in year ${result.milestoneFYear}`;
    mF.classList.remove('unreached');
  } else {
    mF.textContent = `Not reached within ${params.Y} years`;
    mF.classList.add('unreached');
  }
}

// ----- Init -----

buildChart();
bindInputPair('startingCapital', 'startingCapitalRange', update);
bindInputPair('monthlyInvestment', 'monthlyInvestmentRange', update);
bindInputPair('yearlyReturn', 'yearlyReturnRange', update);
bindInputPair('years', 'yearsRange', update);
bindInputPair('factor', 'factorRange', update);
update();
