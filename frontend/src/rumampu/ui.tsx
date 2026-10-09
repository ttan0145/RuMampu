import React from 'react';
import {
  Pressable, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT } from './theme';
import { Ico } from './svgs';
import { RumaAvatar } from './ruma-view';
import { useApp } from './state';
import { GuideBtn } from './tour';

/* UI primitives — each maps 1:1 to a CSS class in the prototype. */

export const PROV_G: Record<string, string> = { user: '●', official: '○', calc: '▸', assume: '▩', model: '◇' };

/* v24 monthBtn (.fhsel): the month-filter field above a recent list. */
export function MonthBtn({ act, monthKey }: { act: 'incmonth' | 'exmonth'; monthKey: number | null }) {
  const { t, up, monthName } = useApp();
  return (
    <Pressable onPress={() => up(s => { s.sheet = act; })}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', minHeight: 52, paddingVertical: 7, paddingHorizontal: 14,
        borderRadius: 12, backgroundColor: C.card,
      }}>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: SEMI_FONT, fontSize: 10.5, letterSpacing: 0.63, textTransform: 'uppercase', color: C.ink64, marginBottom: 1 }}>
          {t('mf_cap')}
        </Text>
        <Text style={{ fontFamily: SEMI_FONT, fontSize: 14.5, color: C.ink }}>
          {monthKey == null ? t('mf_none') : `${monthName(monthKey % 12)} ${Math.floor(monthKey / 12)}`}
        </Text>
      </View>
      <Text style={{ color: C.ink40 }}>{'▾'}</Text>
    </Pressable>
  );
}

/* Header shortforms per language — Bahasa Melayu reads BM in Malaysia. */
/* v24 cardI — a row that needs explaining carries an (i), not a paragraph.
   Tapping it opens the info sheet with the words and the tag explained. */
export function CardI({ t: titleKey, b, p, x, light }: {
  t: string; b: string[]; p?: 'user' | 'official' | 'calc' | 'assume'; x?: string[];
  /* v24 `.mohero .vinfo`: white ring on dark hero cards. */
  light?: boolean;
}) {
  const { t, up } = useApp();
  return (
    <Pressable
      onPress={() => up(s => { s.cardInfo = { t: titleKey, b, p, x }; s.sheet = 'cardinfo'; })}
      accessibilityLabel={t('ci_more')}
      hitSlop={8}
      style={{
        width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
        borderColor: light ? 'rgba(255,255,255,0.55)' : C.ink40,
        alignItems: 'center', justifyContent: 'center', marginLeft: 6,
      }}>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: light ? '#fff' : C.ink64 }}>i</Text>
    </Pressable>
  );
}

export const LANG_SHORT: Record<string, string> = { en: 'EN', ms: 'BM', zh: 'ZH' };

/* ---------- text ---------- */

type Cls = 'h-xl' | 'h-l' | 'h-m' | 'body-s';

const CLS_STYLE: Record<Cls, TextStyle> = {
  'h-xl': { fontSize: 26, lineHeight: 32, letterSpacing: -0.26 },
  'h-l': { fontSize: 22, lineHeight: 28 },
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
  return <Text style={[{ fontFamily: BODY_FONT, fontSize: 16, lineHeight: 24, color: C.ink }, style]}>{children}</Text>;
}

export function BodyS({ muted, children, style, numberOfLines }: {
  muted?: boolean; children: React.ReactNode; style?: TextStyle; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: muted ? C.ink64 : C.ink }, style]}>{children}</Text>
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

/* v22 header. Tab roots share the greeting header (Ruma avatar + time-of-day
   greeting + eyebrow tab label); pushed screens keep the back arrow, the title
   and a small robot button that opens Ask RuMampu. Language selection moved to
   Profile › Language (US8.3), so the header no longer carries a lang button. */
export function Hdr({ back, title, brand, greet, right }: {
  back?: boolean; title?: string; brand?: boolean; greet?: boolean; right?: React.ReactNode;
}) {
  const { t, S, backNav, up, go } = useApp();
  const coach = back && S.pathCoach && S.pathCoach.route === S.route ? S.pathCoach : null;

  if (brand || greet) {
    const h = new Date().getHours();
    const g = t(h < 12 ? 'hd_morning' : h < 18 ? 'hd_afternoon' : 'hd_evening');
    return (
      <View>
        <View style={[st.hdr, { paddingBottom: title ? 2 : 10 }]}>
          <RumaAvatar size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 16, color: C.ink64 }}>{g}</Text>
            <Text numberOfLines={1} style={{ fontFamily: DISP_FONT, fontSize: 19, lineHeight: 22, color: C.ink }}>
              {S.guest ? t('hd_guest') : t('hd_welcome')}
            </Text>
          </View>
          {right}
          <GuideBtn />
        </View>
        {title ? (
          <Text style={{
            fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase',
            color: C.ink64, paddingHorizontal: 20, paddingBottom: 8,
          }}>{title}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[st.hdr, coach && { zIndex: 30, elevation: 9 }]}>
      {back ? (
        <Pressable style={[st.iconbtn, coach && st.coachRing]} onPress={() => { if (coach) up(x => { x.pathCoach = null; }); backNav(); }}
          accessibilityLabel={t('back')}>
          <Text style={{ fontSize: 20, color: C.ink }}>←</Text>
        </Pressable>
      ) : null}
      {coach ? (
        /* the step is done: point at the way back, with a shortcut straight to the path */
        <View style={st.coach} testID="path-coach">
          <View style={st.coachTail} />
          <Text style={{ fontFamily: SEMI_FONT, fontSize: 13.5, lineHeight: 19, color: '#fff' }}>{t(coach.key)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <Pressable onPress={() => { up(x => { x.pathFocus = x.pathCoach?.stop ?? null; x.pathCoach = null; }); go('home'); }} accessibilityRole="button"
              testID="path-coach-go" style={st.coachBtn}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: '#0B6F6B' }}>{t('hx_coach_go')}</Text>
            </Pressable>
            <Pressable onPress={() => up(x => { x.pathCoach = null; })} accessibilityRole="button" hitSlop={8}>
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{t('hx_coach_later')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Text style={{ flex: 1, fontFamily: DISP_FONT, fontSize: 19, color: C.ink, fontVariant: ['tabular-nums'] }}>
        {title || ''}
      </Text>
      {right}
      <GuideBtn />
      {/* US6.2 / AC6.2.15: every pushed screen keeps an assistant entry, now
          the floating bubble (assistant.AssistantFab) rather than a header button. */}
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
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, pressed && { opacity: 0.7 }]}>
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
  const { t } = useApp();
  // EN: Provenance is a display-only label. Epic 1/2 require the value to be
  // identified, but do not require an explanatory bottom sheet on press.
  // 中文：数据来源仅作为展示标签。Epic 1/2 要求标识数值来源，但不要求点击后
  // 弹出解释底部弹层。
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Text style={st.provTxt}>
        <Text style={{ fontSize: 9 }}>{PROV_G[p]}</Text> {t('prov_' + p).toUpperCase()}
      </Text>
    </View>
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
  zeroPlaceholder = false,
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
  zeroPlaceholder?: boolean;
}) {
  // Keep zero visible as a faint hint, so the first keystroke replaces it.
  const formatLocal = React.useCallback((v: number | string) => (
    zeroPlaceholder && Number(v) === 0 ? '' : String(v ?? '')
  ), [zeroPlaceholder]);
  const [local, setLocal] = React.useState(formatLocal(value));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setLocal(formatLocal(value));
  }, [value, formatLocal]);
  return (
    <TextInput
      style={[
        st.input,
        alignRight && { textAlign: 'right', width: 104, minHeight: 44 },
        style as TextStyle,
      ]}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={local}
      placeholder={zeroPlaceholder ? '0' : placeholder}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={C.ink40}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        let n = parseFloat(local);
        if (!isFinite(n)) n = 0;
        if (min0) n = Math.max(0, n);
        setLocal(formatLocal(decimal ? n : Math.trunc(n)));
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
  value, onChangeText, placeholder, keyboardType, inputMode, accessibilityLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  inputMode?: React.ComponentProps<typeof TextInput>['inputMode'];
  accessibilityLabel?: string;
}) {
  return (
    <TextInput
      style={[st.input]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.ink40}
      keyboardType={keyboardType}
      inputMode={inputMode}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export interface EditItem { id: string; k?: string; custom?: boolean; name?: string; a: number; p?: string; description?: string }

export function EditRow({
  label, p, description, value, onNum, onCommit, decimal = false, zeroPlaceholder = false, accessory,
}: {
  label: string;
  p?: string;
  description?: string;
  value: number;
  onNum: (n: number) => void;
  onCommit?: (n: number) => void;
  decimal?: boolean;
  zeroPlaceholder?: boolean;
  accessory?: React.ReactNode;
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
      <NumInput value={value} onNum={onNum} onCommit={onCommit} alignRight decimal={decimal} zeroPlaceholder={zeroPlaceholder} />
      {accessory}
    </View>
  );
}

export function EditList({
  list, onNum, onCommit, decimal = false, showProvenance = true, zeroPlaceholder = false, renderAccessory,
}: {
  list: EditItem[];
  onNum: (i: number, n: number) => void;
  onCommit?: (i: number, n: number) => void;
  decimal?: boolean;
  showProvenance?: boolean;
  zeroPlaceholder?: boolean;
  renderAccessory?: (item: EditItem, index: number) => React.ReactNode;
}) {
  const { t } = useApp();
  return (
    <>
      {list.map((c, i) => (
        <EditRow
          key={c.id + i}
          label={c.custom ? (c.name || '') : t(c.k || '')}
          p={showProvenance ? (c.p || 'user') : undefined}
          description={c.description}
          value={+c.a || 0}
          onNum={n => onNum(i, n)}
          onCommit={onCommit ? n => onCommit(i, n) : undefined}
          decimal={decimal}
          zeroPlaceholder={zeroPlaceholder}
          accessory={renderAccessory?.(c, i)}
        />
      ))}
    </>
  );
}

/* A labelled on/off switch with an optional hint under the label. */
export function SwRow({ on, onPress, label, hint }: { on: boolean; onPress: () => void; label: string; hint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 15, color: C.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <View style={{
        width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: on ? C.brand : C.ink14,
        alignItems: on ? 'flex-end' : 'flex-start', justifyContent: 'center',
      }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
      </View>
    </Pressable>
  );
}

/* v27 (I2-F04): a whole past month is a button that says what it adds. */
export function WholeMonthBtn({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [st.wmbtn, pressed && { opacity: 0.85 }]}>
      <Ico name="calsum" size={22} color={C.brand} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 16, lineHeight: 20, color: C.brand }}>{title}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 16, color: C.ink64, marginTop: 2 }}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 22, lineHeight: 24, color: C.brand }}>{'›'}</Text>
    </Pressable>
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
    /* the page's own colour shows through (white unless the screen sets a tint) */
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: 56,
    paddingHorizontal: 20,
  },
  iconbtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  coachRing: { borderRadius: 22, borderWidth: 3, borderColor: '#11A09B', backgroundColor: '#DAF3F0' },
  coach: {
    position: 'absolute', left: 10, top: 58, maxWidth: 290, zIndex: 50, elevation: 8,
    backgroundColor: '#11A09B', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#1F2A44', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  coachTail: { position: 'absolute', left: 18, top: -6, width: 14, height: 14, backgroundColor: '#11A09B', transform: [{ rotate: '45deg' }] },
  coachBtn: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
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
  wmbtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', minHeight: 58, marginTop: 10,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.paper,
    borderWidth: 1.5, borderColor: C.brand,
  },
});
