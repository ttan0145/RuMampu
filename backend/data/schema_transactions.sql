-- Adds the row-level transaction table. Run after schema.sql.
-- A median cannot be summed across quarters, so a rolling window needs the
-- individual sales, not the quarterly aggregate.

CREATE TABLE IF NOT EXISTS property_transaction (
    id              BIGSERIAL PRIMARY KEY,
    district_id     INT  NOT NULL REFERENCES district(id),
    mukim           TEXT,
    scheme_area     TEXT,
    txn_date        DATE NOT NULL,
    quarter         TEXT NOT NULL,
    property_type   TEXT NOT NULL,
    tenure          TEXT,
    land_area       DOUBLE PRECISION,
    floor_area      DOUBLE PRECISION,
    price_rm        NUMERIC(14,2) NOT NULL
);

-- the API filters on all three of these together
CREATE INDEX IF NOT EXISTS idx_txn_lookup
    ON property_transaction (district_id, property_type, quarter);
CREATE INDEX IF NOT EXISTS idx_txn_quarter
    ON property_transaction (quarter);
