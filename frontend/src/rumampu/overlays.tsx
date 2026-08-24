import React from 'react';
import {
  Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_OF, Tab, useApp } from './state';
import { STRINGS, Lang } from './strings';
import { monthsAgg, recSpan } from './calc';
import { C, DISP_FONT } from './theme';
import { Btn, BodyS, PROV_G } from './ui';
import { Hero, Logo } from './svgs';

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

export function SheetHost() {
  const { S, t, up, toast, monthName } = useApp();
  const sheet = S.sheet;
  const close = () => up(s => { s.sheet = null; });

  const [ownName, setOwnName] = React.useState('');
  const [ownAmt, setOwnAmt] = React.useState('0');
  const [pastM, setPastM] = React.useState<string | null>(null);
  const [pastA, setPastA] = React.useState('');
  React.useEffect(() => { setOwnName(''); setOwnAmt('0'); setPastM(null); setPastA(''); }, [sheet]);

  if (!sheet || sheet === 'shockcustom') return null;

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

  if (sheet === 'pastmonth') {
    const sp = recSpan(S.data);
    const firstKey = sp ? sp.from.y * 12 + sp.from.m : 2026 * 12 + 7;
    const opts: { v: string; label: string }[] = [];
    for (let k = firstKey - 1; k >= firstKey - 6; k--) {
      const y = Math.floor(k / 12), m = k % 12;
      opts.push({ v: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${monthName(m)} ${y}` });
    }
    const sel = pastM ?? opts[0].v;
    const save = () => {
      const a = parseFloat(pastA) || 0;
      if (a > 0 && /^\d{4}-\d{2}$/.test(sel)) {
        let months = 0;
        up(s => {
          s.data.income.push({ a, d: sel + '-15', s: s.incomeDraft.s });
          s.data.income.sort((x, y) => (x.d < y.d ? -1 : 1));
          s.sheet = null;
          months = monthsAgg(s.data).length;
        });
        toast(t('entry_saved_n', { n: months }));
      }
    };
    return (
      <SheetFrame onClose={close}>
        <SheetH3>{t('inc_past')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('inc_past_hint')}</BodyS>
          <BodyS muted>{t('inc_date')}</BodyS>
          {opts.map(o => (
            <Opt key={o.v} label={o.label} on={sel === o.v} onPress={() => setPastM(o.v)} />
          ))}
          <BodyS muted>{t('inc_amount')}</BodyS>
          <SheetInput keyboardType="number-pad" value={pastA} onChangeText={setPastA} />
          <Btn label={t('add')} onPress={save} />
        </View>
      </SheetFrame>
    );
  }

  if (sheet === 'xcown' || sheet === 'srcown' || sheet === 'wcown') {
    const title = sheet === 'xcown' ? t('xc_own') : sheet === 'srcown' ? t('src_own') : t('wc_own');
    const save = () => {
      const name = ownName.trim();
      if (!name) return;
      up(s => {
        const id = 'own' + Date.now();
        if (sheet === 'srcown') {
          s.data.sources.push({ id, custom: true, name });
          s.incomeDraft.s = id;
        } else if (sheet === 'xcown') {
          s.data.expenseCats.push({ id, custom: true, name });
          s.expDraft.c = id;
        } else {
          s.data.workCosts.push({ id, custom: true, name, a: parseFloat(ownAmt) || 0 });
        }
        s.sheet = null;
      });
      toast(t('saved'));
    };
    return (
      <SheetFrame onClose={close}>
        <SheetH3>{title}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('src_name')}</BodyS>
          <SheetInput value={ownName} onChangeText={setOwnName} />
          {sheet === 'wcown' ? (
            <>
              <BodyS muted>{t('inc_amount')}</BodyS>
              <SheetInput keyboardType="number-pad" value={ownAmt} onChangeText={setOwnAmt} />
            </>
          ) : null}
          <Btn label={t('add')} onPress={save} />
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
      <Text style={{ color: C.confirm, fontSize: 18 }}>✓</Text>
      <Text style={{ color: C.paper, fontSize: 15, flexShrink: 1 }}>{toastMsg.msg}</Text>
    </Animated.View>
  );
}

/* ---------- tab bar ---------- */

const TABS: [string, string, string][] = [
  ['home', '⌂', 'tab_home'], ['money', '◔', 'tab_money'], ['test', '≟', 'tab_test'], ['prepare', '☰', 'tab_prepare'],
];

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
