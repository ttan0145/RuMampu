import React from 'react';
import {
  createSavedHousingTest,
  createHousingScenario,
  fetchSavedHousingTest,
  runHousingTest,
  runPreHousingCheck,
  updateSavedHousingTest,
  updateHousingScenario,
} from '../../../services/housingService';
import {
  getHousingScenario, getHousingTestResult, getPreHousingResult,
  setHousingScenario, setHousingTestResult, setPreHousingResult,
} from '../../../services/housingSession';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useApp } from '../state';
import { logIt } from '../log';
import { monthsAgg, nf, rm } from '../calc';
import { unrepresentedCoverageMonths } from '../money';
import {
  BodyS, Btn, BtnLine, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, KV, NoteC, NumInput, P, Prov,
} from '../ui';
import { Ico } from '../svgs';
import { Ruma } from '../ruma-view';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT } from '../theme';
import { Band, Waterline } from '../charts';
import { ScreenShell } from './shell';
import { PrepareBody } from './prepare';
import { useHousingCalculation } from '../useHousingCalculation';
import { ApiError } from '../../../services/api';

/* v22 house test — the friendly two-card flow: an intro with Ruma, then one
   txcard with price, deposit chips, instalment/other-cost rows and the Run
   button. All figures stay backend-authoritative via useHousingCalculation
   and the housing service. */

function extrasTotal(data: { homeCosts: { a: number }[] }): number {
  return data.homeCosts.reduce((a, c) => a + (+c.a || 0), 0);
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
    setRunning(true);
    void (async () => {
      try {
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
  const { S, t, up } = useApp();
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
            <BodyS muted style={{ marginTop: 12 }}>{t('tx_dep')} · {rm(h.deposit)}</BodyS>
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
export function HousehomeScreen() {
  const { S, t, up, go } = useApp();
  const tab = S.houseTab || 'test';
  return (
    <ScreenShell greet title={t('tab_test')} right={
      <Pressable onPress={() => go('savedtests')} style={tx.savedchip} accessibilityLabel={t('sv_title')}>
        <SvgXml xml={`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 3.5h11V21L12 17l-5.5 4z"/></svg>`} width={13} height={13} />
        <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: C.ink }}>{t('sv_title')}</Text>
        {S.keptTests.length ? (
          <View style={tx.savedchipN}><Text style={{ fontFamily: DISP_FONT, fontSize: 10, color: '#fff' }}>{S.keptTests.length}</Text></View>
        ) : null}
      </Pressable>
    }>
      <View style={tx.inseg}>
        {([['test', 'hh_test'], ['prep', 'hh_prep']] as const).map(([v, k]) => (
          <Pressable key={v} onPress={() => up(s => { s.houseTab = v; })}
            style={[tx.insegBtn, tab === v && tx.insegBtnOn]}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: tab === v ? C.ink : C.ink64 }}>{t(k)}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'prep' ? <PrepareBody /> : <HouseBody />}
      <HouseCostsRow />
    </ScreenShell>
  );
}

/* B3 — the published-figures entry under the hub (US11). The range line
   appears once the data has loaded; the row itself never blocks on it. */
function HouseCostsRow() {
  const { S, t, go, loadHouseCosts } = useApp();
  React.useEffect(() => { void loadHouseCosts(); }, [loadHouseCosts]);
  const stateData = S.houseCosts?.states[S.hcState];
  let range: string | null = null;
  if (stateData?.income) {
    const yearsAll = Object.values(stateData.types.all ?? {})
      .map(([, median]) => median / (stateData.income! * 12));
    if (yearsAll.length) {
      range = t('hc_span', {
        a: Math.min(...yearsAll).toFixed(1),
        b: Math.max(...yearsAll).toFixed(1),
        s: stateData.name,
      });
    }
  }
  return (
    <Pressable onPress={() => go('homecosts')} style={tx.hcrow}>
      <View style={tx.hcrowIc}>
        <SvgXml xml={`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3F7A7E" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h16"/><path d="M6 20v-7"/><path d="M11 20V9"/><path d="M16 20V5"/></svg>`} width={20} height={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, lineHeight: 18, color: C.ink }}>{t('hh_cost')}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 15, color: C.ink64, marginTop: 2 }}>{t('hh_cost_d')}</Text>
        {range ? (
          <View style={{ marginTop: 6, gap: 4 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.ink14, overflow: 'hidden' }}>
              <View style={{ width: '55%', height: '100%', borderRadius: 3, backgroundColor: '#8FBC8F' }} />
            </View>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink64 }}>{range}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 16, color: C.ink }}>→</Text>
    </Pressable>
  );
}

export function HouseScreen() {
  const { t } = useApp();
  return (
    <ScreenShell back title={t('th_title')}>
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
      {S.keptTests.length ? S.keptTests.map((k, i) => (
        <View key={k.id || i} style={tx.txcard}>
          {k.name ? <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink, marginBottom: 4 }}>{k.name}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 15, color: C.ink }}>
              <Text style={{ fontFamily: DISP_FONT }}>{rm(k.pay)}</Text> {t('mo_permo')}
            </Text>
            <Fig value={t('cp_short', { s: k.s, n: k.n })} p="calc" cls="body-s" />
          </View>
          <BodyS muted style={{ marginTop: 4 }}>
            {k.g ? `${t('gap_lbl')} ${rm(k.g)} · ` : ''}{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : t('edit')}
          </BodyS>
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
            <BtnLine label={t('sv_open_l')} onPress={() => { void openSavedTest(i); }} />
            <BtnLine label={t('sv_edit_l')} onPress={() => up(s => { s.svIdx = i; s.svDelArm = false; s.sheet = 'svedit'; })} />
          </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 15, color: C.ink }}>{t('tc_inst')}</Text>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64 }}>{t('tc_inst_desc')}</Text>
            </View>
            <Text style={{ fontSize: 18, fontFamily: DISP_FONT, color: C.ink }}>{rm(inst)}</Text>
          </View>
          <EditList
            decimal
            list={S.data.homeCosts.map(c => ({
              ...c,
              p: undefined,
              description: t(`${c.k}_desc`),
            }))}
            onNum={(i, n) => up(s => { s.data.homeCosts[i].a = n; })}
          />
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

function comparisonPaymentsAround(currentCost: number): number[] {
  const current = Math.max(0, Math.round((Number(currentCost) || 0) * 100) / 100);
  const step = 200;
  return [
    Math.max(0, Math.round((current - step) * 100) / 100),
    current,
    Math.round((current + step) * 100) / 100,
  ];
}

export function ResultScreen() {
  const { S, t, monthName, up, go, toast } = useApp();
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
  const shockIsCustom = ![0, 10, 20].includes(shock);
  const [customShockOpen, setCustomShockOpen] = React.useState(shockIsCustom);
  const [customShockText, setCustomShockText] = React.useState(shockIsCustom ? String(shock) : '');
  const [customShockError, setCustomShockError] = React.useState('');

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

  const caveat = un.length
    ? <NoteC><BodyS>{t('rs_limit_slow', { m: un.map(monthName).join(', ') })}</BodyS></NoteC>
    : n < 4 ? <NoteC><BodyS>{t('rs_limit_thin', { n })}</BodyS></NoteC> : null;

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

  const applyCustomShock = () => {
    const value = customShockText.trim();

    // Accept 0-90 with up to 2 decimal places.
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      setCustomShockError('Enter a percentage using up to 2 decimal places.');
      return;
    }

    const next = Number(value);
    if (!Number.isFinite(next) || next < 0 || next > 90) {
      setCustomShockError('Enter a percentage from 0 to 90.');
      return;
    }

    setCustomShockError('');
    setCustomShockText(String(next));
    up(x => { x.shock = next; });
  };

  const shockChips = (
    <View style={tx.shockSection}>
      <Text style={tx.shockTitle}>{t('rx_drop')}</Text>

      <View style={tx.shockChipRow}>
        {[0, 10, 20].map(v => (
          <Pressable
            key={v}
            onPress={() => {
              setCustomShockOpen(false);
              setCustomShockError('');
              up(x => { x.shock = v; });
            }}
            style={[tx.rxchip, tx.shockChip, shock === v && !customShockOpen && tx.rxchipOn]}
          >
            <Text
              style={{
                fontFamily: SEMI_FONT,
                fontSize: 13,
                color: shock === v && !customShockOpen ? '#fff' : C.ink,
              }}
            >
              {v ? `−${v}%` : '0%'}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            setCustomShockOpen(true);
            setCustomShockError('');
            if (shockIsCustom) setCustomShockText(String(shock));
          }}
          style={[tx.rxchip, tx.shockChip, (customShockOpen || shockIsCustom) && tx.rxchipOn]}
        >
          <Text
            style={{
              fontFamily: SEMI_FONT,
              fontSize: 13,
              color: customShockOpen || shockIsCustom ? '#fff' : C.ink,
            }}
          >
            {t('rx_custom')}
          </Text>
        </Pressable>
      </View>

      {customShockOpen ? (
        <View style={tx.customShockBox}>
          <BodyS muted>{t('sh_pct')}</BodyS>
          <View style={tx.customShockInputRow}>
            <TextInput
              value={customShockText}
              accessibilityLabel="Custom income shock percentage"
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="e.g. 15.5"
              placeholderTextColor={C.ink40}
              onChangeText={value => {
                setCustomShockText(value);
                setCustomShockError('');
              }}
              onSubmitEditing={applyCustomShock}
              style={tx.customShockInput}
            />
            <Text style={tx.customShockPercent}>%</Text>
            <Pressable onPress={applyCustomShock} style={tx.customShockApply}>
              <Text style={tx.customShockApplyText}>{t('done')}</Text>
            </Pressable>
          </View>
          {customShockError ? <Text style={tx.customShockError}>{customShockError}</Text> : null}
          <Text style={tx.customShockDisclaimer}>{t('sh_disclaimer')}</Text>
        </View>
      ) : null}
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
      {cost > lo ? (
        <View style={{ marginTop: 10 }}>
          <Btn label={t('rx_try_btn', { p: rm(lo) })} onPress={() => up(x => { x.tryPay = lo; })} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {comparisonPaymentsAround(cost).map(v => (
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

  const keepTest = () => {
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
      x2.sheet = 'savename';
    });
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
      }).catch(() => {
        toast(t('housing_run_failed'), 'error');
      });
    }
  };

  return (
    <ScreenShell back title={t('rs_title')}>
      {viewingBanner}
      {verdict}
      {caveat}
      <View style={tx.txcard}>
        <Waterline rows={rows} cost={cost} lineLabel prov="calc" monthName={monthName} />
        {legend}
        {shockChips}
      </View>
      {s ? (
        <Card gap={8}>
          <Display cls="h-m">{t('rs_shortfall_breakdown')}</Display>
          <KV k={t('rs_existing_shortfall')}>
            <Fig value={`${result.existing_short_month_count} / ${n}`} p="calc" />
          </KV>
          <KV k={t('rs_housing_shortfall')}>
            <Fig value={`${result.housing_created_short_month_count} / ${n}`} p="calc" />
          </KV>
          <BodyS muted>{t('rs_shortfall_breakdown_note')}</BodyS>
        </Card>
      ) : null}
      {tryCard}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn label={t('rx_keep')} onPress={keepTest} />
        </View>
        <Pressable onPress={() => go('house')} style={[tx.btnQuiet, { flex: 1, justifyContent: 'center' }]}>
          <P>{t('rx_change')}</P>
        </Pressable>
      </View>
      <BodyS muted>{t('rs_keep_hint')}</BodyS>
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
      <BtnLine label={t('rx_how')} onPress={() => up(x2 => { x2.howOpen = !x2.howOpen; })} />
      {S.howOpen ? <Card><BodyS>{t('rs_how_body', { c: nf(cost) })}</BodyS></Card> : null}
    </ScreenShell>
  );
}

export function RangeScreen() {
  const { S, t, up } = useApp();
  const result = getHousingTestResult();
  const cr = result?.carrying_range;
  if (!cr) return <ScreenShell back title={t('rs_range')}><View /></ScreenShell>;

  const h = S.data.house;
  const loValue = cr.lower_monthly_amount;
  const hiValue = cr.upper_monthly_amount;
  const you = cr.tested_monthly_home_cost;
  const lo = loValue * 0.8;
  const hiS = Math.max(hiValue, you, loValue + 1) * 1.15;
  const pos = (v: number) => Math.min(100, Math.max(0, (v - lo) / (hiS - lo) * 100));

  return (
    <ScreenShell back title={t('rs_range')}>
      <Display cls="h-l">{t('rg_lead', { a: nf(loValue), b: nf(hiValue) })}</Display>
      <FigRow p="calc" />
      <Band
        loPct={pos(loValue)} hiPct={pos(hiValue)} pinPct={pos(you)}
        pinTop={rm(you)} pinBottom={t('rg_pin')} prov="calc"
      />
      <BtnLine label={t('rg_how')} onPress={() => up(s => { s.rgHowOpen = !s.rgHowOpen; })} />
      {S.rgHowOpen ? (
        <Card>
          <BodyS>{t('rg_how_body', { a: nf(loValue), b: nf(hiValue) })}</BodyS>
        </Card>
      ) : null}
      <Divider />
      <P>{t('rg_price', {
        r: h.rate,
        y: h.years,
        p: nf(cr.indicative_property_price_lower),
        q: nf(cr.indicative_property_price_upper),
      })}</P>
      <FigRow p="assume" />
      <BodyS muted>{cr.property_price_limitation || t('rg_ind')}</BodyS>
    </ScreenShell>
  );
}

export function CompareScreen() {
  const { t, monthName } = useApp();
  const baseResult = getHousingTestResult();
  const testedCost = baseResult?.tested_home_cost ?? 0;
  const scenarioId = getHousingScenario()?.id ?? baseResult?.scenario_id;
  const [payments, setPayments] = React.useState<number[]>(() => comparisonPaymentsAround(testedCost));
  const [results, setResults] = React.useState<Record<number, Awaited<ReturnType<typeof runHousingTest>>>>({});
  const paymentsKey = payments.join('|');

  React.useEffect(() => {
    setPayments(comparisonPaymentsAround(testedCost));
  }, [testedCost]);

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
        const indicativePrice = result?.indicative_tested_property_price ?? 0;
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
            <P>{t('cp_price', { payment: nf(p), price: nf(indicativePrice) })}</P>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <BodyS muted>{t('cp_price_note')}</BodyS>
              <Prov p="assume" />
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
      <BodyS muted>{t('sh_disclaimer')}</BodyS>
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
      <View accessibilityLabel={`Income shock ${p}% result`}>
        <Display cls="h-l">{t('sh_head', { p, s: shortCount, n })}</Display>
      </View>
      <FigRow p="assume" />
      {shortCount ? (
        <KV k={t('gap_lbl')}>
          <Fig value={rm(result?.largest_gap ?? 0)} p="calc" />
        </KV>
      ) : null}
      <View accessibilityLabel={`Income shock ${p}% recorded-month chart`}>
        <Waterline rows={rows} cost={cost} lineLabel prov="assume" monthName={monthName} />
      </View>
      <BodyS muted>{t('sh_note')}</BodyS>
    </ScreenShell>
  );
}

const tx = StyleSheet.create({
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
  hubIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
