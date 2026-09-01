import React from 'react';
import {
  Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_OF, Tab, useApp } from './state';
import { STRINGS, Lang } from './strings';
import { monthsAgg } from './calc';
import { C, DISP_FONT } from './theme';
import { Btn, BodyS, PROV_G } from './ui';
import { Hero, Logo } from './svgs';
import { DatePickerField } from './date-picker';

/* ---------- bottom sheets ---------- */

function SheetFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={{ flex: 1, backgroundColor: 'rgba(60,81,82,0.45)' }} />
        </Pressable>
        <View style={[
          sheetSt.sheet,
          { paddingBottom: 20 + insets.bottom },
          Platform.OS === 'web' ? { width: '100%', maxWidth: 390, alignSelf: 'center' } : null,
        ]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Opt({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[sheetSt.opt, on && { backgroundColor: C.card }]}>
      <Text style={{ fontSize: 17, color: C.ink, fontWeight: on ? '600' : '400' }}>{label}</Text>
      {on ? <Text style={{ fontSize: 17, color: C.brand }}>✓</Text> : null}
    </Pressable>
  );
}

function SheetH3({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink, marginBottom: 12 }}>{children}</Text>;
}

function SheetInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={{
        minHeight: 48, backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
        paddingHorizontal: 14, fontSize: 17, color: C.ink,
      }}
      placeholderTextColor={C.ink40}
    />
  );
}

function monthValue(key: number): string {
  const year = Math.floor(key / 12);
  const month = key % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function suggestedPastMonth(dates: string[]): string {
  const now = new Date();
  const currentKey = now.getFullYear() * 12 + now.getMonth();
  const earliest = dates.reduce((result, value) => {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
    if (!match) return result;
    const key = Number(match[1]) * 12 + Number(match[2]) - 1;
    return Math.min(result, key);
  }, currentKey);
  return monthValue(Math.min(currentKey, earliest) - 1);
}

function isValidPastMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  return year * 12 + month - 1 < now.getFullYear() * 12 + now.getMonth();
}

export function SheetHost() {
  const {
    S, t, up, monthName, saveIncomeEntry, updateHistoricalIncomeEntry, saveIncomeSource, saveCustomWorkCost,
    saveExpenseCategory, toast,
  } = useApp();
  const sheet = S.sheet;
  const close = () => up(s => { s.sheet = null; });

  const [ownName, setOwnName] = React.useState('');
  const [ownAmt, setOwnAmt] = React.useState('0');
  const [pastM, setPastM] = React.useState<string | null>(null);
  const [pastA, setPastA] = React.useState('');
  const [pastError, setPastError] = React.useState<'invalid' | 'exists' | 'amount' | null>(null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    setOwnName('');
    setOwnAmt('0');
    setPastError(null);
    const editId = sheet?.startsWith('pastmonth:') ? sheet.slice('pastmonth:'.length) : null;
    const existing = editId ? S.data.income.find(entry => entry.id === editId && entry.method === 'historical_total') : null;
    setPastM(existing ? existing.d.slice(0, 7) : null);
    setPastA(existing ? String(existing.a) : '');
  }, [sheet, S.data.income]);

  if (!sheet || sheet === 'shockcustom') return null;

  // EN: US8.3 language selection lives in this sheet. It presents the supported
  // languages and writes the selected language back to current app state.
  // 中文：US8.3 的语言选择在这个底部弹层中完成。它展示支持的语言，并把选择写回当前应用状态。
  if (sheet === 'lang') {
    return (
      <SheetFrame onClose={close}>
        <SheetH3>{t('lang_pick')}</SheetH3>
        {(['en', 'ms', 'zh'] as Lang[]).map(l => (
          <Opt key={l} label={STRINGS[l].langname} on={S.lang === l}
            onPress={() => up(s => { s.lang = l; s.sheet = null; })} />
        ))}
      </SheetFrame>
    );
  }

  if (sheet.startsWith('prov:')) {
    const p = sheet.slice(5);
    return (
      <SheetFrame onClose={close}>
        <SheetH3>{PROV_G[p]} {t('prov_' + p)}</SheetH3>
        <BodyS>{t('provf_' + p)}</BodyS>
        <View style={{ marginTop: 16 }}>
          <Btn label={t('done')} onPress={close} />
        </View>
      </SheetFrame>
    );
  }

  if (sheet === 'pastmonth' || sheet.startsWith('pastmonth:')) {
    const editId = sheet.startsWith('pastmonth:') ? sheet.slice('pastmonth:'.length) : null;
    const sel = pastM ?? suggestedPastMonth(S.data.income.map(entry => entry.d));
    const save = async () => {
      const a = parseFloat(pastA) || 0;
      if (saving) return;
      if (!isValidPastMonth(sel)) { setPastError('invalid'); return; }
      if (a <= 0) { setPastError('amount'); return; }
      if (S.data.income.some(entry => entry.id !== editId && entry.d.slice(0, 7) === sel)) {
        setPastError('exists');
        return;
      }
      setSaving(true);
      try {
        if (editId) {
          await updateHistoricalIncomeEntry(editId, { amount: a, date: sel + '-15' });
        } else {
          await saveIncomeEntry({
            amount: a,
            date: sel + '-15',
            entryMethod: 'historical_total',
            confirmOutlier: true,
          });
        }
        let months = 0;
        up(s => { s.sheet = null; months = monthsAgg(s.data).length; });
        toast(t('entry_saved_n', { n: months }));
      } catch {
        toast(t('inc_save_failed'));
      } finally {
        setSaving(false);
      }
    };
    return (
      <SheetFrame onClose={close}>
        <SheetH3>{editId ? `${t('edit')} ${t('inc_month_total')}` : t('inc_past')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('inc_past_hint')}</BodyS>
          <BodyS muted>{t('inc_past_no_min')}</BodyS>
          <BodyS muted>{t('inc_past_month')}</BodyS>
          <DatePickerField
            value={sel}
            mode="month"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)}
            onChange={value => { setPastM(value); setPastError(null); }}
          />
          <BodyS muted>{t('inc_amount')}</BodyS>
          <SheetInput keyboardType="numbers-and-punctuation" value={pastA}
            onChangeText={value => { setPastA(value); setPastError(null); }} />
          {pastError ? <BodyS>{t(`inc_past_${pastError}`)}</BodyS> : null}
          <Btn label={saving ? t('inc_saving') : (editId ? t('done') : t('add'))} onPress={() => { void save(); }} />
        </View>
      </SheetFrame>
    );
  }

  if (sheet === 'xcown' || sheet === 'srcown' || sheet === 'wcown') {
    const title = sheet === 'xcown' ? t('xc_own') : sheet === 'srcown' ? t('src_own') : t('wc_own');
    const save = async () => {
      const name = ownName.trim();
      if (!name || saving) return;
      setSaving(true);
      try {
        if (sheet === 'srcown') {
          await saveIncomeSource(name);
          up(s => { s.sheet = null; });
        } else if (sheet === 'xcown') {
          await saveExpenseCategory(name);
          up(s => { s.sheet = null; });
        } else {
          await saveCustomWorkCost(name, Math.max(0, parseFloat(ownAmt) || 0));
          up(s => { s.sheet = null; });
        }
        toast(t('saved'));
      } catch {
        toast(t('inc_save_failed'));
      } finally {
        setSaving(false);
      }
    };
    return (
      <SheetFrame onClose={close}>
        <SheetH3>{title}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t(sheet === 'wcown' ? 'wc_name' : sheet === 'xcown' ? 'xc_name' : 'src_name')}</BodyS>
          <SheetInput value={ownName} onChangeText={setOwnName} />
          {sheet === 'wcown' ? (
            <>
              <BodyS muted>{t('inc_amount')}</BodyS>
              <SheetInput keyboardType="numbers-and-punctuation" value={ownAmt} onChangeText={setOwnAmt} />
            </>
          ) : null}
          <Btn label={saving ? t('inc_saving') : t('add')} onPress={() => { void save(); }} />
        </View>
      </SheetFrame>
    );
  }

  return null;
}

const sheetSt = StyleSheet.create({
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  opt: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, paddingHorizontal: 12,
  },
});

/* ---------- onboarding + splash ---------- */

export function Onboarding() {
  const { S, t, up } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const i = S.onboard;
  const cards = ['ob1', 'ob2', 'ob3'];

  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [i, anim]);

  const heroW = Math.min(330, width - 48);

  return (
    <View style={[StyleSheet.absoluteFill, {
      backgroundColor: C.paper, zIndex: 50,
      paddingTop: 24 + insets.top, paddingHorizontal: 24, paddingBottom: 24 + insets.bottom,
    }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable
          style={{
            minHeight: 44, paddingHorizontal: 10, justifyContent: 'center',
            borderWidth: 1.5, borderColor: C.ink14, borderRadius: 10,
          }}
          onPress={() => up(s => { s.sheet = 'lang'; })}
        >
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, letterSpacing: 0.8, color: C.ink }}>
            {S.lang.toUpperCase()} ▾
          </Text>
        </Pressable>
        <Pressable
          style={{ minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => up(s => { s.onboarded = true; })}
        >
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('ob_skip')}</Text>
        </Pressable>
      </View>
      <Animated.View style={{
        flex: 1, alignItems: 'center', paddingTop: 6, gap: 14,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}>
        <Hero index={i} width={heroW} />
        <BodyS muted style={{ marginTop: 2, textAlign: 'center' }}>{t('ob_slogan')}</BodyS>
        <Text style={{
          fontFamily: DISP_FONT, fontSize: 19, lineHeight: 26, color: C.ink,
          marginTop: 14, maxWidth: 300, minHeight: 120, textAlign: 'center',
        }}>{t(cards[i])}</Text>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {cards.map((_, j) => (
          <View key={j} style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: j === i ? C.brand : C.ink14,
          }} />
        ))}
      </View>
      <Btn
        label={i < 2 ? t('ob_next') : t('ob_start')}
        onPress={() => up(s => { if (s.onboard < 2) s.onboard++; else s.onboarded = true; })}
      />
    </View>
  );
}

export function Splash() {
  const { S, t, up } = useApp();
  const mark = React.useRef(new Animated.Value(0)).current;
  const wm = React.useRef(new Animated.Value(0)).current;
  const slg = React.useRef(new Animated.Value(0)).current;
  const out = React.useRef(new Animated.Value(1)).current;
  const ending = React.useRef(false);

  const end = React.useCallback(() => {
    if (ending.current) return;
    ending.current = true;
    Animated.timing(out, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => {
      up(s => { s.splash = false; });
    });
  }, [out, up]);

  React.useEffect(() => {
    Animated.timing(mark, {
      toValue: 1, duration: 800,
      easing: Easing.bezier(0.34, 1.45, 0.5, 1), useNativeDriver: true,
    }).start();
    Animated.timing(wm, { toValue: 1, duration: 500, delay: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    Animated.timing(slg, { toValue: 1, duration: 500, delay: 720, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    const timer = setTimeout(end, 1800);
    return () => clearTimeout(timer);
  }, [mark, wm, slg, end]);

  if (!S.splash) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 60, opacity: out }]}>
      <Pressable onPress={end} style={{
        flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: 14,
      }} accessibilityLabel="RuMampu">
        <Animated.View style={{
          opacity: mark,
          transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
        }}>
          <Logo size={126} />
        </Animated.View>
        <Animated.Text style={{
          fontSize: 36, fontWeight: '800', letterSpacing: -0.5, color: C.ink,
          opacity: wm,
          transform: [{ translateY: wm.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}>RuMampu</Animated.Text>
        <Animated.Text style={{
          fontSize: 13, lineHeight: 18, color: C.ink64,
          opacity: slg,
          transform: [{ translateY: slg.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}>{t('ob_slogan')}</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- toast ---------- */

export function ToastView() {
  const { toastMsg } = useApp();
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (toastMsg) {
      Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [toastMsg, anim]);
  if (!toastMsg) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: 20, right: 20, bottom: 84, zIndex: 30,
      backgroundColor: C.ink, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    }}>
      <Text style={{ color: toastMsg.tone === 'error' ? C.short : C.confirm, fontSize: 18 }}>
        {toastMsg.tone === 'error' ? '!' : '✓'}
      </Text>
      <Text style={{ color: C.paper, fontSize: 15, flexShrink: 1 }}>{toastMsg.msg}</Text>
    </Animated.View>
  );
}

/* ---------- tab bar ---------- */

const TABS: [string, string, string][] = [
  ['home', '⌂', 'tab_home'], ['money', '◔', 'tab_money'], ['test', '≟', 'tab_test'], ['prepare', '☰', 'tab_prepare'],
];

// EN: Epic 8 uses the shared TabBar to satisfy AC8.4 bottom navigation across
// Home, Money, Test, and Prepare; the component itself is shared app infrastructure.
// 中文：Epic 8 使用共享 TabBar 满足 AC8.4 中 Home、Money、Test、Prepare 的底部导航；组件本身属于共享基础设施。
export function TabBar() {
  const { S, t, goTab } = useApp();
  const insets = useSafeAreaInsets();
  const active = TAB_OF[S.route] || 'home';
  return (
    <View style={{
      flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: C.ink14,
      backgroundColor: C.paper, paddingBottom: insets.bottom,
    }}>
      {TABS.map(([id, ico, k]) => {
        const on = active === id;
        return (
          <Pressable
            key={id}
            onPress={() => goTab(id as Tab)}
            style={{
              flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3,
              borderTopWidth: 3, borderTopColor: on ? C.brand : 'transparent',
            }}
          >
            <Text style={{ fontSize: 18, lineHeight: 20, color: on ? C.brand : C.ink64 }}>{ico}</Text>
            <Text style={{
              fontFamily: DISP_FONT, fontSize: 12, letterSpacing: 0.5,
              color: on ? C.brand : C.ink64,
            }}>{t(k)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
