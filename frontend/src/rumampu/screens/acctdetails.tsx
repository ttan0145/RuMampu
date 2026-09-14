import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state';
import { fetchCurrentUser, requestPasswordReset } from '../api';
import { BODY_FONT, C } from '../theme';
import { BodyS, P } from '../ui';
import { ScreenShell } from './shell';

/* G8 — Account details: the signed-in account's email plus the two account
   actions. Password changes ride the existing reset-link flow; changing the
   email itself has no backend endpoint yet, so the row says so honestly. */

export function AcctDetailsScreen() {
  const { t, toast } = useApp();
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchCurrentUser()
      .then(auth => { if (alive) setEmail(auth.user.email); })
      .catch(() => { if (alive) setEmail(null); });
    return () => { alive = false; };
  }, []);

  const sendReset = async () => {
    if (!email) return;
    try {
      await requestPasswordReset(email);
      toast(t('ad_pw_sent'));
    } catch {
      toast(t('as_error'), 'error');
    }
  };

  return (
    <ScreenShell back title={t('ad_title')}>
      <View style={st.card}>
        <BodyS muted>{t('ad_email')}</BodyS>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 16, color: C.ink, marginTop: 3 }}>
          {email ?? '…'}
        </Text>
      </View>
      <View style={st.card}>
        <Pressable onPress={() => toast(t('ad_chmail_na'))} style={st.row}>
          <P style={{ fontSize: 15 }}>{t('ad_chmail')}</P>
          <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
        </Pressable>
        <Pressable onPress={() => { void sendReset(); }} style={[st.row, st.rowLine]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <P style={{ fontSize: 15 }}>{t('ad_pw')}</P>
            <BodyS muted style={{ fontSize: 12 }}>{t('ad_pw_sent')}</BodyS>
          </View>
          <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, gap: 10,
  },
  rowLine: { borderTopWidth: 1, borderTopColor: C.ink14 },
});
