import React from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { useApp } from './state';
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
      const { reply } = await assistantChat(history, S.lang);
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
