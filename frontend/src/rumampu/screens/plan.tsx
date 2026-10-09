import React from 'react';
import { Animated, Easing, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { HousingTestResult } from '../../../types/housing';
import { useApp } from '../state';
import { rm } from '../calc';
import {
  bufferEnsure, feasibilityGap, planEnsure, planPause, planPhase, planReset, planResolveTarget,
  planBeforeStart, planSaved, planShuffleLeft, planSkip, planToggle, syncBufferTarget, potGap, potLevel, potSplit,
  planHorizonEffective, planMonthlyAsk, planMonthRows, monthlySaveCapacity, PLAN_HORIZONS,
} from '../plan';
import { commitTotal } from '../calc';
import { ufSource } from '../fees';
import { villageEnsure, villageGlow, villageOpen, villageQueueKey } from '../village';
import { IsoIsland } from '../isosvg';
import { ReadyTag } from '../overlays';
import { logIt } from '../log';
import { getHousingTestResult } from '../../../services/housingSession';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { BodyS, Btn, BtnQuiet, Card, CardI, Display, P, Prov, Row } from '../ui';
import { ScreenShell } from './shell';
import { GuideTarget } from '../tour';
import { RUMA_IMG } from '../ruma';
import { ChunkyBtn, HUE, Hue, K, Ph, VillageTeaser, WigglePlay, useStill } from '../homepath';

/* Saving plan, v27b3 layout. One source of truth (planPhase) decides what
   renders: setup (no house test yet), explain (house doesn't fit), the safety
   buffer, then upfront cash. Targets always come from the person's own
   record. Every phase ends with the pot and what finished months left. */

function jarXml(level: number, size = 44): string {
  const lvl = Math.max(0, Math.min(1, level));
  const fh = 12.5 * lvl, fy = 19.5 - fh;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<rect x="8" y="2.6" width="8" height="2.6" rx="1.2" fill="none" stroke="#4A9195" stroke-width="1.6"/>
<path d="M6.5 7.2h11a1.5 1.5 0 0 1 1.5 1.5v10.3a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.5-2.5V8.7a1.5 1.5 0 0 1 1.5-1.5z" fill="#fff" stroke="#4A9195" stroke-width="1.6"/>
${lvl > 0 ? `<rect x="6.6" y="${fy}" width="10.8" height="${fh}" rx="1.4" fill="#4A9195" opacity=".8"/>` : ''}
</svg>`;
}

/* The shield: a filled meter, no tiles, never red. */
function shieldXml(level: number, size = 44): string {
  const lvl = Math.max(0, Math.min(1, level));
  const h = 15 * lvl, y = 19.4 - h;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="sh"><path d="M12 2.6l7.4 2.8v6.1c0 4.6-3 8.1-7.4 9.9-4.4-1.8-7.4-5.3-7.4-9.9V5.4z"/></clipPath></defs>
${lvl > 0 ? `<rect x="3" y="${y}" width="18" height="${h}" fill="#3F8A8E" clip-path="url(#sh)"/>` : ''}
<path d="M12 2.6l7.4 2.8v6.1c0 4.6-3 8.1-7.4 9.9-4.4-1.8-7.4-5.3-7.4-9.9V5.4z" fill="none" stroke="#2E6B6E" stroke-width="1.7" stroke-linejoin="round"/>
</svg>`;
}

function Bar({ pct, style }: { pct: number; style?: object }) {
  return (
    <View style={[st.plbar, style]}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 5, backgroundColor: '#3F8A8E' }} />
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <View style={st.noteC}>
      <BodyS>{children}</BodyS>
    </View>
  );
}

/* .potrow card: the one pot, counted once, with its (i) breakdown. */
export function PotsCard({ result }: { result: HousingTestResult | null }) {
  const { S, t, up } = useApp();
  const q = potSplit(S, result);
  const gap = potGap(q);
  const gapLine = gap == null ? t('sp_pot1h') : gap > 0 ? t('hm_togo', { g: rm(gap) }) : t('hm_ready');
  return (
    <View>
      <View style={st.eyeRow}>
        <Text style={[st.eyebrow, { marginBottom: 0 }]}>{t('sp_pots')}</Text>
        <Pressable onPress={() => up(s => { s.sheet = 'pothow'; })} style={st.vinfo} accessibilityLabel={t('ph_title')}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text>
        </Pressable>
      </View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <SvgXml xml={jarXml(potLevel(q))} width={44} height={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('sp_pot1')}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 16, color: C.ink64, marginTop: 1 }}>{gapLine}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text testID="plan-pot-total" style={{ fontFamily: XBOLD_FONT, fontSize: 20, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(q.pot)}</Text>
            <Prov p="user" />
          </View>
        </View>
        {result ? (
          <BodyS muted style={{ marginTop: 8 }}>{t('pl_split', { b: rm(q.buf), u: rm(q.up) })}</BodyS>
        ) : null}
        <Pressable onPress={() => up(s => { s.sheet = 'potadd'; })} style={st.potadd} accessibilityRole="button">
          <View style={st.potaddPl}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>+</Text></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13.5, color: C.brand }}>{t('sp_addpot')}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

/* LeanKit 10.10.3: what finished months left, moved in (or out) only by the person's own tap. */
export function PotMonthCard() {
  const { S, t, up, toast, monthName } = useApp();
  const rows = planMonthRows(S, commitTotal(S.data));
  return (
    <View>
      <View style={st.eyeRow}>
        <Text style={[st.eyebrow, { marginBottom: 0 }]}>{t('pm_title')}</Text>
        <CardI t="pm_title" b={['pm_h']} p="user" />
      </View>
      <Card gap={0}>
        {rows.length ? rows.map((m, i) => (
          <View key={m.key} style={[st.pmrow, i > 0 && { borderTopWidth: 1, borderTopColor: C.ink14 }]}>
            <Text style={{ flex: 1, minWidth: 0, fontFamily: BODY_FONT, fontSize: 14.5, color: C.ink }}>
              {monthName(+m.key.slice(5) - 1)} {m.key.slice(0, 4)}
            </Text>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(m.left)}</Text>
            <Pressable
              onPress={() => {
                up(s => {
                  const at = s.potMovedMonths.indexOf(m.key);
                  if (at < 0) {
                    s.potMoved += m.left; s.potMovedMonths.push(m.key); logIt(s, 'lg_pot_add', { a: rm(m.left) });
                  } else {
                    s.potMoved = Math.max(0, s.potMoved - m.left); s.potMovedMonths.splice(at, 1);
                  }
                });
                if (!m.on) toast(t('pm_added'));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: m.on }}
              style={[st.pmbtn, m.on && { backgroundColor: C.card }]}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: m.on ? C.ink64 : '#fff' }}>
                {m.on ? t('pm_added') : t('pm_add')}
              </Text>
            </Pressable>
          </View>
        )) : <BodyS muted>{t('pm_none')}</BodyS>}
      </Card>
    </View>
  );
}

function InfoRow() {
  const { t, up } = useApp();
  return (
    <View style={[st.eyeRow, { marginBottom: -6 }]}>
      <Text style={[st.eyebrow, { marginBottom: 0 }]}>{t('pl_sec')}</Text>
      <Pressable onPress={() => up(s => { s.sheet = 'plinfo'; })} style={st.vinfo} accessibilityLabel="info">
        <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text>
      </Pressable>
    </View>
  );
}

export function PlanScreen() {
  const { S, t, up, go, toast } = useApp();
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = getHousingTestResult();
  React.useEffect(() => {
    if (!S.plan || S.plan.key !== monthKey) up(s => { planEnsure(s); villageEnsure(s); });
  }, [S.plan, monthKey, up]);
  React.useEffect(() => {
    up(s => { syncBufferTarget(s, result); planResolveTarget(s, result); });
  }, [result, up, S.planHorizon, S.potMoved, S.data.cashOnHand]);

  /* A moved safety target is announced, never silent (Epic 10 decision). */
  const bufMsg = S.buffer?.msg;
  React.useEffect(() => {
    if (bufMsg !== 'moved') return;
    toast(t('p10_moved', { from: rm(S.buffer?.prevTarget ?? 0), to: rm(S.buffer?.target ?? 0) }));
    up(s => { bufferEnsure(s).msg = null; });
  }, [bufMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Local UI state must be declared before any early return, or the phase
     branches below would call a different number of hooks between renders. */
  const [wholeMonth, setWholeMonth] = React.useState(false);
  const [skipMode, setSkipMode] = React.useState(false);
  const [resetArmed, setResetArmed] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  if (!S.plan || S.plan.key !== monthKey) return <ScreenShell back title={t('pl_title')}><View /></ScreenShell>;

  const phase = planPhase(S, result);

  if (phase === 'setup') {
    return (
      <ScreenShell back title={t('pl_title')}>
        <GuideTarget id="pl.setup">
          <View style={st.empty}>
            <Image source={{ uri: RUMA_IMG.count }} style={{ width: 130, height: 130 }} resizeMode="contain" />
            <Text style={st.emptyH}>{t('hx_p_setup_t')}</Text>
            <Text style={st.emptyP}>{t('hx_p_setup')}</Text>
          </View>
          <ChunkyBtn label={t('hx_test_t')} hue={HUE.vio} icon="house-line" onPress={() => go('house')} testID="plan-test" />
        </GuideTarget>
        <SecHead title={t('hx_p_get')} />
        <View style={{ gap: 8 }}>
          <Tip hue={HUE.org} icon="umbrella" text={t('hx_p_get1')} />
          <Tip hue={HUE.vio} icon="coins" text={t('hx_p_get2')} />
          <Tip hue={HUE.gld} icon="calendar-check" text={t('hx_p_get3')} />
        </View>
        <PotsCard result={result} />
        <PotMonthCard />
      </ScreenShell>
    );
  }

  if (phase === 'explain' && result) {
    const short = Math.round(-feasibilityGap(result));
    return (
      <ScreenShell back title={t('pl_title')}>
        <View style={st.empty}>
          <Image source={{ uri: RUMA_IMG.oops }} style={{ width: 130, height: 130 }} resizeMode="contain" />
          <Text style={st.emptyH}>{t('p10_explain_t')}</Text>
          <Text style={st.emptyP}>{t('hx_p_nofit', { a: rm(short) })}</Text>
        </View>
        <SecHead title={t('hx_p_moves')} />
        <View style={{ gap: 8 }}>
          <Tip hue={HUE.vio} icon="house-line" text={t('hx_p_move1')} />
          <Tip hue={HUE.tl} icon="trend-up" text={t('hx_p_move2')} />
          <Tip hue={HUE.org} icon="receipt" text={t('hx_p_move3')} />
        </View>
        <ChunkyBtn label={t('hx_p_lower')} hue={HUE.vio} onPress={() => go('house')} testID="plan-lower" />
        <PotsCard result={result} />
        <PotMonthCard />
      </ScreenShell>
    );
  }

  const p = S.plan;
  const b = S.buffer;
  const v = S.village;
  const qKey = villageQueueKey(S);
  /* a day just saved: its house lands on the village below */
  const land = S.vLand && Date.now() - S.vLand.at < 5 * 60 * 1000 ? S.vLand : null;
  const today = new Date().getDate() - 1;
  const saved = planSaved(p);
  const doneN = p.done.filter(Boolean).length;
  const inBuffer = phase === 'buffer';
  const q = potSplit(S, result);
  /* the goal this phase is filling */
  const tgt = inBuffer ? q.bt : q.need;
  const have = inBuffer ? q.buf : q.up;
  const gpct = tgt > 0 ? Math.min(100, Math.round(have / tgt * 100)) : 100;
  const shortN = result ? Number(result.short_month_count) || 0 : 0;
  const testedN = result ? (result.tested_months ?? result.months.length) : 0;
  const upfrontDone = !inBuffer && q.need > 0 && q.up >= q.need;
  /* how long to spread it over: the person's pick, or what the record allows */
  const horizon = planHorizonEffective(S);
  const monthlyAsk = planMonthlyAsk(S);
  const capacity = monthlySaveCapacity(S);
  const hue = inBuffer ? HUE.org : HUE.vio;

  const paused = !!p.paused;
  const monthEnding = p.n - (today + 1) <= 2;
  const todayDone = !!p.done[today];
  const todaySkipped = !!p.skipped?.[today] && !todayDone;

  const toggle = (i: number) => {
    if (paused || planBeforeStart(p, i)) return;
    /* v27b: in Skip days mode a tap skips (or un-skips) a day not yet saved. */
    if (skipMode && !p.done[i]) { up(s => { planSkip(s, i); }); return; }
    if (p.skipped?.[i]) { up(s => { planSkip(s, i); }); return; }
    const wasDone = p.done[i];
    up(s => {
      planToggle(s, i);
      /* today saved: point back to the path, where the next stop is Prepare for a house */
      if (!wasDone && i === today) s.pathCoach = { route: 'plan', key: 'hx_coach_saved', stop: 3 };
    });
    toast(wasDone
      ? t('pl_untoast', { a: rm(p.amounts[i]) })
      : t('pl_toast', { a: rm(p.amounts[i]), c: rm((S.village?.savedRm ?? 0) + p.amounts[i]) }));
  };

  const showAll = wholeMonth || skipMode;
  const wk = Math.floor(today / 7);
  const goalName = inBuffer ? t('p10_shield_t') : t('p10_village_t');
  const from = !inBuffer && ufSource(S).typed ? t('p10_target_prep') : t('p10_target_from');
  const dayList = p.amounts.map((a, i) => i).filter(i => showAll || (i >= wk * 7 && i < wk * 7 + 7));

  return (
    <ScreenShell back title={t('pl_title')}>
      {upfrontDone && result ? (
        /* Completion hands off to reality, not "you win". */
        <Card gap={8}>
          <Display cls="h-m">{t('p10_done_t')}</Display>
          <P style={{ color: C.ink64 }}>
            {t('p10_done', {
              d: rm(upfrontNeedOf(q)),
              b: rm(b?.target ?? 0),
              m: rm(Math.round(Number(result.tested_home_cost) || 0)),
            })}
          </P>
        </Card>
      ) : (
        <GuideTarget id="pl.phase">
          {/* today: one small amount, said plainly, and one button. Once saved it
              folds away and comes back tomorrow. */}
          <TodayFold done={todayDone}>
          <View style={[st.today, { backgroundColor: hue.s }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <Image source={{ uri: todayDone ? RUMA_IMG.happy : RUMA_IMG.wave }} style={{ width: 86, height: 86, marginLeft: -6, marginBottom: -10 }} resizeMode="contain" />
              <View style={st.bub}>
                <View style={st.bubTail} />
                <Text style={{ fontFamily: BODY_FONT, fontSize: 14, lineHeight: 19.5, color: K.text }}>
                  {todayDone
                    ? t('hx_p_saved_b', { d: doneN, n: p.n })
                    : t(inBuffer ? 'hx_p_small_buf' : 'hx_p_small_up')}
                </Text>
              </View>
            </View>
            <Text style={st.amt} testID="plan-today-amount">
              {rm(p.amounts[today] ?? 0)}<Text style={st.amtSm}>  {t('hx_p_today')}</Text>
            </Text>
            {paused ? <View style={{ marginTop: 10 }}><Note>{t('pl_paused_b')}</Note></View> : null}
            {todaySkipped ? <View style={{ marginTop: 10 }}><Note>{t('pl_today_skipped')}</Note></View> : null}
            <ChunkyBtn
              label={todayDone ? t('hx_saved_today') : t('hx_i_saved', { a: rm(p.amounts[today] ?? 0) })}
              hue={hue} done={todayDone} onPress={() => { if (!todayDone) toggle(today); }} testID="plan-save-today" />
            {todayDone ? null : (
              <Pressable
                onPress={() => {
                  if (paused || planBeforeStart(p, today)) return;
                  up(s => { planSkip(s, today); });
                  if (!todaySkipped) toast(t('hx_p_skipped', { a: rm(p.amounts[today] ?? 0) }));
                }}
                accessibilityRole="button" testID="plan-skip-today" style={{ alignSelf: 'center', marginTop: 10, minHeight: 32, justifyContent: 'center' }}>
                <Text style={st.sk}>{t(todayDone ? 'hx_p_undo' : todaySkipped ? 'hx_p_unskip' : 'hx_p_skip')}</Text>
              </Pressable>
            )}
          </View>
          </TodayFold>

          {/* where the money goes: safety money, then upfront cash, then plan complete */}
          <SecHead title={t('hx_p_where')} right={t(inBuffer ? 'hx_p_goal1' : 'hx_p_goal2')} />
          <View style={st.card}>
            <View style={{ flexDirection: 'row' }}>
              <View pointerEvents="none" style={st.trackLine} />
              <TrackNode hue={HUE.org} kind={inBuffer ? 'now' : 'done'} icon={inBuffer ? 'umbrella' : 'check'}
                title={t('p10_shield_t')} sub={inBuffer ? t('hx_of', { h: rm(q.buf), t: rm(q.bt) }) : t('hx_p_full')} />
              <TrackNode hue={HUE.vio} kind={inBuffer ? 'lock' : 'now'} icon={inBuffer ? 'lock-simple' : 'coins'}
                title={t('p10_village_t')} sub={inBuffer ? t('hx_p_after') : t('hx_of', { h: rm(q.up), t: rm(q.need) })} />
              <TrackNode hue={HUE.gld} kind="end" icon="flag" title={t('hx_done')} sub={t('hx_p_both')} />
            </View>
            <View style={st.goal}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ fontFamily: SEMI_FONT, fontSize: 14, color: K.text }}>{goalName}</Text>
                <Text style={st.gh} testID="plan-goal">{rm(have)}<Text style={st.ghSm}> {t('hx_of_t', { t: rm(tgt) })}</Text></Text>
              </View>
              <View style={st.bar}><View style={{ width: `${Math.max(gpct, 2)}%`, height: '100%', borderRadius: 6, backgroundColor: hue.c }} /></View>
              <Text style={st.gp}>{t('hx_p_pct', { p: gpct, f: from })}</Text>
              <View style={st.why}>
                <Ph n="lightbulb" c={K.text2} size={16} />
                <Text style={{ flex: 1, fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 18, color: K.text2 }}>
                  {inBuffer
                    ? (shortN ? t('hx_p_why', { s: shortN, n: testedN }) : t('p10_shield_sub'))
                    : t('hx_p_why_up')}
                </Text>
              </View>
            </View>
          </View>
        </GuideTarget>
      )}

      {/* the days: this week (or the whole month), saved, today and missed at a glance */}
      <SecHead title={showAll ? t('pl_month') : t('pl_week')} right={t('hx_p_month_of', { h: rm(saved), t: rm(p.target) })} />
      <View style={st.card}>
        {(p.from ?? 0) > 0 ? <BodyS muted style={{ marginBottom: 8 }}>{t('pl_partial')}</BodyS> : null}
        {monthEnding && !paused ? <View style={{ marginBottom: 8 }}><Note>{t('pl_monthend')}</Note></View> : null}
        {skipMode ? <BodyS style={{ marginBottom: 8 }}>{t('pl_skipmode_h')}</BodyS> : null}
        <GuideTarget id="pl.grid" style={[st.days, !showAll && { marginTop: 16 }, paused && { opacity: 0.5 }]}>
          {dayList.map(i => {
            const a = p.amounts[i];
            const done = p.done[i];
            const skipped = !!p.skipped?.[i] && !done;
            const isToday = i === today;
            const before = planBeforeStart(p, i);
            const miss = !paused && i < today && !done && !skipped && !before && a > 0;
            return (
              <View key={i} style={st.dcell}>
                {isToday && !showAll ? <Text style={[st.todayLbl, { color: hue.i }]}>{t('hx_p_todaylbl')}</Text> : null}
                <Pressable onPress={() => toggle(i)}
                  onLongPress={() => { if (!paused && !done) up(s => { planSkip(s, i); }); }}
                  disabled={paused || before}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1} ${before ? t('pl_before_short') : skipped ? t('pl_skip_short') : 'RM ' + a}`}
                  accessibilityState={{ selected: done, disabled: paused || before }}
                  style={[st.dy,
                    before && { opacity: 0.45 },
                    miss && { backgroundColor: K.s1, borderWidth: 2, borderColor: K.gldD },
                    skipped && { backgroundColor: K.s1, borderWidth: 1.5, borderStyle: 'dashed', borderColor: K.line2 },
                    isToday && !done && { backgroundColor: K.s1, borderWidth: 2.5, borderColor: hue.c },
                    done && { backgroundColor: hue.c },
                  ]}>
                  <Text style={{ fontFamily: BODY_FONT, fontSize: 10, color: done ? 'rgba(255,255,255,0.8)' : K.text2 }}>{i + 1}</Text>
                  {done ? <Ph n="check" c="#fff" size={14} />
                    : before ? <Text style={st.dyS}>{t('pl_before_short')}</Text>
                      : skipped ? <Text style={st.dyS}>{t('pl_skip_short')}</Text>
                        : <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: K.text, fontVariant: ['tabular-nums'] }}>{a}</Text>}
                </Pressable>
              </View>
            );
          })}
        </GuideTarget>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
          <Legend box={{ backgroundColor: hue.c }} label={t('hx_p_l_saved')} />
          <Legend box={{ borderWidth: 2, borderColor: hue.c }} label={t('hx_p_l_today')} />
          <Legend box={{ borderWidth: 2, borderColor: K.gldD }} label={t('hx_p_l_missed')} />
        </View>
        <View style={st.mm}>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 13, color: K.text2 }}>{t('pl_days', { d: doneN, n: p.n })}</Text>
          <Pressable onPress={() => setWholeMonth(w => !w)} accessibilityRole="button" accessibilityState={{ expanded: showAll }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32 }}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: K.tlI }}>{t(showAll ? 'pl_showweek' : 'pl_showmonth')}</Text>
            <Ph n="caret-right" c={K.tlI} size={14} />
          </Pressable>
        </View>
      </View>

      {/* the reward: the village grows with the days kept, not with ringgit */}
      {v ? (
        <>
          <SecHead title={t('hx_p_reward')} right={t('hx_p_grows')} />
          <View style={st.vil}>
            <Pressable onPress={() => { if (!inBuffer) up(villageOpen); }} accessibilityRole="button" testID="plan-village"
              accessibilityLabel={t('vl_title')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <VillageTeaser />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: K.text }}>{t('vl_title')}</Text>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: K.text2, marginTop: 2 }}>
                {inBuffer ? t('hx_p_vil_lock') : t('hx_p_vil_b')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <View style={st.cnt}><Text style={st.cntT}>{t(v.built === 1 ? 'hx_p_built1' : 'hx_p_built', { n: v.built })}</Text></View>
                {(v.queued ?? 0) > 0 ? <View style={st.cnt}><Text style={st.cntT}>{t('vl_ready', { n: v.queued ?? 0 })}</Text></View> : null}
              </View>
            </View>
            </Pressable>
            {!inBuffer ? (
              <WigglePlay label={t('vl_play')} onPress={() => up(villageOpen)} testID="plan-village-play" />
            ) : null}
          </View>
          {land && !inBuffer ? (
            <Text style={st.vland} testID="plan-village-landed">{t('vl_landed_q', { a: rm(land.a) })}</Text>
          ) : null}
          {!inBuffer && qKey && qKey !== 'vl_ready_swipe' ? <BodyS muted style={{ marginTop: 6 }}>{t(qKey, { n: v.queued })}</BodyS> : null}
        </>
      ) : null}

      {/* everything else that changes the plan, folded away */}
      <View style={[st.card, { padding: 0, marginTop: 10 }]}>
        <Pressable onPress={() => setSettingsOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: settingsOpen }}
          testID="plan-settings" style={st.summary}>
          <Ph n="sliders" c={K.text} size={20} />
          <Text style={{ flex: 1, fontFamily: SEMI_FONT, fontSize: 15, color: K.text }}>{t('hx_p_settings')}</Text>
          <View style={{ transform: [{ rotate: settingsOpen ? '180deg' : '0deg' }] }}><Ph n="caret-down" c={K.text} size={20} /></View>
        </Pressable>
        {settingsOpen ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            {inBuffer ? (
              <SetRow title={t('hx_p_monthly')} sub={t('hx_p_monthly_b', { a: rm(p.target) })} />
            ) : !upfrontDone ? (
              <SetRow title={t('pl_hz_t')} sub={!S.planHorizon && capacity != null
                ? t('pl_hz_rec_sub', { a: rm(monthlyAsk) })
                : t('pl_hz_sub', { a: rm(monthlyAsk), n: horizon || 12 })}>
                <GuideTarget id="pl.chips" style={st.chips}>
                  {[null, ...PLAN_HORIZONS].map(h => {
                    const on = h === null ? !S.planHorizon : S.planHorizon === h;
                    return (
                      <Pressable key={h ?? 0} onPress={() => up(s => { s.planHorizon = h; })}
                        accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={[st.chipB, on && st.chipOn]}>
                        <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: on ? '#fff' : K.text }}>
                          {h ? t('pl_hz_mo', { n: h }) : t('pl_hz_rec')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </GuideTarget>
              </SetRow>
            ) : null}
            <SetRow title={t('hx_p_days')} sub={t('hx_p_days_b')}>
              <View style={st.acts}>
                <Pressable onPress={() => { setSkipMode(m => !m); }} accessibilityRole="button"
                  accessibilityState={{ selected: skipMode }} style={[st.act, skipMode && st.actOn]}>
                  <Text style={[st.actT, skipMode && { color: '#fff' }]}>{t('pl_skipmode')}</Text>
                </Pressable>
                <Pressable onPress={() => up(s => { planShuffleLeft(s, today); })} accessibilityRole="button" style={st.act}>
                  <Text style={st.actT}>{t('pl_shuffle')}</Text>
                </Pressable>
                <Pressable onPress={() => up(s => { planPause(s); })} accessibilityRole="button" style={st.act}>
                  <Text style={st.actT}>{t(paused ? 'pl_resume' : 'pl_pause')}</Text>
                </Pressable>
              </View>
            </SetRow>
            <SetRow title={t('sp_pots')} sub={t('hx_p_pots_b')}>
              <View style={{ marginTop: 8, gap: 12 }}>
                <PotsCard result={result} />
                <PotMonthCard />
              </View>
            </SetRow>
            {/* LeanKit 10.11: reset asks twice; record, village and savings kept. */}
            <SetRow title={t('hx_p_over')} sub={t('hx_p_over_b')}>
              <View style={st.acts}>
                <Pressable
                  onPress={() => {
                    if (!resetArmed) { setResetArmed(true); return; }
                    setResetArmed(false);
                    setSkipMode(false);
                    up(s => { planReset(s); });
                    toast(t('pl_reset_done'));
                  }}
                  accessibilityRole="button"
                  style={[st.act, resetArmed && { backgroundColor: K.pnkI }]}>
                  <Text style={[st.actT, { color: resetArmed ? '#fff' : K.pnkI }]}>{t(resetArmed ? 'pl_reset_arm' : 'pl_reset')}</Text>
                </Pressable>
              </View>
            </SetRow>
          </View>
        ) : null}
      </View>

      {/* sv_not_advice — on both phases (buffer and upfront cash). */}
      <Text style={st.fine}>{t('sv_not_advice')}</Text>
      <Pressable onPress={() => up(s => { s.sheet = 'plinfo'; })} accessibilityRole="button" testID="plan-how"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginHorizontal: 4, minHeight: 32 }}>
        <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: K.tlI }}>{t('hx_how_plan')}</Text>
        <Ph n="caret-right" c={K.tlI} size={14} />
      </Pressable>
    </ScreenShell>
  );
}

/* The today card: shown each day until that day is saved. After "I saved" it
   holds the thank-you for a moment, then folds shut and what sits below
   slides up. A card already saved when the screen opens is simply not shown. */
function TodayFold({ done, children }: { done: boolean; children: React.ReactNode }) {
  const still = useStill();
  const [gone, setGone] = React.useState(done);
  const [h, setH] = React.useState(0);
  const [folding, setFolding] = React.useState(false);
  const v = React.useRef(new Animated.Value(1)).current;
  const was = React.useRef(done);
  React.useEffect(() => {
    if (done && !was.current) {
      /* just saved: let the thank-you show, then fold */
      const tm = setTimeout(() => {
        if (still) { setGone(true); return; }
        setFolding(true);
        Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: false })
          .start(() => { setGone(true); setFolding(false); });
      }, 1400);
      was.current = done;
      return () => clearTimeout(tm);
    }
    if (!done) { v.setValue(1); setGone(false); setFolding(false); }
    was.current = done;
    return undefined;
  }, [done, still, v]);
  if (gone) return null;
  return (
    <Animated.View testID="plan-today-card"
      onLayout={(e: LayoutChangeEvent) => { if (!folding) setH(e.nativeEvent.layout.height); }}
      style={folding && h ? {
        height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }),
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        overflow: 'hidden',
      } : null}>
      {children}
    </Animated.View>
  );
}

function SecHead({ title, right }: { title: string; right?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, marginHorizontal: 4 }}>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 15, color: K.text }}>{title}</Text>
      {right ? <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: K.text2 }}>{right}</Text> : null}
    </View>
  );
}

function Tip({ hue, icon, text }: { hue: Hue; icon: string; text: string }) {
  return (
    <View style={st.tip}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: hue.s, alignItems: 'center', justifyContent: 'center' }}>
        <Ph n={icon} c={hue.i} size={20} />
      </View>
      <Text style={{ flex: 1, fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 19, color: K.text }}>{text}</Text>
    </View>
  );
}

function TrackNode({ hue, kind, icon, title, sub }: { hue: Hue; kind: 'now' | 'done' | 'lock' | 'end'; icon: string; title: string; sub: string }) {
  const bg = kind === 'now' ? hue.c : kind === 'done' ? K.ok : kind === 'end' ? K.gldS : K.s2;
  const edge = kind === 'now' ? hue.d : kind === 'done' ? K.okD : bg;
  const fg = kind === 'now' || kind === 'done' ? '#fff' : kind === 'end' ? K.gldI : K.text3;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: bg, borderBottomWidth: kind === 'now' || kind === 'done' ? 4 : 0, borderBottomColor: edge, alignItems: 'center', justifyContent: 'center' }}>
        <Ph n={icon} c={fg} size={22} />
      </View>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, lineHeight: 16, color: K.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: K.text2, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{sub}</Text>
    </View>
  );
}

function Legend({ box, label }: { box: object; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[{ width: 12, height: 12, borderRadius: 4 }, box]} />
      <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: K.text2 }}>{label}</Text>
    </View>
  );
}

function SetRow({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: K.line }}>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 14, color: K.text }}>{title}</Text>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17.5, color: K.text2, marginTop: 2 }}>{sub}</Text>
      {children}
    </View>
  );
}

function upfrontNeedOf(q: { need: number }): number {
  return q.need;
}

const st = StyleSheet.create({
  helpBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2, borderColor: K.line,
  },
  empty: { alignItems: 'center', paddingTop: 10, paddingHorizontal: 6, gap: 6 },
  emptyH: { fontFamily: DISP_FONT, fontSize: 22, lineHeight: 27, color: K.text, textAlign: 'center' },
  emptyP: { fontFamily: BODY_FONT, fontSize: 14, lineHeight: 21, color: K.text2, textAlign: 'center', maxWidth: 300 },
  tip: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#1F2A44', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  today: { borderRadius: 18, padding: 16 },
  bub: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
    borderWidth: 2, borderColor: K.line,
  },
  bubTail: {
    position: 'absolute', left: -7, bottom: 12, width: 12, height: 12, backgroundColor: '#fff',
    borderLeftWidth: 2, borderBottomWidth: 2, borderColor: K.line, transform: [{ rotate: '45deg' }],
  },
  amt: { fontFamily: XBOLD_FONT, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, color: K.text, marginTop: 12, fontVariant: ['tabular-nums'] },
  amtSm: { fontFamily: SEMI_FONT, fontSize: 15, letterSpacing: 0, color: K.text2 },
  sk: { fontFamily: SEMI_FONT, fontSize: 13, color: K.text2, textDecorationLine: 'underline' },
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 10,
    shadowColor: '#1F2A44', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  trackLine: { position: 'absolute', left: '16.6%', right: '16.6%', top: 22, height: 4, borderRadius: 2, borderTopWidth: 4, borderStyle: 'dashed', borderColor: K.line2 },
  goal: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: K.line },
  gh: { fontFamily: XBOLD_FONT, fontSize: 24, color: K.text, fontVariant: ['tabular-nums'] },
  ghSm: { fontFamily: BODY_FONT, fontSize: 14, color: K.text2 },
  bar: { height: 12, borderRadius: 6, backgroundColor: K.s3, overflow: 'hidden', marginTop: 8 },
  gp: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 18, color: K.text2, marginTop: 8 },
  why: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: K.s2 },
  days: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  dcell: { width: `${100 / 7}%`, paddingHorizontal: 3, paddingBottom: 6 },
  todayLbl: { position: 'absolute', top: -16, left: 0, right: 0, textAlign: 'center', fontFamily: DISP_FONT, fontSize: 10 },
  dy: {
    aspectRatio: 0.78, borderRadius: 12, backgroundColor: K.s2, alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  dyS: { fontFamily: SEMI_FONT, fontSize: 9.5, color: K.text2 },
  mm: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: K.line },
  vil: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, paddingRight: 14, borderRadius: 18,
    backgroundColor: K.gldS, borderBottomWidth: 4, borderBottomColor: 'rgba(214,158,20,0.45)',
  },
  plot: { width: 122, height: 84, borderRadius: 14, backgroundColor: '#DDF2F8', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cnt: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(255,200,61,0.35)' },
  cntT: { fontFamily: DISP_FONT, fontSize: 11.5, color: K.gldI },
  play: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: K.gld, borderBottomWidth: 3, borderBottomColor: K.gldD, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chipB: { height: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: K.line2, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: K.text, borderColor: K.text },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  act: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: K.s2, alignItems: 'center', justifyContent: 'center' },
  actOn: { backgroundColor: K.text },
  actT: { fontFamily: SEMI_FONT, fontSize: 13, color: K.text },
  fine: { fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 17, color: K.text3, marginTop: 14, marginHorizontal: 4 },
  vplay: { backgroundColor: C.brand, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  vplayT: { fontFamily: DISP_FONT, fontSize: 13, color: '#fff' },
  vland: { fontFamily: DISP_FONT, fontSize: 13, color: '#9A6B00', textAlign: 'center' },
  eyeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  eyebrow: {
    fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase',
    color: C.ink64, marginBottom: 10,
  },
  vinfo: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink40,
    alignItems: 'center', justifyContent: 'center',
  },
  ofTarget: { fontFamily: BODY_FONT, fontWeight: '400', fontSize: 14, color: C.ink64 },
  plbar: { height: 10, borderRadius: 5, backgroundColor: C.ink14, overflow: 'hidden', marginTop: 8 },
  noteC: {
    borderLeftWidth: 4, borderLeftColor: C.caution, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.card, borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  weekLbl: {
    marginTop: 12, fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: C.ink64,
  },
  plgrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -3 },
  /* seven equal columns, 6px apart */
  plcell: { width: `${100 / 7}%`, paddingHorizontal: 3, paddingBottom: 6 },
  plday: {
    minHeight: 52, borderRadius: 12, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.ink14,
    alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 2,
  },
  plrm: { fontFamily: DISP_FONT, fontSize: 8.5, lineHeight: 10, letterSpacing: 0.34, opacity: 0.55 },
  btnLine: { fontFamily: BODY_FONT, fontSize: 16, color: C.ink, textDecorationLine: 'underline', textDecorationColor: C.brand },
  plctl: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  plctlBtn: {
    minHeight: 40, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.paper,
    borderWidth: 1.5, borderColor: C.ink14, alignItems: 'center', justifyContent: 'center', flexShrink: 1,
  },
  plctlOn: { backgroundColor: C.ink, borderColor: C.ink },
  plctlTxt: { fontFamily: SEMI_FONT, fontSize: 13.5, color: C.ink, textAlign: 'center' },
  rxchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rxchip: {
    minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderColor: C.ink14,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  rxchipOn: { backgroundColor: C.brand, borderColor: C.brand },
  potadd: {
    width: '100%', borderWidth: 1.8, borderStyle: 'dashed', borderColor: 'rgba(60,81,82,0.32)',
    borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 10,
  },
  potaddPl: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  pmrow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  pmbtn: {
    minHeight: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
