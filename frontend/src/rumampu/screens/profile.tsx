import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state';
import { STRINGS } from '../strings';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { Btn, BodyS, IcLab, P } from '../ui';
import { Ruma } from '../ruma-view';
import { ScreenShell } from './shell';

/* v22 profile tab: guest/signed hero, account rows, language, saved tests. */

const FLAGS: Record<string, string> = { en: '🇬🇧', ms: '🇲🇾', zh: '🇨🇳' };

export function ProfileScreen() {
  const { S, t, up, go, toast, signOut } = useApp();

  const startSignup = () => up(s => {
    s.onboarded = false;
    s.wstep = 2;
    s.authMode = 'signup';
  });

  return (
    <ScreenShell greet title={t('pf_title')}>
      <View style={st.pfhero}>
        <View style={st.pfheroBubble} pointerEvents="none" />
        <Ruma w={84} pose="wave" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 20, lineHeight: 24, color: C.ink }}>
            {S.guest ? t('hd_guest') : t('hd_welcome')}
          </Text>
          <View style={[st.pfpill]}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: S.guest ? '#E0A800' : C.confirm }} />
            <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, fontWeight: '600', color: C.ink }}>
              {S.guest ? t('pf_guest_t') : t('pf_signed_t')}
            </Text>
          </View>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 16, color: C.ink64, marginTop: 6 }}>
            {S.guest ? t('pf_guest') : t('pf_signed')}
          </Text>
        </View>
      </View>
      {S.guest ? <Btn label={t('pf_create')} onPress={startSignup} /> : null}
      <Pressable onPress={() => up(s => { s.sheet = 'lang'; })} style={st.pfrow}>
        <Text style={{ fontSize: 22 }}>{FLAGS[S.lang]}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <P style={{ fontSize: 15 }}>{t('pf_lang')}</P>
          <BodyS muted style={{ fontSize: 12 }}>{String(STRINGS[S.lang].langname)}</BodyS>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      <View style={st.mocard}>
        <Pressable onPress={() => (S.guest ? startSignup() : toast(t('pf_prev')))} style={st.morow}>
          <IcLab name="band">
            <P style={{ fontSize: 15 }}>{t('pf_acct')}</P>
            {S.guest ? <BodyS muted>{t('pf_acct_g')}</BodyS> : null}
          </IcLab>
          <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
        </Pressable>
        <Pressable onPress={() => toast(t('pf_prev'))} style={[st.morow, st.morowLine]}>
          <IcLab name="ring"><P style={{ fontSize: 15 }}>{t('pf_pw')}</P></IcLab>
          <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
        </Pressable>
        <Pressable onPress={() => go('savedtests')} style={[st.morow, st.morowLine]}>
          <IcLab name="book"><P style={{ fontSize: 15 }}>{t('sv_title')}</P></IcLab>
          <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
        </Pressable>
      </View>

      {!S.guest ? (
        <Pressable onPress={() => void signOut()} style={st.logoutBtn}>
          <Text style={st.logoutText}>{S.lang === 'ms' ? 'Log keluar' : S.lang === 'zh' ? '退出登录' : 'Log out'}</Text>
        </Pressable>
      ) : null}
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink40, textAlign: 'center' }}>
        {t('pf_version')}
      </Text>
    </ScreenShell>
  );
}

const st = StyleSheet.create({
  pfhero: {
    backgroundColor: '#D3E7E5', borderRadius: 20, padding: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center', position: 'relative', overflow: 'hidden',
  },
  pfheroBubble: {
    position: 'absolute', right: -30, top: -40, width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  pfpill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#fff', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 6,
  },
  pfrow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', minHeight: 52,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 16,
    paddingHorizontal: 14,
  },
  mocard: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 2,
  },
  morow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, paddingHorizontal: 4,
  },
  morowLine: { borderTopWidth: 1, borderTopColor: C.ink14 },
  logoutBtn: {
    minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: '#D4DDDB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  logoutText: { fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink },
});
