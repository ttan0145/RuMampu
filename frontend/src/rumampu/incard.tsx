import React from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT } from './theme';
import { EntryPer } from './state';

/* v22 entry-card anatomy (.incard family) shared by the income and expense
   screens: white rounded card, segmented type/scan/csv switcher, big centred
   amount hero, day/week/month segment, chips, recent-entry rows. The warm
   `out` variant recolours everything for expenses. */

export const IN_TINTS = {
  in: { hero: ['#DCEFEF', '#C9E2E0'], segOn: C.ink, chipOn: C.brand, perOn: C.ink, btn: C.brand, pill: 'rgba(74,145,149,0.18)', pillTxt: '#2E6B6F', ib: '#E4EFEC', ibTxt: '#3F7A7E' },
  out: { hero: ['#FBE6DA', '#F5CDB8'], segOn: '#B54F2B', chipOn: '#D9663D', perOn: '#B54F2B', btn: '#D9663D', pill: 'rgba(217,102,61,0.16)', pillTxt: '#B54F2B', ib: '#FBE6DA', ibTxt: '#B54F2B' },
} as const;

export type InTint = keyof typeof IN_TINTS;

export function InCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.incard, style]}>{children}</View>;
}

export function InSec({ children, last, style }: { children: React.ReactNode; last?: boolean; style?: ViewStyle }) {
  return <View style={[{ paddingHorizontal: 14, paddingTop: 14 }, last && { paddingBottom: 14 }, style]}>{children}</View>;
}

export function InLbl({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink, marginBottom: 8 }}>{children}</Text>;
}

const SEG_ICO: Record<string, string> = {
  type: '<path d="M4 20h4l10-10-4-4L4 16z"/>',
  scan: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  csv: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/>',
};

function segIcoXml(mode: string, color: string): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${SEG_ICO[mode] || SEG_ICO.type}</svg>`;
}

/* .inseg — the type / scan / csv method switcher. */
export function InSeg({ mode, labels, onMode, tint = 'in' }: {
  mode: string;
  labels: [string, string][];
  onMode: (m: string) => void;
  tint?: InTint;
}) {
  const tints = IN_TINTS[tint];
  return (
    <View style={st.inseg}>
      {labels.map(([m, label]) => {
        const on = mode === m;
        return (
          <Pressable key={m} onPress={() => onMode(m)} style={[st.insegBtn, on && st.insegBtnOn]}>
            <SvgXml xml={segIcoXml(m, on ? tints.segOn : 'rgba(60,81,82,0.64)')} width={16} height={16} />
            <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: on ? tints.segOn : C.ink64 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* .iopill — the small ↑ IN / ↓ OUT identity pill. */
export function IoPill({ tint, label }: { tint: InTint; label: string }) {
  const tints = IN_TINTS[tint];
  return (
    <View style={{ alignSelf: 'center', backgroundColor: tints.pill, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, marginBottom: 6 }}>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.66, color: tints.pillTxt }}>
        {tint === 'in' ? '↑ ' : '↓ '}{label.toUpperCase()}
      </Text>
    </View>
  );
}

/* .inhero — pastel hero with the question line and the big centred RM input. */
export function InHero({ tint, pillLabel, question, value, onChangeText, decimal }: {
  tint: InTint;
  pillLabel: string;
  question: string;
  value: string;
  onChangeText: (v: string) => void;
  decimal?: boolean;
}) {
  const tints = IN_TINTS[tint];
  return (
    <View style={{ backgroundColor: tints.hero[1], paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, marginTop: 14 }}>
      <IoPill tint={tint} label={pillLabel} />
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13, color: C.ink64, textAlign: 'center' }}>{question}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 4 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 22, color: C.ink64 }}>RM</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          inputMode={decimal ? 'decimal' : 'numeric'}
          placeholder="0"
          placeholderTextColor="rgba(60,81,82,0.3)"
          style={{
            minWidth: 90, maxWidth: 200, textAlign: 'center', color: C.ink,
            fontFamily: DISP_FONT, fontSize: 40, lineHeight: 46, padding: 0,
          }}
        />
      </View>
    </View>
  );
}

/* .inper.lite — the day / week / month segment. */
export function PerSeg({ per, onPer, labels, tint = 'in' }: {
  per: EntryPer;
  onPer: (p: EntryPer) => void;
  labels: (p: EntryPer) => string;
  tint?: InTint;
}) {
  const tints = IN_TINTS[tint];
  return (
    <View style={st.inperLite}>
      {(['day', 'week', 'month'] as EntryPer[]).map(p => {
        const on = per === p;
        return (
          <Pressable key={p} onPress={() => onPer(p)}
            style={[st.inperBtn, { flex: 1 }, on && { backgroundColor: tints.perOn }]}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 12.5, color: on ? '#fff' : C.ink64 }}>{labels(p)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* .inday — one day cell on the WHEN strip (also the month-of / pick cells). */
export function InDay({ label, value, on, onPress, style }: {
  label: string; value: string; on?: boolean; onPress: () => void; style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} style={[st.inday, on && st.indayOn, style]}>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 14, color: on ? 'rgba(255,255,255,0.75)' : C.ink64 }}>{label}</Text>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 14, color: on ? '#fff' : C.ink, marginTop: 2 }}>{value}</Text>
    </Pressable>
  );
}

/* .inchip — icon chip for sources / categories. */
export function InChip({ icon, label, on, dashed, onPress, tint = 'in' }: {
  icon?: React.ReactNode; label: string; on?: boolean; dashed?: boolean; onPress: () => void; tint?: InTint;
}) {
  const tints = IN_TINTS[tint];
  return (
    <Pressable onPress={onPress} style={[
      st.inchip,
      on && { backgroundColor: tints.chipOn, borderColor: tints.chipOn },
      dashed && { borderStyle: 'dashed' },
    ]}>
      {icon}
      <Text style={{ fontFamily: dashed ? BODY_FONT : SEMI_FONT, fontSize: 13.5, color: on ? '#fff' : dashed ? C.ink64 : C.ink }}>{label}</Text>
    </Pressable>
  );
}

/* .inrow — one recent-entry row. */
export function InRow({ icon, title, sub, subTag, amount, onEdit, tint = 'in', first }: {
  icon: React.ReactNode; title: string; sub: string; subTag?: string; amount: string;
  onEdit?: () => void; tint?: InTint; first?: boolean;
}) {
  const tints = IN_TINTS[tint];
  return (
    <View style={[st.inrow, !first && { borderTopWidth: 1, borderTopColor: C.ink14 }]}>
      <View style={[st.inrowIb, { backgroundColor: tints.ib }]}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 15, color: C.ink }} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 15, color: C.ink64 }} numberOfLines={1}>{sub}</Text>
          {subTag ? <PTag label={subTag} /> : null}
        </View>
      </View>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink, fontVariant: ['tabular-nums'] }}>{amount}</Text>
      {onEdit ? (
        <Pressable onPress={onEdit} style={st.ieb} accessibilityLabel="edit">
          <SvgXml xml={'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="rgba(60,81,82,0.64)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12.5 7.5l4 4"/></svg>'} width={17} height={17} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* .ptag — the tiny SCAN / CSV provenance tag on a row. */
export function PTag({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: '#E4EFEC', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 10, letterSpacing: 0.4, color: '#3F7A7E' }}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* .drop — the dashed pick-a-file / take-a-photo target. */
export function Drop({ icon, title, hint, badge, onPress, tint = 'in' }: {
  icon: 'scan' | 'csv'; title: string; hint: string; badge?: React.ReactNode; onPress: () => void; tint?: InTint;
}) {
  const color = tint === 'out' ? '#D9663D' : C.brand;
  return (
    <Pressable onPress={onPress} style={st.drop}>
      <SvgXml xml={`<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${SEG_ICO[icon]}</svg>`} width={34} height={34} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink }}>{title}</Text>
        {badge}
      </View>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64, textAlign: 'center' }}>{hint}</Text>
    </Pressable>
  );
}

/* .mockstmt — the shimmering fake statement while a scan "reads". */
export function MockStmt() {
  const shine = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.timing(shine, {
      toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [shine]);
  return (
    <View style={st.mockstmt}>
      {['60%', '85%', '45%', '70%'].map((w, i) => (
        <View key={i} style={{ height: 10, borderRadius: 5, backgroundColor: C.ink14, marginVertical: 8, width: w as ViewStyle['width'] }} />
      ))}
      <Animated.View pointerEvents="none" style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.55)',
        opacity: shine.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 0] }),
      }} />
    </View>
  );
}

const st = StyleSheet.create({
  incard: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  inseg: {
    flexDirection: 'row', backgroundColor: '#EEF3F2', borderRadius: 14, padding: 4, gap: 4,
    marginHorizontal: 14, marginTop: 14,
  },
  insegBtn: {
    flex: 1, minHeight: 36, borderRadius: 11, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  insegBtnOn: {
    backgroundColor: '#fff',
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inperLite: {
    flexDirection: 'row', backgroundColor: C.card, borderWidth: 1.5, borderColor: C.ink14,
    borderRadius: 12, padding: 3, gap: 3,
  },
  inperBtn: { minHeight: 30, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  inday: {
    minWidth: 64, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.ink14, alignItems: 'center',
  },
  indayOn: { backgroundColor: C.ink, borderColor: C.ink },
  inchip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38,
    paddingLeft: 10, paddingRight: 12, borderRadius: 19,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.ink14,
  },
  inrow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 4 },
  inrowIb: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ieb: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  drop: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink40, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 14, alignItems: 'center', gap: 8,
  },
  mockstmt: {
    overflow: 'hidden', backgroundColor: '#F6F8F7', borderWidth: 1.5, borderColor: C.ink14,
    borderRadius: 14, padding: 12,
  },
});
