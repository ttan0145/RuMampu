import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { useApp } from '../state';
import { nf, rm } from '../calc';
import { HouseCostType } from '../../../types/housing';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { BodyS, Prov } from '../ui';
import { Ico } from '../svgs';
import { GuideTarget } from '../tour';
import { PX_MAP } from '../pxmap';
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
/* the same scale as soft pills: tint behind, a darker shade of the band colour in front */
const FH_PILL_BG = ['#E3F5E6', '#FFF3D1', '#FDE4DA', '#E4E8E8'];
const FH_PILL_FG = ['#1F7A33', '#8A6200', '#B5401E', C.ink];

/* ---- v27b the district map (Epic 11). Each district is shaded by its middle
   sale price, in one hue, with every shade named in words. Selangor, Kuala Lumpur
   and Putrajaya are drawn from the DOSM district outlines (shared with the Price
   Explorer); other states show their districts as tiles from A to Z. A tested
   price becomes a count statement from the published figures, never a colour
   or a verdict on the person (D59). */
/* a light-green to deep-blue scale: each step easy to tell apart, text readable on all four */
const FH_SHADE = ['#E0F3DB', '#A8DDB5', '#2B8CBE', '#08589E'];
function fhPb(med: number): number { return med < 300000 ? 0 : med < 400000 ? 1 : med < 500000 ? 2 : 3; }
/* the states the outline map covers */
const FH_OUTLINE_STATES = ['sgr', 'kul', 'pjy'];
const SHORT: Record<string, string> = { 'Kuala Lumpur': 'KL', Putrajaya: "P'jaya" };

type Place = { district: string; sales: number; median: number; under: number; years: number | null };

function DistrictMap({ places, outline, stateName, sel, onPick }: {
  places: Place[]; outline: boolean; stateName: string; sel: string | null; onPick: (n: string) => void;
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
  if (outline) {
    /* every outlined district is drawn; those in another state are hatched and not tappable */
    const names = Object.keys(PX_MAP);
    const order = [...names.filter(nm => nm !== sel), ...names.filter(nm => nm === sel)];
    const label = (nm: string, p: Place | undefined) => {
      const m = PX_MAP[nm], small = !!SHORT[nm], dark = p ? fhPb(p.median) >= 2 : false;
      return (
        <SvgText key={`l-${nm}`} x={m.x} y={m.y} textAnchor="middle" pointerEvents="none"
          fill={p ? (dark ? '#FFFFFF' : '#1F2D2E') : '#6B7C7D'} fontSize={small ? 7 : 8} fontFamily={SEMI_FONT}>
          <TSpan x={m.x}>{SHORT[nm] ?? nm}</TSpan>
          {p ? <TSpan x={m.x} dy={10} fontFamily={DISP_FONT}>{`RM ${Math.round(p.median / 1000)}k`}</TSpan> : null}
        </SvgText>
      );
    };
    svg = (
      <Svg viewBox="0 0 300 330" width="100%" style={{ aspectRatio: 300 / 330 }} accessibilityLabel={t('fh_map_a', { s: stateName })}>
        <Defs>
          <Pattern id="fhhatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={6} height={6} fill="#F2F5F4" />
            <Path d="M0 0v6" stroke="#C9D4D2" strokeWidth={2} />
          </Pattern>
        </Defs>
        {order.map(nm => {
          const p = by[nm];
          return (
            <Path key={nm} d={PX_MAP[nm].d} fill={p ? FH_SHADE[fhPb(p.median)] : 'url(#fhhatch)'}
              stroke={sel === nm ? C.caution : '#FFFFFF'} strokeWidth={sel === nm ? 4 : 1.6} strokeLinejoin="round"
              onPress={p ? () => onPick(nm) : undefined} accessibilityLabel={nm} />
          );
        })}
        {/* labels for this state's districts, and short names for the enclosed territories */}
        {names.filter(nm => by[nm] || SHORT[nm]).map(nm => label(nm, by[nm]))}
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

type SortKey = 'aff' | 'lo' | 'hi' | 'sales';
const SORTS: SortKey[] = ['aff', 'lo', 'hi', 'sales'];
const QMON = ['Jan', 'Apr', 'Jul', 'Oct'], QEND = ['Mar', 'Jun', 'Sep', 'Dec'];
const qFrom = (q: string) => `${QMON[Number(q.slice(5)) - 1] ?? ''} ${q.slice(0, 4)}`;
const qTo = (q: string) => `${QEND[Number(q.slice(5)) - 1] ?? ''} ${q.slice(0, 4)}`;

/* A filter chip in the bar under the title: what is chosen, and a caret to change it. */
function FilterChip({ label, value, onPress, testID }: { label: string; value: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={st.fchip} testID={testID}>
      <Text style={st.fchipT} numberOfLines={1}>{value}</Text>
      <Text style={{ color: C.ink64, fontSize: 11 }}>▾</Text>
    </Pressable>
  );
}

type Row = { district: string; state: string; sales: number; median: number; under: number; years: number | null };

/* One result: the place, its typical price as the headline, and the facts beside it. */
function ResultCard({ r, showState, threshold, t }: {
  r: Row; showState: boolean; threshold: number; t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const band = r.years != null ? fhBand(r.years) : null;
  return (
    <View style={st.card} testID={`fh-card-${r.district}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.cardName} numberOfLines={1}>{r.district}</Text>
          {showState ? <Text style={st.cardState}>{r.state}</Text> : null}
        </View>
        {band != null ? (
          <View style={[st.pill, { backgroundColor: FH_PILL_BG[band] }]}>
            <Text style={[st.pillT, { color: FH_PILL_FG[band] }]} numberOfLines={1}>{t(FH_BAND_KEYS[band][1])}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <Text style={st.cardPrice}>{rm(r.median)}</Text>
        <Text style={st.cardPriceK}>{t('fh_typ')}</Text>
      </View>
      <View style={st.metaRow}>
        {r.years != null ? <Text style={st.metaStrong}>{t('fh_yrs', { n: r.years.toFixed(1) })}</Text> : null}
        <Text style={st.meta}>{t('fh_sold', { n: nf(r.sales) })}</Text>
        <Text style={st.meta}>{t('fh_u300', { n: nf(r.under), k: threshold })}</Text>
        {r.sales < 10 ? <Text style={[st.meta, { color: C.outDeep }]}>{t('fh_few')}</Text> : null}
      </View>
    </View>
  );
}

export function HomeCostsScreen() {
  const { S, t, up, go, loadHouseCosts } = useApp();
  const [pick, setPick] = React.useState<'state' | 'type' | 'sort' | 'info' | null>(null);
  /* v27b: the same places as a list or on a map */
  const [view, setView] = React.useState<'list' | 'map'>('list');
  const [sel, setSel] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState<SortKey>('aff');
  React.useEffect(() => { setSel(null); }, [S.hcState, S.hcType]);

  React.useEffect(() => { void loadHouseCosts(); }, [loadHouseCosts]);

  const data = S.houseCosts;
  const stateData = data?.states[S.hcState];
  const threshold = data ? Math.round(data.affordable_threshold / 1000) : 300;
  const query = q.trim().toLowerCase();

  /* the chosen state, or every state when searching by name */
  const rows = React.useMemo(() => {
    const out: Row[] = [];
    Object.entries(data?.states ?? {}).forEach(([key, st0]) => {
      if (!query && key !== S.hcState) return;
      const income = st0.income;
      Object.entries(st0.types?.[S.hcType] ?? {}).forEach(([district, [sales, median, under]]) => {
        if (query && !district.toLowerCase().includes(query) && !st0.name.toLowerCase().includes(query)) return;
        out.push({ district, state: st0.name, sales, median, under, years: income ? median / (income * 12) : null });
      });
    });
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      aff: (a, b) => (a.years ?? 1e9) - (b.years ?? 1e9),
      lo: (a, b) => a.median - b.median,
      hi: (a, b) => b.median - a.median,
      sales: (a, b) => b.sales - a.sales,
    };
    return out.sort(by[sort]);
  }, [data, S.hcState, S.hcType, query, sort]);
  const mapRows = React.useMemo(() => {
    const income = stateData?.income ?? null;
    return Object.entries(stateData?.types?.[S.hcType] ?? {}).map(([district, [sales, median, under]]) => ({
      district, sales, median, under, years: income ? median / (income * 12) : null,
    }));
  }, [stateData, S.hcType]);

  const stateOptions = Object.entries(data?.states ?? {})
    .map(([key, st0]) => ({ key, label: st0.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const typeOptions = TYPE_KEYS.map(k => ({ key: k, label: t('fh_t_' + k) }));
  const sortOptions = SORTS.map(k => ({ key: k, label: t('fh_sort_' + k) }));
  const loading = S.houseCostsSync === 'loading' || S.houseCostsSync === 'idle';

  return (
    <ScreenShell back title={t('fh_title')}
      under={( /* search and filters stay put while the results scroll */
        <View style={st.topbar}>
          <View style={st.search}>
            <Ico name="search" size={18} color={C.ink64} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('fh_search_ph')} placeholderTextColor={C.ink40}
              style={st.searchIn} returnKeyType="search" accessibilityLabel={t('fh_search_ph')} testID="fh-search" />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('fh_clear')}>
                <Text style={{ fontSize: 15, color: C.ink64 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <GuideTarget id="fh.sel">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              <FilterChip label={t('fh_state_c')} value={stateData?.name ?? t('fh_state_c')} onPress={() => setPick('state')} testID="fh-state" />
              <FilterChip label={t('fh_type')} value={t('fh_t_' + S.hcType)} onPress={() => setPick('type')} testID="fh-type" />
              <FilterChip label={t('fh_sort')} value={t('fh_sort_' + sort)} onPress={() => setPick('sort')} testID="fh-sort" />
            </ScrollView>
          </GuideTarget>
        </View>
      )}>
      {/* a way from looking around to a price that fits */}
      <Pressable onPress={() => go('priceexplorer')} accessibilityRole="button" style={st.promo} testID="fh-px">
        <View style={st.promoIc}><Ico name="house" size={20} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.promoT}>{t('px_open')}</Text>
          <Text style={st.promoD}>{t('fh_px_d')}</Text>
        </View>
        <Text style={{ fontSize: 20, color: C.brand }}>›</Text>
      </Pressable>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={st.count}>
              {loading ? ' ' : query
                ? t(rows.length === 1 ? 'fh_count_q1' : 'fh_count_q', { n: rows.length, q: q.trim() })
                : t(rows.length === 1 ? 'fh_count1' : 'fh_count', { n: rows.length, s: stateData?.name ?? '' })}
            </Text>
            {data ? <Text style={st.window}>{t('fh_window', { a: qFrom(data.window.from), b: qTo(data.window.to) })}</Text> : null}
          </View>
          <GuideTarget id="fh.seg" style={st.segC}>
            {(['list', 'map'] as const).map(v => (
              <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }}
                style={[st.segBtnC, view === v && st.segOn]}>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: view === v ? C.ink : C.ink64 }}>{t(v === 'list' ? 'fh_v_list' : 'fh_v_map')}</Text>
              </Pressable>
            ))}
          </GuideTarget>
        </View>
        <Text style={st.window}>{t(view === 'map' ? 'fh_intro_map' : 'fh_intro', { s: stateData?.name ?? '' })}</Text>
      </View>

      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 30, gap: 10 }}>
          <ActivityIndicator color={C.brand} />
          <BodyS muted>{t('hc_loading')}</BodyS>
        </View>
      ) : S.houseCostsSync === 'error' ? (
        <BodyS muted style={{ textAlign: 'center', paddingVertical: 24 }}>{t('hc_error')}</BodyS>
      ) : view === 'map' ? (
        <>
          <GuideTarget id="fh.map">
            <DistrictMap places={mapRows} outline={FH_OUTLINE_STATES.includes(S.hcState)} stateName={stateData?.name ?? ''}
              sel={sel} onPick={n => setSel(cur => (cur === n ? null : n))} />
          </GuideTarget>
          <PickCard p={mapRows.find(r => r.district === sel) ?? null} />
        </>
      ) : (
        <GuideTarget id="fh.place">
          <View style={{ gap: 10 }}>
            {rows.map(r => <ResultCard key={`${r.state}-${r.district}`} r={r} showState={!!query} threshold={threshold} t={t} />)}
            {!rows.length ? (
              <BodyS muted style={{ padding: 14, textAlign: 'center' }}>{query ? t('fh_noresults', { q: q.trim() }) : t('fh_none')}</BodyS>
            ) : null}
          </View>
        </GuideTarget>
      )}

      <View style={st.foot}>
        <View style={{ gap: 4 }}>
          <Prov p="official" />
          <BodyS muted style={{ fontSize: 11.5 }}>{t('hc_src_line')}</BodyS>
          <BodyS muted style={{ fontSize: 11.5 }}>{t('hc_checked', { d: HC_LAST_CHECKED })}</BodyS>
        </View>
        <GuideTarget id="fh.info">
          <Pressable onPress={() => setPick('info')} style={st.infoBtn}>
            <View style={st.infoIc}><Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text></View>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, flexShrink: 1 }}>{t('fh_i')}</Text>
          </Pressable>
        </GuideTarget>
      </View>
      {pick === 'state' ? (
        <PickSheet title={t('fh_state_c')} options={stateOptions} value={S.hcState}
          onPick={key => { setQ(''); up(s => { s.hcState = key; }); }} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'type' ? (
        <PickSheet title={t('fh_type')} options={typeOptions} value={S.hcType}
          onPick={key => up(s => { s.hcType = key as HouseCostType; })} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'sort' ? (
        <PickSheet title={t('fh_sort')} options={sortOptions} value={sort}
          onPick={key => setSort(key as SortKey)} onClose={() => setPick(null)} />
      ) : null}
      {pick === 'info' ? (
        <InfoSheet t={t} stateName={stateData?.name ?? ''} income={stateData?.income ?? 0} onClose={() => setPick(null)} />
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
  topbar: { paddingHorizontal: 20, paddingBottom: 10, gap: 10, backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.ink14 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F4F4', borderRadius: 12,
    paddingHorizontal: 12, minHeight: 44,
  },
  searchIn: { flex: 1, minWidth: 0, fontFamily: BODY_FONT, fontSize: 15, color: C.ink, paddingVertical: 10 },
  fchip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.ink14, backgroundColor: '#fff',
    borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, minHeight: 36,
  },
  fchipT: { fontFamily: DISP_FONT, fontSize: 13, color: C.ink, maxWidth: 190 },
  promo: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EAF4F4', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 14,
  },
  promoIc: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  promoT: { fontFamily: DISP_FONT, fontSize: 15, color: C.ink },
  promoD: { fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64, marginTop: 1 },
  count: { fontFamily: DISP_FONT, fontSize: 15, color: C.ink },
  window: { fontFamily: BODY_FONT, fontSize: 12, lineHeight: 17, color: C.ink64 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.ink14, paddingVertical: 14, paddingHorizontal: 14,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardName: { fontFamily: DISP_FONT, fontSize: 16, color: C.ink },
  cardState: { fontFamily: BODY_FONT, fontSize: 12, color: C.ink64, marginTop: 1 },
  cardPrice: { fontFamily: XBOLD_FONT, fontSize: 21, color: C.ink, fontVariant: ['tabular-nums'] },
  cardPriceK: { fontFamily: BODY_FONT, fontSize: 12, color: C.ink64 },
  pill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, maxWidth: '55%' },
  pillT: { fontFamily: DISP_FONT, fontSize: 11.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 6 },
  meta: { fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64 },
  metaStrong: { fontFamily: DISP_FONT, fontSize: 12.5, color: C.ink },
  foot: { gap: 10, paddingTop: 4 },
  segC: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, padding: 3, gap: 3, borderWidth: 1, borderColor: C.ink14 },
  segBtnC: { minHeight: 32, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listCard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, paddingHorizontal: 12, borderRadius: 12,
  },
  infoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
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
