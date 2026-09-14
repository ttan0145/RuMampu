import React from 'react';
import { DimensionValue, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Route, useApp } from '../state';
import { MOCK } from '../mock';
import { ApiCoverageAnswer, INCOME_API_ENABLED } from '../api';
import { formatApiMoney } from '../money';
import {
  actualMonths, commitTotal, expByMonth, monthsAgg, nf, pickMonth, recordSummary, rm,
} from '../calc';
import {
  Badge, BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Divider, EditList,
  Fig, IcLab, KV, NoteC, P, Prov, StackS, TextField,
  CardI, MonthBtn,
} from '../ui';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT } from '../theme';
import { SvgXml } from 'react-native-svg';
import { LOG_META, logClock, logRecent, logWhen } from '../log';
import { ExLimitsBody } from './expenses';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { scanIncomeStatement } from '../api';
import { Ico } from '../svgs';
import { SrcIcon } from '../icons';
import { Ruma } from '../ruma-view';
import {
  DayShortcutPicker, Drop, InCard, InChip, InHero, InLbl, InRow, InSec, InSeg, MockStmt,
} from '../incard';
import { IncomePatternChart } from '../charts';
import { ScreenShell } from './shell';
import { IncomeCsvBody } from './imports';
import { isValidIsoDate, isValidMoneyText } from '../validation';
import { DatePickerField } from '../date-picker';

/* v22 money tab: this-month hero, quiet vs usual band, six-month trend,
   fixed-cost tiles, spending pace, grouped links. */

function monthKeyOf(d: string): number { return (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1); }

export function MoneyScreen() {
  const { S, t, monthName, up, go } = useApp();
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();
  /* month shown: the current month if it has income, else the latest month with income */
  const recordedKeys = new Set(S.data.income.map(e => monthKeyOf(e.d)));

  const mk = recordedKeys.has(thisKey)
    ? thisKey
    : recordedKeys.size
      ? Math.max(...recordedKeys)
      : thisKey;
  const inSum = S.data.income.filter(e => monthKeyOf(e.d) === mk).reduce((a, e) => a + (+e.a || 0), 0);
  const outSum = S.data.expenses.filter(e => monthKeyOf(e.d) === mk).reduce((a, e) => a + (+e.a || 0), 0);

  const rows = monthsAgg(S.data);

  /* quiet vs usual: min and median surplus across recorded months */
  let quiet: React.ReactNode = null;
  if (rows.length >= 2) {
    const s = rows.map(r => r.surplus).sort((a, b) => a - b);
    const lo = s[0], med = s[Math.floor(s.length / 2)], hi = s[s.length - 1];
    const span = Math.max(1, hi - Math.min(lo, 0));
    const pos = (v: number) => Math.round((v - Math.min(lo, 0)) / span * 100);
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const dotPos = (v: number): DimensionValue => `${clamp(pos(v), 2, 98)}%`;
    /* v24 .moband: labels ride the band, centred on their dot — quietest above, usual below. */
    const bandLbl = (v: number, txtKey: string, amount: number, above: boolean) => (
      <View style={{ position: 'absolute', left: dotPos(v), width: 0, alignItems: 'center', ...(above ? { bottom: 14 } : { top: 14 }) }}>
        <View style={{ width: 120, alignItems: 'center', marginLeft: -60 }}>
          <Text style={mo.bandLblTxt} numberOfLines={1}>{t(txtKey)}</Text>
          <Text style={mo.bandLblVal} numberOfLines={1}>{rm(amount)}</Text>
        </View>
      </View>
    );
    quiet = (
      <View style={mo.card}>
        <View style={mo.rowBetween}>
          <Text style={mo.ttl3}>{t('mo_quiet')}</Text>
          <CardI t="mo_quiet" b={['mo_quiet_note', 'mo_quiet_ask']} p="calc" />
        </View>
        <View style={{ marginTop: 26, marginBottom: 30, marginHorizontal: 8, height: 12 }}>
          <SvgXml
            xml={'<svg width="100%" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F4D27A"/><stop offset="0.55" stop-color="#BFE2D8"/><stop offset="1" stop-color="#5CACB0"/></linearGradient></defs><rect width="100" height="12" rx="6" fill="url(#mb)"/></svg>'}
            width="100%" height={12}
            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
          />
          {bandLbl(lo, 'mo_quietest', Math.max(0, lo), true)}
          <View style={[mo.bandDot, { left: dotPos(lo), backgroundColor: '#E0A800' }]} />
          <View style={[mo.bandDot, { left: dotPos(med), backgroundColor: '#3F7A7E' }]} />
          {bandLbl(med, 'mo_usual', med, false)}
        </View>
        <BtnLine label={t('money_coverage') + ' →'} style={{ fontSize: 13 }} onPress={() => go('coverage')} />
      </View>
    );
  }

  /* six-month trend, quietest two tinted */
  const last6 = rows.slice(-6);
  const mx = Math.max(1, ...last6.map(r => r.net));
  const qset = new Set(last6.slice().sort((a, b) => a.surplus - b.surplus).slice(0, 2).map(r => r.y * 12 + r.m));
  const trend = last6.length ? (
    <Pressable onPress={() => go('pattern')} style={mo.card}>
      <View style={mo.rowBetween}>
        <Text style={mo.ttl3}>{t('mo_trend', { n: last6.length })}</Text>
        <Text style={{ color: C.ink }}>→</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110, marginTop: 12 }}>
        {last6.map(r => (
          <View key={r.y * 12 + r.m} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Text style={mo.barVal}>{nf(r.net)}</Text>
            <View style={{
              width: '100%', minHeight: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6,
              borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
              height: `${Math.max(4, Math.round(r.net / mx * 78))}%`,
              backgroundColor: qset.has(r.y * 12 + r.m) ? '#F4D27A' : C.ink,
            }} />
            <Text style={mo.barLbl}>{monthName(r.m).toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  ) : null;

  /* fixed costs */
  const tiles = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pressable onPress={() => go('commit')} style={mo.motile}>
        <View style={mo.motileIc}><Ico name="calendar" size={18} /></View>
        <BodyS muted style={{ fontSize: 12 }}>{t('money_commit')}</BodyS>
        <Text style={mo.motileVal}>{rm(commitTotal(S.data))}</Text>
        <Text style={mo.motileEm}>{t('mo_permo')}</Text>
      </Pressable>
      <Pressable onPress={() => go('expenses')} style={mo.motile}>
        <View style={mo.motileIc}><Ico name="wrench" size={18} /></View>
        <BodyS muted style={{ fontSize: 12 }}>{t('money_workcosts')}</BodyS>
        <Text style={mo.motileVal}>{rm(S.data.workCostEntries.filter(e => monthKeyOf(e.d) === mk).reduce((a, e) => a + (+e.a || 0), 0))}</Text>
        <Text style={mo.motileEm}>{t('mo_permo')}</Text>
      </Pressable>
    </View>
  );

  /* spending pace against the limit */
  const lim = +S.data.expenseLimits.total || 0;
  const dim = new Date(Math.floor(mk / 12), mk % 12 + 1, 0).getDate();
  const day = mk === thisKey ? now.getDate() : dim;
  const pct = lim ? Math.min(100, Math.round(outSum / lim * 100)) : 0;
  const paceColor = pct >= 100 ? C.short : pct > Math.round(day / dim * 100) + 10 ? '#E0A800' : C.brand;
  const pace = (
    <Pressable onPress={() => go('commit')} style={mo.card}>
      <View style={mo.rowBetween}>
        <Text style={mo.ttl3}>{t('mo_pace')}</Text>
        <Text style={{ color: C.ink }}>→</Text>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: C.ink14, overflow: 'hidden', marginTop: 10 }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: paceColor }} />
      </View>
      <BodyS muted style={{ marginTop: 6 }}>
        {lim ? t('mo_pace_note', { v: rm(outSum), l: rm(lim), d: day, n: dim }) : t('mo_nolimit')}
      </BodyS>
    </Pressable>
  );

  /* grouped links */
  const tilesView = S.moView !== 'list';
  const group = (key: string, items: [Route, string, string][]) => (
    <View key={key}>
      <Text style={mo.eyebrow}>{t(key)}</Text>
      {tilesView ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {items.map(([r, k, ic]) => (
            <Pressable key={r} onPress={() => go(r)} style={mo.hubtile}>
              <View style={mo.hubIc}><Ico name={ic} size={22} color="#fff" /></View>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 15, lineHeight: 20, color: C.ink }}>{t(k)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[mo.card, { paddingVertical: 2, paddingHorizontal: 12 }]}>
          {items.map(([r, k, ic], i) => (
            <Pressable key={r} onPress={() => go(r)}
              style={[mo.morow, i > 0 && { borderTopWidth: 1, borderTopColor: C.ink14 }]}>
              <IcLab name={ic}><P style={{ fontSize: 15 }}>{t(k)}</P></IcLab>
              <Text style={{ color: C.ink }}>→</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScreenShell greet title={t('tab_money')}>
      <View style={mo.hero}>
        <SvgXml
          xml={'<svg width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F5D61"/><stop offset="1" stop-color="#1F3F42"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#mh)"/></svg>'}
          width="100%" height="100%"
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
        <View style={mo.rowBetween}>
          <Text style={[mo.ttl3, { color: '#fff' }]}>{t('mo_sofar', { m: monthName(mk % 12) })}</Text>
          <CardI t="mo_sofar_t" b={['mo_fixed']} p="user" light />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          {([[t('mo_in'), inSum, '#fff'], [t('mo_out'), outSum, '#fff'], [t('mo_left'), inSum - outSum, '#FEC844']] as [string, number, string][]).map(([lbl, v, col], i) => (
            <View key={lbl} style={[{ flex: 1, minWidth: 0 }, i > 0 && { borderLeftWidth: 1.5, borderLeftColor: 'rgba(255,255,255,0.2)', paddingLeft: 12 }]}>
              <Text style={mo.heroSmall}>{lbl.toUpperCase()}</Text>
              <Text style={[mo.heroVal, { color: col }]} numberOfLines={1}>{rm(v)}</Text>
            </View>
          ))}
        </View>
      </View>
      {quiet}
      {trend}
      {tiles}
      {pace}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <View style={mo.viewTgl}>
          {([['tiles', 'mo_view_t'], ['list', 'mo_view_l']] as const).map(([v, k]) => (
            <Pressable key={v} onPress={() => up(s => { s.moView = v; })}
              style={[mo.viewTglBtn, (S.moView || 'tiles') === v && { backgroundColor: C.ink }]}>
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: (S.moView || 'tiles') === v ? '#fff' : C.ink64 }}>{t(k)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {group('mo_rec', [['income', 'money_income', 'banknote'], ['expenses', 'money_expenses', 'receipt'], ['commit', 'bl_title', 'calendar']])}
      {group('mo_savings', [['plan', 'pl_title', 'calday'], ['buffer', 'pr_buffer', 'ring']])}
      {group('mo_insights', [['pattern', 'money_pattern', 'bars'], ['coverage', 'money_coverage', 'search'], ['record', 'money_record', 'book']])}
    </ScreenShell>
  );
}

const mo = StyleSheet.create({
  hero: {
    backgroundColor: '#25494D', borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    overflow: 'hidden',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ttl3: { fontFamily: DISP_FONT, fontSize: 15, color: C.ink },
  heroProv: { fontFamily: BODY_FONT, fontSize: 11, letterSpacing: 0.88, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
  heroSmall: { fontFamily: BODY_FONT, fontSize: 11, letterSpacing: 0.66, color: 'rgba(255,255,255,0.7)' },
  heroVal: { fontFamily: DISP_FONT, fontSize: 19, lineHeight: 24, marginTop: 2, fontVariant: ['tabular-nums'] },
  heroNote: { fontFamily: BODY_FONT, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.92)', marginTop: 10 },
  card: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  bandDot: {
    position: 'absolute',
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
    marginLeft: -8,
    shadowColor: 'rgba(60,81,82,1)',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bandLblTxt: {
    fontFamily: BODY_FONT,
    fontSize: 11,
    lineHeight: 13,
    color: C.ink64,
  },
  bandLblVal: {
    fontFamily: DISP_FONT,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },
  barVal: { fontFamily: DISP_FONT, fontSize: 10.5, color: C.ink, marginBottom: 3, fontVariant: ['tabular-nums'] },
  barLbl: { fontFamily: BODY_FONT, fontSize: 10.5, color: C.ink64, marginTop: 5, letterSpacing: 0.3 },
  motile: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14, gap: 2, minWidth: 0,
  },
  motileIc: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#E4EFEC',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  motileVal: { fontFamily: DISP_FONT, fontSize: 17, color: C.ink, fontVariant: ['tabular-nums'] },
  motileEm: { fontFamily: BODY_FONT, fontSize: 11, color: C.ink64 },
  viewTgl: {
    flexDirection: 'row', backgroundColor: C.card, borderWidth: 1.5, borderColor: C.ink14,
    borderRadius: 12, padding: 3, gap: 3, maxWidth: 170,
  },
  viewTglBtn: { flex: 1, minHeight: 30, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase',
    color: C.ink64, marginBottom: 6,
  },
  hubtile: {
    width: '47%', flexGrow: 1, minHeight: 92, backgroundColor: C.card, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 14, gap: 8,
  },
  hubIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  morow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingHorizontal: 4,
  },
});

/* v24 R18: what changed, newest first, over the last 72 hours — on a screen
   called Your record, this IS the record. */
function WhatChanged() {
  const { S, t } = useApp();
  const [all, setAll] = React.useState(false);
  const entries = logRecent(S);
  const SHOWN = 5;
  const shown = all ? entries : entries.slice(0, SHOWN);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={mo.eyebrow}>{t('lg_title')}</Text>
        <CardI t="lg_title" b={['lg_window']} p="user" />
      </View>
      <Card gap={6}>
        {entries.length ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <BodyS muted style={{ fontSize: 11 }}>{t('lgc_what')}</BodyS>
              <BodyS muted style={{ fontSize: 11 }}>{t('lgc_amt')}</BodyS>
            </View>
            {shown.map((x, idx) => {
              const m = LOG_META[x.k];
              const v = x.v || {};
              const amt = v.a != null ? String(v.a) : (v.n != null ? t('lg_nent', { n: v.n }) : '');
              const cat = String(v.c ?? v.s ?? v.name ?? (v.f != null && v.g != null ? t('lg_fromto', { f: v.f, g: v.g }) : ''));
              return (
                <View key={x.ts + '-' + idx} style={{ borderTopWidth: idx ? 1 : 0, borderTopColor: C.ink14, paddingTop: idx ? 6 : 0, gap: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {m ? (
                      <Text style={{
                        fontFamily: SEMI_FONT, fontSize: 10.5, color: C.ink64, backgroundColor: '#EDF2F1',
                        borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
                      }}>{t(m[0])}</Text>
                    ) : null}
                    <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink, flex: 1 }} numberOfLines={1}>
                      {m ? t(m[1]) : t(x.k, v)}
                    </Text>
                    <Text style={{ fontFamily: DISP_FONT, fontSize: 12.5, color: C.ink, fontVariant: ['tabular-nums'] }}>
                      {amt || t('lg_dash')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <BodyS muted style={{ fontSize: 11, flexShrink: 1 }} numberOfLines={1}>{cat || t('lg_dash')}</BodyS>
                    <BodyS muted style={{ fontSize: 11 }}>{logWhen(x.ts, t)} {'\u00b7'} {logClock(x.ts)}</BodyS>
                  </View>
                </View>
              );
            })}
            {entries.length > SHOWN ? (
              <BtnLine
                label={all ? t('lg_less') : t('lg_more', { n: entries.length - SHOWN })}
                style={{ fontSize: 14 }}
                onPress={() => setAll(o => !o)}
              />
            ) : null}
          </>
        ) : (
          <BodyS muted>{t('lg_none')}</BodyS>
        )}
      </Card>
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
  const e = S.data.income.length;
  const last = e ? S.data.income[e - 1].d : '';
  const lastLbl = last ? `${+last.slice(8, 10)} ${monthName(+last.slice(5, 7) - 1)}` : '';
  return (
    <ScreenShell back title={t('money_record')}>
      {/* v24 R8f: the screen is the count and the list; guest keeping and why more
         weeks help live behind the (i) on the figure. */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Display cls="h-l">{t('rc_months', { n })}</Display>
          <CardI t="money_record" b={[S.guest ? 'rc_live_guest' : 'rc_live_acct', 'rc_keep_line']} p="user" />
        </View>
        <BodyS muted>{t('rc_entries', { e, d: lastLbl })}</BodyS>
      </View>

      <WhatChanged />

      <View style={{ gap: 8 }}>
        <Text style={mo.eyebrow}>{t('rc_tests')}</Text>
        <Card gap={10}>
          {S.keptTests.length ? S.keptTests.map((k, i) => (
            <KV key={i} k={`${rm(k.pay)} · ${t('cp_short', { s: k.s, n: k.n })}`}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <BodyS muted>{t('gap_lbl')}</BodyS>
                <Fig value={rm(k.g)} p="calc" cls="body-s" />
              </View>
            </KV>
          )) : (
            <BodyS muted>{t('rc_none')}</BodyS>
          )}
        </Card>
      </View>
    </ScreenShell>
  );
}

/* v22 income scan (preview): a simulated earnings-screen read that fills a
   reviewable checklist; every kept row is saved through the real API. */
function IncomeScanBody() {
  const { S, t, up, monthName, saveIncomeEntry, toast } = useApp();
  const sc = S.incScan;
  const [amts, setAmts] = React.useState<Record<number, string>>({});
  const [adding, setAdding] = React.useState(false);

  /* Sample rows keep the demo path; a real photo goes through the Groq
     statement reader on the backend and nothing is saved until confirmed. */
  const sampleScan = () => {
    up(s => { s.incScan = { stage: 'reading', rows: [] }; });
    setTimeout(() => {
      up(s => {
        if (s.incMode !== 'scan' || s.incScan.stage !== 'reading') return;
        const now = new Date();
        const d = (k: number) => {
          const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k);
          return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        };
        const src = (text: string) => {
          const hit = s.data.sources.find(x => x.k === 'src_ehail' || x.id === 'ehail');
          const pand = s.data.sources.find(x => x.k === 'src_deliv' || x.id === 'deliv');
          return text === 'foodpanda' && pand ? pand.id : (hit ? hit.id : s.incomeDraft.s);
        };
        s.incScan = {
          stage: 'confirm',
          rows: [
            { on: true, d: d(1), s: src('grab'), a: 96, low: false },
            { on: true, d: d(2), s: src('grab'), a: 112, low: false },
            { on: true, d: d(3), s: src('foodpanda'), a: 64, low: true },
            { on: true, d: d(4), s: src('grab'), a: 88, low: false },
            { on: true, d: d(6), s: src('grab'), a: 130, low: false },
          ],
        };
      });
    }, 1500);
  };

  /* Quick-menu shortcut: Add → Scan a receipt → Income goes straight to
     the camera instead of stopping at the picker step. */
  const scanAuto = S.scanAuto;
  React.useEffect(() => {
    if (!scanAuto || S.incMode !== 'scan' || sc.stage !== 'pick') return;
    up(s => { s.scanAuto = false; });
    void realScan('camera');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanAuto]);

  const realScan = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { toast(t('ex_image_failed'), 'error'); return; }
      }
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (res.canceled || !res.assets.length) return;
      const asset = res.assets[0];
      const resized = await manipulateAsync(
        asset.uri,
        asset.width && asset.width > 1280 ? [{ resize: { width: 1280 } }] : [],
        { compress: 0.7, format: SaveFormat.JPEG, base64: true },
      );
      if (!resized.base64) { toast(t('ex_image_failed'), 'error'); return; }
      up(s => { s.incScan = { stage: 'reading', rows: [] }; });
      const result = await scanIncomeStatement(resized.base64, 'image/jpeg');
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      up(s => {
        if (s.incMode !== 'scan') return;
        if (!result.is_earnings || !result.rows.length) {
          s.incScan = { stage: 'pick', rows: [] };
          return;
        }
        const fallback = s.data.sources.find(x => x.k === 'src_ehail' || x.id === 'ehail')?.id
          || s.incomeDraft.s || s.data.sources[0]?.id || '';
        s.incScan = {
          stage: 'confirm',
          rows: result.rows.map(r => ({
            on: true,
            d: r.date || todayIso,
            s: fallback,
            a: Number(r.amount) || 0,
            low: r.low_confidence || !r.date,
          })),
        };
      });
      if (!result.is_earnings || !result.rows.length) toast(t('sc_notearn'), 'error');
    } catch {
      up(s => { s.incScan = { stage: 'pick', rows: [] }; });
      toast(t('ex_scan_failed'), 'error');
    }
  };

  const srcName = (id: string) => {
    const x = S.data.sources.find(z => z.id === id);
    return x ? (x.custom ? x.name || '' : t(x.k || '')) : id;
  };

  if (sc.stage === 'reading') {
    return (
      <InSec last>
        <MockStmt />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <Ruma w={56} pose="count" float={false} />
          <BodyS muted>{t('sc_reading')}</BodyS>
        </View>
      </InSec>
    );
  }

  if (sc.stage === 'confirm') {
    const n = sc.rows.filter(r => r.on).length;
    const addAll = async () => {
      if (adding) return;
      setAdding(true);
      let added = 0;
      try {
        for (let i = 0; i < sc.rows.length; i++) {
          const r = sc.rows[i];
          const a = amts[i] != null ? (parseFloat(amts[i]) || 0) : r.a;
          if (!r.on || !(a > 0)) continue;
          await saveIncomeEntry({ amount: a, date: r.d, sourceId: r.s, confirmOutlier: true });
          added++;
        }
        up(s => { s.incScan = { stage: 'pick', rows: [] }; s.incMode = 'type'; });
        toast(t('sc_added', { n: added }));
      } catch {
        toast(t('inc_save_failed'), 'error');
      } finally {
        setAdding(false);
      }
    };
    return (
      <InSec last>
        <BodyS muted>{t('sc_found', { n: sc.rows.length })}</BodyS>
        {sc.rows.map((r, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48,
            borderTopWidth: i ? 1 : 0, borderTopColor: C.ink14, paddingVertical: 4,
          }}>
            <Pressable
              onPress={() => up(s => { const row = s.incScan.rows[i]; if (row) row.on = !row.on; })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: r.on }}
              style={{
                width: 22, height: 22, borderRadius: 5, borderWidth: 1.8,
                borderColor: r.on ? C.brand : C.ink40,
                backgroundColor: r.on ? C.brand : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
              {r.on ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 14, color: C.ink }} numberOfLines={1}>{srcName(r.s)}</Text>
              <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 15, color: r.low ? '#B7791F' : C.ink64 }}>
                {+r.d.slice(8, 10)} {monthName(+r.d.slice(5, 7) - 1)}{r.low ? ' · ' + t('sc_low') : ''}
              </Text>
            </View>
            {/* .scrow input — fixed 96px, right-aligned, so the label keeps its room. */}
            <TextInput
              value={amts[i] != null ? amts[i] : String(r.a)}
              onChangeText={v => setAmts(prev => ({ ...prev, [i]: v }))}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={t('inc_amount')}
              placeholderTextColor={C.ink40}
              style={{
                width: 96, minHeight: 40, backgroundColor: C.paper,
                borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
                paddingHorizontal: 10, fontSize: 15, color: C.ink, textAlign: 'right',
                fontVariant: ['tabular-nums'],
              }}
            />
          </View>
        ))}
        <View style={{ marginTop: 12 }}>
          <Btn disabled={adding} label={adding ? t('inc_saving') : t('sc_add', { n })} onPress={() => { void addAll(); }} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <BtnLine label={t('cancel')} style={{ fontSize: 13.5 }}
            onPress={() => up(s => { s.incScan = { stage: 'pick', rows: [] }; })} />
        </View>
      </InSec>
    );
  }

  return (
    <InSec last>
      <Drop icon="scan" title={t('sc_pick')} hint={t('sc_hint')} onPress={() => { void realScan('library'); }} />
      <View style={{ marginTop: 10 }}>
        <Btn label={t('ex_take_photo')} onPress={() => { void realScan('camera'); }} />
      </View>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <BtnLine label={t('sc_sample')} style={{ fontSize: 13.5 }} onPress={sampleScan} />
      </View>
    </InSec>
  );
}

/**
 * EN: US1.1 records amount, date, and source while preserving warning and provenance states.
 * v22 restyles this into the entry-card anatomy (hero amount, day strip, source chips).
 * 中文：US1.1 录入金额、日期和来源，并保留警告与来源标识状态。
 */
export function IncomeScreen() {
  const { S, t, monthName, up, go, saveIncomeEntry, toast } = useApp();
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

    // Historical monthly totals have stricter backend rules than daily/weekly
    // manual entries. Validate them before POST so the UI never sends a request
    // Django is guaranteed to reject with HTTP 400.
    if ((d.per || 'day') === 'month') {
      const selectedMonth = d.d.slice(0, 7);
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      if (selectedMonth >= currentMonth) {
        toast(t('inc_past_invalid'), 'error');
        return;
      }

      if (S.data.income.some(entry => entry.d.slice(0, 7) === selectedMonth)) {
        toast(t('inc_past_exists'), 'error');
        return;
      }
    }

    // A manual entry cannot be added into a month that is already represented
    // by a historical monthly total. Catch this client-side as well.
    if ((d.per || 'day') !== 'month') {
      const selectedMonth = d.d.slice(0, 7);
      if (S.data.income.some(entry =>
        entry.d.slice(0, 7) === selectedMonth && entry.method === 'historical_total'
      )) {
        toast(t('inc_past_exists'), 'error');
        return;
      }
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
        /* v22: the "for a month" segment is the US1.2 whole-month total. */
        entryMethod: (d.per || 'day') === 'month' ? 'historical_total' : 'manual',
        confirmOutlier: keep,
      });
      // EN: The stable 409 code drives the AC1.1.10 Keep action, not English error text.
      // 中文：AC1.1.10 的 Keep 操作由稳定的 409 错误码驱动，不依赖英文错误文案。
      if (result === 'outlier') {
        up(s => { s.incomeDraft.flag = 'outlier'; });
        return;
      }
      // saveIncomeEntry updates React state asynchronously, so S.data may still
      // be the pre-save snapshot here. The toast should match the number of
      // saved income entries, not the number of unique months.
      const entryCount = S.data.income.length + 1;

      up(s => {
        s.incomeDraft = { a: '', d: d.d, s: d.s, flag: null, per: d.per || 'day' };
      });
      toast(t('entry_saved_n', { n: entryCount }));
    } catch {
      toast(t('inc_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const mk = now.getFullYear() * 12 + now.getMonth();
  const sofar = S.data.income
    .filter(e => (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1) === mk)
    .reduce((a, e) => a + (+e.a || 0), 0);

  const typeBody = (
    <>
      {/* v24 R7 item 3: one amount and one date — the per day/week/month switch is gone. */}
      <InHero tint="in" pillLabel={t('io_in')} question={t('r7_inc_q')} decimal
        value={d.a}
        onChangeText={v => up(s => { s.incomeDraft.a = v; s.incomeDraft.flag = null; })} />
      <InSec>
        <InLbl>{t('inc_q_when')}</InLbl>
        <DatePickerField
          value={d.d}
          mode="date"
          monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
          maximumDate={new Date()}
          onChange={v => up(s => { s.incomeDraft.d = v; s.incomeDraft.flag = null; })}
        />
      </InSec>
      <InSec>
        <InLbl>{t('inc_q_src')}</InLbl>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {S.data.sources.map(x => (
            <InChip key={x.id}
              icon={<SrcIcon id={x.id} data={S.data} size={18} color={d.s === x.id ? '#fff' : C.ink} />}
              label={x.custom ? x.name || '' : t(x.k || '')}
              on={d.s === x.id}
              onPress={() => up(s => { s.incomeDraft.s = x.id; s.incomeDraft.flag = null; })} />
          ))}
          <InChip dashed label={t('src_own').replace(/^\+\s*|^＋\s*/, '')}
            onPress={() => up(s => { s.sheet = 'srcown'; })} />
        </View>
      </InSec>
      {d.flag === 'invalid' ? <InSec><NoteC><BodyS>{t('inc_invalid_amount')}</BodyS></NoteC></InSec> : null}
      {d.flag === 'neg' ? <InSec><NoteC><BodyS>{t('inc_neg')}</BodyS></NoteC></InSec> : null}
      {d.flag === 'outlier' ? (
        <InSec>
          <NoteC>
            <BodyS>{t('inc_outlier')}</BodyS>
            <BtnLine label={t('keep')} onPress={() => { void save(true); }} />
          </NoteC>
        </InSec>
      ) : null}
      <InSec last>
        <Btn label={saving ? t('inc_saving') : t('inc_add')} onPress={() => { void save(false); }} />
        {sofar ? (
          <BodyS muted style={{ textAlign: 'center', marginTop: 8 }}>
            {t('inc_sofar', { m: monthName(now.getMonth()), v: rm(sofar) })}
          </BodyS>
        ) : null}
        {/* v24 R7 item 3: bulk entry for a whole past month stays, as a quiet link. */}
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <BtnLine label={t('inc_past')} style={{ fontSize: 13.5 }}
            onPress={() => up(s => { s.pastT = 'inc'; s.sheet = 'pastmonth'; })} />
        </View>
      </InSec>
    </>
  );

  /* v24: the recent list shows one month at a time (month filter), newest date first. */
  const impk = pickMonth(S.incMonth, [S.data.income]);
  const recent = [...S.data.income]
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => impk.key == null || (+e.d.slice(0, 4)) * 12 + (+e.d.slice(5, 7) - 1) === impk.key)
    .sort((a, b) => (a.e.d < b.e.d ? 1 : -1))
    .slice(0, 8);

  return (
    <ScreenShell back title={t('money_income')}>
      {S.incomeSync === 'loading' ? <NoteC><BodyS>{t('inc_sync_loading')}</BodyS></NoteC> : null}
      {S.incomeSync === 'error' ? <NoteC><BodyS>{t('inc_sync_error')}</BodyS></NoteC> : null}
      {S.data.income.length || S.incMode === 'csv' ? null : <Display cls="h-m">{t('inc_empty')}</Display>}
      <InCard>
        <InSeg mode={S.incMode} tint="in"
          labels={[['type', t('im_type')], ['scan', t('im_scan')], ['csv', t('im_csv')]]}
          onMode={m => {
            up(s => { s.incMode = m as typeof s.incMode; });
          }} />
        {S.incMode === 'csv' ? <IncomeCsvBody embedded /> : S.incMode === 'scan' ? <IncomeScanBody /> : typeBody}
      </InCard>
      {/* EN: Saved income is user-provided data, so provenance is shown once for the section instead of on every row. */}
      {/* 中文：已保存收入都属于用户提供的数据，因此来源标识只在区块顶部显示一次，不在每行重复。 */}
      {S.data.income.length ? (
        <>
        <MonthBtn act="incmonth" monthKey={impk.key} />
        <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('inc_recent')}</Text>
            <Prov p="user" />
          </View>
          {recent.map(({ e }, idx) => {
            const src = S.data.sources.find(x => x.id === e.s);
            const title = e.method === 'historical_total'
              ? t('inc_month_total')
              : (src ? (src.custom ? src.name || '' : t(src.k || '')) : e.s);
            const sub = e.method === 'historical_total'
              ? `${monthName(+e.d.slice(5, 7) - 1)} ${e.d.slice(0, 4)}`
              : `${+e.d.slice(8, 10)} ${monthName(+e.d.slice(5, 7) - 1)}`;
            const canEdit = (
              e.method === 'historical_total' || e.method === 'manual' || e.method === 'import'
            ) && Boolean(e.id);
            return (
              <InRow key={e.id || `${e.d}-${idx}`} first={idx === 0} tint="in"
                icon={<SrcIcon id={e.s} data={S.data} size={18} color="#3F7A7E" />}
                title={title}
                sub={sub}
                subTag={e.method === 'import' ? t('cv_tag') : undefined}
                amount={rm(e.a)}
                onEdit={canEdit ? () => up(state => {
                  state.sheet = e.method === 'historical_total' ? `pastmonth:${e.id}` : `incomeedit:${e.id}`;
                }) : undefined} />
            );
          })}
        </Card>
        </>
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
  const shortcutPresets = [0, 1, 2].map(offset => {
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonthNumber === today.getMonth() + 1;
    const lastDay = new Date(selectedYear, selectedMonthNumber, 0).getDate();
    const anchorDay = Math.min(today.getDate(), lastDay);
    const date = new Date(selectedYear, selectedMonthNumber - 1, anchorDay - offset);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      value,
      label: isCurrentMonth && offset === 0 ? t('inc_today') : isCurrentMonth && offset === 1 ? t('inc_yday') : monthName(date.getMonth()).slice(0, 3),
      display: `${date.getDate()} ${monthName(date.getMonth())}`,
    };
  }).filter(preset => preset.value.slice(0, 7) === selectedMonth);
  const dateForMonth = (monthValue: string) => {
    const [year, month] = monthValue.split('-').map(Number);
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrentMonth) return todayText;

    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(today.getDate(), lastDay);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
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
    if (!costDate.startsWith(selectedMonth)) {
      toast('The work cost date must be within the selected month.', 'error');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await saveWorkCostEntry({ categoryId, amount: Number(amount), date: costDate });
      setAmount('');
      setCostDate(dateForMonth(selectedMonth));
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
    if (!editDate.startsWith(selectedMonth)) {
      toast('The work cost date must be within the selected month.', 'error');
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
            setCostDate(dateForMonth(value));
            setEditingId(null);
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
        <DayShortcutPicker
          value={costDate}
          monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
          maximumDate={today}
          presets={shortcutPresets}
          todayLabel={t('inc_today')}
          yesterdayLabel={t('inc_yday')}
          pickLabel={t('inc_pick')}
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
                <DayShortcutPicker
                  value={editDate}
                  maximumDate={today}
                  presets={shortcutPresets}
                  monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
                  todayLabel={t('inc_today')}
                  yesterdayLabel={t('inc_yday')}
                  pickLabel={t('inc_pick')}
                  onChange={setEditDate}
                />
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
  /* v24: bills (commitments) and spending limits share one segmented screen. */
  const [seg, setSeg] = React.useState<'bills' | 'limits'>('bills');
  const c = S.data.commitments;
  const added = new Set([...c.living, ...c.debts, ...c.savings].map(x => x.id));
  const presets = INCOME_API_ENABLED
    ? []
    : MOCK.commitPresets.filter(id => !added.has(id));
  const allMock = [...MOCK.commitments.living, ...MOCK.commitments.debts, ...MOCK.commitments.savings];
  const em = expByMonth(S.data);
  const segBar = (
    <View style={{ flexDirection: 'row', backgroundColor: '#EDF2F1', borderRadius: 14, padding: 4, gap: 4 }}>
      {(['bills', 'limits'] as const).map(v => (
        <Pressable key={v} onPress={() => setSeg(v)}
          style={{
            flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
            backgroundColor: seg === v ? '#fff' : 'transparent',
          }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: seg === v ? C.ink : C.ink64 }}>
            {t(v === 'bills' ? 'bl_bills' : 'bl_limits')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  if (seg === 'limits') {
    return (
      <ScreenShell back title={t('bl_title')}>
        {segBar}
        <ExLimitsBody />
      </ScreenShell>
    );
  }
  return (
    <ScreenShell back title={t('bl_title')}>
      {segBar}
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
            decimal
            list={c[sec]}
            showProvenance={false}
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
    // Iteration 2 amendment: an income pattern is recomputed whenever this
    // screen is opened. The shared request helper still deduplicates any
    // request already in flight.
    void refreshIncomePattern().catch(() => undefined);
  }, [refreshIncomePattern]);
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
