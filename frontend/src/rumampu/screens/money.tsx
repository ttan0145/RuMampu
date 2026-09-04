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
import { isValidIsoDate, isValidMoneyText } from '../validation';
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

// EN: US8.1/US8.2 use this compact metric block in Your Record for both
// financial-summary numbers and kept-test summary numbers.
// 中文：US8.1/US8.2 在“记录档案”中复用这个小型数字区块，用来展示财务摘要和留存测试摘要。
function RecordMetric({ value, label }: { value: string; label: string }) {
  return (
    <View accessibilityLabel={`${value} ${label}`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Display cls="h-l">{value}</Display>
      <BodyS muted>{label}</BodyS>
    </View>
  );
}

// EN: US8.2.5 needs the kept-test status to say "this session" so the UI does
// not imply account storage, cloud sync, or permanent saved history.
// 中文：US8.2.5 要求留存状态说明“本次会话”，避免让用户以为它已保存到账户、云端或永久历史。
function SessionStatus({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: C.confirm, fontSize: 16, lineHeight: 18 }}>✓</Text>
      <BodyS muted>{label}</BodyS>
    </View>
  );
}

export function RecordScreen() {
  // EN: Your Record is the US8.1/US8.2 screen. It reads current AppProvider
  // state and does not add account persistence or login behaviour.
  // 中文：“记录档案”是 US8.1/US8.2 的页面。它读取当前 AppProvider 状态，不新增账号持久化或登录行为。
  const { S, t, monthName, go } = useApp();

  // EN: US8.1 delegates recorded months, entry count, and latest-entry date to
  // recordSummary() so the page does not duplicate the counting rules.
  // 中文：US8.1 把已记录月份、记录条数和最近记录日期交给 recordSummary()，避免页面重复计算规则。
  const summary = recordSummary(S.data);
  const n = summary.recordedMonthCount;
  const last = summary.latestEntryDate;

  // EN: The latest-entry label formats the actual financial business date for
  // the selected language; it is not based on created_at or updated_at.
  // 中文：最近记录标签格式化真实财务业务日期，并按当前语言显示；它不使用 created_at 或 updated_at。
  const lastLbl = last ? `${+last.slice(8, 10)} ${monthName(+last.slice(5, 7) - 1)} ${last.slice(0, 4)}` : '';
  return (
    <ScreenShell back title={t('money_record')}>
      <Card gap={12}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SectionTitle>{t('rc_summary')}</SectionTitle>
          <Prov p="user" />
        </View>
        {/* EN: AC8.1.1/AC8.1.2 show the month count and individual-entry count together. */}
        {/* 中文：AC8.1.1/AC8.1.2 把月份数和单笔记录数并排展示。 */}
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <RecordMetric value={String(n)} label={t(n === 1 ? 'rc_month_metric_one' : 'rc_month_metric')} />
          <RecordMetric value={String(summary.entryCount)} label={t('rc_entry_metric')} />
        </View>
        <Divider />
        <View style={{ gap: 2 }}>
          <BodyS muted>{t('rc_latest_label')}</BodyS>
          {/* EN: AC8.1.3 has an explicit empty state so no fake latest date is rendered. */}
          {/* 中文：AC8.1.3 在没有记录时显示空状态文案，不渲染伪造的最近日期。 */}
          {lastLbl ? <Display cls="h-m">{lastLbl}</Display> : <BodyS>{t('rc_latest_empty')}</BodyS>}
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <SectionTitle>{t('rc_tests')}</SectionTitle>
        {/* EN: AC8.2.3 displays kept tests from S.keptTests, the current frontend session state. */}
        {/* 中文：AC8.2.3 从当前前端会话状态 S.keptTests 中展示留存测试。 */}
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
              {/* EN: AC8.2.4 handles the no-kept-test state and links the user back to Test. */}
              {/* 中文：AC8.2.4 处理没有留存测试的状态，并引导用户回到测试页。 */}
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
        {/* EN: AC8.1.5/AC8.2.5 explain current guest-session scope only. */}
        {/* 中文：AC8.1.5/AC8.2.5 只说明当前访客会话范围，不暗示保存到 RuMampu 账号。 */}
        <BodyS muted>{t('rc_live')}</BodyS>
      </Card>
    </ScreenShell>
  );
}

/**
 * EN: US1.1 records amount, date, and source while preserving warning and provenance states.
 * 中文：US1.1 录入金额、日期和来源，并保留警告与来源标识状态。
 */
export function IncomeScreen() {
  const { S, t, monthName, up, go, saveIncomeEntry, deleteIncomeEntry, toast } = useApp();
  const d = S.incomeDraft;
  const [saving, setSaving] = React.useState(false);

  const save = async (keep: boolean) => {
    if (saving || S.incomeSync === 'loading') return;
    // Use the same strict cash validation as Add a past month. This prevents
    // partially numeric input such as `3ttttt` from silently becoming invalid/zero.
    if (!isValidMoneyText(d.a)) {
      up(s => { s.incomeDraft.flag = 'invalid'; });
      return;
    }
    const a = Number(d.a.trim());
    // Zero income is valid; only negative amounts are rejected.
    // RM0 can represent a genuine no-income day or month.
    if (a < 0) { up(s => { s.incomeDraft.flag = 'neg'; }); return; }
    // EN: AC1.1.2 validates the calendar date on both client and server boundaries.
    // 中文：AC1.1.2 在客户端和服务端边界都校验日历日期。
    if (!isValidIsoDate(d.d)) {
      toast(t('inc_invalid_date'));
      return;
    }
    // EN: Mirror AC1.1.10 on every client, including deployed web.
    // This keeps Expo/native, prototype, and web behaviour consistent even when
    // browser session/cookie handling means Django has not yet seen the same
    // local income history. Django still performs its own validation as a
    // second check when the API is enabled.
    const amts = S.data.income
      .map(e => e.a)
      .filter(v => Number.isFinite(v) && v > 0)
      .sort((x, y) => x - y);

    const localMedian = (() => {
      if (!amts.length) return a;
      const middle = Math.floor(amts.length / 2);
      return amts.length % 2 === 0
        ? (amts[middle - 1] + amts[middle]) / 2
        : amts[middle];
    })();

    if (!keep && amts.length >= 3 && a > localMedian * 3) {
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
      // EN: The stable 409 code drives the AC1.1.10 Keep action, not English error text.
      // 中文：AC1.1.10 的 Keep 操作由稳定的 409 错误码驱动，不依赖英文错误文案。
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
        {d.flag === 'invalid' ? <NoteC><BodyS>{t('inc_invalid_amount')}</BodyS></NoteC> : null}
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
      {/* EN: Saved income is user-provided data, so provenance is shown once for the section instead of on every row. */}
      {/* 中文：已保存收入都属于用户提供的数据，因此来源标识只在区块顶部显示一次，不在每行重复。 */}
      {S.data.income.length ? (
        <View style={{ marginTop: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink64, letterSpacing: 0.2 }}>
              {t('inc_recorded')}
            </Text>
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: C.card,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.7, color: C.ink64 }}>
                {t('prov_user').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: C.ink14 }}>
            {[...S.data.income].reverse().map((e, i) => {
              const src = S.data.sources.find(x => x.id === e.s);
              const dd = +e.d.slice(8, 10) + ' ' + monthName(+e.d.slice(5, 7) - 1);
              const label = e.method === 'historical_total'
                ? `${monthName(+e.d.slice(5, 7) - 1)} ${e.d.slice(0, 4)} · ${t('inc_month_total')}`
                : `${dd} · ${src ? (src.custom ? src.name : t(src.k || '')) : e.s}`;
              const canEdit = (e.method === 'historical_total' || e.method === 'manual') && Boolean(e.id);
              return (
                <View
                  key={e.id || `${e.d}-${i}`}
                  style={{
                    minHeight: 58,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: C.ink14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <Text style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, color: C.ink }}>
                    {label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: canEdit ? 12 : 0 }}>
                    <Display cls="body-s">{rm(e.a)}</Display>
                    {canEdit ? (
                      <>
                        <BtnLine
                          label={t('edit')}
                          style={{ fontSize: 13 }}
                          onPress={() => up(state => { state.sheet = e.method === 'historical_total' ? `pastmonth:${e.id}` : `incomeedit:${e.id}`; })}
                        />
                        <BtnLine
                          label={t('remove')}
                          style={{ fontSize: 13 }}
                          onPress={() => {
                            void deleteIncomeEntry(e.id!).catch(() => toast(t('inc_save_failed'), 'error'));
                          }}
                        />
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/**
 * EN: US1.3 records dated work costs and calculates only the selected month's result.
 * 中文：US1.3 记录带日期工作成本，并只计算所选月份的结果。
 */
export function WorkcostsScreen() {
  const { S, t, up, monthName, refreshWorkCosts, saveWorkCostEntry, updateWorkCostEntry, toast } = useApp();
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [categoryId, setCategoryId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [costDate, setCostDate] = React.useState(todayText);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editDate, setEditDate] = React.useState(todayText);
  const [saving, setSaving] = React.useState(false);
  const summary = S.workCostSummary;
  const savingRef = React.useRef(false);
  const selectedMonth = S.workCostSelectedMonth;
  const summaryReady = (S.workCostSync === 'ready' || S.workCostSync === 'disabled') && summary?.month === selectedMonth;
  const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
  const selectedMonthLabel = `${monthName(Math.max(0, selectedMonthNumber - 1))} ${selectedYear}`;
  const categoryLabel = (id: string, recordedName?: string) => {
    const category = S.data.workCostCategories.find(item => item.id === id);
    return category ? (category.custom ? category.name || '' : t(category.k || '')) : recordedName || id;
  };

  React.useEffect(() => {
    void refreshWorkCosts().catch(() => undefined);
  }, [refreshWorkCosts]);

  React.useEffect(() => {
    if (!categoryId && S.data.workCostCategories[0]) setCategoryId(S.data.workCostCategories[0].id);
  }, [categoryId, S.data.workCostCategories]);

  const save = async () => {
    if (savingRef.current) return;
    if (!categoryId || !isValidMoneyText(amount) || Number(amount) <= 0 || !isValidIsoDate(costDate) || costDate > todayText) {
      toast(t('wc_entry_invalid'), 'error');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await saveWorkCostEntry({ categoryId, amount: Number(amount), date: costDate });
      setAmount('');
      setCostDate(todayText);
      toast(t('saved'));
    } catch {
      toast(t('wc_save_failed'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const beginEdit = (entry: typeof S.data.workCostEntries[number]) => {
    setEditingId(entry.id);
    setEditCategoryId(entry.categoryId);
    setEditAmount(String(entry.a));
    setEditDate(entry.d);
  };

  const saveEdit = async () => {
    if (!editingId || savingRef.current) return;
    if (!editCategoryId || !isValidMoneyText(editAmount) || Number(editAmount) <= 0 || !isValidIsoDate(editDate) || editDate > todayText) {
      toast(t('wc_entry_invalid'), 'error');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await updateWorkCostEntry(editingId, {
        categoryId: editCategoryId,
        amount: Number(editAmount),
        date: editDate,
      });
      setEditingId(null);
      toast(t('saved'));
    } catch {
      toast(t('wc_save_failed'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <ScreenShell back title={t('money_workcosts')}>
      {S.workCostSync === 'loading' ? <NoteC><BodyS>{t('wc_sync_loading')}</BodyS></NoteC> : null}
      {S.workCostSync === 'error' ? <NoteC>
        <BodyS>{t('wc_sync_error')}</BodyS>
        <BtnLine label={t('retry')} onPress={() => { void refreshWorkCosts().catch(() => undefined); }} />
      </NoteC> : null}
      <Card gap={8}>
        <BodyS muted>{t('wc_month')}</BodyS>
        <DatePickerField
          value={selectedMonth}
          mode="month"
          monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
          allowedMonths={summary?.available_months}
          onChange={value => {
            if (summary && !summary.available_months.includes(value)) {
              toast(t('wc_month_unavailable'), 'error');
              return;
            }
            void refreshWorkCosts(value).catch(() => toast(t('wc_sync_error'), 'error'));
          }}
        />
        <BodyS muted>{t('wc_month_note', { m: selectedMonthLabel })}</BodyS>
        {selectedMonth === todayText.slice(0, 7) ? <BodyS muted>{t('wc_so_far')}</BodyS> : null}
      </Card>
      <Card gap={10}>
        <BodyS>{t('wc_add')}</BodyS>
        <BodyS muted>{t('wc_category')}</BodyS>
        <Chips>
          {S.data.workCostCategories.map(category => (
            <Chip key={category.id} label={category.custom ? category.name || '' : t(category.k || '')}
              on={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
          ))}
        </Chips>
        <BtnLine label={t('wc_own')} onPress={() => up(s => { s.sheet = 'wcown'; })} />
        <BodyS muted>{t('inc_amount')}</BodyS>
        <TextField accessibilityLabel={t('wc_entry_amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" />
        <BodyS muted>{t('inc_date')}</BodyS>
        <DatePickerField
          value={costDate}
          mode="date"
          monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
          maximumDate={today}
          onChange={setCostDate}
        />
        <Btn disabled={saving} label={saving ? t('inc_saving') : t('wc_add')} onPress={() => { void save(); }} />
      </Card>
      <Card gap={8}>
        <View testID="work-cost-summary" style={{ gap: 8 }}>
        <BodyS muted>{t('net_lbl')}</BodyS>
        {summaryReady && summary ? <>
        <BodyS muted>{t('wc_cost_total', { costs: rm(Number(summary.work_cost_total)) })}</BodyS>
        {Number(summary.work_cost_total) === 0 ? <BodyS muted>{t('wc_no_costs')}</BodyS> : null}
        {summary?.income_recorded ? (
          <>
            <Fig value={rm(Number(summary.income_after_work_costs || 0))} p="calc" cls="h-l" />
            <BodyS muted>{t('wc_income_formula', { income: rm(Number(summary.gross_income)), costs: rm(Number(summary.work_cost_total)) })}</BodyS>
          </>
        ) : (
          <BodyS>{t('wc_no_income', { m: selectedMonthLabel })}</BodyS>
        )}
        </> : <BodyS>{t('wc_summary_unavailable')}</BodyS>}
        <BodyS muted>{t('wc_note')}</BodyS>
        </View>
      </Card>
      <Card gap={10}>
        <BodyS>{t('wc_recorded')}</BodyS>
        {summaryReady && S.data.workCostEntries.length === 0 ? <BodyS muted>{t('wc_empty')}</BodyS> : null}
        {S.data.workCostEntries.map(entry => (
          <View key={entry.id} testID={`work-cost-entry-${entry.id}`} style={{ gap: 6 }}>
            {/* 中文：记录列表展示原始条目；来源标记留给上方需要区分的计算结果。窄屏允许金额与编辑整体换行。 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, minHeight: 44 }}>
              <View style={{ flexGrow: 1, flexBasis: 120, minWidth: 0 }}>
                <BodyS>{entry.d} · {categoryLabel(entry.categoryId, entry.categoryName)}</BodyS>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 'auto', maxWidth: '100%' }}>
                <Display style={{ fontSize: 16, lineHeight: 22, flexShrink: 1 }}>{rm(entry.a)}</Display>
                <BtnLine label={t('edit')} onPress={() => beginEdit(entry)} style={{ fontSize: 13 }} />
              </View>
            </View>
            {editingId === entry.id ? (
              <View style={{ gap: 8 }}>
                <BodyS muted>{t('wc_category')}</BodyS>
                <Chips>{S.data.workCostCategories.map(category => (
                  <Chip key={category.id} label={category.custom ? category.name || '' : t(category.k || '')}
                    on={editCategoryId === category.id} onPress={() => setEditCategoryId(category.id)} />
                ))}</Chips>
                <BodyS muted>{t('inc_amount')}</BodyS>
                <TextField accessibilityLabel={t('wc_edit_amount')} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" inputMode="decimal" />
                <BodyS muted>{t('inc_date')}</BodyS>
                <DatePickerField value={editDate} mode="date" maximumDate={today}
                  monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))} onChange={setEditDate} />
                <Btn disabled={saving} label={saving ? t('inc_saving') : t('done')} onPress={() => { void saveEdit(); }} />
                <BtnLine label={t('cancel')} onPress={() => setEditingId(null)} />
              </View>
            ) : null}
            <Divider />
          </View>
        ))}
      </Card>
    </ScreenShell>
  );
}

/**
 * EN: US1.4 keeps living, debt, and savings visually separate while displaying one calculated total.
 * 中文：US1.4 在视觉上分开生活、债务和储蓄，同时显示一个计算总额。
 */
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

/**
 * EN: US2.1-US2.3 render Django's authoritative monthly pattern, statistics, and recorded minima.
 * 中文：US2.1-US2.3 渲染 Django 的权威逐月形态、统计值与记录最低月份。
 */
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
      <BodyS muted>{t('pt_work_basis')}</BodyS>
      <BodyS muted>{t('pt_rule')}</BodyS>
      <BodyS>{lower.length ? t('pt_some', { m: lower.join(', ') }) : t('pt_none')}</BodyS>
    </ScreenShell>
  );
}

/**
 * EN: US2.4 collects a user answer, then displays only server-confirmed coverage facts.
 * 中文：US2.4 收集用户答案，并且只展示服务端确认的覆盖事实。
 */
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
