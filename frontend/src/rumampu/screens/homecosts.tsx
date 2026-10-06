import React from 'react';
import {
  ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect, SvgXml, Text as SvgText } from 'react-native-svg';
import { useApp } from '../state';
import { nf } from '../calc';
import type { PxAreasResponse, PxHomeResponse, PxKind } from '../../../types/housing';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { BodyS } from '../ui';
import { Ico } from '../svgs';
import { GuideTarget } from '../tour';
import { SheetFrame } from '../overlays';
import { GeoMap, DistrictStyle, MapPin } from '../geomap';
import { PX_GEO } from '../pxgeo';
import { PX_GROUP_OF } from '../pxmap';
import { PX_TYPES, fromStressTest, instalment, rmK, startingSafePrice, usePxAreas, usePxHome } from '../priceExplorer';

/* US11 — What homes cost here, on a street map. The map is the page: every district
   of the chosen state (Selangor shares its map with Kuala Lumpur and Putrajaya) is
   shaded and pinned with its typical price; a sheet you drag up lists them cheapest
   first, and a district opens last year, now and in 3 years with a price chart.
   "All homes" comes from real NAPIC sales; a single home type from the price model.
   Published-figure provenance, never the user's own record; the future is a what-if. */

/* v24: Demographia band for a median multiple — the colours belong to the
   scale, never to a household. */
export function fhBand(y: number): number {
  return y <= 3 ? 0 : y <= 4 ? 1 : y <= 5 ? 2 : 3;
}
export const FH_BANDC = [C.confirm, C.caution, C.short, C.ink];
export const FH_BAND_KEYS = [['fh_r1', 'fh_b1'], ['fh_r2', 'fh_b2'], ['fh_r3', 'fh_b3'], ['fh_r4', 'fh_b4']] as const;

const SHADE = ['#CDEBE4', '#8FCFC4', '#4A9195', '#2C5F62'];
const FIT_DOT = { ok: '#2FA84F', warn: '#E9A400', bad: '#E5532A' } as const;
const FIT_BG = { ok: '#E3F5E6', warn: '#FFF3D1', bad: '#FDE4DA' } as const;
const FIT_FG = { ok: '#1F7A33', warn: '#8A6200', bad: '#B5401E' } as const;
type Fit = keyof typeof FIT_DOT;
const KINDS: PxKind[] = ['all', ...PX_TYPES];
const GOLD = '#FFC53D', GOLD_D = '#B97F00', GOLD_T = '#FFF5D9', BRAND_T = '#E3F0F0', BRAND_D = '#2F6B6E';
const INK08 = 'rgba(60,81,82,0.08)';

/* round home-type icons (24 x 24 line drawings) */
const TI: Record<PxKind, string> = {
  all: '<path d="M2.5 12l5-4.2 5 4.2V20h-10z"/><path d="M11.5 9.5l5-4.3 5 4.3V20h-9"/><path d="M6 20v-3.5h3V20M16 13.5h1.5"/>',
  terrace: '<path d="M2 20v-8.5l3.3-3 3.4 3 3.3-3 3.3 3 3.4-3 3.3 3V20z"/><path d="M8.7 11.5V20M15 11.5V20"/><path d="M4.3 20v-3h2v3M10.9 20v-3h2v3M17.2 20v-3h2v3"/>',
  condo: '<rect x="6" y="2.5" width="12" height="18.5" rx="1"/><path d="M9 6h1.5M13.5 6H15M9 9.5h1.5M13.5 9.5H15M9 13h1.5M13.5 13H15"/><path d="M10.5 21v-3.5h3V21"/>',
  semi_detached: '<path d="M2.5 20v-9l4.8-4.3 4.7 4.3 4.7-4.3 4.8 4.3v9z"/><path d="M12 11v9"/><path d="M5.5 20v-3.5h3V20M15.5 20v-3.5h3V20"/>',
  low_cost_house: '<path d="M4 12.5l8-6.5 8 6.5"/><path d="M6 11v9h12v-9"/><path d="M10.5 20v-4h3v4"/>',
  flat: '<rect x="3" y="7" width="18" height="14" rx="1"/><path d="M6.5 10.5h2M11 10.5h2M15.5 10.5h2M6.5 14h2M15.5 14h2"/><path d="M10.5 21v-4h3v4"/><path d="M5 7l1.5-3h11L19 7"/>',
  townhouse: '<path d="M3 20V9.5l4.5-4 4.5 4V20M12 20V9.5l4.5-4 4.5 4V20z"/><path d="M6.3 12.5h2.4M15.3 12.5h2.4"/><path d="M6.3 20v-3.5h2.4V20M15.3 20v-3.5h2.4V20"/>',
  detached: '<path d="M2.5 11.5L12 4l9.5 7.5"/><path d="M4.5 10v10h15V10"/><path d="M16 6.8V4h2.5v4.8"/><path d="M10 20v-5h4v5"/><path d="M6.8 13h2M15.2 13h2"/>',
  cluster: '<path d="M2.5 20v-6l3.5-3 3.5 3v6zM14.5 20v-6l3.5-3 3.5 3v6z"/><path d="M8.5 11V8l3.5-3 3.5 3v3"/>',
  low_cost_flat: '<rect x="5" y="5" width="14" height="16" rx="1"/><path d="M8 8.5h2M14 8.5h2M8 12h2M14 12h2"/><path d="M10.5 21v-4.5h3V21"/>',
};
function TypeIcon({ k, size, color }: { k: PxKind; size: number; color: string }) {
  return (
    <SvgXml width={size} height={size}
      xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${TI[k]}</svg>`} />
  );
}

function Chevron({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <SvgXml width={size} height={size}
      xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6"/></svg>`} />
  );
}

const kindName = (t: (k: string) => string, k: PxKind) => (k === 'all' ? t('fh_t_all') : t('px_t_' + k));
const dName = (d: string) => d.replace(/^Bahagian /, '').replace(/^Daerah Kecil /, '');
const groupOfState = (code: string) => PX_GROUP_OF[code.toUpperCase()] ?? 'KV';
const qx = (q: string) => Number(q.slice(0, 4)) + (Number(q.slice(5)) - 0.5) / 4;
const pct = (a: number, b: number) => {
  const g = (a / b - 1) * 100;
  return `${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(Math.abs(g) < 10 ? 1 : 0)}%`;
};

type Row = { d: string; state: string; typ: number; low: number | null; high: number | null; sales: number; share: number | null };

/* ---------- the price chart: past (state index), now, and the next 3 years ---------- */
function PriceChart({ h, t }: { h: PxHomeResponse; t: (k: string, v?: Record<string, string | number>) => string }) {
  /* hover (web) or touch (phone): the nearest point's numbers in a small card */
  const [hover, setHover] = React.useState<number | null>(null);
  const [wpx, setWpx] = React.useState(358);
  const hs = h.history;
  if (hs.length < 2) return null;
  const W = 358, H = 170, pl = 4, pr = 4, pt = 16, pb = 22;
  const now = h.today.p50, xNow = qx(hs[hs.length - 1].quarter);
  const fut = h.future.map(f => f.p50).filter((v): v is number => v != null);
  const band = h.trend_band;
  const fx = [1, 2, 3].map(y => xNow + y);
  const ys = [...hs.map(p => p.value), ...fut, ...band.flatMap(b => (b ? [b.low, b.high] : []))];
  const y0 = Math.min(...ys) * 0.96, y1 = Math.max(...ys) * 1.03;
  const xa = qx(hs[0].quarter), xb = xNow + 3.2;
  const X = (x: number) => pl + ((x - xa) / (xb - xa)) * (W - pl - pr);
  const Y = (y: number) => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const okBand = band.length === 3 && band.every(Boolean);

  /* every point the card can describe: the past quarters (the last is now) and the 3 years ahead */
  const lastQ = hs[hs.length - 1].quarter;
  type Pt = { x: number; v: number; q: string; kind: 'past' | 'now' | 'future'; years?: number; lo?: number; hi?: number };
  const pts: Pt[] = [
    ...hs.map((p, i) => ({ x: qx(p.quarter), v: i === hs.length - 1 ? now : p.value, q: p.quarter, kind: (i === hs.length - 1 ? 'now' : 'past') as Pt['kind'] })),
    ...(fut.length === 3 ? fut.map((v, i) => ({
      x: fx[i], v, q: `${Number(lastQ.slice(0, 4)) + i + 1}${lastQ.slice(4)}`, kind: 'future' as const, years: i + 1,
      lo: band[i]?.low, hi: band[i]?.high,
    })) : []),
  ];
  const pick = (locX: number) => {
    const vx = (locX * W) / Math.max(1, wpx);
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(X(p.x) - vx) < Math.abs(X(pts[best].x) - vx)) best = i; });
    setHover(best);
  };
  const hp = hover != null ? pts[hover] : null;
  const k = wpx / W;
  /* the card sits beside the point (left of it on the right half), so the point stays in view */
  const cardW = 184;
  const px_ = hp ? X(hp.x) * k : 0;
  const cardLeft = hp ? Math.max(0, Math.min(wpx - cardW, px_ > wpx / 2 ? px_ - cardW - 12 : px_ + 12)) : 0;
  const ago = hp && hp.kind === 'past' ? Math.round((xNow - hp.x) * 4) : 0;
  /* web hover: measure against the chart's box on screen, which stays right under page zoom or scaling */
  const web = {
    onPointerMove: (e: { clientX?: number; nativeEvent: { clientX?: number; locationX?: number }; currentTarget?: { getBoundingClientRect?: () => { left: number; width: number } } }) => {
      const box = e.currentTarget?.getBoundingClientRect?.();
      const cx = e.nativeEvent.clientX ?? e.clientX;
      pick(box && cx != null ? ((cx - box.left) * wpx) / Math.max(1, box.width) : e.nativeEvent.locationX ?? 0);
    },
    onPointerLeave: () => setHover(null),
  } as object;

  return (
    <View onLayout={e => setWpx(e.nativeEvent.layout.width)} {...web}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => true}
      onResponderGrant={e => pick(e.nativeEvent.locationX)} onResponderMove={e => pick(e.nativeEvent.locationX)}
      onResponderRelease={() => setTimeout(() => setHover(null), 2500)}
      testID="hp-chart" accessibilityHint={t('hp_chart_hint')}>
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: W / H }} accessibilityLabel={t('hp_chart_a')} pointerEvents="none">
      <Rect x={X(xNow)} y={pt - 10} width={W - pr - X(xNow)} height={H - pb - pt + 10} fill="#FFF8E6" rx={6} />
      {[0, 0.5, 1].map(f => {
        const v = y0 + (y1 - y0) * f, yy = Y(v);
        return (
          <React.Fragment key={f}>
            <Line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="rgba(60,81,82,0.10)" />
            <SvgText x={pl + 2} y={yy - 4} fontSize={10} fill="rgba(60,81,82,0.55)" fontFamily={BODY_FONT}>{rmK(v)}</SvgText>
          </React.Fragment>
        );
      })}
      {[2022, 2024, 2026, 2028].map(yr => (X(yr) > 16 && X(yr) < W - 16 ? (
        <SvgText key={yr} x={X(yr)} y={H - 6} fontSize={10.5} textAnchor="middle" fill="rgba(60,81,82,0.6)" fontFamily={BODY_FONT}>{String(yr)}</SvgText>
      ) : null))}
      <Line x1={X(xNow)} x2={X(xNow)} y1={pt - 10} y2={H - pb} stroke="rgba(60,81,82,0.35)" strokeDasharray="3 3" />
      {okBand && fut.length === 3 ? (
        <Path fill="rgba(255,197,61,0.28)"
          d={`M${X(xNow)},${Y(now)} ${band.map((b, i) => `L${X(fx[i])},${Y(b!.high)}`).join(' ')} ${[...band].reverse().map((b, i) => `L${X(fx[2 - i])},${Y(b!.low)}`).join(' ')}Z`} />
      ) : null}
      <Path d={hs.map((p, i) => `${i ? 'L' : 'M'}${X(qx(p.quarter)).toFixed(1)},${Y(p.value).toFixed(1)}`).join('')}
        fill="none" stroke={C.brand} strokeWidth={2.6} strokeLinejoin="round" />
      {fut.length === 3 ? (
        <Path d={`M${X(xNow)},${Y(now)} ${fut.map((v, i) => `L${X(fx[i])},${Y(v)}`).join(' ')}`}
          fill="none" stroke={GOLD_D} strokeWidth={2.6} strokeDasharray="5 4" />
      ) : null}
      {h.last_year ? <Circle cx={X(xNow - 1)} cy={Y(h.last_year)} r={4.5} fill="#fff" stroke={C.ink} strokeWidth={2} /> : null}
      {fut.length === 3 ? <Circle cx={X(fx[2])} cy={Y(fut[2])} r={5} fill={GOLD} stroke="#fff" strokeWidth={2} /> : null}
      <Circle cx={X(xNow)} cy={Y(now)} r={6.5} fill={C.brand} stroke="#fff" strokeWidth={2.5} />
      <SvgText x={X(xNow)} y={Y(now) - 11} fontSize={11} fontFamily={XBOLD_FONT} textAnchor="middle" fill={BRAND_D}>{t('hp_nowpt')}</SvgText>
      {hp ? (
        <>
          <Line x1={X(hp.x)} x2={X(hp.x)} y1={pt - 10} y2={H - pb} stroke={C.ink} strokeOpacity={0.45} strokeWidth={1.2} />
          {hp.kind === 'future' && hp.lo != null && hp.hi != null ? (
            <Line x1={X(hp.x)} x2={X(hp.x)} y1={Y(hp.hi)} y2={Y(hp.lo)} stroke={GOLD_D} strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" />
          ) : null}
          <Circle cx={X(hp.x)} cy={Y(hp.v)} r={5.5} fill="#fff" stroke={hp.kind === 'future' ? GOLD_D : C.brand} strokeWidth={3} />
        </>
      ) : null}
    </Svg>
    {hp ? (
      <View pointerEvents="none" style={[st.tip, { left: cardLeft, width: cardW }]} testID="hp-tip">
        <Text style={st.tipH}>
          {hp.kind === 'now' ? `${t('hp_now')} · ${hp.q.replace('Q', ' Q')}`
            : hp.kind === 'future' ? `${hp.q.replace('Q', ' Q')} · ${t(hp.years === 1 ? 'hp_tip_in1' : 'hp_tip_in', { n: hp.years ?? 0 })}`
              : hp.q.replace('Q', ' Q')}
        </Text>
        <Text style={st.tipV}>{rmK(hp.v)}</Text>
        <Text style={st.tipK}>
          {hp.kind === 'future' ? t('hp_if') : hp.kind === 'now' ? t('hp_tip_typ') : ago === 4 ? t('hp_tip_ly') : t('hp_tip_typ')}
        </Text>
        {hp.kind === 'future' && hp.lo != null && hp.hi != null ? (
          <Text style={st.tipK}>{t('hp_tip_range', { a: rmK(hp.lo), b: rmK(hp.hi).replace('RM ', '') })}</Text>
        ) : null}
        {hp.kind !== 'now' ? <Text style={st.tipD}>{t('hp_tip_vs', { p: pct(hp.v, now) })}</Text> : null}
      </View>
    ) : null}
    </View>
  );
}

export function PickSheet({ title, options, value, onPick, onClose }: {
  title: string;
  options: { key: string; label: string }[];
  value: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <SheetFrame pose="counting" onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink }}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={10}><Text style={{ fontSize: 18, color: C.ink }}>✕</Text></Pressable>
      </View>
      <ScrollView style={{ maxHeight: 420, marginTop: 8 }}>
        {options.map(o => (
          <Pressable key={o.key} onPress={() => { onPick(o.key); onClose(); }}
            style={[st.opt, o.key === value && { backgroundColor: C.card }]}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 17, color: C.ink, fontWeight: o.key === value ? '600' : '400' }}>
              {o.label}
            </Text>
            {o.key === value ? <Text style={{ fontSize: 17, color: C.brand }}>✓</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </SheetFrame>
  );
}

export function HomeCostsScreen() {
  const { S, t, up, go, backNav } = useApp();
  const { height: winH } = useWindowDimensions();
  const [H, setH] = React.useState(Math.max(480, winH - 160));
  const group = groupOfState(S.hcState);
  const geo = PX_GEO[group];
  const kind = S.hcKind;
  const budget = S.hcBudget;
  const [open, setOpen] = React.useState<string | null>(null);
  const [more, setMore] = React.useState(false);
  const [size, setSize] = React.useState<'small' | 'typical' | 'large'>('typical');
  const [q, setQ] = React.useState('');
  const [modal, setModal] = React.useState<'state' | 'budget' | 'type' | 'info' | null>(null);

  /* ---- the sheet: peek, half and full, dragged by its handle ---- */
  const snaps = { peek: Math.round(H / 3), half: Math.round(H * 0.56), full: H - 70 };
  const [snap, setSnapKey] = React.useState<keyof typeof snaps>('peek');
  const sheetH = React.useRef(new Animated.Value(snaps.peek)).current;
  const setSnap = React.useCallback((k: keyof typeof snaps) => {
    setSnapKey(k);
    Animated.timing(sheetH, { toValue: { peek: Math.round(H / 3), half: Math.round(H * 0.56), full: H - 70 }[k], duration: 260, useNativeDriver: false }).start();
  }, [H, sheetH]);
  React.useEffect(() => { sheetH.setValue(snaps[snap]); }, [H]); // eslint-disable-line react-hooks/exhaustive-deps
  const drag = React.useRef({ h0: 0, open: false });
  drag.current.open = !!open;
  const grab = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { sheetH.stopAnimation(v => { drag.current.h0 = v; }); },
    onPanResponderMove: (_e, g) => {
      sheetH.setValue(Math.max(120, Math.min(H - 70, drag.current.h0 - g.dy)));
    },
    onPanResponderRelease: (_e, g) => {
      const all = { peek: Math.round(H / 3), half: Math.round(H * 0.56), full: H - 70 };
      if (Math.abs(g.dy) < 4) {
        setSnap(snapRef.current === 'peek' ? (drag.current.open ? 'half' : 'full') : 'peek');
        return;
      }
      const h = drag.current.h0 - g.dy;
      const k = (Object.keys(all) as (keyof typeof all)[]).sort((a, b) => Math.abs(all[a] - h) - Math.abs(all[b] - h))[0];
      setSnap(k);
    },
  }), [H, sheetH, setSnap]);
  const snapRef = React.useRef(snap);
  snapRef.current = snap;

  /* ---- data: one call per state on this map ---- */
  const states = Array.from(new Set(Object.values(geo?.d ?? {}).map(x => x.s)));
  const qb = budget ?? 400000;
  const a1 = usePxAreas(states[0] ?? null, kind, qb);
  const a2 = usePxAreas(states[1] ?? null, kind, qb);
  const a3 = usePxAreas(states[2] ?? null, kind, qb);
  const calls = [a1, a2, a3].slice(0, states.length);
  /* keep the last figures for this map and type while a new budget reloads them */
  const kept = React.useRef<{ key: string; data: (PxAreasResponse | null)[] } | null>(null);
  const keepKey = `${group}|${kind}`;
  if (calls.every(c => c.data)) kept.current = { key: keepKey, data: calls.map(c => c.data) };
  const data = kept.current?.key === keepKey ? kept.current.data : calls.map(c => c.data);
  const loading = !data.every(Boolean);
  const failed = loading ? calls.find(c => c.error != null)?.error ?? null : null;
  const income: Record<string, number | null> = {};
  data.forEach((d, i) => { income[states[i]] = d?.income ?? null; });
  const window = data.find(d => d?.window)?.window ?? null;
  const rows: Row[] = [];
  const thin: string[] = [];
  data.forEach(d => d?.areas.forEach(a => {
    if (!geo?.d[a.district]) return;
    if (a.typical) rows.push({ d: a.district, state: geo.d[a.district].s, typ: a.typical, low: a.low, high: a.high, sales: a.sales, share: a.share_under });
    else thin.push(a.district);
  }));
  rows.sort((a, b) => a.typ - b.typ);
  const byD = Object.fromEntries(rows.map(r => [r.d, r]));
  const fitOf = (r: Row | undefined): Fit | null => {
    if (budget == null || !r) return null;
    return budget >= r.typ ? 'ok' : r.low != null && budget >= r.low ? 'warn' : 'bad';
  };
  const stName = (code: string) => t('px_st_' + code);
  const regionName = group === 'KV' ? t('hp_kv') : stName(group);

  /* ---- the map ---- */
  const sorted = rows.map(r => r.typ).sort((a, b) => a - b);
  const cut = [0.25, 0.5, 0.75].map(p => sorted[Math.floor(p * (sorted.length - 1))] ?? 0);
  const bin = (v: number) => (v <= cut[0] ? 0 : v <= cut[1] ? 1 : v <= cut[2] ? 2 : 3);
  const styleOf = (d: string): DistrictStyle | null => {
    const r = byD[d];
    if (d === open) return { fill: r ? SHADE[bin(r.typ)] : '#C9D3D2', fillOpacity: 0.55, stroke: '#2E3E3F', strokeWidth: 3, strokeOpacity: 1 };
    return { fill: r ? SHADE[bin(r.typ)] : '#C9D3D2', fillOpacity: r ? 0.38 : 0.2, stroke: '#FFFFFF', strokeWidth: 1.4, strokeOpacity: 1 };
  };
  const pins: MapPin[] = rows.map(r => {
    const f = fitOf(r);
    return { d: r.d, label: rmK(r.typ), dot: f ? FIT_DOT[f] : null, on: r.d === open, priority: (r.d === open ? 1e9 : 0) + r.sales };
  });
  const fitTo = open && geo?.d[open] ? geo.d[open].b : geo?.b;
  const pad = open
    ? { top: 90, bottom: snaps.half + 30, left: 40, right: 40 }
    : { top: 80, bottom: snaps[snap] + 20, left: 24, right: 24 };

  const openDistrict = (d: string) => {
    /* a search hit can sit on another state's map: switch to it */
    const s = geo?.d[d]?.s ?? Object.values(PX_GEO).find(g => g.d[d])?.d[d]?.s;
    if (s && groupOfState(s) !== group) up(x => { x.hcState = s.toLowerCase(); });
    setOpen(d); setMore(false); setSize('typical'); setQ('');
    if (snapRef.current === 'peek') setSnap('half');
  };
  const closeDetail = () => { setOpen(null); setSnap('peek'); };
  const setRegion = (code: string) => { up(x => { x.hcState = code.toLowerCase(); }); setOpen(null); setSnap('peek'); };

  /* ---- search: states and districts across Malaysia ---- */
  const query = q.trim().toLowerCase();
  const allD = React.useMemo(() => Object.values(PX_GEO).flatMap(g => Object.entries(g.d).map(([d, x]) => ({ d, s: x.s }))), []);
  const regionHits = query ? Object.keys(PX_GEO).filter(k => {
    const nm = k === 'KV' ? `${t('hp_kv')} ${stName('SGR')} ${stName('KUL')} ${stName('PJY')}` : stName(k);
    return nm.toLowerCase().includes(query);
  }).slice(0, 2) : [];
  const districtHits = query ? allD.filter(x => dName(x.d).toLowerCase().includes(query)).slice(0, 5) : [];

  /* ---- the open district ---- */
  const home = usePxHome(open, kind, 'F', size);
  const h = home.data;
  const row = open ? byD[open] : undefined;
  const fit = open && h ? (budget == null ? null : budget >= h.today.p50 ? 'ok' : h.today.p10 != null && budget >= h.today.p10 ? 'warn' : 'bad') as Fit | null : null;
  const coverPct = row?.share != null ? Math.round(row.share * 100) : null;
  const f3 = h?.future[2]?.p50 ?? null;
  const inc = h?.income ?? (open ? income[geo?.d[open]?.s ?? ''] : null) ?? null;
  const lyQ = h && h.history.length >= 5 ? h.history[h.history.length - 5].quarter : null;
  const testPrice = fromStressTest() ? startingSafePrice(S.data.house) : null;

  const listBody = (
    <>
      <View style={st.lh}>
        <GuideTarget id="fh.sel" style={{ flex: 1 }}>
          <Pressable onPress={() => setModal('state')} accessibilityRole="button" style={st.stBtn} testID="hp-state">
            <Text style={st.stT} numberOfLines={1}>{regionName}</Text>
            <Chevron color={C.ink} />
          </Pressable>
          <Text style={st.cnt}>{loading ? ' ' : t('hp_count', { n: rows.length })}</Text>
        </GuideTarget>
        <Pressable onPress={() => setModal('budget')} accessibilityRole="button" testID="hp-budget"
          style={[st.chip, budget != null && st.chipSet]}>
          {budget == null ? <Text style={st.chipT}>{`+ ${t('hp_budget')}`}</Text>
            : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={[st.chipT, { color: C.ink }]}>{rmK(budget)}</Text><Chevron color={C.ink} size={12} /></View>}
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 4, paddingBottom: 10 }}>
        {KINDS.map(k => {
          const on = kind === k;
          return (
            <Pressable key={k} onPress={() => up(x => { x.hcKind = k; })} accessibilityRole="button"
              accessibilityState={{ selected: on }} style={st.tbtn} testID={`hp-kind-${k}`}>
              <View style={[st.tc, on && st.tcOn]}><TypeIcon k={k} size={26} color={on ? '#fff' : C.brand} /></View>
              <Text style={[st.tl, on && st.tlOn]} numberOfLines={2}>{kindName(t, k)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}><ActivityIndicator color={C.brand} /></View>
      ) : failed != null ? (
        <BodyS muted style={{ paddingVertical: 14 }}>{t(failed === 503 ? 'px_unloaded' : 'hc_error')}</BodyS>
      ) : (
        <GuideTarget id="fh.place">
          <View>
            {rows.map((r, i) => {
              const f = fitOf(r);
              return (
                <Pressable key={r.d} onPress={() => openDistrict(r.d)} accessibilityRole="button" style={st.row} testID={`hp-row-${r.d}`}>
                  <View style={st.rk}><Text style={st.rkT}>{i + 1}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.nm} numberOfLines={1}>{dName(r.d)}</Text>
                    {f ? (
                      <View style={[st.tag, { backgroundColor: FIT_BG[f] }]}><Text style={[st.tagT, { color: FIT_FG[f] }]}>{t('hp_fit_' + f)}</Text></View>
                    ) : <Text style={st.sub}>{stName(r.state)}</Text>}
                  </View>
                  <Text style={st.pr}>{rmK(r.typ)}</Text>
                  <Text style={{ color: C.ink40, fontSize: 18 }}>›</Text>
                </Pressable>
              );
            })}
            {!rows.length ? <Text style={st.none}>{t('hp_none')}</Text> : null}
            {thin.length ? <Text style={st.none}>{t('hp_thin', { l: thin.map(dName).join(', ') })}</Text> : null}
          </View>
        </GuideTarget>
      )}
      <Text style={st.cap}>
        {kind === 'all' && window ? t('hp_cap_all', { a: window.from.replace('Q', ' Q'), b: window.to.replace('Q', ' Q') }) : t('hp_cap_type')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>
        <Pressable onPress={() => setModal('info')} accessibilityRole="button"><Text style={st.lnk}>{t('fh_i')}</Text></Pressable>
        <Pressable onPress={() => go('priceexplorer')} accessibilityRole="button" testID="fh-px"><Text style={st.lnk}>{`${t('px_open')} ›`}</Text></Pressable>
      </View>
    </>
  );

  const detailBody = open ? (
    <>
      <View style={st.dbar}>
        <Pressable onPress={closeDetail} accessibilityRole="button" accessibilityLabel={t('hp_back_list')} style={st.ib} testID="hp-back">
          <Text style={{ fontSize: 16, color: C.ink }}>←</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.dh} numberOfLines={1}>{dName(open)}</Text>
          <Text style={st.sub}>{`${stName(geo?.d[open]?.s ?? '')} · ${kindName(t, kind)}`}</Text>
        </View>
        <Pressable onPress={() => setModal('type')} accessibilityRole="button" accessibilityLabel={t('hp_filter')}
          style={[st.fbtn, kind !== 'all' && st.fbtnOn]} testID="hp-type">
          <TypeIcon k={kind} size={20} color={kind !== 'all' ? '#fff' : C.ink} />
        </Pressable>
      </View>
      {home.loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}><ActivityIndicator color={C.brand} /></View>
      ) : !h ? (
        <Text style={st.none}>{t('hp_nodata')}</Text>
      ) : (
        <>
          <View style={st.trio}>
            <View style={st.tri}>
              <Text style={st.k}>{t('hp_last')}</Text>
              <Text style={st.v}>{h.last_year ? rmK(h.last_year) : '–'}</Text>
              {lyQ ? <Text style={[st.dd, { color: C.ink64 }]}>{lyQ.replace('Q', ' Q')}</Text> : null}
            </View>
            <View style={[st.tri, st.triNow]}>
              <Text style={[st.k, { color: 'rgba(255,255,255,0.8)' }]}>{t('hp_now')}</Text>
              <Text style={[st.v, { color: '#fff', fontSize: 23 }]} testID="hp-now">{rmK(h.today.p50)}</Text>
              {h.last_year ? <Text style={[st.dd, { color: h.today.p50 >= h.last_year ? '#D7F5DE' : '#FDE4DA' }]}>{t('hp_inyear', { p: pct(h.today.p50, h.last_year) })}</Text> : null}
            </View>
            <View style={[st.tri, { backgroundColor: GOLD_T }]}>
              <Text style={st.k}>{t('hp_in3')}</Text>
              <Text style={st.v}>{f3 ? rmK(f3) : '–'}</Text>
              {f3 ? <Text style={[st.dd, { color: f3 >= h.today.p50 ? FIT_FG.ok : FIT_FG.bad }]}>{pct(f3, h.today.p50)}</Text> : null}
            </View>
          </View>
          {fit && budget != null ? (
            <View style={[st.verd, { backgroundColor: FIT_BG[fit] }]}>
              <View style={[st.verdDot, { backgroundColor: FIT_DOT[fit] }]} />
              <Text style={st.verdT}>
                <Text style={{ fontFamily: DISP_FONT }}>{`${t('hp_fit_' + fit)}. `}</Text>
                {coverPct != null ? t('hp_verd', { b: rmK(budget), n: coverPct }) : ''}
              </Text>
            </View>
          ) : null}
          {h.history.length >= 2 ? (
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <Text style={st.ch}>{t('hp_trend')}</Text>
                <Text style={st.sub}>{`${h.history[0].quarter.slice(0, 4)} – ${Number(h.history[h.history.length - 1].quarter.slice(0, 4)) + 3}`}</Text>
              </View>
              <PriceChart h={h} t={t} />
              <View style={st.lgd}>
                <View style={st.lgI}><View style={[st.lgLine, { backgroundColor: C.brand }]} /><Text style={st.lgT}>{t('hp_past')}</Text></View>
                <View style={st.lgI}><View style={[st.lgLine, { backgroundColor: GOLD_D }]} /><Text style={st.lgT}>{t('hp_if')}</Text></View>
                <View style={st.lgI}><View style={[st.lgLine, { height: 8, backgroundColor: 'rgba(255,197,61,0.5)' }]} /><Text style={st.lgT}>{t('hp_likely')}</Text></View>
              </View>
            </View>
          ) : null}
          {h.today.p10 != null && h.today.p90 != null ? (
            <Text style={st.rng}>
              {t('hp_range_a')}
              <Text style={{ fontFamily: DISP_FONT }}>{`${rmK(h.today.p10)} – ${rmK(h.today.p90).replace('RM ', '')}`}</Text>
            </Text>
          ) : null}
          <Pressable onPress={() => setMore(m => !m)} accessibilityRole="button" style={st.more} testID="hp-more">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={st.moreT}>{t(more ? 'hp_less' : 'hp_more')}</Text>
              <View style={more ? { transform: [{ rotate: '180deg' }] } : null}><Chevron color={BRAND_D} /></View>
            </View>
          </Pressable>
          {more ? (
            <View>
              {kind !== 'all' && Object.keys(h.sizes).length > 1 ? (
                <View style={st.seg}>
                  {(['small', 'typical', 'large'] as const).filter(k => h.sizes[k]).map(k => (
                    <Pressable key={k} onPress={() => setSize(k)} style={[st.segB, size === k && st.segOn]} accessibilityRole="tab"
                      accessibilityState={{ selected: size === k }}>
                      <Text style={[st.segT, size === k && { color: C.ink }]}>{t('px_' + k)}</Text>
                      <Text style={st.segS}>{`${h.sizes[k]} m²`}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={st.kv}><Text style={st.kvK}>{t('hp_pay')}</Text>
                <Text style={st.kvV}>{`RM ${nf(Math.round(instalment(h.today.p50, S.data.house.rate, S.data.house.years)))}`}</Text></View>
              {inc ? <View style={st.kv}><Text style={st.kvK}>{t('hp_years')}</Text>
                <Text style={st.kvV}>{t('fh_yrs', { n: (h.today.p50 / (inc * 12)).toFixed(1) })}</Text></View> : null}
              {h.size_m2 ? <View style={st.kv}><Text style={st.kvK}>{t('hp_size')}</Text>
                <Text style={st.kvV}>{`${h.size_m2} m²${h.storeys ? ` · ${t('px_storey', { n: h.storeys })}` : ''}`}</Text></View> : null}
              <View style={st.kv}><Text style={st.kvK}>{t('hp_sold')}</Text><Text style={st.kvV}>{nf(h.n_sales_2y)}</Text></View>
              {h.drivers.some(x => x.effect_pct >= 3.5) ? (
                <>
                  <Text style={st.sec}>{t('hp_up')}</Text>
                  {h.drivers.filter(x => x.effect_pct >= 3.5).sort((a, b) => b.effect_pct - a.effect_pct).slice(0, 4).map(x => (
                    <View key={`${x.feature}-${x.band}`} style={st.drv}>
                      <Text style={[st.kvK, { flex: 1 }]}>{`${x.description}: ${x.band}`}</Text>
                      <Text style={{ fontFamily: DISP_FONT, color: FIT_FG.ok }}>{`+${x.effect_pct.toFixed(0)}%`}</Text>
                    </View>
                  ))}
                </>
              ) : null}
              <Text style={st.cap}>
                {t('hp_foot', { r: S.data.house.rate, y: S.data.house.years })}
                {h.accuracy ? t('hp_acc', { p: Math.round(h.accuracy.median_APE * 100) }) : ''}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#E9EFEE' }} onLayout={e => setH(e.nativeEvent.layout.height)}>
      <GuideTarget id="fh.map" style={StyleSheet.absoluteFill}>
        {geo && fitTo ? (
          <GeoMap group={group} fitTo={fitTo} pad={pad} maxZoom={open ? 11.5 : 12} styleOf={styleOf} pins={pins}
            onPick={openDistrict} attribution="© OpenStreetMap contributors" />
        ) : null}
      </GuideTarget>

      {/* floating back and search */}
      <View style={st.topbar}>
        <Pressable onPress={backNav} accessibilityRole="button" accessibilityLabel={t('back')} style={st.fab}>
          <Text style={{ fontSize: 18, color: C.ink }}>←</Text>
        </Pressable>
        <View style={st.sbox}>
          <Ico name="search" size={18} color={C.ink64} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('fh_search_ph')} placeholderTextColor={C.ink40}
            style={st.sIn} accessibilityLabel={t('fh_search_ph')} testID="fh-search" />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel={t('fh_clear')}><Text style={{ color: C.ink64 }}>✕</Text></Pressable> : null}
        </View>
      </View>
      {query ? (
        <View style={st.sres}>
          {regionHits.map(k => (
            <Pressable key={k} onPress={() => { setQ(''); setRegion(k === 'KV' ? 'SGR' : k); }} style={st.sresR}>
              <View style={st.sresIc}><Text style={{ color: C.brand }}>⌖</Text></View>
              <View style={{ flex: 1 }}><Text style={st.sresT}>{k === 'KV' ? t('hp_kv') : stName(k)}</Text><Text style={st.sub}>{t('hp_state')}</Text></View>
            </Pressable>
          ))}
          {districtHits.map(x => (
            <Pressable key={x.d} onPress={() => openDistrict(x.d)} style={st.sresR} testID={`hp-hit-${x.d}`}>
              <View style={st.sresIc}><TypeIcon k={kind} size={16} color={C.brand} /></View>
              <View style={{ flex: 1 }}><Text style={st.sresT}>{dName(x.d)}</Text><Text style={st.sub}>{stName(x.s)}</Text></View>
              {byD[x.d] ? <Text style={st.pr}>{rmK(byD[x.d].typ)}</Text> : null}
            </Pressable>
          ))}
          {!regionHits.length && !districtHits.length ? <View style={st.sresR}><Text style={st.sub}>{t('hp_nomatch')}</Text></View> : null}
        </View>
      ) : null}

      {/* the sheet */}
      <Animated.View style={[st.sheet, { height: sheetH }]}>
        <View {...grab.panHandlers} style={st.grabZone} accessibilityRole="adjustable" accessibilityLabel={t('hp_drag')}>
          <View style={st.grab} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          {open ? detailBody : listBody}
        </ScrollView>
      </Animated.View>

      {modal === 'state' ? (
        <PickSheet title={t('hp_state_h')} value={group} onClose={() => setModal(null)}
          options={Object.keys(PX_GEO).map(k => ({ key: k, label: k === 'KV' ? t('hp_kv') : stName(k) })).sort((a, b) => a.label.localeCompare(b.label))}
          onPick={k => setRegion(k === 'KV' ? 'SGR' : k)} />
      ) : null}
      {modal === 'type' ? (
        <PickSheet title={t('hp_type_h')} value={kind} onClose={() => setModal(null)}
          options={KINDS.map(k => ({ key: k, label: kindName(t, k) }))}
          onPick={k => { up(x => { x.hcKind = k as PxKind; }); setSize('typical'); }} />
      ) : null}
      {modal === 'budget' ? (
        <BudgetSheet t={t} value={budget} testPrice={testPrice} onClose={() => setModal(null)}
          onSet={v => { up(x => { x.hcBudget = v; }); setModal(null); }} />
      ) : null}
      {modal === 'info' ? (
        <InfoSheet t={t} stateName={stName(states[0] ?? 'SGR')} income={income[states[0] ?? ''] ?? 0} onClose={() => setModal(null)} />
      ) : null}
    </View>
  );
}

/* The most the person could pay: typed or slid, or their safe price from the stress test. */
function BudgetSheet({ t, value, testPrice, onClose, onSet }: {
  t: (k: string, v?: Record<string, string | number>) => string;
  value: number | null; testPrice: number | null; onClose: () => void; onSet: (v: number | null) => void;
}) {
  const [v, setV] = React.useState(value ?? testPrice ?? 400000);
  const [text, setText] = React.useState<string | null>(null);
  const w = React.useRef(1);
  const min = 100000, max = 1500000;
  const slide = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => setFrom(e.nativeEvent.locationX),
    onPanResponderMove: e => setFrom(e.nativeEvent.locationX),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  function setFrom(x: number) {
    const f = Math.max(0, Math.min(1, x / w.current));
    setText(null); setV(Math.round((min + f * (max - min)) / 10000) * 10000);
  }
  const f = (Math.min(max, Math.max(min, v)) - min) / (max - min);
  return (
    <SheetFrame pose="counting" onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: XBOLD_FONT, fontSize: 18, color: C.ink }}>{t('hp_bud_h')}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('close')}><Text style={{ fontSize: 18, color: C.ink }}>✕</Text></Pressable>
      </View>
      <Text style={st.cap}>{t('hp_bud_d')}</Text>
      <View style={st.budIn}>
        <Text style={{ fontFamily: XBOLD_FONT, fontSize: 20, color: C.ink }}>RM</Text>
        <TextInput value={text ?? nf(v)} selectTextOnFocus keyboardType="number-pad" inputMode="numeric" testID="hp-bud-in"
          onChangeText={s => { const d = s.replace(/[^\d]/g, ''); setText(d); if (Number(d) >= 50000) setV(Number(d)); }}
          onBlur={() => setText(null)} style={st.budT} accessibilityLabel={t('hp_bud_h')} />
      </View>
      <View onLayout={e => { w.current = Math.max(1, e.nativeEvent.layout.width); }} {...slide.panHandlers}
        style={{ height: 32, justifyContent: 'center' }} accessibilityRole="adjustable" accessibilityLabel={t('hp_bud_h')}>
        <View pointerEvents="none" style={st.track}><View style={[st.trackOn, { width: `${f * 100}%` }]} /></View>
        <View pointerEvents="none" style={[st.thumb, { left: `${f * 100}%` }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={st.sub}>RM 100k</Text><Text style={st.sub}>RM 1.5m</Text>
      </View>
      {testPrice ? (
        <Pressable onPress={() => { setText(null); setV(testPrice); }}><Text style={st.lnk}>{t('hp_bud_use', { p: rmK(testPrice) })}</Text></Pressable>
      ) : <Text style={st.cap}>{t('hp_bud_hint')}</Text>}
      {value != null ? (
        <Pressable onPress={() => onSet(null)}><Text style={[st.lnk, { color: FIT_FG.bad }]}>{t('hp_bud_rm')}</Text></Pressable>
      ) : null}
      <Pressable onPress={() => onSet(v >= 50000 ? v : null)} accessibilityRole="button" style={st.btn} testID="hp-bud-go">
        <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink }}>{t('hp_bud_go')}</Text>
      </Pressable>
    </SheetFrame>
  );
}

/* v24 fhInfoBody: what the figures are, what they are not, the Demographia
   scale with its colours, and every source. */
function InfoSheet({ t, stateName, income, onClose }: {
  t: (k: string, v?: Record<string, string | number>) => string;
  stateName: string; income: number; onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  /* SheetFrame's maxHeight: '92%' does not resolve, because its parent is
     content-sized and percentages need a definite parent height. Bound the
     scroll area explicitly instead. The reserve covers the peek art above the
     sheet, the header row, the sheet padding and the safe-area inset. */
  const maxBody = Math.max(220, Math.round(height * 0.72) - 180);

  return (
    <SheetFrame pose="curious" onClose={onClose} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink, flexShrink: 1 }}>{t('fh_i')}</Text>
        <Pressable onPress={onClose} hitSlop={10}><Text style={{ fontSize: 18, color: C.ink }}>✕</Text></Pressable>
      </View>
      <ScrollView
        style={{ marginTop: 8, maxHeight: maxBody, flexShrink: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        showsVerticalScrollIndicator
      >
        <BodyS>{t('fh_not')}</BodyS>
        <BodyS>{t('fh_earn', { s: stateName, m: income.toLocaleString('en-MY') })}</BodyS>
        <BodyS>{t('fh_basis')}</BodyS>
        {['fh_i1', 'fh_i7', 'fh_i2'].map(k => <BodyS key={k}>{t(k)}</BodyS>)}
        <BodyS>{t('fh_i8')}</BodyS>
        {['fh_i5', 'fh_i6'].map(k => <BodyS key={k}>{t(k)}</BodyS>)}
        <BodyS muted>{t('fh_i4')}</BodyS>
        <View style={st.scaleCard}>
          {FH_BAND_KEYS.map(([rk, bk], i) => (
            <View key={rk} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: FH_BANDC[i] }} />
              <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink, width: 92 }}>{t(rk)}</Text>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink, flexShrink: 1 }}>{t(bk)}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase', color: C.ink64 }}>{t('fh_src')}</Text>
        {['fh_src1', 'fh_src2', 'fh_src3'].map(k => (
          <BodyS key={k} muted style={{ fontSize: 11.5 }}>{t(k)}</BodyS>
        ))}
        <BodyS muted style={{ fontSize: 11.5 }}>{t('fh_src4', { s: stateName })}</BodyS>
        <BodyS muted style={{ fontSize: 11.5 }}>{t('fh_opened')}</BodyS>
      </ScrollView>
    </SheetFrame>
  );
}

const st = StyleSheet.create({
  topbar: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 20 },
  fab: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  sbox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 23, backgroundColor: '#fff',
    paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  sIn: { flex: 1, minWidth: 0, fontFamily: BODY_FONT, fontSize: 15.5, color: C.ink, paddingVertical: 8 },
  sres: {
    position: 'absolute', top: 66, left: 12, right: 12, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', zIndex: 21,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  sresR: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: INK08 },
  sresIc: { width: 34, height: 34, borderRadius: 17, backgroundColor: BRAND_T, alignItems: 'center', justifyContent: 'center' },
  sresT: { fontFamily: SEMI_FONT, fontSize: 15, color: C.ink },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: -6 }, elevation: 8, zIndex: 15,
  },
  grabZone: { paddingTop: 8, paddingBottom: 6 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.ink14, alignSelf: 'center' },
  lh: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 12 },
  stBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  stT: { fontFamily: XBOLD_FONT, fontSize: 19, color: C.ink, letterSpacing: -0.2, flexShrink: 1 },
  cnt: { fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, marginTop: 2 },
  chip: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.brand, backgroundColor: '#fff', borderRadius: 999, height: 34,
    paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
  },
  chipSet: { borderStyle: 'solid', borderWidth: 1.5, borderColor: GOLD, backgroundColor: GOLD_T },
  chipT: { fontFamily: DISP_FONT, fontSize: 13.5, color: BRAND_D },
  tbtn: { width: 72, alignItems: 'center', gap: 6 },
  tc: { width: 54, height: 54, borderRadius: 27, backgroundColor: BRAND_T, alignItems: 'center', justifyContent: 'center' },
  tcOn: { backgroundColor: C.brand, shadowColor: C.brand, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tl: { fontFamily: SEMI_FONT, fontSize: 11.5, lineHeight: 14, color: C.ink64, textAlign: 'center' },
  tlOn: { fontFamily: XBOLD_FONT, color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: INK08, paddingVertical: 13, paddingHorizontal: 2 },
  rk: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  rkT: { fontFamily: XBOLD_FONT, fontSize: 12, color: C.ink64 },
  nm: { fontFamily: DISP_FONT, fontSize: 15.5, color: C.ink },
  sub: { fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, marginTop: 1 },
  pr: { fontFamily: XBOLD_FONT, fontSize: 16.5, color: C.ink, fontVariant: ['tabular-nums'] },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, marginTop: 4 },
  tagT: { fontFamily: DISP_FONT, fontSize: 11.5 },
  none: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 18, color: C.ink64, paddingTop: 12 },
  cap: { fontFamily: BODY_FONT, fontSize: 12, lineHeight: 17, color: C.ink64, marginTop: 10 },
  lnk: { fontFamily: DISP_FONT, fontSize: 14, color: BRAND_D, paddingVertical: 10 },
  dbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2, paddingBottom: 14 },
  dh: { fontFamily: XBOLD_FONT, fontSize: 20, color: C.ink, letterSpacing: -0.2 },
  ib: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  fbtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.ink14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  fbtnOn: { backgroundColor: C.brand, borderColor: C.brand },
  trio: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  tri: { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: C.card, justifyContent: 'center' },
  triNow: {
    flex: 1.25, backgroundColor: C.brand,
    shadowColor: C.brand, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  k: { fontFamily: XBOLD_FONT, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.ink64 },
  v: { fontFamily: XBOLD_FONT, fontSize: 18, color: C.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
  dd: { fontFamily: DISP_FONT, fontSize: 11.5, marginTop: 3 },
  verd: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  verdDot: { width: 9, height: 9, borderRadius: 5 },
  verdT: { flex: 1, fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink },
  ch: { fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink },
  tip: {
    position: 'absolute', top: 0, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  tipH: { fontFamily: SEMI_FONT, fontSize: 11.5, color: 'rgba(255,255,255,0.75)' },
  tipV: { fontFamily: XBOLD_FONT, fontSize: 17, color: '#fff', marginTop: 1, fontVariant: ['tabular-nums'] },
  tipK: { fontFamily: BODY_FONT, fontSize: 11.5, color: 'rgba(255,255,255,0.88)', marginTop: 1 },
  tipD: { fontFamily: DISP_FONT, fontSize: 11.5, color: GOLD, marginTop: 3 },
  lgd: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 4 },
  lgI: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lgLine: { width: 16, height: 3, borderRadius: 2 },
  lgT: { fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink64 },
  rng: { fontFamily: BODY_FONT, fontSize: 13.5, color: C.ink, marginTop: 12 },
  more: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  moreT: { fontFamily: DISP_FONT, fontSize: 14, color: BRAND_D },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, padding: 3, marginTop: 12, marginBottom: 4 },
  segB: { flex: 1, borderRadius: 8, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segT: { fontFamily: SEMI_FONT, fontSize: 13, color: C.ink64 },
  segS: { fontFamily: BODY_FONT, fontSize: 11, color: C.ink64 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: INK08 },
  kvK: { fontFamily: BODY_FONT, fontSize: 14, color: C.ink64 },
  kvV: { fontFamily: DISP_FONT, fontSize: 14, color: C.ink, textAlign: 'right' },
  sec: { fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink, marginTop: 18, marginBottom: 6 },
  drv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  budIn: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderBottomWidth: 2, borderBottomColor: GOLD, paddingTop: 4, paddingBottom: 6, marginTop: 6, marginBottom: 14 },
  budT: { flex: 1, fontFamily: XBOLD_FONT, fontSize: 30, color: C.ink, paddingVertical: 0 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.ink14, overflow: 'hidden' },
  trackOn: { height: 6, backgroundColor: GOLD_D },
  thumb: { position: 'absolute', top: 5, width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: '#fff', borderWidth: 3, borderColor: GOLD_D },
  btn: {
    marginTop: 14, borderRadius: 14, height: 50, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
    shadowColor: GOLD_D, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, paddingHorizontal: 12, borderRadius: 12,
  },
  scaleCard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8, gap: 2,
  },
});
