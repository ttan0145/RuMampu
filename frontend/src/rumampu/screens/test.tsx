import React from 'react';
import { createHousingScenario, runPreHousingCheck, updateHousingScenario } from '../../../services/housingService';
import { getHousingScenarioId, getPreHousingResult, setHousingScenarioId, setPreHousingResult } from '../../../services/housingSession';
import { Text, View } from 'react-native';
import { useApp } from '../state';
import {
  carryRange, currentInstalment, extrasTotal, monthsAgg, nf, priceForInstalment,
  rm, testRows, totalHomeCost,
} from '../calc';
import { unrepresentedCoverageMonths } from '../money';
import {
  BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, NumInput, P, Prov,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { Band, Waterline } from '../charts';
import { ScreenShell } from './shell';

export function HouseScreen() {
  const { S, t, up, go, toast } = useApp();
  const [saving, setSaving] = React.useState(false);
  const h = S.data.house;
  const inst = currentInstalment(S.data);
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
            <KV k={t('th_fin')}><Fig value={rm(Math.max(0, h.price - h.deposit))} p="calc" /></KV>
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
            s.data.house.knownPayment = Math.round(currentInstalment(s.data));
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
      <Btn label={saving ? 'Saving…' : t('th_next') + ' →'} onPress={() => {
        if (saving) return;
        setSaving(true);
        void createHousingScenario(S.data)
          .then(result => {
            setHousingScenarioId(result.id);
            setPreHousingResult(null);
            go('homecost');
          })
          .catch(() => toast('Could not save the housing scenario. Check that the Django backend is running.'))
          .finally(() => setSaving(false));
      }} />
    </ScreenShell>
  );
}

export function HomecostScreen() {
  const { S, t, up, go, toast } = useApp();
  const [checking, setChecking] = React.useState(false);
  const inst = currentInstalment(S.data);
  const total = totalHomeCost(S.data);
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
      <Btn label={checking ? 'Checking…' : t('tc_run') + ' →'} onPress={() => {
        if (checking) return;
        setChecking(true);
        void (async () => {
          try {
            let scenarioId = getHousingScenarioId();
            if (scenarioId == null) {
              const created = await createHousingScenario(S.data);
              scenarioId = created.id;
              setHousingScenarioId(created.id);
            }
            await updateHousingScenario(scenarioId, S.data);
            const result = await runPreHousingCheck(S.data);
            setPreHousingResult(result);
            up(state => {
              state.testRan = !result.has_existing_shortfall;
              state.howOpen = false;
              state.rgHowOpen = false;
            });
            go(result.has_existing_shortfall ? 'precheck' : 'result');
          } catch {
            toast('Could not run the housing check. Check that the Django backend is running.');
          } finally {
            setChecking(false);
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
    up(state => { state.stack = ['house']; });
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
  const { S, t, monthName, up, go, toast } = useApp();
  React.useEffect(() => {
    up(state => { state.stack = ['house']; });
  }, [up]);
  const cost = totalHomeCost(S.data);
  const rows = testRows(S.data, cost);
  const n = rows.length, s = rows.filter(r => r.short).length;
  const g = Math.max(...rows.map(r => r.gap), 0);
  const un = unrepresentedCoverageMonths(S.incomeCoverage);

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
      <Waterline rows={rows} cost={cost} lineLabel prov="calc" monthName={monthName} />
      <BtnLine label={t('rs_how')} onPress={() => up(x2 => { x2.howOpen = !x2.howOpen; })} />
      {S.howOpen ? <Card><BodyS>{t('rs_how_body', { c: nf(cost) })}</BodyS></Card> : null}
      <BtnLine label={t('rs_keep')} onPress={() => {
        up(x2 => {
          x2.keptTests.push({
            pay: Math.round(cost),
            s: rows.filter(r => r.short).length,
            n: rows.length,
            g: Math.round(Math.max(...rows.map(r => r.gap), 0)),
          });
        });
        toast(t('rs_kept'));
      }} />
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
  const cr = carryRange(S.data);
  if (!cr) return <ScreenShell back title={t('rs_range')}><View /></ScreenShell>;
  const h = S.data.house, ex = extrasTotal(S.data);
  const rd = (v: number) => Math.round(v / 1000) * 1000;
  const pLo = rd(priceForInstalment(S.data, cr.lo - ex) + h.deposit);
  const pHi = rd(priceForInstalment(S.data, cr.hi - ex) + h.deposit);
  const you = totalHomeCost(S.data);
  const lo = cr.lo * 0.8, hiS = Math.max(cr.hi, you) * 1.15;
  const pos = (v: number) => Math.min(100, Math.max(0, (v - lo) / (hiS - lo) * 100));
  return (
    <ScreenShell back title={t('rs_range')}>
      <Display cls="h-l">{t('rg_lead', { a: nf(cr.lo), b: nf(cr.hi) })}</Display>
      <FigRow p="calc" />
      <Band
        loPct={pos(cr.lo)} hiPct={pos(cr.hi)} pinPct={pos(you)}
        pinTop={rm(you)} pinBottom={t('rg_pin')} prov="calc"
      />
      <BtnLine label={t('rg_how')} onPress={() => up(s => { s.rgHowOpen = !s.rgHowOpen; })} />
      {S.rgHowOpen ? <Card><BodyS>{t('rg_how_body', { a: nf(cr.lo), b: nf(cr.hi) })}</BodyS></Card> : null}
      <Divider />
      <P>{t('rg_price', { r: h.rate, y: h.years, p: nf(pLo), q: nf(pHi) })}</P>
      <FigRow p="assume" />
      <BodyS muted>{t('rg_ind')}</BodyS>
    </ScreenShell>
  );
}

export function CompareScreen() {
  const { S, t, monthName, up } = useApp();
  const n = monthsAgg(S.data).length;
  return (
    <ScreenShell back title={t('rs_compare')}>
      <BodyS muted>{t('cp_note')}</BodyS>
      {S.data.comparePayments.map((p, i) => {
        const rows = testRows(S.data, p);
        const s = rows.filter(r => r.short).length;
        const g = Math.max(...rows.map(r => r.gap), 0);
        return (
          <Card key={i} gap={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <NumInput
                value={p} style={{ width: 118 }}
                onNum={x => up(st => { st.data.comparePayments[i] = Math.max(0, x); })}
              />
              <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
                <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink, fontWeight: '700' }}>
                  {t('cp_short', { s, n })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BodyS muted>{t('cp_gap', { g: nf(g) })}</BodyS>
                  <Prov p="calc" />
                </View>
              </View>
            </View>
            <Waterline rows={rows} cost={p} small monthName={monthName} />
          </Card>
        );
      })}
    </ScreenShell>
  );
}

export function ShockScreen() {
  const { S, t, monthName, up } = useApp();
  const cost = totalHomeCost(S.data);
  const p = S.shock;
  const rows = testRows(S.data, cost, p);
  const n = rows.length, s = rows.filter(r => r.short).length;
  const preset = [0, 10, 20].includes(p);
  const showCustom = !preset || S.sheet === 'shockcustom';
  return (
    <ScreenShell back title={t('rs_shock')}>
      <Chips>
        {[0, 10, 20].map(v => (
          <Chip key={v} label={v === 0 ? '0%' : `−${v}%`} on={p === v}
            onPress={() => up(x => { x.shock = v; x.sheet = null; })} />
        ))}
        <Chip label={t('sh_custom')} on={!preset}
          onPress={() => up(x => { x.sheet = 'shockcustom'; })} />
      </Chips>
      {showCustom ? (
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('sh_pct')}</BodyS>
          <NumInput value={p} onNum={x => up(st => { st.shock = Math.min(90, Math.max(0, x)); })} />
        </View>
      ) : null}
      <Display cls="h-l">{t('sh_head', { p, s, n })}</Display>
      <FigRow p="assume" />
      {s ? (
        <KV k={t('gap_lbl')}>
          <Fig value={rm(Math.max(...rows.map(r => r.gap), 0))} p="calc" />
        </KV>
      ) : null}
      <Waterline rows={rows} cost={cost} lineLabel prov="assume" monthName={monthName} />
      <BodyS muted>{t('sh_note')}</BodyS>
    </ScreenShell>
  );
}
