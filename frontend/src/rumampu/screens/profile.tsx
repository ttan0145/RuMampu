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
import { ChunkyBtn, HUE, Ph } from '../homepath';
import { ReminderSheet, useReminderSummary } from './reminder-sheet';
import type { RecordReminderKind } from '../reminder-date';

/* v22 profile tab: guest/signed hero, account rows, language, saved tests. */

const FLAGS: Record<string, string> = { en: '🇬🇧', ms: '🇲🇾', zh: '🇨🇳' };

/* A soft tinted square with its icon in colour, as on the Money list. */
const HUES = {
  teal: ['#11A09B', '#E2F5F2'], pink: ['#E8487A', '#FFE8EF'], gold: ['#D98E00', '#FFF4D6'],
  violet: ['#7C5CFF', '#EEEAFF'], blue: ['#2A9AC9', '#E1F2FA'], slate: ['#5B6B8C', '#E9EDF4'],
} as const;
function IcSq({ hue, icon, emoji }: { hue: keyof typeof HUES; icon?: string; emoji?: string }) {
  return (
    <View style={[st.icsq, { backgroundColor: HUES[hue][1] }]}>
      {emoji ? <Text style={{ fontSize: 18 }}>{emoji}</Text> : <Ph n={icon || 'info'} c={HUES[hue][0]} size={18} />}
    </View>
  );
}
function SecLbl({ children }: { children: string }) {
  return <Text style={st.seclbl}>{children.toUpperCase()}</Text>;
}
/* one tappable row: icon, label (and a line under it), caret */
function LinkRow({ hue, icon, label, sub, onPress, line, danger, testID }: {
  hue: keyof typeof HUES; icon: string; label: string; sub?: string; onPress: () => void; line?: boolean; danger?: boolean; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button"
      style={({ pressed }) => [st.morow, line && st.morowLine, pressed && { opacity: 0.7 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <IcSq hue={hue} icon={icon} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.rowTxt, danger && { color: '#C2365F' }]} numberOfLines={1}>{label}</Text>
          {sub ? <Text style={st.rowSub} numberOfLines={2}>{sub}</Text> : null}
        </View>
      </View>
      <Ph n="caret-right" c={C.ink40} size={16} />
    </Pressable>
  );
}

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
      <View key={kind} style={[st.morow, kind === 'expenses' && st.morowLine, { gap: 12 }]}>
        <IcSq hue={kind === 'income' ? 'teal' : 'pink'} icon={kind === 'income' ? 'coins' : 'receipt'} />
        <Pressable onPress={() => setReminderKind(kind)} accessibilityRole="button"
          accessibilityLabel={t('rm_edit', { n: label })} style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={st.rowTxt}>{label}</Text>
          {on && saved ? <Text style={st.rowSub}>{reminderSummary(saved)}</Text> : null}
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
        <View style={st.pfheroSun} pointerEvents="none" />
        <View style={st.pfheroBubble} pointerEvents="none" />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ruma w={88} pose="wave" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 21, lineHeight: 26, color: C.ink }}>
              {S.guest ? t('hd_guest') : t('hd_welcome')}
            </Text>
            <View style={[st.pfpill]}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: S.guest ? '#E0A800' : C.confirm }} />
              <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, fontWeight: '600', color: C.ink }}>
                {S.guest ? t('pf_guest_t') : t('pf_signed_t')}
              </Text>
            </View>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64, marginTop: 6 }}>
              {S.guest ? t(Platform.OS === 'web' ? 'pf_guest' : 'pf_guest_native') : t('pf_signed')}
            </Text>
          </View>
        </View>
        {S.guest ? (
          <View style={{ marginTop: 12 }}>
            <ChunkyBtn label={t('pf_create')} hue={HUE.tl} icon="sparkle" onPress={() => setSignupChoiceOpen(true)} testID="pf-signup" />
          </View>
        ) : null}
      </View>
      </GuideTarget>

      <SecLbl>{t('pf_sec_settings')}</SecLbl>
      <View style={st.mocard}>
        <Pressable onPress={() => up(s => { s.sheet = 'lang'; })} accessibilityRole="button"
          style={({ pressed }) => [st.morow, pressed && { opacity: 0.7 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <IcSq hue="blue" emoji={FLAGS[S.lang]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.rowTxt}>{t('pf_lang')}</Text>
              <Text style={st.rowSub}>{String(STRINGS[S.lang].langname)}</Text>
            </View>
          </View>
          <Ph n="caret-down" c={C.ink40} size={16} />
        </Pressable>
        {/* v27b: the invitation, the tour and the tips switch. Back on, every screen offers its tips again. */}
        <GuideTarget id="pf.tips" style={[st.morowLine, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 }]}>
          <IcSq hue="gold" icon="lightbulb" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <SwRow on={!S.tipsOff} label={t('pf_tips')} hint={t('pf_tips_h')}
              onPress={() => up(s => { s.tipsOff = !s.tipsOff; if (!s.tipsOff) s.seenG = []; })} />
          </View>
        </GuideTarget>
        {/* v27b: look around with sample months, or put your own record back */}
        <GuideTarget id="pf.sample">
          <LinkRow hue="violet" icon="notebook" line label={t(S.demo ? 'demo_clear' : 'demo_load')} onPress={() => {
            if (S.demo) { leaveSampleMonths(); return; }
            enterSampleMonths();
            toast(t('demo_loaded'));
          }} />
        </GuideTarget>
      </View>

      <GuideTarget id="pf.notif" style={{ gap: 8 }}>
        <SecLbl>{t('nt_title')}</SecLbl>
        <View style={st.mocard}>
          {notificationSwitch('income', t('nt_income'))}
          {notificationSwitch('expenses', t('nt_expenses'))}
        </View>
        <Text style={st.note}>{t('nt_optional')}</Text>
        {S.notificationPreferences.permission_asked && !S.notificationPreferences.permission_granted ? (
          <Text style={st.note}>{t(Platform.OS === 'android' ? 'nt_denied_android' : Platform.OS === 'ios' ? 'nt_denied_ios' : 'nt_denied')}</Text>
        ) : null}
      </GuideTarget>

      <SecLbl>{t('money_record')}</SecLbl>
      {S.guest ? (
        <GuideTarget id="pf.recordg" style={st.mocard}>
          <LinkRow hue="pink" icon="warning-circle" danger label={t('pf_delete_guest')} onPress={() => setDeleteConfirmOpen(true)} />
        </GuideTarget>
      ) : (
        <GuideTarget id="pf.record" style={st.mocard}>
          <LinkRow hue="teal" icon="info" label={t('pf_acct')} onPress={() => go('acctdetails')} />
          <LinkRow hue="slate" icon="lock-simple" line label={t('pf_pw')} onPress={() => go('acctdetails')} />
          <LinkRow hue="violet" icon="house-line" line label={t('sv_title')} onPress={() => go('savedtests')} />
          <LinkRow hue="blue" icon="arrow-down" line label={t('pf_export')} onPress={() => setExportConfirmOpen(true)} />
          <LinkRow hue="pink" icon="warning-circle" line danger label={t('pf_delete')} onPress={() => setDeleteConfirmOpen(true)} />
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
    backgroundColor: '#D7EFEC', borderRadius: 22, padding: 16, position: 'relative', overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#C3E4DF',
  },
  pfheroSun: { position: 'absolute', right: -14, top: -14, width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFD866' },
  icsq: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  seclbl: { fontFamily: BODY_FONT, fontSize: 12, fontWeight: '700', letterSpacing: 0.9, color: C.ink64, marginTop: 4, marginBottom: -2, paddingHorizontal: 2 },
  rowTxt: { fontFamily: BODY_FONT, fontSize: 15, fontWeight: '600', color: C.ink },
  rowSub: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64, marginTop: 1 },
  note: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64, paddingHorizontal: 2 },
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
    minHeight: 58, paddingHorizontal: 4, paddingVertical: 6,
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
