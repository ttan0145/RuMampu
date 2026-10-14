import React from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useApp } from './state';
import { speechUsesAudioUpload } from './speech-recognition';
import { GROQ_YOUR_DATA_URL } from './ai-disclosure';
import { BODY_FONT, C, DISP_FONT } from './theme';

/** Shared first-use notice; Continue stays a direct microphone gesture on web. */
export function VoiceDisclosure({ visible, onContinue, onCancel }: {
  visible: boolean; onContinue: () => void; onCancel: () => void;
}) {
  const { t } = useApp();
  const uploads = speechUsesAudioUpload();
  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,32,33,0.42)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View accessibilityRole="alert" testID="voice-disclosure" style={{ width: '100%', maxWidth: 360, maxHeight: '90%', borderRadius: 20, backgroundColor: C.paper, padding: 20, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontFamily: DISP_FONT, fontSize: 20, color: C.ink }}>{t('vo_permission_title')}</Text>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12 }}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 14, lineHeight: 21, color: C.ink64 }}>{t(uploads ? 'vo_audio_permission_body' : 'vo_permission_body')}</Text>
            {uploads ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(GROQ_YOUR_DATA_URL).catch(() => undefined); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: BODY_FONT, color: C.brand, textDecorationLine: 'underline' }}>{t('statement_disclosure_policy_link')}</Text>
            </Pressable> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onContinue} style={{ minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brand }}>
            <Text style={{ fontFamily: DISP_FONT, color: '#fff', fontSize: 15 }}>{t('vo_permission_continue')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: BODY_FONT, color: C.ink64 }}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
