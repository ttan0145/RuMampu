import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getHousingTestResult } from '../../../services/housingSession';
import { useApp } from '../state';
import { nf, rm } from '../calc';
import { useHousingCalculation } from '../useHousingCalculation';
import { upfrontFees, upfrontNeed } from '../fees';
import {
  Badge, BodyS, Btn, BtnLine, BtnQuiet, Card, Display, Divider, EditList, NumInput,
  Fig, FigRow, IcLab, KV, NoteC, P, Prov,
  CardI,
} from '../ui';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { Waterline } from '../charts';
import { ScreenShell } from './shell';
import { SheetFrame } from '../overlays';

/* v22: prepare rows live inside the House tab's "Get ready" segment. */
export function PrepareBody() {
  const { t, go } = useApp();
  return (
    <View style={{ gap: 16 }}>
      <BtnQuiet onPress={() => go('upfront')}><IcLab name="wallet"><P>{t('pr_upfront')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('docs')}><IcLab name="file"><P>{t('pr_docs')}</P></IcLab></BtnQuiet>
      <Divider />
      <BtnQuiet style={{ paddingVertical: 12 }} onPress={() => go('pv_switch')}>
        <IcLab name="eye">
          <View style={{ gap: 3, alignItems: 'flex-start' }}>
            <Badge label={t('pr_pv')} />
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

export function UpfrontScreen() {
  const { S, t, up, toast } = useApp();
  const f = upfrontFees(S);
  const src = f.src;
  const dep = src.price ? src.dep : S.data.house.deposit;
  const need = upfrontNeed(S);
  const have = S.data.cashOnHand;
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

  const setItem = (id: string, n: number) => up(s => {
    const it = s.data.upfront.find(x => x.id === id);
    if (it) it.a = Math.max(0, n);
  });

  /* v24 R8f: a row that needs explaining carries an (i), not a paragraph. Short
     factual notes (like the exemption) stay on the row. */
  const Row = ({ label, kind, note, info, children }: {
    label: string; kind: 'user' | 'calc' | 'official' | 'assume'; note?: string;
    info?: React.ReactNode; children: React.ReactNode;
  }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, minHeight: 44, paddingVertical: 6 }}>
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
    const it = S.data.upfront.find(x => x.id === id) ?? { a: 0, ex: 0 };
    return (
      <View style={{ width: 110 }}>
        <NumInput value={+it.a || ''} placeholder={String(it.ex ?? 0)} decimal={false} alignRight
          onNum={n => setItem(id, n)} accessibilityLabel={t((it as { k?: string }).k || '')} />
      </View>
    );
  };
  const Switch = ({ on, onPress, label, info }: { on: boolean; onPress: () => void; label: string; info?: React.ReactNode }) => (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }}
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
  const Stage = ({ n, k, info, children }: { n: number; k: string; info?: React.ReactNode; children: React.ReactNode }) => (
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
      <KV k={t('uf_have')}><Fig value={rm(have)} p="user" cls="h-l" /></KV>
      <KV k={t('uf_need')}><Fig value={rm(need)} p="calc" cls="h-l" /></KV>
      <KV k={t('uf_gap')}><Fig value={rm(gap)} p="calc" cls="h-l" /></KV>
      <View style={{ paddingTop: 10, paddingRight: 34, paddingBottom: 8, paddingLeft: 2 }}>
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ width: 120, height: '100%', justifyContent: 'flex-end' }}>
            <View style={{ height: `${pct(have)}%`, backgroundColor: C.ink, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
            {gap > 0 ? (
              <View style={{
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
      {dep === 0 ? null : <KV k={t('uf_dep')}><Fig value={rm(dep)} p="user" /></KV>}
      {/* v24: the first-home stamp exemption, with the rule it applies. */}
      <Card gap={4}>
        <Switch on={S.firstHome} onPress={() => up(s => { s.firstHome = !s.firstHome; })}
          label={t('uf_first')} info={<CardI t="uf_first" b={['uf_first_h', 'uf_first_src']} p="official" />} />
      </Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase', color: C.ink64 }}>
          {t('uf_steps')}
        </Text>
        <CardI t="uf_steps"
          b={['uf_steps_h', 'uf_baldp_h', 'uf_spa_h_g', 'uf_val_h_g', 'uf_dep0', 'uf_stamp_src', 'uf_legal_src', 'uf_val_src', 'uf_scope']}
          p="calc" />
      </View>
      <Stage n={1} k="uf_s1">
        <Row label={t('uf_earn')} kind="user" info={<CardI t="uf_earn" b={['uf_earn_h']} p="user" />}><Input id="earnest" /></Row>
      </Stage>
      <Stage n={2} k="uf_s2">
        {src.price ? (
          <>
            <Row label={t('uf_baldp')} kind="calc"><Amt v={bal} /></Row>
            <Row label={t('uf_spa')} kind="official"><Amt v={f.spa} /></Row>
            <Row label={t('uf_stampT')} kind="official" note={stampNote || t('uf_stampT_h', { p: rm(src.price) })}><Amt v={f.t} /></Row>
            <Row label={t('uf_loanlegal')} kind="official"><Amt v={f.loanLegal} /></Row>
            <Row label={t('uf_stampL')} kind="official" note={stampNote || t('uf_stampL_h', { p: rm(loan) })}><Amt v={f.l} /></Row>
            <Row label={t('uf_val')} kind="assume"><Amt v={f.val} /></Row>
            <Row label={t('uf_mrta')} kind="user" info={<CardI t="uf_mrta" b={['uf_mrta_h']} p="user" />}><Input id="mrta" /></Row>
          </>
        ) : (
          <Row label={t('uf_mrta')} kind="user" info={<CardI t="uf_mrta" b={['uf_mrta_h']} p="user" />}><Input id="mrta" /></Row>
        )}
      </Stage>
      <Stage n={3} k="uf_s3" info={<CardI t="uf_s3" b={['uf_s3_h']} p="user" />}>
        <Row label={t('uf_util')} kind="user" info={<CardI t="uf_util" b={['uf_util_h']} p="user" />}><Input id="util" /></Row>
        <Row label={t('uf_strata')} kind="user" info={<CardI t="uf_strata" b={['uf_strata_h']} p="user" />}><Input id="strata" /></Row>
        <Row label={t('uf_furn')} kind="user" info={<CardI t="uf_furn" b={['uf_furn_h']} p="user" />}><Input id="furn" /></Row>
        <Switch on={S.ufReno} onPress={() => up(s => { s.ufReno = !s.ufReno; })} label={t('uf_reno_sw')} />
        {S.ufReno ? <Row label={t('uf_reno')} kind="user" info={<CardI t="uf_reno" b={['uf_reno_h']} p="user" />}><Input id="reno" /></Row> : null}
      </Stage>
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
  const { t, monthName, goTab } = useApp();
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
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.bal)), 1);
  const mid = 52;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return (
    <ScreenShell back title={t('pr_buffer')}>
      {/* v24 R8i: the definition stays on screen; the basis moves behind the (i). */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Fig value={rm(liquidity.required_amount)} p="calc" cls="h-xl" />
        <CardI t="pr_buffer" b={[]} p="calc" x={[t('bf_basis', { a: monthName(first.m), b: monthName(last.m) })]} />
      </View>
      <BodyS muted>{t('bf_def')}</BodyS>
      {liquidity.required_amount === 0 ? (
        <NoteC>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <BodyS>{t('bf_zero')}</BodyS>
            <Prov p="calc" />
          </View>
        </NoteC>
      ) : null}
      <BodyS muted>{t('bf_bal')}</BodyS>
      <View style={{ paddingTop: 10, paddingRight: 34, paddingBottom: 26, paddingLeft: 2, marginRight: -20 }}>
        <View style={{ flexDirection: 'row', gap: 8, height: 104 }}>
          {rows.map((r, i) => {
            const h = Math.max(3, Math.abs(r.bal) / maxAbs * 46);
            const neg = r.bal < 0;
            return (
              <View key={i} style={{ flex: 1, minWidth: 14, height: 104 }}>
                <View style={neg
                  ? { position: 'absolute', left: '15%', width: '70%', top: mid, height: h, backgroundColor: C.short, borderRadius: 3, opacity: 0.95 }
                  : { position: 'absolute', left: '15%', width: '70%', bottom: 104 - mid, height: h, backgroundColor: C.ink, borderRadius: 3 }} />
              </View>
            );
          })}
          <View style={{ position: 'absolute', left: -2, right: -14, bottom: 104 - mid, borderTopWidth: 2.5, borderTopColor: C.ink }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6 }}>
          {rows.map((r, i) => (
            <Text key={i} style={{ flex: 1, minWidth: 14, textAlign: 'center', fontSize: 11, letterSpacing: 0.44, color: C.ink64 }}>
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
      </Card>
    </ScreenShell>
  );
}

// EN: Epic 7 Homeownership Monitoring starts here as an Iteration 3 preview only.
// This frontend prototype toggles local state and does not create real post-purchase
// account data, backend records, or persistence.
// 中文：Epic 7“购房后监测”在这里仅作为 Iteration 3 预览。这个前端原型只切换本地状态，
// 不创建真实的购房后账号数据、后端记录或持久化存储。
export function PvSwitchScreen() {
  const { S, t, up, go, toast } = useApp();
  return (
    <ScreenShell back title={t('pv_switch')}>
      <Badge label={t('pv_banner')} />
      <BodyS muted>{t('pv_switch_note')}</BodyS>
      <Btn label={t('pv_switch_btn')} onPress={() => { up(s => { s.bought = true; }); toast(t('saved')); }} />
      {S.bought ? (
        <>
          <BtnQuiet onPress={() => go('pv_month')}><IcLab name="calday"><P>{t('pv_month')}</P></IcLab></BtnQuiet>
          <BtnQuiet onPress={() => go('pv_compare')}><IcLab name="swap"><P>{t('pv_then')}</P></IcLab></BtnQuiet>
        </>
      ) : null}
    </ScreenShell>
  );
}

// EN: Epic 7 preview for monitoring one post-purchase month. Values come from
// static mock data, so this is not a real database-backed monitoring feature yet.
// 中文：Epic 7 的单月购房后监测预览。这里的数值来自静态 mock 数据，目前还不是数据库驱动的真实监测功能。
export function PvMonthScreen() {
  const { S, t, monthName } = useApp();
  const cur = S.data.after.months[S.data.after.months.length - 1];
  const left = cur.inc - cur.home;
  const rows = S.data.after.months.map(r => ({
    m: r.m, surplus: r.inc, short: r.inc < r.home, gap: Math.max(0, r.home - r.inc),
  }));
  return (
    <ScreenShell back title={t('pv_month')}>
      <Badge label={t('pv_banner')} />
      <View>
        <Fig value={(left < 0 ? '−' : '') + rm(Math.abs(left))} p="user" cls="h-xl" />
        <BodyS muted>{left < 0 ? t('pv_shortby') : t('pv_left')}</BodyS>
      </View>
      <KV k={t('pv_in')}><Fig value={rm(cur.inc)} p="user" /></KV>
      <KV k={t('pv_out')}><Fig value={rm(cur.home)} p="user" /></KV>
      <Waterline rows={rows} cost={cur.home} lineLabel prov="user" monthName={monthName} />
    </ScreenShell>
  );
}

// EN: Epic 7 preview comparing the earlier housing test with mock post-purchase
// results. It reuses the latest housing test result but does not store actual
// homeowner history.
// 中文：Epic 7 预览：把先前住房测试与 mock 购房后结果对比。它复用最近一次住房测试结果，
// 但不保存真实业主历史。
export function PvCompareScreen() {
  const { S, t, goTab } = useApp();
  const result = getHousingTestResult();
  if (!result) {
    return (
      <ScreenShell back title={t('pv_then')}>
        <BodyS muted>{t('housing_result_required')}</BodyS>
        <Btn label={t('home_test')} onPress={() => goTab('test')} />
      </ScreenShell>
    );
  }
  const n = result.tested_months;
  const s = result.short_month_count;
  const am = S.data.after.months;
  const s2 = am.filter(r => r.inc < r.home).length;
  return (
    <ScreenShell back title={t('pv_then')}>
      <Badge label={t('pv_banner')} />
      <Display cls="h-m">{t('pv_then_a', { s, n })}</Display>
      <FigRow p="calc" />
      <Display cls="h-m">{t('pv_then_b', { s2, n2: am.length })}</Display>
      <FigRow p="user" />
      <Divider />
      <BodyS muted>{t('pv_then_why')}</BodyS>
      <BodyS muted>{t('pv_keep')}</BodyS>
    </ScreenShell>
  );
}
