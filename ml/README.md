# RuMampu price model (v3, full NAPIC history 2021Q1–2026Q2)

**What it does:** gives a price range for a home today, plus what-if ranges 1, 2 and 3 years ahead.
**Framing:** these are **what-if scenarios, not a valuation or prediction** (AC 11.6.3). The team must sign off on this wording.

## The three models

| # | Job | Model | Script |
|---|---|---|---|
| 1 | Market price index per state × type, each quarter | Hedonic regression: district fixed effects, size, tenure, and quarter effects per state, shrunk toward the national trend | `build_index.py` (maths in `train_price_index.py` / `hedonic.js`) |
| 2 | Where that index goes in 1–3 years | Bayesian hierarchical trend (PyMC) with partial pooling, a slowly changing trend, a shock shared by each type, and Student-t errors | `bayes_trend.py` |
| 3 | What *this* home sells for, relative to the index | LightGBM quantile models (P10/P50/P90) with split-conformal bands. Mukims, schemes and roads with fewer than 20 sales are pooled. | `ml_price_range.py` |

**How they combine:** today's range = index (model 1) × home's relative price (model 3). For N years ahead, it is also multiplied by the growth draws from model 2.

## Data (`prep_napic.py`)

- **Source file:** NAPIC Open Transaction Data export (UTF-16 TSV), 424,588 rows.
- **Rows removed:**
  - 1,359 exact duplicates
  - 2,828 under RM 50k
  - 27 with a size outside 15–5,000 m²
  - 4,080 with an extreme price per m² (beyond the 0.5–99.5th percentile within each type)
- **Rows kept:** 416,294.
- **States:** all 128 districts are mapped to states. Counts per state for 2024Q1 match Neon exactly.
- **Size:** floor area for landed homes, or land/parcel area for strata units, which have no floor area.

**Data warning: the recent quarters are incomplete in NAPIC's own file.**
- From 2024Q4, each quarter has about 1/3 of normal volume. The third month of each quarter is almost empty, for example Mar 2025: 790 sales and Jun 2025: 709, against about 10,000 normally.
- Late-recorded terrace sales are about 7% cheaper per m², so the newest quarters carry some selection bias.
- 2021Q1–Q3 is also thin, because of the COVID movement-control order.

## Model 1: price index (`out/price_index_state_type.csv`, `out/index_and_scenarios.png`)

Change in the national index from 2021Q1 to 2026Q2:

| Type | Total change | Per year |
|---|---|---|
| Terrace | +15.9% | ≈ +2.9%/yr |
| Semi-detached | +16.9% | |
| Condo | −3.6% | |
| Detached | +5.8% | |
| Flat | +10.5% | |
| Low-cost house | +44.6% | |
| Low-cost flat | +30.9% | |
| Cluster | +26.6% | |
| Townhouse | +25.8% | |

The per-year figure uses (1.159)^(1/5.25) − 1 ≈ 2.9%.

## Model 2: Bayesian trend (`out/bayes_*`)

**Fit.** 144 state × type series. NUTS, 4 chains × 1,500 draws. Zero divergences, max R-hat 1.005, minimum ESS 1,176.

**Backtest.**
- **Design:** the model sees data up to 2023Q2, 2023Q4, 2024Q2, 2024Q4 or 2025Q2, then forecasts 1–8 quarters ahead.
- **Size:** 3,332 forecasts across 98 series. Error is the weighted RMSE of the log index.

| Method | 1 qtr | 4 qtrs | 8 qtrs | All | Within 5% |
|---|---|---|---|---|---|
| **Bayesian hierarchical** | 2.5% | 3.7% | 4.6% | **3.44%** | 88% |
| Shrunk state trend | 2.4% | 4.0% | 5.4% | 3.58% | 88% |
| National trend (v1) | 3.1% | 4.1% | 5.3% | 3.97% | 80% |
| No change (naive) | 2.5% | 4.9% | 7.0% | 4.30% | 80% |
| Exponential smoothing | 2.6% | 5.1% | 7.3% | 4.49% | 77% |

- **Overall:** 20% lower error than "no change", and 4% lower than the best simple method.
- **Two years ahead:** the gap widens to 4.6% against 7.0% for "no change".
- **Range coverage:** the model's "80%" ranges actually held **94%** of real outcomes at every horizon, so they are **cautious (too wide)**. The app should describe them as "most likely range", not as exactly 80%.
- **State trends:** `tau_state` ≈ 0, meaning that once shared shocks are allowed for, states don't trend differently from their type. State differences therefore come from price **levels**, not growth rates.

**National trend per type, per year** (with the 80% interval):

| Type | Trend | 80% interval |
|---|---|---|
| Terrace | +2.9% | 1.8–4.1% |
| Semi-detached | +2.9% | |
| Condo | +1.5% | −0.8–3.7% |
| Detached | +1.0% | |
| Flat | +2.4% | |
| Low-cost house | +5.2% | |
| Low-cost flat | +4.9% | |
| Cluster | +4.4% | |
| Townhouse | +3.8% | |

**Example, Selangor terrace (median RM 587k).**
- 1 year: RM 592k / 610k / 629k, with an 11% chance of a lower price.
- 3 years: RM 606k / 645k / 688k, with a 4% chance of a lower price.

**Output.** `out/bayes_scenarios_lookup.csv` (414 rows) gives low/mid/high growth, the chance of a fall, the trend with its interval, base medians and projected medians.

## Model 3: price range for a specific home (`out/ml/`)

**Honest test.** The index and the model are built only from sales up to **2025Q2**. They are tested on **32,070 unseen sales from 2025Q3 to 2026Q2**. Test quarters are priced the way the app would price the future: the last index value plus the recent trend.

| Model | Median error | Within 10% | Within 20% | P10–P90 range holds | Range width |
|---|---|---|---|---|---|
| District × type median (last year) | 20.8% | 26% | 48% | 78% | 131% |
| Hedonic linear | 16.0% | 33% | 59% | 80% | 83% |
| CatBoost MultiQuantile (run 1) | 11.6% | 44% | 73% | 68% | 47% |
| **LightGBM quantile + conformal** | **11.2%** | **46%** | **74%** | **77%** | 55% |
| ...for schemes never seen in training | 14.8% | 36% | 62% | 71% | 67% |

- **Raw bands are too narrow:** LightGBM's P10–P90 band held only 66% of sales. Split-conformal calibration on 2025Q2 widened it to hold 77%, close to the 80% target.
- **Time is not the problem:** using the true index for the test quarters barely helps (11.1% → 11.1%). Almost all the error is the home itself (condition, exact unit, floor, renovation), which the data doesn't record.
- **Median error by type:** terrace 9.5%, semi-detached 9.9%, cluster 10.0%, condo 13.8%, low-cost house 13.8%, flat 15.0%, townhouse 14.7%, detached 15.4%, low-cost flat 16.1%.
- **Median error by price band:** RM 300–500k 9.9%; under RM 200k 17.1%; over RM 1.5m 14.4%.
- **Explanations:** `shap_summary.png` and `feature_importance.csv` show what drives the price beyond the index. Size, district, land area and type dominate.

**App grid.** `price_range_grid.csv` covers district × type × tenure × small/typical/large size. It gives today's P10/P50/P90 and the 1/2/3-year P10/P50/P90, with the home and market uncertainty combined.

**Backend.** The `model/` folder holds plain LightGBM text models plus `lgbm_meta.json`, and it reloads with `LGBQuantile.load('model')`. It can be served from Django for exact homes. It is about 150 MB, so it's shipped as a separate zip.

**Example, Petaling 2-storey freehold terrace, about 141 m².**
- Today: RM 519k / 634k / 923k.
- 3 years: RM 561k / 696k / 1,006k.

## Files

- **Scripts:**
  - `prep_napic.py` → `build_index.py` → `forecast.py` (simple baselines) → `bayes_trend.py` → `ml_price_range.py`
  - Charts: `charts.py`, `charts_bayes.py`
  - Shared backtest settings: `backtest_config.py`
- **Neon table:** `neon_price_scenario.sql` (run on a dev branch first).
- **Old run:** `neon_v1/` holds the first run on the 10-quarter Neon extract, kept for comparison.

## Known limits

1. **The latest year is incomplete** (see the data warning above). Re-run when NAPIC backfills those quarters.
2. **Low-cost types rose fast** (+5%/yr). Check this before using it in the app, since it could partly be new low-cost stock mixing into older districts.
3. **Thin series.** 61 of 138 state × type series are `thin`. Show "not enough sales" for them.
4. **Trend ranges are cautious** (94% held, not 80%). **Home ranges are slightly narrow** (77% held, not 80%).
5. **Years 2–3** are only tested up to 2 years ahead (8 quarters). Year 3 is extrapolation.

## App district maps (`build_app_maps.py`)

The app's district outline maps (all 16 states; Selangor, Kuala Lumpur and Putrajaya share one) are generated, not drawn by hand:

1. Save DOSM's district boundaries (`administrative_2_district.geojson`, github.com/dosm-malaysia/data-open, `datasets/geodata`) as `data/dosm_district.geojson` (gitignored).
2. Run `python build_app_maps.py` (needs `shapely`). It writes `../frontend/src/rumampu/pxmap.ts` (screen-space outlines for the Price Explorer) and `pxgeo.ts` (the same districts in latitude/longitude, for the House costs street map).

District names are NAPIC's, matched to DOSM through `RENAME` in `geocode.py` (Sarawak's divisions are drawn as the union of their DOSM districts). `data/napic_districts.csv` lists every NAPIC district the app can show; refresh it if NAPIC adds one.
