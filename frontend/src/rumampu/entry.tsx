import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { lastMonthIso, useApp } from './state';
import { BODY_FONT, C, DISP_FONT } from './theme';
import { Ruma, RumaFlat } from './ruma-view';
import { BodyS } from './ui';

/* v22 entry flow — three steps before the app:
   1. language, 2. meet Ruma, 3. log in / create account (flat, per the Figma
   frames). Then the short get-to-know flow (intro → job tiles → last-month
   income). Ported from the prototype's renderOverlay(). */

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

const LANGS: [string, string, string, string][] = [
  ['en', '🇬🇧', 'English', 'Continue in English'],
  ['ms', '🇲🇾', 'Bahasa Melayu', 'Teruskan dalam Bahasa Melayu'],
  ['zh', '🇨🇳', '中文', '以中文继续'],
];

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

function BtnP({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.btnp, pressed && { opacity: 0.88 }]}>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: '#fff' }}>{label}</Text>
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

/* ---------- the entry flow ---------- */

export function EntryFlow() {
  const { S, t, up } = useApp();
  const insets = useSafeAreaInsets();

  if (S.wstep === 0) {
    /* STEP 1 — language first */
    return (
      <View style={[st.wpage, { paddingTop: 20 + insets.top, paddingBottom: 22 + insets.bottom }]}>
        <KProg total={3} on={1} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Ruma w={148} pose="wave" />
          <Text style={[st.hL, { textAlign: 'center' }]}>{t('wf_langq')}</Text>
          <View style={{ width: '100%', gap: 8 }}>
            {LANGS.map(([code, flag, name, sub]) => {
              const on = S.lang === code;
              return (
                <Pressable key={code}
                  onPress={() => up(s => { s.lang = code as typeof s.lang; })}
                  style={[st.langcard, on && st.langcardOn]}>
                  <Text style={{ fontSize: 26 }}>{flag}</Text>
                  <View>
                    <Text style={{ fontFamily: DISP_FONT, fontSize: 17, color: C.ink }}>{name}</Text>
                    <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64 }}>{sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable onPress={() => up(s => { s.wstep = 1; })} style={st.btn}>
          <Text style={st.btnTxt}>{t('wf_next')}</Text>
        </Pressable>
      </View>
    );
  }

  if (S.wstep === 1) {
    /* STEP 2 — meet Ruma: commercial feature rows, drawn icons */
    return (
      <View style={[st.wpage, { paddingTop: 20 + insets.top, paddingBottom: 22 + insets.bottom }]}>
        <KProg total={3} on={2} />
        <View style={{ flexDirection: 'row', minHeight: 40, alignItems: 'center' }}>
          <IconBtn label="←" onPress={() => up(s => { s.wstep = 0; })} />
        </View>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Ruma w={172} pose="happy" />
          <View style={{ alignItems: 'center' }}>
            <Text style={st.hL}>{t('wf_hi')}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 16, lineHeight: 24, color: C.ink64, maxWidth: 280, marginTop: 4, textAlign: 'center' }}>
              {/* The prototype string carries light HTML emphasis; plain text here. */}
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
        <Pressable onPress={() => up(s => { s.wstep = 2; })} style={st.btn}>
          <Text style={st.btnTxt}>{t('wf_meet')}</Text>
        </Pressable>
      </View>
    );
  }

  /* STEP 3 — log in / create account (flat, per the Figma frames) */
  return <AuthStep />;
}

function AuthStep() {
  const { S, t, up } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const login = S.authMode === 'login';
  const amode = S.authMode;

  const authGo = () => up(s => {
    if (s.authMode === 'signup') { s.authMode = 'login'; s.acctMade = true; }
    else { s.guest = false; s.onboarded = true; s.acctMade = false; }
  });

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 50, backgroundColor: '#4C8388' }]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16 + insets.top }}>
        <View style={{ flexDirection: 'row' }}>
          <IconBtn light label="←" onPress={() => up(s => {
            if (login) s.wstep = 1;
            else s.authMode = 'login';
          })} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingBottom: 26 }}>
            {login ? (
              <>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: '#fff', marginTop: 2 }}>RuMampu</Text>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 30, color: '#fff', marginTop: 14 }}>{t('au_hello')}</Text>
                <Text style={st.authTag}>{t('ob_slogan')}</Text>
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
          {amode === 'forgot' ? (
            <View style={{ gap: 10 }}>
              <Text style={st.h2}>{t('fg_title')}</Text>
              <BodyS muted>{t('fg_hint')}</BodyS>
              <AuthField label={t('au_email')} icon="✉" value={email} onChangeText={setEmail} placeholder={t('au_eph')} />
              <BtnP label={t('fg_send')} onPress={() => up(s => { s.fgMail = email || 'you@example.com'; s.authMode = 'checkmail'; })} />
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
              <BtnP label={t('au_login')} onPress={authGo} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
                <View style={{ flex: 1, borderTopWidth: 1.5, borderTopColor: C.ink14 }} />
                <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink40 }}>{t('au_or')}</Text>
                <View style={{ flex: 1, borderTopWidth: 1.5, borderTopColor: C.ink14 }} />
              </View>
              <BtnO prefix="G" label={t('au_google')} onPress={authGo} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                <Text style={st.authfoot}>{t('au_new')}</Text>
                <LineBtn label={t('au_createbtn')} onPress={() => up(s => { s.authMode = 'signup'; })} />
              </View>
              <View style={st.demobox}>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink40, textAlign: 'center', marginBottom: 6 }}>{t('au_guestnote')}</Text>
                <View style={{ alignItems: 'center' }}>
                  <LineBtn label={t('au_guest')} onPress={() => up(s => { s.guest = true; s.onboarded = true; })} />
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
              <BtnP label={t('au_createacct')} onPress={authGo} />
              <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink40, textAlign: 'center' }}>{t('au_mailonly')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                <Text style={st.authfoot}>{t('au_have')}</Text>
                <LineBtn label={t('au_login')} onPress={() => up(s => { s.authMode = 'login'; })} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <LineBtn label={t('au_guest2')} onPress={() => up(s => { s.guest = true; s.onboarded = true; })} />
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
  const { S, t, up, toast, saveIncomeEntry } = useApp();
  const insets = useSafeAreaInsets();
  const [amt, setAmt] = React.useState(S.lastMonth || '');
  const step = S.kstep || 0;

  const finish = (save: boolean) => {
    const amount = save ? (parseFloat(amt) || 0) : 0;
    up(s => {
      if (save) {
        /* Preferred sources float to the top of the picker; unknown picks become custom names later. */
        const known: Record<string, string> = { taxi: 'ehail', free: 'freelance' };
        const wanted = s.jobs.map(j => known[j] || j);
        const bySlug = (slug: string) => s.data.sources.find(x => x.id === slug || x.k === 'src_' + slug);
        const picked = wanted.map(bySlug).filter(Boolean) as typeof s.data.sources;
        s.data.sources = picked.concat(s.data.sources.filter(x => !picked.includes(x)));
        if (s.data.sources.length) s.incomeDraft.s = s.data.sources[0].id;
        s.lastMonth = amt;
      }
      s.knew = true;
      s.sheet = null;
    });
    if (save && amount > 0) {
      const sourceId = S.data.sources[0]?.id;
      void saveIncomeEntry({
        amount, date: lastMonthIso(), sourceId,
        entryMethod: 'historical_total', confirmOutlier: true,
      }).then(() => toast(t('k_saved'))).catch(() => toast(t('k_saved')));
    } else if (save) {
      toast(t('k_saved'));
    }
  };

  return (
    <View style={[st.kpage, { paddingTop: 18 + insets.top, paddingBottom: 18 + insets.bottom }]}>
      {step ? <KProg total={2} on={step} /> : null}
      <View style={{ flexDirection: 'row', minHeight: 40, alignItems: 'center', justifyContent: 'space-between' }}>
        {step ? <IconBtn label="←" onPress={() => up(s => { s.kstep = Math.max(0, (s.kstep || 0) - 1); })} /> : <View />}
        {step ? <LineBtn label={t('k_skip')} onPress={() => finish(false)} /> : null}
      </View>
      {step === 0 ? (
        <>
          <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={() => up(s => { s.kstep = 1; })}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 36, lineHeight: 42, color: C.ink, textAlign: 'center' }}>{t('k_hi')}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 17, lineHeight: 24, color: C.ink64, maxWidth: 280, marginTop: 10, textAlign: 'center' }}>{t('k_intro')}</Text>
            <View style={{ marginTop: 30 }}><Ruma w={220} pose="count" /></View>
          </Pressable>
          <Pressable onPress={() => up(s => { s.kstep = 1; })} style={st.kbtn}>
            <Text style={st.kbtnTxt}>{t('k_next')}</Text>
          </Pressable>
        </>
      ) : step === 1 ? (
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
