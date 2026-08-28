import React from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../state';
import { MOCK } from '../mock';
import { ApiCoverageAnswer, INCOME_API_ENABLED } from '../api';
import { formatApiMoney } from '../money';
import {
  actualMonths, commitTotal, expByMonth, expCatTotals, latestExpMonth,
  monthsAgg, nf, recordSummary, rm,
} from '../calc';
import {
  BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, NumInput, P, Prov, StackS, TextField,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { Donut, DonutLegend, IncomePatternChart } from '../charts';
import { ScreenShell } from './shell';
import { isValidIsoDate } from '../validation';
import { DatePickerField } from '../date-picker';

export function MoneyScreen() {
  const { S, t, monthName, go } = useApp();
  const agg = monthsAgg(S.data);
  const netAvg = agg.reduce((a, r) => a + r.net, 0) / Math.max(1, agg.length);
  const ek = latestExpMonth(S.data);

  let donuts: React.ReactNode = null;
  if (ek != null) {
    const spend = [...expCatTotals(S.data, ek).entries()].sort((a, b) => b[1] - a[1])
      .map(([c, v]) => ({ label: catLabel(S, t, c), v }));
    const lastInc = agg[agg.length - 1];
    const srcTot = new Map<string, number>();
    for (const e of S.data.income) {
      const k = (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1);
      if (!lastInc || k !== lastInc.y * 12 + lastInc.m) continue;
      const sourceKey = e.method === 'historical_total' ? '__monthly_total__' : e.s;
      srcTot.set(sourceKey, (srcTot.get(sourceKey) || 0) + (+e.a || 0));
    }
    const srcLabel = (id: string) => {
      if (id === '__monthly_total__') return t('inc_month_total');
      const x = S.data.sources.find(z => z.id === id);
      return x ? (x.custom ? x.name || '' : t(x.k || '')) : id;
    };
    const inc = [...srcTot.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ label: srcLabel(id), v }));
    const spendTotal = spend.reduce((a, x) => a + x.v, 0);
    const incTotal = inc.reduce((a, x) => a + x.v, 0);
    const sect = (title: string, slices: { label: string; v: number }[], total: number) => (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <BodyS muted>{title}</BodyS>
          <Prov p="calc" />
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Donut slices={slices} centerLabel={rm(total)} />
          <View style={{ flex: 1, minWidth: 0 }}><DonutLegend slices={slices} /></View>
        </View>
      </>
    );
    donuts = (
      <Card gap={8}>
        {sect(t('hb_spend', { m: monthName(ek % 12) }), spend, spendTotal)}
        <Divider />
        {sect(t('hb_income', { m: lastInc ? monthName(lastInc.m) : '' }), inc, incTotal)}
      </Card>
    );
  }

  const rows: [string, string, string][] = [
    ['income', 'money_income', 'banknote'], ['workcosts', 'money_workcosts', 'wrench'],
    ['commit', 'money_commit', 'calendar'], ['expenses', 'money_expenses', 'receipt'],
    ['pattern', 'money_pattern', 'bars'], ['coverage', 'money_coverage', 'search'],
    ['record', 'money_record', 'book'],
  ];

  return (
    <ScreenShell title={t('tab_money')}>
      <Card>
        <BodyS muted>{t('net_lbl')}</BodyS>
        <Fig value={rm(netAvg)} p="calc" cls="h-l" />
        <BodyS muted>{t('per_month')}</BodyS>
      </Card>
      {donuts}
      {rows.map(([r, k, ic]) => (
        <BtnQuiet key={r} onPress={() => go(r as never)}>
          <IcLab name={ic}><P>{t(k)}</P></IcLab>
        </BtnQuiet>
      ))}
    </ScreenShell>
  );
}

function catLabel(S: ReturnType<typeof useApp>['S'], t: (k: string) => string, id: string): string {
  const c = S.data.expenseCats.find(x => x.id === id);
  return c ? (c.custom ? c.name || '' : t(c.k || '')) : id;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Display cls="h-m" style={{ fontSize: 17, lineHeight: 23 }}>{children}</Display>;
}

function RecordMetric({ value, label }: { value: string; label: string }) {
  return (
    <View accessibilityLabel={`${value} ${label}`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Display cls="h-l">{value}</Display>
      <BodyS muted>{label}</BodyS>
    </View>
  );
}

function SessionStatus({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: C.confirm, fontSize: 16, lineHeight: 18 }}>✓</Text>
      <BodyS muted>{label}</BodyS>
    </View>
  );
}

export function RecordScreen() {
  const { S, t, monthName, go } = useApp();
  const summary = recordSummary(S.data);
  const n = summary.recordedMonthCount;
  const last = summary.latestEntryDate;
  const lastLbl = last ? `${+last.slice(8, 10)} ${monthName(+last.slice(5, 7) - 1)} ${last.slice(0, 4)}` : '';
  return (
    <ScreenShell back title={t('money_record')}>
      <Card gap={12}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SectionTitle>{t('rc_summary')}</SectionTitle>
          <Prov p="user" />
        </View>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <RecordMetric value={String(n)} label={t(n === 1 ? 'rc_month_metric_one' : 'rc_month_metric')} />
          <RecordMetric value={String(summary.entryCount)} label={t('rc_entry_metric')} />
        </View>
        <Divider />
        <View style={{ gap: 2 }}>
          <BodyS muted>{t('rc_latest_label')}</BodyS>
          {lastLbl ? <Display cls="h-m">{lastLbl}</Display> : <BodyS>{t('rc_latest_empty')}</BodyS>}
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <SectionTitle>{t('rc_tests')}</SectionTitle>
        {S.keptTests.length ? S.keptTests.map((k, i) => (
          <Card key={i} gap={12}>
            <View style={{ gap: 2 }}>
              <Fig value={t('rc_pay_month', { p: rm(k.pay) })} p="calc" cls="h-m" />
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <RecordMetric value={t('rc_short_value', { s: k.s, n: k.n })} label={t('rc_short_label')} />
              <RecordMetric value={rm(k.g)} label={t('gap_lbl')} />
            </View>
            <SessionStatus label={t('rc_test_session')} />
          </Card>
        )) : (
          <Card gap={10}>
            <View style={{ gap: 3 }}>
              <Display cls="h-m" style={{ fontSize: 17, lineHeight: 23 }}>{t('rc_none_title')}</Display>
              <BodyS muted>{t('rc_none_body')}</BodyS>
            </View>
            <BtnQuiet onPress={() => go('house')} style={{ backgroundColor: C.paper }}>
              <IcLab name="book"><P>{t('rc_test_action')}</P></IcLab>
            </BtnQuiet>
          </Card>
        )}
      </View>

      <Card gap={8} style={{ backgroundColor: C.paper }}>
        <SectionTitle>{t('rc_about')}</SectionTitle>
        <BodyS muted>{t('rc_live')}</BodyS>
      </Card>
    </ScreenShell>
  );
}

export function IncomeScreen() {
  const { S, t, monthName, up, go, saveIncomeEntry, toast } = useApp();
  const d = S.incomeDraft;
  const [saving, setSaving] = React.useState(false);

  const save = async (keep: boolean) => {
    if (saving || S.incomeSync === 'loading') return;
    const a = +d.a || 0;
    if (a < 0) { up(s => { s.incomeDraft.flag = 'neg'; }); return; }
    if (!a) return;
    if (!isValidIsoDate(d.d)) {
      toast(t('inc_invalid_date'));
      return;
    }
    const amts = S.data.income.map(e => e.a).sort((x, y) => x - y);
    const med = amts.length ? amts[Math.floor(amts.length / 2)] : a;
    if (!INCOME_API_ENABLED && !keep && amts.length >= 3 && a > med * 3) {
      up(s => { s.incomeDraft.flag = 'outlier'; });
      return;
    }
    setSaving(true);
    try {
      const result = await saveIncomeEntry({
        amount: a,
        date: d.d,
        sourceId: d.s,
        confirmOutlier: keep,
      });
      if (result === 'outlier') {
        up(s => { s.incomeDraft.flag = 'outlier'; });
        return;
      }
      let months = 0;
      up(s => {
        s.incomeDraft = { a: '', d: d.d, s: d.s, flag: null };
        months = monthsAgg(s.data).length;
      });
      toast(t('entry_saved_n', { n: months }));
    } catch {
      toast(t('inc_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell back title={t('money_income')}>
      {S.incomeSync === 'loading' ? <NoteC><BodyS>{t('inc_sync_loading')}</BodyS></NoteC> : null}
      {S.incomeSync === 'error' ? <NoteC><BodyS>{t('inc_sync_error')}</BodyS></NoteC> : null}
      {S.data.income.length ? null : <Display cls="h-m">{t('inc_empty')}</Display>}
      <Card gap={8}>
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('inc_amount')}</BodyS>
          <TextField value={d.a} keyboardType="numbers-and-punctuation"
            onChangeText={v => up(s => { s.incomeDraft.a = v; s.incomeDraft.flag = null; })} />
        </View>
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('inc_date')}</BodyS>
          <DatePickerField
            value={d.d}
            mode="date"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date()}
            onChange={v => up(s => { s.incomeDraft.d = v; s.incomeDraft.flag = null; })}
          />
        </View>
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('inc_source')}</BodyS>
          <Chips>
            {S.data.sources.map(x => (
              <Chip key={x.id} label={x.custom ? x.name || '' : t(x.k || '')} on={d.s === x.id}
                onPress={() => up(s => { s.incomeDraft.s = x.id; s.incomeDraft.flag = null; })} />
            ))}
            <Chip label={t('src_own')} onPress={() => up(s => { s.sheet = 'srcown'; })} />
          </Chips>
        </View>
        {d.flag === 'neg' ? <NoteC><BodyS>{t('inc_neg')}</BodyS></NoteC> : null}
        {d.flag === 'outlier' ? (
          <NoteC>
            <BodyS>{t('inc_outlier')}</BodyS>
            <BtnLine label={t('keep')} onPress={() => { void save(true); }} />
          </NoteC>
        ) : null}
        <Btn label={saving ? t('inc_saving') : t('inc_add')} onPress={() => { void save(false); }} />
      </Card>
      <BtnLine label={t('inc_past')} onPress={() => up(s => { s.sheet = 'pastmonth'; })} />
      <BtnLine label={t('inc_import')} onPress={() => go('incomeimport')} />
      {S.data.income.length ? (
        <StackS>
          {[...S.data.income].reverse().map((e, i) => {
            const src = S.data.sources.find(x => x.id === e.s);
            const dd = +e.d.slice(8, 10) + ' ' + monthName(+e.d.slice(5, 7) - 1);
            const label = e.method === 'historical_total'
              ? `${monthName(+e.d.slice(5, 7) - 1)} ${e.d.slice(0, 4)} · ${t('inc_month_total')}`
              : `${dd} · ${src ? (src.custom ? src.name : t(src.k || '')) : e.s}`;
            return (
              <KV key={i} k={label}>
                <Fig value={rm(e.a)} p="user" cls="body-s" />
              </KV>
            );
          })}
        </StackS>
      ) : null}
    </ScreenShell>
  );
}

export function WorkcostsScreen() {
  const { S, t, up, saveWorkCostAmount, toast } = useApp();
  const agg = monthsAgg(S.data);
  const netAvg = agg.reduce((a, r) => a + r.net, 0) / Math.max(1, agg.length);
  return (
    <ScreenShell back title={t('money_workcosts')}>
      {S.workCostSync === 'loading' ? <NoteC><BodyS>{t('wc_sync_loading')}</BodyS></NoteC> : null}
      {S.workCostSync === 'error' ? <NoteC><BodyS>{t('wc_sync_error')}</BodyS></NoteC> : null}
      <Card gap={8}>
        <EditList
          list={S.data.workCosts}
          onNum={(i, n) => up(s => { s.data.workCosts[i].a = n; })}
          onCommit={(i, n) => {
            const id = S.data.workCosts[i]?.id;
            if (!id) return;
            void saveWorkCostAmount(id, n).catch(() => toast(t('wc_save_failed')));
          }}
        />
        <BtnLine label={t('wc_own')} onPress={() => up(s => { s.sheet = 'wcown'; })} />
      </Card>
      <Card>
        <BodyS muted>{t('net_lbl')}</BodyS>
        <Fig value={rm(netAvg)} p="calc" cls="h-l" />
        <BodyS muted>{t('per_month')} · {t('wc_note')}</BodyS>
      </Card>
    </ScreenShell>
  );
}

export function CommitScreen() {
  const { S, t, monthName, up, toast, saveCommitmentAmount } = useApp();
  const c = S.data.commitments;
  const added = new Set([...c.living, ...c.debts, ...c.savings].map(x => x.id));
  const presets = INCOME_API_ENABLED
    ? []
    : MOCK.commitPresets.filter(id => !added.has(id));
  const allMock = [...MOCK.commitments.living, ...MOCK.commitments.debts, ...MOCK.commitments.savings];
  const em = expByMonth(S.data);
  return (
    <ScreenShell back title={t('money_commit')}>
      {S.commitmentSync === 'loading' ? <NoteC><BodyS>{t('cm_sync_loading')}</BodyS></NoteC> : null}
      {S.commitmentSync === 'error' ? <NoteC><BodyS>{t('cm_sync_error')}</BodyS></NoteC> : null}
      {presets.length ? (
        <Chips>
          {presets.map(id => {
            const src = allMock.find(x => x.id === id)!;
            return (
              <Chip key={id} label={'+ ' + t(src.k || '')} onPress={() => {
                up(s => {
                  for (const sec of ['living', 'debts', 'savings'] as const) {
                    const found = MOCK.commitments[sec].find(x => x.id === id);
                    if (found) { s.data.commitments[sec].push({ ...found }); break; }
                  }
                });
                toast(t('saved'));
              }} />
            );
          })}
        </Chips>
      ) : null}
      {(['living', 'debts', 'savings'] as const).map(sec => (
        <Card key={sec} gap={8}>
          <BodyS muted>{t(sec === 'living' ? 'cm_living' : sec === 'debts' ? 'cm_debts' : 'cm_savings')}</BodyS>
          <EditList
            list={c[sec]}
            onNum={(i, n) => up(s => { s.data.commitments[sec][i].a = n; })}
            onCommit={(i, n) => {
              const id = S.data.commitments[sec][i]?.id;
              if (!id) return;
              void saveCommitmentAmount(id, n).catch(() => toast(t('cm_save_failed')));
            }}
          />
        </Card>
      ))}
      <KV k={t('cm_total')}><Fig value={rm(commitTotal(S.data))} p="calc" /></KV>
      {actualMonths(S.data).map(r => {
        const e = em.get(r.y * 12 + r.m)!;
        return (
          <Card key={r.y * 12 + r.m}>
            <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink }}>
              {t('ex_feeds', { m: monthName(r.m), x: nf(e.total) })} <Prov p="user" />
            </Text>
          </Card>
        );
      })}
    </ScreenShell>
  );
}

export function PatternScreen() {
  const { S, t, monthName, go, refreshIncomePattern } = useApp();
  React.useEffect(() => {
    if (S.incomePatternSync === 'idle') {
      void refreshIncomePattern().catch(() => undefined);
    }
  }, [S.incomePatternSync, refreshIncomePattern]);
  const pattern = S.incomePattern;
  const monthLabel = (value: string) => {
    const month = Number(value.slice(5, 7)) - 1;
    return `${monthName(month)} ${value.slice(0, 4)}`;
  };

  if (!INCOME_API_ENABLED) {
    return (
      <ScreenShell back title={t('money_pattern')}>
        <NoteC><BodyS>{t('pt_api_required')}</BodyS></NoteC>
      </ScreenShell>
    );
  }

  if (!pattern && (S.incomePatternSync === 'idle' || S.incomePatternSync === 'loading')) {
    return (
      <ScreenShell back title={t('money_pattern')}>
        <BodyS muted>{t('pt_loading')}</BodyS>
      </ScreenShell>
    );
  }

  if (!pattern) {
    return (
      <ScreenShell back title={t('money_pattern')}>
        <NoteC><BodyS>{t('pt_error')}</BodyS></NoteC>
        <Btn label={t('retry')} onPress={() => { void refreshIncomePattern().catch(() => undefined); }} />
      </ScreenShell>
    );
  }

  if (pattern.history_depth === 'empty' || !pattern.statistics) {
    return (
      <ScreenShell back title={t('money_pattern')}>
        {S.incomePatternSync === 'error' ? <NoteC><BodyS>{t('pt_error')}</BodyS></NoteC> : null}
        <Display cls="h-l">{t('pt_empty')}</Display>
        <BodyS muted>{t('pt_empty_note')}</BodyS>
        <Btn label={t('pt_add_income')} onPress={() => go('income')} />
      </ScreenShell>
    );
  }

  const stats = pattern.statistics;
  const limited = pattern.history_depth === 'one_month'
    ? t('pt_limited_one')
    : pattern.history_depth === 'two_months' ? t('pt_limited_two') : null;
  const lower = pattern.lower_income.months.map(monthLabel);
  return (
    <ScreenShell back title={t('money_pattern')}>
      {S.incomePatternSync === 'error' ? (
        <NoteC>
          <BodyS>{t('pt_error')}</BodyS>
          <BtnLine label={t('retry')} onPress={() => { void refreshIncomePattern().catch(() => undefined); }} />
        </NoteC>
      ) : null}
      <View>
        <Fig value={formatApiMoney(stats.average)} p="calc" cls="h-xl" />
        <BodyS muted>{t('pt_avg')} · {t('pt_month_count', { n: pattern.recorded_month_count })}</BodyS>
      </View>
      {limited ? <NoteC><BodyS>{limited}</BodyS></NoteC> : null}
      <BodyS muted>{t('pt_bymonth')}</BodyS>
      <IncomePatternChart
        months={pattern.months}
        monthName={monthName}
        accessibilityLabel={t('pt_chart_accessibility')}
      />
      {pattern.months.length > 4 ? <BodyS muted>{t('pt_scroll')}</BodyS> : null}
      <StackS>
        <KV k={t('pt_med')}><Fig value={formatApiMoney(stats.median)} p="calc" /></KV>
        <Divider />
        <KV k={t('pt_high')}><Fig value={formatApiMoney(stats.highest)} p="calc" /></KV>
        <Divider />
        <KV k={t('pt_low')}><Fig value={formatApiMoney(stats.lowest)} p="calc" /></KV>
        <Divider />
        <KV k={t('pt_range_total')}><Fig value={formatApiMoney(stats.range)} p="calc" /></KV>
        <Divider />
        <KV k={t('pt_std')}><Fig value={formatApiMoney(stats.standard_deviation)} p="calc" /></KV>
      </StackS>
      <BodyS muted>{t('pt_work_basis', { x: formatApiMoney(pattern.monthly_work_cost_total) })}</BodyS>
      <BodyS muted>{t('pt_rule')}</BodyS>
      <BodyS>{lower.length ? t('pt_some', { m: lower.join(', ') }) : t('pt_none')}</BodyS>
    </ScreenShell>
  );
}

export function CoverageScreen() {
  const { S, t, monthName, refreshIncomeCoverage, saveIncomeCoverage, toast } = useApp();
  const confirmed = S.incomeCoverage;
  const [answer, setAnswer] = React.useState<ApiCoverageAnswer | null>(confirmed?.answer || null);
  const [slowerMonths, setSlowerMonths] = React.useState<number[]>(confirmed?.slower_months || []);
  const confirmedAnswer = confirmed?.answer || null;
  const confirmedKey = [...(confirmed?.slower_months || [])].sort((a, b) => a - b).join(',');

  React.useEffect(() => {
    setAnswer(confirmedAnswer);
    setSlowerMonths(confirmedKey ? confirmedKey.split(',').map(Number) : []);
  }, [confirmedAnswer, confirmedKey]);

  const selectedKey = [...slowerMonths].sort((a, b) => a - b).join(',');
  const dirty = answer !== confirmedAnswer || selectedKey !== confirmedKey;
  const showConfirmed = Boolean(confirmed?.answer) && (!dirty || S.coverageSync === 'error');
  const controlsDisabled = S.coverageSync === 'idle'
    || S.coverageSync === 'loading'
    || S.coverageSync === 'saving'
    || (S.coverageSync === 'error' && !confirmed);
  const monthList = (months: number[]) => months.map(month => monthName(month - 1)).join(', ');
  const chooseAnswer = (next: ApiCoverageAnswer) => {
    setAnswer(next);
    if (next !== 'yes') setSlowerMonths([]);
  };
  const checkCoverage = async () => {
    if (!answer) return;
    if (answer === 'yes' && slowerMonths.length === 0) {
      toast(t('cv_select_required'), 'error');
      return;
    }
    try {
      await saveIncomeCoverage({ answer, slowerMonths });
      toast(t('saved'));
    } catch {
      toast(t('cv_save_failed'), 'error');
    }
  };

  let result: React.ReactNode = null;
  if (showConfirmed && confirmed?.answer === 'yes') {
    result = (
      <StackS>
        {confirmed.represented_slower_months.length ? (
          <Card><BodyS>{t('cv_represented', { m: monthList(confirmed.represented_slower_months) })}</BodyS></Card>
        ) : null}
        {confirmed.unrepresented_slower_months.length ? (
          <NoteC><BodyS>{t('cv_unrepresented', { m: monthList(confirmed.unrepresented_slower_months) })}</BodyS></NoteC>
        ) : null}
      </StackS>
    );
  } else if (showConfirmed && confirmed?.answer && confirmed.answer !== 'yes') {
    const observation = confirmed.observation;
    result = observation ? (
      <Card>
        <BodyS>{t('cv_observation', {
          n: observation.recorded_month_count,
          lo: formatApiMoney(observation.lowest),
          hi: formatApiMoney(observation.highest),
          range: formatApiMoney(observation.range),
        })}</BodyS>
      </Card>
    ) : <NoteC><BodyS>{t('cv_no_history')}</BodyS></NoteC>;
  }

  if (!INCOME_API_ENABLED) {
    return (
      <ScreenShell back title={t('money_coverage')}>
        <NoteC><BodyS>{t('cv_api_required')}</BodyS></NoteC>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell back title={t('money_coverage')}>
      {(S.coverageSync === 'idle' || S.coverageSync === 'loading') && !confirmed ? (
        <BodyS muted>{t('cv_loading')}</BodyS>
      ) : null}
      {S.coverageSync === 'error' ? (
        <NoteC>
          <BodyS>{t('cv_error')}</BodyS>
          {!confirmed ? (
            <BtnLine label={t('retry')} onPress={() => { void refreshIncomeCoverage().catch(() => undefined); }} />
          ) : null}
        </NoteC>
      ) : null}
      <Display cls="h-l">{t('cv_q')}</Display>
      <Chips>
        {([['yes', 'cv_yes'], ['no', 'cv_no'], ['not_sure', 'cv_notsure']] as const).map(([value, key]) => (
          <Chip key={value} label={t(key)} brandOn={answer === value}
            disabled={controlsDisabled}
            selectionRole="radio"
            onPress={() => chooseAnswer(value)} />
        ))}
      </Chips>
      {answer === 'yes' ? (
        <>
          <P>{t('cv_pick')}</P>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...Array(12)].map((_, index) => {
              const month = index + 1;
              const on = slowerMonths.includes(month);
              return (
                <View key={month} style={{ flexBasis: '22%', flexGrow: 1 }}>
                  <Chip
                    label={monthName(index)}
                    brandOn={on}
                    disabled={controlsDisabled}
                    selectionRole="checkbox"
                    onPress={() => setSlowerMonths(previous => (
                      previous.includes(month)
                        ? previous.filter(value => value !== month)
                        : [...previous, month].sort((a, b) => a - b)
                    ))}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      {answer ? (
        <Btn
          label={S.coverageSync === 'saving' ? t('cv_checking') : t('cv_check')}
          disabled={controlsDisabled}
          onPress={() => { if (!controlsDisabled) void checkCoverage(); }}
        />
      ) : null}
      {S.coverageSync === 'error' && showConfirmed ? <BodyS muted>{t('cv_previous')}</BodyS> : null}
      {result}
      <BodyS muted>{t('cv_note')}</BodyS>
    </ScreenShell>
  );
}
