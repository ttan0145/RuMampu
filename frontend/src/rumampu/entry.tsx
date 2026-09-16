import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import {
  ApiAuthResponse, ApiError, completeAccountOnboarding, confirmPasswordReset, fetchGuestTransferStatus, fetchIncomeRecord, login as loginRequest, register as registerRequest, requestPasswordReset, resolveGuestTransfer, rotateGuestClientId, savePreferredLanguage,
} from './api';
import { lastMonthIso, resetGuestIdentityForStartFreshAccount, useApp, type KeptTest } from './state';
import { createSavedHousingTest, fetchSavedHousingTests } from '../../services/housingService';
import { SavedHousingTestRecord } from '../../types/housing';
import { BODY_FONT, C, DISP_FONT } from './theme';
import { Ruma, RumaFlat } from './ruma-view';
import { BodyS } from './ui';

/* Account-first entry flow:
   1. log in / create account, 2. choose a language for a new account,
   3. meet Ruma, then the short get-to-know flow. Returning accounts whose
   onboarding is complete skip all three onboarding screens. */

/* ---------- shared bits ---------- */

function KProg({ total, on }: { total: number; on: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < on ? C.brand : C.ink14 }} />
      ))}
    </View>
  );
}

function IconBtn({ label, onPress, light }: { label: string; onPress: () => void; light?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{
      minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
      backgroundColor: light ? 'rgba(255,255,255,0.16)' : 'transparent',
    }}>
      <Text style={{ fontSize: 20, color: light ? '#fff' : C.ink }}>{label}</Text>
    </Pressable>
  );
}

/* ---------- step 1+2 cards ---------- */

const FEAT_ICO: Record<string, string> = {
  ledger: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 3.5v17"/><path d="M12.5 8.5h3.5M12.5 12h3.5"/>',
  house: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="m9.3 14.8 2 2 3.6-4.2"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z"/><path d="m9.3 11.8 2 2 3.4-4"/>',
};

function featXml(name: string): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${FEAT_ICO[name]}</svg>`;
}

function Feat({ ico, title, desc }: { ico: string; title: string; desc: string }) {
  return (
    <View style={st.feat}>
      <View style={st.featico}><SvgXml xml={featXml(ico)} width={22} height={22} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, lineHeight: 18, color: C.ink }}>{title}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 16, color: C.ink64, marginTop: 2 }}>{desc}</Text>
      </View>
    </View>
  );
}

/* ---------- the auth field ---------- */

function AuthField({ label, icon, value, onChangeText, placeholder, secure, showLabel, hideLabel }: {
  label: string; icon: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  secure?: boolean; showLabel?: string; hideLabel?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64 }}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <Text style={{ position: 'absolute', left: 12, top: 13, fontSize: 15, opacity: 0.55, zIndex: 2 }}>{icon}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.ink40}
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          style={st.authInput}
        />
        {secure && showLabel ? (
          <Pressable onPress={() => setShow(v => !v)} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 12, color: '#2E6B6F', textDecorationLine: 'underline' }}>
              {show ? (hideLabel || showLabel) : showLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function BtnP({ label, onPress, loading = false }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [st.btnp, (pressed || loading) && { opacity: 0.72 }]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: '#fff' }}>{label}</Text>}
    </Pressable>
  );
}

function BtnO({ label, prefix, onPress }: { label: string; prefix?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.btno, pressed && { backgroundColor: '#F3F6F5' }]}>
      {prefix ? <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{prefix}</Text> : null}
      <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{label}</Text>
    </Pressable>
  );
}

function LineBtn({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: small ? 30 : 36, justifyContent: 'center' }}>
      <Text style={{
        fontFamily: BODY_FONT, fontSize: small ? 12.5 : 13.5, color: C.ink,
        textDecorationLine: 'underline', textDecorationColor: C.brand,
      }}>{label}</Text>
    </Pressable>
  );
}

function AuthLanguageButton({ onPress }: { onPress: () => void }) {
  const { S } = useApp();
  const label = S.lang === 'ms' ? 'Bahasa Melayu' : S.lang === 'zh' ? '中文' : 'English';
  return (
    <Pressable onPress={onPress} style={st.authLangBtn}>
      <Text style={st.authLangText}>{label}</Text>
    </Pressable>
  );
}

function savedTestSignature(input: {
  scenarioId?: number | null;
  name?: string;
  monthlyPayment: number;
  shortMonthCount: number;
  testedMonths: number;
  largestGap: number;
  incomeShockPercent?: number;
  result?: unknown;
}): string {
  return JSON.stringify({
    scenarioId: input.scenarioId ?? null,
    name: input.name || '',
    monthlyPayment: Math.round(Number(input.monthlyPayment) || 0),
    shortMonthCount: Number(input.shortMonthCount) || 0,
    testedMonths: Number(input.testedMonths) || 0,
    largestGap: Math.round(Number(input.largestGap) || 0),
    incomeShockPercent: Number(input.incomeShockPercent) || 0,
    result: input.result || {},
  });
}

function signatureFromRecord(record: SavedHousingTestRecord): string {
  return savedTestSignature({
    scenarioId: record.scenario_id,
    name: record.name,
    monthlyPayment: Number(record.monthly_payment),
    shortMonthCount: Number(record.short_month_count),
    testedMonths: Number(record.tested_months),
    largestGap: Number(record.largest_gap),
    incomeShockPercent: Number(record.income_shock_percent),
    result: record.result,
  });
}

function signatureFromKept(test: KeptTest): string {
  return savedTestSignature({
    scenarioId: test.scenarioId,
    name: test.name,
    monthlyPayment: test.pay,
    shortMonthCount: test.s,
    testedMonths: test.n,
    largestGap: test.g,
    incomeShockPercent: test.incomeShockPercent,
    result: test.result,
  });
}

async function persistGuestSavedTests(tests: KeptTest[]): Promise<void> {
  const guestTests = tests.filter(test => !test.id && test.result && test.scenarioId);
  if (!guestTests.length) return;

  const existing = await fetchSavedHousingTests();
  const seen = new Set(existing.map(signatureFromRecord));
  for (const test of guestTests) {
    const signature = signatureFromKept(test);
    if (seen.has(signature)) continue;
    const record = await createSavedHousingTest({
      name: test.name,
      scenario_id: test.scenarioId || undefined,
      monthly_payment: Math.round(Number(test.pay) || 0),
      short_month_count: Number(test.s) || 0,
      tested_months: Number(test.n) || 0,
      largest_gap: Math.round(Number(test.g) || 0),
      income_shock_percent: Number(test.incomeShockPercent) || 0,
      result: test.result as any,
    });
    seen.add(signatureFromRecord(record));
  }
}

/* ---------- the entry flow ---------- */

export function EntryFlow() {
  const { S, t, up } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ uid?: string | string[]; token?: string | string[] }>();
  const resetUid = Array.isArray(params.uid) ? params.uid[0] : params.uid;
  const resetToken = Array.isArray(params.token) ? params.token[0] : params.token;

  // A link from the password-reset email opens this screen directly.
  if (resetUid && resetToken) {
    return <AuthStep resetUid={resetUid} resetToken={resetToken} />;
  }

  if (S.wstep === 0) {
    // Authentication comes first so onboarding choices can be persisted to the account.
    return <AuthStep />;
  }

  /* First-time setup step 1 — explain what RuMampu does. */
  return (
    <View style={[st.wpage, { paddingTop: 20 + insets.top, paddingBottom: 22 + insets.bottom }]}>
      <KProg total={3} on={1} />
      <View style={{ minHeight: 40, justifyContent: 'center' }}>
        <Text style={st.stepText}>{t('wf_step', { n: 1 })}</Text>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Ruma w={172} pose="happy" />
        <View style={{ alignItems: 'center' }}>
          <Text style={st.hL}>{t('wf_title')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 16, lineHeight: 24, color: C.ink64, maxWidth: 280, marginTop: 4, textAlign: 'center' }}>
            {t('wf_blend').replace(/<[^>]+>/g, '')}
          </Text>
        </View>
        <View style={{ width: '100%', maxWidth: 330, gap: 8 }}>
          <Feat ico="ledger" title={t('wf_f1t')} desc={t('wf_f1d')} />
          <Feat ico="house" title={t('wf_f2t')} desc={t('wf_f2d')} />
          <Feat ico="shield" title={t('wf_f3t')} desc={t('wf_f3d')} />
        </View>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 16, color: C.ink40, textAlign: 'center' }}>{t('wf_copy')}</Text>
      </ScrollView>
      <Pressable onPress={() => up(state => { state.onboarded = true; state.knew = false; state.kstep = 1; state.wstep = 0; })} style={st.btn}>
        <Text style={st.btnTxt}>{t('wf_next')}</Text>
      </Pressable>
    </View>
  );
}

function AccountLoadingScreen({
  progress,
  stage,
  error,
  onRetry,
  onLogout,
}: {
  progress: number;
  stage: string;
  error?: string;
  onRetry: () => void;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <View style={[st.accountLoadingPage, { paddingTop: 28 + insets.top, paddingBottom: 28 + insets.bottom }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <Ruma w={190} pose="count" />
        <Text style={st.accountLoadingTitle}>Getting RuMampu ready</Text>
        <Text style={st.accountLoadingSub}>
          {error ? 'We could not finish loading your account.' : stage}
        </Text>

        <View style={st.loadingCard}>
          <View style={st.loadingTrack}>
            <View style={[st.loadingFill, { width: `${safeProgress}%` }]} />
          </View>
          <View style={st.loadingRow}>
            <Text style={st.loadingStage}>{error ? 'Loading paused' : stage}</Text>
            <Text style={st.loadingPercent}>{safeProgress}%</Text>
          </View>
        </View>

        {error ? (
          <View style={{ width: '100%', maxWidth: 340, marginTop: 18, gap: 10 }}>
            <Text style={st.authError}>{error}</Text>
            <BtnP label="Try again" onPress={onRetry} />
            <BtnO label="Log out" onPress={onLogout} />
          </View>
        ) : (
          <ActivityIndicator style={{ marginTop: 20 }} color={C.brand} />
        )}
      </View>
    </View>
  );
}

function AuthStep({ resetUid, resetToken }: { resetUid?: string; resetToken?: string }) {
  const { S, t, up, refreshAccountData, enterGuestMode, signOut } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [resetDone, setResetDone] = React.useState(false);
  const [accountLoading, setAccountLoading] = React.useState(false);
  const [accountProgress, setAccountProgress] = React.useState(0);
  const [accountStage, setAccountStage] = React.useState('Signing you in...');
  const [accountLoadError, setAccountLoadError] = React.useState('');
  const [pendingAuth, setPendingAuth] = React.useState<ApiAuthResponse | null>(null);
  const [pendingLoadBeforeOnboarding, setPendingLoadBeforeOnboarding] = React.useState(false);
  const forcedReset = Boolean(resetUid && resetToken);
  const login = !forcedReset && S.authMode === 'login';
  const amode: 'login' | 'signup' | 'forgot' | 'checkmail' | 'reset' = forcedReset ? 'reset' : S.authMode;

  React.useEffect(() => { setAuthError(''); }, [amode]);

  const finishAuthenticatedEntry = async (
    auth: ApiAuthResponse,
    options: { loadBeforeOnboarding?: boolean; loadingStage?: string } = {},
  ) => {
    const loadBeforeOnboarding = Boolean(options.loadBeforeOnboarding);

    // Authentication and account loading are deliberately separate. Returning
    // accounts load their dashboard immediately. If a guest has just chosen to
    // keep their data during sign-up, we also show the loading screen once so
    // the claimed guest data is prepared before continuing onboarding.
    up(s => {
      s.guest = false;
      s.accountLastExportedAt = auth.last_record_exported_at;
      s.authEntryOpen = false;
      s.acctMade = false;
      s.knew = auth.onboarding_completed;
      s.kstep = 0;
      if (auth.preferred_language) s.lang = auth.preferred_language;

      if (!auth.onboarding_completed) {
        s.onboarded = false;
        s.wstep = 1;
      }
    });

    if (!auth.onboarding_completed && !loadBeforeOnboarding) return;

    setPendingAuth(auth);
    setPendingLoadBeforeOnboarding(loadBeforeOnboarding);
    setAccountLoading(true);
    setAccountLoadError('');
    setAccountProgress(10);
    setAccountStage(options.loadingStage || (loadBeforeOnboarding ? 'Keeping your guest data...' : 'Signed in successfully'));

    try {
      await refreshAccountData((progress, stage) => {
        setAccountProgress(progress);
        setAccountStage(stage);
      });

      up(s => {
        s.guest = false;
        s.accountLastExportedAt = auth.last_record_exported_at;
        s.authEntryOpen = false;
        if (auth.onboarding_completed) {
          s.knew = true;
          s.onboarded = true;
          s.wstep = 0;
        } else {
          // The account is new, so after loading the claimed guest data we
          // continue the normal first-time onboarding flow.
          s.knew = false;
          s.onboarded = false;
          s.kstep = 0;
          s.wstep = 1;
        }
        if (auth.preferred_language) s.lang = auth.preferred_language;
      });

      setAccountLoading(false);
      setPendingAuth(null);
      setPendingLoadBeforeOnboarding(false);
    } catch (error) {
      setAccountLoadError(error instanceof ApiError
        ? error.message
        : 'Could not finish loading your RuMampu account.');
    }
  };

  const retryAccountLoad = async () => {
    if (!pendingAuth) return;
    setAccountLoadError('');
    setAccountProgress(10);
    setAccountStage('Trying again...');
    await finishAuthenticatedEntry(pendingAuth, {
      loadBeforeOnboarding: pendingLoadBeforeOnboarding,
    });
  };

  const logoutFromLoading = async () => {
    await signOut();
    setAccountLoading(false);
    setPendingAuth(null);
    setPendingLoadBeforeOnboarding(false);
    setAccountLoadError('');
    setAccountProgress(0);
  };

  if (accountLoading) {
    return (
      <AccountLoadingScreen
        progress={accountProgress}
        stage={accountStage}
        error={accountLoadError}
        onRetry={() => void retryAccountLoad()}
        onLogout={() => void logoutFromLoading()}
      />
    );
  }

  const authGo = async () => {
    if (authLoading) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !pw) {
      setAuthError('Enter your email and password.');
      return;
    }
    if (amode === 'signup') {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
      if (!emailOk) {
        setAuthError('Enter a valid email address.');
        return;
      }
      if (pw.length < 8) {
        setAuthError('Password must be at least 8 characters.');
        return;
      }
      if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
        setAuthError('Password must include at least one letter and one number.');
        return;
      }
      if (pw !== pw2) {
        setAuthError('Passwords do not match.');
        return;
      }
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const mergeGuestData = amode === 'signup' && S.mergeGuestOnSignup;
      const discardGuestData = amode === 'signup' && S.discardGuestOnSignup;
      const guestSavedTests = mergeGuestData
        ? S.keptTests.map(test => JSON.parse(JSON.stringify(test)) as KeptTest)
        : [];
      let auth = amode === 'signup'
        ? await registerRequest(cleanEmail, pw, mergeGuestData)
        : await loginRequest(cleanEmail, pw);
      if (!auth.onboarding_completed && !auth.preferred_language) {
        const updatedAuth = await savePreferredLanguage(S.lang);
        auth = { ...auth, ...updatedAuth };
      }
      if (mergeGuestData) {
        if (guestSavedTests.length) await persistGuestSavedTests(guestSavedTests);
        up(s => {
          s.keptTests = [];
          s.mergeGuestOnSignup = false;
          s.discardGuestOnSignup = false;
        });
        await finishAuthenticatedEntry(auth, { loadBeforeOnboarding: true });
        return;
      }
      if (discardGuestData) {
        up(resetGuestIdentityForStartFreshAccount);
        if (!auth.onboarding_completed) {
          const updatedAuth = await completeAccountOnboarding();
          auth = { ...auth, ...updatedAuth, onboarding_completed: true };
        }
        up(s => {
          s.mergeGuestOnSignup = false;
          s.discardGuestOnSignup = false;
        });
        await finishAuthenticatedEntry(auth, { loadBeforeOnboarding: true, loadingStage: 'Starting your fresh account...' });
        return;
      }
      await finishAuthenticatedEntry(auth);
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Could not reach the RuMampu backend.');
    } finally {
      setAuthLoading(false);
    }
  };

  const sendResetLink = async () => {
    if (authLoading) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setAuthError('Enter your email address.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await requestPasswordReset(cleanEmail);
      up(s => {
        s.fgMail = cleanEmail;
        s.authMode = 'checkmail';
      });
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Could not reach the RuMampu backend.');
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPasswordGo = async () => {
    if (authLoading || !resetUid || !resetToken) return;
    if (pw.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      setAuthError('Password must include at least one letter and one number.');
      return;
    }
    if (pw !== pw2) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await confirmPasswordReset(resetUid, resetToken, pw);
      setResetDone(true);
    } catch (error) {
      setAuthError(error instanceof ApiError ? error.message : 'Could not reach the RuMampu backend.');
    } finally {
      setAuthLoading(false);
    }
  };

  const leaveReset = () => {
    up(s => { s.authMode = 'login'; s.wstep = 0; s.authEntryOpen = false; });
    router.replace('/');
  };

  const leaveAuthEntry = () => {
    up(s => {
      s.authEntryOpen = false;
      s.authMode = 'login';
      s.mergeGuestOnSignup = false;
      s.discardGuestOnSignup = false;
    });
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 50, backgroundColor: '#4C8388' }]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 + insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {!login ? (
            <IconBtn light label="←" onPress={() => {
              if (S.authEntryOpen) leaveAuthEntry();
              else up(s => { s.authMode = 'login'; });
            }} />
          ) : <View style={{ width: 44, height: 44 }} />}
          {!forcedReset ? <AuthLanguageButton onPress={() => up(s => { s.sheet = 'lang'; })} /> : <View style={{ width: 44, height: 44 }} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingBottom: 26 }}>
            {login ? (
              <>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: '#fff', marginTop: 2 }}>RuMampu</Text>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 30, color: '#fff', marginTop: 14 }}>{t('au_hello')}</Text>
                <Text style={st.authTag}>{t('ob_slogan')}</Text>
              </>
            ) : amode === 'reset' ? (
              <>
                <Text style={st.authTitle}>Set a new password</Text>
                <Text style={st.authTag}>Choose a new password for your RuMampu account.</Text>
              </>
            ) : amode === 'forgot' ? (
              <>
                <Text style={st.authTitle}>{t('fg_title')}</Text>
                <Text style={st.authTag}>{t('fg_tag')}</Text>
              </>
            ) : amode === 'checkmail' ? (
              <>
                <Text style={st.authTitle}>{t('cm_title')}</Text>
                <Text style={st.authTag}>{t('cm_tag')}</Text>
              </>
            ) : (
              <>
                <Text style={st.authTitle}>{t('au_create')}</Text>
                <Text style={st.authTag}>{t('au_ctag')}</Text>
              </>
            )}
          </View>
          <View style={{ marginBottom: -34, marginRight: -8, zIndex: 1 }}>
            <RumaFlat mood={login ? 'waving' : 'curious'} w={176} />
          </View>
        </View>
      </View>
      <View style={st.sheet2}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}>
          {amode === 'reset' ? (
            <View style={{ gap: 10 }}>
              <Text style={st.h2}>{resetDone ? 'Password changed' : 'Set a new password'}</Text>
              {resetDone ? (
                <>
                  <View style={st.okbanner}>
                    <Text style={{ fontFamily: BODY_FONT, fontSize: 13, fontWeight: '600', color: '#1E7A34', textAlign: 'center' }}>
                      ✓ Your password has been reset successfully.
                    </Text>
                  </View>
                  <BodyS muted>Use your new password the next time you log in.</BodyS>
                  <BtnP label="Back to log in" onPress={leaveReset} />
                </>
              ) : (
                <>
                  <BodyS muted>Enter a new password with at least 8 characters, including a letter and a number.</BodyS>
                  <AuthField label="New password" icon="🔒" value={pw} onChangeText={setPw} placeholder="At least 8 characters" secure showLabel={t('au_show')} hideLabel={t('au_hide')} />
                  <AuthField label="Confirm new password" icon="🔒" value={pw2} onChangeText={setPw2} placeholder="Enter it again" secure />
                  {authError ? <Text style={st.authError}>{authError}</Text> : null}
                  <BtnP label="Reset password" onPress={() => void resetPasswordGo()} loading={authLoading} />
                </>
              )}
            </View>
          ) : amode === 'forgot' ? (
            <View style={{ gap: 10 }}>
              <Text style={st.h2}>{t('fg_title')}</Text>
              <BodyS muted>{t('fg_hint')}</BodyS>
              <AuthField label={t('au_email')} icon="✉" value={email} onChangeText={setEmail} placeholder={t('au_eph')} />
              {authError ? <Text style={st.authError}>{authError}</Text> : null}
              <BtnP label={t('fg_send')} onPress={() => void sendResetLink()} loading={authLoading} />
              <View style={{ alignItems: 'center' }}>
                <LineBtn label={t('cm_back')} onPress={() => up(s => { s.authMode = 'login'; })} />
              </View>
            </View>
          ) : amode === 'checkmail' ? (
            <View style={{ gap: 10 }}>
              <Text style={st.h2}>{t('cm_title')}</Text>
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.confirm, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 26 }}>✓</Text>
                </View>
              </View>
              <BodyS style={{ textAlign: 'center' }}>{t('cm_body', { e: S.fgMail || 'you@example.com' })}</BodyS>
              {authError ? <Text style={st.authError}>{authError}</Text> : null}
              <LineBtn label={t('cm_resend')} onPress={() => void sendResetLink()} />
              <BtnP label={t('cm_back')} onPress={() => up(s => { s.authMode = 'login'; })} />
            </View>
          ) : login ? (
            <View style={{ gap: 10 }}>
              {S.acctMade ? (
                <View style={st.okbanner}><Text style={{ fontFamily: BODY_FONT, fontSize: 13, fontWeight: '600', color: '#1E7A34', textAlign: 'center' }}>✓ {t('au_made')}</Text></View>
              ) : null}
              <Text style={st.h2}>{t('au_login')}</Text>
              <AuthField label={t('au_email')} icon="✉" value={email} onChangeText={setEmail} placeholder={t('au_eph')} />
              <AuthField label={t('au_pw')} icon="🔒" value={pw} onChangeText={setPw} placeholder={t('au_pph')} secure showLabel={t('au_show')} hideLabel={t('au_hide')} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <LineBtn small label={t('au_mailhow')} onPress={() => up(s => { s.sheet = 'mailhow'; })} />
                <LineBtn small label={t('au_forgot')} onPress={() => up(s => { s.authMode = 'forgot'; })} />
              </View>
              {authError ? <Text style={st.authError}>{authError}</Text> : null}
              <BtnP label={t('au_login')} onPress={() => void authGo()} loading={authLoading} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                <Text style={st.authfoot}>{t('au_new')}</Text>
                <LineBtn label={t('au_createbtn')} onPress={() => up(s => { s.authMode = 'signup'; })} />
              </View>
              <View style={st.demobox}>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink40, textAlign: 'center', marginBottom: 6 }}>{t('au_guestnote')}</Text>
                <View style={{ alignItems: 'center' }}>
                  <LineBtn label={t('au_guest')} onPress={() => up(s2 => { s2.sheet = 'guestsure'; })} />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <AuthField label={t('au_email')} icon="✉" value={email} onChangeText={setEmail} placeholder={t('au_eph')} />
              <AuthField label={t('au_pw')} icon="🔒" value={pw} onChangeText={setPw} placeholder={t('au_p8')} secure showLabel={t('au_show')} hideLabel={t('au_hide')} />
              <AuthField label={t('au_cpw')} icon="🔒" value={pw2} onChangeText={setPw2} placeholder={t('au_again')} secure />
              <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink40 }}>{t('au_mix')}</Text>
              <LineBtn small label={t('au_mailhow')} onPress={() => up(s => { s.sheet = 'mailhow'; })} />
              {authError ? <Text style={st.authError}>{authError}</Text> : null}
              <BtnP label={t('au_createacct')} onPress={() => void authGo()} loading={authLoading} />
              <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink40, textAlign: 'center' }}>{t('au_mailonly')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                <Text style={st.authfoot}>{t('au_have')}</Text>
                <LineBtn label={t('au_login')} onPress={() => up(s => { s.authMode = 'login'; })} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <LineBtn label={t('au_guest2')} onPress={() => up(s2 => { s2.sheet = 'guestsure'; })} />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/* ---------- getting to know you ---------- */

const JOB_ART: Record<string, string> = {
  deliv: '<circle cx="7" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M7 17l3.5-7H15l3 7"/><rect x="13" y="4" width="7" height="5" rx="1"/><path d="M10 10h5"/>',
  taxi: '<path d="M4 15.5 5.5 10h13l1.5 5.5"/><rect x="3" y="15.5" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/><path d="M9 10V7.5h6V10"/>',
  free: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/><path d="M9 8.5l-2 2 2 2M15 8.5l2 2-2 2"/>',
  bar: '<path d="M5 4h14l-7 8z"/><path d="M12 12v7M8 19h8"/><path d="M7 7h10"/>',
  own: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
};

const JOB_BG: Record<string, string> = { deliv: '#C3E4F4', taxi: '#CBC8F1', free: '#BFE2D8', bar: '#F2D4E4' };

function JobTile({ id, bg, label, on, onPress }: { id: string; bg: string; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.ktile, { backgroundColor: bg }, on && { borderColor: C.ink }]}>
      {on ? (
        <View style={st.ktileTick}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text></View>
      ) : null}
      <View style={{ position: 'absolute', right: -16, top: -14, opacity: 0.26 }}>
        <SvgXml xml={`<svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${C.ink}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${JOB_ART[id] || JOB_ART.own}</svg>`} width={96} height={96} />
      </View>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 19, color: C.ink }}>{label}</Text>
    </Pressable>
  );
}

export function GetToKnow() {
  const { S, t, up, toast, saveIncomeEntry, updateIncomeEntry, saveIncomeSource, refreshAccountData } = useApp();
  const insets = useSafeAreaInsets();
  const [amt, setAmt] = React.useState(S.lastMonth || '');
  const [finishError, setFinishError] = React.useState('');
  const [finishing, setFinishing] = React.useState(false);
  const [finishProgress, setFinishProgress] = React.useState(20);
  const [finishStage, setFinishStage] = React.useState('Saving your details...');
  const step = S.kstep === 2 ? 2 : 1;

  const ensureOnboardingSources = async (): Promise<string | undefined> => {
    const known: Record<string, string> = { taxi: 'ehail', free: 'freelance' };
    const custom: Record<string, string> = { deliv: t('k_j_deliv'), bar: t('k_j_bar') };
    const pickedIds: string[] = [];
    const existingByName = (name: string) => S.data.sources.find(source => (
      (source.name || t(source.k || '')).trim().toLowerCase() === name.trim().toLowerCase()
    ));

    for (const job of S.jobs) {
      const slug = known[job];
      if (slug) {
        const source = S.data.sources.find(item => item.k === `src_${slug}` || item.id === slug);
        if (source) pickedIds.push(source.id);
        continue;
      }

      const own = S.ownJobs.find(item => item.id === job);
      const name = own?.name || custom[job];
      if (!name) continue;
      const existing = existingByName(name);
      pickedIds.push(existing ? existing.id : await saveIncomeSource(name));
    }

    up(s => {
      const picked = pickedIds
        .map(id => s.data.sources.find(source => source.id === id))
        .filter(Boolean) as typeof s.data.sources;
      s.data.sources = picked.concat(s.data.sources.filter(source => !pickedIds.includes(source.id)));
      if (pickedIds[0]) s.incomeDraft.s = pickedIds[0];
    });

    return pickedIds[0];
  };

  const finish = async (save: boolean) => {
    if (finishing) return;

    /* The placeholder reads "e.g. 3,000", and web and Android keypads offer a
       comma, so "3,000" must mean three thousand, not three (parseFloat stops
       at the comma). Thousands separators and spaces are not part of the number. */
    const amount = save ? (parseFloat(String(amt).replace(/[,\s]/g, '')) || 0) : 0;
    const showLoading = S.guest && step >= 2;
    setFinishError('');
    if (showLoading) {
      setFinishing(true);
      setFinishProgress(20);
      setFinishStage('Saving your details...');
    }

    // Keep the user's setup choices in local state immediately, but do not mark
    // onboarding as complete until the final save attempt has finished. This
    // allows the guest loading screen to remain visible while the request runs.
    up(s => {
      if (save) s.lastMonth = amt;
      s.sheet = null;
    });

    /* Two independent steps, each judged on its own: the note about last
       month's income reflects only the income write, never the completion
       flag or the hand-off to Home that follow it (a failed completion call
       used to surface as 'income could not be saved'). */
    let incomeFailed = false;
    if (save && amount > 0) {
      if (showLoading) {
        setFinishProgress(45);
        setFinishStage('Saving your previous month income...');
      }
      try {
        const targetDate = lastMonthIso();
        /* Decide against the LIVE record, not the local copy, which can still
           be empty right after a login or a guest start. The figure is kept as
           last month's total: a month may hold a total alongside itemised
           entries and they add up, and a second run of setup replaces the
           total instead of doubling it. */
        const month = targetDate.slice(0, 7);
        const record = await fetchIncomeRecord();
        const existingTotal = record.entries.find(entry => (
          entry.entry_method === 'historical_total' && entry.date.slice(0, 7) === month
        ));
        if (existingTotal) {
          await updateIncomeEntry(String(existingTotal.id), { amount, date: targetDate });
        } else {
          await saveIncomeEntry({ amount, date: targetDate, entryMethod: 'historical_total', confirmOutlier: true });
        }
      } catch (error) {
        incomeFailed = true;
        console.error('Onboarding: last month income was not saved', error);
      }
    }

    if (save && amount > 0 && incomeFailed) {
      const message = t('k_save_failed');
      setFinishError(message);
      toast(message, 'error');
      setFinishing(false);
      return;
    }

    await ensureOnboardingSources();

    if (showLoading) {
      setFinishProgress(82);
      setFinishStage('Getting RuMampu ready...');
    }

    // Guests complete this flow locally. Registered users persist the
    // completion flag so future logins and app restarts skip these pages.
    if (!S.guest) {
      try {
        await completeAccountOnboarding();
      } catch (error) {
        console.error('Onboarding: completion flag not saved; the next login retries', error);
      }
      try {
        await refreshAccountData();
      } catch (error) {
        const message = error instanceof ApiError
          ? error.message
          : 'Could not finish loading your RuMampu account.';
        console.error('Onboarding: account record was not loaded', error);
        setFinishError(message);
        toast(message, 'error');
        setFinishing(false);
        return;
      }
    }

    // Give the guest a visible transition instead of instantly jumping from
    // the income question to Home after the network request completes.
    if (showLoading) {
      await new Promise(resolve => setTimeout(resolve, 350));
      setFinishProgress(100);
    }

    up(s => {
      s.knew = true;
      s.onboarded = true;
      s.sheet = null;
    });
    if (save && amount > 0 && incomeFailed) toast(t('k_save_failed'), 'error');
    else if (save) toast(t('k_saved'));
    setFinishing(false);
  };

  if (finishing) {
    return (
      <AccountLoadingScreen
        progress={finishProgress}
        stage={finishStage}
        onRetry={() => {}}
        onLogout={() => {}}
      />
    );
  }

  return (
    <View style={[st.kpage, { paddingTop: 18 + insets.top, paddingBottom: 18 + insets.bottom }]}>
      <KProg total={3} on={step + 1} />
      <View style={{ flexDirection: 'row', minHeight: 40, alignItems: 'center', justifyContent: 'space-between' }}>
        <IconBtn label="←" onPress={() => up(s => {
          if (step === 1) {
            s.onboarded = false;
            s.wstep = 1;
            return;
          }
          s.kstep = 1;
        })} />
        <Text style={st.stepText}>{t('wf_step', { n: step + 1 })}</Text>
        <LineBtn label={t('k_skip')} onPress={() => finish(false)} />
      </View>
      {finishError ? <Text style={st.authError}>{finishError}</Text> : null}
      {step === 1 ? (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 26, lineHeight: 32, color: C.ink, marginTop: 8 }}>{t('k_q1')}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 16, lineHeight: 24, color: C.ink64, marginTop: 6 }}>{t('k_q1h')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
              {(['deliv', 'taxi', 'free', 'bar'] as const).map(id => (
                <View key={id} style={{ width: '47%', flexGrow: 1 }}>
                  <JobTile id={id} bg={JOB_BG[id]} label={t('k_j_' + id)} on={S.jobs.includes(id)}
                    onPress={() => up(s => {
                      const i = s.jobs.indexOf(id);
                      if (i >= 0) s.jobs.splice(i, 1); else s.jobs.push(id);
                    })} />
                </View>
              ))}
              {S.ownJobs.map(j => (
                <View key={j.id} style={{ width: '47%', flexGrow: 1 }}>
                  <JobTile id="own" bg="#FBE9BF" label={j.name} on={S.jobs.includes(j.id)}
                    onPress={() => up(s => {
                      const i = s.jobs.indexOf(j.id);
                      if (i >= 0) s.jobs.splice(i, 1); else s.jobs.push(j.id);
                    })} />
                </View>
              ))}
              <Pressable onPress={() => up(s => { s.sheet = 'kjobown'; })} style={st.ktileOwn}>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 14.5, color: C.ink64 }}>＋ {t('k_own')}</Text>
              </Pressable>
            </View>
          </ScrollView>
          <Pressable onPress={() => up(s => { s.kstep = 2; })} style={st.kbtn}>
            <Text style={st.kbtnTxt}>{t('k_next')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontFamily: DISP_FONT, fontSize: 26, lineHeight: 32, color: C.ink, marginTop: 8 }}>{t('k_q2')}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 16, lineHeight: 24, color: C.ink64, marginTop: 6 }}>{t('k_q2h')}</Text>
            <View style={st.kbig}>
              <Ruma w={210} pose="count" />
              <View style={{ position: 'relative', width: '100%' }}>
                <Text style={{ position: 'absolute', left: 14, top: 16, fontFamily: DISP_FONT, fontSize: 15, color: C.ink64, zIndex: 2 }}>RM</Text>
                <TextInput
                  value={amt}
                  onChangeText={setAmt}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder={t('k_ph')}
                  placeholderTextColor={C.ink40}
                  style={{
                    width: '100%', minHeight: 52, paddingLeft: 46, fontSize: 19,
                    fontFamily: DISP_FONT, color: C.ink,
                    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#DDE5E3', borderRadius: 14,
                  }}
                />
              </View>
            </View>
          </ScrollView>
          <Pressable onPress={() => finish(true)} style={st.kbtn}>
            <Text style={st.kbtnTxt}>{t('k_go')}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wpage: {
    ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: '#F7FAF9',
    paddingHorizontal: 22, flexDirection: 'column',
  },
  accountLoadingPage: {
    ...StyleSheet.absoluteFillObject, zIndex: 80, backgroundColor: '#F7FAF9',
    paddingHorizontal: 24,
  },
  accountLoadingTitle: {
    marginTop: 18, fontFamily: DISP_FONT, fontSize: 26, lineHeight: 32, color: C.ink, textAlign: 'center',
  },
  accountLoadingSub: {
    marginTop: 8, minHeight: 22, fontFamily: BODY_FONT, fontSize: 14, lineHeight: 20, color: C.ink64, textAlign: 'center',
  },
  loadingCard: {
    width: '100%', maxWidth: 340, marginTop: 24, padding: 18, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#DDE7E5',
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2,
  },
  loadingTrack: {
    width: '100%', height: 14, borderRadius: 8, backgroundColor: '#E6EFED', overflow: 'hidden',
  },
  loadingFill: {
    height: '100%', borderRadius: 8, backgroundColor: C.brand,
  },
  loadingRow: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  loadingStage: {
    flex: 1, fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64,
  },
  loadingPercent: {
    fontFamily: DISP_FONT, fontSize: 17, color: C.ink,
  },
  stepText: {
    fontFamily: BODY_FONT, fontSize: 12.5, fontWeight: '700', color: C.ink64, textAlign: 'center',
  },
  authLangBtn: {
    minHeight: 36, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  authLangText: {
    fontFamily: DISP_FONT, fontSize: 12.5, color: '#fff',
  },
  kpage: {
    ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: '#FBFCFC',
    paddingHorizontal: 22, flexDirection: 'column',
  },
  hL: { fontFamily: DISP_FONT, fontSize: 22, lineHeight: 28, color: C.ink },
  h2: { fontFamily: DISP_FONT, fontSize: 22, color: C.ink, marginBottom: 2 },
  langcard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', minHeight: 64,
    borderRadius: 20, paddingHorizontal: 18, backgroundColor: '#F3F7F6',
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  langcardOn: { backgroundColor: '#D3E7E5', borderWidth: 2.5, borderColor: C.brand },
  feat: {
    flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%',
    backgroundColor: '#F4F8F7', borderRadius: 18, paddingVertical: 13, paddingHorizontal: 15,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  featico: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: '#4A9195',
    alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    minHeight: 52, backgroundColor: C.brand, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  btnTxt: { color: '#fff', fontFamily: DISP_FONT, fontSize: 19 },
  authTitle: { fontFamily: DISP_FONT, fontSize: 24, lineHeight: 29, color: '#fff', marginTop: 14 },
  authTag: { fontFamily: BODY_FONT, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.88)', maxWidth: 168, marginTop: 2 },
  sheet2: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 20, zIndex: 2,
  },
  authInput: {
    width: '100%', minHeight: 44, backgroundColor: '#F6F8F7', borderWidth: 1.5, borderColor: '#DDE5E3',
    borderRadius: 12, fontSize: 15, paddingLeft: 38, paddingRight: 60, color: C.ink, fontFamily: BODY_FONT,
  },
  btnp: {
    width: '100%', minHeight: 44, backgroundColor: '#3F7A7E', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  btno: {
    width: '100%', minHeight: 44, borderWidth: 1.5, borderColor: '#D8E0DE', borderRadius: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff',
  },
  okbanner: {
    backgroundColor: '#E7F5EC', borderWidth: 1.5, borderColor: 'rgba(50,177,74,0.4)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 2,
  },
  authfoot: { fontFamily: BODY_FONT, fontSize: 13.5, color: C.ink64 },
  authError: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: '#B42318', backgroundColor: '#FEF3F2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  demobox: {
    borderWidth: 1.5, borderColor: '#D7E2E1', borderRadius: 12,
    paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, marginTop: 12,
  },
  kbtn: {
    width: '100%', minHeight: 56, backgroundColor: C.ink, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 14,
  },
  kbtnTxt: { fontFamily: DISP_FONT, fontSize: 14, letterSpacing: 1.96, color: '#fff', textTransform: 'uppercase' },
  ktile: {
    position: 'relative', overflow: 'hidden', minHeight: 118, borderRadius: 18, padding: 14,
    justifyContent: 'flex-end', borderWidth: 2.5, borderColor: 'transparent',
  },
  ktileTick: {
    position: 'absolute', left: 12, top: 12, width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  ktileOwn: {
    width: '100%', minHeight: 60, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed',
    borderColor: C.ink40, alignItems: 'center', justifyContent: 'center',
  },
  kbig: {
    marginTop: 18, backgroundColor: '#D3E8E9', borderWidth: 2.5, borderColor: C.ink,
    borderRadius: 22, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16,
    alignItems: 'center', gap: 14,
  },
});
