# 📈 Investment Calculator

A small static investment calculator that runs entirely in your browser. No backend, no data collection.

**[Live demo →](https://YOUR-USERNAME.github.io/InvestmentCalculator/)** *(update once GitHub Pages is enabled)*

## Features

- **Interactive inputs** with both number fields and sliders for:
  - Starting capital (S)
  - Monthly investment (I)
  - Average yearly return (R)
  - Time horizon (Y)
  - Milestone factor (F)
- **Live chart** (Chart.js) showing net worth and total contributions over time, with hover tooltips that highlight values at each year and break down interest earned.
- **Two milestones** are computed:
  1. The first year your portfolio's annual returns exceed your annual contributions.
  2. The first year your annual returns exceed **F ×** your annual contributions.

## Math

Compounding is applied monthly. The effective monthly rate from a yearly return *R* is:

$$ r_m = (1 + R/100)^{1/12} - 1 $$

Each month: `balance = balance · (1 + r_m) + I`.

## Running locally

It's a plain static site — open `index.html` in a browser, or serve it:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deploy to GitHub Pages

1. Push to GitHub.
2. Repo → **Settings** → **Pages** → Source: `main` branch / `/ (root)`.
3. Done.
