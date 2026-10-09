import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state';
import { STRINGS } from '../strings';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { Btn, BodyS, BtnQuiet, IcLab, P, SwRow } from '../ui';
import { Ruma } from '../ruma-view';
import { ScreenShell } from './shell';
import { exportRecord } from '../api';
import { GuideTarget } from '../tour';
import { ReminderSheet, useReminderSummary } from './reminder-sheet';
import type { RecordReminderKind } from '../reminder-date';

/* v22 profile tab: guest/signed hero, account rows, language, saved tests. */

const FLAGS: Record<string, string> = { en: '🇬🇧', ms: '🇲🇾', zh: '🇨🇳' };

export function ProfileScreen() {
  const { S, t, up, go, toast, signOut, deleteCurrentRecord, enterSampleMonths, leaveSampleMonths, setRecordReminder } = useApp();
  const [reminderKind, setReminderKind] = React.useState<RecordReminderKind | null>(null);
  const reminderSummary = useReminderSummary();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [signupChoiceOpen, setSignupChoiceOpen] = React.useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = React.useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const shouldOfferDeleteExport = !S.guest && !S.accountLastExportedAt;
  /* Turning a reminder on opens the sheet to choose when; turning it off is
     immediate. Tapping the words of a reminder that is on edits its timing. */
  const notificationSwitch = (kind: RecordReminderKind, label: string) => {
    const saved = S.notificationPreferences.reminders[kind];
    const on = Boolean(saved?.enabled);
    return (
      <View key={kind} style={[st.morow, kind === 'expenses' && st.morowLine]}>
        <Pressable onPress={() => setReminderKind(kind)} accessibilityRole="button"
          accessibilityLabel={t('rm_edit', { n: label })} style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <P style={{ fontSize: 15 }}>{label}</P>
          {on && saved ? <BodyS muted style={{ fontSize: 12 }}>{reminderSummary(saved)}</BodyS> : null}
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          aria-checked={on}
          accessibilityLabel={label}
          hitSlop={8}
          onPress={() => {
            if (!on) { setReminderKind(kind); return; }
            void setRecordReminder(kind, saved!, false).catch(() => toast(t('br_failed'), 'error'));
          }}
        >
          <View style={[st.switchTrack, on && st.switchTrackOn]}>
            <View style={[st.switchThumb, on && st.switchThumbOn]} />
          </View>
        </Pressable>
      </View>
    );
  };

  const startSignup = (mergeGuestData: boolean) => {
    setSignupChoiceOpen(false);
    up(s => {
      s.mergeGuestOnSignup = mergeGuestData;
      s.discardGuestOnSignup = !mergeGuestData;
      s.authEntryOpen = true;
      s.wstep = 0;
      s.authMode = 'signup';
    });
  };
  const downloadExport = async (options: { closeExportConfirm?: boolean } = {}) => {
    if (exporting) return;
    const closeExportConfirm = options.closeExportConfirm !== false;
    setExporting(true);
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
      up(s => { s.accountLastExportedAt = new Date().toISOString(); });
      if (closeExportConfirm) setExportConfirmOpen(false);
      toast(t('pf_export_done'));
    } catch {
      toast(t('pf_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  };
  const deleteRecord = async () => {
    const wasGuest = S.guest;
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCurrentRecord();
      setDeleteConfirmOpen(false);
      toast(t(wasGuest
        ? (Platform.OS === 'web' ? 'pf_delete_done_guest' : 'pf_delete_done_guest_native')
        : 'pf_delete_done_account'));
    } catch {
      toast(t('pf_delete_failed'), 'error');
      setDeleting(false);
    }
  };

  return (
    <ScreenShell greet title={t('pf_title')} tint="#EEF6F3">
      <GuideTarget id="pf.hero">
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
            {S.guest ? t(Platform.OS === 'web' ? 'pf_guest' : 'pf_guest_native') : t('pf_signed')}
          </Text>
        </View>
      </View>
      </GuideTarget>
      {S.guest ? <Btn label={t('pf_create')} onPress={() => setSignupChoiceOpen(true)} /> : null}
      <Pressable onPress={() => up(s => { s.sheet = 'lang'; })} style={st.pfrow}>
        <Text style={{ fontSize: 22 }}>{FLAGS[S.lang]}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <P style={{ fontSize: 15 }}>{t('pf_lang')}</P>
          <BodyS muted style={{ fontSize: 12 }}>{String(STRINGS[S.lang].langname)}</BodyS>
        </View>
        <Text style={{ color: C.ink40 }}>▾</Text>
      </Pressable>
      {/* v27b: the invitation, the tour and the tips switch. Back on, every screen offers its tips again. */}
      <GuideTarget id="pf.tips" style={[st.mocard, { paddingHorizontal: 16, paddingVertical: 4 }]}>
        <SwRow on={!S.tipsOff} label={t('pf_tips')} hint={t('pf_tips_h')}
          onPress={() => up(s => { s.tipsOff = !s.tipsOff; if (!s.tipsOff) s.seenG = []; })} />
      </GuideTarget>
      {/* v27b: look around with sample months, or put your own record back */}
      <GuideTarget id="pf.sample">
      <BtnQuiet onPress={() => {
        if (S.demo) { leaveSampleMonths(); return; }
        enterSampleMonths();
        toast(t('demo_loaded'));
      }} style={{ minHeight: 48 }}>
        <IcLab name="book"><P style={{ fontSize: 15 }}>{t(S.demo ? 'demo_clear' : 'demo_load')}</P></IcLab>
      </BtnQuiet>
      </GuideTarget>
      <GuideTarget id="pf.notif" style={{ gap: 7 }}>
        <BodyS muted>{t('nt_title')}</BodyS>
        <View style={st.mocard}>
          {notificationSwitch('income', t('nt_income'))}
          {notificationSwitch('expenses', t('nt_expenses'))}
        </View>
        <BodyS muted>{t('nt_optional')}</BodyS>
        {S.notificationPreferences.permission_asked && !S.notificationPreferences.permission_granted ? (
          <BodyS muted>{t(Platform.OS === 'android' ? 'nt_denied_android' : Platform.OS === 'ios' ? 'nt_denied_ios' : 'nt_denied')}</BodyS>
        ) : null}
      </GuideTarget>
      {S.guest ? (
        <GuideTarget id="pf.recordg" style={st.mocard}>
          <Pressable onPress={() => setDeleteConfirmOpen(true)} style={st.morow}>
            <IcLab name="ring">
              <P style={{ fontSize: 15, color: C.ink }}>{t('pf_delete_guest')}</P>
            </IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
        </GuideTarget>
      ) : (
        <GuideTarget id="pf.record" style={st.mocard}>
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
          <Pressable onPress={() => setExportConfirmOpen(true)} style={[st.morow, st.morowLine]}>
            <IcLab name="book"><P style={{ fontSize: 15 }}>{t('pf_export')}</P></IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
          <Pressable onPress={() => setDeleteConfirmOpen(true)} style={[st.morow, st.morowLine]}>
            <IcLab name="ring">
              <P style={{ fontSize: 15, color: C.ink }}>{t('pf_delete')}</P>
            </IcLab>
            <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
          </Pressable>
        </GuideTarget>
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
      <Modal transparent visible={exportConfirmOpen} animationType="fade" onRequestClose={() => setExportConfirmOpen(false)}>
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>{t('pf_export_title')}</Text>
            <Text style={st.modalBody}>{t('pf_export_body')}</Text>
            <Pressable
              style={[st.modalPrimary, exporting && { opacity: 0.72 }]}
              disabled={exporting}
              onPress={() => { void downloadExport(); }}
            >
              <Text style={st.modalPrimaryText}>{exporting ? t('pf_exporting') : t('pf_export_confirm')}</Text>
            </Pressable>
            <Pressable
              style={st.modalSecondary}
              disabled={exporting}
              onPress={() => setExportConfirmOpen(false)}
            >
              <Text style={st.modalSecondaryText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={deleteConfirmOpen} animationType="fade" onRequestClose={() => setDeleteConfirmOpen(false)}>
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>{t(S.guest ? 'pf_delete_guest_title' : 'pf_delete_title')}</Text>
            <Text style={st.modalBody}>{t(S.guest
              ? (Platform.OS === 'web' ? 'pf_delete_guest_body' : 'pf_delete_guest_body_native')
              : 'pf_delete_body')}</Text>
            <Text style={st.modalBody}>{t('pf_delete_backup')}</Text>
            {shouldOfferDeleteExport ? (
              <Pressable
                style={[st.modalPrimary, exporting && { opacity: 0.72 }]}
                disabled={exporting || deleting}
                onPress={() => { void downloadExport({ closeExportConfirm: false }); }}
              >
                <Text style={st.modalPrimaryText}>{exporting ? t('pf_exporting') : t('pf_export')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[st.modalDanger, deleting && { opacity: 0.72 }]}
              disabled={exporting || deleting}
              onPress={() => { void deleteRecord(); }}
            >
              <Text style={st.modalDangerText}>{deleting ? t('pf_deleting') : t(S.guest ? 'pf_delete_guest' : 'pf_delete')}</Text>
            </Pressable>
            <Pressable
              style={st.modalCancel}
              disabled={exporting || deleting}
              onPress={() => setDeleteConfirmOpen(false)}
            >
              <Text style={st.modalCancelText}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={logoutConfirmOpen} animationType="fade" onRequestClose={() => setLogoutConfirmOpen(false)}>
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>{t('pf_logout_title')}</Text>
            <Text style={st.modalBody}>{t(Platform.OS === 'web' ? 'pf_logout_body' : 'pf_logout_body_native')}</Text>
            <Pressable
              style={[st.modalPrimary, loggingOut && { opacity: 0.72 }]}
              disabled={loggingOut}
              onPress={() => {
                if (loggingOut) return;
                setLoggingOut(true);
                void signOut().catch(() => setLoggingOut(false));
              }}
            >
              <Text style={st.modalPrimaryText}>{loggingOut ? t('pf_logout_loading') : t('pf_logout_confirm')}</Text>
            </Pressable>
            <Pressable
              style={st.modalSecondary}
              disabled={loggingOut}
              onPress={() => setLogoutConfirmOpen(false)}
            >
              <Text style={st.modalSecondaryText}>{t('pf_logout_stay')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!S.guest ? (
        <Pressable
          disabled={loggingOut}
          onPress={() => {
            if (loggingOut) return;
            setLogoutConfirmOpen(true);
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
      <ReminderSheet kind={reminderKind} onClose={() => setReminderKind(null)} />
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
  modalDanger: { minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.short, paddingHorizontal: 16 },
  modalDangerText: { fontFamily: DISP_FONT, fontSize: 14.5, color: '#fff', textAlign: 'center' },
  modalCancel: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontFamily: BODY_FONT, fontSize: 13, color: C.ink40 },
  switchTrack: {
    width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center',
    backgroundColor: C.ink14, alignItems: 'flex-start',
  },
  switchTrackOn: { backgroundColor: C.brand, alignItems: 'flex-end' },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  switchThumbOn: { backgroundColor: '#fff' },
});
