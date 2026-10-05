import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { HousingTestResult } from '../../../types/housing';
import { useApp } from '../state';
import { rm } from '../calc';
import {
  bufferEnsure, feasibilityGap, planEnsure, planPause, planPhase, planReset, planResolveTarget,
  planSaved, planShuffleLeft, planSkip, planToggle, syncBufferTarget, potGap, potLevel, potSplit,
  planHorizonEffective, planMonthlyAsk, planMonthRows, monthlySaveCapacity, PLAN_HORIZONS,
} from '../plan';
import { commitTotal } from '../calc';
import { villageEnsure } from '../village';
import { logIt } from '../log';
import { getHousingTestResult } from '../../../services/housingSession';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { BodyS, Btn, BtnQuiet, Card, CardI, Display, P, Prov, Row } from '../ui';
import { ScreenShell } from './shell';
import { GuideTarget } from '../tour';

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

  if (!S.plan || S.plan.key !== monthKey) return <ScreenShell back title={t('pl_title')}><View /></ScreenShell>;

  const phase = planPhase(S, result);

  if (phase === 'setup') {
    return (
      <ScreenShell back title={t('pl_title')}>
        <InfoRow />
        <GuideTarget id="pl.setup">
        <Card gap={10}>
          <Display cls="h-m">{t('p10_setup_t')}</Display>
          <BodyS muted>{t('p10_setup')}</BodyS>
          <Btn label={t('p10_setup_btn')} onPress={() => go('househome')} />
        </Card>
        </GuideTarget>
        <PotsCard result={result} />
        <PotMonthCard />
      </ScreenShell>
    );
  }

  if (phase === 'explain' && result) {
    const short = Math.round(-feasibilityGap(result));
    return (
      <ScreenShell back title={t('pl_title')}>
        <InfoRow />
        <Card gap={10}>
          <Display cls="h-m">{t('p10_explain_t')}</Display>
          <P style={{ color: C.ink64 }}>{t('p10_explain', { a: rm(short) })}</P>
          <BtnQuiet onPress={() => go('househome')}>
            <P>{t('p10_explain_btn')}</P>
          </BtnQuiet>
        </Card>
        <PotsCard result={result} />
        <PotMonthCard />
      </ScreenShell>
    );
  }

  const p = S.plan;
  const b = S.buffer;
  const v = S.village;
  const today = new Date().getDate() - 1;
  const saved = planSaved(p);
  const pct = p.target > 0 ? Math.min(100, Math.round(saved / p.target * 100)) : 100;
  const doneN = p.done.filter(Boolean).length;
  const inBuffer = phase === 'buffer';
  const q = potSplit(S, result);
  /* the goal this phase is filling */
  const tgt = inBuffer ? (b?.target ?? 0) : q.need;
  const have = inBuffer ? (b?.saved ?? 0) : q.up;
  const gpct = tgt > 0 ? Math.min(100, Math.round(have / tgt * 100)) : 100;
  const shortN = result ? Number(result.short_month_count) || 0 : 0;
  const testedN = result ? (result.tested_months ?? result.months.length) : 0;
  const upfrontDone = !inBuffer && q.need > 0 && q.up >= q.need;
  /* how long to spread it over: the person's pick, or what the record allows */
  const horizon = planHorizonEffective(S);
  const monthlyAsk = planMonthlyAsk(S);
  const capacity = monthlySaveCapacity(S);

  const paused = !!p.paused;
  const monthEnding = p.n - (today + 1) <= 2;

  const toggle = (i: number) => {
    if (paused) return;
    /* v27b: in Skip days mode a tap skips (or un-skips) a day not yet saved. */
    if (skipMode && !p.done[i]) { up(s => { planSkip(s, i); }); return; }
    if (p.skipped?.[i]) { up(s => { planSkip(s, i); }); return; }
    const wasDone = p.done[i];
    up(s => { planToggle(s, i); });
    toast(wasDone
      ? t('pl_untoast', { a: rm(p.amounts[i]) })
      : t('pl_toast', { a: rm(p.amounts[i]), c: rm((S.village?.savedRm ?? 0) + p.amounts[i]) }));
  };

  const showAll = wholeMonth || skipMode;
  const wk = Math.floor(today / 7);

  return (
    <ScreenShell back title={t('pl_title')}>
      <InfoRow />

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
        <Card gap={8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SvgXml xml={inBuffer ? shieldXml(gpct / 100) : jarXml(gpct / 100)} width={44} height={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display cls="h-m">{t(inBuffer ? 'p10_shield_t' : 'p10_village_t')}</Display>
              <BodyS muted style={{ marginTop: 2 }}>{t(inBuffer ? 'p10_shield_sub' : 'p10_village_sub')}</BodyS>
            </View>
          </View>
          <Row>
            <Display cls="h-m">
              {rm(have)} <Text style={st.ofTarget}>/ {rm(tgt)}</Text>
            </Display>
            <Prov p="calc" />
          </Row>
          <Bar pct={gpct} style={{ marginTop: 4 }} />
          <BodyS muted>{t('p10_target_from')}</BodyS>
          {inBuffer && shortN ? <Note>{t('p10_short_note', { s: shortN, n: testedN })}</Note> : null}
          {(b?.overflow ?? 0) > 0 && inBuffer ? <BodyS muted>{t('p10_overflow', { a: rm(b?.overflow ?? 0) })}</BodyS> : null}
          {(v?.queued ?? 0) > 0 ? <BodyS muted>{t('vl_queue', { n: v?.queued ?? 0 })}</BodyS> : null}
        </Card>
        </GuideTarget>
      )}

      {/* Spread it over: the record's answer or a number of months, as chips.
          The safety buffer is filled first and asks its whole gap, so the
          choice applies once upfront cash is the goal. */}
      {!inBuffer && !upfrontDone ? (
        <View>
          <Text style={st.eyebrow}>{t('pl_hz_t')}</Text>
          <GuideTarget id="pl.chips" style={st.rxchips}>
            {[null, ...PLAN_HORIZONS].map(h => {
              const on = h === null ? !S.planHorizon : S.planHorizon === h;
              return (
                <Pressable key={h ?? 0} onPress={() => up(s => { s.planHorizon = h; })}
                  accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[st.rxchip, on && st.rxchipOn]}>
                  <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: on ? '#fff' : C.ink }}>
                    {h ? t('pl_hz_mo', { n: h }) : t('pl_hz_rec')}
                  </Text>
                </Pressable>
              );
            })}
          </GuideTarget>
          <BodyS muted style={{ marginTop: 8 }}>
            {!S.planHorizon && capacity != null
              ? t('pl_hz_rec_sub', { a: rm(monthlyAsk) })
              : t('pl_hz_sub', { a: rm(monthlyAsk), n: horizon || 12 })}
          </BodyS>
        </View>
      ) : null}

      <Card>
        <Row>
          <Display cls="h-m">
            {rm(saved)} <Text style={st.ofTarget}>/ {rm(p.target)}</Text>
          </Display>
          <BodyS muted>{t('pl_days', { d: doneN, n: p.n })}</BodyS>
        </Row>
        <Bar pct={pct} />
        {saved >= p.target && p.target > 0 ? (
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.confirm, marginTop: 6 }}>
            {inBuffer ? t('p10_shield_done') : t('pl_reached')}
          </Text>
        ) : null}
        {(p.from ?? 0) > 0 ? <BodyS muted style={{ marginTop: 6 }}>{t('pl_partial')}</BodyS> : null}
        {paused ? <View style={{ marginTop: 10 }}><Note>{t('pl_paused_b')}</Note></View> : null}
        {monthEnding && !paused ? <View style={{ marginTop: 10 }}><Note>{t('pl_monthend')}</Note></View> : null}
        <Text style={st.weekLbl}>{showAll ? t('pl_month') : t('pl_week')}</Text>
        {skipMode ? <BodyS style={{ marginTop: 6 }}>{t('pl_skipmode_h')}</BodyS> : null}
        <GuideTarget id="pl.grid" style={[st.plgrid, paused && { opacity: 0.5 }]}>
          {p.amounts.map((a, i) => {
            if (!showAll && (i < wk * 7 || i >= wk * 7 + 7)) return null;
            const done = p.done[i];
            const skipped = !!p.skipped?.[i] && !done;
            const isToday = i === today;
            const miss = !paused && i < today && !done && !skipped && a > 0;
            return (
              <View key={i} style={st.plcell}>
                <Pressable onPress={() => toggle(i)}
                  onLongPress={() => { if (!paused && !done) up(s => { planSkip(s, i); }); }}
                  disabled={paused}
                  accessibilityRole="button"
                  accessibilityState={{ selected: done }}
                  style={[st.plday,
                    miss && { borderStyle: 'dashed', borderColor: C.caution, backgroundColor: '#FFF8E5' },
                    skipped && { borderStyle: 'dotted', backgroundColor: C.paper },
                    isToday && { borderColor: C.ink, borderWidth: 2 },
                    done && { backgroundColor: C.brand, borderColor: C.brand },
                  ]}>
                  <Text style={{ fontFamily: BODY_FONT, fontSize: 10, lineHeight: 12, color: done ? 'rgba(255,255,255,0.8)' : C.ink64 }}>{i + 1}</Text>
                  {skipped ? (
                    <Text style={{ fontFamily: SEMI_FONT, fontSize: 10, lineHeight: 15, color: C.ink64 }}>{t('pl_skip_short')}</Text>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[st.plrm, { color: done ? '#fff' : C.ink }]}>RM</Text>
                      <Text style={{ fontFamily: DISP_FONT, fontSize: 12.5, lineHeight: 15, color: done ? '#fff' : C.ink, fontVariant: ['tabular-nums'] }}>
                        {done ? '✓ ' : ''}{a}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </GuideTarget>
        {showAll ? (
          <BtnQuiet arrow={false} style={{ justifyContent: 'center', marginTop: 12 }}
            onPress={() => up(s => { planShuffleLeft(s, today); })}>
            <P style={{ textAlign: 'center' }}>{t('pl_shuffle')}</P>
          </BtnQuiet>
        ) : null}
        <Pressable onPress={() => setWholeMonth(w => !w)} accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 }}>
          <Text style={st.btnLine}>{t(showAll ? 'pl_showweek' : 'pl_showmonth')}</Text>
        </Pressable>
        <View style={st.plctl}>
          <Pressable onPress={() => { setSkipMode(m => !m); }} accessibilityRole="button"
            accessibilityState={{ selected: skipMode }} style={[st.plctlBtn, skipMode && st.plctlOn]}>
            <Text style={[st.plctlTxt, skipMode && { color: '#fff' }]}>{t('pl_skipmode')}</Text>
          </Pressable>
          <Pressable onPress={() => up(s => { planPause(s); })} accessibilityRole="button" style={st.plctlBtn}>
            <Text style={st.plctlTxt}>{t(paused ? 'pl_resume' : 'pl_pause')}</Text>
          </Pressable>
          {/* LeanKit 10.11: reset asks twice; record, village and savings kept. */}
          <Pressable
            onPress={() => {
              if (!resetArmed) { setResetArmed(true); return; }
              setResetArmed(false);
              setSkipMode(false);
              up(s => { planReset(s); });
              toast(t('pl_reset_done'));
            }}
            accessibilityRole="button"
            style={[st.plctlBtn, resetArmed && st.plctlOn]}>
            <Text style={[st.plctlTxt, resetArmed && { color: '#fff' }]}>{t(resetArmed ? 'pl_reset_arm' : 'pl_reset')}</Text>
          </Pressable>
        </View>
      </Card>

      <PotsCard result={result} />
      <PotMonthCard />
      {/* sv_not_advice — on both phases (buffer and upfront cash). */}
      <BodyS muted style={{ textAlign: 'center', paddingHorizontal: 8 }}>{t('sv_not_advice')}</BodyS>
    </ScreenShell>
  );
}

function upfrontNeedOf(q: { need: number }): number {
  return q.need;
}

const st = StyleSheet.create({
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
