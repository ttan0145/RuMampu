import React from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
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
import { RumaHelpAvatar, RumaSignAvatar } from './ruma-view';

/* Flip to false to hide the whole Ask RuMampu UI (bubble, header
   button, popover), e.g. while the AI backend is unavailable. */
export const ASSISTANT_UI_ENABLED = true;

/* Keep speech recognition in sync with the language selected inside RuMampu,
   regardless of the device or browser language. */
function speechLocaleFromApp(lang: AppState['lang']): string {
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


/* .aifloat — free drag inside the frame, snaps to the nearer side edge. */
/* Room left under the open pop-up for the parked bubble: its 56px plus a gap. */
const FAB_PARK_GAP = 64;

export function AssistantFab() {
  const { S, t, up } = useApp();
  const frame = React.useRef({ w: 390, h: 700 });
  const pos = React.useRef(new Animated.ValueXY({ x: 390 - 68, y: 700 - 240 })).current;
  const start = React.useRef({ x: 390 - 68, y: 700 - 240 });
  const moved = React.useRef(false);

  const pan = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.hypot(g.dx, g.dy) > 6,
    onPanResponderGrant: () => { moved.current = false; },
    onPanResponderMove: (_e, g) => {
      moved.current = true;
      pos.setValue({
        x: Math.max(8, Math.min(frame.current.w - 64, start.current.x + g.dx)),
        y: Math.max(60, Math.min(frame.current.h - 140, start.current.y + g.dy)),
      });
    },
    onPanResponderRelease: (_e, g) => {
      if (!moved.current) return;
      const x = start.current.x + g.dx + 28 < frame.current.w / 2 ? 8 : frame.current.w - 64;
      const y = Math.max(60, Math.min(frame.current.h - 140, start.current.y + g.dy));
      start.current = { x, y };
      Animated.spring(pos, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start();
      /* Like the prototype's __aiDragged flag: swallow only the click that
         ends this drag, never the following taps. */
      setTimeout(() => { moved.current = false; }, 80);
    },
    onPanResponderTerminate: () => { setTimeout(() => { moved.current = false; }, 80); },
  })).current;

  /* While the chat is open the bubble slides to the bottom-right corner, just
     under the pop-up and clear of its header, then springs back to where the
     user last left it once the chat closes (user ruling 15 Sep). */
  const open = S.assistantOpen;
  React.useEffect(() => {
    const target = open
      ? { x: frame.current.w - 64, y: frame.current.h - 140 }
      : start.current;
    Animated.spring(pos, { toValue: target, useNativeDriver: false, friction: 8, tension: 70 }).start();
  }, [open, pos]);

  /* The floating bubble is the one entry to Ask RuMampu on every screen, tab
     roots and pushed screens alike (user ruling 15 Sep: no header robot on
     Income, Expenses and the rest; the bubble simply floats everywhere). */
  if (!ASSISTANT_UI_ENABLED || !S.onboarded || !S.knew) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, { zIndex: 20 }]}
      onLayout={e => {
        const { width: w, height: h } = e.nativeEvent.layout;
        frame.current = { w, h };
        const x = Math.min(start.current.x, w - 64);
        const y = Math.min(start.current.y, h - 140);
        start.current = { x, y };
        /* A layout change (rotation, browser resize) must not un-park an open chat. */
        pos.setValue(open ? { x: w - 64, y: h - 140 } : { x, y });
      }}
    >
      {/* Hidden while the chat is open: the chat layer draws the EXIT sign at
          the parked spot itself, and a dimmed twin under it read as a second
          button. The position still animates, so the bubble springs back from
          the corner when the chat closes. */}
      <Animated.View
        {...pan.panHandlers}
        pointerEvents={open ? 'none' : 'auto'}
        style={{ position: 'absolute', opacity: open ? 0 : 1, transform: pos.getTranslateTransform() }}
      >
        <Pressable
          onPressIn={() => { moved.current = false; }}
          onPress={() => { if (!moved.current) up(s => { s.assistantOpen = true; }); }}
          accessibilityLabel={t('ai_title')}
          style={({ pressed }) => [st.aibtn, pressed && { transform: [{ scale: 1.06 }] }]}
        >
          <RumaHelpAvatar size={56} ring />
        </Pressable>
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
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [pendingActions, setPendingActions] = React.useState<AssistantAction[]>([]);
  const [actionSaving, setActionSaving] = React.useState(false);
  const [confirmingOutlier, setConfirmingOutlier] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const speechText = React.useMemo(() => speechUiText(S.lang), [S.lang]);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', event => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (transcript) {
      setDraft(transcript);
    }
  });
  useSpeechRecognitionEvent('error', event => {
    setListening(false);
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    const message = event.error === 'not-allowed' ? speechText.denied : speechText.failed;
    toast(message, 'error');
  });

  const close = () => {
    if (listening) ExpoSpeechRecognitionModule.abort();
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

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,32,33,0.28)' }} />
        </Pressable>
        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Right-anchored like the prototype's .aipop, lifted one bubble height
              so the parked bubble (bottom-right, see AssistantFab) stays in view
              under the pop-up instead of behind it. */}
          <View pointerEvents="box-none" style={[
            { width: '100%', alignItems: 'flex-end', paddingRight: 12, marginBottom: 84 + FAB_PARK_GAP + insets.bottom },
            Platform.OS === 'web' ? { alignSelf: 'center', maxWidth: 390 } : null,
          ]}>
          <View style={st.pop}>
            <View style={st.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <RumaHelpAvatar size={44} />
                <Text style={st.title}>{t('ai_title')}</Text>
              </View>
            </View>
            <ScrollView
              ref={scrollRef}
              style={{ flexGrow: 0, maxHeight: 320 }}
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
                style={st.input}
                value={draft}
                onChangeText={setDraft}
                editable={pendingActions.length === 0}
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
          </View>
        </KeyboardAvoidingView>
        {/* The one way out: Ruma's EXIT sign as a real button above the dimming
            layer, at exactly the spot the parked bubble slides to (bottom-right,
            8px in, 56px tall, 84px up). No ✕ in the header (user ruling 15 Sep). */}
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 84, alignItems: 'center' }}>
          <View pointerEvents="box-none" style={{ width: '100%', maxWidth: Platform.OS === 'web' ? 390 : undefined, alignItems: 'flex-end', paddingRight: 8 }}>
            <Pressable
              onPress={close}
              accessibilityLabel={t('done')}
              style={({ pressed }) => [st.aibtn, pressed && { transform: [{ scale: 1.06 }] }]}
            >
              <RumaSignAvatar size={56} ring />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  aibtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#E4EFEC',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(31,63,65,1)', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pop: {
    backgroundColor: C.paper,
    borderRadius: 22,
    width: 332, maxWidth: '100%',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    shadowColor: 'rgba(15,32,33,1)', shadowOpacity: 0.4, shadowRadius: 56, shadowOffset: { width: 0, height: 22 },
    elevation: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: {
    /* minWidth 0: a web text input will not shrink below ~20 characters on its
       own, so with a larger phone font it pushed the Send button out of the
       pop-up. Letting it shrink keeps the row inside the card. */
    flex: 1, minWidth: 0, minHeight: 48,
    backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
    paddingHorizontal: 12, fontSize: 15, color: C.ink, fontFamily: BODY_FONT,
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
