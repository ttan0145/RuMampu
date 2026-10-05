import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { useApp } from '../state';
import { nf, rm } from '../calc';
import { HouseCostType } from '../../../types/housing';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { BodyS, Prov } from '../ui';
import { GuideTarget } from '../tour';
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

/* ---- v27b the district map (Epic 11). Each district is shaded by its middle
   sale price, in one hue, with every shade named in words. Selangor is drawn as
   a schematic; other states show their districts as tiles from A to Z. A tested
   price becomes a count statement from the published figures, never a colour
   or a verdict on the person (D59). */
const FH_SHADE = ['#DCEFEE', '#A6D3D4', '#5FA3A7', '#2F6F73'];
function fhPb(med: number): number { return med < 300000 ? 0 : med < 400000 ? 1 : med < 500000 ? 2 : 3; }
const SG_MAP: Record<string, { d: string; x: number; y: number }> = {
  'Sabak Bernam': { d: 'M22 26 L118 14 L146 44 L112 84 L44 92 L16 62 Z', x: 74, y: 52 },
  'Hulu Selangor': { d: 'M118 14 L296 22 L304 122 L252 150 L192 142 L150 112 L146 44 Z', x: 220, y: 74 },
  'Kuala Selangor': { d: 'M16 62 L44 92 L112 84 L146 44 L150 112 L166 150 L132 176 L62 170 L20 132 Z', x: 88, y: 124 },
  'Gombak': { d: 'M150 112 L192 142 L252 150 L246 186 L206 196 L172 186 L166 150 Z', x: 207, y: 164 },
  'Klang': { d: 'M20 132 L62 170 L132 176 L142 206 L112 232 L46 226 L14 190 Z', x: 70, y: 196 },
  'Petaling': { d: 'M132 176 L166 150 L172 186 L186 216 L176 250 L140 256 L112 232 L142 206 Z', x: 150, y: 220 },
  'Hulu Langat': { d: 'M206 196 L246 186 L252 150 L304 122 L310 232 L266 276 L216 266 L186 236 L216 226 Z', x: 262, y: 208 },
  'Kuala Langat': { d: 'M14 190 L46 226 L112 232 L140 256 L150 300 L110 342 L40 332 L14 282 Z', x: 72, y: 280 },
  'Sepang': { d: 'M140 256 L176 250 L186 236 L216 266 L266 276 L250 322 L200 352 L150 346 L110 342 L150 300 Z', x: 190, y: 318 },
};
/* Kuala Lumpur and Putrajaya, counted on their own, drawn hatched */
const SG_ENCL = ['M172 186 L206 196 L216 226 L186 236 L186 216 Z', 'M186 280 L210 277 L215 297 L191 301 Z'];

type Place = { district: string; sales: number; median: number; under: number; years: number | null };

function DistrictMap({ places, isSelangor, stateName, sel, onPick }: {
  places: Place[]; isSelangor: boolean; stateName: string; sel: string | null; onPick: (n: string) => void;
}) {
  const { t } = useApp();
  const by: Record<string, Place> = {};
  places.forEach(p => { by[p.district] = p; });
  const shape = (nm: string, d: string) => {
    const p = by[nm];
    return (
      <Path key={nm} d={d} fill={p ? FH_SHADE[fhPb(p.median)] : '#EEF1F0'}
        stroke={sel === nm ? C.caution : '#FFFFFF'} strokeWidth={sel === nm ? 4.5 : 2} strokeLinejoin="round"
        onPress={p ? () => onPick(nm) : undefined}
        accessibilityLabel={nm} />
    );
  };
  const label = (p: Place | undefined, x: number, y: number, name: string) => {
    const dark = p ? fhPb(p.median) >= 2 : false;
    return (
      <SvgText key={`l-${name}-${x}-${y}`} x={x} y={y} textAnchor="middle" fill={dark ? '#FFFFFF' : '#2B3B3C'}
        fontSize={9} fontFamily={BODY_FONT}>
        <TSpan x={x} fontWeight="800">{name}</TSpan>
        <TSpan x={x} dy={11} fontWeight="600">{p ? `RM ${Math.round(p.median / 1000)}k` : t('fh_nodata')}</TSpan>
      </SvgText>
    );
  };
  let svg: React.ReactNode;
  let note: string;
  if (isSelangor) {
    const names = Object.keys(SG_MAP);
    svg = (
      <Svg viewBox="0 0 320 360" width="100%" style={{ aspectRatio: 320 / 360 }} accessibilityLabel={t('fh_map_a', { s: stateName })}>
        <Defs>
          <Pattern id="fhhatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={6} height={6} fill="#F2F5F4" />
            <Path d="M0 0v6" stroke="#C9D4D2" strokeWidth={2} />
          </Pattern>
        </Defs>
        {names.filter(nm => nm !== sel).map(nm => shape(nm, SG_MAP[nm].d))}
        {SG_ENCL.map((d, i) => <Path key={`e${i}`} d={d} fill="url(#fhhatch)" stroke="#FFFFFF" strokeWidth={1.5} />)}
        {sel && SG_MAP[sel] ? shape(sel, SG_MAP[sel].d) : null}
        {names.map(nm => label(by[nm], SG_MAP[nm].x, SG_MAP[nm].y, nm))}
        <SvgText x={196} y={217} textAnchor="middle" fill="#6B7C7D" fontSize={8.5} fontWeight="700">KL</SvgText>
      </Svg>
    );
    note = t('fh_map_note');
  } else {
    const names = places.map(p => p.district).sort((a, b) => a.localeCompare(b));
    const cols = 3, tw = 98, th = 56, gap = 8;
    const rows = Math.max(1, Math.ceil(names.length / cols));
    const W = cols * tw + (cols - 1) * gap, Hh = rows * th + (rows - 1) * gap;
    const tiles = names.map((nm, i) => {
      const x = (i % cols) * (tw + gap), y = Math.floor(i / cols) * (th + gap);
      return { nm, x, y, d: `M${x + 8} ${y} h${tw - 16} q8 0 8 8 v${th - 16} q0 8 -8 8 h-${tw - 16} q-8 0 -8 -8 v-${th - 16} q0 -8 8 -8 Z` };
    });
    svg = (
      <Svg viewBox={`0 0 ${W} ${Hh}`} width="100%" style={{ aspectRatio: W / Hh }} accessibilityLabel={t('fh_map_a', { s: stateName })}>
        {tiles.filter(x => x.nm !== sel).map(x => shape(x.nm, x.d))}
        {tiles.filter(x => x.nm === sel).map(x => shape(x.nm, x.d))}
        {tiles.map(x => {
          const short = x.nm.replace(/^Bahagian /, '');
          return label(by[x.nm], x.x + tw / 2, x.y + th / 2 - 2, short.length > 14 ? `${short.slice(0, 13)}.` : short);
        })}
      </Svg>
    );
    note = t('fh_tile_note');
  }
  return (
    <View style={st.map}>
      {svg}
      <View style={st.leg}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ width: '48%', flexDirection: 'row', alignItems: 'center' }}>
            <View style={[st.legSw, { backgroundColor: FH_SHADE[i] }]} />
            <Text style={{ fontFamily: BODY_FONT, fontSize: 12, color: C.ink }}>{t(`fh_pb${i + 1}`)}</Text>
          </View>
        ))}
      </View>
      <Text style={st.mnote}>{note}</Text>
    </View>
  );
}

/* the picked district: its band, middle price, sales, and where a tested price sits among them */
function PickCard({ p }: { p: Place | null }) {
  const { S, t } = useApp();
  if (!p) return <BodyS muted style={{ textAlign: 'center' }}>{t('fh_tap')}</BodyS>;
  const yrs = p.years ?? 0;
  const P = S.testRan && S.data.house.knownPayment == null ? +(S.data.house.price || 0) : 0;
  const k = P <= 300000 ? 'fh_mine_lo' : P < p.median ? 'fh_mine_mid' : 'fh_mine_hi';
  return (
    <View style={[st.listCard, { paddingVertical: 14, gap: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 19, lineHeight: 24, color: C.ink, flexShrink: 1 }}>{p.district}</Text>
        {p.years != null ? (
          <Text style={st.bd}>{t('fh_bandfor', { b: t(FH_BAND_KEYS[fhBand(yrs)][1]) })}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 15, color: C.ink }}>{t('fh_mid')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(p.median)}</Text>
          <Prov p="official" />
        </View>
      </View>
      <BodyS muted>
        {t('fh_sold', { n: nf(p.sales) })} {'\u00b7'} {t('fh_u300', { n: nf(p.under), k: 300 })}
        {p.years != null ? ` \u00b7 ${t('fh_yrs', { n: yrs.toFixed(1) })}` : ''}
      </BodyS>
      {p.sales < 10 ? <BodyS style={{ color: C.ink64 }}>{t('fh_few')}</BodyS> : null}
      {P > 0 ? (
        <View style={st.mine}>
          <BodyS>{t(k, { p: rm(P), m: rm(p.median), n: nf(p.sales), u: nf(p.under) })}</BodyS>
          <View style={{ marginTop: 4 }}><Prov p="calc" /></View>
          <BodyS muted style={{ fontSize: 11.5, lineHeight: 16, marginTop: 4 }}>{t('fh_mine_note')}</BodyS>
        </View>
      ) : null}
    </View>
  );
}

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
  /* v27b: the same places as a list or on a map */
  const [view, setView] = React.useState<'list' | 'map'>('list');
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => { setSel(null); }, [S.hcState, S.hcType]);

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
      <GuideTarget id="fh.sel">
      <Pressable onPress={() => setPick('state')} style={st.pickField}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pickLbl}>{t('fh_state_c')}</Text>
          <Text style={st.pickVal}>{stateData?.name ?? '—'}</Text>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      </GuideTarget>
      <Pressable onPress={() => setPick('type')} style={st.pickField}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.pickLbl}>{t('fh_type')}</Text>
          <Text style={st.pickVal}>{t('fh_t_' + S.hcType)}</Text>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      <GuideTarget id="fh.seg" style={st.seg}>
        {(['list', 'map'] as const).map(v => (
          <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }}
            style={[st.segBtn, view === v && st.segOn]}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 14, color: view === v ? C.ink : C.ink64 }}>{t(v === 'list' ? 'fh_v_list' : 'fh_v_map')}</Text>
          </Pressable>
        ))}
      </GuideTarget>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 18, color: C.ink }}>
        {t(view === 'map' ? 'fh_intro_map' : 'fh_intro', { s: stateData?.name ?? '—' })}
      </Text>
      {S.houseCostsSync === 'loading' || S.houseCostsSync === 'idle' ? (
        <View style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
          <ActivityIndicator color={C.brand} />
          <BodyS muted>{t('hc_loading')}</BodyS>
        </View>
      ) : S.houseCostsSync === 'error' ? (
        <BodyS muted style={{ textAlign: 'center', paddingVertical: 24 }}>{t('hc_error')}</BodyS>
      ) : view === 'map' ? (
        <>
          <GuideTarget id="fh.map">
            <DistrictMap places={rows} isSelangor={S.hcState === 'sgr'} stateName={stateData?.name ?? '—'}
              sel={sel} onPick={n => setSel(cur => (cur === n ? null : n))} />
          </GuideTarget>
          <PickCard p={rows.find(r => r.district === sel) ?? null} />
        </>
      ) : (
        <GuideTarget id="fh.place">
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[st.bar, { flex: 1 }]}>
                  {r.years != null ? (
                    <View style={{
                      width: `${Math.max(4, Math.min(100, Math.round(r.years / maxYears * 100)))}%`,
                      height: '100%', borderRadius: 4, backgroundColor: FH_BANDC[fhBand(r.years)],
                    }} />
                  ) : null}
                </View>
                {r.years != null ? (
                  <Text style={{
                    fontFamily: BODY_FONT, fontSize: 10.5, lineHeight: 14,
                    color: FH_BANDC[fhBand(r.years)], flexShrink: 0,
                  }} numberOfLines={1}>
                    {t(FH_BAND_KEYS[fhBand(r.years)][1])}
                  </Text>
                ) : null}
              </View>
              <Text style={st.rowSub}>
                {rm(r.median)} {'\u00b7'} {t('fh_sold', { n: r.sales.toLocaleString('en-MY') })} {'\u00b7'} {t('fh_u300', { n: r.under.toLocaleString('en-MY'), k: threshold })}
              </Text>
            </View>
          ))}
          {!rows.length ? <BodyS muted style={{ padding: 14 }}>{t('fh_none')}</BodyS> : null}
        </View>
        </GuideTarget>
      )}
      <View style={{ gap: 4 }}>
        <Prov p="official" />
        <BodyS muted style={{ fontSize: 11.5 }}>{t('hc_src_line')}</BodyS>
      </View>
      <BodyS muted style={{ fontSize: 11.5 }}>{t('hc_checked', { d: HC_LAST_CHECKED })}</BodyS>
      <GuideTarget id="fh.info">
      <Pressable onPress={() => setPick('info')} style={st.infoBtn}>
        <View style={st.infoIc}><Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text></View>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, flexShrink: 1 }}>{t('fh_i')}</Text>
      </Pressable>
      </GuideTarget>
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
  const { height } = useWindowDimensions();
  /* SheetFrame's maxHeight: '92%' does not resolve, because its parent is
     content-sized and percentages need a definite parent height. Bound the
     scroll area explicitly instead. The reserve covers the peek art above the
     sheet, the header row, the sheet padding and the safe-area inset. */
  const maxBody = Math.max(220, Math.round(height * 0.72) - 180);

  return (
    <SheetFrame pose="curious" onClose={onClose} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink, flexShrink: 1 }}>{t('fh_i')}</Text>
        <Pressable onPress={onClose} hitSlop={10}><Text style={{ fontSize: 18, color: C.ink }}>✕</Text></Pressable>
      </View>
      <ScrollView
        style={{ marginTop: 8, maxHeight: maxBody, flexShrink: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        showsVerticalScrollIndicator
      >
        <BodyS>{t('fh_not')}</BodyS>
        <BodyS>{t('fh_earn', { s: stateName, m: income.toLocaleString('en-MY') })}</BodyS>
        <BodyS>{t('fh_basis')}</BodyS>
        {['fh_i1', 'fh_i7', 'fh_i2'].map(k => <BodyS key={k}>{t(k)}</BodyS>)}
        <BodyS>{t('fh_i8')}</BodyS>
        {['fh_i5', 'fh_i6'].map(k => <BodyS key={k}>{t(k)}</BodyS>)}
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
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3, gap: 3, borderWidth: 1, borderColor: C.ink14 },
  segBtn: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: {
    backgroundColor: '#FFFFFF', shadowColor: 'rgba(0,0,0,1)', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  map: { backgroundColor: '#F2F8F7', borderRadius: 18, borderWidth: 1, borderColor: C.ink14, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 8 },
  leg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6, marginTop: 8 },
  legSw: { width: 16, height: 11, borderRadius: 3, marginRight: 6, borderWidth: 1, borderColor: 'rgba(60,81,82,0.15)' },
  mnote: { fontFamily: BODY_FONT, fontSize: 11, lineHeight: 15, color: C.ink64, marginTop: 6 },
  bd: {
    fontFamily: DISP_FONT, fontSize: 11.5, backgroundColor: C.card, borderWidth: 1, borderColor: C.ink14,
    borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, maxWidth: '58%', textAlign: 'right', color: C.ink, overflow: 'hidden',
  },
  mine: { backgroundColor: '#F4FAF9', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A6D3D4' },
  infoIc: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink40,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleCard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8, gap: 2,
  },
});
