import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state';
import { rm } from '../calc';
import { HouseCostType } from '../../../types/housing';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { BodyS } from '../ui';
import { ScreenShell } from './shell';
import { SheetFrame } from '../overlays';

/* US11 — What homes cost here (Figma B24). Published NAPIC medians per
   district, expressed as years of a typical family's income in that state.
   Data is published-figure provenance, never the user's own record. */

const TYPE_KEYS: HouseCostType[] = ['all', 'terr', 'condo', 'flat', 'lch', 'lcf'];

/* Update this whenever the NAPIC or DOSM loaders are re-run. It records when
   the figures were last verified against the published sources, which is a
   manual step and therefore cannot come from the API. */
const HC_LAST_CHECKED = '13 September 2026';

/* v24: Demographia band for a median multiple — the colours belong to the
   scale, never to a household. */
export function fhBand(y: number): number {
  return y <= 3 ? 0 : y <= 4 ? 1 : y <= 5 ? 2 : 3;
}
export const FH_BANDC = [C.confirm, C.caution, C.short, C.ink];
export const FH_BAND_KEYS = [['fh_r1', 'fh_b1'], ['fh_r2', 'fh_b2'], ['fh_r3', 'fh_b3'], ['fh_r4', 'fh_b4']] as const;

function PickSheet({ title, options, value, onPick, onClose }: {
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
  const { S, t, up, loadHouseCosts } = useApp();
  const [pick, setPick] = React.useState<'state' | 'type' | 'info' | null>(null);

  React.useEffect(() => { void loadHouseCosts(); }, [loadHouseCosts]);

  const data = S.houseCosts;
  const stateData = data?.states[S.hcState];
  const income = stateData?.income ?? null;
  const threshold = data ? Math.round(data.affordable_threshold / 1000) : 300;

  const rows = React.useMemo(() => {
    const places = stateData?.types?.[S.hcType] ?? {};
    return Object.entries(places)
      .map(([district, [sales, median, under]]) => ({
        district, sales, median, under,
        years: income ? median / (income * 12) : null,
      }))
      .sort((a, b) => (a.years ?? Number.MAX_VALUE) - (b.years ?? Number.MAX_VALUE));
  }, [stateData, S.hcType, income]);
  const maxYears = Math.max(1e-9, ...rows.map(r => r.years ?? 0));

  const stateOptions = Object.entries(data?.states ?? {})
    .map(([key, s]) => ({ key, label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const typeOptions = TYPE_KEYS.map(k => ({ key: k, label: t('fh_t_' + k) }));

  return (
    <ScreenShell back title={t('fh_title')}>
      <Pressable onPress={() => setPick('state')} style={st.pickField}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pickLbl}>{t('fh_state_c')}</Text>
          <Text style={st.pickVal}>{stateData?.name ?? '—'}</Text>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      <Pressable onPress={() => setPick('type')} style={st.pickField}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pickLbl}>{t('fh_type')}</Text>
          <Text style={st.pickVal}>{t('fh_t_' + S.hcType)}</Text>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 18, color: C.ink }}>
        {t('fh_intro', { s: stateData?.name ?? '—' })}
      </Text>
      {S.houseCostsSync === 'loading' || S.houseCostsSync === 'idle' ? (
        <View style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
          <ActivityIndicator color={C.brand} />
          <BodyS muted>{t('hc_loading')}</BodyS>
        </View>
      ) : S.houseCostsSync === 'error' ? (
        <BodyS muted style={{ textAlign: 'center', paddingVertical: 24 }}>{t('hc_error')}</BodyS>
      ) : (
        <View style={st.listCard}>
          {rows.map((r, i) => (
            <View key={r.district} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: C.ink14 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={st.rowName} numberOfLines={1}>
                  {r.district}
                  {r.sales < 10 ? <Text style={{ fontFamily: BODY_FONT, fontSize: 10.5, color: C.ink64 }}>  {t('fh_few')}</Text> : null}
                </Text>
                <Text style={st.rowYears}>
                  {r.years == null ? '—' : t('fh_yrs', { n: r.years.toFixed(1) })}
                </Text>
              </View>
              <View style={st.bar}>
                {r.years != null ? (
                  <View style={{
                    width: `${Math.max(4, Math.min(100, Math.round(r.years / maxYears * 100)))}%`,
                    height: '100%', borderRadius: 4, backgroundColor: FH_BANDC[fhBand(r.years)],
                  }} />
                ) : null}
              </View>
              <Text style={st.rowSub}>
                {rm(r.median)} {'\u00b7'} {t('fh_sold', { n: r.sales.toLocaleString('en-MY') })} {'\u00b7'} {t('fh_u300', { n: r.under.toLocaleString('en-MY'), k: threshold })}
              </Text>
            </View>
          ))}
          {!rows.length ? <BodyS muted style={{ padding: 14 }}>{t('fh_none')}</BodyS> : null}
        </View>
      )}
      <BodyS muted style={{ fontSize: 11.5 }}>{t('hc_checked', { d: HC_LAST_CHECKED })}</BodyS>
      <Pressable onPress={() => setPick('info')} style={st.infoBtn}>
        <View style={st.infoIc}><Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text></View>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, flexShrink: 1 }}>{t('fh_i')}</Text>
      </Pressable>
      {pick === 'state' ? (
        <PickSheet title={t('fh_state_c')} options={stateOptions} value={S.hcState}
          onPick={key => up(s => { s.hcState = key; })} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'type' ? (
        <PickSheet title={t('fh_type')} options={typeOptions} value={S.hcType}
          onPick={key => up(s => { s.hcType = key as HouseCostType; })} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'info' ? (
        <InfoSheet t={t} stateName={stateData?.name ?? '—'} income={income ?? 0} onClose={() => setPick(null)} />
      ) : null}
    </ScreenShell>
  );
}

/* v24 fhInfoBody: what the figures are, what they are not, the Demographia
   scale with its colours, and every source. */
function InfoSheet({ t, stateName, income, onClose }: {
  t: (k: string, v?: Record<string, string | number>) => string;
  stateName: string; income: number; onClose: () => void;
}) {
  return (
    <SheetFrame pose="curious" onClose={onClose} scroll>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink, flexShrink: 1 }}>{t('fh_i')}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Text style={{ fontSize: 18, color: C.ink }}>✕</Text></Pressable>
          </View>
          <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
            <BodyS>{t('fh_not')}</BodyS>
            <BodyS>{t('fh_earn', { s: stateName, m: income.toLocaleString('en-MY') })}</BodyS>
            <BodyS>{t('fh_basis')}</BodyS>
            {['fh_i1', 'fh_i7', 'fh_i2', 'fh_i5', 'fh_i6'].map(k => <BodyS key={k}>{t(k)}</BodyS>)}
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
  pickField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EDF2F1', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minHeight: 56,
  },
  pickLbl: {
    fontFamily: DISP_FONT, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: C.ink64,
  },
  pickVal: { fontFamily: DISP_FONT, fontSize: 16, color: C.ink, marginTop: 1 },
  listCard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  row: { paddingVertical: 12, gap: 6 },
  rowName: { fontFamily: DISP_FONT, fontSize: 15.5, color: C.ink, flexShrink: 1 },
  rowYears: { fontFamily: DISP_FONT, fontSize: 15.5, color: C.ink, fontVariant: ['tabular-nums'] },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.ink14, overflow: 'hidden' },
  rowSub: { fontFamily: BODY_FONT, fontSize: 12, lineHeight: 16, color: C.ink64 },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, paddingHorizontal: 12, borderRadius: 12,
  },
  infoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  infoIc: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink40,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleCard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8, gap: 2,
  },
});
