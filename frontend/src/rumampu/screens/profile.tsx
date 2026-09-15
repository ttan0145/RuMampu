import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state';
import { STRINGS } from '../strings';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { Btn, BodyS, IcLab, P } from '../ui';
import { Ruma } from '../ruma-view';
import { ScreenShell } from './shell';
import { exportRecord } from '../api';

/* v22 profile tab: guest/signed hero, account rows, language, saved tests. */

const FLAGS: Record<string, string> = { en: '🇬🇧', ms: '🇲🇾', zh: '🇨🇳' };

export function ProfileScreen() {
  const { S, t, up, go, toast, signOut, deleteCurrentRecord } = useApp();
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [signupChoiceOpen, setSignupChoiceOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const startSignup = (mergeGuestData: boolean) => {
    setSignupChoiceOpen(false);
    up(s => {
      s.mergeGuestOnSignup = mergeGuestData;
      s.onboarded = false;
      s.wstep = 0;
      s.authMode = 'signup';
    });
  };
  const downloadExport = async () => {
    try {
      const file = await exportRecord();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      toast(t('pf_export_done'));
    } catch {
      toast(t('pf_export_failed'), 'error');
    }
  };
  const deleteRecord = async () => {
    const wasGuest = S.guest;
    if (!deleteArmed) {
      setDeleteArmed(true);
      toast(t(wasGuest ? 'pf_delete_guest_confirm' : 'pf_delete_confirm'));
      return;
    }
    try {
      await deleteCurrentRecord();
      setDeleteArmed(false);
      toast(t(wasGuest ? 'pf_delete_done_guest' : 'pf_delete_done_account'));
    } catch {
      toast(t('pf_delete_failed'), 'error');
    }
  };

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
      {S.guest ? <Btn label={t('pf_create')} onPress={() => setSignupChoiceOpen(true)} /> : null}
      <Pressable onPress={() => up(s => { s.sheet = 'lang'; })} style={st.pfrow}>
        <Text style={{ fontSize: 22 }}>{FLAGS[S.lang]}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <P style={{ fontSize: 15 }}>{t('pf_lang')}</P>
          <BodyS muted style={{ fontSize: 12 }}>{String(STRINGS[S.lang].langname)}</BodyS>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      {S.guest ? (
        <View style={st.mocard}>
          <Pressable onPress={() => { void deleteRecord(); }} style={st.morow}>
            <IcLab name="ring">
              <P style={{ fontSize: 15, color: deleteArmed ? C.short : C.ink }}>
                {deleteArmed ? t('pf_delete2') : t('pf_delete_guest')}
              </P>
            </IcLab>
            <Text style={{ fontSize: 16, color: deleteArmed ? C.short : C.ink }}>→</Text>
          </Pressable>
        </View>
      ) : (
        <View style={st.mocard}>
          <Pressable onPress={() => go('acctdetails')} style={st.morow}>
            <IcLab name="band"><P style={{ fontSize: 15 }}>{t('pf_acct')}</P></IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
          <Pressable onPress={() => go('acctdetails')} style={[st.morow, st.morowLine]}>
            <IcLab name="ring"><P style={{ fontSize: 15 }}>{t('pf_pw')}</P></IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
          <Pressable onPress={() => go('savedtests')} style={[st.morow, st.morowLine]}>
            <IcLab name="book"><P style={{ fontSize: 15 }}>{t('sv_title')}</P></IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
          <Pressable onPress={() => { void downloadExport(); }} style={[st.morow, st.morowLine]}>
            <IcLab name="book"><P style={{ fontSize: 15 }}>{t('pf_export')}</P></IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
          <Pressable onPress={() => { void deleteRecord(); }} style={[st.morow, st.morowLine]}>
            <IcLab name="ring">
              <P style={{ fontSize: 15, color: deleteArmed ? C.short : C.ink }}>
                {deleteArmed ? t('pf_delete2') : t('pf_delete')}
              </P>
            </IcLab>
            <Text style={{ fontSize: 16, color: deleteArmed ? C.short : C.ink }}>→</Text>
          </Pressable>
        </View>
      )}

      <Modal transparent visible={signupChoiceOpen} animationType="fade" onRequestClose={() => setSignupChoiceOpen(false)}>
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>{t('pf_merge_title')}</Text>
            <Text style={st.modalBody}>{t('pf_merge_body')}</Text>
            <Pressable style={st.modalPrimary} onPress={() => startSignup(true)}>
              <Text style={st.modalPrimaryText}>{t('pf_merge_yes')}</Text>
            </Pressable>
            <Pressable style={st.modalSecondary} onPress={() => startSignup(false)}>
              <Text style={st.modalSecondaryText}>{t('pf_merge_no')}</Text>
            </Pressable>
            <Pressable style={st.modalCancel} onPress={() => setSignupChoiceOpen(false)}>
              <Text style={st.modalCancelText}>{t('pf_merge_cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!S.guest ? (
        <Pressable
          disabled={loggingOut}
          onPress={() => {
            if (loggingOut) return;
            setLoggingOut(true);
            void signOut().catch(() => setLoggingOut(false));
          }}
          style={[st.logoutBtn, loggingOut && { opacity: 0.72 }]}
        >
          {loggingOut ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={C.ink} />
              <Text style={st.logoutText}>
                {S.lang === 'ms' ? 'Sedang log keluar...' : S.lang === 'zh' ? '正在退出登录...' : 'Logging out...'}
              </Text>
            </View>
          ) : (
            <Text style={st.logoutText}>{S.lang === 'ms' ? 'Log keluar' : S.lang === 'zh' ? '退出登录' : 'Log out'}</Text>
          )}
        </Pressable>
      ) : null}
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
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(14, 28, 27, 0.42)', alignItems: 'center', justifyContent: 'center', padding: 22,
  },
  modalCard: {
    width: '100%', maxWidth: 430, backgroundColor: '#fff', borderRadius: 22, padding: 20, gap: 10,
  },
  modalTitle: { fontFamily: DISP_FONT, fontSize: 20, lineHeight: 25, color: C.ink, textAlign: 'center' },
  modalBody: { fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 19, color: C.ink64, textAlign: 'center', marginBottom: 6 },
  modalPrimary: { minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brand, paddingHorizontal: 16 },
  modalPrimaryText: { fontFamily: DISP_FONT, fontSize: 14.5, color: '#fff', textAlign: 'center' },
  modalSecondary: { minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C9D6D3', paddingHorizontal: 16 },
  modalSecondaryText: { fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink, textAlign: 'center' },
  modalCancel: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontFamily: BODY_FONT, fontSize: 13, color: C.ink40 },
});
