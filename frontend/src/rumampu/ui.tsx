import React from 'react';
import {
  Pressable, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import { C, DISP_FONT } from './theme';
import { Ico, Logo } from './svgs';
import { useApp } from './state';

/* UI primitives — each maps 1:1 to a CSS class in the prototype. */

export const PROV_G: Record<string, string> = { user: '●', official: '○', calc: '▸', assume: '▩' };

/* ---------- text ---------- */

type Cls = 'h-xl' | 'h-l' | 'h-m' | 'body-s';

const CLS_STYLE: Record<Cls, TextStyle> = {
  'h-xl': { fontSize: 40, lineHeight: 44, letterSpacing: -0.4 },
  'h-l': { fontSize: 26, lineHeight: 32 },
  'h-m': { fontSize: 19, lineHeight: 26 },
  'body-s': { fontSize: 13, lineHeight: 18 },
};

export function Display({ cls = 'h-m', children, style }: { cls?: Cls; children: React.ReactNode; style?: TextStyle }) {
  return (
    <Text style={[{ fontFamily: DISP_FONT, color: C.ink, fontVariant: ['tabular-nums'] }, CLS_STYLE[cls], style]}>
      {children}
    </Text>
  );
}

export function P({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[{ fontSize: 16, lineHeight: 24, color: C.ink }, style]}>{children}</Text>;
}

export function BodyS({ muted, children, style }: { muted?: boolean; children: React.ReactNode; style?: TextStyle }) {
  return (
    <Text style={[{ fontSize: 13, lineHeight: 18, color: muted ? C.ink64 : C.ink }, style]}>{children}</Text>
  );
}

/* ---------- layout ---------- */

export function Stack({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ gap: 16 }, style]}>{children}</View>;
}

export function StackS({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ gap: 8 }, style]}>{children}</View>;
}

export function Card({ children, style, gap }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return (
    <View style={[st.card, gap != null ? { gap } : null, style]}>{children}</View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ borderTopWidth: 1.5, borderTopColor: C.ink14 }} />;
}

export function NoteC({ children }: { children: React.ReactNode }) {
  return <View style={st.noteC}>{children}</View>;
}

/* ---------- header ---------- */

export function Hdr({ back, title, brand }: { back?: boolean; title?: string; brand?: boolean }) {
  const { t, S, backNav, up } = useApp();
  return (
    <View style={st.hdr}>
      {back ? (
        <Pressable style={st.iconbtn} onPress={backNav} accessibilityLabel={t('back')}>
          <Text style={{ fontSize: 20, color: C.ink }}>←</Text>
        </Pressable>
      ) : null}
      {brand ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Logo size={28} />
          <Text style={{ fontFamily: DISP_FONT, fontSize: 21, color: C.ink, letterSpacing: 0.2 }}>RuMampu</Text>
        </View>
      ) : (
        <Text style={{ flex: 1, fontFamily: DISP_FONT, fontSize: 19, color: C.ink, fontVariant: ['tabular-nums'] }}>
          {title || ''}
        </Text>
      )}
      {/* EN: US8.3 uses this Header control to open language selection; the rest of Header remains shared UI. */}
      {/* 中文：US8.3 使用这个 Header 控件打开语言选择；Header 其他部分仍是共享 UI。 */}
      <Pressable style={st.langbtn} onPress={() => up(s => { s.sheet = 'lang'; })} accessibilityLabel={t('lang_pick')}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 13, letterSpacing: 0.8, color: C.ink }}>
          {S.lang.toUpperCase()} ▾
        </Text>
      </Pressable>
    </View>
  );
}

/* ---------- buttons ---------- */

export function Btn({
  label, onPress, disabled = false,
}: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [st.btn, disabled && { opacity: 0.48 }, pressed && { opacity: 0.88 }]}
    >
      <Text style={st.btnTxt}>{label}</Text>
    </Pressable>
  );
}

export function BtnQuiet({
  children, onPress, arrow = true, style,
}: { children: React.ReactNode; onPress: () => void; arrow?: boolean; style?: ViewStyle }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.btnQuiet, style, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {arrow ? <Text style={{ fontSize: 16, color: C.ink }}>→</Text> : null}
    </Pressable>
  );
}

export function BtnLine({ label, onPress, style }: { label: string; onPress: () => void; style?: TextStyle }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, pressed && { opacity: 0.7 }]}>
      <Text style={[st.btnLineTxt, style]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label, on, brandOn, onPress, disabled = false, selectionRole,
}: {
  label: string;
  on?: boolean;
  brandOn?: boolean;
  onPress: () => void;
  disabled?: boolean;
  selectionRole?: 'radio' | 'checkbox';
}) {
  const selected = Boolean(on || brandOn);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selectionRole || 'button'}
      accessibilityState={{ disabled, ...(selectionRole ? { checked: selected } : {}) }}
      aria-checked={selectionRole ? selected : undefined}
      style={[st.chip, on && st.chipOn, brandOn && st.chipBrandOn, disabled && { opacity: 0.48 }]}
    >
      <Text style={{ fontSize: 15, color: on || brandOn ? C.paper : C.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Chips({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

export function IcLab({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, minWidth: 0 }}>
      <Ico name={name} />
      <View style={{ flexShrink: 1 }}>{children}</View>
    </View>
  );
}

/* ---------- provenance ---------- */

export function Prov({ p }: { p: string }) {
  const { t, up } = useApp();
  return (
    <Pressable onPress={() => up(s => { s.sheet = 'prov:' + p; })} hitSlop={10} style={{ alignSelf: 'flex-start' }}>
      <Text style={st.provTxt}>
        <Text style={{ fontSize: 9 }}>{PROV_G[p]}</Text> {t('prov_' + p).toUpperCase()}
      </Text>
    </Pressable>
  );
}

export function Fig({ value, p, cls = 'h-m' }: { value: string; p: string; cls?: Cls }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <Display cls={cls}>{value}</Display>
      <Prov p={p} />
    </View>
  );
}

export function FigRow({ p }: { p: string }) {
  return (
    <View style={{ gap: 2, alignItems: 'flex-start' }}>
      <Prov p={p} />
    </View>
  );
}

/* ---------- key/value + edit rows ---------- */

export function KV({ k, children }: { k: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={st.kv}>
      {typeof k === 'string' ? <Text style={{ fontSize: 15, color: C.ink, flexShrink: 1 }}>{k}</Text> : k}
      {children}
    </View>
  );
}

/* Numeric input that keeps a local string while typing but reports parsed values. */
export function NumInput({
  value, onNum, onCommit, style, min0 = true, alignRight, decimal = true, placeholder, accessibilityLabel,
}: {
  value: number | string;
  onNum: (n: number) => void;
  onCommit?: (n: number) => void;
  style?: ViewStyle | TextStyle | (ViewStyle | TextStyle)[];
  min0?: boolean;
  alignRight?: boolean;
  decimal?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const formatLocal = React.useCallback((v: number | string) => {
    if (!decimal) return String(v ?? '');
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : String(v ?? '');
  }, [decimal]);
  const [local, setLocal] = React.useState(formatLocal(value));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setLocal(formatLocal(value));
  }, [value, formatLocal]);
  return (
    <TextInput
      style={[st.input, alignRight && { textAlign: 'right', width: 104, minHeight: 44 }, style as TextStyle]}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      value={local}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={C.ink40}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        let n = parseFloat(local);
        if (!isFinite(n)) n = 0;
        if (min0) n = Math.max(0, n);
        setLocal(decimal ? n.toFixed(2) : String(Math.trunc(n)));
        onCommit?.(n);
      }}
      onChangeText={txt => {
        setLocal(txt);
        let n = parseFloat(txt);
        if (!isFinite(n)) n = 0;
        if (min0) n = Math.max(0, n);
        onNum(n);
      }}
    />
  );
}

export function Field({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink64 }}>{label}</Text>
        {extra}
      </View>
      {children}
    </View>
  );
}

export function TextField({
  value, onChangeText, placeholder, keyboardType,
}: { value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'numbers-and-punctuation' }) {
  return (
    <TextInput
      style={st.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.ink40}
      keyboardType={keyboardType}
    />
  );
}

export interface EditItem { id: string; k?: string; custom?: boolean; name?: string; a: number; p?: string; description?: string }

export function EditRow({
  label, p, description, value, onNum, onCommit, decimal = false,
}: {
  label: string;
  p?: string;
  description?: string;
  value: number;
  onNum: (n: number) => void;
  onCommit?: (n: number) => void;
  decimal?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, color: C.ink }}>{label}</Text>
        {description ? (
          <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink64 }}>{description}</Text>
        ) : p ? (
          <Prov p={p} />
        ) : null}
      </View>
      <NumInput value={value} onNum={onNum} onCommit={onCommit} alignRight decimal={decimal} />
    </View>
  );
}

export function EditList({
  list, onNum, onCommit, decimal = false,
}: {
  list: EditItem[];
  onNum: (i: number, n: number) => void;
  onCommit?: (i: number, n: number) => void;
  decimal?: boolean;
}) {
  const { t } = useApp();
  return (
    <>
      {list.map((c, i) => (
        <EditRow
          key={c.id + i}
          label={c.custom ? (c.name || '') : t(c.k || '')}
          p={c.p || 'user'}
          description={c.description}
          value={+c.a || 0}
          onNum={n => onNum(i, n)}
          onCommit={onCommit ? n => onCommit(i, n) : undefined}
          decimal={decimal}
        />
      ))}
    </>
  );
}

/* ---------- badges ---------- */

export function Badge({ label }: { label: string }) {
  return (
    <View style={st.badge}>
      <Text style={st.badgeTxt} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function FromR({ label }: { label: string }) {
  return (
    <View style={st.fromr}>
      <Text style={st.fromrTxt} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* ---------- styles ---------- */

const st = StyleSheet.create({
  hdr: {
    backgroundColor: C.paper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: 56,
    paddingHorizontal: 20,
  },
  iconbtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  langbtn: {
    minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: C.ink14, borderRadius: 10,
  },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.ink14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  noteC: {
    borderLeftWidth: 4, borderLeftColor: C.caution,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.card,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  btn: {
    minHeight: 52, backgroundColor: C.brand, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, width: '100%',
  },
  btnTxt: { color: '#fff', fontFamily: DISP_FONT, fontSize: 19 },
  btnQuiet: {
    minHeight: 52, backgroundColor: C.card, borderWidth: 1, borderColor: C.ink14, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, width: '100%',
  },
  btnLineTxt: {
    fontSize: 16, color: C.ink,
    textDecorationLine: 'underline', textDecorationColor: C.brand,
  },
  chip: {
    minHeight: 44, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 22,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipBrandOn: { backgroundColor: C.brand, borderColor: C.brand },
  provTxt: {
    fontSize: 11, lineHeight: 14, letterSpacing: 0.9, color: C.ink64, fontWeight: '600',
  },
  kv: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, minHeight: 32,
  },
  input: {
    minHeight: 48, backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 17, color: C.ink, fontVariant: ['tabular-nums'],
  },
  badge: {
    minHeight: 19, paddingVertical: 1, paddingHorizontal: 8, borderRadius: 10,
    backgroundColor: C.caution, alignSelf: 'flex-start', maxWidth: '100%',
  },
  badgeTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: C.ink },
  fromr: {
    minHeight: 20, paddingVertical: 1, paddingHorizontal: 8, borderWidth: 1.5, borderColor: C.caution,
    borderRadius: 10, alignSelf: 'flex-start', justifyContent: 'center',
  },
  fromrTxt: { fontSize: 11, letterSpacing: 0.55, color: C.ink64, fontWeight: '600' },
});
