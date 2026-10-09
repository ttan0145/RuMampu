import React from 'react';
import { AccessibilityInfo, Animated, Easing, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getHousingTestResult } from '../../services/housingSession';
import { AppState, useApp } from './state';
import { HousingTestResult } from '../../types/housing';
import { housingResultStale, recSpan, recordedOutFor, rm } from './calc';
import {
  feasibilityGap, planEnsure, planPhase, planResolveTarget, planToggle, potSplit, syncBufferTarget,
} from './plan';
import { villageEnsure } from './village';
import { RUMA_IMG } from './ruma';
import { IsoHouse } from './isosvg';
import { BODY_FONT, DISP_FONT, SEMI_FONT, XBOLD_FONT } from './theme';
import { phXml } from './phicons';

/* Home and Saving plan v2 (RuMampu_Home_and_Saving_2): this month (with Say it built in)
   feeds the record, which moves the person along a path to a home: Record, Test, Save,
   then Home ("Plan complete"). Every figure comes from the person's own record and test. */

/* The design's palette, shared with the Saving plan screen. */
export const K = {
  tl: '#11A09B', tlD: '#0B6F6B', tlS: '#DAF3F0', tlI: '#0A7470',
  vio: '#7C5CFF', vioD: '#5434D6', vioS: '#EEE9FF', vioI: '#5A3BE0',
  org: '#FF9416', orgD: '#D06F00', orgS: '#FFEFD8', orgI: '#A85800',
  pnk: '#FF4F80', pnkS: '#FFE5ED', pnkI: '#C2275A',
  gld: '#FFC83D', gldD: '#D69E14', gldS: '#FFF4D2', gldI: '#7A5600',
  ok: '#1C8A4C', okD: '#136136', okS: '#DDF5E6',
  text: '#1F2A44', text2: 'rgba(31,42,68,0.70)', text3: 'rgba(31,42,68,0.48)',
  line: 'rgba(31,42,68,0.10)', line2: 'rgba(31,42,68,0.17)',
  s1: '#FFFFFF', s2: '#FBF0E2', s3: '#F2E4D2',
} as const;

/* one colour family: main, its pressed-edge shade, its soft fill, its ink */
export type Hue = { c: string; d: string; s: string; i: string };
export const HUE: Record<'tl' | 'vio' | 'org' | 'pnk' | 'gld', Hue> = {
  tl: { c: K.tl, d: K.tlD, s: K.tlS, i: K.tlI },
  vio: { c: K.vio, d: K.vioD, s: K.vioS, i: K.vioI },
  org: { c: K.org, d: K.orgD, s: K.orgS, i: K.orgI },
  pnk: { c: K.pnk, d: K.pnkI, s: K.pnkS, i: K.pnkI },
  gld: { c: K.gld, d: K.gldD, s: K.gldS, i: K.gldI },
};

export function Ph({ n, c, size = 20 }: { n: string; c: string; size?: number }) {
  return <SvgXml xml={phXml(n, c, size)} width={size} height={size} />;
}

export function useStill(): boolean {
  const [still, setStill] = React.useState(false);
  React.useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined); }, []);
  return still;
}

/* A rounded button with a darker edge under it that it presses into, like the design's .btn. */
export function ChunkyBtn({ label, hue, onPress, icon, done, testID, style }: {
  label: string; hue: Hue; onPress: () => void; icon?: string; done?: boolean; testID?: string; style?: object;
}) {
  const bg = done ? K.ok : hue.c, edge = done ? K.okD : hue.d;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [hp.btn, { backgroundColor: bg, borderBottomColor: edge },
        pressed && { borderBottomWidth: 1, transform: [{ translateY: 3 }] }, style]}>
      {icon || done ? <Ph n={done ? 'check' : icon!} c="#fff" size={20} /> : null}
      <Text style={hp.btnT}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, kind }: { label: string; kind: 'ok' | 'warn' | 'bad' | 'lk' }) {
  const m = { ok: [K.okS, K.ok], warn: [K.orgS, K.orgI], bad: [K.pnkS, K.pnkI], lk: [K.s1, K.text2] }[kind];
  return (
    <View style={[hp.chip, { backgroundColor: m[0] }]}>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 11.5, color: m[1] }}>{label}</Text>
    </View>
  );
}

/* ---------- the month card (.hero2) ---------- */

const SKYLINE = '<svg viewBox="0 0 170 46" xmlns="http://www.w3.org/2000/svg"><g fill="#fff"><path d="M4 46V26l12-10 12 10v20z"/><path d="M30 46V20l16-13 16 13v26z"/><path d="M64 46V30l9-8 9 8v16z"/><path d="M84 46V14l20-14 20 14v32z"/><path d="M126 46V28l11-9 11 9v18z"/><path d="M150 46V32l8-7 8 7v14z"/></g></svg>';
const HERO_BG = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none"><defs><linearGradient id="h2" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#13A8A2"/><stop offset="1" stop-color="#0B807C"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#h2)"/></svg>';

export function HomeHero({ panel }: { panel?: React.ReactNode }) {
  const { S, t, monthName } = useApp();
  const [open, setOpen] = React.useState(false);
  const keyOf = (d: string) => (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1);
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();
  const keys = new Set([...S.data.income, ...S.data.expenses, ...S.data.workCostEntries].map(e => keyOf(e.d)));
  const key = keys.has(thisKey) ? thisKey : keys.size ? Math.max(...keys) : null;
  const income = key == null ? 0 : S.data.income.filter(e => keyOf(e.d) === key).reduce((a, e) => a + (+e.a || 0), 0);
  const ex = key == null ? 0 : S.data.expenses.filter(e => keyOf(e.d) === key).reduce((a, e) => a + (+e.a || 0), 0);
  const left = income - (key == null ? 0 : recordedOutFor(S.data, key));
  const mn = key == null ? '' : monthName(key % 12);
  return (
    <View style={hp.heroEdge}>
      <View style={hp.hero}>
        <SvgXml pointerEvents="none" xml={HERO_BG} width="100%" height="100%" style={StyleSheet.absoluteFill as object} />
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 40, opacity: 0.16 }}>
          <SvgXml xml={SKYLINE} width={150} height={40} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={hp.heroTop}>{key === thisKey ? t('hx_sofar', { m: mn }) : mn}</Text>
          <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
            style={hp.mbm}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: '#fff' }}>{t('hx_mbm')}</Text>
            <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Ph n="caret-right" c="#fff" size={14} /></View>
          </Pressable>
        </View>
        <Text style={hp.heroSub}>{t('hx_left')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, columnGap: 10 }}>
          <Text style={[hp.heroBig, left < 0 && { color: '#FFC2CF' }]} testID="home-left">{rm(left)}</Text>
          {left < 0 ? (
            <View style={hp.heroChip}>
              <Ph n="warning-circle" c="#B23A12" size={13} />
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 11.5, color: '#B23A12' }}>{t('hx_short')}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {/* the same colours as the Money card: mint for money in, pink for money out */}
          {[['arrow-up', '#0B4F4C', '#7BE0B8', t('hm_income'), income], ['arrow-down', '#8A1E3F', '#FFB3C7', t('hm_exp'), ex]].map(([ic, col, bg, lbl, v]) => (
            <View key={ic as string} style={hp.io}>
              <View style={[hp.ioIc, { backgroundColor: bg as string }]}><Ph n={ic as string} c={col as string} size={15} /></View>
              <View style={{ minWidth: 0, flexShrink: 1 }}>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>{lbl as string}</Text>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: '#fff', fontVariant: ['tabular-nums'] }}>{rm(v as number)}</Text>
              </View>
            </View>
          ))}
        </View>
        {open ? panel : null}
      </View>
    </View>
  );
}

/* ---------- Say it to Ruma, closed: one pill that types its own examples ---------- */

export function SayPill() {
  const { S, t, up, leaveSampleMonths } = useApp();
  const still = useStill();
  const ex = [t('hx_say_ex1'), t('hx_say_ex2'), t('hx_say_ex3')];
  const [i, setI] = React.useState(0);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (still) { setN(ex[i].length); return; }
    if (n < ex[i].length) {
      const timer = setTimeout(() => setN(x => x + 1), n === 0 ? 250 : 55);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => { setI(x => (x + 1) % ex.length); setN(0); }, 1800);
    return () => clearTimeout(timer);
  }, [n, i, still]); // eslint-disable-line react-hooks/exhaustive-deps
  const wave = React.useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  React.useEffect(() => {
    if (still) return;
    const loops = wave.map((v, k) => Animated.loop(Animated.sequence([
      Animated.delay(k * 150),
      Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ])));
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [still, wave]);
  const typed = ex[i].slice(0, n);
  return (
    <View style={hp.sayCard}>
      <Image source={{ uri: RUMA_IMG.wave }} style={hp.peek} resizeMode="contain" />
      <Pressable
        onPress={() => { if (S.demo) leaveSampleMonths(); up(s => { s.sayOpen = true; s.qSay = false; }); }}
        accessibilityRole="button" accessibilityLabel={t('hx_say_t')} testID="home-say"
        style={({ pressed }) => [hp.sayb, pressed && { transform: [{ translateY: 2 }] }]}>
        <View style={hp.mic}><Ph n="microphone" c="#fff" size={22} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: K.text }}>{t('hx_say_t')}</Text>
          <Text numberOfLines={1} style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: K.text2, marginTop: 2 }}>
            {t('hx_say_try', { e: typed })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24, paddingRight: 52 }}>
          {wave.map((v, k) => (
            <Animated.View key={k} style={{
              width: 4, borderRadius: 2, backgroundColor: K.tl,
              height: still ? 10 + (k % 3) * 4 : v.interpolate({ inputRange: [0, 1], outputRange: [6, 22] }),
            }} />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

/* ---------- the very first screen: the whole journey, top to bottom ---------- */

/* Before anything is recorded, Home is one winding road with the four steps as cards
   beside it, Record first. Drawn on a 330-wide grid and scaled to the screen. */
const FP = {
  w: 330, h: 560,
  stops: [{ x: 58, y: 136 }, { x: 268, y: 276 }, { x: 52, y: 380 }, { x: 268, y: 488 }],
  cards: [{ x: 96, y: 102, w: 226 }, { x: 8, y: 240, w: 222 }, { x: 96, y: 344, w: 226 }, { x: 8, y: 452, w: 222 }],
};
const FP_ROAD = 'M58,136 C150,154 268,210 268,276 C268,340 58,316 52,380 C46,446 268,424 268,488';
function firstSceneXml(): string {
  return `<svg viewBox="0 0 ${FP.w} ${FP.h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
<defs><linearGradient id="fpsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDF1F6"/><stop offset="0.55" stop-color="#EAF6E6"/><stop offset="1" stop-color="#DCEFD2"/></linearGradient></defs>
<rect width="${FP.w}" height="${FP.h}" fill="url(#fpsky)"/>
<circle cx="300" cy="28" r="14" fill="${K.gld}" opacity=".85"/>
<ellipse cx="226" cy="40" rx="16" ry="5" fill="#fff" opacity=".9"/><circle cx="220" cy="36" r="6" fill="#fff" opacity=".9"/>
<path d="${FP_ROAD}" stroke="#F3E2BE" stroke-width="18" fill="none" stroke-linecap="round"/>
<path d="${FP_ROAD}" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 8" fill="none" opacity=".95"/>
<g><rect x="20" y="214" width="3" height="10" rx="1" fill="#8A6A45"/><circle cx="21.5" cy="210" r="8" fill="#5FB36A"/></g>
<circle cx="292" cy="338" r="3" fill="${K.pnk}"/><circle cx="30" cy="436" r="2.5" fill="${K.gld}"/><circle cx="160" cy="250" r="2" fill="${K.pnk}"/>
</svg>`;
}

export function FirstPath({ minHeight = 0 }: { minHeight?: number }) {
  const { t, go } = useApp();
  const still = useStill();
  const [w, setW] = React.useState(330);
  const k = w / FP.w;
  /* the road stretches to fill the screen's height; it never gets shorter than its drawing */
  const hPx = Math.max(FP.h * k, minHeight);
  const ky = hPx / FP.h;
  const bob = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [still, bob]);
  const steps = [
    { hue: HUE.tl, icon: 'notebook', title: t('hx_n_rec'), body: t('hx_fp_rec'), chip: t('hx_start_here'), now: true, onPress: () => go('income') },
    { hue: HUE.vio, icon: 'house-line', title: t('hx_test_t'), body: t('hx_fp_test'), chip: t('hx_fp_after_months') },
    { hue: HUE.org, icon: 'piggy-bank', title: t('hx_save_t'), body: t('hx_fp_save'), chip: t('hx_fp_after_test') },
    { hue: HUE.gld, icon: 'key', title: t('hx_n_home'), body: t('hx_fp_home'), chip: t('hx_goal'), end: true },
  ];
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: hPx }} testID="home-first-path">
      <SvgXml xml={firstSceneXml()} width={w} height={hPx} style={{ position: 'absolute', left: 0, top: 0 } as object} />
      {/* Ruma at the start of the road */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: 4 * k, top: 0, right: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
        transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
      }}>
        <Image source={{ uri: RUMA_IMG.wave }} style={{ width: 92, height: 92 }} resizeMode="contain" />
        <View style={hp.hiBub}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 17, color: K.text }}>{t('hx_fp_hi')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: K.text2, marginTop: 2 }}>{t('hx_fp_sub')}</Text>
        </View>
      </Animated.View>
      {steps.map((st, i) => {
        const p = FP.stops[i], c = FP.cards[i];
        const size = 58 * Math.min(1, k + 0.1);
        const lock = !st.now && !st.end;
        return (
          <React.Fragment key={i}>
            {/* the stop on the road */}
            <View pointerEvents="none" style={{
              position: 'absolute', left: p.x * k - size / 2, top: p.y * ky - size / 2, width: size, height: size,
              borderRadius: st.end ? 16 : size / 2, alignItems: 'center', justifyContent: 'center',
              backgroundColor: st.now ? st.hue.c : st.end ? K.gld : st.hue.s,
              borderBottomWidth: 5, borderBottomColor: st.now ? st.hue.d : st.end ? K.gldD : 'rgba(31,42,68,0.10)',
            }}>
              {st.end ? (
                <View style={{ position: 'absolute', left: -6, top: -16 }}>
                  <SvgXml width={size + 12} height={22} xml={`<svg viewBox="0 0 64 22" xmlns="http://www.w3.org/2000/svg"><polygon points="32,0 64,22 0,22" fill="${K.gldD}"/><polygon points="32,5 58,21 6,21" fill="#FFB020"/></svg>`} />
                </View>
              ) : null}
              <Ph n={st.icon} c={st.now ? '#fff' : st.end ? '#5A4100' : st.hue.i} size={26} />
              {lock ? (
                <View style={[hp.bdg, { backgroundColor: K.s3 }]}><Ph n="lock-simple" c={K.text2} size={12} /></View>
              ) : null}
            </View>
            {/* the step's card beside it */}
            <Pressable disabled={!st.onPress} onPress={st.onPress} accessibilityRole={st.onPress ? 'button' : undefined}
              testID={`first-step-${i}`}
              style={[hp.fpCard, { left: c.x * k, top: c.y * ky, width: c.w * k }, st.now && { borderColor: st.hue.c, borderWidth: 2 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[hp.fpNum, { backgroundColor: st.now ? st.hue.c : st.end ? K.gld : K.s3 }]}>
                  <Text style={{ fontFamily: DISP_FONT, fontSize: 10.5, color: st.now ? '#fff' : st.end ? '#5A4100' : K.text2 }}>{i + 1}</Text>
                </View>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: K.text, flexShrink: 1 }}>{st.title}</Text>
                {st.now ? (
                  <View style={[hp.fpChip, { marginTop: 0, marginLeft: 'auto', backgroundColor: K.okS }]}>
                    <Text style={{ fontFamily: SEMI_FONT, fontSize: 11, color: K.ok }}>{st.chip}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 16.5, color: K.text2, marginTop: 3 }}>{st.body}</Text>
              {st.now ? (
                /* the one thing to do first, right on the first step */
                <View style={hp.fpAdd} testID="home-first-add">
                  <Ph n="plus" c="#fff" size={16} />
                  <Text style={{ fontFamily: DISP_FONT, fontSize: 13.5, color: '#fff' }}>{t('inc_add')}</Text>
                </View>
              ) : (
                <View style={[hp.fpChip, { backgroundColor: st.end ? K.gldS : K.s2 }]}>
                  <Text style={{ fontFamily: SEMI_FONT, fontSize: 11, color: st.end ? K.gldI : K.text2 }}>{st.chip}</Text>
                </View>
              )}
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/* ---------- the reward card's little village, playing on a loop ---------- */

/* Two Pondoks slide together and merge into a Kampung house with a sparkle, then a new
   Pondok drops in: the game in one glance. 4.8 s per round; still when motion is reduced. */
export function VillageTeaser() {
  const still = useStill();
  const a = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 4800, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [still, a]);
  const at = (input: number[], output: number[]) => a.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' });
  const P = 34, BIG = 50;
  const sparks = [0, 60, 120, 180, 240, 300];
  return (
    <View style={hp.plot}>
      <View style={hp.plotSky} />
      <View style={hp.plotSun} />
      {/* the two Pondoks that meet in the middle */}
      <Animated.View style={[hp.ph, { left: 4, opacity: still ? 0 : at([0, 0.28, 0.3, 1], [1, 1, 0, 0]),
        transform: [{ translateX: at([0, 0.08, 0.28, 1], [0, 0, 40, 40]) }] }]}>
        <IsoHouse tier="pondok" size={P} />
      </Animated.View>
      <Animated.View style={[hp.ph, { left: 84, opacity: still ? 0 : at([0, 0.28, 0.3, 1], [1, 1, 0, 0]),
        transform: [{ translateX: at([0, 0.08, 0.28, 1], [0, 0, -40, -40]) }] }]}>
        <IsoHouse tier="pondok" size={P} />
      </Animated.View>
      {/* what they become */}
      <Animated.View style={[hp.ph, { left: 36, bottom: 6, opacity: still ? 1 : at([0, 0.28, 0.36, 0.92, 1], [0, 0, 1, 1, 0]),
        transform: [{ scale: still ? 1 : at([0, 0.28, 0.36, 0.42, 0.48, 1], [0.3, 0.3, 1.2, 0.95, 1, 1]) }] }]}>
        <IsoHouse tier="kampung" size={BIG} />
      </Animated.View>
      {/* sparkles where they met */}
      {!still ? sparks.map(deg => (
        <Animated.View key={deg} style={{
          position: 'absolute', left: 59, bottom: 38, width: 6, height: 6, borderRadius: 3, backgroundColor: K.gld,
          opacity: at([0, 0.3, 0.34, 0.48, 1], [0, 0, 1, 0, 0]),
          transform: [
            { rotate: `${deg}deg` },
            { translateY: at([0, 0.3, 0.48, 1], [0, 0, -30, -30]) },
          ],
        }} />
      )) : null}
      {/* and the next saved day dropping in */}
      <Animated.View style={[hp.ph, { left: 84, opacity: still ? 1 : at([0, 0.55, 0.64, 0.92, 1], [0, 0, 1, 1, 0]),
        transform: [{ translateY: still ? 0 : at([0, 0.55, 0.64, 0.69, 0.74, 1], [-70, -70, 0, -8, 0, 0]) }] }]}>
        <IsoHouse tier="pondok" size={P} />
      </Animated.View>
    </View>
  );
}

/* the Play button gives a little wiggle each round, in step with the teaser */
export function WigglePlay({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const still = useStill();
  const a = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 4800, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [still, a]);
  const rot = a.interpolate({ inputRange: [0, 0.4, 0.44, 0.48, 0.52, 1], outputRange: ['0deg', '0deg', '-6deg', '5deg', '0deg', '0deg'] });
  const sc = a.interpolate({ inputRange: [0, 0.4, 0.44, 0.48, 0.52, 1], outputRange: [1, 1, 1.06, 1.06, 1, 1] });
  return (
    <Animated.View style={{ transform: [{ rotate: still ? '0deg' : rot }, { scale: still ? 1 : sc }] }}>
      <Pressable onPress={onPress} accessibilityRole="button" testID={testID} style={hp.play}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: '#4A3700' }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- the path to a home ---------- */

type StopKind = 'done' | 'now' | 'lock' | 'hold' | 'end';
type Bubble = {
  title: string; chip?: [string, 'ok' | 'warn' | 'bad' | 'lk']; body: string;
  res?: boolean[]; bar?: number; btn?: { label: string; onPress: () => void; done?: boolean; testID?: string };
  links?: Array<{ label: string; onPress: () => void; testID?: string }>; extra?: React.ReactNode;
};

/* the road in the design's 358 x 160 drawing: stop centres, and the scene behind them */
const RX = [56, 140, 224, 308], RY = [92, 76, 92, 76];
const roadD = RX.slice(1).map((x, i) => `M${RX[i]},${RY[i]} C${RX[i] + 42},${RY[i]} ${x - 42},${RY[i + 1]} ${x},${RY[i + 1]}`);
function sceneXml(doneTo: number): string {
  const done = roadD.filter((_, i) => i < doneTo).join(' ');
  return `<svg viewBox="0 0 358 160" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCF1F8"/><stop offset="0.7" stop-color="#FFFFFF"/></linearGradient></defs>
<rect width="358" height="160" fill="url(#sky)"/>
<circle cx="330" cy="26" r="12" fill="${K.gld}" opacity=".9"/>
<path d="M0 104 Q 70 78 150 98 T 358 88 V160 H0Z" fill="#CDEBBE"/>
<path d="M0 124 Q 90 104 190 120 T 358 112 V160 H0Z" fill="#B3E09C"/>
<g><rect x="176" y="96" width="3" height="10" rx="1" fill="#8A6A45"/><circle cx="177.5" cy="92" r="8" fill="#5FB36A"/></g>
<g><rect x="342" y="74" width="3" height="10" rx="1" fill="#8A6A45"/><circle cx="343.5" cy="70" r="7" fill="#5FB36A"/></g>
<g><circle cx="20" cy="140" r="2.5" fill="${K.pnk}"/><circle cx="96" cy="148" r="2" fill="${K.gld}"/><circle cx="262" cy="146" r="2.5" fill="${K.pnk}"/><circle cx="318" cy="136" r="2" fill="${K.gld}"/><circle cx="150" cy="152" r="2" fill="${K.pnk}"/></g>
<ellipse cx="176" cy="22" rx="17" ry="6" fill="#fff" opacity=".9"/><circle cx="170" cy="18" r="7" fill="#fff" opacity=".9"/>
<path d="${roadD.join(' ')}" stroke="#F5E3BE" stroke-width="16" fill="none" stroke-linecap="round"/>
${done ? `<path d="${done}" stroke="#A9D9C9" stroke-width="16" fill="none" stroke-linecap="round"/>` : ''}
<path d="${roadD.join(' ')}" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 8" fill="none" opacity=".9"/>
</svg>`;
}

function Stop({ i, kind, hue, icon, sel, k, onPress, label }: {
  i: number; kind: StopKind; hue: Hue; icon: string; sel: boolean; k: number; onPress: () => void; label: string;
}) {
  const still = useStill();
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (kind !== 'now' || still) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [kind, still, pulse]);
  const size = 54 * k;
  const bg = kind === 'done' || kind === 'now' ? hue.c : kind === 'lock' ? hue.s : kind === 'hold' ? K.pnkS : K.gld;
  const edge = kind === 'done' || kind === 'now' ? hue.d : kind === 'hold' ? '#F7B6C9' : kind === 'end' ? K.gldD : '#E9DCCB';
  const fg = kind === 'done' || kind === 'now' ? '#fff' : kind === 'hold' ? K.pnkI : kind === 'end' ? '#5A4100' : hue.i;
  const house = i === 3;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={`path-stop-${i}`}
      style={{ position: 'absolute', left: RX[i] * k - size / 2, top: RY[i] * k - size / 2, width: size, height: size + 5 * k }}>
      {house ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -5 * k, top: -12 * k, zIndex: 2 }}>
          <SvgXml width={64 * k} height={22 * k} xml={`<svg viewBox="0 0 64 22" xmlns="http://www.w3.org/2000/svg"><polygon points="32,0 64,22 0,22" fill="${K.gldD}"/><polygon points="32,5 58,21 6,21" fill="#FFB020"/></svg>`} />
        </View>
      ) : null}
      {kind === 'now' && !still ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: hue.c,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        }} />
      ) : null}
      <View style={{
        width: size, height: size, borderRadius: house ? 15 * k : size / 2, backgroundColor: bg,
        borderBottomWidth: 5 * k, borderBottomColor: edge, alignItems: 'center', justifyContent: 'center',
        borderWidth: sel ? 3 : 0, borderColor: sel ? '#fff' : 'transparent',
      }}>
        <Ph n={icon} c={fg} size={Math.round(25 * k)} />
      </View>
      {kind === 'done' || kind === 'lock' || kind === 'hold' ? (
        <View style={[hp.bdg, { backgroundColor: kind === 'done' ? K.ok : kind === 'hold' ? K.pnk : K.s3 }]}>
          <Ph n={kind === 'done' ? 'check' : kind === 'hold' ? 'pause' : 'lock-simple'} c={kind === 'lock' ? K.text2 : '#fff'} size={12} />
        </View>
      ) : null}
    </Pressable>
  );
}

/* Ruma walks the road to the stop being looked at, with a little hop. */
function Walker({ sel, k, img }: { sel: number; k: number; img: string }) {
  const still = useStill();
  const x = React.useRef(new Animated.Value(RX[sel])).current;
  const y = React.useRef(new Animated.Value(RY[sel])).current;
  const hop = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (still) { x.setValue(RX[sel]); y.setValue(RY[sel]); return; }
    Animated.parallel([
      Animated.timing(x, { toValue: RX[sel], duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(y, { toValue: RY[sel], duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(hop, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]),
    ]).start();
  }, [sel, still, x, y, hop]);
  const w = 44 * k;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', width: w, height: w,
      left: Animated.subtract(Animated.multiply(x, k), w / 2),
      top: Animated.subtract(Animated.multiply(y, k), 74 * k),
      transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -22 * k] }) }],
      zIndex: 5,
    }}>
      <Image source={{ uri: img }} style={{ width: w, height: w }} resizeMode="contain" />
    </Animated.View>
  );
}

/* Where the person is on the path to a home. Home's path card and the House
   tab's path strip both read this, so the two always agree. */
export function pathSteps(S: AppState, result: HousingTestResult | null) {
  const hasRec = (recSpan(S.data)?.list.length ?? 0) > 0;
  const tested = !!(S.testRan && result);
  const phase = tested ? planPhase(S, result) : 'setup';
  const q = potSplit(S, result);
  const started = !!S.plan?.done.some(Boolean) || q.pot > 0;
  const saving = tested && (phase === 'buffer' || phase === 'village') && started;
  const inBuf = phase === 'buffer';
  const testKind: StopKind = tested ? 'done' : hasRec ? 'now' : 'lock';
  const saveKind: StopKind = !tested ? 'lock' : phase === 'explain' ? 'hold' : 'now';
  const kinds: StopKind[] = [hasRec ? 'done' : 'now', testKind, saveKind, 'end'];
  const cur = kinds.findIndex(x => x === 'now' || x === 'hold');
  return { hasRec, tested, phase, q, saving, inBuf, testKind, saveKind, kinds, cur };
}

/* The same four stops as Home's path, slim, at the top of the House tab. Each
   stop opens where that step is done. */
export function PathStrip() {
  const { S, t, go } = useApp();
  const result = getHousingTestResult();
  const { hasRec, tested, kinds, cur, inBuf, saving } = pathSteps(S, result);
  const names = [t('hx_n_rec'), t(tested ? 'hx_n_dream' : 'hx_n_test'), t('hx_n_save'), t('hx_n_home')];
  const icons = ['notebook', 'house-line', 'piggy-bank', 'key'];
  const hues = [HUE.tl, HUE.vio, inBuf ? HUE.org : HUE.vio, HUE.gld];
  const routes = [hasRec ? 'money' : 'income', 'house', 'plan', 'prepare'] as const;
  /* worded as on Home's path: three steps, then the goal */
  const stepTxt = saving ? t('hx_saving') : t('hx_step', { s: cur < 0 ? 3 : cur + 1 });
  return (
    <View style={hp.strip} testID="house-path">
      {/* the step sits beside the title, clear of the floating Ask Ruma button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: K.text }}>{t('hx_path_t')}</Text>
        <View style={hp.stripStep}><Text style={{ fontFamily: SEMI_FONT, fontSize: 11, color: K.text2 }}>{stepTxt}</Text></View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <View pointerEvents="none" style={hp.stripLine} />
        {kinds.map((kind, i) => {
          const h = hues[i];
          /* only the next step is marked; another open step just looks open */
          const now = i === cur;
          const open = !now && (kind === 'now' || kind === 'hold');
          const done = kind === 'done';
          const bg = done ? h.c : now || open ? '#fff' : kind === 'end' ? K.s2 : K.s3;
          const ic = done ? '#fff' : now || open ? h.i : K.text3;
          return (
            <Pressable key={i} onPress={() => go(routes[i])} accessibilityRole="button"
              accessibilityLabel={`${names[i]}: ${t(done ? 'hx_chip_done' : now ? 'hh_path_here' : kind === 'end' ? 'hx_goal' : 'hx_locked')}`}
              testID={`house-path-${i}`} style={{ flex: 1, alignItems: 'center' }}>
              {now ? (
                <Image source={{ uri: RUMA_IMG.wave }} style={{ position: 'absolute', top: -14, right: '12%', width: 26, height: 26, zIndex: 2 }} resizeMode="contain" />
              ) : null}
              <View style={[hp.stripDot, { backgroundColor: bg }, open && { borderWidth: 2, borderColor: h.c }, now && { borderWidth: 3, borderColor: h.c, transform: [{ scale: 1.12 }] }]}>
                <Ph n={done ? 'check' : kind === 'lock' ? 'lock-simple' : icons[i]} c={ic} size={18} />
              </View>
              <Text numberOfLines={1} style={[hp.stripName, now && { color: h.i }]}>{names[i]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PathCard() {
  const { S, t, up, go, toast, monthName } = useApp();
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = getHousingTestResult();
  React.useEffect(() => {
    if (!S.plan || S.plan.key !== monthKey || !S.village) up(s => { planEnsure(s); villageEnsure(s); });
  }, [S.plan, S.village, monthKey, up]);
  React.useEffect(() => {
    up(s => { syncBufferTarget(s, result); planResolveTarget(s, result); });
  }, [result, up]);
  const [w, setW] = React.useState(326);
  const [picked, setPicked] = React.useState<number | null>(null);
  /* sent here by a coach bubble: open on the stop it pointed to */
  React.useEffect(() => {
    if (S.pathFocus != null) { setPicked(S.pathFocus); up(s => { s.pathFocus = null; }); }
  }, [S.pathFocus, up]);
  const sp = recSpan(S.data);
  if (!S.plan || S.plan.key !== monthKey) return null;

  const p = S.plan;
  const today = new Date().getDate() - 1;
  const nowKey = new Date().getFullYear() * 12 + new Date().getMonth();
  const keyOf = (d: string) => (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1);
  const thisN = [...S.data.income, ...S.data.expenses, ...S.data.workCostEntries].filter(e => keyOf(e.d) === nowKey).length;
  const n = sp ? sp.list.length : 0;
  const hasRec = n > 0;
  const curM = monthName(new Date().getMonth());

  /* A test counts as done once it has run. The house test leaves out the month still
     running, so that month alone never makes it look out of date; a finished month
     recorded after the test does, and the bubble then offers a re-test. */
  const nowM = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
  const testedOut = !!(result && housingResultStale(
    { ...S.data, income: S.data.income.filter(e => `${+e.d.slice(0, 4)}-${+e.d.slice(5, 7)}` !== nowM),
      expenses: S.data.expenses.filter(e => `${+e.d.slice(0, 4)}-${+e.d.slice(5, 7)}` !== nowM),
      workCostEntries: S.data.workCostEntries.filter(e => `${+e.d.slice(0, 4)}-${+e.d.slice(5, 7)}` !== nowM) },
    result));
  /* the three steps and the goal, each with its look on the road and its bubble */
  const { tested, phase, q, saving, inBuf, saveKind, kinds, cur } = pathSteps(S, result);
  const short = tested ? Number(result!.short_month_count) || 0 : 0;
  const testedN = tested ? (result!.tested_months ?? n) : n;
  const res = tested ? result!.months.map(m => !!m.is_short) : undefined;
  const saveHue = inBuf ? HUE.org : HUE.vio;
  const planDone = tested && !inBuf && q.need > 0 && q.up >= q.need;
  const sel = picked ?? (cur < 0 ? 0 : cur);
  const hues = [HUE.tl, HUE.vio, saveKind === 'now' ? saveHue : HUE.org, HUE.gld];
  const testCap = !tested ? t('hx_next') : phase === 'explain' ? t('hx_nofit') : short ? t('hx_tight') : t('hx_fits');
  const have = inBuf ? q.buf : q.up, goal = inBuf ? q.bt : q.need;
  const saveCap = saveKind === 'lock' ? t('hx_locked') : saveKind === 'hold' ? t('hx_hold') : saving ? rm(have) : t('hx_ready');
  const caps = [hasRec ? t(n === 1 ? 'hx_rec_cap1' : 'hx_rec_cap', { n, m: curM }) : t('hx_start_here'), hasRec || tested ? testCap : t('hx_locked'), saveCap, t('hx_done')];
  const names = [t('hx_n_rec'), t(tested ? 'hx_n_dream' : 'hx_n_test'), t('hx_n_save'), t('hx_n_home')];
  const icons = ['notebook', 'house-line', 'piggy-bank', 'key'];
  const doneTo = tested ? 2 : hasRec ? 1 : 0;

  const toggleToday = () => {
    if (p.paused) { toast(t('pl_paused_b')); return; }
    if (p.skipped?.[today]) { toast(t('pl_today_skipped')); return; }
    /* a saved day stays saved; a mistake is fixed from the plan's calendar */
    if (p.done[today]) return;
    up(s => { planToggle(s, today); });
    toast(t('pl_toast', { a: rm(p.amounts[today]), c: rm((S.village?.savedRm ?? 0) + p.amounts[today]) }));
  };
  const land = S.vLand && Date.now() - S.vLand.at < 5 * 60 * 1000 ? S.vLand : null;

  const shortBy = tested && phase === 'explain' ? Math.round(-feasibilityGap(result!)) : 0;
  const bubbles: Bubble[] = [
    sp ? {
      title: t('hx_rec_t'), chip: [t('hx_chip_done'), 'ok'],
      body: t(n === 1 ? 'hx_rec_b1' : 'hx_rec_b', { n, a: monthName(sp.from.m), b: monthName(sp.to.m), m: curM, k: thisN }),
      links: [{ label: t('hx_more'), onPress: () => up(s => { s.pastT = 'inc'; s.sheet = 'pastmonth'; }) }],
    } : {
      /* the very first step, before anything is recorded */
      title: t('hx_rec_t'), body: t('hx_rec_now'),
      btn: { label: t('inc_add'), onPress: () => go('income'), testID: 'path-add-income' },
    },
    tested ? {
      title: t('hx_dream_t'),
      chip: phase === 'explain' ? [t('hx_nofit'), 'bad'] : short ? [t('hx_tight'), 'warn'] : [t('hx_fits'), 'ok'],
      body: (short ? t('ht_short', { s: short, n: testedN }) : t('ht_ok', { n: testedN })) + (testedOut ? ' ' + t('hx_retest_new') : ''),
      res,
      links: [{ label: t('hx_dream_edit'), onPress: () => go('house') }],
    } : !hasRec ? {
      title: t('hx_test_t'), chip: [t('hx_locked'), 'lk'], body: t('hx_test_lock'),
    } : {
      title: t('hx_test_t'),
      body: t(n === 1 ? 'hx_test_b1' : 'hx_test_b', { n }),
      btn: { label: t('hx_test_t'), onPress: () => go('house'), testID: 'path-test' },
    },
    saveKind === 'lock' ? {
      title: t('hx_save_t'), chip: [t('hx_locked'), 'lk'], body: t('hx_save_lock'),
      links: [{ label: t('hx_how_plan'), onPress: () => go('plan') }],
    } : saveKind === 'hold' ? {
      title: t('hx_save_t'), chip: [t('hx_hold'), 'bad'], body: t('hx_save_hold', { a: rm(shortBy) }),
      links: [{ label: t('hx_helps'), onPress: () => go('plan') }],
    } : !saving ? {
      title: t('hx_save_t'), body: inBuf ? t('hx_save_first', { a: rm(q.bt) }) : t('hx_save_first_up', { a: rm(q.need) }),
      btn: { label: t('hx_start'), onPress: () => go('plan'), testID: 'path-start' },
    } : {
      title: t('hx_today', { a: rm(p.amounts[today]) }),
      body: t(inBuf ? 'hx_goal_buf' : 'hx_goal_up', { h: rm(have), t: rm(goal) }),
      bar: goal > 0 ? Math.max(2, Math.min(100, Math.round(have / goal * 100))) : 100,
      btn: {
        label: p.done[today] ? t('hx_saved_today') : t('hx_i_saved', { a: rm(p.amounts[today]) }),
        onPress: toggleToday, done: p.done[today], testID: 'home-save-today',
      },
      links: [
        ...(p.done[today] ? [{ label: t('hx_whats_next'), onPress: () => setPicked(3), testID: 'path-next' }] : []),
        { label: t('hx_open_plan'), onPress: () => go('plan'), testID: 'home-open-plan' },
      ],
      extra: land && !inBuf ? <Text style={hp.land} testID="village-landed">{t('vl_landed_q', { a: rm(land.a) })}</Text> : null,
    },
    tested ? {
      /* once a house is tested, the last stop invites a look through Prepare for a house */
      title: t('hx_done'), chip: planDone ? [t('hx_chip_done'), 'ok'] : [t('hx_goal'), 'lk'],
      body: t(planDone ? 'hx_home_done' : 'hx_home_prep'),
      btn: { label: t('hh_prep'), onPress: () => go('prepare'), testID: 'path-prepare' },
    } : {
      title: t('hx_done'), chip: [t('hx_goal'), 'lk'], body: t('hx_home_b'),
      links: [{ label: t('hh_prep'), onPress: () => go('prepare'), testID: 'path-prepare' }],
    },
  ];
  const b = bubbles[sel];
  const hue = hues[sel];
  const k = w / 358;
  const img = sel === 3 ? RUMA_IMG.count : kinds[sel] === 'done' ? RUMA_IMG.happy : kinds[sel] === 'hold' ? RUMA_IMG.oops : RUMA_IMG.wave;
  const stepTxt = saving ? t('hx_saving') : t('hx_step', { s: cur < 0 ? 3 : cur + 1 });

  return (
    <View style={hp.path} testID="home-path">
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 2 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: K.text }}>{t('hx_path_t')}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12, color: K.text2 }}>{stepTxt}</Text>
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        style={{ height: 160 * k, marginHorizontal: -16, marginTop: 4 }}>
        <SvgXml xml={sceneXml(doneTo)} width={w} height={160 * k} style={{ position: 'absolute', left: 0, top: 0 } as object} />
        {kinds.map((kind, i) => (
          <React.Fragment key={i}>
            <Stop i={i} kind={kind} hue={hues[i]} icon={icons[i]} sel={i === sel} k={k}
              onPress={() => setPicked(i)} label={`${names[i]}: ${caps[i]}`} />
            <View pointerEvents="none" style={{ position: 'absolute', left: RX[i] * k - 46, top: RY[i] * k + 31 * k, width: 92, alignItems: 'center' }}>
              <View style={[hp.slabName, kind === 'now' && { backgroundColor: hues[i].c }]}>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 12, color: kind === 'now' ? '#fff' : kind === 'lock' ? K.text3 : K.text }}>{names[i]}</Text>
              </View>
              <Text numberOfLines={1} style={hp.slabCap}>{caps[i]}</Text>
            </View>
          </React.Fragment>
        ))}
        <Walker sel={sel} k={k} img={img} />
      </View>
      <View style={[hp.pbub, { backgroundColor: hue.s }]}>
        <View style={[hp.pbubArrow, { backgroundColor: hue.s, left: RX[sel] * k - 16 - 8 }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: K.text }}>{b.title}</Text>
          {b.chip ? <Chip label={b.chip[0]} kind={b.chip[1]} /> : null}
        </View>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 19.5, color: K.text2, marginTop: 4 }}>{b.body}</Text>
        {b.res ? (
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
            {b.res.map((s, i) => <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: s ? K.pnk : K.tl }} />)}
          </View>
        ) : null}
        {b.bar != null ? (
          <View style={{ height: 8, borderRadius: 4, backgroundColor: K.s1, overflow: 'hidden', marginTop: 8 }}>
            <View style={{ width: `${b.bar}%`, height: '100%', borderRadius: 4, backgroundColor: hue.c }} />
          </View>
        ) : null}
        {b.btn ? <ChunkyBtn label={b.btn.label} hue={hue} onPress={b.btn.onPress} done={b.btn.done} testID={b.btn.testID} /> : null}
        {b.extra}
        {(b.links ?? []).map(l => (
          <Pressable key={l.label} onPress={l.onPress} accessibilityRole="button" testID={l.testID}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8, alignSelf: 'flex-start', minHeight: 28 }}>
            <Text style={hp.lnk}>{l.label}</Text>
            <Ph n="caret-right" c={K.text} size={14} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const hp = StyleSheet.create({
  strip: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    borderWidth: 1.5, borderColor: '#E9DFD0',
    shadowColor: '#1F2A44', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  stripLine: { position: 'absolute', left: '12.5%', right: '12.5%', top: 19, height: 4, borderRadius: 2, backgroundColor: '#EFE3CF' },
  stripStep: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: K.s2 },
  stripDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stripName: { fontFamily: DISP_FONT, fontSize: 12, color: K.text, marginTop: 6 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50,
    marginTop: 12, borderRadius: 999, borderBottomWidth: 4, paddingHorizontal: 18,
  },
  btnT: { fontFamily: DISP_FONT, fontSize: 15.5, color: '#fff' },
  chip: { height: 22, paddingHorizontal: 9, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  heroEdge: { borderRadius: 22, backgroundColor: '#08605D', paddingBottom: 5 },
  hero: { borderRadius: 22, overflow: 'hidden', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  heroTop: { fontFamily: SEMI_FONT, fontSize: 13, color: 'rgba(255,255,255,0.95)' },
  mbm: {
    height: 28, paddingLeft: 11, paddingRight: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  heroSub: { fontFamily: BODY_FONT, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  heroBig: { fontFamily: XBOLD_FONT, fontSize: 36, lineHeight: 40, letterSpacing: -1, color: '#FFE08A', fontVariant: ['tabular-nums'] },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: '#FFE3D6' },
  io: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  ioIc: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sayCard: {
    marginTop: 12, borderRadius: 22, padding: 8, backgroundColor: K.s1,
    shadowColor: '#1F2A44', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  peek: { position: 'absolute', right: 18, top: -34, width: 46, height: 46, zIndex: 2 },
  sayb: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingLeft: 6, paddingRight: 12,
    borderRadius: 999, backgroundColor: K.tlS,
  },
  mic: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: K.tl, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 3, borderBottomColor: K.tlD,
  },
  path: {
    backgroundColor: K.s1, borderRadius: 22, paddingHorizontal: 16, paddingBottom: 14, overflow: 'hidden',
    shadowColor: '#1F2A44', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  bdg: {
    position: 'absolute', right: -4, top: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', zIndex: 3,
  },
  slabName: { paddingHorizontal: 9, paddingVertical: 1, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#1F2A44', shadowOpacity: 0.12, shadowRadius: 0, shadowOffset: { width: 0, height: 1 } },
  slabCap: { fontFamily: BODY_FONT, fontSize: 10.5, color: K.text2, marginTop: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 6, paddingHorizontal: 4 },
  pbub: { marginTop: 10, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  pbubArrow: { position: 'absolute', top: -8, width: 16, height: 16, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  lnk: { fontFamily: SEMI_FONT, fontSize: 13, color: K.text, textDecorationLine: 'underline', textDecorationColor: K.line2 },
  land: { fontFamily: DISP_FONT, fontSize: 13, color: '#9A6B00', textAlign: 'center', marginTop: 8 },
  hiBub: {
    flexShrink: 1, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
    shadowColor: '#1F2A44', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  fpCard: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 0, borderColor: 'transparent',
    shadowColor: '#1F2A44', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  fpNum: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fpChip: { alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  fpAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, marginTop: 8,
    borderRadius: 999, backgroundColor: K.tl, borderBottomWidth: 3, borderBottomColor: K.tlD,
  },
  plot: { width: 122, height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: '#9BD57A' },
  plotSky: { position: 'absolute', left: 0, right: 0, top: 0, height: '58%', backgroundColor: '#BFE9F5' },
  plotSun: { position: 'absolute', right: 10, top: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: K.gld },
  ph: { position: 'absolute', bottom: 8 },
  play: {
    height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: K.gld,
    borderBottomWidth: 3, borderBottomColor: K.gldD, alignItems: 'center', justifyContent: 'center',
  },
});
