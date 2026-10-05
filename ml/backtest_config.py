"""Shared rolling-origin backtest design for every forecasting method."""
HMAX = 8   # up to 2 years ahead
ORIGIN_QUARTERS = ['2023Q2', '2023Q4', '2024Q2', '2024Q4', '2025Q2']   # model sees data up to and including these
def origins(Q):
    o = [Q.index(q) for q in ORIGIN_QUARTERS if q in Q and Q.index(q) < len(Q) - 1]
    return o or list(range(5, len(Q) - 1))    # short history (Neon 2024-26 extract): every quarter from the 6th
