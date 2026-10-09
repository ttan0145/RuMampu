import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
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
import { LearnStrip, LnEnter } from './learn';
import { GuideTarget } from '../tour';
import { SheetFrame } from '../overlays';
import { DOC_KEYS } from '../prep7state';
import { goalFromKept, prepLoan } from '../prep7';
import {
  ActBar, b1, Btn2, BtnDeep, Chip7, Fold, G, Group, Hdr7, PAGE, Ph, Rich, RumaImg, Sec, Seg, SHADOW, T7, Toggle, x,
} from './p7ui';
import {
  completedMonthsSincePurchase, postPurchaseMonths, testedMonthsAfterPurchase, unrecordedCompletedMonths,
} from '../homeownership-months';

/* v22: prepare rows live inside the House tab's "Get ready" segment. */
export function PrepareBody() {
  const { t, go } = useApp();
  return (
    <View style={{ gap: 16 }}>
      <BtnQuiet onPress={() => go('upfront')}><IcLab name="wallet"><P>{t('pr_upfront')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('buffer')}><IcLab name="ring"><P>{t('pr_buffer')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('docs')}><IcLab name="file"><P>{t('pr_docs')}</P></IcLab></BtnQuiet>
      <View testID="prepare-learning" style={{ gap: 8 }}>
        <BtnQuiet onPress={() => go('learn')}><IcLab name="book"><P>{t('hh_learn')}</P></IcLab></BtnQuiet>
        <LearnStrip />
      </View>
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
/* v7 Upfront cash (RuMampu_Prepare_Loan_v7_1.html): what is still to find, the
   money I can use, and what makes up the need folded away, by cost type or by
   when it is paid. AC5.2: "You have" is the one pot, stated once; every cost
   row keeps its tag (official, calculated, assumed, my entry). */
function Li({ id, label, kind, note, info, children }: {
  id?: string; label: string; kind: 'user' | 'calc' | 'official' | 'assume'; note?: string; info?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View testID={id ? `upfront-row-${id}` : undefined} style={uv.li}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: G.r, fontSize: 13.5, color: T7.text }}>{label}</Text>{info}
        </View>
        <View style={{ alignItems: 'flex-start', marginTop: 2 }}><Prov p={kind} /></View>
        {note ? <Text style={{ fontFamily: G.r, fontSize: 11.5, lineHeight: 16, color: T7.text2, marginTop: 2 }}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}
const Amt7 = ({ v, s }: { v: number; s?: string }) => (
  <Text style={{ fontFamily: G.s, fontSize: 13.5, color: T7.text, fontVariant: ['tabular-nums'] }}>{s ?? rm(Math.round(v))}</Text>
);
function In7({ id }: { id: string }) {
  const { S, t, up } = useApp();
  const it = S.data.upfront.find(x => x.id === id) ?? { a: 0, ex: 0, k: '' };
  return (
    <NumInput value={+it.a || ''} placeholder={t('eg_ph', { v: it.ex ?? 0 })} decimal={false}
      onNum={n => up(s => { const r = s.data.upfront.find(x => x.id === id); if (r) r.a = Math.max(0, n); })}
      accessibilityLabel={t((it as { k?: string }).k || '')} style={uv.liIn} />
  );
}
/* .stg: one cost group that opens to its rows */
function Stg({ n, title, sub, amt, children, testID }: { n: string; title: string; sub?: string; amt: string; children: React.ReactNode; testID?: string }) {
  const [open, setOpen] = React.useState(true);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: T7.line }}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} testID={testID}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 2 }}>
        <View style={uv.stgN}><Text style={{ fontFamily: G.s, fontSize: 12, color: T7.accentInk }}>{n}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: G.s, fontSize: 14.5, color: T7.text }}>{title}</Text>
          {sub ? <Text style={{ fontFamily: G.r, fontSize: 12, color: T7.text2, marginTop: 1 }}>{sub}</Text> : null}
        </View>
        <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text, fontVariant: ['tabular-nums'] }}>{amt}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Ph name="down" size={17} color={T7.text3} /></View>
      </Pressable>
      {open ? <View style={{ paddingLeft: 46, paddingRight: 2, paddingBottom: 8 }}>{children}</View> : null}
    </View>
  );
}

export function UpfrontScreen() {
  const { S, t, up, monthName, go, toast } = useApp();
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
  const item = (id: string) => S.data.upfront.find(x => x.id === id) ?? { a: 0, ex: 0 };
  const bal = Math.max(0, dep - (+item('earnest').a || 0));
  const stampNote = f.exempt ? t('uf_exempt') : (S.firstHome && src.price > 500000 ? t('uf_noexempt') : '');
  const pct = need > 0 ? Math.min(1, have / need) : have > 0 ? 1 : 0;
  const [view, setView] = React.useState<'type' | 'when'>('when');
  /* AC10.12.2: the saved test the figures (and the saving plan's goal) follow is chosen here */
  const [pick, setPick] = React.useState(false);
  const testsWithPrice = S.keptTests
    .map((k, i) => ({ k, i }))
    .filter(z => z.k.propertyPrice != null && Number(z.k.propertyPrice) > 0);

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

  /* the rows, each kept once and shown by type or by when it is paid */
  const moveIn = (id: string) => (+item(id).a || 0);
  const reno = S.ufReno ? moveIn('reno') : 0;
  const R: Record<string, React.ReactNode> = {
    earnest: <Li key="earnest" label={t('uf_earn')} kind="user" note={t('uf_earn_in')} info={<CardI t="uf_earn" b={['uf_earn_h']} p="user" />}><In7 id="earnest" /></Li>,
    baldp: <Li key="baldp" id="baldp" label={t('uf_baldp')} kind="calc"><Amt7 v={bal} /></Li>,
    spa: <Li key="spa" id="spa" label={t('uf_spa')} kind="official"><Amt7 v={f.spa} /></Li>,
    loanlegal: <Li key="loanlegal" id="loanlegal" label={t('uf_loanlegal')} kind="official"><Amt7 v={f.loanLegal} /></Li>,
    stampT: <Li key="stampT" id="stampT" label={t('uf_stampT')} kind="official" note={stampNote || t('uf_stampT_h', { p: rm(src.price) })}><Amt7 v={f.t} /></Li>,
    stampL: <Li key="stampL" id="stampL" label={t('uf_stampL')} kind="official" note={stampNote || t('uf_stampL_h', { p: rm(loan) })}><Amt7 v={f.l} /></Li>,
    val: <Li key="val" id="val" label={t('uf_val')} kind="assume"><Amt7 v={f.val} /></Li>,
    mrta: <Li key="mrta" label={t('uf_mrta')} kind="user" info={<CardI t="uf_mrta" b={['uf_mrta_h']} p="user" />}><In7 id="mrta" /></Li>,
    util: <Li key="util" label={t('uf_util')} kind="user" info={<CardI t="uf_util" b={['uf_util_h']} p="user" />}><In7 id="util" /></Li>,
    strata: <Li key="strata" label={t('uf_strata')} kind="user" info={<CardI t="uf_strata" b={['uf_strata_h']} p="user" />}><In7 id="strata" /></Li>,
    furn: <Li key="furn" label={t('uf_furn')} kind="user" info={<CardI t="uf_furn" b={['uf_furn_h']} p="user" />}><In7 id="furn" /></Li>,
    renoSw: (
      <Pressable key="renoSw" onPress={() => up(s => { s.ufReno = !s.ufReno; })} accessibilityRole="switch" accessibilityState={{ checked: S.ufReno }} aria-checked={S.ufReno}
        accessibilityLabel={t('uf_reno_sw')} style={[uv.sw, { borderTopWidth: 0, marginTop: 0 }]}>
        <Text style={{ flex: 1, fontFamily: G.s, fontSize: 14, color: T7.text }}>{t('uf_reno_sw')}</Text>
        <Toggle on={S.ufReno} />
      </Pressable>
    ),
    reno: S.ufReno ? <Li key="reno" label={t('uf_reno')} kind="user" info={<CardI t="uf_reno" b={['uf_reno_h']} p="user" />}><In7 id="reno" /></Li> : null,
  };
  const rows = (ids: string[]) => ids.map(id => R[id]).filter(Boolean);
  const price = src.price > 0;
  const cats = [
    { k: 'dp', col: T7.accentDeep, a: dep, ids: price ? ['earnest', 'baldp'] : ['earnest'] },
    { k: 'legal', col: T7.accent, a: price ? f.spa + f.loanLegal : 0, ids: price ? ['spa', 'loanlegal'] : [] },
    { k: 'stamp', col: '#7DB6B8', a: price ? f.t + f.l : 0, ids: price ? ['stampT', 'stampL'] : [] },
    { k: 'val', col: '#5E7172', a: price ? f.val : 0, ids: price ? ['val'] : [] },
    { k: 'ins', col: '#A9B7B8', a: moveIn('mrta') + moveIn('util') + moveIn('strata') + moveIn('furn') + reno, ids: ['mrta', 'util', 'strata', 'furn', 'renoSw', 'reno'] },
  ].filter(cg => cg.ids.length);
  const stages = [
    { n: '1', k: 'uf_s1', ids: ['earnest'], a: +item('earnest').a || 0 },
    { n: '2', k: 'uf_s2', ids: price ? ['baldp', 'spa', 'stampT', 'loanlegal', 'stampL', 'val', 'mrta'] : ['mrta'],
      a: (price ? bal + f.spa + f.t + f.loanLegal + f.l + f.val : 0) + moveIn('mrta') },
    { n: '3', k: 'uf_s3', ids: ['util', 'strata', 'furn', 'renoSw', 'reno'], a: moveIn('util') + moveIn('strata') + moveIn('furn') + reno },
  ];
  const missing = ['mrta', 'util', 'strata', 'furn'].filter(id => !(+item(id).a)).map(id => t((item(id) as { k?: string }).k || ''));
  const shown = cats.filter(cg => cg.a > 0);

  return (
    <ScreenShell tint={T7.bg} noScene header={<Hdr7 title={t('pr_upfront')} />} contentStyle={PAGE}
      footer={gap > 0 ? <ActBar><View style={{ flex: 1 }}><BtnDeep label={t('p7_uf_plan', { a: rm(Math.round(gap)) })} onPress={() => go('plan')} /></View></ActBar> : undefined}>
      {/* which tested price the figures come from, and the saved test to use */}
      {price ? (
        <Pressable onPress={() => testsWithPrice.length > 1 && setPick(true)} disabled={testsWithPrice.length < 2}
          accessibilityRole="button" testID="upfront-source" style={uv.src}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: G.r, fontSize: 12, color: T7.text2 }}>{t('uf_for')}</Text>
            <Text style={{ fontFamily: G.s, fontSize: 14.5, color: T7.text }} numberOfLines={1}>
              {src.name && src.name !== rm(src.price) ? `${src.name}, ${rm(src.price)}` : src.saved ? rm(src.price) : `${rm(src.price)}, ${t('uf_for_house')}`}
            </Text>
          </View>
          {testsWithPrice.length > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ph name="edit" size={14} color={T7.accentInk} />
              <Text style={{ fontFamily: G.s, fontSize: 13, color: T7.accentInk }}>{t('uf_switch')}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <View style={[x.cardx, { marginTop: 4, marginBottom: 14 }]}><Text style={x.tiny}>{t('uf_notest')}</Text></View>
      )}
      {/* .cardx: what is still to find */}
      <GuideTarget id="uf.chart">
      <View style={x.cardx} testID="upfront-summary">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={x.k}>{gap ? t('p7_uf_still') : t('p7_uf_upfront')}</Text>
          <Prov p="calc" />
        </View>
        <Text style={uv.bignum} testID="upfront-gap-figure">{gap ? rm(Math.round(gap)) : t('p7_uf_covered')}</Text>
        <View style={uv.mb} accessibilityRole="image" accessibilityLabel={t('uf_ch_alt', { h: rm(have), n: rm(need) })} testID="upfront-meter">
          <View testID="upfront-available" style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 5, backgroundColor: T7.accent }} />
          {gap > 0 ? <View testID="upfront-gap" style={{ flex: 1, height: '100%' }} /> : null}
        </View>
        <View style={uv.ml}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2 }} testID="upfront-have-need">{t('p7_uf_have', { a: rm(have), b: rm(need) })}</Text>
            <Pressable onPress={() => up(s => { s.sheet = 'pothow'; })} accessibilityLabel={t('ph_title')} hitSlop={8} style={{ paddingLeft: 4 }}>
              <Ph name="info" size={14} color={T7.text3} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2 }}>{Math.round(pct * 100)}%</Text>
        </View>
      </View>
      </GuideTarget>
      {held > 0 ? <View testID="upfront-held"><Text style={[x.tiny, { marginTop: 10 }]}>{t('uf_held', { a: rm(held) })}</Text></View> : null}
      {/* AC5.8.7: a newer house test moved the buffer, so the amount held changed. */}
      {S.buffer?.msg === 'moved' && S.buffer.prevTarget != null && S.buffer.target != null ? (
        <View testID="upfront-held-moved"><Text style={[x.tiny, { marginTop: 6 }]}>{t('uf_moved', { a: rm(S.buffer.prevTarget), b: rm(S.buffer.target) })}</Text></View>
      ) : null}
      {price && dep === 0 ? <Text style={[x.tiny, { marginTop: 10 }]}>{t('uf_dep0')}</Text> : null}
      {/* money you can use */}
      <Sec title={t('p7_uf_money')} />
      <Group>
        <View style={uv.arow} testID="upfront-row-cash">
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: G.m, fontSize: 14, color: T7.text }}>{t('p7_uf_cash')}</Text>
              <CardI t="uf_cash_l" b={['uf_cash_h']} p="user" />
            </View>
            <View style={{ alignItems: 'flex-start', marginTop: 2 }}><Prov p="user" /></View>
            {cashNote ? <Text style={{ fontFamily: G.r, fontSize: 11.5, color: T7.text2, marginTop: 2 }}>{cashNote}</Text> : null}
          </View>
          <View style={uv.pin}>
            <Text style={{ fontFamily: G.m, fontSize: 14, color: T7.text2 }}>RM</Text>
            <NumInput value={+S.data.cashOnHand || ''} placeholder="0" onNum={setCash} accessibilityLabel={t('p7_uf_cash')} style={uv.pinIn} />
          </View>
        </View>
      </Group>
      {/* what makes up the need */}
      <Sec title={t('p7_uf_makes', { a: rm(need) })}
        info={<CardI t="uf_steps" b={['uf_steps_h', 'uf_baldp_h', 'uf_spa_h_g', 'uf_val_h_g', 'uf_dep0', 'uf_stamp_src', 'uf_legal_src', 'uf_val_src', 'uf_scope']} p="calc" />} />
      <Group>
        <Fold title={t('p7_uf_incl')} testID="upfront-included" open>
          {shown.length ? (
            <>
              <View style={uv.sbar}>
                {shown.map(cg => <View key={cg.k} style={{ width: `${cg.a / Math.max(1, need) * 100}%`, backgroundColor: cg.col }} />)}
              </View>
              <View style={{ marginTop: 8 }}>
                {shown.map((cg, i) => (
                  <View key={cg.k} style={[uv.cl, i === shown.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cg.col }} />
                      <Text style={{ fontFamily: G.r, fontSize: 13.5, color: T7.text }}>{t(`p7_cat_${cg.k}`)}</Text>
                    </View>
                    <Text style={{ fontFamily: G.s, fontSize: 13.5, color: T7.text }}>{rm(Math.round(cg.a))}</Text>
                    <Text style={{ width: 40, textAlign: 'right', fontFamily: G.r, fontSize: 12, color: T7.text2 }}>{Math.round(cg.a / Math.max(1, need) * 100)}%</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
          {missing.length ? <Rich s={t('p7_uf_notyet', { x: b1(missing.join(', ')) })} style={uv.miss} bold={{ color: T7.text }} /> : null}
          {/* v24: the first-home stamp exemption, with the rule it applies */}
          <GuideTarget id="uf.first">
            <Pressable onPress={() => up(s => { s.firstHome = !s.firstHome; })} accessibilityRole="switch" accessibilityState={{ checked: S.firstHome }}
              aria-checked={S.firstHome} accessibilityLabel={t('uf_first')} style={uv.sw}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontFamily: G.s, fontSize: 14.5, color: T7.text }}>{t('uf_first')}</Text>
                  <CardI t="uf_first" b={['uf_first_h', 'uf_first_src']} p="official" />
                </View>
                <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2, marginTop: 2 }}>{t('p7_uf_first_s')}</Text>
              </View>
              <Toggle on={S.firstHome} />
            </Pressable>
          </GuideTarget>
          <View style={{ marginTop: 12, marginBottom: 6 }}>
            <Seg wide items={[{ v: 'type' as const, l: t('p7_uf_type') }, { v: 'when' as const, l: t('p7_uf_when') }]} on={view} onPick={setView} />
          </View>
          <GuideTarget id="uf.stage">
          {view === 'type' ? cats.map(cg => (
            <Stg key={cg.k} testID={`upfront-cat-${cg.k}`} n={`${Math.round(cg.a / Math.max(1, need) * 100)}%`} title={t(`p7_cat_${cg.k}`)} sub={t(`p7_cat_${cg.k}_s`)}
              amt={cg.k === 'stamp' && f.exempt ? t('p7_exempt') : rm(Math.round(cg.a))}>
              {rows(cg.ids)}
            </Stg>
          )) : stages.map(sg => (
            <Stg key={sg.n} testID={`upfront-stage-${sg.n}`} n={sg.n} title={t(sg.k)} amt={rm(Math.round(sg.a))}>
              {sg.n === '3' ? <Text style={[x.tiny, { marginTop: 4 }]}>{t('uf_s3_in')}</Text> : null}
              {rows(sg.ids)}
            </Stg>
          ))}
          </GuideTarget>
        </Fold>
      </Group>
      <Text style={x.disc}>{t('p7_uf_disc')}</Text>
      {/* v26: what these costs are, as short lessons */}
      <View style={{ marginTop: 14 }}><LnEnter tab="upfront" k="ln_link_upfront" /></View>
      {pick ? (
        <SheetFrame pose="curious" onClose={() => setPick(false)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: G.s, fontSize: 18, letterSpacing: -0.18, color: T7.text }}>{t('uf_pick_t')}</Text>
            <Pressable onPress={() => setPick(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('p7_close')}><Ph name="x" size={20} /></Pressable>
          </View>
          <Text style={[x.tiny, { marginTop: 4 }]}>{t('uf_pick_h')}</Text>
          <View style={{ marginTop: 8 }}>
            {testsWithPrice.map(({ k, i }) => (
              <Pressable key={i} onPress={() => { goalFromKept(S.keptTests[i]); up(s => { s.ufTest = i; }); setPick(false); toast(t('saved')); }} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: T7.line }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text }}>{k.name || rm(Number(k.propertyPrice) || 0)}</Text>
                  <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2, marginTop: 1 }}>{rm(Number(k.propertyPrice) || 0)}</Text>
                </View>
                {S.ufTest === i ? <Ph name="check" size={20} color={T7.accentInk} /> : null}
              </Pressable>
            ))}
          </View>
        </SheetFrame>
      ) : null}
    </ScreenShell>
  );
}

const uv = StyleSheet.create({
  src: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T7.surface2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4, marginBottom: 14 },
  bignum: { fontFamily: G.s, fontSize: 36, lineHeight: 40, letterSpacing: -1.08, color: T7.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  mb: { height: 10, borderRadius: 5, backgroundColor: T7.badSoft, overflow: 'hidden', flexDirection: 'row', marginTop: 10 },
  ml: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  arow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinIn: { width: 112, borderWidth: 1, borderColor: T7.line2, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, fontFamily: G.s, fontSize: 15, textAlign: 'right', color: T7.text, backgroundColor: T7.surface, minHeight: 0 },
  sbar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  cl: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T7.line },
  miss: { fontFamily: G.r, fontSize: 12.5, lineHeight: 18, color: T7.text2, marginTop: 10 },
  sw: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: T7.line, marginTop: 8 },
  stgN: { minWidth: 34, paddingHorizontal: 6, height: 26, borderRadius: 999, backgroundColor: T7.accentSoft, alignItems: 'center', justifyContent: 'center' },
  li: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T7.line },
  liIn: { width: 100, borderWidth: 1, borderColor: T7.line2, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 9, fontFamily: G.s, fontSize: 13.5, textAlign: 'right', color: T7.text, backgroundColor: T7.surface, minHeight: 0 },
});

const pr = StyleSheet.create({
  keysCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 18, padding: 14 },
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
  sheet: {
    backgroundColor: C.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 26,
  },
  opt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, paddingHorizontal: 12, borderRadius: 12,
  },
});

/* The pencil the income rows use to edit (incard.tsx), so editing looks the same everywhere. */
const PEN_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="rgba(60,81,82,0.64)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12.5 7.5l4 4"/></svg>';

export function BufferScreen() {
  const { S, t, up, monthName, goTab, go } = useApp();
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
      {/* AC5.8.10: what I call this money, with the same pencil the income rows use to edit. */}
      <View testID="buffer-name" style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }} numberOfLines={1}>{t('p10_shield_t')}</Text>
        <Pressable onPress={() => up(s => { s.sheet = 'bufname'; })} accessibilityRole="button"
          accessibilityLabel={t('bf_name_link')} hitSlop={6}
          style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
          <SvgXml xml={PEN_SVG} width={17} height={17} />
        </Pressable>
      </View>
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
          {/* AC5.8.9: money used from the buffer comes off the pot. */}
          {covered > 0 ? <BtnLine label={t('bu_link')} onPress={() => up(s => { s.sheet = 'bufuse'; })} /> : null}
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

/* v7 Documents & financing: a checklist with real boxes and the SJKP scheme.
   The criteria are listed, not ticked: RuMampu cannot tell whether they are met,
   and the income check stays "needs review" (SJKP measures gross income,
   RuMampu income after work costs), so no pass or fail is shown. */
export function DocsScreen() {
  const { S, t, up } = useApp();
  const ready = DOC_KEYS.filter(k => S.docsChecked.includes(k)).length;
  const toggle = (k: string) => up(s => {
    const i = s.docsChecked.indexOf(k);
    if (i >= 0) s.docsChecked.splice(i, 1); else s.docsChecked.push(k);
  });
  return (
    <ScreenShell tint={T7.bg} noScene header={<Hdr7 title={t('pr_docs')} />} contentStyle={PAGE}>
      <View style={[x.cardx, { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 4 }]}>
        <Ph name="info" size={26} color={T7.accentInk} />
        <Text style={{ flex: 1, fontFamily: G.r, fontSize: 13.5, lineHeight: 20, color: T7.text }}>{t('p7_dc_intro')}</Text>
      </View>
      <Sec title={t('p7_dc_your')} right={t('p7_dc_n', { n: ready, m: DOC_KEYS.length })} />
      <Group>
        {DOC_KEYS.map(k => {
          const on = S.docsChecked.includes(k);
          return (
            <Pressable key={k} onPress={() => toggle(k)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on}
              accessibilityLabel={t(k)} testID={`doc-${k}`} style={({ pressed }) => [dv.chk, pressed && { backgroundColor: T7.surface2 }]}>
              <View style={[dv.bx, on && { backgroundColor: T7.accent, borderColor: T7.accent }]}>{on ? <Ph name="check" size={14} color={T7.onAccent} /> : null}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: G.m, fontSize: 14.5, color: on ? T7.text2 : T7.text }}>{t(k)}</Text>
                <Text style={{ fontFamily: G.r, fontSize: 12.5, color: T7.text2, marginTop: 1 }}>{t(`p7_${k}_d`)}</Text>
              </View>
            </Pressable>
          );
        })}
      </Group>
      <Sec title={t('p7_dc_sjkp')} right={t('p7_dc_src_s')} info={<CardI t="pr_docs" b={['dc_src', 'dc_65', 'dc_65_note', 'dc_plain']} p="official" />} />
      <View style={[x.cardx, { paddingTop: 4, paddingBottom: 14 }]}>
        {['dc_sj1', 'dc_sj3', 'dc_sj2'].map(k => (
          <View key={k} style={dv.li}>
            <Text style={{ flex: 1, fontFamily: G.r, fontSize: 13.5, color: T7.text }}>{t(k)}</Text>
            {k === 'dc_sj2' ? <Chip7 label={t('p7_dc_review')} tone="warn" /> : <View style={dv.dot} />}
          </View>
        ))}
        <Text style={{ fontFamily: G.r, fontSize: 12.5, lineHeight: 18, color: T7.text2, marginTop: 10 }}>{t('dc_plain')}</Text>
      </View>
      {/* v26: the lesson on what to bring instead of a payslip */}
      <View style={{ marginTop: 14 }}><LnEnter tab="nosalary" k="ln_link_docs" /></View>
    </ScreenShell>
  );
}

const dv = StyleSheet.create({
  chk: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  bx: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: T7.line2, alignItems: 'center', justifyContent: 'center' },
  li: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T7.line },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T7.text3 },
});

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
    <Pressable onPress={() => go(to)} accessibilityRole="button" style={[{ backgroundColor: T7.surface, borderRadius: 16, padding: 16, ...SHADOW }, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
      <View style={[pr.pvhubIc, { backgroundColor: T7.accentSoft }]}><Ico name={ic} size={24} color={T7.accentInk} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 17, lineHeight: 22, color: C.ink }}>{t(k)}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64, marginTop: 3 }}>{t(d)}</Text>
      </View>
      <Text style={{ fontSize: 20, color: C.ink40 }}>{'\u203A'}</Text>
    </Pressable>
  );
}

/* v7 Got the keys? Before buying: Ruma, one line, the month you bought (blank
   until you pick it), and one button. After: how the months since buying went. */
function MonthField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'month', value, max: monthKey(), 'aria-label': label,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: {
        display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, border: `1px solid ${T7.line2}`, borderRadius: 12,
        padding: 12, fontSize: 15, fontFamily: G.r, color: T7.text, background: T7.surface,
      },
    });
  }
  return (
    <View style={{ marginTop: 6 }}>
      <TextField value={value} onChangeText={onChange} placeholder="YYYY-MM" accessibilityLabel={label} />
    </View>
  );
}

export function PvSwitchScreen() {
  const { S, t, up, toast, monthName, go, refreshHomeownership } = useApp();
  const latestRecorded = latestCompletedRecordedMonth(S.data.income);
  const [purchase, setPurchase] = React.useState(S.purchaseMonth || '');
  const [editing, setEditing] = React.useState(!S.bought || !S.purchaseMonth);
  React.useEffect(() => { if (S.bought) void refreshHomeownership().catch(() => undefined); }, [S.bought, refreshHomeownership]);
  const saveMode = () => {
    if (!purchase) { toast(t('p7_keys_pick'), 'error'); return; }
    if (!validMonth(purchase) || purchase > monthKey()) { toast(t('pv_purchase_invalid'), 'error'); return; }
    up(s => {
      s.bought = true;
      s.purchaseMonth = purchase;
      // Start with the latest completed recorded month when one is available;
      // otherwise the confirmed purchase month is the safest first actual.
      s.homeownershipMonth = latestRecorded && latestRecorded >= purchase ? latestRecorded : purchase;
    });
    setEditing(false);
    toast(t('p7_keys_switched'));
  };
  const form = !(S.bought && S.purchaseMonth && !editing);

  if (form) {
    return (
      <ScreenShell tint={T7.bg} noScene header={<Hdr7 title={t('pr_pv')} />} contentStyle={PAGE}
        footer={<ActBar><View style={{ flex: 1 }}><BtnDeep label={t('p7_keys_btn')} onPress={saveMode} testID="keys-bought" /></View></ActBar>}>
        <View style={[x.cardx, { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 4 }]}>
          <RumaImg pose="wave" w={76} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: G.s, fontSize: 18, color: T7.text }}>{t('p7_q_keys')}</Text>
            <Text style={{ fontFamily: G.r, fontSize: 13.5, lineHeight: 20, color: T7.text2, marginTop: 4 }}>{t('pv_home_b')}</Text>
          </View>
        </View>
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: G.s, fontSize: 13, color: T7.text }}>{t('p7_keys_month')}</Text>
          <MonthField value={purchase} onChange={setPurchase} label={t('p7_keys_month')} />
        </View>
        {/* AC 7.1.6 and 7.1.7: the month splits planning months from the months after buying */}
        <Text style={[x.tiny, { marginTop: 8, marginHorizontal: 2 }]}>{t('pv_purchase_help')}</Text>
        <Text style={[x.tiny, { marginTop: 4, marginHorizontal: 2 }]}>{t('p7_keys_later')}</Text>
        {/* AC 7.1.2 and 7.1.3: estimates become actuals; the purchase happens outside RuMampu */}
        <Text style={[x.tiny, { marginTop: 4, marginHorizontal: 2 }]}>{t('pv_switch_note')}</Text>
        {S.bought ? <Btn2 label={t('cancel')} onPress={() => { setPurchase(S.purchaseMonth || ''); setEditing(false); }} /> : null}
      </ScreenShell>
    );
  }

  /* after buying: the months since, against the earlier test */
  const result = S.testRan ? getHousingTestResult() : null;
  const rows = S.homeownershipMonths.filter(r => r.is_complete && (!S.purchaseMonth || r.month >= S.purchaseMonth)).sort((a, b) => a.month.localeCompare(b.month));
  const short = rows.filter(r => r.short).length;
  const en = result ? (result.tested_months ?? result.months.length) : 0;
  const es = result ? Number(result.short_month_count) || 0 : 0;
  const pm = S.purchaseMonth as string;
  const since = `${STRINGS_MONTH_LONG(monthName, pm)}`;
  const inst = prepLoan(S).mo || (result ? Number(result.tested_home_cost) : 0);
  const completedSince = completedMonthsSincePurchase(pm, new Date());
  return (
    <ScreenShell tint={T7.bg} noScene header={<Hdr7 title={t('pr_pv')} />} contentStyle={PAGE}
      footer={<ActBar><View style={{ flex: 1 }}><BtnDeep label={t('pv_month')} onPress={() => go('pv_month')} testID="keys-record" /></View></ActBar>}>
      <View style={[x.cardx, { marginTop: 4 }]} testID="keys-summary">
        <Text style={x.k}>{t('p7_keys_since', { m: since })}</Text>
        <Text style={{ fontFamily: G.s, fontSize: 28, lineHeight: 32, letterSpacing: -0.84, color: T7.text, marginTop: 4 }}>
          {rows.length ? t('p7_keys_short', { s: short, n: rows.length }) : t('pv_compare_empty_t')}
        </Text>
        {/* Moving the purchase month changes how many months have ended since buying;
            say how many of them are recorded so the change is visible at once. */}
        {completedSince > 0 ? (
          <Text style={[x.tiny, { marginTop: 4 }]} testID="pv-coverage">{t('pv_recorded_of', { r: rows.length, n: completedSince })}</Text>
        ) : null}
        {rows.length ? (
          <View style={{ flexDirection: 'row', gap: 2, height: 8, marginTop: 12 }}>
            {rows.map(r => <View key={r.month} style={{ flex: 1, borderRadius: 2, backgroundColor: r.short ? T7.short : T7.accent }} />)}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {[
          [t('p7_keys_earlier'), en ? `${es} of ${en}` : '-'],
          [t('p7_keys_buying'), rows.length ? `${short} of ${rows.length}` : '-'],
          [t('p7_keys_inst'), inst ? rmK7(inst) : '-'],
        ].map(([k, v]) => (
          <View key={k} style={{ flex: 1, backgroundColor: T7.surface2, borderRadius: 12, padding: 12 }}>
            <Text style={x.k}>{k}</Text>
            <Text style={{ fontFamily: G.s, fontSize: 17, color: T7.text, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
          </View>
        ))}
      </View>
      <UnrecordedMonths />
      <Btn2 label={t('pv_then')} onPress={() => go('pv_compare')} testID="keys-mbm" />
      <Pressable onPress={() => { setPurchase(pm); setEditing(true); }} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 10 }}>
        <Text style={{ fontFamily: G.s, fontSize: 14, color: T7.accentInk }}>{t('p7_keys_change')}</Text>
      </Pressable>
    </ScreenShell>
  );
}
const STRINGS_MONTH_LONG = (monthName: (m: number) => string, ym: string) => (validMonth(ym) ? `${monthName(+ym.slice(5, 7) - 1)} ${ym.slice(0, 4)}` : ym);
const rmK7 = (v: number) => `RM ${Math.round(v).toLocaleString('en-MY')}`;

/* AC 7.3.5: completed months since buying with no home costs yet are named, so
   moving the purchase month earlier never looks as if nothing happened. The
   button opens Record a month on the oldest of them. */
function UnrecordedMonths() {
  const { S, t, monthName, up, go } = useApp();
  if (!S.purchaseMonth) return null;
  const recorded = S.homeownershipMonths.map(row => row.month);
  const missing = unrecordedCompletedMonths(S.purchaseMonth, recorded, new Date());
  if (!missing.length) return null;
  return (
    <View style={[x.cardx, { marginTop: 10, paddingVertical: 12 }]} testID="pv-unrecorded">
      <Text style={x.tiny}>{t('pv_unrecorded_n', { n: missing.length })}</Text>
      <Btn2 label={t('pv_record_first', { m: monthLabel(missing[0], monthName) })} onPress={() => {
        up(s => { s.homeownershipMonth = missing[0]; });
        go('pv_month');
      }} />
    </View>
  );
}

/* v7 look for Epic 7's Monthly actuals: the same month choice, recorded income
   and work costs from the record, the actual home cost I enter, and the cash
   position, in the Prepare screens' cards and type. Behaviour unchanged. */
export function PvMonthScreen() {
  const { S, t, monthName, up, refreshWorkCosts, refreshHomeownership, saveHomeownershipMonth, toast } = useApp();
  const selected = S.homeownershipMonth;
  const current = monthKey();
  const saved = S.homeownershipMonths.find(row => row.month === selected);
  const savedCost = saved?.actual_home_costs;
  const [cost, setCost] = React.useState<number | string>(savedCost == null ? '' : Number(savedCost));
  const costRef = React.useRef<number | string>(savedCost == null ? '' : Number(savedCost));
  /* AC 7.1.7 and 7.2.1: every month from the purchase month to this one can be
     recorded, including months with no income yet (they say so below). */
  const months = S.purchaseMonth && validMonth(S.purchaseMonth)
    ? postPurchaseMonths(S.purchaseMonth, new Date())
    : [...new Set([
      current,
      ...S.data.income.map(entry => entry.d.slice(0, 7)),
      ...S.homeownershipMonths.map(row => row.month),
    ].filter(validMonth))].sort().reverse();

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
  const kvRow = (k: string, v: React.ReactNode, last = false) => (
    <View style={[pv.kv, last && { borderBottomWidth: 0 }]}>
      <Text style={{ flex: 1, fontFamily: G.r, fontSize: 14, color: T7.text2 }}>{k}</Text>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>{v}</View>
    </View>
  );
  return (
    <ScreenShell tint={T7.bg} noScene header={<Hdr7 title={t('pv_month_title')} />} contentStyle={PAGE}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {months.map(value => {
          const on = selected === value;
          return (
            <Pressable key={value} onPress={() => up(s => { s.homeownershipMonth = value; })} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={[pv.chip, on && pv.chipOn]}>
              <Text style={{ fontFamily: on ? G.s : G.m, fontSize: 13.5, color: on ? T7.accentInk : T7.text }}>{monthLabel(value, monthName)}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected === current ? (
        <View style={[x.cardx, { marginTop: 14, paddingVertical: 12 }]}><Text style={x.tiny}>{t('pv_current_note')}</Text></View>
      ) : null}
      {!summary?.income_recorded ? (
        <View style={[x.cardx, { marginTop: 14 }]}>
          <Text style={{ fontFamily: G.s, fontSize: 17, color: T7.text }}>{t('pv_no_income_t')}</Text>
          <Text style={[x.tiny, { marginTop: 4 }]}>{t('pv_no_income_b')}</Text>
          <Btn2 label={t('pv_add_income')} onPress={() => up(s => { s.stack.push(s.route); s.route = 'income'; })} />
        </View>
      ) : (
        <View style={[x.card, { marginTop: 14, paddingVertical: 4 }]}>
          {kvRow(t('pv_recorded_income'), <><Text style={pv.v}>{rm(Number(summary.gross_income))}</Text><Prov p="user" /></>)}
          {kvRow(t('pv_work_costs'), <><Text style={pv.v}>− {rm(Number(summary.work_cost_total))}</Text><Prov p="user" /></>)}
          {kvRow(t('pv_income_after'), <><Text style={[pv.v, { fontSize: 20, letterSpacing: -0.4 }]}>{rm(incomeAfter || 0)}</Text><Prov p="calc" /></>, true)}
        </View>
      )}
      <View testID="pv-actual-cost-card" style={[x.card, { marginTop: 12 }]}>
        <Text style={{ fontFamily: G.s, fontSize: 13, color: T7.text, marginBottom: 6 }}>{t('pv_actual_cost')}</Text>
        <NumInput value={cost} onNum={value => { costRef.current = value; setCost(value); }} decimal accessibilityLabel={t('pv_actual_cost')} style={pv.inp} />
        {savedCost != null ? <View style={{ alignItems: 'flex-start', marginTop: 8 }}><Prov p="user" /></View> : null}
        <View style={{ marginTop: 14 }}>
          <BtnDeep label={S.homeownershipSync === 'saving' ? t('saving') : t('pv_save_month')} onPress={() => { void save(); }} />
        </View>
      </View>
      {position != null ? (
        <View style={[x.cardx, { marginTop: 12 }]}>
          <Text style={x.k}>{position < 0 ? t('pv_shortby') : t('pv_left')}</Text>
          <Text style={[pv.big, { color: position < 0 ? T7.bad : T7.text }]}>{position < 0 ? `−${rm(Math.abs(position))}` : rm(position)}</Text>
          <View style={{ alignItems: 'flex-start', marginTop: 4 }}><Prov p="calc" /></View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/* v7 look for Epic 7's Earlier test vs what happened: the historical stress test
   and the completed months since buying, side by side and kept distinct. */
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
  const completedSince = S.purchaseMonth ? completedMonthsSincePurchase(S.purchaseMonth, new Date()) : rows.length;
  const testedMonths = new Set((result?.months || []).map(row => (
    `${row.year}-${String(row.month).padStart(2, '0')}`
  )));
  const outsideEarlierHistory = result
    ? rows.filter(row => !testedMonths.has(row.month)).length
    : 0;
  /* The earlier test reads every recorded month, so months after a purchase
     month moved earlier can sit inside it; say how many. */
  const earlierAfterPurchase = S.purchaseMonth ? testedMonthsAfterPurchase([...testedMonths], S.purchaseMonth) : 0;
  React.useEffect(() => { void refreshHomeownership().catch(() => undefined); }, [refreshHomeownership]);
  const note = (txt: string) => <View style={[x.cardx, { marginTop: 10, paddingVertical: 12 }]}><Text style={x.tiny}>{txt}</Text></View>;
  return (
    <ScreenShell tint={T7.bg} noScene header={<Hdr7 title={t('pv_then')} />} contentStyle={PAGE}>
      <Text style={[x.tiny, { fontSize: 13.5, lineHeight: 20, marginTop: 4, marginHorizontal: 2 }]}>{t('pv_compare_intro')}</Text>
      <GuideTarget id="pv.cards" style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <View style={[pv.side, { backgroundColor: T7.surface2 }]}>
          <Text style={pv.sideK}>{t('pv_earlier_full')}</Text>
          {n > 0 ? (
            <>
              <Text style={pv.sideB}>{t('pv_short_of', { s, n })}</Text>
              <Text style={pv.sideS}>{t('pv_earlier_result')}</Text>
              <Text style={pv.sideE}>{t('pv_earlier_note')}</Text>
              <Prov p="calc" />
            </>
          ) : (
            <>
              <Text style={pv.sideS}>{t('pv_no_earlier_t')}</Text>
              <Text style={pv.sideE}>{t('pv_no_earlier_b')}</Text>
            </>
          )}
        </View>
        <View style={[pv.side, { backgroundColor: T7.accentSoft }]}>
          <Text style={pv.sideK}>{t('pv_actual_full')}</Text>
          {rows.length > 0 ? (
            <>
              <Text style={pv.sideB}>{t('pv_short_of', { s: shortCount, n: rows.length })}</Text>
              <Text style={pv.sideS}>{t('pv_actual_result')}</Text>
              <Text style={pv.sideE}>{t('pv_recorded_of', { r: rows.length, n: completedSince })}</Text>
              <Prov p="user" />
            </>
          ) : (
            <>
              <Text style={pv.sideS}>{t('pv_compare_empty_t')}</Text>
              {currentIsPostPurchase ? (
                <Text style={pv.sideE}>{t('pv_current_progress', { m: monthLabel(current, monthName) })}</Text>
              ) : <Text style={pv.sideE}>{t('pv_compare_empty_b')}</Text>}
            </>
          )}
        </View>
      </GuideTarget>
      {earlierAfterPurchase > 0 ? note(t('pv_earlier_after_n', { n: earlierAfterPurchase })) : null}
      <UnrecordedMonths />
      {!result ? <Btn2 label={t('hh_test')} onPress={() => go('house')} /> : null}
      {rows.length === 0 ? (
        <View style={{ marginTop: 16 }}><BtnDeep label={t('pv_record_month')} onPress={() => go('pv_month')} /></View>
      ) : (
        <>
          <Sec title={t('pv_month_details')} />
          <GuideTarget id="pv.months" style={[x.card, { paddingVertical: 4 }]}>
            {rows.map((row, i) => (
              <View key={row.month} style={[{ paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: T7.line }]}>
                <Text style={{ fontFamily: G.s, fontSize: 15, color: T7.text, marginBottom: 4 }}>{monthLabel(row.month, monthName)}</Text>
                {[
                  [t('pv_income_after'), row.income_after_work_costs == null ? '—' : rm(Number(row.income_after_work_costs))],
                  [t('pv_actual_cost'), rm(Number(row.actual_home_costs))],
                  [row.short ? t('pv_shortby') : t('pv_left'), row.cash_position == null ? '—' : rm(Math.abs(Number(row.cash_position)))],
                ].map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Text style={{ fontFamily: G.r, fontSize: 13.5, color: T7.text2 }}>{k}</Text>
                    <Text style={{ fontFamily: G.s, fontSize: 13.5, color: T7.text }}>{v}</Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ paddingBottom: 10 }}><Prov p="user" /></View>
          </GuideTarget>
          {note(t('pv_complete_only'))}
          {outsideEarlierHistory > 0 ? note(t('pv_then_why_n', { n: outsideEarlierHistory })) : null}
          <Btn2 label={t('pv_record_another')} onPress={() => go('pv_month')} />
        </>
      )}
    </ScreenShell>
  );
}

const pv = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: T7.line2, borderRadius: 999, paddingHorizontal: 13, height: 36, justifyContent: 'center', backgroundColor: T7.surface },
  chipOn: { borderColor: T7.accent, backgroundColor: T7.accentSoft },
  kv: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T7.line },
  v: { fontFamily: G.s, fontSize: 15, color: T7.text, fontVariant: ['tabular-nums'] },
  inp: { borderWidth: 1, borderColor: T7.line2, borderRadius: 12, padding: 12, fontFamily: G.s, fontSize: 15, color: T7.text, backgroundColor: T7.surface },
  big: { fontFamily: G.s, fontSize: 36, lineHeight: 40, letterSpacing: -1.08, marginTop: 4, fontVariant: ['tabular-nums'] },
  side: { flex: 1, borderRadius: 16, padding: 14, gap: 2 },
  sideK: { fontFamily: G.s, fontSize: 11, letterSpacing: 0.66, color: T7.text2 },
  sideB: { fontFamily: G.s, fontSize: 26, lineHeight: 32, letterSpacing: -0.52, color: T7.text, marginTop: 4 },
  sideS: { fontFamily: G.r, fontSize: 13, lineHeight: 18, color: T7.text },
  sideE: { fontFamily: G.r, fontSize: 11.5, lineHeight: 16, color: T7.text2, minHeight: 15, marginBottom: 4 },
});
