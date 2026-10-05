-- RuMampu price model tables. NOT run on production; run on a dev branch first.
-- Load with psql:
--   \copy price_scenario    from 'out/bayes_scenarios_lookup.csv' csv header
--   \copy price_range_grid  from 'out/ml/price_range_grid.csv'    csv header

-- 1) Market what-if: state x type growth scenarios (Bayesian trend model)
create table if not exists price_scenario (
  state            text        not null,
  state_code       text        not null,
  property_type    text        not null,
  years            smallint    not null check (years in (1,2,3)),
  target_quarter   text        not null,
  growth_low       numeric(7,4) not null,   -- P10 of growth over `years`
  growth_mid       numeric(7,4) not null,   -- P50
  growth_high      numeric(7,4) not null,   -- P90  (in testing this range held ~94% of outcomes: cautious)
  prob_price_fall  numeric(5,4) not null,   -- chance the price is lower after `years`
  annual_trend     numeric(7,4) not null,
  annual_trend_p10 numeric(7,4) not null,
  annual_trend_p90 numeric(7,4) not null,
  sales_last4q     integer     not null,
  data_quality     text        not null check (data_quality in ('good','fair','thin')),
  method           text        not null,
  base_n           numeric, base_p25 numeric, base_median numeric, base_p75 numeric,
  median_low       numeric, median_mid numeric, median_high numeric,
  primary key (state_code, property_type, years)
);

-- 2) Home what-if: district x type x tenure x size band (LightGBM price range x Bayesian growth)
create table if not exists price_range_grid (
  state          text     not null,
  district       text     not null,
  property_type  text     not null,
  tenure         char(1)  not null,     -- F / L
  storeys        smallint not null,     -- 0 = not applicable
  size_band      text     not null check (size_band in ('small','typical','large')),
  n_sales_2y     integer  not null,
  quarter        text     not null,     -- price level date
  size_m2        numeric  not null,
  p10 numeric, p50 numeric, p90 numeric,                     -- today
  y1_p10 numeric, y1_p50 numeric, y1_p90 numeric,            -- what-if in 1 year
  y2_p10 numeric, y2_p50 numeric, y2_p90 numeric,
  y3_p10 numeric, y3_p50 numeric, y3_p90 numeric,
  primary key (district, property_type, tenure, size_band)
);

-- App query: "what might a typical terrace in Petaling cost, now and in 3 years?"
-- select p10, p50, p90, y3_p10, y3_p50, y3_p90
-- from price_range_grid where district = 'Petaling' and property_type = 'terrace' and size_band = 'typical';
