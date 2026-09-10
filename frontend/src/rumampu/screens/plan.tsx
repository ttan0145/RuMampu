import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useApp } from '../state';
import { rm } from '../calc';
import { planEnsure, planRegen, planSaved, planToggle } from '../plan';
import { villageEnsure } from '../village';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { BodyS, BtnQuiet, Card, Display, NumInput, P, Prov, Row } from '../ui';
import { ScreenShell } from './shell';

/* v22 saving plan screen: monthly target, day grid, shuffle, savings pot. */

function jarXml(level: number): string {
  const lvl = Math.max(0, Math.min(1, level));
  const fh = 12.5 * lvl, fy = 19.5 - fh;
  return `<svg width="44" height="44" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<rect x="8" y="2.6" width="8" height="2.6" rx="1.2" fill="none" stroke="#4A9195" stroke-width="1.6"/>
<path d="M6.5 7.2h11a1.5 1.5 0 0 1 1.5 1.5v10.3a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.5-2.5V8.7a1.5 1.5 0 0 1 1.5-1.5z" fill="#fff" stroke="#4A9195" stroke-width="1.6"/>
${lvl > 0 ? `<rect x="6.6" y="${fy}" width="10.8" height="${fh}" rx="1.4" fill="#4A9195" opacity=".8"/>` : ''}
</svg>`;
}

export function PlanScreen() {
  const { S, t, up, toast } = useApp();
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  React.useEffect(() => {
    if (!S.plan || S.plan.key !== monthKey) up(s => { planEnsure(s); villageEnsure(s); });
  }, [S.plan, monthKey, up]);
  if (!S.plan || S.plan.key !== monthKey) return <ScreenShell back title={t('pl_title')}><View /></ScreenShell>;

  const p = S.plan;
  const today = new Date().getDate() - 1;
  const saved = planSaved(p);
  const pct = Math.min(100, Math.round(saved / p.target * 100));
  const doneN = p.done.filter(Boolean).length;

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
      <Card gap={8}>
        <BodyS muted>{t('pl_target')}</BodyS>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink64 }}>RM</Text>
          <View style={{ flex: 1 }}>
            <NumInput
              value={p.target}
              onNum={() => undefined}
              onCommit={n => up(s => {
                const plan = planEnsure(s);
                plan.target = Math.max(1, Math.round(n) || 0);
                planRegen(plan);
              })}
              decimal={false}
              accessibilityLabel={t('pl_target')}
            />
          </View>
        </View>
        <BodyS muted>{t('pl_hint')}</BodyS>
      </Card>
      <Card>
        <Row>
          <Display cls="h-m">
            {rm(saved)} <Text style={{ fontFamily: BODY_FONT, fontWeight: '400', fontSize: 14, color: C.ink64 }}>/ {rm(p.target)}</Text>
          </Display>
          <BodyS muted>{t('pl_days', { d: doneN, n: p.n })}</BodyS>
        </Row>
        <View style={st.plbar}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: '#3F8A8E' }} />
        </View>
        {saved >= p.target ? (
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.confirm, marginTop: 6 }}>{t('pl_reached')}</Text>
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
            <SvgXml xml={jarXml(saved / Math.max(1, p.target))} width={44} height={44} />
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
