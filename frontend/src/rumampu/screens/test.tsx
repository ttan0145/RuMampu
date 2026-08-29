import React from 'react';
import {
  createHousingScenario,
  runHousingTest,
  runPreHousingCheck,
  updateHousingScenario,
} from '../../../services/housingService';
import {
  getHousingScenario, getHousingTestResult, getPreHousingResult,
  setHousingScenario, setHousingTestResult, setPreHousingResult,
} from '../../../services/housingSession';
import { Text, TextInput, View } from 'react-native';
import { useApp } from '../state';
import { nf, rm } from '../calc';
import { unrepresentedCoverageMonths } from '../money';
import {
  BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, NumInput, P, Prov,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { Band, Waterline } from '../charts';
import { ScreenShell } from './shell';
import { useHousingCalculation } from '../useHousingCalculation';
import { ApiError } from '../../../services/api';

export function HouseScreen() {
  const { S, t, up, go } = useApp();
  const h = S.data.house;
  const calc = useHousingCalculation(S.data);
  const inst = calc?.monthly_instalment ?? 0;
  const known = h.knownPayment != null;
  return (
    <ScreenShell back title={t('th_title')}>
      {!known ? (
        <>
          <Card gap={8}>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_price')}</BodyS>
              <NumInput value={h.price} onNum={n => up(s => { s.data.house.price = n; })} />
            </View>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_dep')}</BodyS>
              <NumInput value={h.deposit} onNum={n => up(s => { s.data.house.deposit = Math.max(0, n); })} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <BodyS muted>{t('th_dep0')}</BodyS>
              <Prov p="official" />
            </View>
            <KV k={t('th_fin')}><Fig value={rm(calc?.financing_amount ?? 0)} p="calc" /></KV>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_rate')}</BodyS>
              <NumInput decimal value={h.rate} onNum={n => up(s => { s.data.house.rate = n; })} />
            </View>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_ten')}</BodyS>
              <NumInput value={h.years} onNum={n => up(s => { s.data.house.years = n || 1; })} />
            </View>
          </Card>
          <KV k={t('th_inst')}><Fig value={rm(inst)} p="calc" cls="h-l" /></KV>
          <BtnLine label={t('th_known')} onPress={() => up(s => {
            s.data.house.knownPayment = Math.round(calc?.monthly_instalment ?? 0);
          })} />
        </>
      ) : (
        <>
          <Card gap={8}>
            <View style={{ gap: 6 }}>
              <BodyS muted>{t('th_knownamt')}</BodyS>
              <NumInput value={+(h.knownPayment || 0)} onNum={n => up(s => { s.data.house.knownPayment = n; })} />
            </View>
            <FigRow p="user" />
          </Card>
          <BtnLine label={t('cancel')} onPress={() => up(s => { s.data.house.knownPayment = null; })} />
        </>
      )}
      <Btn label={t('th_next') + ' →'} onPress={() => go('homecost')} />
    </ScreenShell>
  );
}

export function HomecostScreen() {
  const { S, t, up, go, toast } = useApp();
  const calc = useHousingCalculation(S.data);
  const [running, setRunning] = React.useState(false);
  const inst = calc?.monthly_instalment ?? 0;
  const total = calc?.total_monthly_cost ?? 0;
  return (
    <ScreenShell back title={t('tc_title')}>
      <Fig value={rm(total)} p="calc" cls="h-xl" />
      <BodyS muted>{t('tc_point')}</BodyS>
      <BtnQuiet arrow={false} onPress={() => up(s => { s.tcOpen = !s.tcOpen; })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <P>{t('tc_break')}</P>
          <Text style={{ fontSize: 16, color: C.ink }}>{S.tcOpen ? '−' : '+'}</Text>
        </View>
      </BtnQuiet>
      {S.tcOpen ? (
        <Card gap={8}>
          <KV k={t('tc_inst')}>
            <Fig value={rm(inst)} p={S.data.house.knownPayment != null ? 'user' : 'calc'} />
          </KV>
          <EditList
            list={S.data.homeCosts.map(c => ({ ...c, p: 'assume' }))}
            onNum={(i, n) => up(s => { s.data.homeCosts[i].a = n; })}
          />
        </Card>
      ) : null}
      <Btn label={t(running ? 'housing_running' : 'tc_run') + (running ? '' : ' →')} disabled={running} onPress={() => {
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
      }} />
    </ScreenShell>
  );
}

export function PrecheckScreen() {
  const { t, monthName, goTab, up } = useApp();
  const result = getPreHousingResult();
  React.useEffect(() => {
    up(state => { state.stack = ['homecost']; });
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
  const { S, t, monthName, up, go } = useApp();
  React.useEffect(() => {
    up(state => { state.stack = ['homecost']; });
  }, [up]);

  const result = getHousingTestResult();
  if (!result) return <ScreenShell back title={t('rs_title')}><View /></ScreenShell>;

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
  const un = unrepresentedCoverageMonths(S.incomeCoverage);

  // EN: US8.2 only owns the "keep this test" layer here. Array.some() checks
  // whether one kept summary already matches the current displayed result and
  // returns a boolean for the before/after Keep This Test UI.
  // 中文：US8.2 在这里仅负责“留存这次测试”这一层。Array.some() 会检查是否已有一条留存摘要
  // 与当前展示结果一致，并返回布尔值来决定按钮或已留存状态的显示。
  const kept = S.keptTests.some(test => (
    test.pay === Math.round(cost)
    && test.s === s
    && test.n === n
    && test.g === Math.round(g)
  ));

  let lead: React.ReactNode;
  const headline = s ? t('headline', { s, n }) : t('headline_zero', { n });
  if (un.length) {
    lead = (
      <>
        <NoteC><Display cls="h-l">{t('rs_limit_slow', { m: un.map(monthName).join(', ') })}</Display></NoteC>
        <Display cls="h-m">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  } else if (n < 4) {
    lead = (
      <>
        <NoteC><Display cls="h-l">{t('rs_limit_thin', { n })}</Display></NoteC>
        <Display cls="h-m">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  } else {
    lead = (
      <>
        <Display cls="h-xl">{headline}</Display>
        <FigRow p="calc" />
      </>
    );
  }

  return (
    <ScreenShell back title={t('rs_title')}>
      {lead}
      {s ? <KV k={t('gap_lbl')}><Fig value={rm(g)} p="calc" /></KV> : null}
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
      <Waterline rows={rows} cost={cost} lineLabel prov="calc" monthName={monthName} />
      <BtnLine label={t('rs_how')} onPress={() => up(x2 => { x2.howOpen = !x2.howOpen; })} />
      {S.howOpen ? <Card><BodyS>{t('rs_how_body', { c: nf(cost) })}</BodyS></Card> : null}
      {kept ? (
        // EN: AC8.2.2/AC8.2.5 show the kept status after saving and repeat the
        // session-only scope instead of implying permanent account storage.
        // 中文：AC8.2.2/AC8.2.5 在保存后显示已留存状态，并再次说明仅限本次会话，不暗示永久账号存储。
        <View style={{
          gap: 4,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C.ink14,
          backgroundColor: C.card,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.confirm, fontSize: 18, lineHeight: 20 }}>✓</Text>
            <Display cls="h-m" style={{ fontSize: 17, lineHeight: 23 }}>{t('rs_kept')}</Display>
          </View>
          <BodyS muted>{t('rs_kept_session')}</BodyS>
        </View>
      ) : (
        <BtnQuiet
          arrow={false}
          style={{ backgroundColor: C.paper, borderColor: C.brand }}
          onPress={() => {
            up(x2 => {
              // EN: Re-check inside the state update so repeated taps cannot add
              // duplicates. The compared fields are the monthly payment, short
              // month count, tested month count, and largest gap; rounded money
              // values match what Your Record displays.
              // 中文：在状态更新内部再次检查，避免重复点击加入重复卡片。比较字段包括月供、短缺月份数、
              // 测试月份数和最大缺口；金额先 Math.round()，与“记录档案”的展示保持一致。
              const duplicate = x2.keptTests.some(test => (
                test.pay === Math.round(cost)
                && test.s === s
                && test.n === n
                && test.g === Math.round(g)
              ));
              if (!duplicate) {
                // EN: Iteration 1 stores only the summary fields Your Record
                // needs in frontend session state, not a persistent account copy
                // of the whole HousingTestResult.
                // 中文：Iteration 1 只把“记录档案”需要的摘要字段放进前端会话状态，
                // 不保存完整 HousingTestResult，也不是账号级永久存储。
                x2.keptTests.push({
                  pay: Math.round(cost),
                  s,
                  n,
                  g: Math.round(g),
                });
              }
            });
          }}
        >
          <IcLab name="book">
            <View style={{ gap: 2 }}>
              <P>{t('rs_keep')}</P>
              <BodyS muted>{t('rs_keep_hint')}</BodyS>
            </View>
          </IcLab>
        </BtnQuiet>
      )}
      <View style={{ gap: 8 }}>
        <BtnQuiet onPress={() => go('range')}><IcLab name="band"><P>{t('rs_range')}</P></IcLab></BtnQuiet>
        <BtnQuiet onPress={() => go('compare')}><IcLab name="columns"><P>{t('rs_compare')}</P></IcLab></BtnQuiet>
        <BtnQuiet onPress={() => go('shock')}><IcLab name="trend"><P>{t('rs_shock')}</P></IcLab></BtnQuiet>
      </View>
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
  const { S, t, monthName, up } = useApp();
  const [results, setResults] = React.useState<Record<number, Awaited<ReturnType<typeof runHousingTest>>>>({});
  const paymentsKey = S.data.comparePayments.join('|');
  const scenarioId = getHousingScenario()?.id ?? getHousingTestResult()?.scenario_id;

  React.useEffect(() => {
    if (!scenarioId) return;
    let active = true;
    void Promise.all(S.data.comparePayments.map(async (payment, index) => [index, await runHousingTest(scenarioId, payment)] as const))
      .then(items => {
        if (!active) return;
        setResults(Object.fromEntries(items));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [paymentsKey, scenarioId]);

  return (
    <ScreenShell back title={t('rs_compare')}>
      <BodyS muted>{t('cp_note')}</BodyS>
      {S.data.comparePayments.map((p, i) => {
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
                onNum={x => up(st => { st.data.comparePayments[i] = Math.max(0, x); })}
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
