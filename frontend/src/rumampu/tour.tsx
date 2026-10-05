import React from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Route, useApp } from './state';
import { RUMA_IMG } from './ruma';
import { BODY_FONT, C, DISP_FONT, XBOLD_FONT } from './theme';

/* v27b screen tips. The first time someone reaches Home, Ruma asks first:
   "Want a quick tour?" with Show me, Skip for now, and a way to turn tips off.
   Later screens offer their tour with a small hint that leaves the screen
   usable and fades on its own. The tour rings the part being explained and
   cuts it out of a dark veil; the explanation sits in a white card with a
   pointer. The ? at the top of each screen replays its tips at any time. */

export const E2E = process.env.EXPO_PUBLIC_E2E === '1';

/* ---------- what each screen's tips point at ---------- */

export const GUIDES: Partial<Record<Route, { id: string; k: string }[]>> = {
  home: [
    { id: 'home.add', k: 'g_home0' }, { id: 'home.hero', k: 'g_home1' }, { id: 'home.say', k: 'g_mo0' },
    { id: 'home.test', k: 'g_home2' }, { id: 'home.plan', k: 'g_home3' }, { id: 'tab.money', k: 'g_home4' },
    { id: 'tab.fab', k: 'g_home5' }, { id: 'tab.test', k: 'g_home6' }, { id: 'aiedge', k: 'g_home7' },
    { id: 'ghelp', k: 'g_home8' },
  ],
  money: [{ id: 'money.links', k: 'g_mo3' }, { id: 'money.hero', k: 'g_mo1' }, { id: 'money.quiet', k: 'g_mo2' }],
  househome: [
    { id: 'hh.test', k: 'g_hh1' }, { id: 'hh.costs', k: 'g_hh2' }, { id: 'hh.prep', k: 'g_hh3' },
    { id: 'hh.learn', k: 'g_hh4' }, { id: 'hh.saved', k: 'g_hh5' },
  ],
  result: [{ id: 'rx.chart', k: 'g_rx2' }, { id: 'rx.verdict', k: 'g_rx1' }, { id: 'rx.try', k: 'g_rx3' }, { id: 'rx.keep', k: 'g_rx4' }],
  homecosts: [
    { id: 'fh.seg', k: 'g_fh0' }, { id: 'fh.map', k: 'g_fh4' }, { id: 'fh.place', k: 'g_fh2' },
    { id: 'fh.sel', k: 'g_fh1' }, { id: 'fh.info', k: 'g_fh3' },
  ],
  upfront: [{ id: 'uf.chart', k: 'g_uf1' }, { id: 'uf.stage', k: 'g_uf2' }, { id: 'uf.first', k: 'g_uf3' }],
  income: [{ id: 'in.seg', k: 'g_in1' }, { id: 'in.hero', k: 'g_in2' }, { id: 'in.wm', k: 'g_in3' }],
  expenses: [{ id: 'ex.sum', k: 'g_ex1' }, { id: 'ex.wm', k: 'g_ex3' }],
  plan: [{ id: 'pl.setup', k: 'g_pl0' }, { id: 'pl.grid', k: 'g_pl3' }, { id: 'pl.phase', k: 'g_pl1' }, { id: 'pl.chips', k: 'g_pl2' }],
  learn: [{ id: 'ln.hero', k: 'g_ln0' }, { id: 'ln.badges', k: 'g_ln3' }, { id: 'ln.secs', k: 'g_ln1' }],
  pv_compare: [{ id: 'pv.cards', k: 'g_pv1' }, { id: 'pv.chart', k: 'g_pv2' }],
};

/* The screen's name in the hint and invitation. */
const GNAME: Partial<Record<Route, string>> = {
  money: 'tab_money', househome: 'tab_test', result: 'rs_title', homecosts: 'fh_title', upfront: 'pr_upfront',
  income: 'money_income', expenses: 'money_expenses', plan: 'pl_title', learn: 'hh_learn', pv_compare: 'pv_then',
};

/* ---------- marking the parts tips point at ---------- */

const targets = new Map<string, View>();
/* Parts that render nothing (a row with no data yet) are not tour steps. */
const sizes = new Map<string, number>();
const scroller: { view: ScrollView | null; frame: View | null; y: number } = { view: null, frame: null, y: 0 };
let rootView: View | null = null;

export function GuideTarget({ id, children, style }: { id: string; children: React.ReactNode; style?: object }) {
  const ref = React.useRef<View>(null);
  React.useEffect(() => {
    const v = ref.current;
    if (v) targets.set(id, v);
    return () => { if (v && targets.get(id) === v) { targets.delete(id); sizes.delete(id); } };
  }, [id]);
  return (
    <View ref={ref} collapsable={false} style={style}
      onLayout={e => sizes.set(id, e.nativeEvent.layout.height * e.nativeEvent.layout.width)}>
      {children}
    </View>
  );
}

/* The screen's scroll area, so a tip can bring its part into view. */
export function registerScroller(view: ScrollView | null, frame: View | null): void {
  scroller.view = view;
  scroller.frame = frame;
  if (!view) scroller.y = 0;
}
/* Listeners that want to know when the screen has stopped scrolling (Ruma re-parks). */
const scrollSubs = new Set<() => void>();
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
export function onScrollSettle(fn: () => void): () => void { scrollSubs.add(fn); return () => { scrollSubs.delete(fn); }; }
export function noteScroll(y: number): void {
  scroller.y = y;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => { scrollSubs.forEach(fn => fn()); }, 220);
}
export function registerRoot(view: View | null): void { rootView = view; }

type Box = { x: number; y: number; w: number; h: number };
function measure(v: View | null): Promise<Box | null> {
  return new Promise(resolve => {
    if (!v || typeof v.measureInWindow !== 'function') { resolve(null); return; }
    v.measureInWindow((x, y, w, h) => resolve(w > 0 || h > 0 ? { x, y, w, h } : null));
  });
}

function available(k: Route): number[] {
  return (GUIDES[k] || []).map((st, i) => (targets.has(st.id) && (sizes.get(st.id) ?? 1) > 0 ? i : -1)).filter(i => i >= 0);
}

/* ---------- the ? in the header ---------- */

export function GuideBtn() {
  const { S, t, up } = useApp();
  if (!S.onboarded || !S.knew || !GUIDES[S.route]) return null;
  return (
    <GuideTarget id="ghelp">
      <Pressable
        onPress={() => up(s => {
          const idx = available(s.route);
          s.tourAsk = null; s.tourHint = null;
          s.tour = idx.length ? { k: s.route, i: idx[0] } : null;
        })}
        accessibilityRole="button"
        accessibilityLabel={t('g_help')}
        hitSlop={8}
        style={st.ghelp}
      >
        <Text style={{ fontFamily: XBOLD_FONT, fontSize: 15, lineHeight: 17, color: C.brand }}>?</Text>
      </Pressable>
    </GuideTarget>
  );
}

/* ---------- the invitation, the hint and the tour ---------- */

function useReduceMotion(): boolean {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setR(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return r;
}

function Avatar({ size, bg }: { size: number; bg: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Image source={{ uri: RUMA_IMG.happy }} resizeMode="contain" style={{ width: size * 0.82, height: size * 0.82, marginBottom: -2 }} />
    </View>
  );
}

function Invite() {
  const { S, t, up, toast } = useApp();
  const k = S.tourAsk as Route;
  const home = k === 'home';
  const n = available(k).length;
  const a = React.useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  React.useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: reduce ? 0 : 420, easing: Easing.bezier(0.2, 0.9, 0.3, 1.15), useNativeDriver: true }).start();
  }, [a, reduce]);
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 60, justifyContent: 'center', paddingHorizontal: 20 }]}>
      {/* a dark, softly blurred veil, so it cannot be missed; taps on it do nothing */}
      <Pressable style={[StyleSheet.absoluteFill, st.veil]} accessible={false} onPress={() => undefined} />
      <Animated.View accessibilityViewIsModal accessibilityRole="alert" style={[st.invite, {
        opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }]}>
        <View style={st.inviteHead}>
          <Image source={{ uri: RUMA_IMG.wave }} resizeMode="contain" style={{ width: 96, height: 92 }} />
        </View>
        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
          <Text style={st.tey}>{home ? t('g_inv_home_e') : t(GNAME[k] || 'tab_home')}</Text>
          <Text accessibilityRole="header" style={st.inviteT}>{t(home ? 'g_inv_home_t' : 'g_inv_t')}</Text>
          <Text style={st.inviteB}>{t(home ? 'g_inv_home_b' : 'g_inv_b', { n })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 20 }}>
          <Pressable onPress={() => { up(s => { s.tourAsk = null; }); toast(t('g_skipped')); }}
            accessibilityRole="button" style={[st.tbtn2, { flex: 1 }]}>
            <Text style={st.tbtn2Txt}>{t('g_skip')}</Text>
          </Pressable>
          <Pressable onPress={() => up(s => {
            const idx = available(k);
            s.tourAsk = null;
            s.tour = idx.length ? { k, i: idx[0] } : null;
          })} accessibilityRole="button" style={[st.tbtn, { flex: 1 }]}>
            <Text style={st.tbtnTxt}>{t('g_show')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => { up(s => { s.tourAsk = null; s.tipsOff = true; }); toast(t('g_offed')); }}
          accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 30, justifyContent: 'center', marginTop: 10, marginBottom: 14 }}>
          <Text style={st.toff}>{t('g_off')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const HINT_MS = 9000;

function Hint({ bottom }: { bottom: number }) {
  const { S, t, up } = useApp();
  const k = S.tourHint as Route;
  const bar = React.useRef(new Animated.Value(1)).current;
  const enter = React.useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  React.useEffect(() => {
    bar.setValue(1);
    Animated.timing(enter, { toValue: 1, duration: reduce ? 0 : 450, easing: Easing.bezier(0.2, 0.9, 0.3, 1.1), useNativeDriver: true }).start();
    Animated.timing(bar, { toValue: 0, duration: HINT_MS, easing: Easing.linear, useNativeDriver: false }).start();
    const timer = setTimeout(() => up(s => { if (s.tourHint === k) s.tourHint = null; }), HINT_MS);
    return () => clearTimeout(timer);
  }, [k, bar, enter, reduce, up]);
  return (
    <Animated.View accessibilityRole="summary" style={[st.hint, { bottom }, {
      opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    }]}>
      <Avatar size={38} bg="#FFFFFF" />
      <Text style={st.hintTx}>{t('g_hint_t')}</Text>
      <Pressable onPress={() => up(s => {
        const idx = available(k);
        s.tourHint = null;
        s.tour = idx.length ? { k, i: idx[0] } : null;
      })} accessibilityRole="button" style={[st.tbtn, { minHeight: 40, paddingHorizontal: 14, backgroundColor: C.caution }]}>
        <Text style={[st.tbtnTxt, { color: C.ink, fontSize: 14 }]}>{t('g_show')}</Text>
      </Pressable>
      <Pressable onPress={() => up(s => { s.tourHint = null; })} accessibilityRole="button"
        accessibilityLabel={t('g_hint_x')} style={st.hx}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{'✕'}</Text>
      </Pressable>
      <Animated.View pointerEvents="none" style={[st.hintBar, {
        width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />
    </Animated.View>
  );
}

type Hole = { l: number; t: number; w: number; h: number };

function Tour() {
  const { S, t, up } = useApp();
  const tour = S.tour!;
  const steps = GUIDES[tour.k as Route] || [];
  const step = steps[tour.i];
  const idx = available(tour.k as Route);
  const pos = idx.indexOf(tour.i);
  const first = pos <= 0;
  const last = pos === idx.length - 1;
  const [frame, setFrame] = React.useState<{ w: number; h: number }>({ w: 390, h: 844 });
  const [hole, setHole] = React.useState<Hole | null>(null);
  const [cardH, setCardH] = React.useState(0);
  const hx = React.useRef(new Animated.Value(0)).current;
  const hy = React.useRef(new Animated.Value(0)).current;
  const hw = React.useRef(new Animated.Value(0)).current;
  const hh = React.useRef(new Animated.Value(0)).current;
  const ring = React.useRef(new Animated.Value(0)).current;
  const cardIn = React.useRef(new Animated.Value(0)).current;
  const placed = React.useRef(false);
  const reduce = useReduceMotion();

  React.useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ring, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [ring, reduce]);

  /* Bring the part into view, then ring it. The first ring grows out of its own
     centre; each next one glides from the last. */
  React.useEffect(() => {
    let alive = true;
    cardIn.setValue(0);
    void (async () => {
      const target = step ? targets.get(step.id) ?? null : null;
      const root = await measure(rootView);
      let r = await measure(target);
      const view = await measure(scroller.frame);
      if (r && view && scroller.view && step && !step.id.startsWith('tab.') && step.id !== 'aiedge'
        && (r.y < view.y + 70 || r.y + r.h > view.y + view.h - 170)) {
        scroller.view.scrollTo({ y: Math.max(0, scroller.y + (r.y - view.y - 120)), animated: !reduce });
        await new Promise(res => setTimeout(res, reduce ? 60 : 380));
        r = await measure(target);
      }
      if (!alive) return;
      const ox = root?.x ?? 0, oy = root?.y ?? 0;
      if (root) setFrame({ w: root.w, h: root.h });
      const pad = 7;
      let to: Hole | null = null;
      if (r) {
        to = { l: r.x - ox - pad, t: r.y - oy - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
        const fw = root?.w ?? 390;
        /* the ring stays inside the phone, unless the part sits on its edge */
        if (r.x + r.w < ox + fw - 2) {
          const L = Math.max(10, to.l), R = Math.min(fw - 10, to.l + to.w);
          to.l = L; to.w = Math.max(0, R - L);
        }
      }
      setHole(to);
      const goal = to || { l: (root?.w ?? 390) / 2, t: (root?.h ?? 844) * 0.42, w: 0, h: 0 };
      if (!placed.current || reduce) {
        hx.setValue(goal.l + goal.w / 2); hy.setValue(goal.t + goal.h / 2); hw.setValue(0); hh.setValue(0);
      }
      placed.current = true;
      const ease = Easing.bezier(0.4, 0, 0.2, 1);
      const d = reduce ? 0 : 450;
      Animated.parallel([
        Animated.timing(hx, { toValue: goal.l, duration: d, easing: ease, useNativeDriver: false }),
        Animated.timing(hy, { toValue: goal.t, duration: d, easing: ease, useNativeDriver: false }),
        Animated.timing(hw, { toValue: goal.w, duration: d, easing: ease, useNativeDriver: false }),
        Animated.timing(hh, { toValue: goal.h, duration: d, easing: ease, useNativeDriver: false }),
      ]).start();
      Animated.timing(cardIn, { toValue: 1, duration: reduce ? 0 : 380, easing: Easing.bezier(0.2, 0.9, 0.3, 1.1), useNativeDriver: true }).start();
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.k, tour.i]);

  if (!step) return null;
  const go = (d: number) => up(s => {
    const j = idx.indexOf(tour.i) + d;
    if (j >= idx.length) { s.tour = null; return; }
    if (j < 0) return;
    s.tour = { k: tour.k, i: idx[j] };
  });
  const end = () => up(s => { s.tour = null; });

  /* the card sits below the part when there is room, otherwise above */
  let top: number;
  let below = true;
  if (hole) {
    const spaceBelow = frame.h - (hole.t + hole.h) - 24, spaceAbove = hole.t - 24;
    below = spaceBelow >= cardH + 20 || spaceBelow > spaceAbove;
    top = below ? hole.t + hole.h + 18 : hole.t - cardH - 18;
  } else {
    top = frame.h / 2 - cardH / 2;
  }
  top = Math.max(12, Math.min(frame.h - cardH - 12, top));
  const tailX = hole ? Math.max(18, Math.min(frame.w - 28 - 36, hole.l + hole.w / 2 - 14 - 10)) : 0;
  const homeTour = tour.k === 'home';

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
      {/* taps outside the card do nothing */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => undefined} />
      {/* the ringed part, cut out of a dark veil */}
      <Animated.View pointerEvents="none" style={[st.hole, {
        left: hx, top: hy, width: hw, height: hh,
      }, Platform.OS === 'web' ? ({ boxShadow: '0 0 0 9999px rgba(20,34,35,0.66)' } as object) : st.holeNative]}>
        {hole ? (
          <Animated.View style={[st.ring, { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) }]} />
        ) : null}
      </Animated.View>
      <Animated.View
        onLayout={e => setCardH(e.nativeEvent.layout.height)}
        accessibilityLiveRegion="polite"
        style={[st.tcard, { top, opacity: cardH ? cardIn : 0, transform: [{ translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
      >
        {hole ? <View style={[st.tail, below ? { top: -8 } : { bottom: -8 }, { left: tailX }]} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar size={40} bg="#E4EFEC" />
          <Text style={st.tk}>{t('g_tipof', { k: pos + 1, n: idx.length })}</Text>
          <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
            {idx.map((_, j) => (
              <View key={j} style={[st.dot, j < pos && { backgroundColor: '#A6D3D4' }, j === pos && st.dotOn]} />
            ))}
          </View>
        </View>
        <Text style={st.tx}>{t(step.k)}</Text>
        {last && !homeTour ? <Text style={st.tagain}>{t('g_again')}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {!last ? (
            <Pressable onPress={end} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
              <Text style={st.tskip}>{t('tr_skip')}</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          {!first ? (
            <Pressable onPress={() => go(-1)} accessibilityRole="button" style={[st.tbtn2, { minHeight: 40 }]}>
              <Text style={[st.tbtn2Txt, { fontSize: 14 }]}>{t('tr_back')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => (last ? end() : go(1))} accessibilityRole="button" style={[st.tbtn, { minHeight: 40 }]}>
            <Text style={[st.tbtnTxt, { fontSize: 14 }]}>{t(last ? 'g_done' : 'tr_next')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* Offers each screen's tips once, the first time it opens, and shows whichever
   of the invitation, the hint or the tour is current. */
export function TourHost({ tabBarHeight }: { tabBarHeight: number }) {
  const { S, up } = useApp();
  React.useEffect(() => {
    if (E2E || S.tipsOff || !S.onboarded || !S.knew || S.authEntryOpen) return undefined;
    if (S.tour || S.tourAsk || S.sheet || S.assistantOpen || S.lnCele) return undefined;
    const route = S.route;
    if (!GUIDES[route] || S.seenG.includes(route)) return undefined;
    /* wait for the screen's parts to mount and settle before counting them */
    const timer = setTimeout(() => up(s => {
      if (s.tour || s.tourAsk || s.sheet || s.lnCele || s.route !== route || s.seenG.includes(route)) return;
      if (!available(route).length) return;
      s.seenG.push(route);
      if (route === 'home') s.tourAsk = 'home';
      else s.tourHint = route;
    }), 700);
    return () => clearTimeout(timer);
  }, [S.route, S.tipsOff, S.onboarded, S.knew, S.authEntryOpen, S.tour, S.tourAsk, S.sheet, S.assistantOpen, S.lnCele, S.seenG, up]);

  /* a hint belongs to the screen it was offered on */
  React.useEffect(() => {
    if (S.tourHint && S.tourHint !== S.route) up(s => { s.tourHint = null; });
  }, [S.route, S.tourHint, up]);

  if (S.tour) return <Tour />;
  if (S.tourAsk) return <Invite />;
  if (S.tourHint && S.tourHint === S.route) return <Hint bottom={tabBarHeight + 16} />;
  return null;
}

const st = StyleSheet.create({
  ghelp: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.paper,
    alignItems: 'center', justifyContent: 'center',
  },
  veil: Platform.OS === 'web'
    ? ({ backgroundColor: 'rgba(16,30,31,0.66)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as object)
    : { backgroundColor: 'rgba(16,30,31,0.72)' },
  invite: {
    backgroundColor: '#FFFFFF', borderRadius: 26, overflow: 'hidden',
    shadowColor: 'rgba(8,20,21,1)', shadowOpacity: 0.5, shadowRadius: 60, shadowOffset: { width: 0, height: 28 }, elevation: 16,
  },
  inviteHead: { paddingTop: 22, paddingBottom: 6, alignItems: 'center', backgroundColor: '#E9F4F3' },
  tey: { fontFamily: XBOLD_FONT, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.7, textTransform: 'uppercase', color: C.brand, marginTop: 8, marginBottom: 4 },
  inviteT: { fontFamily: DISP_FONT, fontSize: 21, lineHeight: 26, color: C.ink, textAlign: 'center' },
  inviteB: { fontFamily: BODY_FONT, fontSize: 14.5, lineHeight: 21, color: C.ink64, marginTop: 6, textAlign: 'center' },
  tbtn: { minHeight: 46, borderRadius: 14, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  tbtnTxt: { fontFamily: XBOLD_FONT, fontSize: 15, color: '#FFFFFF' },
  tbtn2: {
    minHeight: 46, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.ink14,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14,
  },
  tbtn2Txt: { fontFamily: DISP_FONT, fontSize: 15, color: C.ink },
  toff: { fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, textDecorationLine: 'underline' },
  hint: {
    position: 'absolute', left: 12, right: 12, zIndex: 30, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#264D51', borderRadius: 18, paddingTop: 12, paddingBottom: 14, paddingLeft: 12, paddingRight: 8,
    overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(254,200,68,0.55)',
    shadowColor: 'rgba(16,30,31,1)', shadowOpacity: 0.45, shadowRadius: 34, shadowOffset: { width: 0, height: 14 }, elevation: 12,
  },
  hintTx: { flex: 1, minWidth: 0, fontFamily: DISP_FONT, fontSize: 14.5, lineHeight: 19, color: '#FFFFFF' },
  hx: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hintBar: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: C.caution },
  hole: { position: 'absolute', borderRadius: 18 },
  /* native fallback: a thin veil around the ring (no spread shadow) */
  holeNative: { borderWidth: 0 },
  ring: {
    position: 'absolute', left: -6, top: -6, right: -6, bottom: -6, borderRadius: 22,
    borderWidth: 3, borderStyle: 'dashed', borderColor: C.caution,
  },
  tcard: {
    position: 'absolute', left: 14, right: 14, zIndex: 62, backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12,
    shadowColor: 'rgba(0,0,0,1)', shadowOpacity: 0.35, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 18,
  },
  tail: { position: 'absolute', width: 20, height: 20, backgroundColor: '#FFFFFF', borderRadius: 4, transform: [{ rotate: '45deg' }] },
  tk: { fontFamily: XBOLD_FONT, fontSize: 11.5, letterSpacing: 0.7, textTransform: 'uppercase', color: C.brand },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink14 },
  dotOn: { width: 18, borderRadius: 4, backgroundColor: C.brand },
  tx: { fontFamily: BODY_FONT, fontSize: 15.5, lineHeight: 22, color: C.ink, marginTop: 10 },
  tagain: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64, marginTop: 8 },
  tskip: { fontFamily: BODY_FONT, fontSize: 13, color: C.ink64, textDecorationLine: 'underline' },
});
