import React from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, AppState as NativeAppState, Easing, Keyboard, KeyboardAvoidingView, Modal,
  PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { SvgXml } from 'react-native-svg';
import { AppState, useApp } from './state';
import { ApiError, AssistantAction, assistantChat, previewAssistantAction } from './api';
import { rm } from './calc';
import { BODY_FONT, C, DISP_FONT } from './theme';
import { RumaHeadset, RumaHelpAvatar } from './ruma-view';
import { getSpeechOwner, setSpeechOwner } from './speech';
import { GuideTarget, onScrollSettle } from './tour';

/* Flip to false to hide the whole Ask RuMampu UI (bubble, header
   button, popover), e.g. while the AI backend is unavailable. */
export const ASSISTANT_UI_ENABLED = true;

/** One disclosure is shared by every hosted-AI feature. Declining only cancels
 * the attempted AI operation; the rest of RuMampu remains available. */
export function AiDisclosure() {
  const { S, t, answerAiDisclosure } = useApp();
  return (
    <Modal transparent animationType="none" visible={S.aiDisclosureOpen}
      onRequestClose={() => answerAiDisclosure(false)}>
      <View style={{ flex: 1, zIndex: 1000, backgroundColor: 'rgba(15,32,33,0.42)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 360, borderRadius: 18, backgroundColor: '#fff', padding: 20, gap: 12 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 20, color: C.ink }}>{t('ai_disclosure_title')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 14, lineHeight: 20, color: C.ink64 }}>{t('ai_disclosure_body')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 18, color: C.ink64 }}>{t('ai_disclosure_optional')}</Text>
          <Pressable accessibilityRole="button" onPress={() => answerAiDisclosure(true)}
            style={{ minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brand }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: '#fff' }}>{t('ai_disclosure_continue')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => answerAiDisclosure(false)}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 14, color: C.ink64 }}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* Keep speech recognition in sync with the language selected inside RuMampu,
   regardless of the device or browser language. */
export function speechLocaleFromApp(lang: AppState['lang']): string {
  if (lang === 'ms') return 'ms-MY';
  if (lang === 'zh') return 'zh-CN';
  return 'en-MY';
}

function speechUiText(lang: AppState['lang']) {
  if (lang === 'ms') return {
    start: 'Mula input suara', stop: 'Hentikan input suara', listening: 'Sedang mendengar…',
    denied: 'Akses mikrofon diperlukan untuk input suara.',
    unavailable: 'Pengecaman suara tidak tersedia pada peranti atau pelayar ini.',
    failed: 'Tidak dapat mengecam suara. Sila cuba lagi.',
  };
  if (lang === 'zh') return {
    start: '开始语音输入', stop: '停止语音输入', listening: '正在聆听…',
    denied: '语音输入需要麦克风权限。',
    unavailable: '此设备或浏览器不支持语音识别。',
    failed: '无法识别语音，请再试一次。',
  };
  return {
    start: 'Start voice input', stop: 'Stop voice input', listening: 'Listening…',
    denied: 'Microphone access is required for voice input.',
    unavailable: 'Speech recognition is not available on this device or browser.',
    failed: 'Could not recognise speech. Please try again.',
  };
}

/* US6.2 — "Ask RuMampu".

   v22 presentation: a draggable floating Ruma bubble (snaps to the nearer
   side edge) opens a chat popover with suggestion chips. Conversation history
   lives in app state for the session; every reply comes from the backend,
   which holds the record snapshot and the conversation rules
   (AC6.2.11/AC6.2.12: the page underneath stays visible). */


/* v27b2 Ask Ruma at the edge: Ruma alone, peeking in from the right edge at a
   slight lean, about 40 x 62 visible with the rest past the edge. It slides up
   and down the edge, and once moved the person's place wins over the automatic
   one. Waves twice on arrival, then once every twelve seconds. The tap area is
   48 x 64. It stays put while the chat is open, dimmed under the veil. */
const EDGE_W = 48;
const EDGE_H = 64;
/* Room the tab bar takes at the bottom of the frame. */
const TABBAR_H = 76;

export function AssistantFab() {
  const { S, t, up, ensureAiDisclosure } = useApp();
  const insets = useSafeAreaInsets();
  const [frameH, setFrameH] = React.useState(700);
  const minY = 60;
  const maxY = Math.max(minY, frameH - TABBAR_H - insets.bottom - EDGE_H + 10);
  const clamp = React.useCallback((y: number) => Math.max(minY, Math.min(maxY, y)), [maxY]);
  const yNow = clamp(S.aiY ?? Math.round(frameH * 0.56));
  const top = React.useRef(new Animated.Value(yNow)).current;
  const startY = React.useRef(yNow);
  const dragging = React.useRef(false);
  const moved = React.useRef(false);
  const [reduce, setReduce] = React.useState(false);
  const enter = React.useRef(new Animated.Value(0)).current;
  const wave = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduce(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  /* Slide in from the edge, wave twice, then once every twelve seconds. */
  React.useEffect(() => {
    if (reduce) { enter.setValue(1); wave.setValue(0); return undefined; }
    Animated.timing(enter, { toValue: 1, duration: 550, easing: Easing.bezier(0.2, 0.9, 0.3, 1.2), useNativeDriver: true }).start();
    const swing = (d: number) => Animated.sequence([
      Animated.timing(wave, { toValue: -1, duration: d, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wave, { toValue: 1, duration: d * 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: d, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]);
    const arrival = Animated.sequence([Animated.delay(700), swing(300), swing(300)]);
    const every = Animated.loop(Animated.sequence([
      Animated.delay(10560),
      Animated.timing(wave, { toValue: -1, duration: 360, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(wave, { toValue: -0.5, duration: 360, useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]));
    const all = Animated.sequence([arrival, every]);
    all.start();
    return () => all.stop();
  }, [reduce, enter, wave]);

  /* Settle wherever the person left it, or the app's spot, when nothing is being dragged. */
  React.useEffect(() => {
    if (dragging.current) return;
    Animated.timing(top, { toValue: yNow, duration: reduce ? 0 : 300, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }).start();
  }, [yNow, top, reduce]);

  /* v27b2 park: until the person moves Ruma, settle where Ruma covers the least
     along the right edge: controls and figures first, then words. Web only,
     where the page can be read; elsewhere Ruma keeps its spot. */
  const frameRef = React.useRef<View>(null);
  const park = React.useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || S.aiY != null || dragging.current) return;
    const host = frameRef.current as unknown as HTMLElement | null;
    const screen = document.querySelector('[data-testid="screen-scroll"]');
    if (!host || !host.getBoundingClientRect || !screen) return;
    const pr = host.getBoundingClientRect();
    const h = EDGE_H;
    const inks: [DOMRect, number][] = [];
    screen.querySelectorAll('*').forEach(node => {
      const e = node as HTMLElement;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.right < pr.right - 40) return;
      const ctl = e.getAttribute('role') === 'button' || /^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(e.tagName);
      let ink = ctl || e.tagName === 'IMG' || e.tagName.toLowerCase() === 'svg';
      if (!ink) for (let k = 0; k < e.childNodes.length; k++) { const nd = e.childNodes[k]; if (nd.nodeType === 3 && (nd.textContent || '').trim()) { ink = true; break; } }
      if (ink) {
        const num = !ctl && /[0-9]/.test(e.textContent || '');
        inks.push([r, ctl ? 5 : num ? 4 : e.tagName === 'IMG' ? 0.6 : 1]);
      }
    });
    const cover = (y: number) => {
      const T = pr.top + y, B = pr.top + y + h, L = pr.right - 42;
      let a = 0;
      for (const [r, wt] of inks) {
        const ow = Math.min(pr.right, r.right) - Math.max(L, r.left), oh = Math.min(B, r.bottom) - Math.max(T, r.top);
        if (ow > 0 && oh > 0) a += ow * oh * wt;
      }
      return a;
    };
    const pref = pr.height * 0.56;
    let best = Infinity, by = pref;
    for (let y = minY; y <= maxY; y += 6) {
      const sc = cover(y) + Math.abs(y - pref) * 0.6;
      if (sc < best) { best = sc; by = y; }
    }
    Animated.timing(top, { toValue: Math.round(by), duration: reduce ? 0 : 300, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }).start();
  }, [S.aiY, maxY, top, reduce]);
  React.useEffect(() => {
    const timer = setTimeout(park, 450);
    return () => clearTimeout(timer);
  }, [park, S.route, S.sayOpen, S.sheet, S.lnPg, S.lnArt, S.data]);
  React.useEffect(() => onScrollSettle(park), [park]);

  const pan = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
    onPanResponderGrant: () => {
      dragging.current = true;
      moved.current = false;
      top.stopAnimation(v => { startY.current = v; });
    },
    onPanResponderMove: (_e, g) => {
      moved.current = true;
      top.setValue(clamp(startY.current + g.dy));
    },
    onPanResponderRelease: (_e, g) => {
      dragging.current = false;
      const y = clamp(startY.current + g.dy);
      up(s => { s.aiY = y; });
      /* swallow only the click that ends this drag, never the following taps */
      setTimeout(() => { moved.current = false; }, 80);
    },
    onPanResponderTerminate: () => {
      dragging.current = false;
      setTimeout(() => { moved.current = false; }, 80);
    },
  }), [clamp, top, up]);

  if (!ASSISTANT_UI_ENABLED || !S.onboarded || !S.knew) return null;

  const rot = wave.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });
  return (
    <View
      ref={frameRef}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, { zIndex: 20 }]}
      onLayout={e => setFrameH(e.nativeEvent.layout.height)}
    >
      <Animated.View
        {...pan.panHandlers}
        style={{ position: 'absolute', right: 0, top, width: EDGE_W, height: EDGE_H }}
      >
        <GuideTarget id="aiedge">
        <Pressable
          onPressIn={() => { moved.current = false; }}
          onPress={() => {
            if (moved.current) return;
            top.stopAnimation(v => {
              void ensureAiDisclosure().then(accepted => {
                if (accepted) up(s => { s.aiAnchor = v + 8; s.assistantOpen = true; });
              });
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('ai_title')}
          style={{ width: EDGE_W, height: EDGE_H, overflow: 'visible' }}
        >
          {/* the peeking Ruma in its help-desk headset: past the right edge, leaning in at -12 degrees */}
          <Animated.View pointerEvents="none" style={[st.rpk, {
            transform: [
              { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [45, 0] }) },
              { rotate: '-12deg' },
            ],
          }]}>
            <Animated.View style={[{ transform: [{ scaleX: -1 }, { rotate: rot }] }, st.rpkImg]}>
              <RumaHeadset w={64} />
            </Animated.View>
          </Animated.View>
        </Pressable>
        </GuideTarget>
      </Animated.View>
    </View>
  );
}

/* The exact on-screen labels in the current language, so the assistant names
   buttons, tabs and pages the way the user sees them (in Chinese it must say
   添加收入, not "Add income"). Keys match the backend's DEFAULT_UI_LABELS. */
function uiLabels(t: (k: string) => string): Record<string, string> {
  return {
    tab_home: t('tab_home'), tab_money: t('tab_money'), tab_house: t('tab_test'), tab_profile: t('tab_profile'),
    quick_income: t('qk_income'), quick_expense: t('qk_expense'), quick_scan: t('qk_scan'),
    income_page: t('money_income'), add_income: t('inc_add'), past_month_link: t('inc_past'),
    tab_manual: t('im_type'), tab_scan: t('im_scan'), tab_import: t('im_csv'),
    expenses_page: t('money_expenses'), add_expense: t('ex_add'),
    work_costs: t('money_workcosts'), commitments: t('money_commit'), income_pattern: t('money_pattern'),
    quiet_months: t('money_coverage'), your_record: t('money_record'), saving_plan: t('pl_title'),
    test_house: t('hh_test'), run_test: t('tx_run'), result: t('rs_title'), save_test: t('rx_keep'),
    saved_tests: t('sv_title'), house_costs: t('hh_costs'), prepare: t('hh_prep'),
    language: t('pf_lang'), ask: t('ai_title'),
  };
}

/* The record stores default category and source names in English; the app
   shows them translated. Map stored name to shown label so the assistant's
   copy of the record reads the way the screen does (Family becomes Keluarga). */
function termLabels(S: AppState, t: (k: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (name: string | undefined, key: string | undefined) => {
    if (!name || !key) return;
    const shown = t(key);
    if (shown && shown !== key && shown !== name) out[name] = shown;
  };
  for (const c of S.data.expenseCats) if (!c.custom) add(c.name, c.k);
  for (const c of S.data.workCostCategories) if (!c.custom) add(c.name, c.k);
  for (const x of S.data.sources) if (!x.custom) add(x.name, x.k);
  return out;
}

export function AssistantSheet() {
  const { S, t, up, toast, saveIncomeEntry, saveExpenseEntry, saveCommitmentAmount } = useApp();
  const insets = useSafeAreaInsets();
  /* v27b2: the chat opens beside Ruma, on whichever side has more room; on a
     short screen with no room either side, it drops from the top. On web the
     app sits in a 390-wide phone frame centred in the window. */
  const { width: W0, height: H0 } = useWindowDimensions();
  const pop = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!S.assistantOpen) { pop.setValue(0); return; }
    Animated.timing(pop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [S.assistantOpen, pop]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [pendingActions, setPendingActions] = React.useState<AssistantAction[]>([]);
  const [actionSaving, setActionSaving] = React.useState(false);
  const [confirmingOutlier, setConfirmingOutlier] = React.useState(false);
  const [inputHeight, setInputHeight] = React.useState(48);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [webInputFocused, setWebInputFocused] = React.useState(false);
  const webInputFocusedRef = React.useRef(false);
  const webLayoutBottomRef = React.useRef(0);
  const [webViewport, setWebViewport] = React.useState<{
    height: number;
    offsetTop: number;
    bottomInset: number;
    occludedHeight: number;
  } | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const speechText = React.useMemo(() => speechUiText(S.lang), [S.lang]);

  React.useEffect(() => {
    if (!S.assistantOpen || !S.assistantDraft) return;
    setDraft(S.assistantDraft);
    up(s => { s.assistantDraft = ''; });
  }, [S.assistantOpen, S.assistantDraft, up]);

  /* The Say an entry card shares the microphone; only react to speech this
     chat started. */
  const mine = () => getSpeechOwner() === 'assistant';
  useSpeechRecognitionEvent('start', () => { if (mine()) setListening(true); });
  useSpeechRecognitionEvent('end', () => { if (mine()) setListening(false); });
  useSpeechRecognitionEvent('result', event => {
    if (!mine()) return;
    const transcript = event.results?.[0]?.transcript?.trim();
    if (transcript) {
      setDraft(transcript);
    }
  });
  useSpeechRecognitionEvent('error', event => {
    if (!mine()) return;
    setListening(false);
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    const message = event.error === 'not-allowed' ? speechText.denied : speechText.failed;
    toast(message, 'error');
  });

  const stopSpeech = React.useCallback(() => {
    // Abort unconditionally: the browser may have opened the microphone before
    // the async `start` event has updated `listening` in React state.
    // The Say an entry card shares the microphone; leave its recording alone.
    if (getSpeechOwner() === 'say') return;
    ExpoSpeechRecognitionModule.abort();
    setListening(false);
  }, []);

  React.useEffect(() => {
    if (!S.assistantOpen) stopSpeech();
  }, [S.assistantOpen, stopSpeech]);

  React.useEffect(() => {
    const nativeState = Platform.OS === 'web' ? null : NativeAppState.addEventListener('change', state => {
      if (state !== 'active') stopSpeech();
    });
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') stopSpeech();
    };
    const onPageHide = () => stopSpeech();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', onPageHide);
    }
    return () => {
      nativeState?.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', onPageHide);
      }
      stopSpeech();
    };
  }, [stopSpeech]);

  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const updateViewport = () => {
        const visibleBottom = viewport.offsetTop + viewport.height;
        if (!webInputFocusedRef.current) {
          webLayoutBottomRef.current = Math.max(window.innerHeight, visibleBottom);
        }
        const layoutBottom = webLayoutBottomRef.current || Math.max(window.innerHeight, visibleBottom);
        setWebViewport({
          height: viewport.height,
          offsetTop: viewport.offsetTop,
          bottomInset: Math.max(0, window.innerHeight - visibleBottom),
          occludedHeight: Math.max(0, layoutBottom - visibleBottom),
        });
      };
      updateViewport();
      viewport.addEventListener('resize', updateViewport);
      viewport.addEventListener('scroll', updateViewport);
      return () => {
        viewport.removeEventListener('resize', updateViewport);
        viewport.removeEventListener('scroll', updateViewport);
      };
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const close = () => {
    stopSpeech();
    Keyboard.dismiss();
    up(s => { s.assistantOpen = false; });
  };

  const toggleSpeech = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      toast(speechText.unavailable, 'error');
      return;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      toast(speechText.denied, 'error');
      return;
    }

    setSpeechOwner('assistant');
    ExpoSpeechRecognitionModule.start({
      lang: speechLocaleFromApp(S.lang),
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  };

  /* A language switch starts a fresh chat: replies written while the app was
     in another language name screens in that language, and the model copies
     the wording of earlier turns (seen live: 'Daily Log（每日记账）' after
     English-labelled replies). The greeting re-renders in the new language. */
  const prevLang = React.useRef(S.lang);
  React.useEffect(() => {
    if (prevLang.current === S.lang) return;
    prevLang.current = S.lang;
    setPendingActions([]);
    setConfirmingOutlier(false);
    up(s => { s.assistantMsgs = []; });
  }, [S.lang, up]);

  const shownLabel = (item: { custom?: boolean; name?: string; k?: string }) =>
    item.custom ? item.name || '' : t(item.k || '');

  const actionSummary = (action: AssistantAction): string => t(
    `as_action_${action.kind}_summary`,
    { amount: rm(Number(action.amount)), date: action.date || '', target: action.target_label },
  );

  const tryFinancialAction = async (content: string) => previewAssistantAction(content, S.lang, {
    incomeSources: S.data.sources.map(item => ({ id: item.id, label: shownLabel(item) })),
    expenseCategories: S.data.expenseCats.map(item => ({ id: item.id, label: shownLabel(item) })),
    commitments: [
      ...S.data.commitments.living,
      ...S.data.commitments.debts,
      ...S.data.commitments.savings,
    ].map(item => ({ id: item.id, label: shownLabel(item) })),
    limitCategories: [
      { id: 'total', label: t('lm_total') },
      ...S.data.expenseCats.map(item => ({ id: item.id, label: shownLabel(item) })),
    ],
    defaultIncomeSourceId: S.preferredIncomeSourceId || S.incomeDraft.s || null,
  });

  const send = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || sending) return;
    setPendingActions([]);
    setConfirmingOutlier(false);
    const history = [...S.assistantMsgs, { role: 'user' as const, content }];
    setDraft('');
    setSending(true);
    up(s => { s.assistantMsgs.push({ role: 'user', content }); });
    try {
      try {
        const preview = await tryFinancialAction(content);
        if (preview.status === 'needs_clarification') {
          up(s => { s.assistantMsgs.push({ role: 'assistant', content: preview.message }); });
          return;
        }
        if (preview.status === 'ready' && preview.actions.length > 0) {
          setPendingActions(preview.actions);
          return;
        }
      } catch {
        /* Keep ordinary chat available if the smaller action model is down.
           The 120B assistant may still explain how to enter the item manually. */
      }
      const { reply } = await assistantChat(history, S.lang, uiLabels(t), termLabels(S, t));
      up(s => { s.assistantMsgs.push({ role: 'assistant', content: reply }); });
    } catch (error) {
      const limited = error instanceof ApiError && error.code === 'assistant_rate_limited';
      const message = t(limited ? 'as_limit' : 'as_error');
      up(s => { s.assistantMsgs.push({ role: 'assistant', content: message }); });
      if (!limited) toast(message, 'error');
    } finally {
      setSending(false);
    }
  };

  const cancelAction = () => {
    setPendingActions([]);
    setConfirmingOutlier(false);
    up(s => { s.assistantMsgs.push({ role: 'assistant', content: t('as_action_cancelled') }); });
  };

  const confirmAction = async () => {
    if (pendingActions.length === 0 || actionSaving) return;
    setActionSaving(true);
    try {
      const actionsToSave = [...pendingActions].sort((a, b) =>
        Number(b.kind === 'income') - Number(a.kind === 'income'));
      for (const action of actionsToSave) {
        if (action.kind === 'income') {
          const result = await saveIncomeEntry({
            amount: Number(action.amount),
            date: action.date!,
            sourceId: action.target_id,
            confirmOutlier: confirmingOutlier,
          });
          if (result === 'outlier') {
            setConfirmingOutlier(true);
            up(s => { s.assistantMsgs.push({ role: 'assistant', content: t('as_action_outlier') }); });
            return;
          }
        } else if (action.kind === 'expense') {
          await saveExpenseEntry({
            amount: Number(action.amount),
            date: action.date!,
            categoryId: action.target_id,
          });
        } else if (action.kind === 'bill') {
          await saveCommitmentAmount(action.target_id, Number(action.amount));
        } else {
          up(s => { s.data.expenseLimits[action.target_id] = Number(action.amount); });
        }
      }
      const saved = pendingActions.length === 1
        ? t(`as_action_${pendingActions[0].kind}_saved`)
        : t('as_actions_saved', { n: pendingActions.length });
      setPendingActions([]);
      setConfirmingOutlier(false);
      up(s => { s.assistantMsgs.push({ role: 'assistant', content: saved }); });
      toast(saved);
    } catch {
      up(s => { s.assistantMsgs.push({ role: 'assistant', content: t('as_action_save_failed') }); });
    } finally {
      setActionSaving(false);
    }
  };

  if (!ASSISTANT_UI_ENABLED || !S.assistantOpen) return null;

  const framed = Platform.OS === 'web' && W0 > 430;
  const H = framed ? Math.min(844, H0) : H0 - insets.top;
  const offY = framed ? (H0 - H) / 2 : insets.top;
  const offX = framed ? (W0 - 390) / 2 : 0;
  const aTop = S.aiAnchor ?? H / 2 - 28;
  const roomAbove = aTop - 24;
  const roomBelow = H - aTop - 160;
  const above = roomAbove >= roomBelow;
  const fits = Math.max(roomAbove, roomBelow) >= 372;
  /* On web, use the visual viewport's coordinate space while the focused input
     is occluded. Giving the sheet an explicit visible height lets the messages
     shrink instead of moving an intrinsically-sized sheet above the keyboard. */
  const webKeyboardUp = Platform.OS === 'web'
    && webInputFocused
    && webViewport != null
    && (webViewport.bottomInset > 0 || webViewport.occludedHeight > 0);
  const keyboardUp = Platform.OS === 'web' ? webKeyboardUp : keyboardVisible;
  const place = webKeyboardUp && webViewport
    ? {
        top: webViewport.offsetTop + 12,
        height: Math.max(0, webViewport.height - 24),
        maxHeight: Math.max(0, webViewport.height - 24),
      }
    : keyboardUp
      ? { bottom: 12 + insets.bottom, maxHeight: H - 60 }
    : !fits
      ? { top: offY + 12, maxHeight: H - 92 }
      : above
        ? { bottom: H0 - (offY + aTop) + 12, maxHeight: Math.min(roomAbove, H - 140) }
        : { top: offY + aTop + 68, maxHeight: roomBelow };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,32,33,0.28)' }} />
        </Pressable>
        <Animated.View style={[st.pop, place, { position: 'absolute', right: offX + 12, opacity: pop }]}>
            <View style={st.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <RumaHelpAvatar size={44} />
                <Text style={st.title}>{t('ai_title')}</Text>
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('close')}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}>
                <Text style={{ fontSize: 18, color: C.ink }}>{'✕'}</Text>
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              style={st.messages}
              contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {S.assistantMsgs.length === 0 ? (
                <View style={[st.bubble, st.bubbleBot]}>
                  <Text style={st.bubbleBotTxt}>{t('ai_hi')}</Text>
                </View>
              ) : null}
              {S.assistantMsgs.map((message, index) => (
                <View
                  key={index}
                  style={[st.bubble, message.role === 'user' ? st.bubbleUser : st.bubbleBot]}
                >
                  <Text style={message.role === 'user' ? st.bubbleUserTxt : st.bubbleBotTxt}>
                    {message.content}
                  </Text>
                </View>
              ))}
              {sending ? (
                <View style={[st.bubble, st.bubbleBot, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <ActivityIndicator size="small" color={C.ink64} />
                  <Text style={st.bubbleBotTxt}>{t('as_thinking')}</Text>
                </View>
              ) : null}
              {pendingActions.length > 0 ? (
                <View style={st.actionCard}>
                  <Text style={st.actionTitle}>{t('as_action_review')}</Text>
                  <View style={{ gap: 6 }}>
                    {pendingActions.map((action, index) => (
                      <Text key={`${action.kind}-${action.target_id}-${index}`} style={st.actionText}>
                        {`${index + 1}. ${actionSummary(action)}`}
                      </Text>
                    ))}
                  </View>
                  <View style={st.actionButtons}>
                    <Pressable
                      disabled={actionSaving}
                      onPress={cancelAction}
                      style={[st.actionCancel, actionSaving && { opacity: 0.5 }]}
                    >
                      <Text style={st.actionCancelText}>{t('cancel')}</Text>
                    </Pressable>
                    <Pressable
                      disabled={actionSaving}
                      onPress={() => { void confirmAction(); }}
                      style={[st.actionConfirm, actionSaving && { opacity: 0.5 }]}
                    >
                      {actionSaving ? <ActivityIndicator size="small" color="#fff" /> : (
                        <Text style={st.actionConfirmText}>
                          {t(confirmingOutlier ? 'as_action_confirm_again' : 'as_action_confirm')}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={st.footer}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {['ai_q1', 'ai_q2', 'ai_q3'].map(k => (
                  <Pressable
                    key={k}
                    disabled={pendingActions.length > 0}
                    onPress={() => { void send(t(k)); }}
                    style={[st.sugg, pendingActions.length > 0 && { opacity: 0.4 }]}
                  >
                    <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink }}>{t(k)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={st.inputRow}>
                <TextInput
                  style={[st.input, { height: inputHeight }]}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => {
                    webInputFocusedRef.current = true;
                    setWebInputFocused(true);
                  }}
                  onBlur={() => {
                    webInputFocusedRef.current = false;
                    setWebInputFocused(false);
                  }}
                  editable={pendingActions.length === 0}
                  multiline
                  submitBehavior="submit"
                  scrollEnabled={inputHeight >= 112}
                  onContentSizeChange={event => {
                    const nextHeight = Math.max(48, Math.min(112, event.nativeEvent.contentSize.height + 2));
                    setInputHeight(nextHeight);
                  }}
                  placeholder={listening ? speechText.listening : t('ai_ph')}
                  placeholderTextColor={C.ink40}
                  onSubmitEditing={() => { void send(); }}
                />
                <Pressable
                  onPress={() => { void toggleSpeech(); }}
                  disabled={sending || pendingActions.length > 0}
                  style={[st.micBtn, listening && st.micBtnActive, (sending || pendingActions.length > 0) && { opacity: 0.4 }]}
                  accessibilityLabel={listening ? speechText.stop : speechText.start}
                >
                  <SvgXml
                    xml={'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>'}
                    width={22}
                    height={22}
                    color={listening ? '#fff' : C.brand}
                  />
                </Pressable>
                <Pressable
                  onPress={() => { void send(); }}
                  disabled={sending || pendingActions.length > 0 || !draft.trim()}
                  style={[st.sendBtn, (sending || pendingActions.length > 0 || !draft.trim()) && { opacity: 0.4 }]}
                  accessibilityLabel={t('ai_send')}
                >
                  <SvgXml xml={'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'} width={22} height={22} />
                </Pressable>
              </View>
              <Text style={st.disclaimer}>{t('as_disclaimer')}</Text>
            </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  /* .aipop: min(332px, 100% - 24px) wide, beside Ruma */
  rpk: {
    position: 'absolute', right: -24, bottom: 0, width: 64, height: 64,
    transformOrigin: 'right bottom',
  },
  rpkImg: Platform.OS === 'web'
    ? ({ filter: 'drop-shadow(-2px 3px 4px rgba(31,63,65,.35))', transformOrigin: '50% 88%' } as object)
    : { transformOrigin: '50% 88%' },
  pop: {
    backgroundColor: C.paper,
    borderRadius: 22,
    width: 332, maxWidth: '94%', overflow: 'hidden',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    shadowColor: 'rgba(15,32,33,1)', shadowOpacity: 0.4, shadowRadius: 56, shadowOffset: { width: 0, height: 22 },
    elevation: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  messages: { flex: 1, minHeight: 0, maxHeight: 320 },
  title: { fontFamily: DISP_FONT, fontSize: 19, color: C.ink },
  bubble: { maxWidth: '84%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: C.brand, borderBottomRightRadius: 4 },
  bubbleBot: { alignSelf: 'flex-start', backgroundColor: '#EDF3F2', borderBottomLeftRadius: 4 },
  bubbleUserTxt: { fontFamily: BODY_FONT, fontSize: 14, lineHeight: 19, color: '#fff' },
  bubbleBotTxt: { fontFamily: BODY_FONT, fontSize: 14, lineHeight: 19, color: C.ink },
  actionCard: {
    alignSelf: 'stretch', gap: 8, padding: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.paper,
  },
  actionTitle: { fontFamily: DISP_FONT, fontSize: 14, color: C.ink },
  actionText: { fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 19, color: C.ink },
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
  actionCancel: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5,
    borderColor: C.brand, alignItems: 'center', justifyContent: 'center',
  },
  actionCancelText: { fontFamily: BODY_FONT, fontSize: 13, color: C.brand },
  actionConfirm: {
    minHeight: 40, minWidth: 96, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
  },
  actionConfirmText: { fontFamily: BODY_FONT, fontSize: 13, color: '#fff' },
  sugg: {
    borderWidth: 1.5, borderColor: C.ink14, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 11, minHeight: 32, justifyContent: 'center',
  },
  footer: { flexShrink: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10, flexShrink: 0 },
  input: {
    /* minWidth 0: a web text input will not shrink below ~20 characters on its
       own, so with a larger phone font it pushed the Send button out of the
       pop-up. Letting it shrink keeps the row inside the card. */
    flex: 1, minWidth: 0, minHeight: 48, maxHeight: 112,
    backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
    /* iPhone Safari zooms the page when a focused input is below 16px. */
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, lineHeight: 21,
    color: C.ink, fontFamily: BODY_FONT, textAlignVertical: 'top',
  },
  micBtn: {
    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
    borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.paper,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: C.brand },
  sendBtn: {
    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
    backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
  },
  disclaimer: { fontFamily: BODY_FONT, fontSize: 11, lineHeight: 15, color: C.ink64, paddingTop: 8, textAlign: 'center' },
});
