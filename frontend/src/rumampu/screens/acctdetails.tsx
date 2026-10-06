import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../state';
import { fetchCurrentUser, requestPasswordReset, updateAccountEmail } from '../api';
import { BODY_FONT, C } from '../theme';
import { BodyS, P } from '../ui';
import { ScreenShell } from './shell';

/* G8 — Account details are server-owned. Password changes use the existing
   reset-link flow and email changes update both login name and contact email. */

export function AcctDetailsScreen() {
  const { t, toast } = useApp();
  const [email, setEmail] = React.useState<string | null>(null);
  const [dateJoined, setDateJoined] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetchCurrentUser()
      .then(auth => { if (alive) { setEmail(auth.user.email); setDraft(auth.user.email); setDateJoined(auth.user.date_joined); } })
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

  const saveEmail = async () => {
    const next = draft.trim().toLowerCase();
    if (!next || !next.includes('@')) { toast(t('ad_email_invalid'), 'error'); return; }
    setSaving(true);
    try {
      const auth = await updateAccountEmail(next);
      setEmail(auth.user.email);
      setDraft(auth.user.email);
      setEditing(false);
      toast(t('ad_email_saved'));
    } catch (error) {
      toast(error instanceof Error ? error.message : t('as_error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <ScreenShell back title={t('ad_title')}>
      <View style={st.card}>
        <BodyS muted>{t('ad_email')}</BodyS>
        {editing ? (
          <>
            <TextInput
              accessibilityLabel={t('ad_email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={draft}
              onChangeText={setDraft}
              style={st.input}
            />
            <View style={st.actions}>
              <Pressable onPress={() => { setDraft(email || ''); setEditing(false); }} style={st.secondary}><P>{t('cancel')}</P></Pressable>
              <Pressable disabled={saving} onPress={() => { void saveEmail(); }} style={st.primary}><Text style={st.primaryText}>{saving ? t('saving') : t('save')}</Text></Pressable>
            </View>
          </>
        ) : (
          <Text style={{ fontFamily: BODY_FONT, fontSize: 16, color: C.ink, marginTop: 3 }}>{email ?? '…'}</Text>
        )}
        <BodyS muted style={{ marginTop: 10 }}>{t('ad_joined', {
          d: dateJoined ? new Date(dateJoined).toLocaleDateString() : '…',
        })}</BodyS>
      </View>
      <View style={st.card}>
        <Pressable onPress={() => setEditing(true)} style={st.row}>
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
  input: { borderWidth: 1.5, borderColor: C.brand, borderRadius: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: BODY_FONT, fontSize: 16, color: C.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  secondary: { borderWidth: 1, borderColor: C.ink14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  primary: { backgroundColor: C.brand, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  primaryText: { color: '#fff', fontFamily: BODY_FONT, fontWeight: '700' },
});
