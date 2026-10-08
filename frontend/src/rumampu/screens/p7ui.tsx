import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { RUMA_IMG } from '../ruma';
import { PH } from '../ph';
import { GuideBtn } from '../tour';
import { useApp } from '../state';

/* The v7 Prepare design (RuMampu_Prepare_Loan_v7_1.html), as building blocks:
   its colour tokens, the Geist type, Phosphor icons, the header, the three
   button kinds, raised groups, folds, the segmented control and Ruma's coach
   bubble. Every size here is the design's own CSS value. */

export const T7 = {
  bg: '#F7FAF9', surface: '#FDFEFE', surface2: '#EEF3F2', surface3: '#E4ECEB',
  text: '#253738', text2: 'rgba(37,55,56,0.70)', text3: 'rgba(37,55,56,0.50)',
  line: 'rgba(37,55,56,0.11)', line2: 'rgba(37,55,56,0.20)',
  accent: '#3F8A8E', accentInk: '#2B6467', accentSoft: '#E1EEED', accentDeep: '#21494B', deepEdge: '#173739',
  onAccent: '#FBFDFD',
  ok: '#24733B', okSoft: '#E3F2E7', warn: '#835E06', warnSoft: '#F7EEDA', bad: '#A3432A', badSoft: '#F8E6E0', short: '#D8673F',
  memo: '#FFF6DC', memoInk: '#5E4A0F', interest: '#E9A07F', amber: '#E2A93B', keyGold: '#F2C14E', keyEdge: '#C2962C', keyInk: '#4A3A0B',
};
export const G = { r: 'Geist_400Regular', m: 'Geist_500Medium', s: 'Geist_600SemiBold', b: 'Geist_700Bold' };
export const SHADOW: ViewStyle = {
  shadowColor: '#21494B', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
};
/* kept for the screens built before the token set */
export const DEEP = T7.accentInk;
export const SOFT = T7.accentSoft;
export const SURF2 = T7.surface2;

/* the scroll column every v7 screen uses: .page{padding:4px 16px 32px} */
export const PAGE: ViewStyle = { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 0 };

export function Ph({ name, size = 20, color = T7.text }: { name: string; size?: number; color?: string }) {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" fill="${color}">${PH[name] || ''}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export const RUMA_AR: Record<string, number> = { count: 273 / 280, happy: 253 / 260, wave: 253 / 260, sleepy: 254 / 260, oops: 253 / 260 };
export function RumaImg({ pose, w }: { pose: string; w: number }) {
  return <Image source={{ uri: RUMA_IMG[pose] || RUMA_IMG.wave }} style={{ width: w, height: w * (RUMA_AR[pose] || 1) }} resizeMode="contain" />;
}

/* Text with the parts between \u0001 marks set in the design's <b>: semibold, accent ink. */
export const B1 = '\u0001';
export const b1 = (v: string | number) => `${B1}${v}${B1}`;
export function Rich({ s, style, bold }: { s: string; style?: TextStyle | TextStyle[]; bold?: TextStyle }) {
  const parts = s.split(B1);
  return (
    <Text style={style}>
      {parts.map((p, i) => (i % 2 ? <Text key={i} style={[{ fontFamily: G.s }, bold]}>{p}</Text> : p))}
    </Text>
  );
}

/* .hdr: back (or close), the title, and the help ring on the right */
export function Hdr7({ title, close, right, children }: { title?: string; close?: boolean; right?: React.ReactNode; children?: React.ReactNode }) {
  const { t, backNav } = useApp();
  return (
    <View style={x.hdr}>
      <Pressable onPress={backNav} accessibilityRole="button" accessibilityLabel={close ? t('p7_close') : t('back')} style={x.ib} hitSlop={4}>
        <Ph name={close ? 'x' : 'back'} size={22} />
      </Pressable>
      {children ?? <Text style={x.h2} numberOfLines={1}>{title}</Text>}
      {right === undefined ? <GuideBtn /> : right}
    </View>
  );
}
export function IconBtn({ name, label, onPress }: { name: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={x.ib}>
      <Ph name={name} size={21} />
    </Pressable>
  );
}

/* .btn.go: the lesson's chunky teal button with a pressed edge */
export function BtnGo({ label, icon, onPress, testID }: { label: string; icon?: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [x.go, pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 1 }]}>
      {icon ? <Ph name={icon} size={17} color={T7.onAccent} /> : null}
      <Text style={x.goT}>{label}</Text>
    </Pressable>
  );
}
/* .btn: the plain deep-teal button */
export function BtnDeep({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [x.deep, pressed && { transform: [{ scale: 0.98 }], backgroundColor: T7.accentInk }]}>
      <Text style={x.deepT}>{label}</Text>
    </Pressable>
  );
}
/* .btn2: outlined; square when it only carries an icon */
export function Btn2({ label, icon, onPress, square, testID, style }: {
  label: string; icon?: string; onPress: () => void; square?: boolean; testID?: string; style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed }) => [x.b2, square && x.b2sq, style, pressed && { backgroundColor: T7.surface2 }]}>
      {icon ? <Ph name={icon} size={square ? 21 : 17} /> : null}
      {square ? null : <Text style={x.b2T}>{label}</Text>}
    </Pressable>
  );
}
/* .actbar: the bar that stays above the tabs */
export function ActBar({ children }: { children: React.ReactNode }) {
  return <View style={x.act}>{children}</View>;
}

/* .sec: a section title with an optional note on the right */
export function Sec({ title, right, info, style }: { title: string; right?: string; info?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[x.sec, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        <Text style={x.secT}>{title}</Text>{info}
      </View>
      {right ? <Text style={x.secS}>{right}</Text> : null}
    </View>
  );
}
/* .group: a raised white surface whose rows are split by hairlines */
export function Group({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[x.group, style]}>
      {kids.map((c, i) => <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: T7.line } : undefined}>{c}</View>)}
    </View>
  );
}
/* details.acc */
export function Fold({ title, sub, children, testID, open: start = false }: {
  title: string; sub?: string; children: React.ReactNode; testID?: string; open?: boolean;
}) {
  const [open, setOpen] = React.useState(start);
  return (
    <View>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
        testID={testID} style={({ pressed }) => [x.sum, pressed && { backgroundColor: T7.surface2 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={x.sumT}>{title}</Text>
          {sub ? <Text style={x.sumS}>{sub}</Text> : null}
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Ph name="down" size={17} color={T7.text3} /></View>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View> : null}
    </View>
  );
}
/* .seg */
export function Seg<V extends string | number>({ items, on, onPick, wide }: {
  items: { v: V; l: string }[]; on: V; onPick: (v: V) => void; wide?: boolean;
}) {
  return (
    <View style={[x.seg, wide && { alignSelf: 'stretch' }]} accessibilityRole="radiogroup">
      {items.map(it => {
        const sel = it.v === on;
        return (
          <Pressable key={String(it.v)} onPress={() => onPick(it.v)} accessibilityRole="radio" accessibilityState={{ checked: sel }} aria-checked={sel}
            style={[x.segB, wide && { flex: 1, height: 38 }, sel && x.segOn]}>
            <Text style={[x.segT, sel && { color: T7.text }]}>{it.l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
/* .tg */
export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[x.tg, on && { backgroundColor: T7.accent }]}>
      <View style={[x.tgI, on && { transform: [{ translateX: 18 }] }]} />
    </View>
  );
}
/* .coach: Ruma beside a speech bubble whose tail points at her */
export function Coach({ pose, s }: { pose: string; s: string }) {
  return (
    <View style={x.coach}>
      <View style={{ marginBottom: -4 }}><RumaImg pose={pose} w={86} /></View>
      <View style={[x.bub, { flex: 1, marginBottom: 18 }]}>
        <View style={x.bubTailL} />
        <Rich s={s} style={x.bubT} bold={{ color: T7.accentInk }} />
      </View>
    </View>
  );
}
/* .chip */
export function Chip7({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'todo' }) {
  const bg = tone === 'ok' ? T7.okSoft : tone === 'warn' ? T7.warnSoft : tone === 'bad' ? T7.badSoft : 'transparent';
  const fg = tone === 'ok' ? T7.ok : tone === 'warn' ? T7.warn : tone === 'bad' ? T7.bad : T7.text2;
  return (
    <View style={[x.chip, { backgroundColor: bg }, tone === 'todo' && { borderWidth: 1, borderColor: T7.line2 }]}>
      <Text style={{ fontFamily: G.s, fontSize: 11.5, color: fg }}>{label}</Text>
    </View>
  );
}

export const x = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingHorizontal: 10, paddingBottom: 8, minHeight: 62 },
  ib: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  h2: { flex: 1, fontFamily: G.s, fontSize: 18, letterSpacing: -0.18, color: T7.text },
  go: {
    height: 54, borderRadius: 999, backgroundColor: T7.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 20, borderBottomWidth: 4, borderBottomColor: T7.accentDeep, marginBottom: 4,
  },
  goT: { fontFamily: G.s, fontSize: 16, letterSpacing: 0.16, color: T7.onAccent },
  deep: { height: 50, borderRadius: 999, backgroundColor: T7.accentDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  deepT: { fontFamily: G.s, fontSize: 15.5, color: '#F4FAFA' },
  b2: {
    height: 48, borderRadius: 999, borderWidth: 1, borderColor: T7.line2, backgroundColor: T7.surface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, marginTop: 10,
  },
  b2sq: { width: 50, height: 50, paddingHorizontal: 0, marginTop: 0 },
  b2T: { fontFamily: G.s, fontSize: 15, color: T7.text },
  act: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: T7.bg, borderTopWidth: 1, borderTopColor: T7.line },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 28, marginHorizontal: 2, marginBottom: 10 },
  secT: { fontFamily: G.s, fontSize: 15.5, letterSpacing: -0.15, color: T7.text },
  secS: { fontFamily: G.r, fontSize: 12.5, color: T7.text2 },
  group: { backgroundColor: T7.surface, borderRadius: 16, overflow: 'hidden', ...SHADOW },
  sum: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 16 },
  sumT: { fontFamily: G.s, fontSize: 14.5, color: T7.text },
  sumS: { fontFamily: G.r, fontSize: 12, color: T7.text2, marginTop: 2 },
  seg: { flexDirection: 'row', backgroundColor: T7.surface2, borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
  segB: { height: 32, paddingHorizontal: 13, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: T7.surface, shadowColor: '#21494B', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segT: { fontFamily: G.s, fontSize: 13, color: T7.text2 },
  tg: { width: 46, height: 28, borderRadius: 999, backgroundColor: T7.surface3, padding: 3 },
  tgI: { width: 22, height: 22, borderRadius: 11, backgroundColor: T7.surface, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  coach: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6, marginBottom: 16 },
  bub: { backgroundColor: T7.surface, borderWidth: 2, borderColor: T7.line2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  bubT: { fontFamily: G.r, fontSize: 15, lineHeight: 21.75, color: T7.text },
  bubTailL: {
    position: 'absolute', left: -9, bottom: 14, width: 14, height: 14, backgroundColor: T7.surface,
    borderLeftWidth: 2, borderBottomWidth: 2, borderColor: T7.line2, borderBottomLeftRadius: 4, transform: [{ rotate: '45deg' }],
  },
  chip: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  k: { fontFamily: G.m, fontSize: 12.5, color: T7.text2 },
  tiny: { fontFamily: G.r, fontSize: 12.5, lineHeight: 18, color: T7.text2 },
  disc: { fontFamily: G.r, fontSize: 12, lineHeight: 18.6, color: T7.text2, marginTop: 18, marginHorizontal: 2 },
  cardx: { backgroundColor: T7.surface2, borderRadius: 16, padding: 16 },
  card: { backgroundColor: T7.surface, borderRadius: 16, padding: 16, ...SHADOW },
});
