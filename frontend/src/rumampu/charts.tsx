import React from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, CHART_COLS, DISP_FONT } from './theme';
import { Prov } from './ui';
import { rm } from './calc';
import { formatApiMoney } from './money';
import type { ApiIncomePatternMonth } from './api';

/* Chart pieces — mirror the prototype's .wl (waterline), .cov, donut, .hbar and .band CSS. */

export interface WlRow { m: number; surplus: number; short: boolean; gap: number }

function IncomeBar({
  row, plotHeight, zeroTop, range, label,
}: {
  row: ApiIncomePatternMonth;
  plotHeight: number;
  zeroTop: number;
  range: number;
  label: string;
}) {
  const reveal = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal]);
  const value = Number(row.usable_income);
  const amount = formatApiMoney(row.usable_income);
  const height = Math.max(2, Math.abs(value) / range * plotHeight);
  const top = value >= 0 ? zeroTop - height : zeroTop;
  return (
    <View
      style={ip.col}
      accessibilityLabel={`${label}: ${amount} calculated usable income${row.is_lowest_recorded ? ', lowest recorded month' : ''}`}
    >
      <View style={[ip.plotCol, { height: plotHeight }]}>
        <Animated.View
          testID={`income-bar-${row.month}`}
          style={[
            ip.bar,
            {
              top,
              height,
              backgroundColor: row.is_lowest_recorded ? C.brand : C.ink,
              opacity: reveal,
              transform: [{ scaleY: reveal }],
            },
          ]}
        />
      </View>
      <Text style={ip.amount}>{amount}</Text>
      <Text style={ip.label}>{label}</Text>
    </View>
  );
}

/**
 * EN: US2.1 visualises server-calculated usable income; bar height preserves zero and negative values.
 * 中文：US2.1 可视化服务端计算的可用收入；柱高保留零值和负值差异。
 */
export function IncomePatternChart({
  months, monthName, accessibilityLabel,
}: {
  months: ApiIncomePatternMonth[];
  monthName: (month: number) => string;
  accessibilityLabel: string;
}) {
  const values = months.map(row => Number(row.usable_income));
  const maximum = Math.max(0, ...values);
  const minimum = Math.min(0, ...values);
  const rawRange = maximum - minimum;
  const range = Math.max(0.01, rawRange);
  const plotHeight = 164;
  const zeroTop = rawRange === 0 ? plotHeight : maximum / range * plotHeight;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={ip.scroll}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[ip.chart, { minWidth: Math.max(320, months.length * 94) }]}>
        <View style={[ip.zero, { top: zeroTop }]} />
        <View style={ip.columns}>
          {months.map(row => {
            const month = Number(row.month.slice(5, 7)) - 1;
            const year = row.month.slice(2, 4);
            return (
              <IncomeBar
                key={row.month}
                row={row}
                plotHeight={plotHeight}
                zeroTop={zeroTop}
                range={range}
                label={`${monthName(month)} ${year}`}
              />
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

export function Waterline({
  rows, cost, small, lineLabel, prov, noLabels, monthName, xGap,
}: {
  rows: WlRow[]; cost: number; small?: boolean; lineLabel?: boolean; prov?: string;
  noLabels?: boolean; monthName: (m: number) => string; xGap?: number;
}) {
  const max = Math.max(cost, ...rows.map(r => r.surplus), 1) * 1.12;
  const pct = (v: number) => Math.max(0, v / max * 100);
  const plotH = small ? 96 : 170;
  const gap = xGap ?? (small ? 3 : 8);
  const linePct = pct(cost);
  return (
    <View style={small ? wl.wrapSmall : wl.wrap}>
      <View style={[wl.plot, { height: plotH, gap }]}>
        {rows.map((r, i) => {
          const h = pct(r.surplus);
          return (
            <View key={i} style={[wl.col, { minWidth: small ? 6 : 14 }]}>
              <View style={[wl.bar, { height: `${h}%` }]} />
              {r.short && r.gap > 0 ? (
                <View style={[wl.gap, { bottom: `${h}%`, height: `${linePct - h}%` }]} />
              ) : null}
            </View>
          );
        })}
        <View style={[wl.line, { bottom: `${linePct}%`, right: small ? -4 : -14 }]}>
          {!small ? <View style={wl.arrow} /> : null}
        </View>
        {lineLabel ? (
          <View style={[wl.lineLbl, { bottom: `${linePct}%` }]}>
            <Text style={wl.lineLblTxt}>{rm(cost)}</Text>
          </View>
        ) : null}
      </View>
      {!noLabels ? (
        <View style={[wl.xrow, { gap }]}>
          {rows.map((r, i) => (
            <Text key={i} style={[wl.xlbl, { minWidth: small ? 6 : 14 }]}>{monthName(r.m).toUpperCase()}</Text>
          ))}
        </View>
      ) : null}
      {prov ? <View style={{ marginTop: 2, alignItems: 'flex-start' }}><Prov p={prov} /></View> : null}
    </View>
  );
}

export function CovStrip({
  months, monthName, unknownLabel,
}: {
  months: Map<number, { net: number }>; monthName: (m: number) => string; unknownLabel: string;
}) {
  const maxNet = Math.max(...[...months.values()].map(r => r.net), 1);
  const cells = [];
  for (let m = 0; m < 12; m++) {
    const rec = months.get(m);
    if (rec) {
      cells.push(
        <View key={m} style={[cov.cell, { height: Math.max(18, rec.net / maxNet * 44), backgroundColor: C.ink }]} />
      );
    } else {
      cells.push(<View key={m} style={[cov.cell, cov.unk]} accessibilityLabel={`${monthName(m)}: ${unknownLabel}`} />);
    }
  }
  return <View style={cov.wrap}>{cells}</View>;
}

export interface Slice { label: string; v: number }

export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const total = slices.reduce((a, x) => a + x.v, 0) || 1;
  let acc = 0;
  const segs = slices.map((sl, i) => {
    const pct = sl.v / total * 100;
    const seg = (
      <Circle
        key={i}
        r={15.9155} cx={21} cy={21} fill="none"
        stroke={CHART_COLS[i % CHART_COLS.length]} strokeWidth={8}
        strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={25 - acc}
      />
    );
    acc += pct;
    return seg;
  });
  return (
    <View style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center' }}>
      <Svg viewBox="0 0 42 42" width={104} height={104}>{segs}</Svg>
      <Text style={{
        position: 'absolute', fontFamily: DISP_FONT, fontSize: 13, color: C.ink, fontVariant: ['tabular-nums'],
      }}>{centerLabel}</Text>
    </View>
  );
}

export function DonutLegend({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((a, x) => a + x.v, 0) || 1;
  return (
    <View>
      {slices.map((sl, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: CHART_COLS[i % CHART_COLS.length] }} />
            <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: C.ink, flexShrink: 1 }}>{sl.label}</Text>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink, fontFamily: DISP_FONT, fontVariant: ['tabular-nums'] }}>
            {Math.round(sl.v / total * 100)}% · {rm(sl.v)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* Horizontal limit bar with an over-limit segment and a tick at the limit. */
export function HBar({ spend, lim }: { spend: number; lim: number }) {
  const scale = Math.max(spend, lim) * 1.06;
  const sp = spend / scale * 100, lp = lim / scale * 100;
  const over = spend > lim;
  return (
    <View style={hb.track}>
      <View style={[hb.fill, { width: `${Math.min(sp, lp)}%` }]} />
      {over ? <View style={[hb.over, { left: `${lp}%`, width: `${sp - lp}%` }]} /> : null}
      <View style={[hb.tick, { left: `${lp}%` }]} />
    </View>
  );
}

/* Range band with a pin marker (▲ your test). */
export function Band({
  loPct, hiPct, pinPct, pinTop, pinBottom, prov,
}: { loPct: number; hiPct: number; pinPct: number; pinTop: string; pinBottom: string; prov?: string }) {
  return (
    <View style={{ height: 64, marginTop: 8, marginBottom: 4 }}>
      {prov ? <View style={{ position: 'absolute', right: 0, top: -6, zIndex: 2 }}><Prov p={prov} /></View> : null}
      <View style={bd.track} />
      <View style={[bd.fill, { left: `${loPct}%`, width: `${hiPct - loPct}%` }]} />
      <View style={[bd.pin, { left: `${pinPct}%` }]}>
        <Text style={bd.pinTxt}>▲</Text>
        <Text style={bd.pinTxt} numberOfLines={1}>{pinTop}</Text>
        <Text style={bd.pinTxt} numberOfLines={1}>{pinBottom}</Text>
      </View>
    </View>
  );
}

/* Loading shimmer used by the receipt-scan preview. */
export function Shimmer({ label }: { label: string }) {
  const x = React.useRef(new Animated.Value(-1)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const [w, setW] = React.useState(0);
  return (
    <View
      accessibilityLabel={label}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={{ height: 130, borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, width: w * 0.5,
          backgroundColor: '#fff', opacity: 0.55,
          transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-w * 0.5, w] }) }],
        }}
      />
    </View>
  );
}

const wl = StyleSheet.create({
  wrap: { paddingTop: 10, paddingRight: 34, paddingBottom: 26, paddingLeft: 2, marginRight: -20 },
  wrapSmall: { paddingTop: 8, paddingRight: 6, paddingBottom: 4, paddingLeft: 2 },
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: C.ink, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  gap: { position: 'absolute', left: '15%', width: '70%', backgroundColor: C.short, borderRadius: 2, opacity: 0.95 },
  line: { position: 'absolute', left: -2, borderTopWidth: 2.5, borderTopColor: C.ink },
  arrow: {
    position: 'absolute', right: -1, top: -7,
    borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 7,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: C.ink,
    width: 0, height: 0,
  },
  lineLbl: {
    position: 'absolute', right: 0,
    transform: [{ translateY: -21 }],
    backgroundColor: C.paper, paddingVertical: 2, paddingHorizontal: 5,
    borderRadius: 5, borderWidth: 1.5, borderColor: C.ink14,
  },
  lineLblTxt: { fontSize: 11, letterSpacing: 0.66, color: C.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  xrow: { flexDirection: 'row', paddingTop: 6 },
  xlbl: { flex: 1, textAlign: 'center', fontSize: 11, letterSpacing: 0.44, color: C.ink64 },
});

const ip = StyleSheet.create({
  scroll: { paddingBottom: 4 },
  chart: { height: 226, position: 'relative' },
  zero: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderTopColor: C.ink40 },
  columns: { flexDirection: 'row', height: 226, gap: 8 },
  col: { width: 86, alignItems: 'center' },
  plotCol: { width: 30, position: 'relative' },
  bar: { position: 'absolute', left: 2, right: 2, borderRadius: 3 },
  amount: { marginTop: 6, fontSize: 10, lineHeight: 14, color: C.ink, textAlign: 'center', fontVariant: ['tabular-nums'] },
  label: { marginTop: 1, fontSize: 10, lineHeight: 14, color: C.ink64, textAlign: 'center' },
});

const cov = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 5, alignItems: 'flex-end', height: 44 },
  cell: { flex: 1, borderRadius: 2 },
  unk: { height: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.caution, backgroundColor: 'transparent' },
});

const hb = StyleSheet.create({
  track: { height: 12, borderRadius: 6, backgroundColor: C.ink14, marginTop: 6, marginBottom: 2 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, backgroundColor: C.ink },
  over: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.short, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  tick: { position: 'absolute', top: -4, bottom: -4, width: 2.5, backgroundColor: C.ink },
});

const bd = StyleSheet.create({
  track: { position: 'absolute', left: 0, right: 0, top: 18, height: 12, borderRadius: 6, backgroundColor: C.ink14 },
  fill: { position: 'absolute', top: 18, height: 12, borderRadius: 6, backgroundColor: C.ink },
  pin: { position: 'absolute', top: 32, width: 120, marginLeft: -60, alignItems: 'center' },
  pinTxt: { fontSize: 12, lineHeight: 16, color: C.ink },
});
