import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state';
import { rm } from '../calc';
import { HouseCostType } from '../../../types/housing';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { BodyS } from '../ui';
import { ScreenShell } from './shell';

/* US11 — What homes cost here (Figma B24). Published NAPIC medians per
   district, expressed as years of a typical family's income in that state.
   Data is published-figure provenance, never the user's own record. */

const TYPE_KEYS: HouseCostType[] = ['all', 'terr', 'condo', 'flat', 'lch', 'lcf'];

/* Years of state income → bar colour: the calmer the shorter. */
function yearsColor(y: number): string {
  if (y <= 3) return '#3EA34D';
  if (y <= 4) return '#F4C64D';
  return C.out;
}

function PickSheet({ title, options, value, onPick, onClose }: {
  title: string;
  options: { key: string; label: string }[];
  value: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={{ flex: 1, backgroundColor: 'rgba(60,81,82,0.45)' }} />
        </Pressable>
        <View style={[
          st.sheet, { paddingBottom: 20 + insets.bottom },
          Platform.OS === 'web' ? { width: '100%', maxWidth: 390, alignSelf: 'center' } : null,
        ]}>
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
        </View>
      </View>
    </Modal>
  );
}

export function HomeCostsScreen() {
  const { S, t, up, loadHouseCosts } = useApp();
  const [pick, setPick] = React.useState<'state' | 'type' | 'from' | null>(null);

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

  const stateOptions = Object.entries(data?.states ?? {})
    .map(([key, s]) => ({ key, label: s.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const typeOptions = TYPE_KEYS.map(k => ({ key: k, label: t('hc_t_' + k) }));

  return (
    <ScreenShell back title={t('hc_title')}>
      <Pressable onPress={() => setPick('state')} style={st.pickField}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pickLbl}>{t('hc_state')}</Text>
          <Text style={st.pickVal}>{stateData?.name ?? '—'}</Text>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      <Pressable onPress={() => setPick('type')} style={st.pickField}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pickLbl}>{t('hc_type')}</Text>
          <Text style={st.pickVal}>{t('hc_t_' + S.hcType)}</Text>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 18, color: C.ink }}>
        {t('hc_intro', { s: stateData?.name ?? '—' })}{' '}
        <Text onPress={() => setPick('from')} style={{ color: C.brand, textDecorationLine: 'underline' }}>
          {t('hc_from')}
        </Text>
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
                <Text style={st.rowName} numberOfLines={1}>{r.district}</Text>
                <Text style={st.rowYears}>
                  {r.years == null ? '—' : t('hc_years', { y: r.years.toFixed(1) })}
                </Text>
              </View>
              <View style={st.bar}>
                {r.years != null ? (
                  <View style={{
                    width: `${Math.max(4, Math.min(100, Math.round(r.years / 5 * 100)))}%`,
                    height: '100%', borderRadius: 4, backgroundColor: yearsColor(r.years),
                  }} />
                ) : null}
              </View>
              <Text style={st.rowSub}>
                {t('hc_sub', { p: rm(r.median), n: r.sales.toLocaleString('en-MY'), u: r.under.toLocaleString('en-MY'), t: threshold })}
              </Text>
            </View>
          ))}
          {!rows.length ? <BodyS muted style={{ padding: 14 }}>—</BodyS> : null}
        </View>
      )}
      {pick === 'state' ? (
        <PickSheet title={t('hc_state')} options={stateOptions} value={S.hcState}
          onPick={key => up(s => { s.hcState = key; })} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'type' ? (
        <PickSheet title={t('hc_type')} options={typeOptions} value={S.hcType}
          onPick={key => up(s => { s.hcType = key as HouseCostType; })} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'from' && data ? (
        <PickSheet title={t('hc_from')} value="" onPick={() => undefined} onClose={() => setPick(null)}
          options={[{
            key: 'body',
            label: t('hc_from_b', { w: `${data.window.from} \u2013 ${data.window.to}`, y: String(data.income_year) }),
          }]} />
      ) : null}
    </ScreenShell>
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
  sheet: {
    backgroundColor: C.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, paddingHorizontal: 12, borderRadius: 12,
  },
});
