import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { useApp } from '../state';
import { logIt } from '../log';
import {
  expByMonth, expCatTotals, expenseMonthComplete, latestExpMonth, monthsAgg, nf, pickMonth, rm, rmx,
} from '../calc';
import {
  BodyS, Btn, BtnLine, Card, Chip, Chips, Display, Fig, FromR,
  IcLab, KV, NoteC, NumInput, P, Prov, StackS, TextField,
  CardI, MonthBtn,
} from '../ui';
import { C, CHART_COLS, DISP_FONT } from '../theme';
import { Ico } from '../svgs';
import { CatIcon, guessCat } from '../icons';
import { CSV_SAMPLE_EX, csvAmount, parseCsv, parseDateAny } from '../csv';
import { DayShortcutPicker, Drop, InCard, InChip, InHero, InLbl, InRow, InSec, InSeg, MockStmt, PerSeg } from '../incard';
import { Ruma } from '../ruma-view';
import { HBar } from '../charts';
import { ScreenShell } from './shell';
import { isValidIsoDate } from '../validation';
import { DatePickerField } from '../date-picker';
import { INCOME_API_ENABLED, scanReceipt } from '../api';
import { getPickedReceipt, setPickedReceipt } from '../../../services/receiptSession';
import { getHousingTestResult } from '../../../services/housingSession';

/* v24 shows month completeness (full/partial, dashed bars) everywhere. */
const SHOW_EXPENSE_COMPLETENESS = true;

function useCatLabel() {
  const { S, t } = useApp();
  return (id: string) => {
    const c = S.data.expenseCats.find(x => x.id === id);
    return id === 'monthly_total' ? t('ex_month_total') : c ? (c.custom ? c.name || '' : t(c.k || '')) : id;
  };
}

/* v22 expense CSV importer: paste (or sample) a statement, auto-map the
   columns, then every kept row is saved through the real expense API. */
function ExpenseCsvBody() {
  const { S, t, up, monthName, saveExpenseEntry, toast } = useApp();
  const c = S.exCsv;
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
        {allowNone ? <Chip label={t('cv_nocol')} on={sel < 0} onPress={() => onPick(-1)} /> : null}
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

  /* v24 .drop: choose the .csv file, exactly like the income Import tab;
     the template link and the sample sit under it. */
  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
      load(text);
    } catch {
      up(s => { s.exCsv = { stage: 'pick', err: t('cv_none') }; });
    }
  };
  const downloadTemplate = () => {
    if (typeof document === 'undefined') return;
    const blob = new Blob(['date,amount,description\n2026-08-02,12.50,Mamak Bistro\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rumampu-expenses-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
      {c.err ? <NoteC><BodyS>{c.err}</BodyS></NoteC> : null}
      <Drop icon="csv" tint="out" title={t('cvi_pick')} hint={t('exc_hint')} onPress={() => { void chooseFile(); }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
        {Platform.OS === 'web' ? <BtnLine label={t('cv_tpl')} onPress={downloadTemplate} style={{ fontSize: 14 }} /> : null}
        <BtnLine label={t('cv_sample')} style={{ fontSize: 14 }} onPress={() => load(CSV_SAMPLE_EX)} />
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
  const { S, t, monthName, go, up, toast, saveExpenseEntry, saveWorkCostEntry } = useApp();
  const cats = useCatLabel();
  /* Figma B6: a work expense records into Work costs, not daily spending. */
  const [forWork, setForWork] = React.useState(false);
  const [workCat, setWorkCat] = React.useState<string | null>(null);
  const d = S.expDraft;
  const per = d.per || 'day';
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<'amount' | 'date' | 'save' | null>(null);
  const now = new Date();
  /* v24 R7g: one month drives the whole screen, chosen at the top and defaulting
     to the newest month that holds anything at all. */
  const mpk = pickMonth(S.exMonth, [S.data.expenses, S.data.workCostEntries]);
  const curKey = mpk.key != null ? mpk.key : now.getFullYear() * 12 + now.getMonth();
  const cur = expByMonth(S.data).get(curKey) || { total: 0, days: new Set<string>(), monthlyTotal: false };
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
      if (forWork) {
        const cat = workCat ?? S.data.workCostCategories[0]?.id;
        if (!cat) { setError('save'); setSaving(false); return; }
        await saveWorkCostEntry({ amount: a, date: dd, categoryId: cat });
        up(s => { s.expDraft = { a: '', c: s.expDraft.c, d: dd, per: s.expDraft.per }; });
        toast(t('wk_saved'));
        setSaving(false);
        return;
      }
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
          <BodyS muted>{t('ex_sofar', { m: monthName(curKey % 12) })} · {cur.monthlyTotal ? t('ex_month_total') : t('ex_days', { d: cur.days.size })}</BodyS>
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
      {/* v24 R7 item 3: one amount and one date. */}
      <InHero tint="out" pillLabel={t('io_out')} question={t('r7_ex_q')} decimal
        value={d.a}
        onChangeText={v => { setError(null); up(s => { s.expDraft.a = v; }); }} />
      <InSec>
        <InLbl>{t('inc_q_when')}</InLbl>
        <DatePickerField
          value={d.d}
          mode="date"
          monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
          maximumDate={new Date()}
          onChange={v => { setError(null); up(s => { s.expDraft.d = v; }); }}
        />
      </InSec>
      <InSec>
        {/* v24 R8b: the switch comes before the categories; the explanation is behind the (i). */}
        <Pressable onPress={() => setForWork(w => !w)}
          accessibilityRole="switch" accessibilityState={{ checked: forWork }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <InLbl>{t('ex_forwork')}</InLbl>
            <CardI t="ex_forwork" b={['ex_work_h']} p="user" />
          </View>
          <View style={{
            width: 46, height: 28, borderRadius: 14, padding: 3,
            backgroundColor: forWork ? C.brand : C.ink14,
            alignItems: forWork ? 'flex-end' : 'flex-start', justifyContent: 'center',
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
          </View>
        </Pressable>
      </InSec>
      <InSec>
        <InLbl>{t('ex_q_cat')}</InLbl>
        {forWork ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {S.data.workCostCategories.map(x => (
              <InChip key={x.id} tint="out"
                label={x.custom ? x.name || '' : t(x.k || '')}
                on={(workCat ?? S.data.workCostCategories[0]?.id) === x.id}
                onPress={() => setWorkCat(x.id)} />
            ))}
          </View>
        ) : (
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
        )}
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
        {/* v24 R7 item 3: bulk entry for a whole past month stays, as a quiet link. */}
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <BtnLine label={t('ex_month_total')} style={{ fontSize: 13.5 }}
            onPress={() => up(s => { s.pastT = 'ex'; s.sheet = 'pastmonth'; })} />
        </View>
      </InSec>
    </>
  );

  /* v24: the recent list shows the chosen month only, newest date first. */
  const recent = [...S.data.expenses]
    .filter(e => (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1) === curKey)
    .sort((a, b) => (a.d < b.d ? 1 : -1))
    .slice(0, 8);

  /* v24: work costs get their own table on the same month — a separate
     record of what it cost to earn, never mixed with daily spending. */
  const wcName = (e: { categoryId: string; categoryName?: string }) => {
    if (e.categoryName) return e.categoryName;
    const cat = S.data.workCostCategories.find(x => x.id === e.categoryId);
    return cat ? (cat.custom ? cat.name || '' : t(cat.k || '')) : e.categoryId;
  };
  const wmonth = S.data.workCostEntries
    .filter(e => (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1) === curKey);
  const wlist = [...wmonth].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8);
  const wcSum = wmonth.reduce((a, e) => a + (+e.a || 0), 0);

  let bycat: React.ReactNode = null;
  {
    const totals = expCatTotals(S.data, curKey);
    const ent: [string, number][] = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (wcSum > 0) ent.push(['__wc', wcSum]);
    const mx = Math.max(1, ...ent.map(([, v]) => v));
    if (ent.length) {
      bycat = (
        <View style={exSt.cardTint}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('ex_bycat')}</Text>
            <CardI t="ex_bycat" b={['wc_bynote', 'ex_rule']} p="calc" />
          </View>
          {ent.map(([c, v], i) => (
            <View key={c} style={{ marginVertical: 7 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <BodyS>{c === '__wc' ? t('wc_bycat') : cats(c)}</BodyS>
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
        {/* v24: Manual / Scan / Import live in one card, exactly like Income.
            The receipt scan renders in place under its tab. */}
        <InSeg mode={S.exMode} tint="out"
          labels={[['type', t('im_type')], ['scan', t('im_scan')], ['csv', t('im_csv')]]}
          onMode={m => {
            up(s => { s.exMode = m as typeof s.exMode; });
          }} />
        {S.exMode === 'csv' ? <ExpenseCsvBody /> : S.exMode === 'scan' ? <ExpenseScanBody /> : manual}
      </InCard>
      {S.data.expenses.length ? (
        <>
        <MonthBtn act="exmonth" monthKey={mpk.key} />
        <View style={[exSt.cardTint, { paddingVertical: 4 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('ex_recent')}</Text>
            <Prov p="user" />
          </View>
          {recent.map((e, idx) => (
            <InRow key={`${e.d}-${idx}`} first={idx === 0} tint="out"
              icon={<CatIcon id={e.c} data={S.data} size={18} color="#B54F2B" />}
              title={e.method === 'monthly_total' ? t('ex_month_total') : cats(e.c)}
              sub={`${+e.d.slice(8, 10)} ${monthName(+e.d.slice(5, 7) - 1)}${e.merchant ? ' · ' + e.merchant : ''}`}
              subTag={e.method === 'receipt' ? t('sc_tag') : undefined}
              amount={rmx(e.a)} />
          ))}
        </View>
        </>
      ) : null}
      <View style={[exSt.cardTint, { paddingVertical: 4 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('wc_tbl')}</Text>
          <Prov p="user" />
        </View>
        {wlist.length ? wlist.map((e, idx) => (
          <InRow key={e.id} first={idx === 0} tint="out"
            icon={<Ico name="wrench" size={18} color="#B54F2B" />}
            title={wcName(e)}
            sub={`${+e.d.slice(8, 10)} ${monthName(+e.d.slice(5, 7) - 1)}`}
            amount={rmx(e.a)} />
        )) : (
          <BodyS muted style={{ paddingBottom: 12 }}>{t('wc_tbl_none')}</BodyS>
        )}
      </View>
      {bycat}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => go('expmonths')} style={exSt.hubtile}>
          <View style={exSt.hubIc}><Ico name="calsum" size={22} color="#fff" /></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('ex_see_sum')}</Text>
        </Pressable>
        <Pressable onPress={() => go('commit')} style={exSt.hubtile}>
          <View style={exSt.hubIc}><Ico name="gauge" size={22} color="#fff" /></View>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t('ex_set_lims')}</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

/**
 * EN: AC1.6.6 groups confirmed expenses by business month for the monthly summary.
 * 中文：AC1.6.6 按业务月份汇总已确认支出，形成月度摘要。
 */
export function ExpMonthsScreen() {
  const { S, t, monthName, up, setExpenseMonthlyTotal, toast } = useApp();
  const [updatingMonth, setUpdatingMonth] = React.useState<number | null>(null);
  const cats = useCatLabel();
  const em = [...expByMonth(S.data).entries()];
  const asc = [...em].sort((a, b) => a[0] - b[0]);
  const max = Math.max(...em.map(([, v]) => v.total), 1);
  /* AC4.1.4: label a month as used only when it is present in the
     actual housing-test result. This mirrors the backend's tested month list
     (including its exclusion of the current calendar month) instead of
     guessing from whether an income entry exists. */
  const housingResult = getHousingTestResult();
  const usedInTestKeys = SHOW_EXPENSE_COMPLETENESS && S.testRan && housingResult
    ? new Set(housingResult.months.map(r => r.year * 12 + (r.month - 1)))
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
                SHOW_EXPENSE_COMPLETENESS && !expenseMonthComplete(v)
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
      <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center' }}>
        <CardI t="ex_monthly" b={['ex_rule']} p="user" />
      </View>
    </View>
  );

  const rows = [...em].sort((a, b) => b[0] - a[0]).map(([k, v]) => {
    const y = Math.floor(k / 12), m = k % 12;
    const open = S.exMonthOpen === k;
    const entries = S.data.expenses.filter(entry => (+entry.d.slice(0, 4)) * 12 + (+entry.d.slice(5, 7) - 1) === k);
    const soleEntry = entries.length === 1 ? entries[0] : null;
    const canClassify = soleEntry?.id && (soleEntry.method === 'manual' || soleEntry.method === 'monthly_total');
    const changeCoverage = async () => {
      if (!soleEntry?.id || updatingMonth != null) return;
      setUpdatingMonth(k);
      try {
        await setExpenseMonthlyTotal(soleEntry.id, soleEntry.method !== 'monthly_total');
      } catch {
        toast(t('ex_save_failed'), 'error');
      } finally {
        setUpdatingMonth(null);
      }
    };
    let detail: React.ReactNode = null;
    if (open) {
      const totals = expCatTotals(S.data, k);
      detail = <>
        {v.monthlyTotal ? <BodyS muted>{t('ex_no_category_breakdown')}</BodyS>
          : [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c, x]) => (
            <KV key={c} k={cats(c)}><Fig value={rm(x)} p="calc" cls="body-s" /></KV>
          ))}
        {canClassify ? <BtnLine
          label={t(soleEntry.method === 'monthly_total' ? 'ex_mark_daily' : 'ex_mark_month_total')}
          onPress={() => { void changeCoverage(); }}
          style={{ fontSize: 13, alignSelf: 'flex-start', opacity: updatingMonth === k ? 0.5 : 1 }}
        /> : null}
      </>;
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
        <View style={{ gap: 4 }}>
          <BodyS muted style={{ flexWrap: 'wrap' }}>
            {v.monthlyTotal ? t('ex_month_total_status')
              : expenseMonthComplete(v) ? t('ex_full')
                : t(v.days.size === 1 ? 'ex_partial_one' : 'ex_partial', { d: v.days.size })}
            {usedInTestKeys.has(k) ? ' · ' + t('ex_used') : ''}
          </BodyS>
          <View style={{ alignItems: 'flex-end' }}><Fig value={rm(v.total)} p="user" /></View>
        </View>
        {detail}
      </Card>
    );
  });

  return (
    <ScreenShell back title={t('ex_monthly')}>
      {chart}
      {rows}
    </ScreenShell>
  );
}

/* Body shared by the standalone limits screen and the merged
   Bills-and-limits screen (Figma B9). */
export function ExLimitsBody() {
  const { S, t, monthName, up } = useApp();
  const ek = latestExpMonth(S.data);
  const totals = ek != null ? expCatTotals(S.data, ek) : new Map<string, number>();
  const monthTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  const lims = S.data.expenseLimits;

  /* Zero limits display a faint 0 placeholder that typing replaces immediately. */
  const row = (label: string, spend: number, id: string, first: boolean) => {
    const lim = +lims[id] || 0;
    return (
      <View key={id} style={{ gap: 6, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: C.ink14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <P>{label}</P>
          <Text style={{
            fontFamily: DISP_FONT,
            fontSize: 15,
            color: spend === 0 ? C.ink64 : C.ink,
            fontVariant: ['tabular-nums'],
          }}>{rm(spend)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BodyS muted style={{ flex: 1 }}>{t('lm_limit')}</BodyS>
          <NumInput value={lim}
            accessibilityLabel={`${label} ${t('lm_limit')}`}
            zeroPlaceholder
            onNum={n => up(s => { s.data.expenseLimits[id] = Math.max(0, n); logIt(s, id === 'total' ? 'lg_limit_total' : 'lg_limit', { a: rm(Math.max(0, n)) }, `lim:${id}`); })} alignRight />
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
          <BodyS muted>{t('lm_none')}</BodyS>
        )}
      </View>
    );
  };

  /* AC4.2.2: every available expense category is shown so the user can
     set a limit before any spending has been recorded in that category. */
  const catRows = S.data.expenseCats
    .map(c => row(c.custom ? c.name || '' : t(c.k || ''), totals.get(c.id) || 0, c.id, false));

  return (
    <Card gap={0}>
      <View style={{ paddingBottom: 10 }}>
        <BodyS muted>{t('lm_note')}</BodyS>
      </View>
      {row(t('lm_total') + ' · ' + (ek != null ? monthName(ek % 12) : ''), monthTotal, 'total', true)}
      {catRows}
      <View style={{ paddingTop: 6, alignItems: 'flex-start' }}><Prov p="user" /></View>
    </Card>
  );
}

export function ExLimitsScreen() {
  const { t } = useApp();
  return (
    <ScreenShell back title={t('ex_limits')}>
      <ExLimitsBody />
    </ScreenShell>
  );
}

/**
 * EN: US1.5 validates amount/date/category before adding a manual expense to the current record.
 * 中文：US1.5 在把手工支出加入当前记录前校验金额、日期和类别。
 */
/* The old stand-alone add and scan routes now open the one tabbed Expenses
   screen (Manual / Scan / Import), the same anatomy as Income. The route
   names stay valid so nothing that navigates to them breaks. */
export function ExpAddScreen() {
  return <ExpensesScreen />;
}

export function ExpScanScreen() {
  return <ExpensesScreen />;
}

/**
 * EN: US1.7 keeps receipt-derived values editable and non-authoritative until explicit confirmation.
 * v24: rendered inside the entry card under the Scan tab, like the income scan.
 * 中文：US1.7 让收据识别值可编辑，并在显式确认前保持非权威状态。
 */
function ExpenseScanBody() {
  const { S, t, up, toast, monthName, saveExpenseEntry } = useApp();
  const st = S.scan.stage;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<'amount' | 'date' | 'save' | 'image' | 'scan' | 'notreceipt' | null>(null);

  /* Read step. A photographed receipt goes to the backend, which asks the
     Groq vision model for a structured draft. The sample receipt (no photo)
     keeps the offline mock so the flow works without an API key (US1.7:
     the review/edit/confirm boundary stays the authoritative behaviour). */
  React.useEffect(() => {
    if (S.exMode !== 'scan' || st !== 'read') return;
    const picked = getPickedReceipt();
    const useApi = INCOME_API_ENABLED && S.scan.thumb != null && picked != null;

    if (!useApi) {
      const timer = setTimeout(() => {
        up(s => {
          if (s.exMode !== 'scan' || s.scan.stage !== 'read') return;
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
          if (s.exMode !== 'scan' || s.scan.stage !== 'read') return;
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
            /* Only a category the model actually named is marked as its
               suggestion; a fallback to the draft's category is not (AC6.1.10). */
            aiC: bySlug?.id,
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
  }, [S.exMode, st, up]);

  /* Quick-menu shortcut: Add → Scan a receipt → Expense goes straight to
     the camera instead of stopping at the picker step. */
  const scanAuto = S.scanAuto;
  React.useEffect(() => {
    if (S.exMode !== 'scan' || !scanAuto) return;
    up(s => { s.scanAuto = false; });
    void pickPhoto('camera');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanAuto]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
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

  if (st === 'pick') {
    /* v24 .drop: one tappable area (photo library), the camera button under
       it, the sample as a quiet link. Same anatomy as the income scan tab. */
    return (
      <InSec last>
        <Drop icon="scan" tint="out" title={t('ex_scan')} hint={t('ex_scan_pick')}
          onPress={() => { void pickPhoto('library'); }} />
        <View style={{ marginTop: 10 }}>
          <Pressable onPress={() => { void pickPhoto('camera'); }}
            style={({ pressed }) => [exSt.btnOut, pressed && { opacity: 0.85 }]}>
            <Text style={{ color: '#fff', fontFamily: DISP_FONT, fontSize: 19 }}>{t('ex_take_photo')}</Text>
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <BtnLine label={t('ex_scan_sample')} style={{ fontSize: 13.5 }}
            onPress={() => { setError(null); up(s => { s.scan = { stage: 'read', thumb: null }; }); }} />
        </View>
        {error === 'image' ? <NoteC><BodyS>{t('ex_image_failed')}</BodyS></NoteC> : null}
        {error === 'scan' ? <NoteC><BodyS>{t('ex_scan_failed')}</BodyS></NoteC> : null}
        {error === 'notreceipt' ? <NoteC><BodyS>{t('ex_not_receipt')}</BodyS></NoteC> : null}
      </InSec>
    );
  }

  if (st === 'read') {
    return (
      <InSec last>
        <MockStmt />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <Ruma w={56} pose="count" float={false} />
          <BodyS muted>{t('ex_reading')}</BodyS>
        </View>
      </InSec>
    );
  }

  {
    const v = S.scan.vals!;
    /* Absent src means every field came from the receipt (sample flow). */
    const src = S.scan.src || { m: true, d: true, a: true };
    const missing = !src.m || !src.d || !src.a;
    return (
      <InSec last>
        <BodyS muted>{t('ex_check')}</BodyS>
        {missing ? <NoteC><BodyS>{t('ex_scan_partial')}</BodyS></NoteC> : null}
        {S.scan.thumb ? (
          <Image source={{ uri: S.scan.thumb }} style={{ maxWidth: '100%', height: 120, borderRadius: 12, resizeMode: 'cover', marginTop: 8 }} />
        ) : null}
        <View style={{ gap: 8, marginTop: 8 }}>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {S.data.expenseCats.map(x => (
                <InChip key={x.id} tint="out"
                  icon={<CatIcon id={x.id} data={S.data} size={18} color={v.c === x.id ? '#fff' : C.ink} />}
                  label={x.custom ? x.name || '' : t(x.k || '')} on={v.c === x.id}
                  onPress={() => up(s => { s.scan.vals!.c = x.id; })} />
              ))}
            </View>
          </View>
          {error && error !== 'image' ? <NoteC><BodyS>{t(`ex_${error === 'amount' ? 'amount_positive' : error === 'date' ? 'date_invalid' : 'save_failed'}`)}</BodyS></NoteC> : null}
          <Pressable disabled={saving} style={({ pressed }) => [exSt.btnOut, (pressed || saving) && { opacity: 0.85 }]} onPress={() => { void (async () => {
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
                s.exMode = 'type';
              });
              toast(t('ex_saved', { m: monthName(key % 12), x: nf(total) }));
            } catch {
              setError('save');
              toast(t('ex_save_failed'));
            } finally {
              setSaving(false);
            }
          })(); }}>
            <Text style={{ color: '#fff', fontFamily: DISP_FONT, fontSize: 19 }}>{saving ? t('ex_saving') : t('ex_add')}</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <BtnLine label={t('ex_retake')} style={{ fontSize: 13.5 }} onPress={() => { setError(null); up(s => { s.scan = { stage: 'pick' }; }); }} />
          </View>
        </View>
      </InSec>
    );
  }
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
