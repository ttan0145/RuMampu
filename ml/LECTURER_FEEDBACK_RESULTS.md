# Lecturer feedback round: local and macro features (results)

Scripts: `geocode.py`, `local_features.py`, `experiment.py`, `explain_local.py`, `macro_trend.py`, `charts_exp.py`
Outputs: `out/exp/`, `out/geocode_report.json`, `data/scheme_locations.csv`, `data/scheme_features.csv`, `data/rail_stations.csv`, `data/macro/`

## Step 1: give each development a location

- **Source:** OpenStreetMap Malaysia extract (Geofabrik, data to 3 Oct 2026, ODbL), processed offline. No web geocoder was used.
- **Check:** every match must fall inside the sale's district boundary (DOSM district polygons, about 1.5 km tolerance).

| Method | Schemes | Sales |
|---|---|---|
| OSM estate / building name, exact | 18.9% | 30.7% |
| OSM name after dropping phase/block words | 9.4% | 15.2% |
| The scheme's road names matched to OSM roads | 32.6% | 28.0% |
| **Located precisely (sum of the three above)** | **60.9%** | **73.9%** |
| Mukim centre (weighted median of located schemes) | 36.5% | 25.2% |
| District centre | 2.7% | 0.9% |

**Accuracy check.** For 1,690 schemes found both by name and by road, the two locations agree to a median of 0.19 km (exact names) and 0.61 km (stripped names). 75% agree within 1 km. About 10% disagree by more than 5 km, usually because of common names such as "Taman Mawar".

**Weak spots by state** (share of sales located precisely):

| Weakest | Share | Strongest | Share |
|---|---|---|---|
| Terengganu | 35% | Johor | 90% |
| Kelantan | 39% | Putrajaya | 94% |
| Pahang | 51% | | |

New developments are often not in OSM yet. Only 50% of the test period's new schemes could be located precisely, against 73% of schemes already seen.

## Step 2: what's nearby (OpenStreetMap, credit: © OpenStreetMap contributors)

- **Distances:** to the nearest urban rail station, state capital, KL centre, motorway exit, hospital and college.
- **Counts within 1–2 km:** schools, clinics, shops/malls, parks and places of worship.
- **Stations:** 182 urban stations (LRT, MRT, Monorail, KTM Komuter, ERL).
- **Opening dates are respected:**
  - Putrajaya Line phase 1 (PY01–PY13): 16 Jun 2022.
  - Putrajaya Line phase 2: 16 Mar 2023.
  - Kajang 2: 13 Mar 2023.
  - LRT3 Shah Alam Line is excluded, because its opening date isn't verified in the data.
- **Limitation:** shops, schools and clinics are today's OSM snapshot, since OSM has no reliable opening dates.

## Step 3: macro data by month, point-in-time

| Series | Source | Rule so a sale only sees what was public at the time |
|---|---|---|
| OPR | BNM API | Effective from the decision date |
| CPI inflation | OpenDOSM `cpi_headline` | 2-month lag |
| State unemployment | OpenDOSM `lfs_qtr_state` | A quarter counts only from 2 months after it ends |
| State median household income | OpenDOSM `hh_income_state` | Survey counts only after publication: 2019 → Jul 2020, 2022 → Jul 2023, 2024 → Jul 2025 |

NAPIC unsold stock has not been added yet. It is only published in PDF reports, so it has to be typed in by hand.

## Steps 4–5: train / validation / test, one group at a time

**Periods.** Train 2021Q1–2024Q2, validation 2024Q3–2025Q2, test 2025Q3–2026Q2. The price index is also rebuilt from training sales only.

**Validation results** (median error; lower is better):

| Feature set | All | Landed | Strata | New schemes | Kept? |
|---|---|---|---|---|---|
| Base (current model) | 9.75% | 9.28% | 11.72% | 13.91% | |
| + macro only | 9.71% | 9.23% | 11.60% | 13.85% | No (under 0.1 pt gain) |
| **+ local** | **9.36%** | **9.00%** | **10.91%** | **13.75%** | **Yes** |
| + local + macro | 9.33% | 8.96% | 10.85% | 13.53% | No (macro adds only 0.03 pt) |

**Test, scored once** (32,070 unseen sales):

| | Base | **Base + local** |
|---|---|---|
| Median error | 11.15% | **10.74%** |
| Within 10% | 45.9% | 47.3% |
| Within 20% | 73.9% | 75.5% |
| Landed | 10.3% | 10.1% |
| Strata (condo, flat) | 14.4% | **13.6%** |
| New schemes | 14.8% | 14.8% |
| P10–P90 range holds | 77.0% | 76.6% |
| Range width | 54.7% | 51.9% |
| Pinball loss | 0.0503 | 0.0488 (−3%) |

**Honest reading**

- **Local features earn their place:** −0.4 points overall and −0.8 points for strata, with narrower ranges at the same coverage.
- **New developments did not improve on test, unlike the lecturer's prediction.** The reason is the data: half of them aren't in OpenStreetMap yet, so they fall back to the mukim centre. Better geocoding of new projects is the lever. A Google or OneMap geocoder, or developer addresses, would help.
- **Macro features don't improve individual estimates,** as the lecturer predicted. Our design already removes timing through the price index.

## Step 6: what drives prices (SHAP, associations not causes)

- **Why a separate model:** in the prediction model, location is already carried by the district, mukim and scheme names, so SHAP gives distances almost no credit.
- **Explanation models:** `explain_local.py` fits models where location enters only through the measured features. Model A compares across Malaysia (state known). Model B compares homes within the same district. Both use precisely located sales from 2021–2025Q2.

| Feature | Across Malaysia | Within same district |
|---|---|---|
| Within 10 km of KL centre (vs 50 km+) | +40% | +21% |
| Within 10 km of state capital (vs 50 km+) | +24% | +10% |
| 31+ shops/malls within 2 km (vs 0–2) | +8% | +7% |
| 3+ parks within 1 km (vs none) | +5% | +4% |
| Motorway exit within 2 km (vs 15 km+) | +4% | +2% |
| Hospital within 2 km (vs 10 km+) | +3% | +4% |
| **Rail station within 1 km (vs 5 km+)** | **+0.5%** | **+1.9%** |
| 13+ schools within 2 km (vs 0–2) | −2% | −2% |

**Rail is a small effect once distance to the city centre and shops is known.** Nationally, being near a station mostly overlaps with being near KL.

## Macro and the trend ("why did 2026 cool?")

**Model** (`macro_trend.py`). Panel of 16 states × 18 quarters (2022Q1–2026Q2). It relates the quarterly % change in each state's index to the OPR change, inflation, unemployment change and income growth. Errors are weighted by sales and clustered by quarter.

**Result: no macro variable is significant.**

| Variable | Estimate | Standard error | p |
|---|---|---|---|
| OPR change (past year) | +1.18 | ±1.10 | 0.28 |
| Inflation | −0.19 | ±0.39 | 0.62 |
| Unemployment change | | | 0.50 |
| Income growth | | | 0.66 |

- R² rises only from 0.03 to 0.06.
- The OPR sign is positive because the 2022–23 rate hikes coincided with the post-COVID price recovery. That's confounding, not a real effect.

**Did 2026 cool?**
- National year-on-year change: 2025Q4 +4.6%, 2026Q1 +0.5%, 2026Q2 +2.2%.
- The 2026Q1 dip is within the noise of the incomplete recent NAPIC quarters, which hold about 1/3 of normal volume.
- So: a slight slowdown in 2026H1, not a clear cooling, and 18 quarters can't attribute it to macro factors.
- **Decision:** macro factors were not added to the Bayesian trend model. With this little history they would fit noise. Revisit with 2010+ NAPIC house price index history.

## Next

1. Switch the production model and app grid to base + local. The grid needs typical local features per district × type cell.
2. Improve geocoding of new developments.
3. Add NAPIC unsold stock from the quarterly reports.
4. Re-run once NAPIC backfills 2024Q4–2026Q2.
