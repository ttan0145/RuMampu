import React from 'react';
import { getHousingTestResult } from '../../services/housingSession';
import { fetchPxAreas, fetchPxHome, fetchPxTrend } from '../../services/housingService';
import type { PxAreasResponse, PxBand, PxHomeResponse, PxSize, PxTrendResponse, PxType } from '../../types/housing';

/* Price Explorer helpers. The price model runs offline (ml/); the API serves its
   precomputed ranges, and everything here is display maths on those ranges. */

export const PX_TYPES: PxType[] = [
  'terrace', 'condo', 'semi_detached', 'low_cost_house', 'flat', 'townhouse', 'detached', 'cluster', 'low_cost_flat',
];
export const PX_MIN = 150000;
export const PX_MAX = 1500000;

/* The price every recorded month carried in the stress test, else the price
   the user typed, else a common starting point. */
export function startingSafePrice(house: { price: number | null }): number {
  const cr = getHousingTestResult()?.carrying_range;
  const v = cr?.indicative_property_price_lower ?? house.price ?? 450000;
  return Math.min(PX_MAX, Math.max(PX_MIN, Math.round(v / 10000) * 10000));
}
export const fromStressTest = (): boolean => getHousingTestResult()?.carrying_range?.indicative_property_price_lower != null;

/* Standard normal CDF (Abramowitz-Stegun). */
function phi(z: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(z));
  const p = 0.3989423 * Math.exp(-z * z / 2) * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Two-piece log-normal from P10/P50/P90: share of similar homes selling at or under `b`. */
export function shareSimilar(t: PxBand, b: number): number {
  const l = Math.log(b), m = Math.log(t.p50);
  const s = l < m ? (m - Math.log(t.p10)) / 1.2816 : (Math.log(t.p90) - m) / 1.2816;
  return s > 0 ? phi((l - m) / s) : (l >= m ? 1 : 0);
}
export type Tone = 'ok' | 'warn' | 'bad';
export const verdictTone = (share: number): Tone => (share >= 0.5 ? 'ok' : share >= 0.1 ? 'warn' : 'bad');

/* Monthly instalment on a 90% loan at the user's own rate and years. */
export function instalment(price: number, ratePct: number, years: number): number {
  const P = 0.9 * price, i = ratePct / 100 / 12, n = Math.max(1, Math.round(years * 12));
  return i > 0 ? P * i / (1 - Math.pow(1 + i, -n)) : P / n;
}

export const rmK = (v: number): string =>
  v >= 1e6 ? 'RM ' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm' : 'RM ' + Math.round(v / 1000) + 'k';
export const pct = (v: number, d = 0): string => (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%';

/* Share of last year's sales at or under the price, as a map shade (0 = too few sales). */
export const binOf = (s: number | null): number => (s === null ? 0 : s < 0.10 ? 1 : s < 0.33 ? 2 : s < 0.66 ? 3 : 4);

export function niceTicks(lo: number, hi: number, n = 4): number[] {
  const st0 = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(st0)));
  const st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= st0) ?? st0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(v);
  return out;
}

/* ---- data: a small per-URL cache, since the figures change once a quarter ---- */

type Load<T> = { data: T | null; error: number | null; loading: boolean; retry: () => void };
const cache = new Map<string, unknown>();

function useCached<T>(key: string | null, load: () => Promise<T>): Load<T> {
  const [state, setState] = React.useState<{ key: string | null; data: T | null; error: number | null }>(
    { key, data: key ? (cache.get(key) as T) ?? null : null, error: null });
  const [nonce, setNonce] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    if (!key) { setState({ key, data: null, error: null }); return; }
    if (cache.has(key)) { setState({ key, data: cache.get(key) as T, error: null }); return; }
    let alive = true;
    setState(s => ({ key, data: s.key === key ? s.data : null, error: null }));
    loadRef.current().then(
      d => { cache.set(key, d); if (alive) setState({ key, data: d, error: null }); },
      e => { if (alive) setState({ key, data: null, error: Number(e?.status) || 0 }); },
    );
    return () => { alive = false; };
  }, [key, nonce]);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    error: fresh ? state.error : null,
    loading: !!key && (!fresh || (state.data === null && state.error === null)),
    retry: () => setNonce(n => n + 1),
  };
}

export function usePxAreas(state: string, type: PxType, budget: number): Load<PxAreasResponse> {
  const b = Math.round(budget / 10000) * 10000;
  return useCached(`areas|${state}|${type}|${b}`, () => fetchPxAreas(state, type, b));
}
export function usePxHome(district: string | null, type: PxType, tenure: 'F' | 'L', size: PxSize): Load<PxHomeResponse> {
  return useCached(district ? `home|${district}|${type}|${tenure}|${size}` : null, () => fetchPxHome(district!, type, tenure, size));
}
export function usePxTrend(state: string | null, type: PxType): Load<PxTrendResponse> {
  return useCached(state ? `trend|${state}|${type}` : null, () => fetchPxTrend(state!, type));
}
