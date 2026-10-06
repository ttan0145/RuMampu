import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getHousingTestResult } from '../../../services/housingSession';
import { todayIso, useApp } from '../state';
import { nf, rm } from '../calc';
import { useHousingCalculation } from '../useHousingCalculation';
import { upfrontFees, upfrontNeed } from '../fees';
import { potNow } from '../plan';
import {
  Badge, BodyS, Btn, BtnLine, BtnQuiet, Card, Display, Divider, EditList, NumInput,
  Field, Fig, IcLab, KV, NoteC, P, Prov, TextField,
  CardI,
} from '../ui';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { Ico } from '../svgs';
import { Ruma } from '../ruma-view';
import { ScreenShell } from './shell';
import { LnEnter } from './learn';
import { GuideTarget } from '../tour';
import { SheetFrame } from '../overlays';

/* v22: prepare rows live inside the House tab's "Get ready" segment. */
export function PrepareBody() {
  const { t, go } = useApp();
  return (
    <View style={{ gap: 16 }}>
      <BtnQuiet onPress={() => go('upfront')}><IcLab name="wallet"><P>{t('pr_upfront')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('buffer')}><IcLab name="ring"><P>{t('pr_buffer')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('docs')}><IcLab name="file"><P>{t('pr_docs')}</P></IcLab></BtnQuiet>
      <Divider />
      <BtnQuiet style={{ paddingVertical: 12 }} onPress={() => go('pv_switch')}>
        <IcLab name="eye">
          <View style={{ gap: 3, alignItems: 'flex-start' }}>
            <P style={{ fontFamily: DISP_FONT }}>{t('pr_pv')}</P>
            <BodyS muted>{t('pr_pv_note')}</BodyS>
          </View>
        </IcLab>
      </BtnQuiet>
    </View>
  );
}

export function PrepareScreen() {
  const { t } = useApp();
  return (
    <ScreenShell back title={t('hh_prep')}>
      <PrepareBody />
    </ScreenShell>
  );
}

/* The House entry points to this placeholder until Epic 5 is delivered in
   Iteration 3. The working preparation screens remain available in source. */
export function PrepareComingSoonScreen() {
  const { t, backNav } = useApp();
  return (
    <ScreenShell back title={t('hh_prep')}>
      <View style={pr.comingSoon}>
        <Badge label={t('pr_coming')} />
        <Display cls="h-xl">{t('pr_coming_note')}</Display>
        <BodyS muted>{t('pr_coming_iter')}</BodyS>
        <Btn label={t('back')} onPress={backNav} />
      </View>
    </ScreenShell>
  );
}

/* Stable component types preserve input focus when the app state changes. */
/* v24 R8f: a row that needs explaining carries an (i), not a paragraph. Short
   factual notes (like the exemption) stay on the row. */
const Row = ({ id, label, kind, note, info, children }: {
  id?: string; label: string; kind: 'user' | 'calc' | 'official' | 'assume'; note?: string;
  info?: React.ReactNode; children: React.ReactNode;
}) => (
  <View testID={id ? `upfront-row-${id}` : undefined}
    style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, minHeight: 44, paddingVertical: 6 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <P style={{ fontSize: 14.5 }}>{label}</P>
        {info}
      </View>
      <Prov p={kind} />
      {note ? <BodyS muted style={{ fontSize: 11.5, marginTop: 2 }}>{note}</BodyS> : null}
    </View>
    {children}
  </View>
);
const Amt = ({ v }: { v: number }) => (
  <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(v)}</Text>
);
const Input = ({ id }: { id: string }) => {
  const { S, t, up } = useApp();
  const setItem = (id: string, n: number) => up(s => {
    const it = s.data.upfront.find(x => x.id === id);
    if (it) it.a = Math.max(0, n);
  });
  const it = S.data.upfront.find(x => x.id === id) ?? { a: 0, ex: 0 };
  return (
    <View style={{ width: 110 }}>
      <NumInput value={+it.a || ''} placeholder={t('eg_ph', { v: it.ex ?? 0 })} decimal={false} alignRight
        onNum={n => setItem(id, n)} accessibilityLabel={t((it as { k?: string }).k || '')} />
    </View>
  );
};
const Switch = ({ on, onPress, label, info }: { on: boolean; onPress: () => void; label: string; info?: React.ReactNode }) => (
  <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} aria-checked={on}
    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <P style={{ fontSize: 14.5 }}>{label}</P>
      {info}
    </View>
    <View style={{
      width: 46, height: 28, borderRadius: 14, padding: 3,
      backgroundColor: on ? C.brand : C.ink14,
      alignItems: on ? 'flex-end' : 'flex-start', justifyContent: 'center',
    }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
    </View>
  </Pressable>
);
const Stage = ({ n, k, info, children }: { n: number; k: string; info?: React.ReactNode; children: React.ReactNode }) => {
  const { t } = useApp();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 12, color: '#fff' }}>{n}</Text>
        </View>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase', color: C.ink64 }}>{t(k)}</Text>
        {info}
      </View>
      <Card gap={0} style={{ marginTop: 8 }}>{children}</Card>
    </View>
  );
};

export function UpfrontScreen() {
  const { S, t, up, toast, monthName } = useApp();
  const f = upfrontFees(S);
  const src = f.src;
  const dep = src.price ? src.dep : S.data.house.deposit;
  const need = upfrontNeed(S);
  /* AC5.2.17: "You have" is the one pot (cash already had + what the plan added +
     what finished months moved in), stated once; the gap is what I need less it.
     What the cash-buffer shield already holds is left out, so no ringgit counts
     for both the buffer and the upfront cash, and the screen says how much. */
  const q = potNow(S);
  const held = q.buf;
  const have = q.up;
  const gap = Math.max(0, need - have);
  const loan = Math.max(0, src.price - src.dep);
  const earnest = S.data.upfront.find(x => x.id === 'earnest') ?? { a: 0, ex: 0 };
  const bal = Math.max(0, dep - (+earnest.a || 0));
  const stampNote = f.exempt ? t('uf_exempt') : (S.firstHome && src.price > 500000 ? t('uf_noexempt') : '');
  const scale = Math.max(need, have, 1) * 1.12;
  const pct = (v: number) => v / scale * 100;
  const [pick, setPick] = React.useState(false);
  const testsWithPrice = S.keptTests
    .map((k, i) => ({ k, i }))
    .filter(x => x.k.propertyPrice != null && Number(x.k.propertyPrice) > 0);

  /* AC5.2.9 and AC5.2.10: the cash the user already has is their own entry, saved
     with the day it was reported. Clearing it clears the day. */
  const setCash = (n: number) => up(s => {
    const cash = Math.max(0, Math.round((+n || 0) * 100) / 100);
    s.data.cashOnHand = cash;
    s.data.cashOnHandDate = cash > 0 ? todayIso() : null;
  });
  const cashDay = S.data.cashOnHandDate;
  const cashNote = cashDay
    ? t('uf_cash_on', { d: `${+cashDay.slice(8, 10)} ${monthName(+cashDay.slice(5, 7) - 1)} ${cashDay.slice(0, 4)}` })
    : undefined;


  return (
    <ScreenShell back title={t('pr_upfront')}>
      {/* v24: name the tested price these figures come from, and let the user switch. */}
      {src.price ? (
        <Pressable onPress={() => testsWithPrice.length > 1 && setPick(true)} style={pr.ufsrc}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <BodyS muted style={{ fontSize: 11 }}>{t('uf_for')}</BodyS>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink }} numberOfLines={1}>
              {src.name ? `${src.name} \u00b7 ${rm(src.price)}` : `${rm(src.price)} \u00b7 ${t('uf_for_house')}`}
            </Text>
          </View>
          {testsWithPrice.length > 1 ? <BodyS muted>{t('uf_switch')} {'\u25be'}</BodyS> : null}
        </Pressable>
      ) : (
        <NoteC><BodyS>{t('uf_notest')}</BodyS></NoteC>
      )}
      <GuideTarget id="uf.chart">
      <KV k={t('uf_have')}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Fig value={rm(have)} p="user" cls="h-l" />
          {/* The pot behind "You have": what I already had, what the plan added, what was moved in. */}
          <Pressable onPress={() => up(s => { s.sheet = 'pothow'; })} accessibilityLabel={t('ph_title')} hitSlop={8}
            style={{
              width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink40,
              alignItems: 'center', justifyContent: 'center', marginLeft: 6,
            }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: C.ink64 }}>i</Text>
          </Pressable>
        </View>
      </KV>
      {held > 0 ? (
        <View testID="upfront-held"><BodyS muted>{t('uf_held', { a: rm(held) })}</BodyS></View>
      ) : null}
      {/* AC5.8.7: a newer house test moved the buffer, so the amount held changed. */}
      {S.buffer?.msg === 'moved' && S.buffer.prevTarget != null && S.buffer.target != null ? (
        <View testID="upfront-held-moved">
          <NoteC><BodyS>{t('uf_moved', { a: rm(S.buffer.prevTarget), b: rm(S.buffer.target) })}</BodyS></NoteC>
        </View>
      ) : null}
      <KV k={t('uf_need')}><Fig value={rm(need)} p="calc" cls="h-l" /></KV>
      <KV k={t('uf_gap')}><Fig value={rm(gap)} p="calc" cls="h-l" /></KV>
      <View style={{ paddingTop: 10, paddingRight: 34, paddingBottom: 8, paddingLeft: 2 }}
        accessibilityRole="image" accessibilityLabel={t('uf_ch_alt', { h: rm(have), n: rm(need) })}>
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ width: 120, height: '100%', justifyContent: 'flex-end' }}>
            <View testID="upfront-available"
              style={{ height: `${pct(have)}%`, backgroundColor: C.ink, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
            {gap > 0 ? (
              <View testID="upfront-gap" style={{
                position: 'absolute', left: '15%', width: '70%',
                bottom: `${pct(have)}%`, height: `${pct(need) - pct(have)}%`,
                backgroundColor: C.short, borderRadius: 2, opacity: 0.95,
              }} />
            ) : null}
          </View>
          <View style={{ position: 'absolute', left: -2, right: -14, bottom: `${pct(need)}%`, borderTopWidth: 2.5, borderTopColor: C.ink }} />
          <View style={{
            position: 'absolute', right: 0, bottom: `${pct(need)}%`,
            transform: [{ translateY: -21 }],
            backgroundColor: C.paper, paddingVertical: 2, paddingHorizontal: 5,
            borderRadius: 5, borderWidth: 1.5, borderColor: C.ink14,
          }}>
            <Text style={{ fontSize: 11, letterSpacing: 0.66, color: C.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {rm(need)}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 6, alignItems: 'flex-start' }}><Prov p="calc" /></View>
      </View>
      </GuideTarget>
      {/* AC5.2.9 / AC5.2.10: the cash I already have, entered by me and dated. */}
      <Card gap={0}>
        <Row id="cash" label={t('uf_cash_l')} kind="user" note={cashNote}
          info={<CardI t="uf_cash_l" b={['uf_cash_h']} p="user" />}>
          <View style={{ width: 110 }}>
            <NumInput value={+S.data.cashOnHand || ''} placeholder="0" alignRight
              onNum={setCash} accessibilityLabel={t('uf_cash_l')} />
          </View>
        </Row>
      </Card>
      {dep === 0
        ? (src.price ? <NoteC><BodyS>{t('uf_dep0')}</BodyS></NoteC> : null)
        : <KV k={t('uf_dep')}><Fig value={rm(dep)} p="user" /></KV>}
      {/* v24: the first-home stamp exemption, with the rule it applies. */}
      <GuideTarget id="uf.first">
      <Card gap={4}>
        <Switch on={S.firstHome} onPress={() => up(s => { s.firstHome = !s.firstHome; })}
          label={t('uf_first')} info={<CardI t="uf_first" b={['uf_first_h', 'uf_first_src']} p="official" />} />
      </Card>
      </GuideTarget>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase', color: C.ink64 }}>
          {t('uf_steps')}
        </Text>
        <CardI t="uf_steps"
          b={['uf_steps_h', 'uf_baldp_h', 'uf_spa_h_g', 'uf_val_h_g', 'uf_dep0', 'uf_stamp_src', 'uf_legal_src', 'uf_val_src', 'uf_scope']}
          p="calc" />
      </View>
      <GuideTarget id="uf.stage">
      <Stage n={1} k="uf_s1">
        <Row label={t('uf_earn')} kind="user" note={t('uf_earn_in')} info={<CardI t="uf_earn" b={['uf_earn_h']} p="user" />}><Input id="earnest" /></Row>
      </Stage>
      </GuideTarget>
      <Stage n={2} k="uf_s2">
        {src.price ? (
          <>
            <Row id="baldp" label={t('uf_baldp')} kind="calc"><Amt v={bal} /></Row>
            <Row id="spa" label={t('uf_spa')} kind="official"><Amt v={f.spa} /></Row>
            <Row id="stampT" label={t('uf_stampT')} kind="official" note={stampNote || t('uf_stampT_h', { p: rm(src.price) })}><Amt v={f.t} /></Row>
            <Row id="loanlegal" label={t('uf_loanlegal')} kind="official"><Amt v={f.loanLegal} /></Row>
            <Row id="stampL" label={t('uf_stampL')} kind="official" note={stampNote || t('uf_stampL_h', { p: rm(loan) })}><Amt v={f.l} /></Row>
            <Row id="val" label={t('uf_val')} kind="assume"><Amt v={f.val} /></Row>
            <Row label={t('uf_mrta')} kind="user" info={<CardI t="uf_mrta" b={['uf_mrta_h']} p="user" />}><Input id="mrta" /></Row>
          </>
        ) : (
          <Row label={t('uf_mrta')} kind="user" info={<CardI t="uf_mrta" b={['uf_mrta_h']} p="user" />}><Input id="mrta" /></Row>
        )}
      </Stage>
      <Stage n={3} k="uf_s3" info={<CardI t="uf_s3" b={['uf_s3_h']} p="user" />}>
        {/* v27b: say up front that only typed amounts count here */}
        <BodyS muted style={{ paddingTop: 8, paddingBottom: 4 }}>{t('uf_s3_in')}</BodyS>
        <Row label={t('uf_util')} kind="user" info={<CardI t="uf_util" b={['uf_util_h']} p="user" />}><Input id="util" /></Row>
        <Row label={t('uf_strata')} kind="user" info={<CardI t="uf_strata" b={['uf_strata_h']} p="user" />}><Input id="strata" /></Row>
        <Row label={t('uf_furn')} kind="user" info={<CardI t="uf_furn" b={['uf_furn_h']} p="user" />}><Input id="furn" /></Row>
        <Switch on={S.ufReno} onPress={() => up(s => { s.ufReno = !s.ufReno; })} label={t('uf_reno_sw')} />
        {S.ufReno ? <Row label={t('uf_reno')} kind="user" info={<CardI t="uf_reno" b={['uf_reno_h']} p="user" />}><Input id="reno" /></Row> : null}
      </Stage>
      {/* v26: what these costs are, as short lessons */}
      <LnEnter tab="upfront" k="ln_link_upfront" />
      {pick ? (
        <SheetFrame pose="curious" onClose={() => setPick(false)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink }}>{t('uf_pick_t')}</Text>
            <Pressable onPress={() => setPick(false)} hitSlop={10}><Text style={{ fontSize: 18, color: C.ink }}>✕</Text></Pressable>
          </View>
          <BodyS muted style={{ marginTop: 4 }}>{t('uf_pick_h')}</BodyS>
          <View style={{ marginTop: 10, gap: 4 }}>
            {testsWithPrice.map(({ k, i }) => (
              <Pressable key={i} onPress={() => { up(s => { s.ufTest = i; }); setPick(false); toast(t('saved')); }}
                style={[pr.opt, S.ufTest === i && { backgroundColor: C.card }]}>
                <P style={{ fontSize: 15 }}>{k.name || rm(Number(k.propertyPrice) || 0)}</P>
                <BodyS muted>{rm(Number(k.propertyPrice) || 0)}</BodyS>
              </Pressable>
            ))}
          </View>
        </SheetFrame>
      ) : null}
    </ScreenShell>
  );
}

const pr = StyleSheet.create({
  pvintro: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 12 },
  pvhub: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  pvhubIc: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E4EFEC', alignItems: 'center', justifyContent: 'center' },
  monthChip: { borderWidth: 1, borderColor: C.ink14, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#fff' },
  monthChipOn: { borderColor: C.brand, backgroundColor: '#E4EFEC' },
  pvchart: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14,
  },
  pvc: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 2, borderWidth: 1, borderColor: C.ink14 },
  pvcK: { fontFamily: XBOLD_FONT, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: C.ink64 },
  pvcB: { fontFamily: DISP_FONT, fontSize: 26, lineHeight: 32, color: C.ink },
  pvcS: { fontFamily: BODY_FONT, fontSize: 13, color: C.ink },
  pvcE: { fontFamily: BODY_FONT, fontSize: 11.5, color: C.ink64, minHeight: 15, marginBottom: 4 },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3, gap: 3, borderWidth: 1, borderColor: C.ink14 },
  segBtn: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF', shadowColor: 'rgba(0,0,0,1)', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  comingSoon: {
    minHeight: 420,
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 48,
  },
  ufsrc: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EDF2F1', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minHeight: 54,
  },
  sheet: {
    backgroundColor: C.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 26,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, paddingHorizontal: 12, borderRadius: 12,
  },
});

export function BufferScreen() {
  const { S, t, monthName, goTab, go } = useApp();
  const result = getHousingTestResult();
  const liquidity = result?.starting_liquidity;
  if (!liquidity || liquidity.months.length === 0) {
    return (
      <ScreenShell back title={t('pr_buffer')}>
        <BodyS muted>{t('housing_result_required')}</BodyS>
        <Btn label={t('home_test')} onPress={() => goTab('test')} />
      </ScreenShell>
    );
  }
  const rows = liquidity.months.map(row => ({
    y: row.year,
    m: row.month - 1,
    bal: row.closing_balance,
  }));
  /* AC5.3.7: the zero line sits where zero falls between the highest and the lowest
     running balance, so a chart that is all above (or all below) zero uses the whole
     plot and no bar is clipped. One scale serves both sides of the line. */
  const plotH = 104;
  const hi = Math.max(0, ...rows.map(r => r.bal));
  const lo = Math.min(0, ...rows.map(r => r.bal));
  const span = hi - lo;
  const unit = span > 0 ? plotH / span : 0;
  const zeroTop = Math.min(
    plotH - (lo < 0 ? 3 : 0),
    Math.max(hi > 0 ? 3 : 0, span > 0 ? hi * unit : plotH / 2),
  );
  const first = rows[0];
  const last = rows[rows.length - 1];
  /* The buffer is the deepest fall from an earlier high (ADR 0005). Name the months it
     ran between and shade them on the chart, so the figure can be traced to the bars. */
  const at = (ref?: { year: number; month: number } | null) =>
    ref ? rows.findIndex(r => r.y === ref.year && r.m === ref.month - 1) : -1;
  const fallEnd = liquidity.required_amount > 0 ? at(liquidity.fall_end) : -1;
  const fallStart = fallEnd >= 0 ? at(liquidity.fall_start) : -1;
  const when = (i: number) => t('bf_when', { m: monthName(rows[i].m), y: rows[i].y });
  const fallFrom = fallStart + 1;
  /* US5.8 (AC5.8.4): the buffer is held from the pot first; say how much of it the
     pot already covers and what is still to set aside. */
  const covered = Math.min(potNow(S).buf, liquidity.required_amount);
  const still = Math.max(0, liquidity.required_amount - covered);
  /* AC5.3.9: when the record ends lower than it started, the months did not catch up. */
  const endShort = last.bal < 0 ? -last.bal : 0;
  return (
    <ScreenShell back title={t('pr_buffer')}>
      {/* v24 R8i: the definition stays on screen; the basis moves behind the (i). */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Fig value={rm(liquidity.required_amount)} p="calc" cls="h-xl" />
        <CardI t="pr_buffer" b={[]} p="calc" x={[t('bf_basis', { a: monthName(first.m), b: monthName(last.m) })]} />
      </View>
      <BodyS muted>{t('bf_def')}</BodyS>
      {fallEnd >= 0 ? (
        <View testID="buffer-fall-text">
          <BodyS>
            {fallStart >= 0
              ? t('bf_fall', { a: when(fallStart), b: when(fallEnd) })
              : t('bf_fall_start', { b: when(fallEnd) })}
          </BodyS>
        </View>
      ) : null}
      {liquidity.required_amount === 0 ? (
        <NoteC>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <BodyS>{t('bf_zero')}</BodyS>
            <Prov p="calc" />
          </View>
        </NoteC>
      ) : (
        <Card gap={8}>
          <View testID="buffer-covered">
            <BodyS>{still > 0
              ? t('bf_cover', { a: rm(covered), b: rm(still) })
              : t('bf_cover_full')}</BodyS>
          </View>
          {/* AC5.8.8: what is still to set aside goes on to the saving plan. */}
          {still > 0 ? <BtnLine label={t('bf_toplan')} onPress={() => go('plan')} /> : null}
        </Card>
      )}
      {endShort > 0 ? (
        <View testID="buffer-short">
          <NoteC><BodyS>{t('bf_short', { n: rows.length, a: rm(endShort) })}</BodyS></NoteC>
        </View>
      ) : null}
      <BodyS muted>{t('bf_bal')}</BodyS>
      <View style={{ paddingTop: 10, paddingRight: 34, paddingBottom: 26, paddingLeft: 2, marginRight: -20 }}>
        <View testID="buffer-plot" style={{ flexDirection: 'row', gap: 4, height: plotH }}>
          {fallEnd >= 0 ? (
            <View testID="buffer-fall" pointerEvents="none" style={{
              position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: 'rgba(241,89,42,0.12)',
              left: `${fallFrom / rows.length * 100}%`, width: `${(fallEnd - fallFrom + 1) / rows.length * 100}%`,
            }} />
          ) : null}
          {rows.map((r, i) => {
            const neg = r.bal < 0;
            /* Room on this bar's side of the zero line; a bar never runs past the plot. */
            const h = Math.min(neg ? plotH - zeroTop : zeroTop, Math.max(3, Math.abs(r.bal) * unit));
            return (
              <View key={i} style={{ flex: 1, minWidth: 14, height: plotH }}
                accessibilityLabel={t('bf_bar_alt', { m: monthName(r.m), y: r.y, a: rm(r.bal) })}>
                <View testID={`buffer-bar-${r.y}-${String(r.m + 1).padStart(2, '0')}`} style={neg
                  ? { position: 'absolute', left: '15%', width: '70%', top: zeroTop, height: h, backgroundColor: C.short, borderRadius: 3, opacity: 0.95 }
                  : { position: 'absolute', left: '15%', width: '70%', top: zeroTop - h, height: h, backgroundColor: C.ink, borderRadius: 3 }} />
              </View>
            );
          })}
          <View testID="buffer-zero-line"
            style={{ position: 'absolute', left: -2, right: -14, top: zeroTop - 2.5, borderTopWidth: 2.5, borderTopColor: C.ink }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 4, paddingTop: 6 }}>
          {rows.map((r, i) => (
            <Text key={i} style={{ flex: 1, minWidth: 14, textAlign: 'center', fontSize: 10, color: C.ink64 }}>
              {monthName(r.m).toUpperCase()}
            </Text>
          ))}
        </View>
        <View style={{ marginTop: 2, alignItems: 'flex-start' }}><Prov p="calc" /></View>
      </View>
    </ScreenShell>
  );
}

export function DocsScreen() {
  const { S, t, up } = useApp();
  const check = (k: string) => (
    <BtnQuiet key={k} arrow={false} style={{ minHeight: 48 }} onPress={() => up(s => {
      const i = s.docsChecked.indexOf(k);
      if (i >= 0) s.docsChecked.splice(i, 1); else s.docsChecked.push(k);
    })}>
      <P>{(S.docsChecked.includes(k) ? '☑' : '☐') + ' ' + t(k)}</P>
    </BtnQuiet>
  );
  return (
    <ScreenShell back title={t('pr_docs')}>
      <Card gap={8}>
        {['dc_bank', 'dc_ehail', 'dc_statdec', 'dc_epf', 'dc_commitlist'].map(check)}
      </Card>
      <Card gap={8}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <BodyS muted style={{ flexShrink: 1 }}>{t('dc_sjkp')}</BodyS>
          <CardI t="pr_docs" b={['dc_src', 'dc_plain']} p="official" />
        </View>
        {['dc_sj1', 'dc_sj2', 'dc_sj3'].map(k => <BodyS key={k}>· {t(k)}</BodyS>)}
        {/* The 65% check stays "needs review": SJKP measures gross income and
            RuMampu measures income after work costs, so no pass or fail is shown. */}
        <NoteC>
          <View style={{ gap: 4 }}>
            <P style={{ fontFamily: SEMI_FONT, fontSize: 14.5, lineHeight: 20 }}>{t('dc_65')}</P>
            <BodyS muted>{t('dc_65_note')}</BodyS>
          </View>
        </NoteC>
      </Card>
      {/* v26: the lesson on what to bring instead of a payslip */}
      <LnEnter tab="nosalary" k="ln_link_docs" />
    </ScreenShell>
  );
}

function monthKey(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function validMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function monthLabel(value: string, monthName: (m: number) => string): string {
  if (!validMonth(value)) return value;
  return `${monthName(Number(value.slice(5, 7)) - 1)} ${value.slice(0, 4)}`;
}

function latestCompletedRecordedMonth(income: { d: string }[]): string | null {
  const current = monthKey();
  const months = [...new Set(income.map(entry => entry.d.slice(0, 7)).filter(value => validMonth(value) && value < current))]
    .sort();
  return months.length ? months[months.length - 1] : null;
}

function PvHubCard({ to, ic, k, d }: { to: Parameters<ReturnType<typeof useApp>['go']>[0]; ic: string; k: string; d: string }) {
  const { t, go } = useApp();
  return (
    <Pressable onPress={() => go(to)} accessibilityRole="button" style={pr.pvhub}>
      <View style={pr.pvhubIc}><Ico name={ic} size={24} color={C.brand} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 17, lineHeight: 22, color: C.ink }}>{t(k)}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64, marginTop: 3 }}>{t(d)}</Text>
      </View>
      <Text style={{ fontSize: 20, color: C.ink40 }}>{'\u203A'}</Text>
    </Pressable>
  );
}

export function PvSwitchScreen() {
  const { S, t, up, toast, monthName } = useApp();
  const latestRecorded = latestCompletedRecordedMonth(S.data.income);
  const suggested = latestRecorded || monthKey();
  const [purchase, setPurchase] = React.useState(S.purchaseMonth || suggested);
  const [editing, setEditing] = React.useState(!S.bought || !S.purchaseMonth);
  const saveMode = () => {
    if (!validMonth(purchase) || purchase > monthKey()) {
      toast(t('pv_purchase_invalid'), 'error');
      return;
    }
    up(s => {
      s.bought = true;
      s.purchaseMonth = purchase;
      // Start with the latest completed recorded month when one is available;
      // otherwise the confirmed purchase month is the safest first actual.
      s.homeownershipMonth = latestRecorded && latestRecorded >= purchase
        ? latestRecorded
        : purchase;
    });
    setEditing(false);
    toast(t('saved'));
  };
  return (
    <ScreenShell back title={t(S.bought ? 'pv_monitor_t' : 'pv_switch_t')}>
      <View style={pr.pvintro}>
        <Ruma w={84} pose="happy" float={false} />
        <BodyS style={{ flex: 1, minWidth: 0 }}>{t('pv_home_b')}</BodyS>
      </View>
      {S.bought && S.purchaseMonth && !editing ? (
        <>
          <Card gap={5}>
            <BodyS muted>{t('pv_purchase')}</BodyS>
            <P style={{ fontFamily: DISP_FONT }}>{monthLabel(S.purchaseMonth, monthName)}</P>
            <BtnLine label={t('pv_purchase_edit')} onPress={() => setEditing(true)} />
          </Card>
          <PvHubCard to="pv_compare" ic="swap" k="pv_then" d="pv_then_d" />
          <PvHubCard to="pv_month" ic="calday" k="pv_month" d="pv_month_d" />
        </>
      ) : (
        <>
          <Field label={t('pv_purchase')}>
            <TextField value={purchase} onChangeText={setPurchase} placeholder="YYYY-MM" accessibilityLabel={t('pv_purchase')} />
          </Field>
          <BodyS muted>{t('pv_purchase_help')}</BodyS>
          <Btn label={t('pv_switch_btn')} onPress={saveMode} />
          {S.bought ? <BtnLine label={t('cancel')} onPress={() => { setPurchase(S.purchaseMonth || suggested); setEditing(false); }} /> : null}
          <BodyS muted>{t('pv_switch_note')}</BodyS>
        </>
      )}
    </ScreenShell>
  );
}

export function PvMonthScreen() {
  const { S, t, monthName, up, refreshWorkCosts, refreshHomeownership, saveHomeownershipMonth, toast } = useApp();
  const selected = S.homeownershipMonth;
  const current = monthKey();
  const saved = S.homeownershipMonths.find(row => row.month === selected);
  const savedCost = saved?.actual_home_costs;
  const [cost, setCost] = React.useState<number | string>(savedCost == null ? '' : Number(savedCost));
  const costRef = React.useRef<number | string>(savedCost == null ? '' : Number(savedCost));
  const months = [...new Set([
    current,
    ...S.data.income.map(entry => entry.d.slice(0, 7)),
    ...S.homeownershipMonths.map(row => row.month),
  ].filter(value => validMonth(value) && (!S.purchaseMonth || value >= S.purchaseMonth)))].sort().reverse();

  React.useEffect(() => {
    void refreshHomeownership().catch(() => undefined);
  }, [refreshHomeownership]);
  React.useEffect(() => {
    void refreshWorkCosts(selected).catch(() => undefined);
  }, [selected, refreshWorkCosts]);
  React.useEffect(() => {
    const value = savedCost == null ? '' : Number(savedCost);
    costRef.current = value;
    setCost(value);
  }, [savedCost, selected]);

  const summary = S.workCostSummary?.month === selected ? S.workCostSummary : null;
  const incomeAfter = summary?.income_after_work_costs == null ? null : Number(summary.income_after_work_costs);
  const actualCosts = cost === '' ? null : Number(cost);
  const position = incomeAfter == null || actualCosts == null ? null : incomeAfter - actualCosts;
  const save = async () => {
    const amount = costRef.current === '' ? null : Number(costRef.current);
    if (amount == null || !Number.isFinite(amount) || amount < 0) {
      toast(t('pv_cost_invalid'), 'error'); return;
    }
    try { await saveHomeownershipMonth(selected, amount); toast(t('saved')); }
    catch { toast(t('as_error'), 'error'); }
  };
  return (
    <ScreenShell back title={t('pv_month_title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {months.map(value => (
          <Pressable key={value} onPress={() => up(s => { s.homeownershipMonth = value; })}
            style={[pr.monthChip, selected === value && pr.monthChipOn]}>
            <Text style={{ color: C.ink, fontFamily: selected === value ? DISP_FONT : BODY_FONT }}>{monthLabel(value, monthName)}</Text>
          </Pressable>
        ))}
      </View>
      {selected === current ? <NoteC><BodyS>{t('pv_current_note')}</BodyS></NoteC> : null}
      {!summary?.income_recorded ? (
        <Card gap={8}>
          <Display cls="h-m">{t('pv_no_income_t')}</Display>
          <BodyS muted>{t('pv_no_income_b')}</BodyS>
          <BtnLine label={t('pv_add_income')} onPress={() => up(s => { s.stack.push(s.route); s.route = 'income'; })} />
        </Card>
      ) : (
        <Card gap={10}>
          <KV k={t('pv_recorded_income')}><View style={{ alignItems: 'flex-end' }}><P>{rm(Number(summary.gross_income))}</P><Prov p="user" /></View></KV>
          <KV k={t('pv_work_costs')}><View style={{ alignItems: 'flex-end' }}><P>− {rm(Number(summary.work_cost_total))}</P><Prov p="user" /></View></KV>
          <Divider />
          <KV k={t('pv_income_after')}><View style={{ alignItems: 'flex-end' }}><Display cls="h-m">{rm(incomeAfter || 0)}</Display><Prov p="calc" /></View></KV>
        </Card>
      )}
      <View testID="pv-actual-cost-card">
        <Card gap={10}>
          <Field label={t('pv_actual_cost')}>
            <NumInput value={cost} onNum={value => { costRef.current = value; setCost(value); }} decimal accessibilityLabel={t('pv_actual_cost')} />
          </Field>
          {savedCost != null ? <Prov p="user" /> : null}
          <Btn label={S.homeownershipSync === 'saving' ? t('saving') : t('pv_save_month')} onPress={() => { void save(); }} />
        </Card>
      </View>
      {position != null ? (
        <Card gap={4}>
          <Display cls="h-xl">{position < 0 ? `−${rm(Math.abs(position))}` : rm(position)}</Display>
          <BodyS muted>{position < 0 ? t('pv_shortby') : t('pv_left')}</BodyS>
          <Prov p="calc" />
        </Card>
      ) : null}
    </ScreenShell>
  );
}

export function PvCompareScreen() {
  const { S, t, monthName, go, refreshHomeownership } = useApp();
  const result = S.testRan ? getHousingTestResult() : null;
  const n = result ? (result.tested_months ?? result.months.length) : 0;
  const s = result ? Number(result.short_month_count) || 0 : 0;
  const rows = S.homeownershipMonths.filter(row => (
    row.is_complete && (!S.purchaseMonth || row.month >= S.purchaseMonth)
  ));
  const shortCount = rows.filter(row => row.short).length;
  const current = monthKey();
  const currentIsPostPurchase = !S.purchaseMonth || current >= S.purchaseMonth;
  const testedMonths = new Set((result?.months || []).map(row => (
    `${row.year}-${String(row.month).padStart(2, '0')}`
  )));
  const outsideEarlierHistory = result
    ? rows.filter(row => !testedMonths.has(row.month)).length
    : 0;
  React.useEffect(() => { void refreshHomeownership().catch(() => undefined); }, [refreshHomeownership]);
  return (
    <ScreenShell back title={t('pv_then')}>
      <BodyS muted>{t('pv_compare_intro')}</BodyS>
      <GuideTarget id="pv.cards" style={{ flexDirection: 'row', gap: 10 }}>
        <View style={pr.pvc}>
          <Text style={pr.pvcK}>{t('pv_earlier_full')}</Text>
          {n > 0 ? (
            <>
              <Text style={pr.pvcB}>{t('pv_short_of', { s, n })}</Text>
              <Text style={pr.pvcS}>{t('pv_earlier_result')}</Text>
              <Text style={pr.pvcE}>{t('pv_earlier_note')}</Text>
              <Prov p="calc" />
            </>
          ) : (
            <>
              <Text style={pr.pvcS}>{t('pv_no_earlier_t')}</Text>
              <Text style={pr.pvcE}>{t('pv_no_earlier_b')}</Text>
            </>
          )}
        </View>
        <View style={pr.pvc}>
          <Text style={pr.pvcK}>{t('pv_actual_full')}</Text>
          {rows.length > 0 ? (
            <>
              <Text style={pr.pvcB}>{t('pv_short_of', { s: shortCount, n: rows.length })}</Text>
              <Text style={pr.pvcS}>{t('pv_actual_result')}</Text>
              <Text style={pr.pvcE}>{t('pv_since_purchase')}</Text>
              <Prov p="user" />
            </>
          ) : (
            <>
              <Text style={pr.pvcS}>{t('pv_compare_empty_t')}</Text>
              {currentIsPostPurchase ? (
                <Text style={pr.pvcE}>{t('pv_current_progress', { m: monthLabel(current, monthName) })}</Text>
              ) : <Text style={pr.pvcE}>{t('pv_compare_empty_b')}</Text>}
            </>
          )}
        </View>
      </GuideTarget>
      {!result ? <BtnLine label={t('hh_test')} onPress={() => go('house')} /> : null}
      {rows.length === 0 ? (
        <Btn label={t('pv_record_month')} onPress={() => go('pv_month')} />
      ) : (
        <>
          <Card gap={12}>
            <Display cls="h-m">{t('pv_month_details')}</Display>
            {rows.map(row => (
              <View key={row.month} style={{ borderTopWidth: 1, borderTopColor: C.ink14, paddingTop: 10, gap: 4 }}>
                <P style={{ fontFamily: DISP_FONT }}>{monthLabel(row.month, monthName)}</P>
                <KV k={t('pv_income_after')}><P>{row.income_after_work_costs == null ? '—' : rm(Number(row.income_after_work_costs))}</P></KV>
                <KV k={t('pv_actual_cost')}><P>{rm(Number(row.actual_home_costs))}</P></KV>
                <KV k={row.short ? t('pv_shortby') : t('pv_left')}><P>{row.cash_position == null ? '—' : rm(Math.abs(Number(row.cash_position)))}</P></KV>
              </View>
            ))}
            <Prov p="user" />
          </Card>
          <NoteC><BodyS>{t('pv_complete_only')}</BodyS></NoteC>
          {outsideEarlierHistory > 0 ? (
            <NoteC><BodyS>{t('pv_then_why_n', { n: outsideEarlierHistory })}</BodyS></NoteC>
          ) : null}
          <BtnLine label={t('pv_record_another')} onPress={() => go('pv_month')} />
        </>
      )}
    </ScreenShell>
  );
}
