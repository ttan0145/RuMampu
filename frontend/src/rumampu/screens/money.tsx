import React from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../state';
import { MOCK } from '../mock';
import { INCOME_API_ENABLED } from '../api';
import {
  actualMonths, commitTotal, expByMonth, expCatTotals, latestExpMonth,
  monthsAgg, nf, recSpan, rm, slowUnseen,
} from '../calc';
import {
  BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, NumInput, P, Prov, StackS, TextField,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { Donut, DonutLegend, Waterline } from '../charts';
import { ScreenShell } from './shell';
import { isValidIsoDate } from '../validation';

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

export function RecordScreen() {
  const { S, t, monthName } = useApp();
  const sp = recSpan(S.data);
  const n = sp ? sp.list.length : 0;
  const e = S.data.income.length;
  const last = e ? S.data.income[e - 1].d : '';
  const lastLbl = last ? (+last.slice(8, 10)) + ' ' + monthName(+last.slice(5, 7) - 1) : '';
  return (
    <ScreenShell back title={t('money_record')}>
      <Fig value={t(n === 1 ? 'rc_months_one' : 'rc_months', { n })} p="user" cls="h-l" />
      <BodyS muted>{t('rc_entries', { e, d: lastLbl })}</BodyS>
      <Card gap={8}>
        <BodyS muted>{t('rc_tests')}</BodyS>
        {S.keptTests.length ? S.keptTests.map((k, i) => (
          <KV key={i} k={`${rm(k.pay)} · ${t('cp_short', { s: k.s, n: k.n })}`}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <BodyS muted>{t('gap_lbl')}</BodyS>
              <Fig value={rm(k.g)} p="calc" cls="body-s" />
            </View>
          </KV>
        )) : <BodyS muted>{t('rc_none')}</BodyS>}
      </Card>
      <BodyS muted>{t('rc_live')}</BodyS>
      <BodyS>{t('rc_keep_line')}</BodyS>
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
          <TextField value={d.d} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD"
            onChangeText={v => up(s => { s.incomeDraft.d = v; s.incomeDraft.flag = null; })} />
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
  const { S, t, monthName } = useApp();
  const agg = monthsAgg(S.data);
  const a = agg.map(r => r.net);
  const avg = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const srt = [...a].sort((x, y) => x - y);
  const med = (srt.length % 2) ? srt[(srt.length - 1) / 2] : (srt[srt.length / 2 - 1] + srt[srt.length / 2]) / 2;
  const hi = Math.max(...a), lo = Math.min(...a);
  const below = agg.filter(r => r.net < avg * 0.75).map(r => monthName(r.m));
  return (
    <ScreenShell back title={t('money_pattern')}>
      <View>
        <Fig value={rm(avg)} p="calc" cls="h-xl" />
        <BodyS muted>{t('pt_avg')} · {t('pt_range', { x: nf((hi - lo) / 2) })}</BodyS>
      </View>
      <BodyS muted>{t('pt_bymonth')}</BodyS>
      <Waterline
        rows={agg.map(r => ({ m: r.m, surplus: r.net, short: false, gap: 0 }))}
        cost={0} small prov="calc" monthName={monthName}
      />
      <Card gap={8}>
        <KV k={t('pt_med')}><Fig value={rm(med)} p="calc" /></KV>
        <KV k={t('pt_high')}><Fig value={rm(hi)} p="calc" /></KV>
        <KV k={t('pt_low')}><Fig value={rm(lo)} p="calc" /></KV>
      </Card>
      <BodyS muted>{t('pt_rule')}</BodyS>
      <BodyS>{below.length ? t('pt_some', { m: below.join(', ') }) : t('pt_none')}</BodyS>
    </ScreenShell>
  );
}

export function CoverageScreen() {
  const { S, t, monthName, up } = useApp();
  const sp = recSpan(S.data);
  const ans = S.coverage.answer;
  let body: React.ReactNode = null;
  if (ans === 'yes') {
    const un = slowUnseen(S.data, S.coverage);
    const slowNames = S.coverage.slow.map(monthName).join(', ');
    body = (
      <>
        <P>{t('cv_pick')}</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...Array(12)].map((_, i) => {
            const on = S.coverage.slow.includes(i);
            return (
              <View key={i} style={{ flexBasis: '22%', flexGrow: 1 }}>
                <Text
                  onPress={() => up(s => {
                    const idx = s.coverage.slow.indexOf(i);
                    if (idx >= 0) s.coverage.slow.splice(idx, 1); else s.coverage.slow.push(i);
                  })}
                  style={{
                    minHeight: 48, borderWidth: 1.5, borderColor: on ? C.ink : C.ink40, borderRadius: 12,
                    fontSize: 14, textAlign: 'center', textAlignVertical: 'center', lineHeight: 48,
                    color: on ? C.paper : C.ink, backgroundColor: on ? C.ink : 'transparent', overflow: 'hidden',
                  }}
                >{monthName(i)}</Text>
              </View>
            );
          })}
        </View>
        {S.coverage.slow.length && sp ? (
          un.length ? (
            <NoteC><BodyS>{t('cv_unseen', { slow: slowNames, a: monthName(sp.from.m), b: monthName(sp.to.m) })}</BodyS></NoteC>
          ) : (
            <Card><BodyS>{t('cv_seen', { slow: slowNames, a: monthName(sp.from.m), b: monthName(sp.to.m) })}</BodyS></Card>
          )
        ) : null}
      </>
    );
  } else if (ans === 'no' || ans === 'notsure') {
    const nets = monthsAgg(S.data).map(r => r.net);
    const avg = nets.reduce((x, y) => x + y, 0) / Math.max(1, nets.length);
    const spread = Math.max(...nets) - Math.min(...nets);
    const narrow = spread < avg * 0.12;
    const msg = narrow ? t('cv_narrow')
      : t('cv_varied', { a: sp ? monthName(sp.from.m) : '', b: sp ? monthName(sp.to.m) : '' });
    body = narrow ? <NoteC><BodyS>{msg}</BodyS></NoteC> : <Card><BodyS>{msg}</BodyS></Card>;
  }
  return (
    <ScreenShell back title={t('money_coverage')}>
      <Display cls="h-l">{t('cv_q')}</Display>
      <Chips>
        {([['yes', 'cv_yes'], ['no', 'cv_no'], ['notsure', 'cv_notsure']] as const).map(([v, k]) => (
          <Chip key={v} label={t(k)} brandOn={ans === v}
            onPress={() => up(s => { s.coverage.answer = v; })} />
        ))}
      </Chips>
      {body}
      <BodyS muted>{t('cv_note')}</BodyS>
    </ScreenShell>
  );
}
