import React from 'react';
import {
  AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp } from '../state';
import { rm as rmSen } from '../calc';
import { upfrontFees } from '../fees';
import { NumInput } from '../ui';
import { SheetFrame } from '../overlays';
import { ScreenShell } from './shell';
import {
  amort, cushion, depositAssumed, DOC_KEYS, fitOf, goalFromKept, monthlyBills, prepChecks, prepLoan, savePlan, schedRows, stageCash, typicalMonth,
  type Fit, type Loan,
} from '../prep7';
import {
  ActBar, b1, Btn2, BtnDeep, BtnGo, Chip7, Coach, Fold, G, Group, Hdr7, IconBtn, PAGE, Ph, Rich, RumaImg, Sec, Seg,
  SHADOW, T7, x,
} from './p7ui';

/* Prepare for a house, v7 design (RuMampu_Prepare_Loan_v7_1.html).
   The hub is a path: one step per question (monthly, cash, paperwork) and the
   keys at the end, with Ruma hopping to the step you tap. "Can I pay each
   month?" is a short guided lesson: one idea per screen, then three numbers
   to remember. Sizes and colours are the design's CSS values. */

/* whole ringgit: these are estimates, so sen would claim precision they do not have */
const rm = (v: number) => rmSen(Math.round(v));
const rmK = (v: number) => (v >= 1e6 ? `RM ${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}m` : `RM ${v >= 1e4 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString('en-MY')}`);

function useReduceMotion(): boolean {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setR(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setR);
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return r;
}
/* a gentle loop (the tip's bob, Ruma's idle, the pulse round the next step) */
function useLoop(ms: number, run = true): Animated.Value {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!run) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.ease), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [v, ms, run]);
  return v;
}

/* ---------------------------------------------------------------- the hub -- */

type Pt = { x: number; y: number };
const ROW = 150, TOP = 64, NODE = 80, KEY = 88, RW = 66;
const OFF = [-46, 52, -46, 40];
const segD = (a: Pt, c: Pt) => `M${a.x},${a.y} C${a.x},${a.y + ROW * 0.55} ${c.x},${c.y - ROW * 0.55} ${c.x},${c.y}`;
function bez(a: Pt, c: Pt, t: number): Pt {
  const p1 = { x: a.x, y: a.y + ROW * 0.55 }, p2 = { x: c.x, y: c.y - ROW * 0.55 }, u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * c.x,
    y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * c.y,
  };
}

/* .node .ring: progress round the step, 9px outside the knob */
/* Each step wears its own colour, like the path on Home: teal for paying each
   month, orange for upfront cash, violet for paperwork. */
const HUB_BG = '#EEF6F3';
const NH = [
  { c: '#11A09B', d: '#0B7A76', e: '#075E5B', s: '#D7F1EE', se: '#B2E2DC', ink: '#0B6F6B' },
  { c: '#FF9416', d: '#D9760A', e: '#A85400', s: '#FFE9CF', se: '#F7CF9F', ink: '#A85400' },
  { c: '#7C5CFF', d: '#5B3FD9', e: '#4429B0', s: '#E9E3FF', se: '#CFC4FF', ink: '#4A30C2' },
];

function Ring({ p, color }: { p: number; color: string }) {
  const size = NODE + 18, r = size / 2 - 3, circ = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', left: -9, top: -9 }}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={HUB_BG} />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={T7.surface3} strokeWidth={5.5} fill="none" />
      {p > 0 ? (
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5.5} fill="none"
          strokeDasharray={`${circ * Math.min(1, p)} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      ) : null}
    </Svg>
  );
}

/* Where Ruma stood and how far the path was scrolled, kept while the app is open:
   coming back from a step puts both back where they were. */
type Foot = { x: number; y: number; t: number; left: boolean; rot: number };
const HUB_MEM: { at: number | null; y: number; restore: boolean; feet: Foot[]; w: number } = { at: null, y: 0, restore: false, feet: [], w: 0 };

export function PrepareHubScreen() {
  const { S, t, go, up, toast } = useApp();
  const reduce = useReduceMotion();
  const [w, setW] = React.useState(0);
  const [pick, setPick] = React.useState(false);
  const ck = prepChecks(S), c = ck.c;
  const src = upfrontFees(S).src;
  const tests = S.keptTests.map((k, i) => ({ k, i })).filter(z => Number(z.k.propertyPrice) > 0);
  const toGo = DOC_KEYS.length - ck.dn;

  const nodes = [
    { route: 'prepmonthly' as const, ic: 'calc', tool: t('p7_title'), q: t('p7_q_loan'), fig: rm(c.mo), unit: t('p7_amonth'), ...ck.loan,
      sub: S.prep.saved ? t('p7_s_loan2') : S.prep.done ? t('p7_s_loan1') : t('p7_s_loan0'),
      next: t('p7_next_loan', { a: b1(rm(c.mo)) }), say: t('p7_say_loan') },
    { route: 'upfront' as const, ic: 'cash', tool: t('pr_upfront'), q: t('p7_q_cash'), fig: rm(ck.need), unit: t('p7_upfront'), ...ck.cash,
      sub: ck.cash.done ? t('p7_s_cash_ok') : t('p7_s_cash', { p: Math.round(ck.cashP * 100), a: rm(ck.gap) }),
      next: t('p7_next_cash', { p: Math.round(ck.cashP * 100), a: b1(rm(ck.gap)) }), say: t('p7_say_cash') },
    { route: 'docs' as const, ic: 'file', tool: t('pr_docs'), q: t('p7_q_docs'), fig: `${ck.dn} of ${DOC_KEYS.length}`, unit: t('p7_documents'), ...ck.docs,
      sub: ck.docs.done ? t('p7_s_docs_ok') : t('p7_s_docs', { n: toGo }),
      next: toGo === 1 ? t('p7_next_docs1') : t('p7_next_docs', { n: b1(toGo) }), say: t('p7_say_docs') },
  ];
  const left = nodes.filter(n => !n.done).length;
  const cur = nodes.findIndex(n => !n.done);

  /* the path in this screen's width (designed at 358) */
  const k = w ? w / 358 : 1, cx = w / 2;
  const pts: Pt[] = [0, 1, 2, 3].map(i => ({ x: cx + OFF[i] * k, y: i * ROW + TOP }));
  const side = OFF.map(o => (o < 0 ? -1 : 1));
  const standAt = (i: number): Pt => {
    const r = (i === 3 ? KEY : NODE) / 2;
    return { x: pts[i].x + side[i] * (r + RW / 2 + 6), y: pts[i].y + r + 4 };
  };

  /* Ruma stands by the step to do next, and walks to the one you tap */
  const [at, setAt] = React.useState(HUB_MEM.at ?? (cur < 0 ? 3 : cur));
  /* the step lit in teal: the one Ruma stands on (the keys stay gold) */
  const [lit, setLit] = React.useState(at);
  const [walking, setWalking] = React.useState<string | null>(null);
  const prog = React.useRef(new Animated.Value(0)).current;
  const [track, setTrack] = React.useState<{ xs: number[]; ys: number[]; flip: number; feet: Foot[] } | null>(null);
  const press = React.useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const feetRef = React.useRef<Foot[]>([]);
  /* the trail from the last walk stays on the path when you come back (same width only) */
  const oldFeet = !track && w && HUB_MEM.w === w ? HUB_MEM.feet : [];
  const bob = useLoop(1600, !reduce);
  const pulse = useLoop(2000, !reduce);
  const idle = useLoop(2400, !reduce && !walking);
  const scrollRef = React.useRef<ScrollView | null>(null);
  React.useEffect(() => {
    if (!w || !HUB_MEM.restore) return;
    HUB_MEM.restore = false;
    const y = HUB_MEM.y;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
  }, [w]);

  const open = (i: number) => {
    if (walking) return;
    const target = i === 3 ? 'pv_switch' : nodes[i].route;
    const leave = () => {
      HUB_MEM.at = i; HUB_MEM.restore = true; HUB_MEM.feet = feetRef.current; HUB_MEM.w = w;
      setAt(i); setWalking(null); setTrack(null);
      if (target === 'prepmonthly') up(s => { s.prep.step = s.prep.done ? 6 : 0; });
      go(target);
    };
    /* .node:active .knob: the step presses down 4px and comes back up */
    press[i].setValue(0);
    Animated.sequence([
      Animated.timing(press[i], { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(press[i], { toValue: 0, friction: 4, tension: 160, useNativeDriver: false }),
    ]).start();
    if (reduce || !w) { setLit(i); setTimeout(leave, 160); return; }
    const A = standAt(at), Bp = standAt(i), steps = Math.abs(i - at);
    const on = (L: number) => {
      const s0 = Math.min(2, Math.max(0, Math.floor(L))), tt = Math.min(1, Math.max(0, L - s0));
      const q = bez(pts[s0], pts[s0 + 1], tt);
      return { x: q.x, y: q.y + 4 };
    };
    const ease = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);
    const lerp = (a: Pt, c2: Pt, v: number) => ({ x: a.x + (c2.x - a.x) * v, y: a.y + (c2.y - a.y) * v });
    const feetAt = (tt: number): Pt => {
      if (!steps) return A;
      if (tt < 0.2) return lerp(A, on(at), ease(tt / 0.2));
      if (tt < 0.8) return on(at + (i - at) * ease((tt - 0.2) / 0.6));
      return lerp(on(i), Bp, ease((tt - 0.8) / 0.2));
    };
    const hops = steps ? 3 * steps + 1 : 2, N = 30 * hops, xs: number[] = [], ys: number[] = [];
    for (let n = 0; n <= N; n++) {
      const tt = n / N, p = feetAt(tt);
      const hop = Math.abs(Math.sin(Math.PI * hops * tt)) * 22;
      xs.push(p.x - RW / 2); ys.push(p.y - RW - hop);
    }
    /* a yellow footprint where each hop lands, pointing the way she walks */
    const feet: Foot[] = [];
    for (let hh = 1; hh <= hops; hh++) {
      const tt = hh / hops, p = feetAt(tt), q = feetAt(Math.max(0, tt - 0.04));
      const rot = Math.atan2(p.y - q.y, p.x - q.x) * 180 / Math.PI + 90;
      feet.push({ x: p.x + (hh % 2 ? -6 : 6), y: p.y - 6, t: tt, left: hh % 2 === 1, rot: Number.isFinite(rot) && steps ? rot : 0 });
    }
    feetRef.current = feet;
    setTrack({ xs, ys, flip: Bp.x < A.x ? -1 : 1, feet });
    setWalking(i === 3 ? t('p7_say_keys') : nodes[i].say);
    prog.setValue(0);
    /* slow enough to watch every hop, then a beat on the step before the screen opens */
    Animated.timing(prog, {
      toValue: 1, duration: steps ? 700 + 750 * steps : 700, easing: Easing.linear, useNativeDriver: false,
    }).start(() => { setLit(i); setTimeout(leave, 650); });
  };

  const shell = (children: React.ReactNode, footer?: React.ReactNode) => (
    <ScreenShell tint={HUB_BG} noScene header={<Hdr7 title={t('hh_prep')} />} contentStyle={PAGE} footer={footer}
      scrollRef={scrollRef} onScrollY={y => { HUB_MEM.y = y; }}>
      {children}
      {pick ? <HomePicker tests={tests} onClose={() => setPick(false)} /> : null}
    </ScreenShell>
  );

  if (!src.price) return shell(<EmptyHome tests={tests.length > 0} onPick={() => setPick(true)} />);

  const name = src.name || S.prep.name || t('p7_tested_home');
  const NI = (i: number) => {
    const n = nodes[i], p = pts[i], st = i === lit ? 'now' : n.done ? 'done' : 'todo', right = side[i] < 0;
    const hu = NH[i];
    const knobBg = st === 'now' ? hu.c : st === 'done' ? hu.d : hu.s;
    const edge = st === 'now' ? hu.d : st === 'done' ? hu.e : hu.se;
    const dy = press[i].interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
    return (
      <React.Fragment key={i}>
        <Pressable onPress={() => open(i)} accessibilityRole="button" testID={`prep-node-${i}`}
          accessibilityLabel={`${n.tool}: ${n.q} ${n.fig} ${n.unit}. ${n.sub}`}
          style={[h.node, { left: p.x - NODE / 2, top: p.y - NODE / 2 }]}>
          {st !== 'done' ? <Ring p={n.done ? 1 : n.p} color={hu.c} /> : null}
          {/* the 6px edge under the knob, then the knob that presses into it */}
          <View style={[h.knob, { top: 6, backgroundColor: edge }]} />
          <Animated.View style={[h.knob, { backgroundColor: knobBg, transform: [{ translateY: dy }] }]}>
            {st === 'now' && !reduce ? (
              <Animated.View pointerEvents="none" style={[h.pulse, { borderColor: hu.c,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
              }]} />
            ) : null}
            <Ph name={n.done ? 'check' : n.ic} size={34} color={st === 'todo' ? hu.ink : '#FFFFFF'} />
          </Animated.View>
          {i === lit ? (
            <Animated.View pointerEvents="none" style={[h.ntipWrap, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] }) }] }]}>
              <View style={h.ntip}>
                <Text style={h.ntipT}>{n.p > 0 ? t('p7_tip_cont') : t('p7_tip_start')}</Text>
                <View style={h.ntipTail} />
              </View>
            </Animated.View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => open(i)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[h.nlab, right ? { left: p.x + 56, alignItems: 'flex-start' } : { right: w - p.x + 56, alignItems: 'flex-end' }, { top: p.y - 52 }]}>
          <Text style={[h.tool, { color: hu.ink }, !right && { textAlign: 'right' }]}>{n.tool}</Text>
          <Text style={[h.nq, !right && { textAlign: 'right' }]}>{n.q}</Text>
          <Text style={[h.nf, !right && { textAlign: 'right' }]}>{n.fig}<Text style={h.nfu}>{` ${n.unit}`}</Text></Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            {n.done ? <Ph name="check" size={14} color={T7.ok} /> : null}
            <Text style={[h.ns, { color: n.done ? T7.ok : st === 'todo' ? T7.text2 : T7.warn }, !right && { textAlign: 'right' }]}>{n.sub}</Text>
          </View>
        </Pressable>
        {i === 0 ? (
          <Pressable onPress={() => go('buffer')} accessibilityRole="button" testID="prep-buffer"
            style={({ pressed }) => [h.bufLink, right ? { left: p.x + 56 } : { right: w - p.x + 56 }, { top: p.y + 36 }, pressed && { opacity: 0.7 }]}>
            <Ph name="shield" size={14} color={T7.accentInk} />
            <Text style={h.bufLinkT}>{t('pr_buffer')}</Text>
            <Ph name="right" size={12} color={T7.accentInk} />
          </Pressable>
        ) : null}
      </React.Fragment>
    );
  };

  const kp = pts[3];
  const sp = standAt(at);
  const atDone = at === 3 ? !left : nodes[at]?.done;
  const range = (a: number[]) => a.map((_, n) => n / (a.length - 1));
  const rumaPos = track ? {
    transform: [
      { translateX: prog.interpolate({ inputRange: range(track.xs), outputRange: track.xs }) },
      { translateY: prog.interpolate({ inputRange: range(track.ys), outputRange: track.ys }) },
      { scaleX: track.flip },
    ],
  } : {
    transform: [
      { translateX: sp.x - RW / 2 },
      { translateY: idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [sp.y - RW, sp.y - RW - 3, sp.y - RW] }) },
    ],
  };
  const H = 3 * ROW + TOP + 70;
  const keyDy = press[3].interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  return shell(
    <>
      {/* .pban: the home, and a way to change it */}
      <View style={h.banEdge}>
        <View style={h.ban} testID="prep-banner">
          <View style={h.banGlow} />
          <View style={h.banSun} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={h.banK}>{t('p7_banner_k')}</Text>
            <Text style={h.banN} numberOfLines={1}>{name}</Text>
            <Text style={h.banS}>{rm(src.price)}, {S.prep.kind === 'uc' ? t('p7_project_l') : t('p7_subsale_l')}</Text>
          </View>
          <Pressable onPress={() => setPick(true)} accessibilityRole="button" accessibilityLabel={t('p7_change')} style={h.banC}>
            <Ph name="edit" size={20} color="#EEF6F6" />
          </Pressable>
        </View>
      </View>
      {/* .pcoach: what is next */}
      <View style={[x.bub, { marginTop: 16, marginBottom: 30 }]} testID="prep-bubble">
        <Rich s={left ? `${left === 1 ? t('p7_left1') : t('p7_left', { n: left })} ${nodes[cur].next}` : t('p7_ready')}
          style={x.bubT} bold={{ color: T7.accentInk }} />
        <View style={h.bubTailD} />
      </View>
      {/* .path2 */}
      <View style={{ height: H, marginTop: 8, marginBottom: 6 }} onLayout={e => setW(e.nativeEvent.layout.width)}>
        {w ? (
          <>
            <Svg width={w} height={H} style={StyleSheet.absoluteFill}>
              {pts.slice(1).map((p, i) => (
                <Path key={i} d={segD(pts[i], p)} stroke={nodes[i]?.done ? NH[i].c : NH[i].se}
                  strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 13" fill="none" />
              ))}
            </Svg>
            {oldFeet.map((f, n) => (
              <View key={`o${n}`} pointerEvents="none" style={{ position: 'absolute', left: f.x - 5, top: f.y - 7, width: 10, height: 14, opacity: 0.55, transform: [{ rotate: `${f.rot}deg` }] }}>
                <View style={h.footSole} />
                <View style={[h.footToe, { left: f.left ? 1 : 4 }]} />
              </View>
            ))}
            {track?.feet.map((f, n) => (
              <Animated.View key={`f${n}`} pointerEvents="none" style={{
                position: 'absolute', left: f.x - 5, top: f.y - 7, width: 10, height: 14, transform: [{ rotate: `${f.rot}deg` }],
                opacity: prog.interpolate({ inputRange: [0, Math.max(0.001, f.t - 0.01), f.t, 1], outputRange: [0, 0, 1, 0.8] }),
              }}>
                <View style={h.footSole} />
                <View style={[h.footToe, { left: f.left ? 1 : 4 }]} />
              </Animated.View>
            ))}
            {[0, 1, 2].map(NI)}
            <Pressable onPress={() => open(3)} accessibilityRole="button" testID="prep-node-3"
              accessibilityLabel={`${t('p7_q_keys')} ${t('p7_keys_s')}`}
              style={{ position: 'absolute', left: kp.x - KEY / 2, top: kp.y - KEY / 2, width: KEY, height: KEY + 6 }}>
              <View style={[h.keyKnob, { top: 6, backgroundColor: T7.keyEdge }]} />
              <Animated.View style={[h.keyKnob, { transform: [{ translateY: keyDy }] }]}>
                <Ph name="key" size={38} color={T7.keyInk} />
              </Animated.View>
            </Pressable>
            <Pressable onPress={() => open(3)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
              style={[h.nlab, { right: w - kp.x + 54, top: kp.y - 30, alignItems: 'flex-end' }]}>
              <Text style={[h.nq, { textAlign: 'right' }]}>{t('p7_q_keys')}</Text>
              <Text style={[h.ns, { color: T7.warn, textAlign: 'right', marginTop: 3 }]}>{t('p7_keys_s')}</Text>
            </Pressable>
            <Animated.View pointerEvents="none" style={[h.rwalk, rumaPos]}>
              <RumaImg pose={walking || atDone ? 'happy' : 'wave'} w={RW} />
            </Animated.View>
            {walking && track ? (
              <Animated.View pointerEvents="none" style={[h.rsay, {
                transform: [
                  { translateX: prog.interpolate({ inputRange: range(track.xs), outputRange: track.xs.map(v => v + RW / 2 - 120) }) },
                  { translateY: prog.interpolate({ inputRange: range(track.ys), outputRange: track.ys.map(v => v - 36) }) },
                ],
              }]}>
                <Text style={h.rsayT}>{walking}</Text>
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </View>
      {/* how buying works */}
      <Sec title={t('p7_how')} />
      <Group>
        <Fold title={S.prep.kind === 'uc' ? t('p7_how_uc') : t('p7_how_done')} sub={t('p7_how_s')} testID="prep-how">
          <View style={{ marginBottom: 16 }}>
            <Seg wide items={[{ v: 'done' as const, l: t('p7_subsale') }, { v: 'uc' as const, l: t('p7_project') }]} on={S.prep.kind}
              onPick={v => up(s => { s.prep.kind = v; })} />
          </View>
          {S.prep.kind === 'uc' ? <ProjectTimeline c={c} /> : <SubsaleTimeline c={c} />}
        </Fold>
      </Group>
      <Pressable onPress={() => go('learn')} accessibilityRole="button" style={({ pressed }) => [h.learn, pressed && { transform: [{ translateY: 2 }] }]}>
        <View style={h.lic}><Ph name="book" size={20} color="#8A6A12" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text }}>{t('p7_learn_t')}</Text>
          <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2, marginTop: 1 }}>{t('p7_learn_d')}</Text>
        </View>
        <Ph name="right" size={17} color={T7.text3} />
      </Pressable>
    </>,
    <ActBar>
      <View style={{ flex: 1 }}>
        <BtnGo label={t('p7_pdf')} icon="download" testID="prep-pdf"
          onPress={() => { void savePlan(S, t).then(r => { if (r === 'none') toast(t('p7_pdf_blocked'), 'error'); }); }} />
      </View>
    </ActBar>,
  );
}

/* .empty + the type-in form: Prepare needs one home to work from */
function EmptyHome({ tests, onPick }: { tests: boolean; onPick: () => void }) {
  const { t, up, toast, go } = useApp();
  const [f, setF] = React.useState({ name: '', price: '', strata: false, kind: 'done' as 'done' | 'uc' });
  const use = () => {
    const v = +f.price.replace(/[^0-9]/g, '');
    if (v < 50000) { toast(t('p7_f_min'), 'error'); return; }
    up(s => {
      s.ufTest = null;
      s.prep.price = v; s.prep.name = f.name.trim(); s.prep.strata = f.strata; s.prep.kind = f.kind;
    });
    toast(t('p7_f_used'));
  };
  return (
    <>
      <View style={[x.cardx, { paddingVertical: 22, paddingHorizontal: 18, marginTop: 4 }]}>
        <View style={h.emptyIc}><Ph name="house" size={26} color={T7.accentInk} /></View>
        <Text style={h.emptyT}>{t('p7_empty_t')}</Text>
        <Text style={h.emptyP}>{t('p7_empty_b')}</Text>
        {tests ? <Btn2 label={t('p7_pick')} icon="clip" onPress={onPick} /> : null}
      </View>
      <Sec title={t('p7_or_type')} />
      <View>
        <Text style={h.lbl}>{t('p7_f_name')} <Text style={{ fontFamily: G.r, color: T7.text2 }}>{t('p7_optional')}</Text></Text>
        <TextInput value={f.name} onChangeText={v => setF(o => ({ ...o, name: v }))} placeholder={t('p7_f_name_ph')}
          placeholderTextColor={T7.text2} style={h.inp} accessibilityLabel={t('p7_f_name')} />
        <Text style={[h.lbl, { marginTop: 14 }]}>{t('p7_f_price')}</Text>
        <View style={h.pfx}>
          <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text2 }}>RM</Text>
          <TextInput value={f.price} onChangeText={v => setF(o => ({ ...o, price: v }))} placeholder={t('p7_f_price_ph')} inputMode="numeric"
            keyboardType="number-pad" placeholderTextColor={T7.text2} style={[h.inp, { borderWidth: 0, flex: 1 }]} accessibilityLabel={t('p7_f_price')} />
        </View>
        <Text style={[h.lbl, { marginTop: 14 }]}>{t('p7_f_type')}</Text>
        <View style={{ marginBottom: 14 }}>
          <Seg wide items={[{ v: 'l', l: t('p7_b_landed') }, { v: 's', l: t('p7_b_strata') }]} on={f.strata ? 's' : 'l'}
            onPick={v => setF(o => ({ ...o, strata: v === 's' }))} />
        </View>
        <Text style={h.lbl}>{t('p7_f_kind')}</Text>
        <Seg wide items={[{ v: 'done' as const, l: t('p7_subsale') }, { v: 'uc' as const, l: t('p7_project') }]} on={f.kind}
          onPick={v => setF(o => ({ ...o, kind: v }))} />
        <View style={{ marginTop: 16 }}><BtnDeep label={t('p7_f_use')} onPress={use} testID="prep-use-home" /></View>
      </View>
      {/* AC 7.1.1: already bought? Monitoring is reachable from Prepare even before a home is set here */}
      <Pressable onPress={() => go('pv_switch')} accessibilityRole="button" testID="prep-monitoring"
        style={({ pressed }) => [h.pvRow, pressed && { opacity: 0.85 }]}>
        <View style={h.pvIc}><Ph name="key" size={20} color={T7.accentInk} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text }}>{t('pr_pv')}</Text>
          <Text style={{ fontFamily: G.r, fontSize: 13, lineHeight: 18, color: T7.text2, marginTop: 2 }}>{t('pr_pv_note')}</Text>
        </View>
        <Ph name="right" size={18} color={T7.text2} />
      </Pressable>
    </>
  );
}

function HomePicker({ tests, onClose }: { tests: { k: { name?: string; propertyPrice?: number | null }; i: number }[]; onClose: () => void }) {
  const { S, t, up, go } = useApp();
  return (
    <SheetFrame pose="curious" onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: G.s, fontSize: 18, letterSpacing: -0.18, color: T7.text }}>{t('p7_pick_t')}</Text>
        <IconBtn name="x" label={t('p7_close')} onPress={onClose} />
      </View>
      <Text style={h.mk}>{t('p7_pick_from')}</Text>
      {tests.map(({ k, i }) => (
        <Pressable key={i} onPress={() => { goalFromKept(S.keptTests[i]); up(s => { s.ufTest = i; }); onClose(); }} accessibilityRole="button" style={h.opt}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text }}>{k.name || t('p7_tested_home')}</Text>
            <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2, marginTop: 1 }}>{rm(Number(k.propertyPrice) || 0)}</Text>
          </View>
          {S.ufTest === i ? <Ph name="check" size={20} color={T7.accentInk} /> : null}
        </Pressable>
      ))}
      <Pressable onPress={() => { onClose(); go('house'); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <Ph name="plus" size={17} color={T7.accentInk} />
        <Text style={{ fontFamily: G.s, fontSize: 14, color: T7.accentInk }}>{t('p7_pick_new')}</Text>
      </Pressable>
    </SheetFrame>
  );
}

/* .tl / .tli / .who */
function TlItem({ title, amt, mo, d, who, keys, last }: { title: string; amt: string; mo?: boolean; d: string; who: string[]; keys?: boolean; last?: boolean }) {
  const { t } = useApp();
  return (
    <View style={{ paddingLeft: 26, paddingBottom: last ? 4 : 18 }}>
      <View style={[h.tlDot, keys && { backgroundColor: T7.accent }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Text style={[h.tlH, { flex: 1 }]}>{title}</Text>
        <Text style={h.tlH}>{amt}{mo ? <Text style={{ fontFamily: G.m, color: T7.text2 }}>{t('p7_permo')}</Text> : null}</Text>
      </View>
      <Text style={h.tlD}>{d}</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
        {who.map(k2 => {
          const bank = k2 === 'bank' || k2 === 'p7_uc_bankst';
          return (
            <View key={k2} style={[h.who, { backgroundColor: bank ? T7.accentSoft : T7.surface2 }]}>
              <Text style={{ fontFamily: G.s, fontSize: 11.5, color: bank ? T7.accentInk : T7.text }}>{t(k2 === 'you' ? 'p7_you' : k2 === 'bank' ? 'p7_bank' : k2)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
function TlLine({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 4 }}>
      <View style={h.tlLine} />
      {children}
    </View>
  );
}
function SubsaleTimeline({ c }: { c: Loan }) {
  const { S, t } = useApp();
  const g = stageCash(S, c);
  return (
    <TlLine>
      <TlItem title={t('p7_tl_book')} amt={rm(g.book)} d={t('p7_tl_book_d')} who={['you']} />
      <TlItem title={t('p7_tl_spa')} amt={rm(g.spa)} d={t('p7_tl_spa_d')} who={['you']} />
      <TlItem title={t('p7_tl_loan')} amt={rm(g.loan)} d={t('p7_tl_loan_d')} who={['you']} />
      <TlItem title={t('p7_tl_comp')} amt={rm(c.L)} d={t('p7_tl_comp_d', { a: rm(c.L) })} who={['bank']} />
      <TlItem title={t('p7_tl_keys')} amt={rm(c.mo)} mo d={t('p7_tl_keys_d')} who={['you']} keys last />
    </TlLine>
  );
}
function ProjectTimeline({ c }: { c: Loan }) {
  const { t } = useApp();
  const rows = schedRows(c);
  const build = rows.slice(1, 9).reduce((a, r) => a + r.pct, 0);
  return (
    <>
      <TlLine>
        <TlItem title={t('p7_uc_spa')} amt={rm(c.price - c.L)} d={t('p7_uc_spa_d', { p: 100 - c.m })} who={['you']} />
        <TlItem title={t('p7_uc_build')} amt={t('p7_uc_to', { a: rm(rows[1].int), b: rm(rows[8].int) })} mo
          d={t('p7_uc_build_d', { p: build })} who={['p7_uc_bankst', 'p7_uc_int']} />
        <TlItem title={t('p7_uc_keys')} amt={rm(c.mo)} mo d={t('p7_uc_keys_d')} who={['bank', 'p7_uc_full']} keys />
        <TlItem title={t('p7_uc_title')} amt={rm(rows[10].billed + rows[11].billed)} d={t('p7_uc_title_d')} who={['bank']} last />
      </TlLine>
      <View style={{ marginTop: 6, marginHorizontal: -16, marginBottom: -16, borderTopWidth: 1, borderTopColor: T7.line }}>
        <Fold title={t('p7_sched')}>
          <View style={[h.schR, { borderBottomColor: T7.line2 }]}>
            {['p7_sch_stage', '%', 'p7_sch_billed', 'p7_sch_you', 'p7_sch_bank'].map((k2, j) => (
              <Text key={k2} style={[h.schC, h.schH, j === 0 && { flex: 2.2, textAlign: 'left' }]}>{k2 === '%' ? k2 : t(k2)}</Text>
            ))}
          </View>
          {rows.map(r => (
            <View key={r.code} style={h.schR}>
              <View style={{ flex: 2.2 }}>
                <Text style={[h.schC, { textAlign: 'left' }]}>{r.code}</Text>
                <Text style={{ fontFamily: G.r, fontSize: 11, color: T7.text2 }}>{t(r.desc)}</Text>
              </View>
              <Text style={h.schC}>{r.pct}%</Text>
              <Text style={h.schC}>{rmK(r.billed)}</Text>
              <Text style={h.schC}>{r.you ? rmK(r.you) : '-'}</Text>
              <Text style={h.schC}>{r.bank ? rmK(r.bank) : '-'}</Text>
            </View>
          ))}
          <View style={[h.schR, { borderBottomWidth: 0 }]}>
            {[t('p7_sch_total'), '100%', rmK(c.price), rmK(c.price - c.L), rmK(c.L)].map((v, j) => (
              <Text key={j} style={[h.schC, { fontFamily: G.b }, j === 0 && { flex: 2.2, textAlign: 'left' }]}>{v}</Text>
            ))}
          </View>
          <Text style={{ fontFamily: G.r, fontSize: 12, lineHeight: 17, color: T7.text2, marginTop: 10, marginHorizontal: 2 }}>{t('p7_sch_note', { r: c.rate })}</Text>
        </Fold>
      </View>
    </>
  );
}

/* ------------------------------------------------------- the monthly lesson -- */

const LS = [
  { k: 'answer', l: '', ic: '' },
  { k: 'split', l: 'p7_ls_split', ic: 'coins' },
  { k: 'pick', l: 'p7_ls_pick', ic: 'sliders' },
  { k: 'rates', l: 'p7_ls_rates', ic: 'trend' },
  { k: 'bills', l: 'p7_ls_bills', ic: 'receipt' },
  { k: 'cushion', l: 'p7_ls_cushion', ic: 'shield' },
];
const FIT_RB: Record<Fit, string> = { ok: T7.accent, warn: T7.amber, bad: T7.short };

/* .conf: a little burst when the lesson is done */
function Confetti() {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => { Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [v]);
  const cols = [T7.accent, '#E9B949', T7.interest];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: 70, width: 0, height: 0 }}>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i * 26) * Math.PI / 180, d = 100 + (i % 3) * 20;
        return (
          <Animated.View key={i} style={{
            position: 'absolute', width: 8, height: 12, borderRadius: 2, backgroundColor: cols[i % 3],
            opacity: v.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * d] }) },
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.cos(a) * d] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${i * 26}deg`, `${i * 26 + 200}deg`] }) },
            ],
          }} />
        );
      })}
    </View>
  );
}
function Hop({ children }: { children: React.ReactNode }) {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => { Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [v]);
  return (
    <Animated.View style={{ transform: [
      { translateY: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [12, -6, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 1, 1] }) },
    ] }}>{children}</Animated.View>
  );
}

export function MonthlyLessonScreen() {
  const { S, t, up, go, toast, monthName } = useApp();
  const scroll = React.useRef<ScrollView | null>(null);
  const step = Math.min(LS.length, Math.max(0, S.prep.step));
  const c = prepLoan(S);
  const month = typicalMonth(S);
  const share = month ? c.mo / month : null;
  const name = c.name || S.prep.name || t('p7_this_home');
  const setStep = (n: number) => {
    up(s => { s.prep.step = n; if (n >= LS.length) s.prep.done = true; });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const next = () => setStep(step + 1);
  const Lt = ({ children, center }: { children: string; center?: boolean }) => (
    <Text style={[l.lt, center && { textAlign: 'center' }]} accessibilityRole="header">{children}</Text>
  );

  let body: React.ReactNode = null;
  let cta = t('p7_continue');

  if (step === 0) {
    cta = t('p7_start');
    const fit = share != null ? fitOf(share) : null;
    body = (
      <>
        <Lt>{t('p7_a_t')}</Lt>
        <Coach pose="wave" s={t('p7_a_say', { h: b1(name) })} />
        <View style={l.ans} testID="lesson-answer">
          <Text style={l.big}>{rm(c.mo)}<Text style={l.bigU}>{` ${t('p7_permonth')}`}</Text></Text>
          <Text style={l.sub}>{t('p7_loan_sub', { m: c.m, r: c.rate.toFixed(2), y: c.yrs })}</Text>
          {depositAssumed(S) ? <Text style={[x.tiny, { marginTop: 4 }]} testID="lesson-deposit-note">{t('p7_dep_assumed')}</Text> : null}
          <View style={l.fitm}>
            {month && fit && share != null ? (
              <>
                <View style={l.fh}>
                  <Text style={{ fontFamily: G.r, fontSize: 13.5, color: T7.text, flex: 1 }}>{t('p7_typical')} <Text style={{ fontFamily: G.s }}>{rm(month)}</Text></Text>
                  <Chip7 label={t(`p7_fit_${fit}`)} tone={fit} />
                </View>
                <Text style={[x.tiny, { marginBottom: 6 }]} testID="lesson-fit-fact">{t('p7_fit_fact', { w: t(`p7_fit_${fit}`), a: rm(c.mo), p: Math.round(share * 100) })}</Text>
                <View style={l.fb2}>
                  <View style={[l.fb2I, { width: `${Math.min(100, share * 100)}%` }]}>
                    <Text style={l.fb2T} numberOfLines={1}>{t('p7_bar_loan', { p: Math.round(share * 100) })}</Text>
                  </View>
                </View>
                <View style={l.fl}><Text style={l.flT}>{t('p7_bar_home')}</Text><Text style={l.flT}>{t('p7_bar_else')}</Text></View>
              </>
            ) : <Text style={x.tiny}>{t('p7_typical_none')}</Text>}
          </View>
        </View>
        <View style={l.path}>
          <Text style={l.ph}>{t('p7_next_n', { n: LS.length - 1 })}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            {LS.slice(1).map((s, i) => (
              <React.Fragment key={s.k}>
                {i ? <View style={l.pl} /> : null}
                <View style={l.pn}>
                  <View style={l.pcEdge}><View style={l.pc}><Ph name={s.ic} size={17} color={T7.accentInk} /></View></View>
                  <Text style={l.pnT}>{t(s.l)}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      </>
    );
  }

  if (step === 1) {
    const ys = [1, Math.max(2, Math.round(c.yrs / 2)), c.yrs];
    const say = t('p7_s_say'), word = t('p7_interest');
    body = (
      <>
        <Lt>{t('p7_s_t', { a: rm(c.mo) })}</Lt>
        <Coach pose="count" s={say.includes(word) ? say.replace(word, b1(word)) : say} />
        <View style={x.card}>
          {ys.map(y => {
            const a = amort(c, (y - 1) * 12), ip = c.mo ? a.int / c.mo * 100 : 0;
            return (
              <View key={y} style={l.yr}>
                <Text style={l.yl}>{t('p7_year', { n: y })}</Text>
                <View style={l.ys}>
                  <View style={{ width: `${100 - ip}%`, backgroundColor: T7.accent }} />
                  <View style={{ flex: 1, backgroundColor: T7.interest }} />
                </View>
                <View style={{ width: 70, alignItems: 'flex-end' }}>
                  <Text style={l.yv}>{Math.round(ip)}%</Text>
                  <Text style={l.small11}>{t('p7_interest')}</Text>
                </View>
              </View>
            );
          })}
          <View style={l.lg2}><Lg col={T7.accent} label={t('p7_lg_prin')} /><Lg col={T7.interest} label={t('p7_lg_int')} /></View>
        </View>
        <View style={l.memo}>
          <Ph name="bulb" size={17} color={T7.memoInk} />
          <Text style={l.memoT}><Text style={{ fontFamily: G.s }}>{t('p7_remember')}</Text> {t('p7_memo')}</Text>
        </View>
      </>
    );
  }

  if (step === 2) {
    const ys = [25, 30, 35].filter(y => y <= c.maxYrs);
    if (!ys.includes(c.yrs)) ys.push(c.yrs);
    ys.sort((a2, b2) => a2 - b2);
    const rows = ys.map(y => prepLoan(S, { years: y }));
    const lo = Math.min(...rows.map(r => r.mo)), li = Math.min(...rows.map(r => r.interest));
    const margins = [80, 90].includes(c.m) ? [80, 90] : [80, 90, c.m].sort((a2, b2) => a2 - b2);
    body = (
      <>
        <Lt>{t('p7_p_t')}</Lt>
        <Coach pose="happy" s={t('p7_p_say')} />
        <View style={{ gap: 10, paddingTop: 10 }} accessibilityRole="radiogroup">
          {rows.map(r => {
            const on = r.yrs === c.yrs;
            const tag = r.mo === lo ? t('p7_tag_low') : r.interest === li ? t('p7_tag_least') : null;
            return (
              <Pressable key={r.yrs} onPress={() => up(s => { s.prep.years = r.yrs; })} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}
                testID={`lesson-years-${r.yrs}`} style={({ pressed }) => [l.opt3, on && l.opt3On, pressed && { transform: [{ translateY: 2 }] }]}>
                {tag ? <View style={l.tag}><Text style={l.tagT}>{tag}</Text></View> : null}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={l.oy}>{t('p7_years', { n: r.yrs })}</Text>
                  <Text style={l.om}>{rm(r.mo)}<Text style={l.omS}>{t('p7_permonth')}</Text></Text>
                </View>
                <Text style={l.oi}>{t('p7_int_total', { a: rm(r.interest) })}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[x.card, { marginTop: 14, paddingTop: 4, paddingBottom: 12 }]}>
          <View style={l.arow}>
            <Text style={l.arowT}>{t('p7_lends')}</Text>
            <Seg items={margins.map(v => ({ v, l: `${v}%` }))} on={c.m} onPick={v => up(s => { s.prep.margin = v; })} />
          </View>
          <Rich s={t('p7_lends_d', { a: b1(rm(c.dep)), b: b1(rm(c.L)) })} style={[x.tiny, { marginTop: 2, marginBottom: 6 }]} bold={{ color: T7.text }} />
          <View style={[l.arow, { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: T7.line }]}>
            <Text style={l.arowT}>{t('p7_age')} <Text style={{ fontFamily: G.r, color: T7.text2 }}>{t('p7_optional')}</Text></Text>
            <TextInput value={S.prep.age} placeholder={t('p7_age_ph')} placeholderTextColor={T7.text2} inputMode="numeric" keyboardType="number-pad"
              maxLength={2} accessibilityLabel={t('p7_age')} style={l.agein}
              onChangeText={v => up(s => { s.prep.age = v.replace(/[^0-9]/g, '').slice(0, 2); })} />
          </View>
          {S.prep.age ? <Rich s={t('p7_age_d', { n: b1(c.maxYrs) })} style={x.tiny} bold={{ color: T7.text }} /> : null}
        </View>
      </>
    );
  }

  if (step === 3) {
    const rr = [0, 1, 2].map(d => ({ d, c: prepLoan(S, { rate: c.rate + d }) }));
    const max = Math.max(...rr.map(r => r.c.mo));
    cta = S.prep.quiz ? t('p7_continue') : t('p7_skip');
    body = (
      <>
        <Lt>{t('p7_r_t')}</Lt>
        <Coach pose="oops" s={t('p7_r_say')} />
        <View style={x.card}>
          {rr.map(r => {
            const p = month ? r.c.mo / month : r.c.mo / max, f: Fit = month ? fitOf(p) : 'ok';
            return (
              <View key={r.d} style={l.rr}>
                <View style={{ width: 56 }}>
                  <Text style={l.rl}>{r.d ? `+${r.d}%` : t('p7_now')}</Text>
                  <Text style={l.small11}>{(c.rate + r.d).toFixed(2)}%</Text>
                </View>
                <View style={l.rb}><View style={{ width: `${Math.min(100, p * 100)}%`, height: '100%', borderRadius: 7, backgroundColor: FIT_RB[f] }} /></View>
                <View style={{ width: 84, alignItems: 'flex-end' }}>
                  <Text style={l.rv}>{rm(r.c.mo)}</Text>
                  {month ? <Text style={l.small11}>{t('p7_of_month', { p: Math.round(p * 100) })}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ marginTop: 16 }}>
          <Rich s={t('p7_quiz', { a: b1(rm(rr[1].c.mo)) })} style={l.quizP} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['yes', 'no'] as const).map(v => {
              const sel = S.prep.quiz === v;
              return (
                <Pressable key={v} onPress={() => up(s => { s.prep.quiz = v; })} accessibilityRole="radio" accessibilityState={{ checked: sel }} aria-checked={sel}
                  style={({ pressed }) => [l.qa, sel && l.qaSel, pressed && { transform: [{ translateY: 2 }] }]}>
                  <Text style={[l.qaT, sel && { color: T7.accentInk }]}>{v === 'yes' ? t('p7_yes') : t('p7_notsure')}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {S.prep.quiz ? (
          <View style={[l.fbk, { backgroundColor: S.prep.quiz === 'yes' ? T7.okSoft : T7.warnSoft }]}>
            <Ph name={S.prep.quiz === 'yes' ? 'check' : 'bulb'} size={17} color={S.prep.quiz === 'yes' ? T7.ok : T7.warn} />
            <Text style={[l.fbkT, { color: S.prep.quiz === 'yes' ? T7.ok : T7.warn }]}>
              <Text style={{ fontFamily: G.s }}>{t(S.prep.quiz === 'yes' ? 'p7_fb_yes_b' : 'p7_fb_no_b')}</Text> {t(S.prep.quiz === 'yes' ? 'p7_fb_yes' : 'p7_fb_no')}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  if (step === 4) {
    const lines = monthlyBills(S, c);
    const total = lines.reduce((a, r) => a + r.a, 0);
    const label = { inst: 'p7_b_inst', maint: 'p7_b_maint', quit: 'p7_b_quit', fire: 'p7_b_fire' } as const;
    body = (
      <>
        <Lt>{t('p7_b_t')}</Lt>
        <Coach pose="count" s={t('p7_b_say')} />
        <View style={l.rcpt}>
          {lines.map(r => (
            <View key={r.k} style={l.rl2}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: G.r, fontSize: 14, color: T7.text }}>{t(label[r.k])}</Text>
                {r.guess ? <Text style={{ fontFamily: G.r, fontSize: 11.5, color: T7.text2 }}>{t('p7_guess')}</Text> : null}
              </View>
              {r.k === 'inst' ? <Text style={{ fontFamily: G.s, fontSize: 14, color: T7.text }}>{rm(r.a)}</Text> : (
                <View style={l.pin}>
                  <Text style={{ fontFamily: G.m, fontSize: 14, color: T7.text2 }}>RM</Text>
                  <NumInput value={Math.round(r.a)} decimal={false} accessibilityLabel={t(label[r.k])}
                    onNum={n => up(s => { s.prep.mHome[r.k as 'maint' | 'quit' | 'fire'] = Math.round(n); })} style={l.pinIn} />
                </View>
              )}
            </View>
          ))}
          <View style={l.rt}>
            <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text }}>{t('p7_b_total')}</Text>
            <Text style={{ fontFamily: G.s, fontSize: 24, letterSpacing: -0.48, color: T7.text }} testID="lesson-bills-total">{rm(total)}</Text>
          </View>
          {/* .rcpt:after, the torn bottom edge */}
          <View style={l.tear} pointerEvents="none">
            {Array.from({ length: 40 }, (_, i) => <View key={i} style={l.tearDot} />)}
          </View>
        </View>
        {!S.prep.strata ? <Text style={[x.tiny, { marginTop: 14 }]}>{t('p7_b_landed_n')}</Text> : null}
      </>
    );
  }

  if (step === 5) {
    cta = t('p7_finish');
    const cu = cushion(S);
    if (!cu) {
      body = (<><Lt>{t('p7_c_t')}</Lt><Coach pose="sleepy" s={t('p7_c_none')} /><Btn2 label={t('p7_c_test')} onPress={() => go('house')} /></>);
    } else if (cu.required_amount <= 0) {
      body = (<><Lt>{t('p7_c_t')}</Lt><Coach pose="happy" s={t('p7_c_zero')} /></>);
    } else {
      const v = cu.months.map(m => m.closing_balance), hi = Math.max(0, ...v), lo = Math.min(0, ...v), sp = hi - lo || 1, z = hi / sp;
      const pct = cu.covered / cu.required_amount;
      const mon = (r?: { year: number; month: number } | null) => (r ? monthName(r.month - 1) : null);
      const fa = mon(cu.fall_start ?? cu.months[0]), fb = mon(cu.fall_end);
      body = (
        <>
          <Lt>{t('p7_c_t')}</Lt>
          <Coach pose="sleepy" s={t('p7_c_say', { a: b1(rm(cu.required_amount)) })} />
          <View style={x.card}>
            <View style={l.fh}>
              <Text style={{ fontFamily: G.r, fontSize: 13.5, color: T7.text }}>{t('p7_c_cover')} <Text style={{ fontFamily: G.s }}>{rm(cu.covered)}</Text></Text>
              <Text style={{ fontFamily: G.r, fontSize: 13.5, color: T7.text2 }}>{Math.round(pct * 100)}%</Text>
            </View>
            <View style={[l.fb2, { height: 14, marginBottom: 6 }]}>
              <View style={{ width: `${Math.min(100, pct * 100)}%`, height: '100%', borderRadius: 10, backgroundColor: T7.accent }} />
            </View>
            <View style={l.bars}>
              <View style={[l.zero, { top: `${z * 100}%` }]} />
              {v.map((val, i) => (
                <View key={i} style={{ flex: 1, height: '100%' }}>
                  <View style={val >= 0
                    ? { position: 'absolute', left: '14%', right: '14%', bottom: `${(1 - z) * 100}%`, height: `${val / sp * 100}%`, backgroundColor: T7.text2, borderRadius: 3 }
                    : { position: 'absolute', left: '14%', right: '14%', top: `${z * 100}%`, height: `${-val / sp * 100}%`, backgroundColor: T7.short, borderRadius: 3 }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
              {cu.months.map((m, i) => <Text key={i} style={l.mlab}>{monthName(m.month - 1).toUpperCase()}</Text>)}
            </View>
            {fa && fb ? <Text style={[x.tiny, { fontSize: 13, marginTop: 10 }]}>{t('p7_c_drop', { a: fa, b: fb, c: rm(cu.required_amount) })}</Text> : null}
          </View>
          {cu.still > 0 ? <Btn2 label={t('p7_c_add', { a: rm(cu.still) })} icon="plus" onPress={() => go('plan')} style={{ marginTop: 12 }} /> : null}
        </>
      );
    }
  }

  const done = step >= LS.length;
  if (done) {
    const up1 = prepLoan(S, { rate: c.rate + 1 }).mo;
    const cu = cushion(S);
    const disc = t('p7_disc'), cut = disc.indexOf('. ') + 1;
    body = (
      <>
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <Confetti />
          <Hop><RumaImg pose="happy" w={150} /></Hop>
          <Lt center>{t('p7_f_t')}</Lt>
          <Text style={{ fontFamily: G.r, fontSize: 15.5, lineHeight: 22, color: T7.text2, textAlign: 'center' }}>{t('p7_f_s', { h: name })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }} testID="lesson-remember">
          {[
            { ic: 'cal', v: rm(c.mo), s: t('p7_f_mo'), bg: T7.accentSoft, fg: T7.accentInk },
            { ic: 'trend', v: rm(up1), s: t('p7_f_up'), bg: T7.warnSoft, fg: T7.warn },
            { ic: 'shield', v: cu ? rm(cu.required_amount) : '-', s: t('p7_f_buf'), bg: T7.surface2, fg: T7.text },
          ].map(r => (
            <View key={r.s} style={[l.rem, { backgroundColor: r.bg }]}>
              <Ph name={r.ic} size={26} color={r.fg} />
              <Text style={l.remB} numberOfLines={1} adjustsFontSizeToFit>{r.v}</Text>
              <Text style={l.remS}>{r.s}</Text>
            </View>
          ))}
        </View>
        <Sec title={t('p7_f_redo')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LS.slice(1).map((s, i) => (
            <Pressable key={s.k} onPress={() => setStep(i + 1)} accessibilityRole="button" style={({ pressed }) => [l.redo, pressed && { transform: [{ translateY: 1 }] }]}>
              <Ph name={s.ic} size={17} color={T7.text} />
              <Text style={{ fontFamily: G.s, fontSize: 13.5, color: T7.text }}>{t(s.l)}</Text>
            </Pressable>
          ))}
        </View>
        <Group style={{ marginTop: 12 }}>
          <Fold title={t('p7_f_sum')}>
            {[
              [t('p7_k_price'), rm(c.price)],
              [t('p7_k_loan'), rm(c.L), t('p7_k_loan_d', { m: c.m })],
              [t('p7_k_rate'), t('p7_k_rate_v', { r: c.rate.toFixed(2) })],
              [t('p7_k_tenure'), t('p7_years', { n: c.yrs })],
              [t('p7_k_int'), rm(c.interest)],
              [t('p7_k_total'), rm(c.total)],
            ].map(([k2, v, s2], i, all) => {
              const tot = i === all.length - 1;
              return (
                <View key={k2} style={[l.kv, tot && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: tot ? G.s : G.r, fontSize: tot ? 15 : 14, color: tot ? T7.text : T7.text2 }}>{k2}</Text>
                    {s2 ? <Text style={{ fontFamily: G.r, fontSize: 12, color: T7.text2, marginTop: 2 }}>{s2}</Text> : null}
                  </View>
                  <Text style={{ fontFamily: tot ? G.b : G.s, fontSize: tot ? 15 : 14, color: T7.text }}>{v}</Text>
                </View>
              );
            })}
          </Fold>
        </Group>
        <Text style={x.disc}><Text style={{ fontFamily: G.s }}>{disc.slice(0, cut)}</Text>{disc.slice(cut)}</Text>
      </>
    );
  }

  const pdf = () => { void savePlan(S, t).then(r => { if (r === 'none') toast(t('p7_pdf_blocked'), 'error'); }); };
  const header = done
    ? <Hdr7 title={t('p7_title')} right={<IconBtn name="download" label={t('p7_pdf')} onPress={pdf} />} />
    : (
      <Hdr7 close right={null}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4, marginHorizontal: 6 }} accessibilityRole="progressbar"
          accessibilityLabel={t('p7_step', { n: step + 1, m: LS.length })} accessibilityValue={{ min: 1, max: LS.length, now: step + 1 }}>
          {LS.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: T7.surface3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: i < step ? '100%' : i === step ? '45%' : '0%', backgroundColor: T7.accent }} />
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: G.s, fontSize: 12.5, color: T7.text2, minWidth: 30, textAlign: 'right', paddingRight: 6 }}>{step + 1}/{LS.length}</Text>
      </Hdr7>
    );
  return (
    <ScreenShell tint={T7.bg} noScene header={header} contentStyle={PAGE} scrollRef={scroll}
      footer={
        <ActBar>
          {done ? (
            <>
              <View style={{ flex: 1 }}>
                <BtnGo label={S.prep.saved ? t('p7_saved') : t('p7_save')} icon={S.prep.saved ? 'check' : undefined} testID="lesson-save"
                  onPress={() => { up(s => { s.prep.saved = true; }); toast(t('p7_saved')); }} />
              </View>
              <Btn2 square label={t('p7_pdf')} icon="download" onPress={pdf} />
            </>
          ) : <View style={{ flex: 1 }}><BtnGo label={cta} onPress={next} testID="lesson-next" /></View>}
        </ActBar>
      }>
      {body}
    </ScreenShell>
  );
}

function Lg({ col, label }: { col: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: col }} />
      <Text style={{ fontFamily: G.r, fontSize: 12, color: T7.text2 }}>{label}</Text>
    </View>
  );
}

const h = StyleSheet.create({
  banEdge: { marginTop: 4, borderRadius: 16, backgroundColor: '#0B7A76', paddingBottom: 5 },
  ban: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, overflow: 'hidden',
    paddingVertical: 16, paddingRight: 16, paddingLeft: 18, backgroundColor: '#11A09B',
  },
  banGlow: { position: 'absolute', right: -60, top: -90, width: 220, height: 200, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.12)' },
  banSun: { position: 'absolute', right: 74, top: -14, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFC83D', opacity: 0.95 },
  banK: { fontFamily: G.m, fontSize: 12.5, color: 'rgba(238,246,246,0.75)' },
  banN: { fontFamily: G.s, fontSize: 19, letterSpacing: -0.19, color: '#EEF6F6', marginTop: 2 },
  banS: { fontFamily: G.r, fontSize: 13, color: 'rgba(238,246,246,0.8)', marginTop: 1 },
  banC: {
    width: 42, height: 42, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  bubTailD: {
    position: 'absolute', left: 44, bottom: -9, width: 14, height: 14, backgroundColor: T7.surface,
    borderRightWidth: 2, borderBottomWidth: 2, borderColor: T7.line2, borderBottomRightRadius: 4, transform: [{ rotate: '45deg' }],
  },
  node: { position: 'absolute', width: NODE, height: NODE + 6 },
  knob: { position: 'absolute', left: 0, top: 0, width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', left: -3, top: -3, right: -3, bottom: -3, borderRadius: 999, borderWidth: 3, borderColor: T7.accent },
  ntipWrap: { position: 'absolute', left: -60, right: -60, bottom: NODE + 6 + 10, alignItems: 'center', zIndex: 2 },
  ntip: {
    backgroundColor: T7.surface, borderWidth: 2, borderColor: T7.line2,
    borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center',
  },
  ntipT: { fontFamily: G.b, fontSize: 13.5, color: T7.accentInk },
  ntipTail: {
    position: 'absolute', bottom: -7, width: 10, height: 10, backgroundColor: T7.surface,
    borderRightWidth: 2, borderBottomWidth: 2, borderColor: T7.line2, transform: [{ rotate: '45deg' }],
  },
  nlab: { position: 'absolute', maxWidth: 168 },
  tool: { fontFamily: G.s, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: T7.accentInk, marginBottom: 2 },
  nq: { fontFamily: G.m, fontSize: 13, color: T7.text2 },
  bufLink: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1.5, borderColor: T7.line2,
    backgroundColor: T7.surface, paddingHorizontal: 10, height: 30,
  },
  bufLinkT: { fontFamily: G.s, fontSize: 12.5, color: T7.accentInk },
  nf: { fontFamily: G.s, fontSize: 20, letterSpacing: -0.4, color: T7.text, marginTop: 2 },
  nfu: { fontFamily: G.m, fontSize: 12, letterSpacing: 0, color: T7.text2 },
  ns: { fontFamily: G.s, fontSize: 12.5 },
  keyKnob: { position: 'absolute', left: 0, top: 0, width: KEY, height: KEY, borderRadius: KEY / 2, backgroundColor: T7.keyGold, alignItems: 'center', justifyContent: 'center' },
  rwalk: { position: 'absolute', left: 0, top: 0, width: RW, zIndex: 3 },
  rsay: { position: 'absolute', left: 0, top: 0, width: 240, alignItems: 'center', zIndex: 4 },
  rsayT: {
    fontFamily: G.s, fontSize: 13, color: T7.accentInk, backgroundColor: T7.surface, borderWidth: 2, borderColor: T7.line2,
    borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, overflow: 'hidden',
  },
  footSole: { position: 'absolute', left: 1, top: 4, width: 8, height: 10, borderRadius: 5, backgroundColor: T7.keyGold, borderWidth: 1, borderColor: T7.keyEdge },
  footToe: { position: 'absolute', top: 0, width: 5, height: 4, borderRadius: 3, backgroundColor: T7.keyGold },
  learn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: T7.line2,
    backgroundColor: T7.surface, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginTop: 14,
  },
  lic: { width: 42, height: 42, borderRadius: 12, backgroundColor: T7.memo, alignItems: 'center', justifyContent: 'center' },
  emptyIc: { width: 52, height: 52, borderRadius: 12, backgroundColor: T7.surface, alignItems: 'center', justifyContent: 'center' },
  emptyT: { fontFamily: G.s, fontSize: 19, letterSpacing: -0.19, color: T7.text, marginTop: 14, marginBottom: 6 },
  emptyP: { fontFamily: G.r, fontSize: 14, lineHeight: 21, color: T7.text2, marginBottom: 10 },
  lbl: { fontFamily: G.s, fontSize: 13, color: T7.text, marginBottom: 6 },
  pvRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: T7.line2, backgroundColor: T7.surface,
  },
  pvIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: T7.accentSoft, alignItems: 'center', justifyContent: 'center' },
  inp: {
    borderWidth: 1, borderColor: T7.line2, borderRadius: 12, padding: 12, fontFamily: G.r, fontSize: 15, color: T7.text, backgroundColor: T7.surface,
  },
  pfx: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: T7.line2, borderRadius: 12, paddingLeft: 12, backgroundColor: T7.surface,
  },
  mk: { fontFamily: G.s, fontSize: 13, color: T7.text2, marginTop: 16, marginHorizontal: 2, marginBottom: 4 },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: T7.line },
  tlLine: { position: 'absolute', left: 8, top: 8, bottom: 8, width: 2, backgroundColor: T7.line2 },
  tlDot: { position: 'absolute', left: 3, top: 3, width: 12, height: 12, borderRadius: 6, backgroundColor: T7.surface, borderWidth: 2.5, borderColor: T7.accent },
  tlH: { fontFamily: G.s, fontSize: 14.5, color: T7.text, fontVariant: ['tabular-nums'] },
  tlD: { fontFamily: G.r, fontSize: 13, lineHeight: 19, color: T7.text2, marginTop: 3 },
  who: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9 },
  schR: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: T7.line, gap: 4 },
  schC: { flex: 1, fontFamily: G.r, fontSize: 12, color: T7.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  schH: { fontFamily: G.s, color: T7.text2 },
});

const l = StyleSheet.create({
  lt: { fontFamily: G.s, fontSize: 24, lineHeight: 28, letterSpacing: -0.48, color: T7.text, marginTop: 10, marginHorizontal: 2, marginBottom: 6 },
  ans: { backgroundColor: T7.surface, borderRadius: 16, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, ...SHADOW },
  big: { fontFamily: G.s, fontSize: 44, lineHeight: 48, letterSpacing: -1.32, color: T7.text, fontVariant: ['tabular-nums'] },
  bigU: { fontFamily: G.m, fontSize: 16, letterSpacing: 0, color: T7.text2 },
  sub: { fontFamily: G.r, fontSize: 13.5, color: T7.text2, marginTop: 8 },
  fitm: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: T7.line },
  fh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  fb2: { height: 30, borderRadius: 10, backgroundColor: T7.surface2, overflow: 'hidden', flexDirection: 'row' },
  fb2I: { minWidth: 72, height: '100%', borderRadius: 10, backgroundColor: T7.accent, justifyContent: 'center', paddingLeft: 10 },
  fb2T: { fontFamily: G.s, fontSize: 12, color: T7.onAccent },
  fl: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  flT: { fontFamily: G.r, fontSize: 11.5, color: T7.text2 },
  path: { marginTop: 18, backgroundColor: T7.surface2, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 12 },
  ph: { fontFamily: G.s, fontSize: 13, color: T7.text2, marginHorizontal: 4, marginBottom: 12 },
  pn: { alignItems: 'center', gap: 6, width: 52 },
  pcEdge: { width: 42, height: 45, borderRadius: 21, backgroundColor: T7.line2 },
  pc: { width: 42, height: 42, borderRadius: 21, backgroundColor: T7.surface, alignItems: 'center', justifyContent: 'center' },
  pnT: { fontFamily: G.s, fontSize: 11, color: T7.text2 },
  pl: { flex: 1, height: 0, marginTop: 20, borderTopWidth: 2, borderStyle: 'dashed', borderColor: T7.line2 },
  yr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  yl: { width: 64, fontFamily: G.s, fontSize: 13.5, color: T7.text },
  ys: { flex: 1, flexDirection: 'row', height: 22, borderRadius: 7, overflow: 'hidden', gap: 2 },
  yv: { fontFamily: G.s, fontSize: 15, color: T7.text },
  small11: { fontFamily: G.m, fontSize: 11, color: T7.text2 },
  lg2: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  memo: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: T7.memo, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 12 },
  memoT: { flex: 1, fontFamily: G.r, fontSize: 13.5, lineHeight: 19.5, color: T7.memoInk },
  opt3: { borderWidth: 2, borderBottomWidth: 4, borderColor: T7.line2, backgroundColor: T7.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 2 },
  opt3On: { borderColor: T7.accent, backgroundColor: T7.accentSoft },
  tag: { position: 'absolute', top: -10, left: 14, backgroundColor: T7.accentDeep, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9 },
  tagT: { fontFamily: G.s, fontSize: 11, color: '#F4FAFA' },
  oy: { fontFamily: G.s, fontSize: 16, color: T7.text },
  om: { fontFamily: G.s, fontSize: 20, letterSpacing: -0.4, color: T7.text },
  omS: { fontFamily: G.m, fontSize: 12, letterSpacing: 0, color: T7.text2 },
  oi: { fontFamily: G.r, fontSize: 12.5, color: T7.text2 },
  arow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T7.line },
  arowT: { flex: 1, fontFamily: G.m, fontSize: 14, color: T7.text },
  agein: { width: 66, borderWidth: 1, borderColor: T7.line2, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 9, fontFamily: G.s, fontSize: 15, textAlign: 'right', color: T7.text, backgroundColor: T7.surface },
  rr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rl: { fontFamily: G.s, fontSize: 14, color: T7.text },
  rb: { flex: 1, height: 14, borderRadius: 7, backgroundColor: T7.surface2, overflow: 'hidden' },
  rv: { fontFamily: G.s, fontSize: 15, color: T7.text },
  quizP: { fontFamily: G.r, fontSize: 15, lineHeight: 21.75, color: T7.text, marginHorizontal: 2, marginBottom: 10 },
  qa: { flex: 1, height: 54, borderWidth: 2, borderBottomWidth: 4, borderColor: T7.line2, backgroundColor: T7.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qaSel: { borderColor: T7.accent, backgroundColor: T7.accentSoft },
  qaT: { fontFamily: G.s, fontSize: 15, color: T7.text },
  fbk: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 12 },
  fbkT: { flex: 1, fontFamily: G.r, fontSize: 14, lineHeight: 20 },
  rcpt: { backgroundColor: T7.surface, borderRadius: 16, paddingTop: 6, paddingHorizontal: 16, ...SHADOW },
  rl2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: T7.line2 },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinIn: { width: 112, borderWidth: 1, borderColor: T7.line2, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, fontFamily: G.s, fontSize: 15, textAlign: 'right', color: T7.text, backgroundColor: T7.surface, minHeight: 0 },
  rt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14, paddingBottom: 16 },
  tear: { position: 'absolute', left: 0, right: 0, bottom: -6, height: 6, flexDirection: 'row', overflow: 'hidden' },
  tearDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: T7.surface, marginTop: -6 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 104, marginTop: 12 },
  zero: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: T7.line2 },
  mlab: { flex: 1, textAlign: 'center', fontFamily: G.m, fontSize: 10, color: T7.text3 },
  rem: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'flex-start', gap: 6 },
  remB: { fontFamily: G.s, fontSize: 17, letterSpacing: -0.17, color: T7.text },
  remS: { fontFamily: G.r, fontSize: 11.5, lineHeight: 15, color: T7.text2 },
  redo: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderBottomWidth: 3, borderColor: T7.line2, backgroundColor: T7.surface, borderRadius: 999, height: 38, paddingHorizontal: 14 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: T7.line },
});
