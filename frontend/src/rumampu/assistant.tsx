import React from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { AppState, useApp } from './state';
import { ApiError, assistantChat } from './api';
import { BODY_FONT, C, DISP_FONT } from './theme';
import { RobotIco } from './svgs';
import { RumaAvatar } from './ruma-view';

/* Flip to false to hide the whole Ask RuMampu UI (bubble, header
   button, popover), e.g. while the AI backend is unavailable. */
export const ASSISTANT_UI_ENABLED = true;

/* US6.2 — "Ask RuMampu".

   v22 presentation: a draggable floating Ruma bubble (snaps to the nearer
   side edge) opens a chat popover with suggestion chips. Conversation history
   lives in app state for the session; every reply comes from the backend,
   which holds the record snapshot and the conversation rules
   (AC6.2.11/AC6.2.12: the page underneath stays visible). */


/* .aifloat — free drag inside the frame, snaps to the nearer side edge. */
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
        pos.setValue({ x, y });
      }}
    >
      <Animated.View
        {...pan.panHandlers}
        style={{ position: 'absolute', transform: pos.getTranslateTransform() }}
      >
        <Pressable
          onPressIn={() => { moved.current = false; }}
          onPress={() => { if (!moved.current) up(s => { s.assistantOpen = true; }); }}
          accessibilityLabel={t('ai_title')}
          style={({ pressed }) => [st.aibtn, pressed && { transform: [{ scale: 1.06 }] }]}
        >
          <RobotIco size={26} />
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
  const { S, t, up, toast } = useApp();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  const close = () => up(s => { s.assistantOpen = false; });

  const send = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || sending) return;
    const history = [...S.assistantMsgs, { role: 'user' as const, content }];
    setDraft('');
    setSending(true);
    up(s => { s.assistantMsgs.push({ role: 'user', content }); });
    try {
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

  if (!ASSISTANT_UI_ENABLED || !S.assistantOpen) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,32,33,0.28)' }} />
        </Pressable>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Right-anchored above the bubble's home corner, like the prototype's .aipop. */}
          <View pointerEvents="box-none" style={[
            { width: '100%', alignItems: 'flex-end', paddingRight: 12, marginBottom: 84 + insets.bottom },
            Platform.OS === 'web' ? { alignSelf: 'center', maxWidth: 390 } : null,
          ]}>
          <View style={st.pop}>
            <View style={st.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <RumaAvatar size={44} />
                <Text style={st.title}>{t('ai_title')}</Text>
              </View>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel={t('done')}>
                <Text style={{ fontSize: 20, color: C.ink64 }}>✕</Text>
              </Pressable>
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
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['ai_q1', 'ai_q2', 'ai_q3'].map(k => (
                <Pressable key={k} onPress={() => { void send(t(k)); }} style={st.sugg}>
                  <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink }}>{t(k)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={st.inputRow}>
              <TextInput
                style={st.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('ai_ph')}
                placeholderTextColor={C.ink40}
                onSubmitEditing={() => { void send(); }}
              />
              <Pressable
                onPress={() => { void send(); }}
                disabled={sending || !draft.trim()}
                style={[st.sendBtn, (sending || !draft.trim()) && { opacity: 0.4 }]}
                accessibilityLabel={t('ai_send')}
              >
                <SvgXml xml={'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'} width={22} height={22} />
              </Pressable>
            </View>
            <Text style={st.disclaimer}>{t('as_disclaimer')}</Text>
          </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  aibtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.brand,
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
  sugg: {
    borderWidth: 1.5, borderColor: C.ink14, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 11, minHeight: 32, justifyContent: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: {
    flex: 1, minHeight: 48,
    backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
    paddingHorizontal: 12, fontSize: 15, color: C.ink, fontFamily: BODY_FONT,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
  },
  disclaimer: { fontFamily: BODY_FONT, fontSize: 11, lineHeight: 15, color: C.ink64, paddingTop: 8, textAlign: 'center' },
});
