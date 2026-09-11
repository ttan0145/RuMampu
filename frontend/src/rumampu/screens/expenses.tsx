import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { useApp } from '../state';
import {
  EXP_FULL_DAYS, expByMonth, expCatTotals, latestExpMonth, monthsAgg, nf, rm, rmx,
} from '../calc';
import {
  Badge, BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Fig, FromR,
  IcLab, KV, NoteC, NumInput, P, Prov, StackS, TextField,
} from '../ui';
import { C, CHART_COLS, DISP_FONT } from '../theme';
import { Ico } from '../svgs';
import { CatIcon, guessCat } from '../icons';
import { CSV_SAMPLE_EX, csvAmount, parseCsv, parseDateAny } from '../csv';
import { DayShortcutPicker, InCard, InChip, InHero, InLbl, InRow, InSec, InSeg, PerSeg } from '../incard';
import { HBar, Shimmer } from '../charts';
import { ScreenShell } from './shell';
import { isValidIsoDate } from '../validation';
import { DatePickerField } from '../date-picker';
import { INCOME_API_ENABLED, scanReceipt } from '../api';
import { getPickedReceipt, setPickedReceipt } from '../../../services/receiptSession';

const SHOW_SPENDING_LIMITS = false;
const SHOW_EXPENSE_COMPLETENESS = false;

function useCatLabel() {
  const { S, t } = useApp();
  return (id: string) => {
    const c = S.data.expenseCats.find(x => x.id === id);
    return c ? (c.custom ? c.name || '' : t(c.k || '')) : id;
  };
}

/* v22 expense CSV importer: paste (or sample) a statement, auto-map the
   columns, then every kept row is saved through the real expense API. */
function ExpenseCsvBody() {
  const { S, t, up, monthName, saveExpenseEntry, toast } = useApp();
  const c = S.exCsv;
  const [pasted, setPasted] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const cats = useCatLabel();

  const load = (text: string) => {
    const p = parseCsv(text);
    if (!p || !p.rows.length) {
      up(s => { s.exCsv = { stage: 'pick', err: t('cv_none') }; });
      return;
    }
    up(s => { s.exCsv = { stage: 'map', headers: p.headers, rows: p.rows, map: p.map, cat: 'desc' }; });
  };

  const runImport = async () => {
    if (importing || !c.rows || !c.map) return;
    setImporting(true);
    const m = c.map;
    let added = 0, skipped = 0;
    let from: string | null = null, to: string | null = null;
    try {
      for (const r of c.rows) {
        const d = parseDateAny(r[m.d] || '');
        const a = csvAmount(r[m.a] || '');
        if (!d || !(a > 0)) continue;
        if (S.data.expenses.some(e => e.d === d && +e.a === a)) { skipped++; continue; }
        const slug = c.cat === 'desc' ? guessCat(m.desc >= 0 ? r[m.desc] : '') : c.cat!;
        const category = S.data.expenseCats.find(x => x.id === slug || x.k === 'xc_' + slug)
          || S.data.expenseCats[0];
        if (!category) continue;
        await saveExpenseEntry({ amount: a, date: d, categoryId: category.id, merchant: m.desc >= 0 ? (r[m.desc] || '').trim() : undefined });
        added++;
        if (!from || d < from) from = d;
        if (!to || d > to) to = d;
      }
      if (!added) {
        up(s => { s.exCsv = { stage: 'pick', err: t('cv_none') }; });
        return;
      }
      const lab = (d: string) => `${monthName(+d.slice(5, 7) - 1)} ${d.slice(0, 4)}`;
      up(s => { s.exCsv = { stage: 'done', added, skipped, from: lab(from!), to: lab(to!) }; });
    } catch {
      toast(t('ex_save_failed'), 'error');
    } finally {
      setImporting(false);
    }
  };

  if (c.stage === 'map' && c.headers && c.rows && c.map) {
    const colChips = (sel: number, onPick: (i: number) => void, allowNone?: boolean) => (
      <Chips>
        {allowNone ? <Chip label="—" on={sel < 0} onPress={() => onPick(-1)} /> : null}
        {c.headers!.map((h, i) => (
          <Chip key={i} label={h} on={sel === i} onPress={() => onPick(i)} />
        ))}
      </Chips>
    );
    return (
      <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('cv_map')}</Text>
        <View style={{ borderTopWidth: 1, borderTopColor: C.ink14 }}>
          {c.rows.slice(0, 4).map((r, i) => (
            <BodyS key={i} muted style={{ paddingVertical: 4 }} numberOfLines={1}>
              {c.headers!.map((_, j) => r[j] || '').join('  ·  ')}
            </BodyS>
          ))}
        </View>
        <BodyS muted>{t('cv_date')}</BodyS>
        {colChips(c.map.d, i => up(s => { if (s.exCsv.map) s.exCsv.map.d = i; }))}
        <BodyS muted>{t('cv_amt')}</BodyS>
        {colChips(c.map.a, i => up(s => { if (s.exCsv.map) s.exCsv.map.a = i; }))}
        <BodyS muted>{t('cv_desc')}</BodyS>
        {colChips(c.map.desc, i => up(s => { if (s.exCsv.map) s.exCsv.map.desc = i; }), true)}
        <BodyS muted>{t('exc_cat')}</BodyS>
        <Chips>
          <Chip label={t('cv_fromdesc')} on={c.cat === 'desc'} onPress={() => up(s => { s.exCsv.cat = 'desc'; })} />
          {S.data.expenseCats.map(x => (
            <Chip key={x.id} label={x.custom ? x.name || '' : t(x.k || '')} on={c.cat === x.id}
              onPress={() => up(s => { s.exCsv.cat = x.id; })} />
          ))}
        </Chips>
        <Btn disabled={importing} label={importing ? t('ex_saving') : t('cv_import', { n: c.rows.length })}
          onPress={() => { void runImport(); }} />
        <View style={{ alignItems: 'center' }}>
          <BtnLine label={t('cancel')} style={{ fontSize: 13.5 }}
            onPress={() => up(s => { s.exCsv = { stage: 'pick' }; s.exMode = 'type'; })} />
        </View>
      </View>
    );
  }

  if (c.stage === 'done') {
    return (
      <View style={{ padding: 14, alignItems: 'center', gap: 10 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.confirm, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 26 }}>✓</Text>
        </View>
        <Display cls="h-m" style={{ textAlign: 'center' }}>{t('exc_done', { n: c.added || 0, a: c.from || '', b: c.to || '' })}</Display>
        {c.skipped ? <BodyS muted>{t('cv_skipped', { n: c.skipped })}</BodyS> : null}
        <View style={{ width: '100%' }}>
          <Btn label={t('done')} onPress={() => up(s => { s.exCsv = { stage: 'pick' }; s.exMode = 'type'; })} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
      {c.err ? <NoteC><BodyS>{c.err}</BodyS></NoteC> : null}
      <BodyS muted>{t('exc_hint')}</BodyS>
      <TextInput
        multiline
        numberOfLines={5}
        value={pasted}
        onChangeText={setPasted}
        placeholder="date,amount,description"
        placeholderTextColor={C.ink40}
        style={{
          minHeight: 110, backgroundColor: '#F6F8F7', borderWidth: 1.5, borderColor: C.ink14,
          borderRadius: 12, padding: 12, fontSize: 13, color: C.ink, textAlignVertical: 'top',
        }}
      />
      <Btn label={t('cv_import', { n: '' }).replace('{n}', '').trim() || t('add')} onPress={() => load(pasted)} />
      <View style={{ alignItems: 'center' }}>
        <BtnLine label={t('cv_sample')} style={{ fontSize: 13.5 }} onPress={() => load(CSV_SAMPLE_EX)} />
      </View>
    </View>
  );
}

/**
 * EN: US1.5/US1.6 record and summarise daily expenses. v22 restyles this into
 * the warm entry-card anatomy: summary bar, type/scan/csv card, recent rows.
 * 中文：US1.5/US1.6 记录并汇总日常支出。v22 将其重构为暖色记录卡片。
 */
export function ExpensesScreen() {
  const { S, t, monthName, go, up, toast, saveExpenseEntry } = useApp();
  const cats = useCatLabel();
  const d = S.expDraft;
  const per = d.per || 'day';
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<'amount' | 'date' | 'save' | null>(null);
  const ex = [...S.data.expenses].sort((a, b) => (a.d < b.d ? 1 : -1));
  const now = new Date();
  const curKey = ex.length
    ? (+ex[0].d.slice(0, 4)) * 12 + (+ex[0].d.slice(5, 7) - 1)
    : now.getFullYear() * 12 + now.getMonth();
  const cur = expByMonth(S.data).get(curKey) || { total: 0, days: new Set<string>() };
  const lim = +S.data.expenseLimits.total || 0;
  const pct = lim ? Math.min(100, Math.round(cur.total / lim * 100)) : 0;

  const save = async () => {
    const a = parseFloat(d.a) || 0;
    if (a <= 0) { setError('amount'); return; }
    if (!isValidIsoDate(d.d)) { setError('date'); return; }
    if (!d.c || saving || S.expenseSync === 'loading') return;
    const dd = d.d;
    const key = (+dd.slice(0, 4)) * 12 + (+dd.slice(5, 7) - 1);
    const total = (expByMonth(S.data).get(key)?.total || 0) + a;
    setSaving(true);
    setError(null);
    try {
      await saveExpenseEntry({ amount: a, date: dd, categoryId: d.c });
      up(s => { s.expDraft = { a: '', c: s.expDraft.c, d: dd, per: s.expDraft.per }; });
      toast(t('ex_saved', { m: monthName(key % 12), x: nf(total) }));
    } catch {
      setError('save');
      toast(t('ex_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const summary = (
    <View style={exSt.exsum}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ minWidth: 0 }}>
          <Text style={exSt.big}>{rm(cur.total)}</Text>
          <BodyS muted>{t('ex_sofar', { m: monthName(curKey % 12) })} · {t('ex_days', { d: cur.days.size })}</BodyS>
        </View>
        <Prov p="user" />
      </View>
      {lim ? (
        <>
          <View style={exSt.bar}>
            <View style={{
              width: `${pct}%`, height: '100%', borderRadius: 4,
              backgroundColor: pct >= 100 ? C.short : pct >= 80 ? '#E0A800' : '#D9663D',
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <BodyS muted style={{ flexShrink: 1 }}>{t('ex_limit_of', { v: rm(cur.total), l: rm(lim) })}</BodyS>
            <BtnLine label={t('ex_edit_limit')} style={{ fontSize: 13 }} onPress={() => up(s => { s.sheet = 'exlimit'; })} />
          </View>
        </>
      ) : (
        <View style={{ marginTop: 6 }}>
          <BtnLine label={t('ex_set_limit') + ' →'} style={{ fontSize: 13 }} onPress={() => up(s => { s.sheet = 'exlimit'; })} />
        </View>
      )}
    </View>
  );

  const manual = (
    <>
      <InHero tint="out" pillLabel={t('io_out')} question={t('ex_q_' + per)} decimal
        value={d.a}
        onChangeText={v => { setError(null); up(s => { s.expDraft.a = v; }); }} />
      <InSec>
        <InLbl>{t('inc_q_when')}</InLbl>
        <PerSeg per={per} labels={p => t('perx_' + p)} tint="out"
          onPer={p => up(s => { s.expDraft.per = p; })} />
        <BodyS muted style={{ marginTop: 10, marginBottom: 6 }}>
          {per === 'month' ? t('inc_monthof') : per === 'week' ? `${t('inc_weekend')} · ${t('inc_weekany')}` : t('inc_date')}
        </BodyS>
        {per === 'month' ? (
          <DatePickerField
            value={d.d.slice(0, 7)}
            mode="month"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date()}
            onChange={v => { setError(null); up(s => { s.expDraft.d = v + '-15'; }); }}
          />
        ) : per === 'day' ? (
          <DayShortcutPicker
            value={d.d}
            tint="out"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            todayLabel={t('inc_today')}
            yesterdayLabel={t('inc_yday')}
            pickLabel={t('inc_pick')}
            maximumDate={new Date()}
            onChange={v => { setError(null); up(s => { s.expDraft.d = v; }); }}
          />
        ) : (
          <DatePickerField
            value={d.d}
            mode="date"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date()}
            onChange={v => { setError(null); up(s => { s.expDraft.d = v; }); }}
          />
        )}
      </InSec>
      <InSec>
        <InLbl>{t('ex_q_cat')}</InLbl>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {S.data.expenseCats.map(x => (
            <InChip key={x.id} tint="out"
              icon={<CatIcon id={x.id} data={S.data} size={18} color={d.c === x.id ? '#fff' : C.ink} />}
              label={x.custom ? x.name || '' : t(x.k || '')}
              on={d.c === x.id}
              onPress={() => up(s => { s.expDraft.c = x.id; })} />
          ))}
          <InChip dashed tint="out" label={t('xc_own').replace(/^\+\s*|^＋\s*/, '')}
            onPress={() => up(s => { s.sheet = 'xcown'; })} />
        </View>
      </InSec>
      {error ? (
        <InSec>
          <NoteC><BodyS>{t(`ex_${error === 'amount' ? 'amount_positive' : error === 'date' ? 'date_invalid' : 'save_failed'}`)}</BodyS></NoteC>
        </InSec>
      ) : null}
      <InSec last>
        <Pressable onPress={() => { void save(); }} disabled={saving}
          style={({ pressed }) => [exSt.btnOut, (pressed || saving) && { opacity: 0.85 }]}>
          <Text style={{ color: '#fff', fontFamily: DISP_FONT, fontSize: 19 }}>{saving ? t('ex_saving') : t('ex_add')}</Text>
        </Pressable>
      </InSec>
    </>
  );

  const recent = ex.slice(0, 6);

  let bycat: React.ReactNode = null;
  {
    const totals = expCatTotals(S.data, curKey);
    const ent = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const mx = Math.max(1, ...ent.map(([, v]) => v));
    if (ent.length) {
      bycat = (
        <View style={exSt.cardTint}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('ex_bycat')}</Text>
            <Prov p="calc" />
          </View>
          {ent.map(([c, v], i) => (
            <View key={c} style={{ marginVertical: 7 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <BodyS>{cats(c)}</BodyS>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(v)}</Text>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: C.ink14, marginTop: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.round(v / mx * 100)}%`, borderRadius: 4, backgroundColor: CHART_COLS[i % CHART_COLS.length] }} />
              </View>
            </View>
          ))}
        </View>
      );
    }
  }

  return (
    <ScreenShell back title={t('money_expenses')}>
      {S.expenseSync === 'loading' ? <NoteC><BodyS>{t('ex_sync_loading')}</BodyS></NoteC> : null}
      {S.expenseSync === 'error' ? <NoteC><BodyS>{t('ex_sync_error')}</BodyS></NoteC> : null}
      {summary}
      <InCard>
        <InSeg mode={S.exMode} tint="out"
          labels={[['type', t('im_type')], ['scan', t('im_scan')], ['csv', t('im_csv')]]}
          onMode={m => {
            if (m === 'scan') { up(s => { s.scan = { stage: 'pick' }; }); go('expscan'); return; }
            up(s => { s.exMode = m as typeof s.exMode; });
          }} />
        {S.exMode === 'csv' ? <ExpenseCsvBody /> : manual}
      </InCard>
      {recent.length ? (
        <View style={[exSt.cardTint, { paddingVertical: 4 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('ex_recent')}</Text>
            <Prov p="user" />
          </View>
          {recent.map((e, idx) => (
            <InRow key={`${e.d}-${idx}`} first={idx === 0} tint="out"
              icon={<CatIcon id={e.c} data={S.data} size={18} color="#B54F2B" />}
              title={cats(e.c)}
              sub={`${+e.d.slice(8, 10)} ${monthName(+e.d.slice(5, 7) - 1)}${e.merchant ? ' · ' + e.merchant : ''}`}
              subTag={e.method === 'receipt' ? t('sc_tag') : undefined}
              amount={rmx(e.a)} />
          ))}
        </View>
      ) : null}
      {bycat}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => go('expmonths')} style={exSt.hubtile}>
          <View style={exSt.hubIc}><Ico name="calsum" size={22} color="#fff" /></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('ex_see_sum')}</Text>
        </Pressable>
        <Pressable onPress={() => go('exlimits')} style={exSt.hubtile}>
          <View style={exSt.hubIc}><Ico name="gauge" size={22} color="#fff" /></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('ex_set_lims')}</Text>
        </Pressable>
      </View>
      <BodyS muted>{t('ex_rule')}</BodyS>
    </ScreenShell>
  );
}

/**
 * EN: AC1.6.6 groups confirmed expenses by business month for the monthly summary.
 * 中文：AC1.6.6 按业务月份汇总已确认支出，形成月度摘要。
 */
export function ExpMonthsScreen() {
  const { S, t, monthName, up } = useApp();
  const cats = useCatLabel();
  const em = [...expByMonth(S.data).entries()];
  const asc = [...em].sort((a, b) => a[0] - b[0]);
  const max = Math.max(...em.map(([, v]) => v.total), 1);
  const incomeKeys = SHOW_EXPENSE_COMPLETENESS
    ? new Set(monthsAgg(S.data).map(r => r.y * 12 + r.m))
    : new Set<number>();

  const chart = (
    <View style={{ paddingTop: 8, paddingRight: 6, paddingBottom: 4, paddingLeft: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, height: 96 }}>
        {asc.map(([k, v]) => {
          const h = Math.max(6, v.total / max * 100);
          const barHeight = `${h}%` as DimensionValue;
          return (
            <View key={k} style={{ flex: 1, maxWidth: 48, height: '100%', justifyContent: 'flex-end' }}>
              <View style={[
                { height: barHeight, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
                SHOW_EXPENSE_COMPLETENESS && v.days.size < EXP_FULL_DAYS
                  ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.caution }
                  : { backgroundColor: C.ink },
              ]} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, paddingTop: 6 }}>
        {asc.map(([k]) => (
          <Text key={k} style={{ flex: 1, maxWidth: 48, textAlign: 'center', fontSize: 11, letterSpacing: 0.44, color: C.ink64 }}>
            {monthName(k % 12).toUpperCase()}
          </Text>
        ))}
      </View>
      <View style={{ marginTop: 2, alignItems: 'flex-start' }}><Prov p="user" /></View>
    </View>
  );

  const rows = [...em].sort((a, b) => b[0] - a[0]).map(([k, v]) => {
    const y = Math.floor(k / 12), m = k % 12;
    const open = S.exMonthOpen === k;
    let detail: React.ReactNode = null;
    if (open) {
      const totals = expCatTotals(S.data, k);
      detail = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c, x]) => (
        <KV key={c} k={cats(c)}><Fig value={rm(x)} p="calc" cls="body-s" /></KV>
      ));
    }
    return (
      <Card key={k} gap={8}>
        <Pressable
          onPress={() => up(s => { s.exMonthOpen = s.exMonthOpen === k ? null : k; })}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
        >
          <Display cls="h-m">{monthName(m) + ' ' + y}</Display>
          <Text style={{ fontSize: 16, color: C.ink }}>{open ? '−' : '+'}</Text>
        </Pressable>
        <View style={{ gap: 6, alignItems: 'flex-start' }}>
          {SHOW_EXPENSE_COMPLETENESS ? (
            v.days.size >= EXP_FULL_DAYS ? (
              <BodyS muted>{t('ex_full') + (incomeKeys.has(k) ? ' · ' + t('ex_used') : '')}</BodyS>
            ) : (
              <FromR label={t(v.days.size === 1 ? 'ex_partial_one' : 'ex_partial', { d: v.days.size })} />
            )
          ) : null}
          <Fig value={rm(v.total)} p="user" />
        </View>
        {detail}
      </Card>
    );
  });

  return (
    <ScreenShell back title={t('ex_monthly')}>
      {chart}
      {rows}
      {SHOW_EXPENSE_COMPLETENESS ? <BodyS muted>{t('ex_rule')}</BodyS> : null}
    </ScreenShell>
  );
}

export function ExLimitsScreen() {
  const { S, t, monthName, up } = useApp();
  const ek = latestExpMonth(S.data);
  const totals = ek != null ? expCatTotals(S.data, ek) : new Map<string, number>();
  const monthTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  const lims = S.data.expenseLimits;

  const row = (label: string, spend: number, id: string) => {
    const lim = +lims[id] || 0;
    return (
      <Card key={id} gap={8}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <P>{label}</P>
          <Fig value={rm(spend)} p="user" cls="body-s" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <BodyS muted>{t('lm_limit')}</BodyS>
            <Prov p="user" />
          </View>
          <NumInput value={lims[id] || 0} onNum={n => up(s => { s.data.expenseLimits[id] = Math.max(0, n); })} alignRight />
        </View>
        {lim > 0 ? (
          <>
            <HBar spend={spend} lim={lim} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <BodyS muted>{spend > lim ? t('lm_over', { x: nf(spend - lim) }) : t('lm_left', { x: nf(lim - spend) })}</BodyS>
              <Prov p="calc" />
            </View>
          </>
        ) : (
          <FromR label={t('lm_none')} />
        )}
      </Card>
    );
  };

  const catRows = S.data.expenseCats.filter(c => totals.get(c.id) || lims[c.id])
    .map(c => row(c.custom ? c.name || '' : t(c.k || ''), totals.get(c.id) || 0, c.id));

  return (
    <ScreenShell back title={t('ex_limits')}>
      <BodyS muted>{t('lm_note')}</BodyS>
      {row(t('lm_total') + ' · ' + (ek != null ? monthName(ek % 12) : ''), monthTotal, 'total')}
      {catRows}
    </ScreenShell>
  );
}

/**
 * EN: US1.5 validates amount/date/category before adding a manual expense to the current record.
 * 中文：US1.5 在把手工支出加入当前记录前校验金额、日期和类别。
 */
export function ExpAddScreen() {
  const { S, t, monthName, up, toast, backNav, saveExpenseEntry } = useApp();
  const d = S.expDraft;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<'amount' | 'date' | 'save' | null>(null);

  const save = async () => {
    const a = parseFloat(d.a) || 0;
    if (a <= 0) { setError('amount'); return; }
    if (!isValidIsoDate(d.d)) { setError('date'); return; }
    if (!d.c || saving || S.expenseSync === 'loading') return;
    const dd = d.d;
    const key = (+dd.slice(0, 4)) * 12 + (+dd.slice(5, 7) - 1);
    const total = (expByMonth(S.data).get(key)?.total || 0) + a;
    setSaving(true);
    setError(null);
    try {
      await saveExpenseEntry({ amount: a, date: dd, categoryId: d.c });
      up(s => {
        s.expDraft = { a: '', c: s.expDraft.c, d: dd, per: s.expDraft.per };
      });
      toast(t('ex_saved', { m: monthName(key % 12), x: nf(total) }));
      backNav();
    } catch {
      setError('save');
      toast(t('ex_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell back title={t('ex_add')}>
      {S.expenseSync === 'loading' ? <NoteC><BodyS>{t('ex_sync_loading')}</BodyS></NoteC> : null}
      {S.expenseSync === 'error' ? <NoteC><BodyS>{t('ex_sync_error')}</BodyS></NoteC> : null}
      <Card gap={8}>
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('inc_amount')}</BodyS>
          <TextField value={d.a} keyboardType="decimal-pad" inputMode="decimal"
            onChangeText={v => { setError(null); up(s => { s.expDraft.a = v; }); }} />
        </View>
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('ex_cat')}</BodyS>
          <Chips>
            {S.data.expenseCats.map(x => (
              <Chip key={x.id} label={x.custom ? x.name || '' : t(x.k || '')} on={d.c === x.id}
                onPress={() => up(s => { s.expDraft.c = x.id; })} />
            ))}
            <Chip label={t('xc_own')} onPress={() => up(s => { s.sheet = 'xcown'; })} />
          </Chips>
        </View>
        <View style={{ gap: 6 }}>
          <BodyS muted>{t('inc_date')}</BodyS>
          <DayShortcutPicker
            value={d.d}
            tint="out"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date()}
            onChange={v => { setError(null); up(s => { s.expDraft.d = v; }); }}
            todayLabel={t('inc_today')}
            yesterdayLabel={t('inc_yday')}
            pickLabel={t('inc_pick')}
          />
        </View>
        {error ? <BodyS>{t(`ex_${error === 'amount' ? 'amount_positive' : error === 'date' ? 'date_invalid' : 'save_failed'}`)}</BodyS> : null}
        <Btn label={saving ? t('ex_saving') : t('ex_add')} onPress={() => { void save(); }} />
      </Card>
    </ScreenShell>
  );
}

/**
 * EN: US1.7 keeps receipt-derived values editable and non-authoritative until explicit confirmation.
 * 中文：US1.7 让收据识别值可编辑，并在显式确认前保持非权威状态。
 */
export function ExpScanScreen() {
  const { S, t, up, toast, monthName, saveExpenseEntry } = useApp();
  const st = S.scan.stage;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<'amount' | 'date' | 'save' | 'image' | 'scan' | 'notreceipt' | null>(null);

  /* Read step. A photographed receipt goes to the backend, which asks the
     Groq vision model for a structured draft. The sample receipt (no photo)
     keeps the offline mock so the flow works without an API key (US1.7:
     the review/edit/confirm boundary stays the authoritative behaviour). */
  React.useEffect(() => {
    if (S.route !== 'expscan' || st !== 'read') return;
    const picked = getPickedReceipt();
    const useApi = INCOME_API_ENABLED && S.scan.thumb != null && picked != null;

    if (!useApi) {
      const timer = setTimeout(() => {
        up(s => {
          if (s.route !== 'expscan' || s.scan.stage !== 'read') return;
          const groceries = s.data.expenseCats.find(category => category.k === 'xc_groc')
            || s.data.expenseCats[0];
          s.scan = {
            stage: 'confirm', thumb: s.scan.thumb,
            vals: {
              m: 'Kedai Runcit Maju',
              d: s.expDraft.d,
              a: 34.70,
              c: groceries?.id || s.expDraft.c,
            },
            src: { m: true, d: true, a: true },
            aiC: groceries?.id || s.expDraft.c,
          };
        });
      }, 1400);
      return () => clearTimeout(timer);
    }

    let active = true;
    void (async () => {
      try {
        const result = await scanReceipt(picked.base64, picked.mediaType);
        if (!active) return;
        setPickedReceipt(null);
        if (!result.is_receipt) {
          setError('notreceipt');
          up(s => { s.scan = { stage: 'pick' }; });
          return;
        }
        up(s => {
          if (s.route !== 'expscan' || s.scan.stage !== 'read') return;
          const bySlug = result.category_slug
            ? s.data.expenseCats.find(category => category.k === `xc_${result.category_slug}`)
            : undefined;
          const suggested = bySlug?.id || s.expDraft.c;
          /* Unread fields stay empty and unmarked (AC6.1.9/AC6.1.10) — the
             user completes them; save stays blocked until they are valid. */
          s.scan = {
            stage: 'confirm', thumb: s.scan.thumb,
            vals: {
              m: result.merchant || '',
              d: result.date || '',
              a: result.total ? Number.parseFloat(result.total) : '',
              c: suggested,
            },
            src: {
              m: result.merchant != null,
              d: result.date != null,
              a: result.total != null,
            },
            aiC: suggested,
          };
        });
      } catch {
        if (!active) return;
        setError('scan');
        toast(t('ex_scan_failed'), 'error');
        up(s => { s.scan = { stage: 'pick' }; });
      }
    })();
    return () => { active = false; };
  }, [S.route, st, up]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('image');
          toast(t('ex_image_failed'));
          return;
        }
      }
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!res.canceled && res.assets.length) {
        const asset = res.assets[0];
        /* Phone photos are several MB; the vision API caps base64 images at
           4 MB. A receipt stays perfectly readable at ~1280px wide, which
           uploads in a few hundred KB. */
        const resized = await manipulateAsync(
          asset.uri,
          asset.width && asset.width > 1280 ? [{ resize: { width: 1280 } }] : [],
          { compress: 0.7, format: SaveFormat.JPEG, base64: true },
        );
        if (resized.base64) {
          setPickedReceipt({ base64: resized.base64, mediaType: 'image/jpeg' });
        } else {
          setPickedReceipt(null);
        }
        up(s => { s.scan = { stage: 'read', thumb: asset.uri }; });
      }
    } catch {
      setError('image');
      toast(t('ex_image_failed'));
    }
  };

  let body: React.ReactNode;
  if (st === 'pick') {
    body = (
      <>
        <P>{t('ex_scan_pick')}</P>
        <Btn label={t('ex_take_photo')} onPress={() => { void pickPhoto('camera'); }} />
        <BtnQuiet onPress={() => { void pickPhoto('library'); }}>
          <P>{t('ex_choose_photo')}</P>
        </BtnQuiet>
        <BtnQuiet onPress={() => { setError(null); up(s => { s.scan = { stage: 'read', thumb: null }; }); }}>
          <P>{t('ex_scan_sample')}</P>
        </BtnQuiet>
        {error === 'image' ? <BodyS>{t('ex_image_failed')}</BodyS> : null}
        {error === 'scan' ? <BodyS>{t('ex_scan_failed')}</BodyS> : null}
        {error === 'notreceipt' ? <BodyS>{t('ex_not_receipt')}</BodyS> : null}
      </>
    );
  } else if (st === 'read') {
    body = (
      <>
        <Shimmer label={t('ex_reading')} />
        <BodyS muted>{t('ex_reading')}</BodyS>
      </>
    );
  } else {
    const v = S.scan.vals!;
    /* Absent src means every field came from the receipt (sample flow). */
    const src = S.scan.src || { m: true, d: true, a: true };
    const missing = !src.m || !src.d || !src.a;
    body = (
      <>
        <BodyS>{t('ex_check')}</BodyS>
        {missing ? <NoteC><BodyS>{t('ex_scan_partial')}</BodyS></NoteC> : null}
        {S.scan.thumb ? (
          <Image source={{ uri: S.scan.thumb }} style={{ maxWidth: '100%', height: 140, borderRadius: 12, resizeMode: 'cover' }} />
        ) : null}
        <Card gap={8}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('ex_merchant')}</BodyS>
              {src.m ? <FromR label={t('ex_fromr')} /> : null}
            </View>
            <TextField value={v.m} onChangeText={x => up(s => { s.scan.vals!.m = x; })} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('inc_date')}</BodyS>
              {src.d ? <FromR label={t('ex_fromr')} /> : null}
            </View>
            <TextField value={v.d} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD"
              onChangeText={x => up(s => { s.scan.vals!.d = x; })} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('ex_total')}</BodyS>
              {src.a ? <FromR label={t('ex_fromr')} /> : null}
            </View>
            <NumInput decimal value={v.a === '' ? '' : +v.a || 0} onNum={n => up(s => { s.scan.vals!.a = n; })} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('ex_cat')}</BodyS>
              {S.scan.aiC && v.c === S.scan.aiC ? <FromR label={t('ex_ai_suggested')} /> : null}
            </View>
            <Chips>
              {S.data.expenseCats.map(x => (
                <Chip key={x.id} label={x.custom ? x.name || '' : t(x.k || '')} on={v.c === x.id}
                  onPress={() => up(s => { s.scan.vals!.c = x.id; })} />
              ))}
            </Chips>
          </View>
          {error && error !== 'image' ? <BodyS>{t(`ex_${error === 'amount' ? 'amount_positive' : error === 'date' ? 'date_invalid' : 'save_failed'}`)}</BodyS> : null}
          <Btn label={saving ? t('ex_saving') : t('add')} onPress={() => { void (async () => {
            const a = +v.a || 0;
            if (a <= 0) { setError('amount'); return; }
            if (!isValidIsoDate(v.d)) { setError('date'); return; }
            if (!v.c || saving) return;
            const dd = v.d;
            const key = (+dd.slice(0, 4)) * 12 + (+dd.slice(5, 7) - 1);
            const total = (expByMonth(S.data).get(key)?.total || 0) + a;
            setSaving(true);
            setError(null);
            try {
              await saveExpenseEntry({
                amount: a,
                date: dd,
                categoryId: v.c,
                entryMethod: 'receipt',
                merchant: v.m.trim(),
                confirmReceipt: true,
              });
              up(s => {
              s.scan = { stage: 'pick' };
              s.route = 'expenses';
              });
              toast(t('ex_saved', { m: monthName(key % 12), x: nf(total) }));
            } catch {
              setError('save');
              toast(t('ex_save_failed'));
            } finally {
              setSaving(false);
            }
          })(); }} />
          <BtnLine label={t('ex_retake')} onPress={() => { setError(null); up(s => { s.scan = { stage: 'pick' }; }); }} />
        </Card>
      </>
    );
  }

  return (
    <ScreenShell back title={t('ex_scan')}>
      <Badge label={t('ex_preview')} />
      {body}
    </ScreenShell>
  );
}

const exSt = StyleSheet.create({
  cardTint: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.ink14, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  exsum: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  big: { fontFamily: DISP_FONT, fontSize: 24, lineHeight: 28, color: C.ink, fontVariant: ['tabular-nums'] },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.ink14, overflow: 'hidden', marginTop: 8 },
  btnOut: {
    minHeight: 52, backgroundColor: '#D9663D', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, width: '100%',
  },
  hubtile: {
    flex: 1, minHeight: 92, backgroundColor: C.card, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 14, gap: 8,
  },
  hubIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
