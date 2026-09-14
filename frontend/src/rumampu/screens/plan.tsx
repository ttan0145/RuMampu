import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useApp } from '../state';
import { rm } from '../calc';
import {
  bufferEnsure, feasibilityGap, planEnsure, planPhase, planRegen, planResolveTarget, planSaved,
  planToggle, syncBufferTarget, upfrontNeed,
} from '../plan';
import { villageEnsure } from '../village';
import { getHousingTestResult } from '../../../services/housingSession';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { BodyS, Btn, BtnQuiet, Card, Display, P, Prov, Row } from '../ui';
import { ScreenShell } from './shell';

/* Epic 10 saving plan screen. One source of truth (planPhase) decides what
   renders: setup (no house test yet), explain (house doesn't fit), the buffer
   shield, or the village/upfront phase. Targets always come from the user's
   own record — the old editable RM500 default is gone. */

function jarXml(level: number): string {
  const lvl = Math.max(0, Math.min(1, level));
  const fh = 12.5 * lvl, fy = 19.5 - fh;
  return `<svg width="44" height="44" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<rect x="8" y="2.6" width="8" height="2.6" rx="1.2" fill="none" stroke="#4A9195" stroke-width="1.6"/>
<path d="M6.5 7.2h11a1.5 1.5 0 0 1 1.5 1.5v10.3a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.5-2.5V8.7a1.5 1.5 0 0 1 1.5-1.5z" fill="#fff" stroke="#4A9195" stroke-width="1.6"/>
${lvl > 0 ? `<rect x="6.6" y="${fy}" width="10.8" height="${fh}" rx="1.4" fill="#4A9195" opacity=".8"/>` : ''}
</svg>`;
}

/* The shield: a filled meter, no tiles, never red. */
function shieldXml(level: number): string {
  const lvl = Math.max(0, Math.min(1, level));
  const h = 15 * lvl, y = 19.4 - h;
  return `<svg width="46" height="46" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="sh"><path d="M12 2.6l7.4 2.8v6.1c0 4.6-3 8.1-7.4 9.9-4.4-1.8-7.4-5.3-7.4-9.9V5.4z"/></clipPath></defs>
${lvl > 0 ? `<rect x="3" y="${y}" width="18" height="${h}" fill="#3F8A8E" clip-path="url(#sh)"/>` : ''}
<path d="M12 2.6l7.4 2.8v6.1c0 4.6-3 8.1-7.4 9.9-4.4-1.8-7.4-5.3-7.4-9.9V5.4z" fill="none" stroke="#2E6B6E" stroke-width="1.7" stroke-linejoin="round"/>
</svg>`;
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
  }, [result, up]);

  /* A moved safety target is announced, never silent (Epic 10 decision). */
  const bufMsg = S.buffer?.msg;
  React.useEffect(() => {
    if (bufMsg !== 'moved') return;
    toast(t('p10_moved', { from: rm(S.buffer?.prevTarget ?? 0), to: rm(S.buffer?.target ?? 0) }));
    up(s => { bufferEnsure(s).msg = null; });
  }, [bufMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!S.plan || S.plan.key !== monthKey) return <ScreenShell back title={t('pl_title')}><View /></ScreenShell>;

  const phase = planPhase(S, result);

  if (phase === 'setup') {
    return (
      <ScreenShell back title={t('pl_title')}>
        <Card gap={10}>
          <Display cls="h-m">{t('p10_setup_t')}</Display>
          <P style={{ color: C.ink64 }}>{t('p10_setup')}</P>
          <Btn label={t('p10_setup_btn')} onPress={() => go('househome')} />
        </Card>
      </ScreenShell>
    );
  }

  if (phase === 'explain' && result) {
    const short = Math.round(-feasibilityGap(result));
    return (
      <ScreenShell back title={t('pl_title')}>
        <Card gap={10}>
          <Display cls="h-m">{t('p10_explain_t')}</Display>
          <P style={{ color: C.ink64 }}>{t('p10_explain', { a: rm(short) })}</P>
          <BtnQuiet onPress={() => go('househome')}>
            <P>{t('p10_explain_btn')}</P>
          </BtnQuiet>
        </Card>
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
  const bTarget = b?.target ?? 0;
  const bPct = bTarget > 0 ? Math.min(100, Math.round((b?.saved ?? 0) / bTarget * 100)) : 100;
  const upShort = Math.max(0, upfrontNeed(S.data) - S.data.cashOnHand);

  const toggle = (i: number) => {
    const wasDone = p.done[i];
    up(s => { planToggle(s, i); });
    toast(wasDone
      ? t('pl_untoast', { a: rm(p.amounts[i]) })
      : t('pl_toast', { a: rm(p.amounts[i]), c: rm(S.data.cashOnHand + p.amounts[i]) }));
  };

  return (
    <ScreenShell back title={t('pl_title')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={st.eyebrow}>{t('pl_sec')}</Text>
        <Pressable onPress={() => up(s => { s.sheet = 'plinfo'; })} style={st.vinfo} accessibilityLabel="info">
          <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text>
        </Pressable>
      </View>
      {inBuffer ? (
        <Card gap={8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <SvgXml xml={shieldXml(bPct / 100)} width={46} height={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display cls="h-m">
                {rm(b?.saved ?? 0)} <Text style={st.ofTarget}>/ {rm(bTarget)}</Text>
              </Display>
              <BodyS muted style={{ fontSize: 12 }}>{t('p10_shield_t')} · {t('p10_target_from')}</BodyS>
            </View>
            <Prov p="calc" />
          </View>
          <View style={st.plbar}>
            <View style={{ width: `${bPct}%`, height: '100%', borderRadius: 5, backgroundColor: '#3F8A8E' }} />
          </View>
          <BodyS muted>{t('p10_shield_sub')}</BodyS>
          {(b?.overflow ?? 0) > 0 ? <BodyS muted>{t('p10_overflow', { a: rm(b?.overflow ?? 0) })}</BodyS> : null}
        </Card>
      ) : upShort === 0 && result ? (
        /* Completion hands off to reality, not "you win". */
        <Card gap={8}>
          <Display cls="h-m">{t('p10_done_t')}</Display>
          <P style={{ color: C.ink64 }}>
            {t('p10_done', {
              d: rm(upfrontNeed(S.data)),
              b: rm(bTarget),
              m: rm(Math.round(Number(result.tested_home_cost) || 0)),
            })}
          </P>
        </Card>
      ) : (
        <Card gap={8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display cls="h-m">{t('p10_village_t')}</Display>
              <BodyS muted>{t('p10_village_sub')}</BodyS>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 20, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(upShort)}</Text>
              <Prov p="calc" />
            </View>
          </View>
          {(v?.queued ?? 0) > 0 ? <BodyS muted>{t('vl_queue', { n: v?.queued ?? 0 })}</BodyS> : null}
        </Card>
      )}
      <Card>
        <Row>
          <Display cls="h-m">
            {rm(saved)} <Text style={st.ofTarget}>/ {rm(p.target)}</Text>
          </Display>
          <BodyS muted>{t('pl_days', { d: doneN, n: p.n })}</BodyS>
        </Row>
        <View style={st.plbar}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: '#3F8A8E' }} />
        </View>
        {saved >= p.target && p.target > 0 ? (
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.confirm, marginTop: 6 }}>
            {inBuffer ? t('p10_shield_done') : t('pl_reached')}
          </Text>
        ) : null}
        <View style={st.plgrid}>
          {p.amounts.map((a, i) => {
            const done = p.done[i];
            const isToday = i === today;
            const miss = i < today && !done;
            return (
              <Pressable key={i} onPress={() => toggle(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: done }}
                style={[st.plday,
                  miss && { borderStyle: 'dashed', borderColor: C.caution, backgroundColor: '#FFF8E5' },
                  isToday && { borderColor: C.ink, borderWidth: 2 },
                  done && { backgroundColor: C.brand, borderColor: C.brand },
                ]}>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 10, lineHeight: 12, color: done ? 'rgba(255,255,255,0.8)' : C.ink64 }}>{i + 1}</Text>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 12.5, lineHeight: 15, color: done ? '#fff' : C.ink, fontVariant: ['tabular-nums'] }}>
                  {done ? '✓ ' : ''}{a}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <BtnQuiet arrow={false} style={{ justifyContent: 'center', marginTop: 12 }}
          onPress={() => up(s => { const plan = planEnsure(s); plan.seed++; planRegen(plan); })}>
          <P style={{ textAlign: 'center' }}>{t('pl_shuffle')}</P>
        </BtnQuiet>
      </Card>
      <View>
        <Text style={st.eyebrow}>{t('sp_pots')}</Text>
        <Card gap={10}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <SvgXml xml={jarXml(p.target > 0 ? saved / p.target : 1)} width={44} height={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('sp_pot1')}</Text>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 16, color: C.ink64, marginTop: 1 }}>{t('sp_pot1h')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 20, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(saved)}</Text>
              <Prov p="user" />
            </View>
          </View>
          <Pressable onPress={() => up(s => { s.sheet = 'potadd'; })} style={st.potadd}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>+</Text>
            </View>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 13.5, color: C.brand }}>{t('sp_addpot')}</Text>
          </Pressable>
        </Card>
      </View>
      {/* sv_not_advice — rendered on both phases (buffer and village). */}
      <BodyS muted style={{ textAlign: 'center', paddingHorizontal: 8 }}>{t('sv_not_advice')}</BodyS>
    </ScreenShell>
  );
}

const st = StyleSheet.create({
  eyebrow: {
    fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase',
    color: C.ink64, marginBottom: 10,
  },
  vinfo: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  ofTarget: { fontFamily: BODY_FONT, fontWeight: '400', fontSize: 14, color: C.ink64 },
  plbar: { height: 10, borderRadius: 5, backgroundColor: C.ink14, overflow: 'hidden', marginTop: 8 },
  plgrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12,
  },
  plday: {
    width: '12.5%', flexGrow: 1, flexBasis: '12%', minHeight: 52, borderRadius: 12,
    backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink14,
    alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 2,
  },
  potadd: {
    width: '100%', borderWidth: 1.8, borderStyle: 'dashed', borderColor: 'rgba(60,81,82,0.32)',
    borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 2,
  },
});
