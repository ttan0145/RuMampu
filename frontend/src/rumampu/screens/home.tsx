import React from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getHousingTestResult } from '../../../services/housingSession';
import { Route, useApp } from '../state';
import { useFreshHousingTest } from '../useFreshHousingTest';
import { commitTotal, expByMonth, housingResultStale, monthsAgg, recSpan, rm } from '../calc';
import {
  planEnsure, planPhase, planResolveTarget, planSaved, planToggle, syncBufferTarget, upfrontNeed,
} from '../plan';
import { villageEnsure } from '../village';
import { IsoIsland } from '../isosvg';
import { RUMA_IMG } from '../ruma';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { BodyS, Display } from '../ui';
import { ScreenShell } from './shell';


/* v22 home: total-saving hero + last-month income/expense card, a slim
   house-test row, then the saving-plan card with the village island. */


function arrowXml(up: boolean, color: string): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${up ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M5 12l7 7 7-7"/>'}</svg>`;
}

const HT_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3F7A7E" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/><path d="m9.3 14.8 2 2 3.6-4.2"/></svg>';

function Blob({ size, style, color }: { size: number; style: object; color: string }) {
  return <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/* v24 balpanel — month by month: in, out (work costs and bills), left. */
function BalPanel() {
  const { S, t, monthName } = useApp();
  const keyOf = (d: string) => (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1);
  const months = new Map<number, { inc: number; out: number }>();
  for (const e of S.data.income) {
    const k = keyOf(e.d);
    const m = months.get(k) ?? { inc: 0, out: 0 };
    m.inc += +e.a || 0;
    months.set(k, m);
  }
  for (const e of S.data.workCostEntries) {
    const k = keyOf(e.d);
    if (!months.has(k)) continue;
    months.get(k)!.out += +e.a || 0;
  }
  const commit = commitTotal(S.data);
  const rows = [...months.entries()].sort((a, b) => b[0] - a[0]).slice(0, 6);
  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)', gap: 6 }}>
      {rows.length > 1 ? rows.map(([k, m]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 12.5, color: '#fff', width: 42 }}>{monthName(k % 12)}</Text>
          <Text style={bp.cell}>{t('hm_bal_in')} {rm(m.inc)}</Text>
          <Text style={bp.cell}>{t('hm_bal_out')} {rm(m.out + commit)}</Text>
          <Text style={[bp.cell, { fontFamily: DISP_FONT }]}>{t('hm_bal_left')} {rm(m.inc - m.out - commit)}</Text>
        </View>
      )) : (
        <Text style={bp.cell}>{t('hm_bal_none')}</Text>
      )}
      <Text style={[bp.cell, { fontSize: 10.5, lineHeight: 14, opacity: 0.8 }]}>{t('hm_bal_note')}</Text>
    </View>
  );
}

const bp = StyleSheet.create({
  cell: { fontFamily: BODY_FONT, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', flexShrink: 1 },
});

/* .hero + .hero2 — the dark balance cards. */
function HomeCards() {
  const { S, t, monthName } = useApp();
  const [balOpen, setBalOpen] = React.useState(false);

  const monthKeyOf = (d: string) =>
    (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1);

  // Work out which month should be shown
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();

  const recordedKeys = new Set([
    ...S.data.income.map(e => monthKeyOf(e.d)),
    ...S.data.expenses.map(e => monthKeyOf(e.d)),
  ]);

  const key = recordedKeys.has(thisKey)
    ? thisKey
    : recordedKeys.size
      ? Math.max(...recordedKeys)
      : null;

  const income =
    key != null
      ? S.data.income
          .filter(e => monthKeyOf(e.d) === key)
          .reduce((sum, e) => sum + (+e.a || 0), 0)
      : 0;

  const ex =
    key != null
      ? S.data.expenses
          .filter(e => monthKeyOf(e.d) === key)
          .reduce((sum, e) => sum + (+e.a || 0), 0)
      : 0;

  const mn = key != null
    ? monthName(key % 12)
    : '';

  const workCosts =
    key != null
      ? S.data.workCostEntries
          .filter(e => monthKeyOf(e.d) === key)
          .reduce((sum, e) => sum + (+e.a || 0), 0)
      : 0;

  /* Figma B1: the hero is what's left after work costs and bills. */
  const saving = income - workCosts - commitTotal(S.data);

  return (
    <View>
      <View style={st.hero}>
        <Blob
          size={150}
          color="rgba(74,145,149,0.55)"
          style={{ right: -60, top: -70 }}
        />

        <Blob
          size={90}
          color="rgba(254,200,68,0.9)"
          style={{ right: -22, top: -32 }}
        />

        <Blob
          size={120}
          color="rgba(50,177,74,0.55)"
          style={{ left: -60, bottom: -70 }}
        />

        <Text style={st.heroLbl}>
          {t('hm_saving')}
        </Text>

        <Text style={st.heroAmt}>
          {rm(saving)}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
          }}
        >
          <Text
            style={{
              fontFamily: BODY_FONT,
              fontSize: 12.5,
              lineHeight: 16,
              color: 'rgba(255,255,255,0.88)',
              flexShrink: 1,
            }}
          >
            {t('hm_after')}{mn ? ' \u00b7 ' + mn : ''}
          </Text>

          <Pressable
            onPress={() => setBalOpen(o => !o)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 30,
            }}
          >
            <Text
              style={{
                fontFamily: BODY_FONT,
                fontSize: 13,
                color: '#fff',
              }}
            >
              {t('hm_mysav')}
            </Text>

            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#1F3F42',
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                {balOpen ? '↑' : '↓'}
              </Text>
            </View>
          </Pressable>
        </View>
        {balOpen ? <BalPanel /> : null}
      </View>

      <View
        style={[
          st.hero,
          {
            flexDirection: 'row',
            marginTop: 10,
            paddingVertical: 14,
          },
        ]}
      >
        <Blob
          size={80}
          color="rgba(74,145,149,0.6)"
          style={{ left: -40, top: -40 }}
        />

        <Blob
          size={70}
          color="rgba(254,200,68,0.85)"
          style={{ right: -30, bottom: -35 }}
        />

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <SvgXml
            xml={arrowXml(true, '#5FD37A')}
            width={22}
            height={22}
          />

          <View
            style={{
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <Text
              style={st.heroLbl}
              numberOfLines={1}
            >
              {t('hm_income')}
              {mn ? ' · ' + mn : ''}
            </Text>

            <Text style={st.hero2Amt}>
              {rm(income)}
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            borderLeftWidth: 1.5,
            borderLeftColor: 'rgba(255,255,255,0.25)',
            paddingLeft: 14,
          }}
        >
          <SvgXml
            xml={arrowXml(false, '#FF8A66')}
            width={22}
            height={22}
          />

          <View
            style={{
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <Text
              style={st.heroLbl}
              numberOfLines={1}
            >
              {t('hm_exp')}
              {mn ? ' · ' + mn : ''}
            </Text>

            <Text style={st.hero2Amt}>
              {rm(ex)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* .htrow — the slim house-test row under the balance cards. */
function HouseTestRow() {
  const { S, t, monthName, go } = useApp();
  const refreshing = useFreshHousingTest();
  const sp = recSpan(S.data);
  if (!sp) return null;
  const n = sp.list.length;
  const housingResult = getHousingTestResult();
  const tested = S.testRan && housingResult;
  /* A verdict from before the record changed (a past month added after the
     test) is not repeated as if it still held: the row shows the record and
     the Re-test door, and the result screen re-runs the scenario. */
  const fresh = tested && !housingResultStale(S.data, housingResult);
  const s = fresh ? housingResult.short_month_count : 0;
  const g = fresh ? housingResult.largest_gap : 0;
  const nn = fresh ? (housingResult.tested_months ?? n) : n;
  const title = fresh
    ? (s ? t('ht_short', { s, n: nn }) : t('ht_ok', { n: nn }))
    : t('ht_title');
  const sub = fresh && s
    ? t('ht_gap', { g: rm(g) })
    : t('ht_rec', { n, a: monthName(sp.from.m), b: monthName(sp.to.m) });
  const warn = fresh ? s > 0 : n < 4;
  return (
    <Pressable onPress={() => go(tested ? 'result' : 'house')} style={st.htrow}>
      <View style={st.htrowIc}><SvgXml xml={HT_SVG} width={22} height={22} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, lineHeight: 18, color: C.ink }}>{title}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 15, color: warn ? '#B7791F' : C.ink64, marginTop: 2 }}>{sub}</Text>
      </View>
      <View style={[st.plbtn, refreshing && { opacity: 0.6 }]}>
        <Text style={st.plbtnTxt}>{tested ? t('ht_rego') : t('ht_go')}</Text>
      </View>
    </Pressable>
  );
}

/* .plcard — the saving-plan card with village island. */
export function PlanCard() {
  const { S, t, up, monthName, go, toast } = useApp();
  const { width } = useWindowDimensions();
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = getHousingTestResult();
  React.useEffect(() => {
    if (!S.plan || S.plan.key !== monthKey || !S.village) up(s => { planEnsure(s); villageEnsure(s); });
  }, [S.plan, S.village, monthKey, up]);
  React.useEffect(() => {
    up(s => { syncBufferTarget(s, result); planResolveTarget(s, result); });
  }, [result, up]);
  if (!S.plan || S.plan.key !== monthKey || !S.village) return null;

  /* Epic 10: the card follows the phase. Before a target honestly exists
     (setup/explain) home shows a slim hand-off to the plan screen. */
  const phase = planPhase(S, result);
  if (phase === 'setup' || phase === 'explain') {
    return (
      <Pressable onPress={() => go('plan')} style={st.plcard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('pl_title')}</Text>
          <BodyS muted>›</BodyS>
        </View>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 18, lineHeight: 23, color: C.ink, marginTop: 8 }}>
          {t(phase === 'setup' ? 'p10_setup_t' : 'p10_explain_t')}
        </Text>
        <BodyS muted style={{ marginTop: 3 }}>
          {t(phase === 'setup' ? 'p10_setup_btn' : 'p10_explain_btn')}
        </BodyS>
      </Pressable>
    );
  }
  const inBuffer = phase === 'buffer';
  const b = S.buffer;

  const p = S.plan;
  const v = S.village;
  const today = new Date().getDate() - 1;
  const saved = planSaved(p);
  const pct = Math.min(100, Math.round(saved / p.target * 100));
  const doneN = p.done.filter(Boolean).length;
  const mx = Math.max(1, ...p.amounts);
  const nCells = v.cells.filter(Boolean).length;
  const best = Math.max(0, ...v.cells);
  let stats = `${t('vl_builtn', { b: v.built })} · ${t('vl_onplot', { n: nCells })}${best ? ' · ' + t('vl_best', { t: t('vl_t' + best) }) : ''}`;
  if ((v.collection ?? 0) > 0) stats += ` · ${t('vl_collect', { n: v.collection, a: rm(v.savedRm ?? 0) })}`;
  if ((v.queued ?? 0) > 0) stats += ` · ${t('vl_queue', { n: v.queued })}`;

  const toggleToday = () => {
    const wasDone = p.done[today];
    up(s => { planToggle(s, today); });
    toast(wasDone
      ? t('pl_untoast', { a: rm(p.amounts[today]) })
      : t('pl_toast', { a: rm(p.amounts[today]), c: rm((S.village?.savedRm ?? 0) + p.amounts[today]) }));
  };

  return (
    <View style={st.plcard}>
      <Pressable onPress={() => go('plan')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>
          {t('pl_title')} · {monthName(new Date().getMonth())}
        </Text>
        <BodyS muted>{t('pl_days', { d: doneN, n: p.n })} ›</BodyS>
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <View>
          <BodyS muted>{t('pl_today')}</BodyS>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 28, lineHeight: 32, color: C.ink, fontVariant: ['tabular-nums'] }}>
            {rm(p.amounts[today])}
          </Text>
        </View>
        <Pressable onPress={toggleToday} style={[st.plbtn, p.done[today] && { backgroundColor: C.confirm }]}>
          <Text style={st.plbtnTxt}>{p.done[today] ? t('pl_saved_today') : t('pl_save_today')}</Text>
        </Pressable>
      </View>
      <View style={st.plbar}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: '#3F8A8E' }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <BodyS muted>{t('pl_oftarget', { t: rm(p.target) })}</BodyS>
        <BodyS muted>{pct}%</BodyS>
      </View>
      {/* v24 potmini: the pot, named, on Home — jar level and gap line against
          the upfront need (shield semantics: declared savings + moved-in months). */}
      {(() => {
        const potTotal = (v?.savedRm ?? 0) + S.potMoved;
        const need = upfrontNeed(S);
        const gap = Math.max(0, need - potTotal);
        const gapLine = !need ? t('sp_pot1h') : gap > 0 ? t('hm_togo', { g: rm(gap) }) : t('hm_ready');
        const lvl = need > 0 ? Math.min(1, potTotal / need) : (potTotal > 0 ? 1 : 0);
        const fh = 12.5 * lvl, fy = 19.5 - fh;
        const jar = `<svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<rect x="8" y="2.6" width="8" height="2.6" rx="1.2" fill="none" stroke="#4A9195" stroke-width="1.6"/>
<path d="M6.5 7.2h11a1.5 1.5 0 0 1 1.5 1.5v10.3a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.5-2.5V8.7a1.5 1.5 0 0 1 1.5-1.5z" fill="#fff" stroke="#4A9195" stroke-width="1.6"/>
${lvl > 0 ? `<rect x="6.6" y="${fy}" width="10.8" height="${fh}" rx="1.4" fill="#4A9195" opacity=".8"/>` : ''}
</svg>`;
        return (
          <Pressable onPress={() => go('plan')} style={{
            flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
            backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 14,
            paddingVertical: 8, paddingHorizontal: 12, minHeight: 52,
          }}>
            <SvgXml xml={jar} width={32} height={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 13.5, color: C.ink }}>{t('sp_pot1')}</Text>
              <BodyS muted style={{ fontSize: 11 }} numberOfLines={1}>{gapLine}</BodyS>
            </View>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink, fontVariant: ['tabular-nums'] }}>
              {rm(potTotal)}
            </Text>
            <Text style={{ fontSize: 16, color: C.ink40 }}>{'›'}</Text>
          </Pressable>
        );
      })()}
      <Text style={{
        fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase',
        color: C.ink64, marginTop: 12,
      }}>{t('vl_daily')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 54, marginTop: 8 }}>
        {p.amounts.map((a, i) => (
          <View key={i} style={{
            flex: 1, minHeight: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2,
            height: `${Math.max(6, Math.round(a / mx * 100))}%`,
            backgroundColor: p.done[i] ? C.brand : i === today ? C.ink : i < today ? '#F4D27A' : C.ink14,
          }} />
        ))}
      </View>
      {inBuffer ? (
        /* Shield phase: a filled meter, no tiles — the game opens later. */
        <BodyS muted style={{ marginTop: 10 }}>
          {t('p10_shield_t')} · {rm(b?.saved ?? 0)} / {rm(b?.target ?? 0)} · {t('p10_target_from')}
        </BodyS>
      ) : (
        <>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <IsoIsland cells={v.cells} width={Math.min(width, 390) - 72} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <BodyS muted style={{ flexShrink: 1 }}>{stats}</BodyS>
            <Pressable onPress={() => up(s => { villageEnsure(s).msg = ''; s.vHelp = false; s.sheet = 'vflash'; })} style={st.plbtn}>
              <Text style={st.plbtnTxt}>▶ {t('vl_play')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}


/* First-open welcome: a sunny meadow with a little home on the hill, pinned to
   the foot of the screen behind the content. Decoration only. */
function HomeMeadow() {
  const xml = `<svg width="100%" height="230" viewBox="0 0 390 230" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
  <path d="M-20 230 L-20 150 Q 100 92 235 138 Q 330 168 410 134 L410 230 Z" fill="#CBE6CF"/>
  <path d="M-20 230 L-20 186 Q 95 136 215 170 Q 322 200 410 168 L410 230 Z" fill="#A5D6AE"/>
  <g stroke="#63A96F" stroke-width="2.4" stroke-linecap="round" fill="none">
    <path d="M60 192 q-2 -8 1 -12 M66 192 q0 -9 4 -12 M72 193 q3 -7 8 -9"/>
    <path d="M206 190 q-2 -8 1 -12 M212 190 q0 -9 4 -12 M218 191 q3 -7 8 -9"/>
    <path d="M330 200 q-2 -8 1 -12 M336 200 q0 -9 4 -12"/>
  </g>
  <g>
    <circle cx="112" cy="206" r="4.6" fill="#FFFFFF"/><circle cx="112" cy="206" r="1.7" fill="#F4D27A"/>
    <circle cx="152" cy="180" r="4.6" fill="#FFFFFF"/><circle cx="152" cy="180" r="1.7" fill="#F4D27A"/>
    <circle cx="272" cy="204" r="4.6" fill="#FFFFFF"/><circle cx="272" cy="204" r="1.7" fill="#F4D27A"/>
  </g>
</svg>`;
  return <SvgXml xml={xml} width="100%" height={230} />;
}


/* Ruma says hello: a springy pop-in, then a gentle bob with a breathing
   shadow — the pre-rendered 3D poses cross-fade so she feels alive. */
function RumaHero() {
  const pop = React.useRef(new Animated.Value(0)).current;
  const bob = React.useRef(new Animated.Value(0)).current;
  const swap = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    const bobLoop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const swapLoop = Animated.loop(Animated.sequence([
      Animated.delay(2200),
      Animated.timing(swap, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(swap, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    bobLoop.start(); swapLoop.start();
    return () => { bobLoop.stop(); swapLoop.stop(); };
  }, [pop, bob, swap]);
  const rise = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const tilt = bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop }] }}>
      <Animated.View style={{ width: 150, height: 150, transform: [{ translateY: rise }, { rotate: tilt }] }}>
        <Animated.Image source={{ uri: RUMA_IMG.wave }} resizeMode="contain"
          style={{ position: 'absolute', width: 150, height: 150, opacity: swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }} />
        <Animated.Image source={{ uri: RUMA_IMG.happy }} resizeMode="contain"
          style={{ position: 'absolute', width: 150, height: 150, opacity: swap }} />
      </Animated.View>
      <Animated.View style={{
        width: 74, height: 10, borderRadius: 5, backgroundColor: 'rgba(60,81,82,0.14)', marginTop: 2,
        transform: [{ scaleX: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) }],
      }} />
    </Animated.View>
  );
}


/* The one thing to do gets the one loud button: a teal gradient pill that
   breathes gently, with a coin dropping into view beside the label. */
function AddIncomeCta({ label, onPress }: { label: string; onPress: () => void }) {
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }],
      shadowColor: '#2E6B6F', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
      elevation: 6, borderRadius: 999,
    }}>
      <Pressable onPress={onPress}
        style={({ pressed }) => [{
          minHeight: 58, borderRadius: 999, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30,
        }, pressed && { opacity: 0.9 }]}>
        <SvgXml
          xml={'<svg width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A9195"/><stop offset="1" stop-color="#2E6B6F"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#cta)"/></svg>'}
          width="100%" height="100%"
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13, backgroundColor: '#FEC844',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
          }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 18, color: '#5C4A00' }}>+</Text>
          </View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 18, color: '#fff' }}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* How-the-app-works cards: rounded pastel tiles with hand-drawn doodles, the
   way a friendly meditation app introduces itself. They ease in one by one. */
const HW_DOODLES: Record<string, string> = {
  coins: `<svg width="100%" height="100%" viewBox="0 0 320 96" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4A9195" stroke-width="2.4" stroke-linecap="round" opacity="0.35">
    <circle cx="272" cy="34" r="13"/>
    <path d="M272 28v12M267 34h10"/>
    <circle cx="298" cy="62" r="9"/>
  </svg>`,
  house: `<svg width="100%" height="100%" viewBox="0 0 320 96" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4A9195" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.35">
    <path d="M254 48 l24 -20 24 20 M262 44 v26 h32 v-26"/>
    <path d="M286 56 l5 6 9 -12"/>
  </svg>`,
  sprout: `<svg width="100%" height="100%" viewBox="0 0 320 96" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4A9195" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.35">
    <path d="M282 70 v-18 q0 -12 12 -14 M282 56 q0 -10 -11 -12"/>
    <path d="M294 38 q6 1 6 8 q-8 1 -10 -4 M271 44 q-6 1 -6 8 q8 1 10 -4"/>
    <path d="M270 74 h24"/>
  </svg>`,
};

function HowCard({ n, bg, doodle, title, body, delay }: {
  n: number; bg: string; doodle: string; title: string; body: string; delay: number;
}) {
  const inA = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(inA, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [inA, delay]);
  return (
    <Animated.View style={{
      opacity: inA, transform: [{ translateY: inA.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
      backgroundColor: bg, borderRadius: 22, overflow: 'hidden', minHeight: 92, justifyContent: 'center',
      borderWidth: 1.5, borderColor: 'rgba(60,81,82,0.08)',
    }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
        <SvgXml xml={doodle} width="100%" height="100%" />
      </View>
      <View style={{ paddingVertical: 16, paddingHorizontal: 18, paddingRight: 96, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#E4EFEC', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 12, color: '#2E6B6F' }}>{n}</Text>
          </View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 16.5, color: C.ink }}>{title}</Text>
        </View>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64 }}>{body}</Text>
      </View>
    </Animated.View>
  );
}

function HomePurposeControl() {
  const { t } = useApp();
  const [open, setOpen] = React.useState(false);
  return (
    <View style={st.howWrap}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(value => !value)}
        style={({ pressed }) => [st.howToggle, pressed && { opacity: 0.78 }]}
      >
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={st.howToggleTitle}>{t('how_title')}</Text>
        </View>
        <Text style={st.howToggleMark}>{open ? '↑' : '↓'}</Text>
      </Pressable>
      {open ? (
        <View style={st.howPanel}>
          <Text style={st.howPanelTitle}>{t('wf_title')}</Text>
          <BodyS>{t('how_1')}</BodyS>
          <BodyS>{t('how_payment')}</BodyS>
          <BodyS>{t('how_2')}</BodyS>
          <BodyS>{t('how_4')}</BodyS>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={({ pressed }) => [st.howClose, pressed && { opacity: 0.78 }]}
          >
            <Text style={st.howCloseText}>{t('done')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function HomeScreen() {
  const { S, t, go, up } = useApp();
  const sp = recSpan(S.data);

  if (!sp) {
    /* Empty record: Ruma welcomes, one button to start, and three friendly
       cards explain how the app works. The meadow stays behind it all. */
    return (
      <ScreenShell brand bg={<HomeMeadow />}>
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 6 }}>
          <RumaHero />
          <Display cls="h-l" style={{ textAlign: 'center', maxWidth: 280 }}>{t('inc_empty')}</Display>
          <AddIncomeCta label={t('inc_add')} onPress={() => go('income')} />
        </View>
        <Text style={{
          fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase',
          color: C.ink64, marginTop: 6,
        }}>{t('hw_title')}</Text>
        <HowCard n={1} bg="#F3F6F5" doodle={HW_DOODLES.coins} title={t('hw_t1')} body={t('hw_b1')} delay={250} />
        <HowCard n={2} bg="#F3F6F5" doodle={HW_DOODLES.house} title={t('hw_t2')} body={t('hw_b2')} delay={430} />
        <HowCard n={3} bg="#F3F6F5" doodle={HW_DOODLES.sprout} title={t('hw_t3')} body={t('hw_b3')} delay={610} />
        <HomePurposeControl />
        <View style={{ height: 56 }} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell brand>
      <HomeCards />
      <HouseTestRow />
      <HomePurposeControl />
      <PlanCard />
    </ScreenShell>
  );
}

const st = StyleSheet.create({
  hero: {
    position: 'relative', overflow: 'hidden', backgroundColor: '#25494D',
    borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    shadowColor: 'rgba(31,63,66,1)', shadowOpacity: 0.26, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroLbl: { fontFamily: BODY_FONT, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroAmt: { fontFamily: DISP_FONT, fontSize: 30, lineHeight: 34, marginTop: 1, color: '#fff', fontVariant: ['tabular-nums'] },
  hero2Amt: { fontFamily: DISP_FONT, fontSize: 19, lineHeight: 24, color: '#fff', fontVariant: ['tabular-nums'] },
  htrow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  htrowIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#E4EFEC',
    alignItems: 'center', justifyContent: 'center',
  },
  plcard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
  },
  plbtn: {
    minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  plbtnTxt: { fontFamily: DISP_FONT, fontSize: 13.5, color: '#fff' },
  plbar: { height: 10, borderRadius: 5, backgroundColor: C.ink14, overflow: 'hidden', marginTop: 12 },
  howWrap: { gap: 8 },
  howToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  howToggleTitle: { fontFamily: DISP_FONT, fontSize: 16.5, lineHeight: 21, color: C.ink },
  howToggleMark: { fontFamily: DISP_FONT, fontSize: 18, color: C.brand },
  howPanel: {
    gap: 8, backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#DDE9E6',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
  },
  howPanelTitle: { fontFamily: DISP_FONT, fontSize: 19, lineHeight: 24, color: C.ink },
  howClose: {
    alignSelf: 'flex-start', marginTop: 4, minHeight: 38, paddingHorizontal: 16,
    borderRadius: 19, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
  },
  howCloseText: { fontFamily: DISP_FONT, fontSize: 13.5, color: '#fff' },
});
