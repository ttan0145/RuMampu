import React from 'react';
import {
  createSavedHousingTest,
  createHousingScenario,
  fetchSavedHousingTest,
  runHousingTest,
  runPreHousingCheck,
  sampleHousingScenario,
  samplePreHousingCheck,
  updateSavedHousingTest,
  updateHousingScenario,
} from '../../../services/housingService';
import {
  getHousingScenario, getHousingTestResult, getPreHousingResult,
  setHousingScenario, setHousingTestResult, setPreHousingResult,
} from '../../../services/housingSession';
import { Pressable, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useApp } from '../state';
import { useFreshHousingTest } from '../useFreshHousingTest';
import { logIt } from '../log';
import { commitTotal, monthsAgg, nf, rm } from '../calc';
import { upfrontNeed } from '../fees';
import { potNow } from '../plan';
import { unrepresentedCoverageMonths } from '../money';
import {
  BodyS, Btn, BtnLine, Card, CardI, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, KV, NoteC, NumInput, P, Prov,
} from '../ui';
import { Ico } from '../svgs';
import { Ruma } from '../ruma-view';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT } from '../theme';
import { Band, Waterline } from '../charts';
import { ScreenShell } from './shell';
import { GuideTarget } from '../tour';
import { PathStrip, Ph, pathSteps } from '../homepath';
import { LearnStrip } from './learn';
import { useHousingCalculation } from '../useHousingCalculation';
import { ApiError } from '../../../services/api';

/* v22 house test — the friendly two-card flow: an intro with Ruma, then one
   txcard with price, deposit chips, instalment/other-cost rows and the Run
   button. All figures stay backend-authoritative via useHousingCalculation
   and the housing service. */

function extrasTotal(data: { homeCosts: { a: number }[] }): number {
  return data.homeCosts.reduce((a, c) => a + (+c.a || 0), 0);
}

/* The price a monthly instalment repays over the loan, before the deposit. */
function priceForInstalment(m: number, rate: number, years: number): number {
  const r = rate / 1200, n = years * 12;
  if (m <= 0) return 0;
  if (r === 0) return m * n;
  return m * (1 - Math.pow(1 + r, -n)) / r;
}

function IcLabB({ name, label }: { name: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, flexShrink: 1 }}>
      <Ico name={name} />
      <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{label}</Text>
    </View>
  );
}

function useRunTest() {
  const { S, t, up, go, toast } = useApp();
  const [running, setRunning] = React.useState(false);
  const run = () => {
    const h = S.data.house;
    if (h.knownPayment == null && !((h.price || 0) > 0)) {
      toast(t('tx_need_price'), 'error');
      return;
    }
    /* v27b: the test takes commitments off every month, so with none entered
       every month looks better than it was. Ask once before running. */
    if (commitTotal(S.data) === 0 && !S.noBills) {
      up(s => { s.sheet = 'nobills'; });
      return;
    }
    setRunning(true);
    void (async () => {
      try {
        /* AC8.26.4: on sample months nothing is created on the server; the
           test runs on a throwaway scenario against the sample months. */
        if (S.demo) {
          const scenario = sampleHousingScenario(S.data);
          setHousingScenario(scenario);
          const housingTest = await runHousingTest(scenario.id);
          const preHousing = samplePreHousingCheck(S.data);
          setPreHousingResult(preHousing);
          setHousingTestResult(housingTest);
          up(state => {
            state.testRan = true;
          state.pathCoach = { route: 'result', key: 'hx_coach_test' };
            state.viewTestName = null;
            state.tryPay = null;
            state.shock = 0;
            state.howOpen = false;
            state.rgHowOpen = false;
          });
          go(preHousing.has_existing_shortfall ? 'precheck' : 'result');
          return;
        }
        const currentScenario = getHousingScenario();
        const scenarioRequest = currentScenario
          ? updateHousingScenario(currentScenario.id, S.data).catch(error => {
              // A scenario ID can become stale after switching between the
              // local backend and the deployed backend. Recreate it once.
              if (error instanceof ApiError && error.status === 404) {
                setHousingScenario(null);
                return createHousingScenario(S.data);
              }
              throw error;
            })
          : createHousingScenario(S.data);
        const [preHousing, scenario] = await Promise.all([
          runPreHousingCheck(),
          scenarioRequest,
        ]);
        setHousingScenario(scenario);
        const housingTest = await runHousingTest(scenario.id);
        setPreHousingResult(preHousing);
        setHousingTestResult(housingTest);
        up(state => {
          state.testRan = true;
          state.autoKeep = true;
          state.pathCoach = { route: 'result', key: 'hx_coach_test' };
          state.viewTestName = null;
          state.tryPay = null;
          state.shock = 0;
          state.howOpen = false;
          state.rgHowOpen = false;
        });
        go(preHousing.has_existing_shortfall ? 'precheck' : 'result');
      } catch {
        toast(t('housing_run_failed'), 'error');
      } finally {
        setRunning(false);
      }
    })();
  };
  /* "I have no commitments" in the sheet asks this screen to run the test. */
  React.useEffect(() => {
    if (!S.runPending) return;
    up(s => { s.runPending = false; });
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.runPending]);
  return { run, running };
}

function TxRow({ label, sub, prov, value, editLabel, onEdit, total }: {
  label: string; sub?: string; prov?: string; value: string;
  editLabel?: string; onEdit?: () => void; total?: boolean;
}) {
  return (
    <View style={[tx.txrow, total && { borderTopWidth: 2, borderTopColor: C.ink, marginTop: 12 }]}>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13.5, color: total ? C.ink : C.ink64, fontWeight: total ? '600' : '400' }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink40 }}>{sub}</Text> : null}
        {prov ? <View style={{ marginTop: 3 }}><Prov p={prov} /></View> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: total ? 19 : 16, color: C.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
        {onEdit && editLabel ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: '#2E6B6F', textDecorationLine: 'underline' }}>{editLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function HouseBody() {
  const { S, t, up, go } = useApp();
  const h = S.data.house;
  const calc = useHousingCalculation(S.data);
  const { run, running } = useRunTest();
  const inst = h.knownPayment != null ? +h.knownPayment : (calc?.monthly_instalment ?? 0);
  const extras = extrasTotal(S.data);
  const known = h.knownPayment != null;
  const n = monthsAgg(S.data).length;
  /* The context pill mirrors the prototype's local carryRange(): the quietest
     and the median month's leftover. Presentation only — the test itself stays
     backend-authoritative. */
  const cr = (() => {
    const s = monthsAgg(S.data).map(r => r.surplus).sort((a, b) => a - b);
    if (!s.length) return null;
    const lo = s[0];
    const hi = (s.length % 2) ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { lo, hi };
  })();

  const price = h.price;
  const pct = price ? Math.round(h.deposit / price * 100) : 0;
  const [priceTxt, setPriceTxt] = React.useState(price != null ? String(price) : '');
  const depOther = S.depMode === 'other' || ![0, 10, 20].includes(pct);

  const depChip = (p: number) => (
    <Pressable key={p}
      onPress={() => up(s => {
        s.depMode = null;
        const pr = s.data.house.price || 0;
        s.data.house.deposit = Math.round(pr * p / 100);
      })}
      style={[tx.depchip, (S.depMode !== 'other' && pct === p) && tx.depchipOn]}>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: (S.depMode !== 'other' && pct === p) ? '#fff' : C.ink }}>{p}%</Text>
    </Pressable>
  );

  const intro = (
    <View style={tx.txintro}>
      <Ruma w={84} pose="count" float={false} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 17, lineHeight: 22, color: C.ink }}>{t('tx_intro_t')}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink, marginTop: 4 }}>{t('tx_intro', { n })}</Text>
        {cr ? (
          <View style={tx.txctx}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0A800' }} />
            <Text style={{ fontFamily: BODY_FONT, fontSize: 12, color: C.ink, flexShrink: 1 }}>
              {t('tx_ctx', { lo: rm(Math.max(0, cr.lo)), hi: rm(cr.hi) })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      {intro}
      <View style={tx.txcard}>
        {!known ? (
          <>
            <Text style={tx.lbl}>{t('tx_house')}</Text>
            <BodyS muted>{t('tx_price')}</BodyS>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 18, color: C.ink64 }}>RM</Text>
              <TextInput
                value={priceTxt}
                onChangeText={v => {
                  setPriceTxt(v);
                  const nn = parseFloat(v);
                  up(s => { s.data.house.price = isFinite(nn) && nn > 0 ? nn : null; if (isFinite(nn) && nn > 0) logIt(s, 'lg_price', { a: rm(nn) }, 'price'); });
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={t('tx_price_ph')}
                placeholderTextColor={C.ink40}
                style={tx.txamt}
              />
            </View>
            {/* a tip, not a footnote: a first price is the hardest part of the test */}
            <GuideTarget id="tx.price" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              <Pressable onPress={() => go('homecosts')} accessibilityRole="link" testID="tx-price-help"
                style={({ pressed }) => [tx.pricetip, pressed && { opacity: 0.8 }]}>
                <Ph n="lightbulb" c="#A86A00" size={16} />
                <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: '#7A4D00', flexShrink: 1 }}>{t('tx_price_help')}</Text>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: '#A86A00' }}>{'\u203A'}</Text>
              </Pressable>
            </GuideTarget>
            <BodyS muted style={{ marginTop: 4 }}>{t('tx_dep')} · {rm(h.deposit)}</BodyS>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
              {[0, 10, 20].map(depChip)}
              <Pressable onPress={() => up(s => { s.depMode = 'other'; })}
                style={[tx.depchip, depOther && tx.depchipOn]}>
                <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: depOther ? '#fff' : C.ink }}>{t('tx_dep_other')}</Text>
              </Pressable>
              {depOther ? (
                <NumInput value={h.deposit} decimal={false}
                  onNum={nn => up(s => { s.data.house.deposit = Math.max(0, nn); })}
                  style={{ width: 110, minHeight: 32, fontSize: 13, paddingHorizontal: 10, borderRadius: 16 }}
                  accessibilityLabel={t('tx_dep')} />
              ) : null}
            </View>
            <TxRow label={t('tx_inst')} sub={t('tx_loan', { r: h.rate, y: h.years })} prov="assume"
              value={rm(inst)} editLabel={t('edit')} onEdit={() => up(s => { s.sheet = 'loan'; })} />
            <TxRow label={t('tx_other')} prov="assume"
              value={rm(extras)} editLabel={t('edit')} onEdit={() => up(s => { s.sheet = 'hcosts'; })} />
            <TxRow total label={t('tx_total')} value={rm(inst + extras)} />
            <View style={{ marginTop: 14 }}>
              <Btn disabled={running} label={running ? t('housing_running') : t('tx_run')} onPress={run} />
            </View>
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <BtnLine label={t('tx_known')} style={{ fontSize: 13 }}
                onPress={() => up(s => { s.data.house.knownPayment = Math.round(calc?.monthly_instalment ?? 0); })} />
            </View>
          </>
        ) : (
          <>
            <Text style={tx.lbl}>{t('tx_known_lbl')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 18, color: C.ink64 }}>RM</Text>
              <TextInput
                value={String(+(h.knownPayment || 0) || '')}
                onChangeText={v => up(s => { s.data.house.knownPayment = parseFloat(v) || 0; })}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="0"
                placeholderTextColor={C.ink40}
                style={tx.txamt}
              />
            </View>
            <TxRow label={t('tx_other')} prov="assume"
              value={rm(extras)} editLabel={t('edit')} onEdit={() => up(s => { s.sheet = 'hcosts'; })} />
            <TxRow total label={t('tx_total')} value={rm(inst + extras)} />
            <View style={{ marginTop: 14 }}>
              <Btn disabled={running} label={running ? t('housing_running') : t('tx_run')} onPress={run} />
            </View>
            <View style={{ alignItems: 'center', marginTop: 6 }}>
              <BtnLine label={t('tx_back_price')} style={{ fontSize: 13 }}
                onPress={() => up(s => { s.data.house.knownPayment = null; })} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/* v22 House tab home: saved-tests chip, test / prepare segments. */

/* Each House tab card wears its own tint and a small scene, so the four read
   apart at a glance. Decoration only: the words carry the meaning. */
const INK = '#3C5152';
const HH_SCENE: Record<string, { bg: string; xml: string }> = {
  house: { bg: '#E3F2EC', xml: `<svg viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
  <circle cx="54" cy="42" r="38" fill="#CDE9DE"/>
  <ellipse cx="26" cy="20" rx="11" ry="5" fill="#FFFFFF" opacity="0.9"/><ellipse cx="34" cy="17" rx="8" ry="5" fill="#FFFFFF" opacity="0.9"/>
  <ellipse cx="52" cy="76" rx="42" ry="6" fill="#AFD8C7"/>
  <rect x="28" y="40" width="40" height="34" rx="2" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  <path d="M22 44 L48 22 L74 44 Z" fill="#3F8A8E" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="32" y="48" width="9" height="9" rx="1.5" fill="#E1EEED" stroke="${INK}" stroke-width="1.6"/>
  <rect x="47" y="55" width="12" height="19" rx="2" fill="#F2C14E" stroke="${INK}" stroke-width="1.8"/>
  <circle cx="82" cy="30" r="12" fill="#3F8A8E" stroke="${INK}" stroke-width="2"/>
  <path d="M76.5 30 l4 4 l7.5 -7.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>` },
  plan: { bg: '#ECE8FF', xml: `<svg viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
  <circle cx="54" cy="42" r="38" fill="#DCD4FF"/>
  <ellipse cx="52" cy="76" rx="42" ry="6" fill="#C9BEFA"/>
  <path d="M30 44 Q30 30 50 30 Q70 30 70 44 L70 62 Q70 74 50 74 Q30 74 30 62 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  <rect x="38" y="24" width="24" height="8" rx="3" fill="#7C5CFF" stroke="${INK}" stroke-width="2"/>
  <g stroke="${INK}" stroke-width="1.6"><ellipse cx="50" cy="64" rx="12" ry="4" fill="#FFC83D"/><ellipse cx="50" cy="58" rx="12" ry="4" fill="#FFC83D"/><ellipse cx="50" cy="52" rx="12" ry="4" fill="#FFD866"/></g>
  <circle cx="82" cy="28" r="11" fill="#FFC83D" stroke="${INK}" stroke-width="2"/>
  <text x="76.5" y="32" font-family="sans-serif" font-size="10" font-weight="700" fill="${INK}">RM</text>
</svg>` },
  homecosts: { bg: '#FBF0DC', xml: `<svg viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
  <circle cx="54" cy="42" r="38" fill="#F5E1BE"/>
  <ellipse cx="52" cy="76" rx="44" ry="6" fill="#EBCF9C"/>
  <rect x="14" y="56" width="20" height="18" rx="1.5" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  <path d="M10 58 L24 46 L38 58 Z" fill="#E69A7A" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="40" y="46" width="22" height="28" rx="1.5" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  <path d="M36 48 L51 34 L66 48 Z" fill="#3F8A8E" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="68" y="24" width="22" height="50" rx="2" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  <g fill="#E1EEED" stroke="${INK}" stroke-width="1.3"><rect x="72" y="30" width="5" height="5"/><rect x="81" y="30" width="5" height="5"/><rect x="72" y="40" width="5" height="5"/><rect x="81" y="40" width="5" height="5"/><rect x="72" y="50" width="5" height="5"/><rect x="81" y="50" width="5" height="5"/></g>
  <g transform="translate(12 12) rotate(-14)">
    <path d="M0 0 H22 L29 8 L22 16 H0 Z" fill="#F2C14E" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="23" cy="8" r="1.8" fill="${INK}"/>
    <text x="3" y="11.5" font-family="sans-serif" font-size="9" font-weight="700" fill="${INK}">RM</text>
  </g>
</svg>` },
  prepare: { bg: '#E4EEF8', xml: `<svg viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
  <circle cx="52" cy="42" r="38" fill="#CEDFF1"/>
  <ellipse cx="52" cy="76" rx="42" ry="6" fill="#B5CDE8"/>
  <circle cx="50" cy="12" r="6.5" fill="#F2C14E" stroke="${INK}" stroke-width="1.8"/>
  <path d="M50 21 v4" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="28" y="34" width="44" height="40" rx="11" fill="#FFFFFF" fill-opacity="0.92" stroke="${INK}" stroke-width="2"/>
  <rect x="33" y="27" width="34" height="9" rx="3" fill="#3F8A8E" stroke="${INK}" stroke-width="2"/>
  <path d="M44 31.5 h12" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  <g fill="#F2C14E" stroke="#C2962C" stroke-width="1.6">
    <circle cx="41" cy="64" r="6"/><circle cx="55" cy="65" r="6"/><circle cx="48" cy="54" r="6"/><circle cx="61" cy="53" r="5"/>
  </g>
  <g fill="none" stroke="#C2962C" stroke-width="3" stroke-linecap="round">
    <circle cx="86" cy="42" r="6"/><path d="M86 48 V68 M86 60 h5 M86 66 h4"/>
  </g>
</svg>` },
  learn: { bg: '#FBE8E2', xml: `<svg viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
  <circle cx="52" cy="44" r="38" fill="#F5D3C7"/>
  <ellipse cx="52" cy="77" rx="40" ry="5" fill="#EDBBA9"/>
  <path d="M12 38 Q31 30 52 40 L52 74 Q31 65 12 72 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M92 38 Q73 30 52 40 L52 74 Q73 65 92 72 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <g stroke="#E3A992" stroke-width="2" stroke-linecap="round"><path d="M19 46 q13 -5 26 1 M19 54 q13 -5 26 1 M19 62 q13 -5 20 0"/><path d="M59 47 q13 -6 26 -1 M59 55 q13 -6 26 -1"/></g>
  <path d="M74 54 v18 l4 -3.5 l4 3.5 v-19" fill="#3F8A8E" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="80" cy="18" r="11" fill="#F2C14E" stroke="${INK}" stroke-width="2"/>
  <path d="M80 11.5 l2 4.2 l4.6 .6 l-3.3 3.2 l.8 4.6 l-4.1 -2.2 l-4.1 2.2 l.8 -4.6 l-3.3 -3.2 l4.6 -.6 Z" fill="#FFFFFF"/>
  <g fill="#F2C14E"><circle cx="20" cy="22" r="2.4"/><circle cx="60" cy="16" r="1.8"/></g>
</svg>` },
};

/* After buying: the months since, against the earlier test, as the House tab's first card. */
function BoughtCard() {
  const { S, t, go, monthName, refreshHomeownership } = useApp();
  React.useEffect(() => { void refreshHomeownership().catch(() => undefined); }, [refreshHomeownership]);
  const rows = S.homeownershipMonths.filter(r => r.is_complete && (!S.purchaseMonth || r.month >= S.purchaseMonth));
  const short = rows.filter(r => r.short).length;
  const pm = S.purchaseMonth;
  const since = pm && /^\d{4}-\d{2}$/.test(pm) ? `${monthName(+pm.slice(5, 7) - 1)} ${pm.slice(0, 4)}` : '';
  return (
    <Pressable onPress={() => go('pv_switch')} accessibilityRole="button" testID="hh-monitoring" style={({ pressed }) => [tx.hhmon, pressed && { opacity: 0.92 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' }}>
        <View style={tx.hhmonIc}><Ico name="key" size={22} color="#EEF6F6" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 17, lineHeight: 22, color: '#EEF6F6' }}>{t('pv_monitor_t')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: 'rgba(238,246,246,0.78)', marginTop: 2 }}>
            {since ? t('p7_keys_since', { m: since }) : t('pv_then')}
          </Text>
        </View>
        <Text style={{ fontSize: 20, color: 'rgba(238,246,246,0.78)' }}>{'\u203A'}</Text>
      </View>
      <View style={{ gap: 7, width: '100%' }}>
        {rows.length ? (
          <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
            {rows.map(r => <View key={r.month} style={{ flex: 1, borderRadius: 3, backgroundColor: r.short ? '#F4A98A' : 'rgba(238,246,246,0.9)' }} />)}
          </View>
        ) : null}
        <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: 'rgba(238,246,246,0.78)' }}>
          {rows.length ? t('p7_keys_short', { s: short, n: rows.length }) : t('pv_compare_empty_t')}
        </Text>
      </View>
    </Pressable>
  );
}

export function HousehomeScreen() {
  const { S, t, go, loadHouseCosts } = useApp();
  React.useEffect(() => { void loadHouseCosts(); }, [loadHouseCosts]);

  /* v24 hcMonthsStrip: recorded months → test outcome per month. */
  const dream = !!(S.testRan && getHousingTestResult());
  const monthsStrip = (() => {
    const n = monthsAgg(S.data).length;
    if (!n) return { label: t('hc_first') };
    const result = S.testRan ? getHousingTestResult() : null;
    if (!result) return { label: t('hc_months', { n }) };
    const segs = result.months.map(m => m.post_housing_residual >= 0);
    const k = segs.filter(ok => !ok).length;
    return {
      label: k ? t('hc_short', { k, n: segs.length }) : t('hc_carry', { k: segs.length, n: segs.length }),
      segs,
    };
  })();

  /* v24 hcCostStrip: the state's cheapest and dearest place in years, on a 0-10 scale. */
  const costStrip = (() => {
    if (S.houseCostsSync === 'loading' || S.houseCostsSync === 'idle') {
      return { label: t('hc_loading') };
    }
    if (S.houseCostsSync === 'error') return { label: t('hc_error') };
    const stateData = S.houseCosts?.states[S.hcState];
    if (!stateData?.income) return { label: t('fh_none') };
    const years = Object.values(stateData.types.all ?? {})
      .map(([, median]) => median / (stateData.income! * 12));
    if (!years.length) return { label: t('fh_none') };
    const lo = Math.min(...years), hi = Math.max(...years);
    const pos = (y: number) => Math.max(1, Math.min(97, y / 10 * 100));
    return { label: t('hc_span', { a: lo.toFixed(1), b: hi.toFixed(1), s: stateData.name }), a: pos(lo), b: pos(hi) };
  })();

  /* v24 hcPrepStrip: the pot against the upfront need (AC5.1.5). It reads the same
     figure the Upfront cash screen calls "You have": the pot less what the
     cash-buffer shield already holds. */
  const prepStrip = (() => {
    const need = upfrontNeed(S);
    const q = potNow(S);
    const have = q.up;
    const held = q.buf;
    if (!need) return { label: t('hc_needprice') };
    const pct = Math.min(100, Math.round(have / need * 100));
    const label = have > 0 || held > 0 ? t('hc_pot', { a: rm(have), b: rm(need) }) : t('hc_pot0');
    return { label: held > 0 ? `${label} · ${t('hc_held', { h: rm(held) })}` : label, pct };
  })();

  /* Saving plan: locked until a house is tested, then today's amount and how full the goal is. */
  const steps = pathSteps(S, getHousingTestResult());
  const planStrip = (() => {
    if (!steps.tested) return { label: t('hh_plan_lock') };
    if (steps.phase === 'explain') return { label: t('hh_plan_hold') };
    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const p = S.plan && S.plan.key === monthKey ? S.plan : null;
    const day = new Date().getDate() - 1;
    const amt = p?.amounts[day] ?? 0;
    const q = steps.q;
    const have = steps.inBuf ? q.buf : q.up, goal = steps.inBuf ? q.bt : q.need;
    const pct = goal > 0 ? Math.min(100, Math.round(have / goal * 100)) : 100;
    if (!steps.saving) return { label: amt ? t('hh_plan_ready', { a: rm(amt) }) : t('hx_ready') };
    return {
      label: p?.done[day] ? t('hh_plan_saved', { h: rm(have), t: rm(goal) }) : t('hh_plan_today', { a: rm(amt) }),
      pct,
    };
  })();

  /* Your dream house: the price that was tested and how it fits. */
  const dreamInfo = (() => {
    const result = getHousingTestResult();
    if (!steps.tested || !result) return null;
    const sc = getHousingScenario();
    const pay = sc?.known_monthly_payment ?? null;
    const price = pay == null ? (sc?.property_price || S.data.house.price || result.indicative_tested_property_price || 0) : 0;
    const short = Number(result.short_month_count) || 0;
    const fit: 'ok' | 'warn' | 'bad' = steps.phase === 'explain' ? 'bad' : short ? 'warn' : 'ok';
    return {
      amount: pay != null ? t('hh_dream_pay', { a: rm(pay) }) : price ? rm(price) : null,
      fit, fitLbl: t(fit === 'bad' ? 'hx_nofit' : fit === 'warn' ? 'hx_tight' : 'hx_fits'),
    };
  })();
  const FIT = { ok: { bg: '#D9F2E3', fg: '#1C8A4C' }, warn: { bg: '#FFF0C7', fg: '#8A5A00' }, bad: { bg: '#FFE0D6', fg: '#B5401A' } };

  /* Tools that help at any step: a slim row, so the path cards above lead. */
  const row = (to: Parameters<typeof go>[0], scene: string, title: string, desc: string, strip: React.ReactNode) => (
    <GuideTarget key={to} id={HUB_ID[to] || `hh.${to}`}>
    <Pressable onPress={() => go(to)} accessibilityRole="button"
      style={({ pressed }) => [tx.hrow, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View pointerEvents="none" style={[tx.hrowIc, { backgroundColor: HH_SCENE[scene].bg }]}>
        <SvgXml xml={HH_SCENE[scene].xml} width={56} height={45} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 19, color: C.ink }}>{t(title)}</Text>
        <Text numberOfLines={2} style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64 }}>{t(desc)}</Text>
        {strip}
      </View>
      <Text style={{ fontSize: 20, color: C.ink40 }}>{'\u203A'}</Text>
    </Pressable>
    </GuideTarget>
  );

  const HUB_ID: Record<string, string> = { house: 'hh.test', homecosts: 'hh.costs', prepare_soon: 'hh.prep', learn: 'hh.learn', plan: 'hh.plan' };
  const card = (to: Parameters<typeof go>[0], scene: string, title: string, desc: string, strip: React.ReactNode,
    badge?: { label: string; lock?: boolean }) => (
    <GuideTarget key={to} id={HUB_ID[to] || `hh.${to}`}>
    <Pressable onPress={() => go(to)} accessibilityRole="button"
      style={({ pressed }) => [tx.hcard, { backgroundColor: HH_SCENE[scene].bg }, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {badge ? (
            <View style={[tx.hbadge, badge.lock && tx.hbadgeLock]}>
              {badge.lock ? <Ph n="lock-simple" c={C.ink64} size={11} /> : null}
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 11, color: badge.lock ? C.ink64 : '#5B3FD9' }}>{badge.label}</Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: DISP_FONT, fontSize: 17, lineHeight: 22, color: C.ink }}>{t(title)}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64, marginTop: 3 }}>{t(desc)}</Text>
        </View>
        <View pointerEvents="none" style={{ marginVertical: -8, marginRight: -6 }}>
          <SvgXml xml={HH_SCENE[scene].xml} width={96} height={78} />
        </View>
      </View>
      {strip}
    </Pressable>
    </GuideTarget>
  );

  const stripLbl = (label: string) => (
    <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: C.ink64 }}>{label}</Text>
  );

  return (
    <ScreenShell greet title={t('tab_test')} noScene tint="#EEF6F3" right={
      <GuideTarget id="hh.saved">
      <Pressable onPress={() => go('savedtests')} style={tx.savedchip} accessibilityLabel={t('sv_title')}>
        <SvgXml xml={`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 3.5h11V21L12 17l-5.5 4z"/></svg>`} width={13} height={13} />
        <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: C.ink }}>{t('sv_title')}</Text>
        {S.keptTests.length ? (
          <View style={tx.savedchipN}><Text style={{ fontFamily: DISP_FONT, fontSize: 10, color: '#fff' }}>{S.keptTests.length}</Text></View>
        ) : null}
      </Pressable>
      </GuideTarget>
    }>
      {/* after buying, monitoring leads the House tab (Epic 7) */}
      {S.bought ? <BoughtCard /> : null}
      {/* the same path as Home: each stop opens where that step is done */}
      {!S.bought ? <GuideTarget id="hh.path"><PathStrip /></GuideTarget> : null}
      {card('house', 'house', dream ? 'hx_dream_t' : 'hh_test', dream ? 'hh_dream_d' : 'hh_test_d', (
        <View style={{ gap: 7, width: '100%' }}>
          {dreamInfo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }} testID="house-dream">
              {dreamInfo.amount ? (
                <Text style={{ fontFamily: DISP_FONT, fontSize: 20, lineHeight: 24, color: C.ink, fontVariant: ['tabular-nums'] }}>{dreamInfo.amount}</Text>
              ) : null}
              <View style={[tx.hfit, { backgroundColor: FIT[dreamInfo.fit].bg }]}>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 11.5, color: FIT[dreamInfo.fit].fg }}>{dreamInfo.fitLbl}</Text>
              </View>
            </View>
          ) : null}
          {monthsStrip.segs ? (
            <View style={{ flexDirection: 'row', gap: 4, height: 8 }}>
              {monthsStrip.segs.map((ok, i) => (
                <View key={i} style={{ flex: 1, borderRadius: 3, backgroundColor: ok ? C.brand : C.short }} />
              ))}
            </View>
          ) : null}
          {stripLbl(monthsStrip.label)}
        </View>
      ))}
      {card('plan', 'plan', 'pl_title', 'hh_plan_d', (
        <View style={{ gap: 7, width: '100%' }}>
          {planStrip.pct != null ? (
            <View style={{ height: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.85)', overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(2, planStrip.pct)}%` as DimensionValue, height: '100%', borderRadius: 5, backgroundColor: '#7C5CFF' }} />
            </View>
          ) : null}
          {stripLbl(planStrip.label)}
        </View>
      ), !steps.tested ? { label: t('hx_locked'), lock: true } : undefined)}
      {card('prepare', 'prepare', 'hh_prep', 'hh_prep_d', (
        <View style={{ gap: 7, width: '100%' }}>
          {prepStrip.pct != null ? (
            <View style={{ height: 8, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.85)', overflow: 'hidden' }}>
              <View style={{ width: `${prepStrip.pct}%` as DimensionValue, height: '100%', borderRadius: 5, backgroundColor: C.brand }} />
            </View>
          ) : null}
          {stripLbl(prepStrip.label)}
        </View>
      ), steps.cur >= 0 && steps.cur < 3 ? { label: t('hh_prep_after') } : undefined)}
      <Text style={tx.hsec}>{t('hh_tools')}</Text>
      {row('homecosts', 'homecosts', 'hh_cost', 'hh_cost_d', stripLbl(costStrip.label))}
      {/* v26/v27b: What buying involves, with pages read and badges earned. */}
      {row('learn', 'learn', 'hh_learn', 'hh_learn_d', <LearnStrip />)}
      {/* before buying: a quiet but solid way into "I've bought a home" (the Prepare path's
          keys step leads there too, but only once Prepare has a home to work from) */}
      {!S.bought ? (
        <Pressable onPress={() => go('pv_switch')} accessibilityRole="button" style={({ pressed }) => [tx.hhbought, pressed && { opacity: 0.85 }]}>
          <View style={tx.hhboughtIc}><Ico name="key" size={20} color={C.brand} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('pv_home_t')}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 17, color: C.ink64, marginTop: 1 }}>{t('hh_bought_d')}</Text>
          </View>
          <Text style={{ fontSize: 20, color: C.ink40 }}>{'\u203A'}</Text>
        </Pressable>
      ) : null}
    </ScreenShell>
  );
}

export function HouseScreen() {
  const { S, t } = useApp();
  const dream = !!(S.testRan && getHousingTestResult());
  return (
    <ScreenShell back title={t(dream ? 'hx_dream_t' : 'hh_test')}>
      <HouseBody />
    </ScreenShell>
  );
}

/* v22 saved tests list. */
export function SavedtestsScreen() {
  const { S, t, up, go, toast } = useApp();
  const openSavedTest = async (idx: number) => {
    const saved = S.keptTests[idx];
    if (!saved) return;
    try {
      const record = saved.id ? await fetchSavedHousingTest(saved.id) : null;
      const scenario = record?.scenario || saved.scenario;
      const result = record?.result || saved.result;
      if (!scenario || !result || !('tested_home_cost' in result)) {
        toast(t('housing_run_failed'), 'error');
        return;
      }
      setHousingScenario(scenario as any);
      setHousingTestResult(result as any);
      up(s => {
        s.testRan = true;
        s.viewTestName = s.keptTests[idx]?.name || null;
        s.tryPay = null;
        s.shock = Number((result as any).income_shock_percent) || 0;
        s.howOpen = false;
        s.rgHowOpen = false;
      });
      go('result');
    } catch {
      toast(t('housing_run_failed'), 'error');
    }
  };
  return (
    <ScreenShell back title={t('sv_title')}>
      {/* v24 P1-3: the card opens that test's result; Edit sits inside the card. */}
      {S.keptTests.length ? S.keptTests.map((k, i) => (
        <View key={k.id || i} style={tx.txcard}>
          <Pressable onPress={() => { void openSavedTest(i); }} accessibilityRole="button" style={{ gap: 4 }}>
            {k.name ? <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink }}>{k.name}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 15, color: C.ink }}>
                <Text style={{ fontFamily: DISP_FONT }}>{rm(k.pay)}</Text> {t('mo_permo')}
              </Text>
              <Fig value={t('cp_short', { s: k.s, n: k.n })} p="calc" cls="body-s" />
            </View>
            {k.propertyPrice ? <BodyS muted>{t('sv_price_l')} {rm(k.propertyPrice)}</BodyS> : null}
            {k.g ? <BodyS muted>{t('gap_lbl')} {rm(k.g)}</BodyS> : null}
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: C.brand, marginTop: 2 }}>{t('sv_open_l')} →</Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: C.ink14, marginTop: 10, marginBottom: 2 }} />
          <BtnLine label={t('sv_edit_l')} style={{ fontSize: 14.5 }}
            onPress={() => up(s => { s.svIdx = i; s.svDelArm = false; s.sheet = 'svedit'; })} />
        </View>
      )) : (
        <Card><BodyS muted>{t('sv_none')}</BodyS></Card>
      )}
    </ScreenShell>
  );
}

export function HomecostScreen() {
  const { S, t, up } = useApp();
  const calc = useHousingCalculation(S.data);
  const { run, running } = useRunTest();
  const inst = calc?.monthly_instalment ?? 0;
  const total = calc?.total_monthly_cost ?? 0;
  return (
    <ScreenShell back title={t('tc_title')}>
      <Fig value={rm(total)} p="calc" cls="h-xl" />
      <BodyS muted>{t('tc_point')}</BodyS>
      <Pressable onPress={() => up(s => { s.tcOpen = !s.tcOpen; })} style={tx.btnQuiet}>
        <P>{t('tc_break')}</P>
        <Text style={{ fontSize: 16, color: C.ink }}>{S.tcOpen ? '−' : '+'}</Text>
      </Pressable>
      {S.tcOpen ? (
        <Card gap={8}>
          <KV k={t('tc_inst')}>
            <Fig value={rm(inst)} p={S.data.house.knownPayment != null ? 'user' : 'calc'} />
          </KV>
          <EditList
            decimal
            list={S.data.homeCosts.map(c => ({ ...c, p: undefined }))}
            onNum={(i, n) => up(s => { s.data.homeCosts[i].a = n; })}
          />
          <FigRow p="assume" />
        </Card>
      ) : null}
      <Btn label={t(running ? 'housing_running' : 'tc_run') + (running ? '' : ' →')} disabled={running} onPress={run} />
    </ScreenShell>
  );
}

export function PrecheckScreen() {
  const { t, monthName, goTab, up } = useApp();
  const result = getPreHousingResult();
  React.useEffect(() => {
    up(state => { state.stack = ['househome']; });
  }, [up]);
  const worst = result?.worst_month;
  const monthIndex = worst ? worst.month - 1 : 0;
  const gap = result?.largest_existing_gap || 0;
  return (
    <ScreenShell back title={t('pc_title')}>
      <Display cls="h-l">{t('pc_msg', { m: monthName(monthIndex), x: nf(gap) })}</Display>
      <FigRow p="calc" />
      <BodyS muted>{t('pc_msg2')}</BodyS>
      <Btn label={t('pc_btn')} onPress={() => goTab('money')} />
    </ScreenShell>
  );
}

export function ResultScreen() {
  const { S, t, monthName, up, go, toast, refreshSavedHousingTests } = useApp();
  React.useEffect(() => {
    up(state => { state.stack = ['househome']; });
  }, [up]);

  const base = getHousingTestResult();
  const scenarioId = getHousingScenario()?.id ?? base?.scenario_id;
  const shock = S.shock;
  /* v24: name the saved test being shown, with a way back to my own test. */
  const viewingBanner = S.viewTestName ? (
    <Pressable
      onPress={() => { up(s => { s.viewTestName = null; }); go('savedtests'); }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#EDF2F1', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minHeight: 54,
      }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 11, color: C.ink64 }}>{t('rx_viewing')}</Text>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink }} numberOfLines={1}>{S.viewTestName}</Text>
      </View>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64 }}>{t('rx_unview')}</Text>
    </Pressable>
  ) : null;
  const [shocked, setShocked] = React.useState<typeof base>(null);
  const [tryResult, setTryResult] = React.useState<typeof base>(null);
  const [customPay, setCustomPay] = React.useState('');

  /* Re-run the same scenario with the drop applied (backend-authoritative). */
  React.useEffect(() => {
    if (!scenarioId || !shock) { setShocked(null); return; }
    let active = true;
    void runHousingTest(scenarioId, undefined, shock)
      .then(next => { if (active) setShocked(next); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [scenarioId, shock]);

  /* The "try a payment" comparison, under the same drop. */
  React.useEffect(() => {
    if (!scenarioId || S.tryPay == null) { setTryResult(null); return; }
    let active = true;
    void runHousingTest(scenarioId, S.tryPay, shock || undefined)
      .then(next => { if (active) setTryResult(next); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [scenarioId, S.tryPay, shock]);

  useFreshHousingTest();

  if (!base) return <ScreenShell back title={t('rs_title')}><View /></ScreenShell>;
  const result = (shock && shocked) ? shocked : base;

  const cost = result.tested_home_cost;
  const rows = result.months.map(r => ({
    m: r.month - 1,
    surplus: r.available_for_home,
    short: r.is_short,
    gap: r.total_shortfall,
  }));
  const n = result.tested_months;
  const s = result.short_month_count;
  const g = result.largest_gap;
  const shortNames = result.months.filter(r => r.is_short).map(r => monthName(r.month - 1)).join(', ');
  const un = unrepresentedCoverageMonths(S.incomeCoverage);
  const state = s === 0 ? 'ok' : (s <= n / 2 ? 'warn' : 'bad');

  const verdict = (
    <View style={[tx.rxv, state === 'ok' ? tx.rxvOk : state === 'warn' ? tx.rxvWarn : tx.rxvBad]}>
      <Ruma w={72} pose={state === 'ok' ? 'happy' : state === 'warn' ? 'count' : 'oops'} float={false} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 18, lineHeight: 23, color: C.ink }}>
          {s ? t('rx_warn_t', { s, n }) : t('rx_ok_t', { n })}
        </Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink, marginTop: 4 }}>
          {s
            ? (state === 'bad'
              ? t('rx_bad', { c: rm(cost), g: rm(g) })
              : t('rx_warn', { months: shortNames, c: rm(cost), g: rm(g) }))
            : t('rx_ok', { c: rm(cost) })}
        </Text>
      </View>
    </View>
  );

  const caveat = (
    <>
      {commitTotal(S.data) === 0 ? <NoteC><BodyS>{t('rs_nobills')}</BodyS></NoteC> : null}
      {un.length
        ? <NoteC><BodyS>{t('rs_limit_slow', { m: un.map(monthName).join(', ') })}</BodyS></NoteC>
        : n < 4 ? <NoteC><BodyS>{t('rs_limit_thin', { n })}</BodyS></NoteC> : null}
    </>
  );

  const legend = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
      {([[t('rx_leg_bar'), C.ink, 12], [t('rx_leg_line'), C.brand, 3], [t('rx_leg_gap'), C.short, 12]] as [string, string, number][]).map(([lbl, col, hh]) => (
        <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: hh === 3 ? 16 : 12, height: hh, borderRadius: hh === 3 ? 2 : 3, backgroundColor: col }} />
          <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink64 }}>{lbl}</Text>
        </View>
      ))}
    </View>
  );

  /* v24: one quiet row on the chart card — the label and the three drops. */
  const shockChips = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
      <BodyS muted>{t('rx_drop')}</BodyS>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 10, 20].map(v => (
          <Pressable key={v} onPress={() => up(x => { x.shock = v; })}
            style={[tx.rxchip, shock === v && tx.rxchipOn]}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: shock === v ? '#fff' : C.ink }}>
              {v ? `−${v}%` : '0%'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  /* the payment every recorded month could carry, under the same drop */
  const lo = rows.length ? Math.max(0, Math.floor(Math.min(...rows.map(r => r.surplus)))) : 0;
  const tRows = (tryResult?.months ?? []).map(r => ({
    m: r.month - 1, surplus: r.available_for_home, short: r.is_short, gap: r.total_shortfall,
  }));
  const tryCard = rows.length ? (
    <View style={tx.rxtry}>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('rx_try_t')}</Text>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink, marginTop: 4 }}>
        {cost > lo ? t('rx_try', { p: rm(lo) }) : t('rx_try_ok')}
      </Text>
      {/* v27b: what that payment buys, at the rate, loan length and deposit entered. A rough guide. */}
      {cost > lo && lo > extrasTotal(S.data) ? (
        <BodyS muted style={{ marginTop: 4 }}>
          {t('rx_try_price', {
            price: rm(Math.round((priceForInstalment(lo - extrasTotal(S.data), S.data.house.rate, S.data.house.years)
              + (+S.data.house.deposit || 0)) / 1000) * 1000),
            r: S.data.house.rate, y: S.data.house.years,
          })}
        </BodyS>
      ) : null}
      {cost > lo ? (
        <View style={{ marginTop: 10 }}>
          <Btn label={t('rx_try_btn', { p: rm(lo) })} onPress={() => up(x => { x.tryPay = lo; })} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {[1000, 1200, 1400].map(v => (
          <Pressable key={v} onPress={() => up(x => { x.tryPay = v; })}
            style={[tx.rxchip, { backgroundColor: '#fff' }, S.tryPay === v && tx.rxchipOn]}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: S.tryPay === v ? '#fff' : C.ink }}>{rm(v)}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => up(x => { x.tryCust = !x.tryCust; })}
          style={[tx.rxchip, { backgroundColor: '#fff' }, S.tryCust && tx.rxchipOn]}>
          <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: S.tryCust ? '#fff' : C.ink }}>{t('rx_custom')}</Text>
        </Pressable>
      </View>
      {S.tryCust ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink64 }}>RM</Text>
          <TextInput
            value={customPay}
            onChangeText={setCustomPay}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="1100"
            placeholderTextColor={C.ink40}
            style={{
              flex: 1, minHeight: 42, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.ink40,
              borderRadius: 12, paddingHorizontal: 12, fontSize: 16, color: C.ink,
            }}
          />
          <Pressable onPress={() => {
            const v = parseFloat(customPay) || 0;
            if (v > 0) up(x => { x.tryPay = Math.round(v * 100) / 100; });
          }} style={[tx.rxchipOn, { minHeight: 42, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' }]}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 14, color: '#fff' }}>{t('rx_try_go')}</Text>
          </Pressable>
        </View>
      ) : null}
      {S.tryPay != null && tryResult ? (
        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(60,81,82,0.12)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <Text style={{ fontFamily: SEMI_FONT, fontSize: 13, color: '#2E6B6F' }}>
              {t('rx_trying', { p: rm(S.tryPay), c: rm(cost) })}
            </Text>
            <BtnLine label={t('rx_use_home')} style={{ fontSize: 12.5 }} onPress={() => up(x => { x.tryPay = null; })} />
          </View>
          <Waterline rows={tRows} cost={S.tryPay} lineLabel monthName={monthName} />
          <BodyS muted style={{ marginTop: 6 }}>
            {t('rx_tryres', { s: tryResult.short_month_count, n: tryResult.tested_months, p: rm(S.tryPay) })}
          </BodyS>
        </View>
      ) : null}
    </View>
  ) : null;

  /* Every test that runs is kept straight away under a plain name (the price, or the
     monthly cost); it can be renamed in Saved tests. */
  const keepTest = (silent = false) => {
    /* v27b: a test on sample months is for looking around; it is never kept. */
    if (S.demo) { if (!silent) toast(t('demo_note')); return; }
    const scenario = getHousingScenario();
    const duplicate = S.keptTests.some(test => (
      test.pay === Math.round(cost)
      && test.s === s && test.n === n
    ));
    up(x2 => {
      const h = x2.data.house;
      x2.svDraft = (h.knownPayment == null && (h.price || 0) > 0)
        ? rm(h.price || 0)
        : `${rm(Math.round(cost))} ${t('mo_permo')}`;
      if (!duplicate) {
        x2.keptTests.push({
          ...(silent ? { name: x2.svDraft } : {}),
          pay: Math.round(cost),
          s,
          n,
          g: Math.round(g),
          scenarioId: scenario?.id,
          scenario: scenario || undefined,
          result,
          propertyPrice: h.price || null,
          incomeShockPercent: result.income_shock_percent,
        });
        logIt(x2, 'lg_test_save', { name: x2.svDraft });
      }
      if (!silent) x2.sheet = 'savename';
    });
    if (silent && !duplicate) toast(t('rx_saved_auto'));
    if (!duplicate && !S.guest && scenario?.id) {
      void createSavedHousingTest({
        scenario_id: scenario.id,
        monthly_payment: Math.round(cost),
        short_month_count: s,
        tested_months: n,
        largest_gap: Math.round(g),
        income_shock_percent: result.income_shock_percent,
        result,
      }).then(record => {
        let pendingName = '';
        up(x2 => {
          const pending = [...x2.keptTests].reverse().find(item => !item.id
            && item.pay === Math.round(cost)
            && item.s === s
            && item.n === n);
          if (pending) {
            pendingName = pending.name || '';
            pending.id = record.id;
            pending.createdAt = record.created_at;
            pending.scenario = record.scenario;
            pending.result = record.result;
          }
        });
        if (pendingName) void updateSavedHousingTest(record.id, { name: pendingName }).catch(() => undefined);
      }).catch(async () => {
        /* A timed-out or dropped response does not mean the server did not
           save. Re-read the list before blaming the save: if the test is there,
           it is simply saved; only report a failure when it truly is missing. */
        let landed = false;
        try {
          await refreshSavedHousingTests();
          up(x2 => {
            landed = x2.keptTests.some(item => !!item.id
              && item.pay === Math.round(cost) && item.s === s && item.n === n);
          });
        } catch { /* the list could not be re-read either */ }
        if (!landed) toast(t('sv_save_failed'), 'error');
      });
    }
  };

  React.useEffect(() => {
    if (!S.autoKeep || S.viewTestName) return;
    up(x2 => { x2.autoKeep = false; });
    keepTest(true);
  }, [S.autoKeep]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScreenShell back title={t('rs_title')}>
      {viewingBanner}
      <GuideTarget id="rx.verdict">{verdict}</GuideTarget>
      {caveat}
      <GuideTarget id="rx.chart">
      <View style={tx.txcard}>
        <Waterline rows={rows} cost={cost} lineLabel prov="calc" monthName={monthName} />
        {legend}
        {shockChips}
      </View>
      </GuideTarget>
      {tryCard ? <GuideTarget id="rx.try">{tryCard}</GuideTarget> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => go('range')} style={tx.hubtile}>
          <View style={tx.hubIc}><Ico name="band" size={22} color="#fff" /></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('rs_range')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink64 }}>{t('rg_tile_d')}</Text>
        </Pressable>
        <Pressable onPress={() => go('compare')} style={tx.hubtile}>
          <View style={tx.hubIc}><Ico name="swap" size={22} color="#fff" /></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('cp_tile')}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink64 }}>{t('cp_tile_d')}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => { up(x2 => { x2.px.budget = null; }); go('priceexplorer'); }} style={[tx.hubtile, tx.hubtileWide]}
        accessibilityRole="button" testID="rx-px">
        <View style={tx.hubIc}><Ico name="search" size={22} color="#fff" /></View>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('px_tile')}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink64 }}>{t('px_tile_d')}</Text>
      </Pressable>
      <BtnLine label={t('rx_how')} onPress={() => up(x2 => { x2.howOpen = !x2.howOpen; })} />
      {S.howOpen ? <Card><BodyS>{t('rs_how_body', { c: nf(cost) })}</BodyS></Card> : null}
    </ScreenShell>
  );
}

export function RangeScreen() {
  const { S, t } = useApp();
  const result = getHousingTestResult();
  const cr = result?.carrying_range;
  if (!cr || !result) return <ScreenShell back title={t('rs_range')}><View /></ScreenShell>;

  /* v24 rework: the band said in words as well as drawn — what every month
     carried, what half the months carried, and where the tested payment sits. */
  const h = S.data.house;
  const lo = cr.lower_monthly_amount;
  const hi = cr.upper_monthly_amount;
  const you = cr.tested_monthly_home_cost;
  const months = result.months ?? [];
  const n = months.length;
  const covered = months.filter(m => (Number(m.available_for_home) || 0) >= you).length;
  const where = you <= lo ? t('rg_w_below', { p: rm(you), a: rm(lo) })
    : you <= hi ? t('rg_w_mid', { p: rm(you), a: rm(lo), b: rm(hi) })
    : t('rg_w_above', { p: rm(you), b: rm(hi) });

  /* rangeChart: a track from zero, the carried band, and the tested marker. */
  const W = 330, TOP = 44, BAR = 22;
  const axisY = TOP + BAR + 26;
  const max = Math.max(hi, you, 1) * 1.18;
  const x = (v: number) => 6 + Math.min(1, Math.max(0, v / max)) * (W - 12);
  const tick = (v: number) =>
    `<line x1="${x(v).toFixed(1)}" y1="${axisY}" x2="${x(v).toFixed(1)}" y2="${axisY + 5}" stroke="#3C5152" stroke-opacity=".4" stroke-width="1.2"/>` +
    `<text x="${x(v).toFixed(1)}" y="${axisY + 18}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="10.5" fill="rgba(60,81,82,.64)">${v ? nf(v) : '0'}</text>`;
  const chartXml = `<svg viewBox="0 0 ${W} 142" xmlns="http://www.w3.org/2000/svg">` +
    `<line x1="6" y1="${axisY}" x2="${W - 6}" y2="${axisY}" stroke="#3C5152" stroke-opacity=".28" stroke-width="1.2"/>` +
    tick(0) + tick(max / 2) + tick(max) +
    `<rect x="6" y="${TOP}" width="${W - 12}" height="${BAR}" rx="${BAR / 2}" fill="rgba(60,81,82,.14)"/>` +
    `<rect x="${x(lo).toFixed(1)}" y="${TOP}" width="${(x(hi) - x(lo)).toFixed(1)}" height="${BAR}" rx="${BAR / 2}" fill="#4A9195" opacity=".85"/>` +
    `<line x1="${x(you).toFixed(1)}" y1="${TOP - 6}" x2="${x(you).toFixed(1)}" y2="${TOP + BAR + 6}" stroke="#B54F2B" stroke-width="2.5"/>` +
    `<text x="${x(lo).toFixed(1)}" y="${TOP + BAR + 16}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="10" fill="rgba(60,81,82,.64)">${t('rg_end_lo')}</text>` +
    `<text x="${x(hi).toFixed(1)}" y="${TOP - 26}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="10" fill="rgba(60,81,82,.64)">${t('rg_end_hi')}</text>` +
    `<text x="${x(you).toFixed(1)}" y="${TOP - 10}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700" fill="#B54F2B">${t('rg_k_you')}</text>` +
    `</svg>`;

  return (
    <ScreenShell back title={t('rs_range')}>
      <BodyS muted>{t('rg_intro')}</BodyS>
      <SvgXml xml={chartXml} width="100%" />
      <Card gap={8}>
        <KV k={t('rg_row_lo')}><Display cls="h-m">{rm(lo)}</Display></KV>
        <KV k={t('rg_row_hi')}><Display cls="h-m">{rm(hi)}</Display></KV>
        <Divider />
        <KV k={t('rg_row_you')}><Display cls="h-m">{rm(you)}</Display></KV>
        <FigRow p="calc" />
        <P style={{ fontSize: 14 }}>{where}</P>
        <BodyS muted>{t('rg_counted', { c: covered, n })}</BodyS>
      </Card>
      <Divider />
      {/* v24 R8f: what "indicative" means lives behind the (i) on the heading. */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Display cls="h-m">{t('rg_price_t')}</Display>
        <CardI t="rg_price_t" b={['rg_ind']} p="assume" />
      </View>
      <P>{t('rg_price', {
        r: h.rate,
        y: h.years,
        p: nf(cr.indicative_property_price_lower),
        q: nf(cr.indicative_property_price_upper),
      })}</P>
    </ScreenShell>
  );
}

export function CompareScreen() {
  const { t, monthName } = useApp();
  const baseResult = getHousingTestResult();
  const testedCost = baseResult?.tested_home_cost ?? 0;
  const scenarioId = getHousingScenario()?.id ?? baseResult?.scenario_id;
  /* v24 defaults; edits stay on this screen. */
  const [payments, setPayments] = React.useState<number[]>([1000, 1200, 1400]);
  const [results, setResults] = React.useState<Record<number, Awaited<ReturnType<typeof runHousingTest>>>>({});
  const paymentsKey = payments.join('|');

  React.useEffect(() => {
    if (!scenarioId) return;
    let active = true;
    void Promise.all(payments.map(async (payment, index) => [index, await runHousingTest(scenarioId, payment)] as const))
      .then(items => {
        if (!active) return;
        setResults(Object.fromEntries(items));
      })
      .catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsKey, scenarioId]);

  return (
    <ScreenShell back title={t('rs_compare')}>
      <BodyS muted>{t('cp_note')}</BodyS>
      {payments.map((p, i) => {
        const result = results[i];
        const n = result?.tested_months ?? 0;
        const shortCount = result?.short_month_count ?? 0;
        const gap = result?.largest_gap ?? 0;
        const rows = (result?.months ?? []).map(r => ({
          m: r.month - 1,
          surplus: r.available_for_home,
          short: r.is_short,
          gap: r.total_shortfall,
        }));
        return (
          <Card key={i} gap={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <NumInput
                value={p}
                style={{ width: 118 }}
                accessibilityLabel={t('cp_pay', { i: i + 1 })}
                onNum={x => setPayments(current => current.map((value, index) => index === i ? Math.max(0, Math.round(x * 100) / 100) : value))}
              />
              <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink, fontWeight: '700' }}>
                  {t('cp_short', { s: shortCount, n })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BodyS muted>{t('cp_gap', { g: nf(gap) })}</BodyS>
                  <Prov p="calc" />
                </View>
              </View>
            </View>
            <View accessibilityLabel={`Payment ${i + 1} recorded-month chart`}>
              <Waterline rows={rows} cost={p} small monthName={monthName} />
            </View>
          </Card>
        );
      })}
    </ScreenShell>
  );
}

export function ShockScreen() {
  const { S, t, monthName, up } = useApp();
  const p = Math.min(90, Math.max(0, S.shock));
  const isCustom = ![0, 10, 20].includes(p);
  const [customOpen, setCustomOpen] = React.useState(isCustom);
  const [customPct, setCustomPct] = React.useState(isCustom ? String(p) : '');
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof runHousingTest>> | null>(null);
  const scenarioId = getHousingScenario()?.id ?? getHousingTestResult()?.scenario_id;

  React.useEffect(() => {
    if (!scenarioId) return;
    let active = true;
    void runHousingTest(scenarioId, undefined, p)
      .then(next => { if (active) setResult(next); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [p, scenarioId]);

  const cost = result?.tested_home_cost ?? 0;
  const rows = (result?.months ?? []).map(r => ({
    m: r.month - 1,
    surplus: r.available_for_home,
    short: r.is_short,
    gap: r.total_shortfall,
  }));
  const n = result?.tested_months ?? 0;
  const shortCount = result?.short_month_count ?? 0;

  return (
    <ScreenShell back title={t('rs_shock')}>
      <Chips>
        {[0, 10, 20].map(v => (
          <Chip
            key={v}
            label={v === 0 ? '0%' : `−${v}%`}
            on={p === v && !customOpen}
            selectionRole="radio"
            onPress={() => {
              setCustomOpen(false);
              setCustomPct('');
              up(x => { x.shock = v; x.sheet = null; });
            }}
          />
        ))}
        <Chip
          label={t('sh_custom')}
          on={customOpen || isCustom}
          selectionRole="radio"
          onPress={() => {
            setCustomOpen(true);
            setCustomPct(isCustom ? String(p) : '');
          }}
        />
      </Chips>
      {customOpen ? (
        <View style={{ gap: 8, maxWidth: 220 }}>
          <BodyS muted>{t('sh_pct')}</BodyS>
          <TextInput
            value={customPct}
            accessibilityLabel="Custom income shock percentage"
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="e.g. 15"
            placeholderTextColor={C.ink40}
            onChangeText={setCustomPct}
            style={{
              minHeight: 46,
              borderWidth: 1.5,
              borderColor: C.ink40,
              borderRadius: 12,
              paddingHorizontal: 14,
              fontSize: 16,
              color: C.ink,
              backgroundColor: C.paper,
            }}
          />
          <Btn
            label={t('done')}
            onPress={() => {
              const raw = Number.parseFloat(customPct);
              const next = Number.isFinite(raw) ? Math.min(90, Math.max(0, raw)) : 0;
              setCustomPct(String(next));
              up(x => { x.shock = next; x.sheet = null; });
            }}
          />
        </View>
      ) : null}
      {/* v24 R8f: what the scenario assumes lives behind the (i) on the heading. */}
      <View accessibilityLabel={`Income shock ${p}% result`}
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Display cls="h-l">{t('sh_head', { p, s: shortCount, n })}</Display>
        <CardI t="rs_shock" b={['sh_note']} p="assume" />
      </View>
      {shortCount ? (
        <KV k={t('gap_lbl')}>
          <Fig value={rm(result?.largest_gap ?? 0)} p="calc" />
        </KV>
      ) : null}
      <View accessibilityLabel={`Income shock ${p}% recorded-month chart`}>
        <Waterline rows={rows} cost={cost} lineLabel prov="assume" monthName={monthName} />
      </View>
    </ScreenShell>
  );
}

const tx = StyleSheet.create({
  hhbought: {
    flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', minHeight: 64,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5,
    borderColor: '#E3EAE8', backgroundColor: '#fff',
  },
  hhboughtIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E4EFEC', alignItems: 'center', justifyContent: 'center' },
  hhmon: {
    width: '100%', backgroundColor: '#21494B', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 16, gap: 14,
  },
  hhmonIc: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  txintro: {
    backgroundColor: '#D3E7E5', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  txctx: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff',
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 8, alignSelf: 'flex-start',
  },
  txcard: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lbl: { fontFamily: DISP_FONT, fontSize: 15, color: C.ink, marginBottom: 10 },
  txamt: {
    flex: 1, minWidth: 0, fontFamily: DISP_FONT, fontSize: 30, lineHeight: 36, color: C.ink, padding: 0,
  },
  depchip: {
    minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, borderColor: C.ink14,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  depchipOn: { backgroundColor: C.ink, borderColor: C.ink },
  txrow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    minHeight: 44, borderTopWidth: 1, borderTopColor: C.ink14, marginTop: 10, paddingTop: 8,
  },
  inseg: {
    flexDirection: 'row', backgroundColor: '#EEF3F2', borderRadius: 14, padding: 4, gap: 4, marginTop: 2,
  },
  insegBtn: { flex: 1, minHeight: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  insegBtnOn: {
    backgroundColor: '#fff',
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pricetip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34,
    backgroundColor: '#FFF4D6', borderWidth: 1.5, borderColor: '#F5D88A', borderRadius: 14,
    paddingVertical: 6, paddingLeft: 10, paddingRight: 12,
  },
  hfit: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  hrow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12,
  },
  hrowIc: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hbadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)',
  },
  hbadgeLock: { backgroundColor: 'rgba(255,255,255,0.6)' },
  hsec: { fontFamily: DISP_FONT, fontSize: 14, color: C.ink64, marginTop: 6, marginBottom: -4, paddingHorizontal: 2 },
  hcard: {
    width: '100%', backgroundColor: C.card, borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 16, minHeight: 92,
    justifyContent: 'center', gap: 10, position: 'relative', overflow: 'hidden',
  },
  hcrow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  hcrowIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#E4EFEC',
    alignItems: 'center', justifyContent: 'center',
  },
  savedchip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.card,
    borderWidth: 1.5, borderColor: 'rgba(60,81,82,0.1)', borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 9, minHeight: 30,
  },
  savedchipN: {
    backgroundColor: C.brand, borderRadius: 999, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  rxv: {
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1.5,
  },
  rxvOk: { backgroundColor: '#E6F5EA', borderColor: '#B9E0C4' },
  rxvWarn: { backgroundColor: '#FFF4DE', borderColor: '#F2D58C' },
  rxvBad: { backgroundColor: '#FDE7E0', borderColor: '#F4C0AF' },
  rxchip: {
    minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderColor: C.ink14,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  rxchipOn: { backgroundColor: C.brand, borderColor: C.brand },
  shockSection: {
    marginTop: 14, borderTopWidth: 1, borderTopColor: C.ink14, paddingTop: 12, gap: 9,
  },
  shockTitle: { fontFamily: DISP_FONT, fontSize: 14, color: C.ink },
  shockChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shockChip: { minWidth: 68, paddingHorizontal: 14 },
  customShockBox: {
    marginTop: 2, padding: 12, borderRadius: 14, backgroundColor: C.card, gap: 7,
  },
  customShockInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customShockInput: {
    flex: 1, minWidth: 0, minHeight: 42, backgroundColor: '#fff', borderWidth: 1.5,
    borderColor: C.ink40, borderRadius: 12, paddingHorizontal: 12, fontFamily: BODY_FONT,
    fontSize: 15, color: C.ink,
  },
  customShockPercent: { fontFamily: DISP_FONT, fontSize: 16, color: C.ink64 },
  customShockApply: {
    minHeight: 42, paddingHorizontal: 15, borderRadius: 12, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  customShockApplyText: { fontFamily: DISP_FONT, fontSize: 13.5, color: '#fff' },
  customShockError: { fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.short },
  customShockDisclaimer: { fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 15, color: C.ink64 },
  rxtry: { backgroundColor: '#D3E7E5', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  btnQuiet: {
    minHeight: 52, backgroundColor: C.card, borderWidth: 1, borderColor: C.ink14, borderRadius: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  hubtile: {
    flex: 1, minHeight: 100, backgroundColor: C.card, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 14, gap: 6,
  },
  /* full width in a column: sized by its content, so the last line is never cut off */
  hubtileWide: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  hubIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
