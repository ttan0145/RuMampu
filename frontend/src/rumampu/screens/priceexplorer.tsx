import React from 'react';
import {
  ActivityIndicator, LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Svg, {
  Circle, Defs, Line, LinearGradient, Path, Pattern, Polygon, Polyline, Rect, Stop, Text as SvgText, TSpan,
} from 'react-native-svg';
import { useApp } from '../state';
import { nf, rm } from '../calc';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { BodyS, Prov } from '../ui';
import { GuideTarget } from '../tour';
import { ScreenShell } from './shell';
import { OutlineMap, groupOf } from '../outlinemap';
import { PickSheet } from './homecosts';
import {
  PX_MAX, PX_MIN, PX_STATES, PX_TYPES, Tone, binOf, fromStressTest, instalment, niceTicks, pct, rmK, shareSimilar,
  startingSafePrice, usePxAreas, usePxHome, usePxTrend, verdictTone,
} from '../priceExplorer';
import type { PxAreasResponse, PxBand, PxHomeResponse, PxSize, PxType } from '../../../types/housing';

/* Price Explorer: one guided page from the price model. A numbered path, each
   step unlocking the next: the user's safe price, a home type, where it fits on
   the map, what a home like that sells for, and a what-if for 1-3 years on. The
   page shows ranges, never one price; the future is a what-if, not a prediction;
   and the user's own price (gold) is the anchor on every step. */

const R1 = '#E0F3DB', R2 = '#A8DDB5', R3 = '#2B8CBE', R4 = '#08589E';
const BIN_FILL = ['url(#pxhatch)', R1, R2, R3, R4];
const BIN_TXT = ['#5B6E6F', '#1F2D2E', '#1F2D2E', '#FFFFFF', '#FFFFFF'];
const SOFT = '#F3F6F5', LINE = '#E3E8E8', LINE2 = '#D2DADA', INK3 = '#8A9A9B';
const TONE = {
  ok: { fg: '#1D7A36', bg: '#DDF5E3', dot: '#2FA84F', mark: '✓' },
  warn: { fg: '#946200', bg: '#FFEDB8', dot: '#F2A900', mark: '!' },
  bad: { fg: '#C2401B', bg: '#FDE3D9', dot: '#E5532A', mark: '✕' },
} as const;

type T = (k: string, v?: Record<string, string | number>) => string;
type StepState = 'done' | 'now' | 'todo' | 'locked';

/* ---------- small pieces ---------- */

function Step({ n, state, title, why, children, onLayout }: {
  n: number; state: StepState; title: string; why?: string; children?: React.ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View onLayout={onLayout} style={{ paddingLeft: 40, paddingBottom: 22 }} testID={`px-step-${n}`}>
      {n < 5 ? <View style={[st.rail, state === 'done' && { backgroundColor: R2 }]} /> : null}
      <View style={[st.dot, state === 'now' && st.dotNow, state === 'done' && st.dotDone]}>
        <Text style={{ fontFamily: XBOLD_FONT, fontSize: 13, color: state === 'done' ? '#fff' : state === 'locked' ? INK3 : C.ink }}>
          {state === 'done' ? '✓' : n}
        </Text>
      </View>
      <Text style={st.h3} accessibilityRole="header">{title}</Text>
      {why ? <Text style={st.why}>{why}</Text> : <View style={{ height: 10 }} />}
      <View style={state === 'locked' ? { opacity: 0.45 } : null} pointerEvents={state === 'locked' ? 'none' : 'auto'}>
        {children}
      </View>
    </View>
  );
}

function Tabs<K extends string | number>({ value, options, onChange, label }: {
  value: K; options: { key: K; label: string; sub?: string; disabled?: boolean }[]; onChange: (k: K) => void; label: string;
}) {
  return (
    <View style={st.tabs} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map(o => (
        <Pressable key={String(o.key)} disabled={o.disabled} onPress={() => onChange(o.key)}
          accessibilityRole="tab" accessibilityState={{ selected: value === o.key, disabled: !!o.disabled }}
          style={[st.tab, value === o.key && st.tabOn, o.disabled && { opacity: 0.35 }]}>
          <Text style={{ fontFamily: XBOLD_FONT, fontSize: 14, color: value === o.key ? C.ink : '#5B6E6F' }}>{o.label}</Text>
          {o.sub ? <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: INK3 }}>{o.sub}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

/* A plain slider: drag or tap the track; the accessibility actions step it. */
function Slider({ value, min, max, step, onChange, onDone, label }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; onDone?: (v: number) => void; label: string;
}) {
  const w = React.useRef(1);
  const x0 = React.useRef(0);
  const last = React.useRef(value);
  const cb = React.useRef({ onChange, onDone });
  cb.current = { onChange, onDone };
  const snap = (x: number) => {
    const f = Math.max(0, Math.min(1, x / w.current));
    return Math.round((min + f * (max - min)) / step) * step;
  };
  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      x0.current = e.nativeEvent.locationX;
      last.current = snap(x0.current);
      cb.current.onChange(last.current);
    },
    onPanResponderMove: (_e, g) => {
      const v = snap(x0.current + g.dx);
      if (v !== last.current) { last.current = v; cb.current.onChange(v); }
    },
    onPanResponderRelease: () => cb.current.onDone?.(last.current),
  }), [min, max, step]);
  const f = (value - min) / (max - min);
  const nudge = (d: number) => {
    const v = Math.max(min, Math.min(max, value + d * step));
    onChange(v); onDone?.(v);
  };
  return (
    <View
      accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ height: 36, justifyContent: 'center' }}
    >
      <View onLayout={e => { w.current = Math.max(1, e.nativeEvent.layout.width); }} {...pan.panHandlers}
        style={{ height: 36, justifyContent: 'center' }}>
        <View pointerEvents="none" style={st.track}>
          <View style={[st.trackOn, { width: `${f * 100}%` }]} />
        </View>
        <View pointerEvents="none" style={[st.thumb, { left: `${f * 100}%` }]} />
      </View>
    </View>
  );
}

function Accordion({ title, open, onToggle, children, testID }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode; testID?: string;
}) {
  return (
    <View style={st.acc}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={st.accBtn} testID={testID}>
        <Text style={{ fontFamily: XBOLD_FONT, fontSize: 15, color: C.ink, flex: 1 }}>{title}</Text>
        <Text style={{ color: INK3, transform: [{ rotate: open ? '180deg' : '0deg' }] }}>▾</Text>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{children}</View> : null}
    </View>
  );
}

function Badge({ tone, text, wide }: { tone: Tone; text: string; wide?: boolean }) {
  const c = TONE[tone];
  return (
    <View style={[st.badge, wide && st.badgeWide, { backgroundColor: wide ? c.bg : '#fff' }]}>
      <View style={[st.badgeDot, { backgroundColor: c.dot }]}>
        <Text style={{ color: '#fff', fontSize: 11, fontFamily: XBOLD_FONT }}>{c.mark}</Text>
      </View>
      <Text style={{ fontFamily: XBOLD_FONT, fontSize: 14, color: c.fg, flexShrink: 1, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

/* The teal card that carries a range, with a gradient drawn behind it. */
function Hero({ top, children }: { top: React.ReactNode; children?: React.ReactNode }) {
  return (
    <View style={st.hero}>
      <View style={st.heroTop}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="pxhero" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#17575B" />
              <Stop offset="1" stopColor="#2C9C91" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#pxhero)" />
        </Svg>
        {top}
      </View>
      {children ? <View style={st.heroBody}>{children}</View> : null}
    </View>
  );
}

function Fact({ v, k, tone }: { v: string; k: string; tone?: Tone | null }) {
  const c = tone ? TONE[tone] : null;
  return (
    <View style={[st.fact, c && { backgroundColor: c.bg }]}>
      <Text style={{ fontFamily: XBOLD_FONT, fontSize: 18, color: c ? c.fg : C.ink }}>{v}</Text>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 12, lineHeight: 16, color: '#5B6E6F' }}>{k}</Text>
    </View>
  );
}

const anc = (px: number) => (px < 44 ? 'start' : px > 276 ? 'end' : 'middle');

/* ---------- step 3: map and list ---------- */

function DistrictMap({ stateCode, shares, inState, sel, onPick, t, label }: {
  stateCode: string; shares: Record<string, number | null>; inState: (d: string) => boolean; sel: string | null;
  onPick: (d: string) => void; t: T; label: string;
}) {
  return (
    <View style={st.mapwrap}>
      <OutlineMap stateCode={stateCode} label={label} sel={sel} onPick={onPick} hatchId="pxhatch"
        fill={d => (inState(d) && shares[d] != null ? BIN_FILL[binOf(shares[d])] : null)}
        value={d => (!inState(d) ? null : shares[d] == null ? t('px_few') : `${Math.round(shares[d]! * 100)}%`)}
        dark={d => binOf(shares[d] ?? null) >= 3}
        canPick={inState} />
    </View>
  );
}

function Legend({ items }: { items: { c: string; label: string; line?: boolean; hatch?: boolean }[] }) {
  return (
    <View style={st.legend}>
      {items.map(i => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[
            { width: 14, height: i.line ? 3 : 14, borderRadius: i.line ? 2 : 4, marginRight: 5, backgroundColor: i.c },
            i.hatch && { borderWidth: 1, borderColor: LINE2, borderStyle: 'dashed' },
          ]} />
          <Text style={{ fontFamily: BODY_FONT, fontSize: 12, color: '#5B6E6F' }}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- step 4: range bar ---------- */

function RangeBar({ band, you, t }: { band: PxBand; you: number; t: T }) {
  const lo = Math.min(band.p10, you) * 0.85, hi = Math.max(band.p90, you) * 1.08, X = (v: number) => (v - lo) / (hi - lo) * 320;
  return (
    <Svg viewBox="0 0 320 98" width="100%" style={{ aspectRatio: 320 / 98, marginTop: 8 }} accessibilityLabel={t('px_bar_a')}>
      <Rect x={0} y={40} width={320} height={14} rx={7} fill={SOFT} />
      <Rect x={X(band.p10)} y={40} width={X(band.p90) - X(band.p10)} height={14} rx={7} fill={R2} />
      <Rect x={X(band.p50) - 2} y={34} width={4} height={26} rx={2} fill={C.ink} />
      <SvgText x={X(band.p10)} y={72} fontSize={11} fontFamily={XBOLD_FONT} fill="#5B6E6F" textAnchor={anc(X(band.p10))}>{rmK(band.p10)}</SvgText>
      <SvgText x={X(band.p90)} y={72} fontSize={11} fontFamily={XBOLD_FONT} fill="#5B6E6F" textAnchor={anc(X(band.p90))}>{rmK(band.p90)}</SvgText>
      <SvgText x={X(band.p50)} y={90} fontSize={11} fontFamily={XBOLD_FONT} fill={C.ink} textAnchor={anc(X(band.p50))}>
        {t('px_typ_bar', { p: rmK(band.p50) })}
      </SvgText>
      <Path d={`M${X(you)} 36 L${X(you) - 7} 22 H${X(you) + 7} Z`} fill={C.gold} stroke={C.goldD} strokeWidth={1.2} />
      <SvgText x={X(you)} y={14} fontSize={11} fontFamily={XBOLD_FONT} fill={C.goldD} textAnchor={anc(X(you))}>
        {t('px_your', { p: rmK(you) })}
      </SvgText>
    </Svg>
  );
}

/* ---------- step 5: what-if fan ---------- */

function FanChart({ pts, bud, year, onYear, t }: {
  pts: number[][]; bud: number[]; year: number; onYear: (y: 0 | 1 | 2 | 3) => void; t: T;
}) {
  const W = 320, H = 180, m = { l: 54, r: 20, t: 10, b: 24 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const all = [...pts.flat(), ...bud];
  let lo = Math.min(...all) * 0.94, hi = Math.max(...all) * 1.04;
  const ticks = niceTicks(lo, hi, 4);
  lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const x = (i: number) => m.l + i * iw / 3, y = (v: number) => m.t + ih - (v - lo) / (hi - lo) * ih;
  const yrs = [t('px_today'), t('px_y1'), t('px_y2'), t('px_y3')];
  const band = `${pts.map((p, i) => `${x(i)},${y(p[2])}`).join(' ')} ${pts.slice().reverse().map((p, i) => `${x(3 - i)},${y(p[0])}`).join(' ')}`;
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: W / H }} accessibilityLabel={t('px_fan_a')}>
      {ticks.map(v => (
        <React.Fragment key={v}>
          <Line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={LINE} />
          <SvgText x={m.l - 6} y={y(v) + 4} fontSize={10} fill={INK3} textAnchor="end" fontFamily={DISP_FONT}>{rmK(v)}</SvgText>
        </React.Fragment>
      ))}
      {yrs.map((l, i) => (
        <SvgText key={l} x={x(i)} y={H - 6} fontSize={11} fill={i === year ? C.ink : INK3} textAnchor="middle"
          fontFamily={i === year ? XBOLD_FONT : DISP_FONT}>{l}</SvgText>
      ))}
      <Polygon points={band} fill={R2} opacity={0.85} />
      <Polyline points={bud.map((b, i) => `${x(i)},${y(b)}`).join(' ')} fill="none" stroke={C.gold} strokeWidth={2.5} strokeDasharray="6 4" />
      <Polyline points={pts.map((p, i) => `${x(i)},${y(p[1])}`).join(' ')} fill="none" stroke={C.ink} strokeWidth={2.5} />
      <Line x1={x(year)} x2={x(year)} y1={m.t} y2={m.t + ih} stroke={C.ink} strokeOpacity={0.15} strokeWidth={2} />
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={x(i)} cy={y(p[1])} r={i === year ? 6 : 4.5} fill={C.ink} stroke="#fff" strokeWidth={2} />
          <Circle cx={x(i)} cy={y(bud[i])} r={4} fill={C.gold} stroke="#fff" strokeWidth={2} />
          <Rect x={x(i) - iw / 6} y={m.t} width={iw / 3} height={ih} fill="transparent"
            onPress={() => onYear(i as 0 | 1 | 2 | 3)} accessibilityLabel={yrs[i]} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

/* ---------- good to know: how prices are moving ---------- */

function TrendChart({ state, type, t, stateName, typeName }: { state: string; type: PxType; t: T; stateName: string; typeName: string }) {
  const tr = usePxTrend(state, type);
  if (tr.loading) return <ActivityIndicator color={C.brand} style={{ marginVertical: 16 }} />;
  const d = tr.data;
  const idx = d ? d.state.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0) : [];
  if (!d || idx.length < 5) return <BodyS muted>{t('px_trend_none')}</BodyS>;
  const a = d.state as number[], n = d.national, Q = d.quarters, N = Q.length;
  const W = 320, H = 200, m = { l: 32, r: 80, t: 10, b: 24 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = [...idx.map(i => a[i]), ...n];
  let lo = Math.min(...vals) - 3, hi = Math.max(...vals) + 3;
  const ticks = niceTicks(lo, hi, 4);
  lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const x = (i: number) => m.l + i * iw / (N - 1), y = (v: number) => m.t + ih - (v - lo) / (hi - lo) * ih;
  const f = Q.indexOf('2024Q4');
  const first = idx[0], lastI = idx[idx.length - 1], yearAgo = idx.find(i => i >= lastI - 4) ?? first;
  const ya = y(a[lastI]), yn = y(n[N - 1]), gap = Math.abs(ya - yn) < 13 ? (ya < yn ? -7 : 7) : 0;
  const short = state === 'KUL' ? 'KL' : stateName;
  return (
    <View>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: W / H }} accessibilityLabel={t('px_trend', { type: typeName, state: stateName })}>
        {f >= 0 ? <Rect x={x(f)} y={m.t} width={x(N - 1) - x(f)} height={ih} fill="#FFF4D6" /> : null}
        {ticks.map(v => (
          <React.Fragment key={v}>
            <Line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke={LINE} />
            <SvgText x={m.l - 6} y={y(v) + 4} fontSize={10} fill={INK3} textAnchor="end" fontFamily={DISP_FONT}>{String(v)}</SvgText>
          </React.Fragment>
        ))}
        {Q.map((q, i) => (q.endsWith('Q1') ? (
          <SvgText key={q} x={x(i)} y={H - 6} fontSize={10} fill={INK3} textAnchor="middle" fontFamily={DISP_FONT}>{q.slice(0, 4)}</SvgText>
        ) : null))}
        <Polyline points={n.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={INK3} strokeWidth={2} strokeLinejoin="round" />
        <Polyline points={idx.map(i => `${x(i)},${y(a[i])}`).join(' ')} fill="none" stroke={C.brand} strokeWidth={2.5} strokeLinejoin="round" />
        <SvgText x={x(N - 1) + 6} y={ya + 4 + gap} fontSize={11} fontFamily={XBOLD_FONT} fill={C.ink}>{`${short} ${a[lastI].toFixed(0)}`}</SvgText>
        <SvgText x={x(N - 1) + 6} y={yn + 4 - gap} fontSize={11} fontFamily={DISP_FONT} fill="#5B6E6F">{`MY ${n[N - 1].toFixed(0)}`}</SvgText>
      </Svg>
      <Legend items={[{ c: C.brand, label: stateName, line: true }, { c: INK3, label: t('px_my'), line: true }]} />
      <BodyS muted style={{ fontSize: 12, marginTop: 6 }}>
        {t('px_trend_note', { q: Q[first].slice(0, 4), a: pct(a[lastI] / a[first] - 1), b: pct(a[lastI] / a[yearAgo] - 1, 1) })}
      </BodyS>
      <View style={st.note}>
        <View style={st.noteIc}><Text style={{ fontFamily: XBOLD_FONT, fontSize: 13, color: C.ink }}>!</Text></View>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 19, color: C.ink, flex: 1 }}>{t('px_fresh')}</Text>
      </View>
      <View style={{ marginTop: 8 }}><Prov p="model" /></View>
    </View>
  );
}

/* ---------- the page ---------- */

/* The price to explore, typed or slid. Shown with commas; tapping selects it, so typing replaces it. */
function PriceInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [text, setText] = React.useState<string | null>(null);
  const commit = () => {
    const n = Number((text ?? '').replace(/[^\d]/g, ''));
    setText(null);
    if (n > 0) onCommit(Math.min(PX_MAX, Math.max(PX_MIN, Math.round(n / 1000) * 1000)));
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={st.big}>RM</Text>
      <TextInput
        value={text ?? nf(value)} selectTextOnFocus
        onChangeText={v => setText(v.replace(/[^\d]/g, ''))} onBlur={commit} onSubmitEditing={commit}
        keyboardType="number-pad" inputMode="numeric" returnKeyType="done" accessibilityLabel={label}
        testID="px-budget" style={[st.big, st.priceIn]} />
    </View>
  );
}

export function PriceExplorerScreen() {
  const { S, up, go, t } = useApp();
  const px = S.px;
  const lowerType = (k: string) => (S.lang === 'zh' ? k : k.toLowerCase());
  const typeName = (ty: PxType) => t('px_t_' + ty);
  const fromTest = fromStressTest();
  const budget = px.budget ?? startingSafePrice(S.data.house);
  const [draft, setDraft] = React.useState<number | null>(null);
  const [grow, setGrow] = React.useState(px.grow);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [pickState, setPickState] = React.useState(false);
  const shown = draft ?? budget;
  const setBudget = (v: number) => { setDraft(null); up(s => { s.px.budget = v; }); };

  const scroll = React.useRef<ScrollView | null>(null);
  /* each step's offset inside the steps column, plus the column's own offset in the page */
  const ys = React.useRef<Record<string, number>>({});
  const base = React.useRef(0);
  const toStep = (k: string) => scroll.current?.scrollTo({ y: Math.max(0, base.current + (ys.current[k] ?? 0) - 8), animated: true });
  const at = (k: string) => (e: LayoutChangeEvent) => { ys.current[k] = e.nativeEvent.layout.y; };

  /* step 3: one call per state drawn on the chosen state's map (Selangor's also holds KL and
     Putrajaya); keep the last figures while a new price loads */
  const group = groupOf(px.state);
  const mapStates = group?.states ?? [px.state];
  const a1 = usePxAreas(mapStates[0] ?? null, px.type, budget);
  const a2 = usePxAreas(mapStates[1] ?? null, px.type, budget);
  const a3 = usePxAreas(mapStates[2] ?? null, px.type, budget);
  const calls = [a1, a2, a3].slice(0, mapStates.length);
  const lastAreas = React.useRef<{ key: string; list: PxAreasResponse['areas'] } | null>(null);
  const areaErr = calls.map(c => c.error).find(e => e != null) ?? null;
  const areasKey = `${px.type}|${mapStates.join(',')}`;
  if (calls.every(c => c.data)) {
    lastAreas.current = { key: areasKey, list: calls.flatMap(c => c.data!.areas) };
  }
  const areas = lastAreas.current?.key === areasKey ? lastAreas.current.list : null;
  const inMap = new Set((areas ?? []).map(a => a.district));
  const shares: Record<string, number | null> = {}, typical: Record<string, number | null> = {};
  (areas ?? []).forEach(a => { shares[a.district] = a.share_under; typical[a.district] = a.typical; });

  const home = usePxHome(px.district, px.type, px.tenure, px.size);
  const h: PxHomeResponse | null = home.data;
  /* the model has no leasehold (or freehold) homes here: follow what it has */
  React.useEffect(() => {
    if (h && h.tenure !== px.tenure) up(s => { s.px.tenure = h.tenure; });
  }, [h, px.tenure, up]);

  /* picking a district unlocks steps 4-5 and brings them into view once laid out */
  const pick = (d: string) => {
    up(s => { s.px.district = d; });
    setTimeout(() => toStep('s4'), 150);
  };

  const priceYear = h ? Number(h.meta.price_level_quarter.slice(0, 4)) : 2026;
  const pts = h ? [[h.today.p10, h.today.p50, h.today.p90], ...h.future.map(f => [f.p10, f.p50, f.p90])] : [];
  const bud = [0, 1, 2, 3].map(y => shown * Math.pow(1 + grow / 100, y));

  /* the bottom button always names the next move */
  const cta = !px.district
    ? { label: t('px_cta_pick'), onPress: () => toStep('s3'), note: null as string | null }
    : !h ? { label: t('px_cta_type'), onPress: () => toStep('s2'), note: null }
      : {
        label: t('px_cta_test', { p: rmK(h.today.p50) }),
        note: null,
        onPress: () => {
          up(s => { s.data.house.price = h.today.p50; s.data.house.knownPayment = null; });
          go('house');
        },
      };

  const typeLower = lowerType(typeName(px.type));
  const distName = px.district ?? '';
  const sim = h ? shareSimilar(h.today, shown) : 0;
  const tone = verdictTone(sim);
  const verdict = sim >= 0.9 ? t('px_v_all') : sim >= 0.5 ? t('px_v_typ', { n: Math.round(sim * 10) })
    : sim >= 0.1 ? t('px_v_some', { n: Math.max(1, Math.round(sim * 10)) }) : t('px_v_none');
  const yr = px.year;
  const P = pts[yr];
  const prob = yr && h ? h.future[yr - 1].prob_lower : null;
  const nf10 = prob == null ? 0 : Math.round(prob * 10);
  const c50 = pts.length ? bud.findIndex((b, i) => b >= pts[i][1]) : -1;
  const c10 = pts.length ? bud.findIndex((b, i) => b >= pts[i][0]) : -1;
  const catchTxt = c50 === 0 ? t('px_c_now') : c50 > 0 ? t('px_c_typ', { n: c50 })
    : c10 === 0 ? t('px_c_low_now') : c10 > 0 ? t('px_c_low', { n: c10 }) : t('px_c_never');
  const catchTone: Tone = c50 >= 0 ? 'ok' : c10 >= 0 ? 'warn' : 'bad';
  const stateCode = (px.district && group?.d[px.district]?.s) || px.state;
  const stateName = t('px_st_' + stateCode);
  const sizeLbl = (b: PxSize) => t('px_' + b);
  const listOrder = [...inMap].sort((a, b) => (shares[b] ?? -1) - (shares[a] ?? -1) || (typical[a] ?? 9e9) - (typical[b] ?? 9e9));
  /* a tick only for what the person has actually done; the next move is gold */
  const s1: StepState = fromTest || px.budget != null ? 'done' : 'todo';
  const s2: StepState = px.typeSet ? 'done' : 'todo';

  return (
    <ScreenShell back title={t('px_title')} scrollRef={scroll}
      under={( /* where you are: price, type, district; each jumps to its step */
        <View style={st.summary}>
          <Pressable onPress={() => toStep('s1')} style={[st.sChip, { backgroundColor: '#FFE7A3' }]} accessibilityRole="button">
            <Text style={st.sChipT}>{rmK(shown)}</Text>
          </Pressable>
          <Pressable onPress={() => toStep('s2')} style={st.sChip} accessibilityRole="button">
            <Text style={st.sChipT}>{typeName(px.type)}</Text>
          </Pressable>
          <Pressable onPress={() => toStep('s3')} style={[st.sChip, { backgroundColor: '#E2F1F1' }]} accessibilityRole="button">
            <Text style={[st.sChipT, !px.district && { fontFamily: DISP_FONT, color: '#5B6E6F' }]}>{px.district ?? t('px_chip_pick')}</Text>
          </Pressable>
        </View>
      )}
      footer={(
        <View style={st.cta}>
          <Pressable onPress={cta.onPress} accessibilityRole="button" style={st.gold} testID="px-cta">
            <Text style={{ fontFamily: XBOLD_FONT, fontSize: 16, color: C.ink, textAlign: 'center' }}>{cta.label}</Text>
          </Pressable>
          {cta.note ? <Text style={st.ctaNote}>{cta.note}</Text> : null}
        </View>
      )}>
      {/* what this page does for you, before anything else */}
      <Text style={st.intro}>{t('px_intro')}</Text>

      <View onLayout={e => { base.current = e.nativeEvent.layout.y; }}>
        <View onLayout={at('s1')}>
        <GuideTarget id="px.price">
          <Step n={1} state={s1} title={t(fromTest ? 'px_s1' : 'px_s1_explore')} why={t(fromTest ? 'px_s1_why' : 'px_s1_none')}>
            <View style={[st.card, st.cardGold]}>
              <PriceInput value={shown} onCommit={setBudget} label={t(fromTest ? 'px_slider' : 'px_price_a')} />
              <Slider value={shown} min={PX_MIN} max={PX_MAX} step={10000} label={t('px_slide_a')}
                onChange={setDraft} onDone={setBudget} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={st.tiny}>RM 150k</Text><Text style={st.tiny}>RM 1.5m</Text>
              </View>
            </View>
          </Step>
        </GuideTarget>
        </View>

        <Step n={2} state={s2} title={t('px_s2')} onLayout={at('s2')}>
          <View style={st.chips}>
            {PX_TYPES.map(k => (
              <Pressable key={k} onPress={() => up(s => { s.px.type = k; s.px.typeSet = true; })} accessibilityRole="button"
                accessibilityState={{ selected: px.type === k }} style={[st.chip, px.type === k && st.chipOn]}>
                <Text style={{ fontFamily: XBOLD_FONT, fontSize: 14, color: px.type === k ? '#fff' : C.ink }}>{typeName(k)}</Text>
              </Pressable>
            ))}
          </View>
        </Step>

        <View onLayout={at('s3')}>
        <GuideTarget id="px.map">
          <Step n={3} state={px.district ? 'done' : 'now'} title={t('px_s3')}>
            {!px.district ? (
              <View style={st.hint}>
                <Text style={{ fontSize: 18 }}>👆</Text>
                <Text style={{ fontFamily: XBOLD_FONT, fontSize: 14, color: '#6E4C00', flex: 1 }}>{t('px_hint_tap')}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => setPickState(true)} accessibilityRole="button" style={st.stateBtn} testID="px-state">
              <Text style={st.stateLbl}>{t('px_state')}</Text>
              <Text style={st.stateVal} numberOfLines={1}>{t('px_st_' + px.state)}</Text>
              <Text style={{ color: '#5B6E6F', fontSize: 12 }}>▾</Text>
            </Pressable>
            <Tabs label={t('px_s3')} value={px.view} onChange={v => up(s => { s.px.view = v; })}
              options={[{ key: 'list', label: t('px_v_list') }, { key: 'map', label: t('px_v_map') }]} />
            {areaErr === 503 ? (
              <BodyS muted style={{ textAlign: 'center', paddingVertical: 18 }}>{t('px_unloaded')}</BodyS>
            ) : areaErr != null && !areas ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 18 }}>
                <BodyS muted style={{ textAlign: 'center' }}>{t('px_error')}</BodyS>
                <Pressable onPress={() => calls.forEach(c => c.retry())} style={st.ghost}>
                  <Text style={{ fontFamily: XBOLD_FONT, color: C.brand }}>{t('px_retry')}</Text>
                </Pressable>
              </View>
            ) : !areas ? (
              <View style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
                <ActivityIndicator color={C.brand} />
                <BodyS muted>{t('px_loading')}</BodyS>
              </View>
            ) : px.view === 'map' ? (
              <>
                <DistrictMap stateCode={px.state} shares={shares} inState={d => inMap.has(d)} sel={px.district} onPick={pick} t={t}
                  label={t('px_map_a', { s: t('px_st_' + px.state) })} />
                <Text style={[st.tiny, { color: C.ink, fontFamily: XBOLD_FONT, marginTop: 8 }]}>{t('px_legend', { type: typeLower, p: rmK(shown) })}</Text>
                <Legend items={[
                  { c: R1, label: t('px_lg1') }, { c: R2, label: t('px_lg2') }, { c: R3, label: t('px_lg3') },
                  { c: R4, label: t('px_lg4') }, { c: '#EEF1F1', label: t('px_lg0'), hatch: true },
                ]} />
              </>
            ) : (
              <View style={[st.card, { paddingVertical: 4, paddingHorizontal: 8 }]}>
                <Text style={[st.tiny, { color: C.ink, fontFamily: XBOLD_FONT, padding: 6 }]}>{t('px_legend', { type: typeLower, p: rmK(shown) })}</Text>
                {listOrder.map((d, i) => {
                  const sh = shares[d] ?? null, on = d === px.district;
                  return (
                    <Pressable key={d} onPress={() => pick(d)} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={[st.item, { borderTopWidth: 1, borderTopColor: LINE }, on && { backgroundColor: '#E2F1F1' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: XBOLD_FONT, fontSize: 15, color: C.ink }}>{d}</Text>
                        <Text style={st.tiny}>{typical[d] ? t('px_typ_k', { p: rmK(typical[d]!) }) : t('px_nosales')}</Text>
                      </View>
                      {sh === null ? (
                        <Text style={st.pillMid}>{t('px_few')}</Text>
                      ) : (
                        <>
                          <View style={st.lTrack}><View style={{ height: 8, width: `${Math.max(3, sh * 100)}%`, backgroundColor: R3 }} /></View>
                          <Text style={{ fontFamily: XBOLD_FONT, width: 40, textAlign: 'right', color: C.ink }}>{Math.round(sh * 100)}%</Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Step>
        </GuideTarget>
        </View>

        <View onLayout={at('s4')}>
        <GuideTarget id="px.home">
          <Step n={4} state={!px.district ? 'locked' : 'now'}
            title={px.district ? t('px_s4', { type: typeLower, district: distName }) : t('px_s4_pre')}
            why={!px.district ? t('px_s4_lock') : home.error === 404 ? t('px_s4_none') : undefined}>
            {!px.district ? null : home.error === 404 ? (
              <View style={[st.card, st.cardTint]}>
                <Pressable onPress={() => toStep('s2')} style={st.ghost}>
                  <Text style={{ fontFamily: XBOLD_FONT, color: '#28666A' }}>{t('px_change_type')}</Text>
                </Pressable>
              </View>
            ) : home.error != null ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 18 }}>
                <BodyS muted style={{ textAlign: 'center' }}>{t(home.error === 503 ? 'px_unloaded' : 'px_error')}</BodyS>
                <Pressable onPress={home.retry} style={st.ghost}><Text style={{ fontFamily: XBOLD_FONT, color: C.brand }}>{t('px_retry')}</Text></Pressable>
              </View>
            ) : !h ? (
              <ActivityIndicator color={C.brand} style={{ marginVertical: 30 }} />
            ) : (
              <>
                {/* the answer first */}
                <Hero top={(
                  <>
                    <Text style={st.heroLbl}>{t('px_range')}</Text>
                    <Text style={st.heroBig} testID="px-range">{`${rmK(h.today.p10)} – ${rmK(h.today.p90).replace('RM ', '')}`}</Text>
                    <Text style={st.heroSub}>
                      {t('px_typical_line', { p: rm(h.today.p50) })} · {h.size_m2} m²{h.storeys ? ` · ${t('px_storey', { n: h.storeys })}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row' }}>
                      <Badge tone={tone} text={t('px_' + tone)} />
                    </View>
                  </>
                )}>
                  <RangeBar band={h.today} you={shown} t={t} />
                  <Text style={{ fontFamily: XBOLD_FONT, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 6 }}>{verdict}</Text>
                  <View style={st.facts}>
                    <Fact v={rm(Math.round(instalment(h.today.p50, S.data.house.rate, S.data.house.years)))}
                      k={t('px_inst', { r: S.data.house.rate, y: S.data.house.years })} />
                    <Fact v={nf(h.n_sales_2y)} k={t('px_basis')} />
                  </View>
                  <View style={{ marginTop: 10 }}><Prov p="model" /></View>
                </Hero>
                {/* then the choices that change it */}
                <Accordion title={t('px_adjust')} open={!!open.adjust} onToggle={() => setOpen(o => ({ ...o, adjust: !o.adjust }))} testID="px-adjust">
                  <Text style={st.lbl}>{t('px_size_a')}</Text>
                  <Tabs label={t('px_size_a')} value={px.size} onChange={v => up(s => { s.px.size = v; })}
                    options={(['small', 'typical', 'large'] as PxSize[]).map(b => ({
                      key: b, label: sizeLbl(b), sub: h.sizes[b] ? `${h.sizes[b]} m²` : '', disabled: !h.sizes[b],
                    }))} />
                  <Text style={st.lbl}>{t('px_tenure_a')}</Text>
                  <Tabs label={t('px_tenure_a')} value={px.tenure} onChange={v => up(s => { s.px.tenure = v; })}
                    options={[
                      { key: 'F', label: t('px_free'), sub: t('px_free_d'), disabled: !h.tenures_available.includes('F') },
                      { key: 'L', label: t('px_lease'), sub: t('px_lease_d'), disabled: !h.tenures_available.includes('L') },
                    ]} />
                </Accordion>
                <Accordion title={t('px_why')} open={!!open.why} onToggle={() => setOpen(o => ({ ...o, why: !o.why }))}>
                  <Text style={[st.tiny, { marginBottom: 6 }]}>{t('px_why_note')}</Text>
                  <Drivers items={h.drivers} t={t} />
                </Accordion>
              </>
            )}
          </Step>
        </GuideTarget>
        </View>

        <Step n={5} onLayout={at('s5')} state={px.district && h ? 'now' : 'locked'} title={t('px_s5')}
          why={px.district && h ? t('px_s5_why') : t('px_s5_lock')}>
          {!px.district || !h || !P ? null : (
            <>
              <Hero top={(
                <>
                  <Text style={st.heroLbl}>
                    {yr ? t('px_future_lbl', { yr: priceYear + yr }) : t('px_now_lbl')}
                  </Text>
                  <Text style={st.heroBig}>{`${rmK(P[0])} – ${rmK(P[2]).replace('RM ', '')}`}</Text>
                  <Text style={st.heroSub}>
                    {t('px_typical_line', { p: rm(P[1]) })}
                    {yr ? ` ${t('px_vs_today', { p: rmK(pts[0][1]), c: pct(P[1] / pts[0][1] - 1) })}` : ''}
                  </Text>
                </>
              )}>
                {/* one plain sentence; the charts live under More detail */}
                <Text style={st.sub}>
                  {yr && prob != null ? (
                    <Text style={{ fontFamily: XBOLD_FONT, color: C.ink }}>
                      {nf10 < 1 ? t('px_chance_line_lt') : t('px_chance_line', { n: nf10 })}
                    </Text>
                  ) : null}
                  {h.trend ? ` ${t(h.trend.annual >= 0 ? 'px_rising' : 'px_falling', { p: pct(Math.abs(h.trend.annual), 1).replace('+', '') })}` : ''}
                </Text>
              </Hero>
              <Accordion title={t('px_more')} open={!!open.more} onToggle={() => setOpen(o => ({ ...o, more: !o.more }))} testID="px-more">
                <Tabs label={t('px_when_a')} value={yr} onChange={v => up(s => { s.px.year = v; })}
                  options={([0, 1, 2, 3] as const).map(i => ({ key: i, label: t(['px_today', 'px_y1', 'px_y2', 'px_y3'][i]) }))} />
                <FanChart pts={pts} bud={bud} year={yr} onYear={v => up(s => { s.px.year = v; })} t={t} />
                <Legend items={[
                  { c: R2, label: t('px_lg_range') }, { c: C.ink, label: t('px_lg_typ'), line: true },
                  { c: C.gold, label: t('px_lg_you'), line: true },
                ]} />
                {yr && prob != null ? (
                  <>
                    <Text style={[st.lbl, { marginTop: 12 }]}>{t('px_chance')}</Text>
                    <View style={{ flexDirection: 'row', gap: 4, marginVertical: 6 }} accessibilityLabel={t('px_chance_n', { n: nf10 })}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <Svg key={i} width={24} height={24} viewBox="0 0 24 24">
                          <Path d="M3 11 12 4l9 7v9H3z" fill={i < nf10 ? C.short : SOFT} stroke={i < nf10 ? C.short : LINE2}
                            strokeWidth={1.5} strokeLinejoin="round" />
                        </Svg>
                      ))}
                    </View>
                  </>
                ) : null}
                <View style={[st.card, st.cardTint, { marginTop: 10, marginBottom: 0 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[st.lbl, { margin: 0, flex: 1 }]}>{t('px_catch')}</Text>
                    <Text style={{ fontFamily: XBOLD_FONT, color: C.ink }}>{grow}%</Text>
                  </View>
                  <Slider value={grow} min={0} max={8} step={0.5} label={t('px_grow_a')} onChange={setGrow}
                    onDone={v => up(s => { s.px.grow = v; })} />
                  <Badge tone={catchTone} text={catchTxt} wide />
                </View>
              </Accordion>
            </>
          )}
        </Step>
      </View>

      <View>
        <Text style={[st.lbl, { marginLeft: 2, marginBottom: 8 }]}>{t('px_good')}</Text>
        <Accordion title={t('px_trend', { type: typeLower, state: stateName })} open={!!open.market}
          onToggle={() => setOpen(o => ({ ...o, market: !o.market }))} testID="px-trend">
          <TrendChart state={stateCode} type={px.type} t={t} stateName={stateName} typeName={typeLower} />
        </Accordion>
        <Accordion title={t('px_sure')} open={!!open.sure} onToggle={() => setOpen(o => ({ ...o, sure: !o.sure }))} testID="px-sure">
          <Sure h={h} t={t} />
        </Accordion>
      </View>
      {pickState ? (
        <PickSheet title={t('px_state')} value={px.state} onClose={() => setPickState(false)}
          options={PX_STATES.map(c => ({ key: c, label: t('px_st_' + c) })).sort((a, b) => a.label.localeCompare(b.label))}
          onPick={c => up(s => { if (s.px.state !== c) { s.px.state = c; s.px.district = null; } })} />
      ) : null}
    </ScreenShell>
  );
}

function Drivers({ items, t }: { items: PxHomeResponse['drivers']; t: T }) {
  const shown = items.filter(d => d.band !== d.reference);
  const mx = Math.max(1e-9, ...shown.map(d => Math.abs(d.effect_pct)));
  return (
    <View>
      {shown.map((d, i) => {
        const w = Math.abs(d.effect_pct) / mx * 50;
        return (
          <View key={`${d.feature}-${d.band}`} style={[st.drv, i > 0 && { borderTopWidth: 1, borderTopColor: LINE }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 13.5, lineHeight: 17, color: C.ink }}>{`${d.description}: ${d.band}`}</Text>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: INK3 }}>{t('px_vs', { r: d.reference })}</Text>
            </View>
            <Svg width={104} height={14} viewBox="0 0 104 14">
              <Line x1={52} y1={0} x2={52} y2={14} stroke={LINE2} />
              <Rect x={d.effect_pct >= 0 ? 52 : 52 - w} y={3} width={w} height={8} rx={3} fill={d.effect_pct >= 0 ? R3 : C.short} />
            </Svg>
            <Text style={{ fontFamily: XBOLD_FONT, fontSize: 13.5, width: 44, textAlign: 'right', color: C.ink }}>
              {`${d.effect_pct > 0 ? '+' : ''}${d.effect_pct.toFixed(1)}%`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Sure({ h, t }: { h: PxHomeResponse | null; t: T }) {
  if (!h) return <BodyS muted>{t('px_sure_pick')}</BodyS>;
  const a = h.accuracy, m = h.meta;
  return (
    <View style={{ gap: 6 }}>
      {m.test_sales ? <BodyS>{t('px_sure_test', { n: m.test_sales.toLocaleString('en-MY') })}</BodyS> : null}
      {a ? (
        <View style={st.facts}>
          <Fact v={t('px_chance_n', { n: Math.round(a.within_20pct * 10) })} k={t('px_sure_w20')} />
          <Fact v={`${Math.round(a.coverage80 * 100)}%`} k={t('px_sure_cov')} />
        </View>
      ) : null}
      <BodyS>{t('px_sure_all')}</BodyS>
      <Text style={[st.tiny, { marginTop: 4 }]}>{t('px_sure_src')}</Text>
      <Prov p="model" />
    </View>
  );
}

const st = StyleSheet.create({
  rail: { position: 'absolute', left: 13, top: 30, bottom: 0, width: 3, borderRadius: 2, backgroundColor: LINE },
  dot: {
    position: 'absolute', left: 0, top: 0, width: 29, height: 29, borderRadius: 15, backgroundColor: '#fff',
    borderWidth: 3, borderColor: LINE2, alignItems: 'center', justifyContent: 'center',
  },
  dotNow: { borderColor: C.gold, backgroundColor: C.gold, shadowColor: '#FFF1CC', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  dotDone: { backgroundColor: C.brand, borderColor: C.brand },
  h3: { fontFamily: XBOLD_FONT, fontSize: 18, lineHeight: 23, color: C.ink, marginTop: 2 },
  why: { fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 19, color: '#5B6E6F', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 2, borderBottomWidth: 4, borderColor: LINE, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  cardGold: { borderColor: '#F3D27A', backgroundColor: '#FFF8E5' },
  cardTint: { backgroundColor: SOFT },
  big: { fontFamily: XBOLD_FONT, fontSize: 28, lineHeight: 32, color: C.ink, fontVariant: ['tabular-nums'] },
  priceIn: { flex: 1, minWidth: 0, paddingVertical: 2, borderBottomWidth: 2, borderBottomColor: '#F3D27A' },
  intro: { fontFamily: BODY_FONT, fontSize: 15, lineHeight: 22, color: C.ink },
  tiny: { fontFamily: BODY_FONT, fontSize: 12, lineHeight: 17, color: INK3 },
  lbl: { fontFamily: XBOLD_FONT, fontSize: 13, color: '#5B6E6F', marginBottom: 6 },
  sub: { fontFamily: BODY_FONT, fontSize: 14, lineHeight: 20, color: '#5B6E6F' },
  track: { height: 8, borderRadius: 4, backgroundColor: LINE, overflow: 'hidden' },
  trackOn: { height: 8, backgroundColor: C.brand },
  thumb: {
    position: 'absolute', top: 7, width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: '#fff',
    borderWidth: 3, borderColor: C.brand,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderBottomWidth: 4, borderColor: LINE, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, minHeight: 40, justifyContent: 'center' },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  tabs: { flexDirection: 'row', backgroundColor: SOFT, borderRadius: 14, padding: 4, gap: 4, marginBottom: 10 },
  tab: { flex: 1, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 4, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#fff', shadowColor: LINE2, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  hint: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFF1CC', borderWidth: 2, borderColor: '#F6D57A', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FFF4D6', borderWidth: 2, borderColor: '#F6DC8E', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  noteIc: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, marginTop: 8 },
  mapwrap: { backgroundColor: '#F2F6F6', borderRadius: 18, padding: 6 },
  stateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: LINE2, borderRadius: 12,
    paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10, backgroundColor: '#fff',
  },
  stateLbl: { fontFamily: DISP_FONT, fontSize: 12, color: '#5B6E6F' },
  stateVal: { fontFamily: XBOLD_FONT, fontSize: 15, color: C.ink, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  lTrack: { width: 70, height: 8, borderRadius: 4, backgroundColor: SOFT, overflow: 'hidden' },
  pillMid: { fontFamily: XBOLD_FONT, fontSize: 12, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: '#FFF1C9', color: '#8A6200', overflow: 'hidden' },
  hero: { borderRadius: 22, marginBottom: 10, shadowColor: '#c9d6d5', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 2, backgroundColor: '#fff' },
  heroTop: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', backgroundColor: '#17575B' },
  heroBody: { backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, borderWidth: 2, borderTopWidth: 0, borderColor: LINE, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  heroLbl: { fontFamily: XBOLD_FONT, fontSize: 13, color: 'rgba(255,255,255,0.82)', marginBottom: 6 },
  heroBig: { fontFamily: XBOLD_FONT, fontSize: 30, lineHeight: 34, color: '#fff', fontVariant: ['tabular-nums'] },
  heroSub: { fontFamily: BODY_FONT, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.9)', marginTop: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingVertical: 6, paddingLeft: 8, paddingRight: 12, marginTop: 12 },
  badgeWide: { borderRadius: 14, alignItems: 'flex-start', paddingVertical: 9, paddingLeft: 9, marginTop: 6 },
  badgeDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', gap: 8, marginTop: 10 },
  fact: { flex: 1, backgroundColor: SOFT, borderRadius: 14, padding: 10, gap: 2 },
  acc: { borderWidth: 2, borderColor: LINE, borderRadius: 16, marginBottom: 10, backgroundColor: '#fff', overflow: 'hidden' },
  accBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 52 },
  drv: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  summary: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8 },
  sChip: { backgroundColor: SOFT, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  sChipT: { fontFamily: XBOLD_FONT, fontSize: 12, color: C.ink },
  ghost: { backgroundColor: '#fff', borderWidth: 2, borderColor: LINE, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  cta: { paddingTop: 10, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: LINE },
  gold: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: C.gold, minHeight: 50, justifyContent: 'center', shadowColor: C.goldD, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  ctaNote: { fontFamily: BODY_FONT, fontSize: 12, color: INK3, textAlign: 'center', marginTop: 8 },
});
