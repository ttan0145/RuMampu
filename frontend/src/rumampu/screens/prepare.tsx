import React from 'react';
import { Text, View } from 'react-native';
import { getHousingTestResult } from '../../../services/housingSession';
import { useApp } from '../state';
import { nf, rm } from '../calc';
import { useHousingCalculation } from '../useHousingCalculation';
import {
  Badge, BodyS, Btn, BtnLine, BtnQuiet, Card, Display, Divider, EditList,
  Fig, FigRow, IcLab, KV, NoteC, P, Prov,
} from '../ui';
import { C } from '../theme';
import { Waterline } from '../charts';
import { ScreenShell } from './shell';

export function PrepareScreen() {
  const { t, go } = useApp();
  return (
    <ScreenShell title={t('tab_prepare')}>
      <NoteC>
        <View style={{ gap: 3, alignItems: 'flex-start' }}>
          <Badge label={t('pr_coming')} />
          <BodyS muted>{t('pr_coming_note')}</BodyS>
        </View>
      </NoteC>
      {/*
      <BtnQuiet onPress={() => go('upfront')}><IcLab name="wallet"><P>{t('pr_upfront')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('buffer')}><IcLab name="ring"><P>{t('pr_buffer')}</P></IcLab></BtnQuiet>
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
      */}
    </ScreenShell>
  );
}

export function UpfrontScreen() {
  const { S, t, up } = useApp();
  const calculation = useHousingCalculation(S.data);
  const dep = S.data.house.deposit;
  const need = calculation?.upfront_required ?? 0;
  const have = calculation?.cash_on_hand ?? 0;
  const gap = calculation?.upfront_gap ?? 0;
  const scale = Math.max(need, have, 1) * 1.12;
  const pct = (v: number) => v / scale * 100;
  return (
    <ScreenShell back title={t('pr_upfront')}>
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
      {dep === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <BodyS muted>{t('uf_dep0')}</BodyS>
          <Prov p="user" />
        </View>
      ) : (
        <KV k={t('uf_dep')}><Fig value={rm(dep)} p="user" /></KV>
      )}
      <Card gap={8}>
        <EditList list={S.data.upfront} onNum={(i, n) => up(s => { s.data.upfront[i].a = n; })} />
      </Card>
      <BodyS muted>{t('dc_src')}</BodyS>
    </ScreenShell>
  );
}

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
      <Fig value={rm(liquidity.required_amount)} p="calc" cls="h-xl" />
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
      <BodyS muted>{t('bf_basis', { a: monthName(first.m), b: monthName(last.m) })}</BodyS>
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
        <BodyS muted>{t('dc_sjkp')}</BodyS>
        {['dc_sj1', 'dc_sj2', 'dc_sj3'].map(k => <BodyS key={k}>· {t(k)}</BodyS>)}
        <FigRow p="official" />
        <BodyS muted>{t('dc_src')}</BodyS>
        <Divider />
        <BtnLine
          label={t('dc_65') + ' ' + (S.dcOpen ? '−' : '+')}
          style={{ textDecorationLine: 'none' }}
          onPress={() => up(s => { s.dcOpen = !s.dcOpen; })}
        />
        {S.dcOpen ? <BodyS muted>{t('dc_65_note')}</BodyS> : null}
      </Card>
      <BodyS>{t('dc_plain')}</BodyS>
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
