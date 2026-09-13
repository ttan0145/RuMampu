-- RuMampu — schema for NAPIC price data + DOSM state income
-- Target: Neon Postgres

-- ---------------------------------------------------------------- reference
CREATE TABLE IF NOT EXISTS state (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE          -- matches NAPIC + HIES naming
);

CREATE TABLE IF NOT EXISTS district (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    state_id        INT  NOT NULL REFERENCES state(id),
    -- geography, filled in later for the map. Nullable so the load can run first.
    osm_relation_id BIGINT,
    centroid_lat    DOUBLE PRECISION,
    centroid_lng    DOUBLE PRECISION,
    UNIQUE (name, state_id)
);

-- ---------------------------------------------------------------- income
CREATE TABLE IF NOT EXISTS state_income (
    state_id            INT  NOT NULL REFERENCES state(id),
    year                INT  NOT NULL,
    income_mean         NUMERIC(12,2),
    income_median       NUMERIC(12,2),
    expenditure_mean    NUMERIC(12,2),
    gini                NUMERIC(5,3),
    poverty             NUMERIC(5,2),
    source              TEXT NOT NULL DEFAULT 'DOSM HIES',
    PRIMARY KEY (state_id, year)
);

-- ---------------------------------------------------------------- prices
CREATE TABLE IF NOT EXISTS price_agg (
    id                  BIGSERIAL PRIMARY KEY,
    district_id         INT  NOT NULL REFERENCES district(id),
    quarter             TEXT NOT NULL,            -- '2026Q1'
    property_type       TEXT NOT NULL,            -- 'all' | 'terrace' | 'condo' | ...
    sales_count         INT  NOT NULL,
    total_value_rm      NUMERIC(16,2),
    mean_price_rm       NUMERIC(14,2),
    median_price_rm     NUMERIC(14,2),
    p25_price_rm        NUMERIC(14,2),
    p75_price_rm        NUMERIC(14,2),
    under_300k          INT,
    under_500k          INT,
    preliminary         BOOLEAN NOT NULL DEFAULT FALSE,
    source              TEXT NOT NULL DEFAULT 'NAPIC Open Transaction Data',
    loaded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (district_id, quarter, property_type)
);

-- the map and the list both filter on these
CREATE INDEX IF NOT EXISTS idx_price_agg_lookup
    ON price_agg (property_type, quarter, district_id);
CREATE INDEX IF NOT EXISTS idx_price_agg_district
    ON price_agg (district_id);

-- ---------------------------------------------------------------- bands
-- Where the three map colours are drawn. Kept as data so thresholds are
-- tunable without an app release.
CREATE TABLE IF NOT EXISTS affordability_band (
    code            TEXT PRIMARY KEY,      -- comfortable | marginal | out_of_reach
    lower_ratio     NUMERIC(5,3),          -- price / user_ceiling, inclusive
    upper_ratio     NUMERIC(5,3),
    label_key       TEXT NOT NULL,         -- i18n key
    sort_order      INT  NOT NULL
);

INSERT INTO affordability_band (code, lower_ratio, upper_ratio, label_key, sort_order)
VALUES
    ('comfortable',  0.000, 0.900, 'band_comfortable',  1),
    ('marginal',     0.900, 1.100, 'band_marginal',     2),
    ('out_of_reach', 1.100, NULL,  'band_out_of_reach', 3)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- convenience view
-- Rolling 4-quarter figures, which is what the map should classify on:
-- quarterly cells are too thin in most districts.
CREATE OR REPLACE VIEW price_rolling4 AS
WITH ranked AS (
    SELECT DISTINCT quarter
    FROM price_agg
    ORDER BY quarter DESC
    LIMIT 4
)
SELECT
    p.district_id,
    p.property_type,
    SUM(p.sales_count)                                   AS sales_count,
    SUM(p.total_value_rm)                                AS total_value_rm,
    SUM(p.total_value_rm) / NULLIF(SUM(p.sales_count),0) AS mean_price_rm,
    SUM(p.under_300k)                                    AS under_300k,
    SUM(p.under_500k)                                    AS under_500k,
    MIN(p.quarter)                                       AS from_quarter,
    MAX(p.quarter)                                       AS to_quarter
FROM price_agg p
JOIN ranked r ON r.quarter = p.quarter
GROUP BY p.district_id, p.property_type;

-- NOTE: a median cannot be summed across quarters. If the map needs a rolling
-- median, recompute it from transactions_clean rather than from this view.
