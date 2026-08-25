import React from 'react';
import { useApp } from '../state';
import {
  recSpan, rm, slowUnseen, testRows, totalHomeCost,
} from '../calc';
import { Btn, BtnLine, BodyS, Display, Fig, FigRow, KV, NoteC } from '../ui';
import { CovStrip } from '../charts';
import { ScreenShell } from './shell';

export function HomeScreen() {
  const { S, t, monthName, go, runTest } = useApp();
  const sp = recSpan(S.data);
  const n = sp ? sp.list.length : 0;

  if (!sp) {
    return (
      <ScreenShell brand>
        <Display cls="h-l">{t('inc_empty')}</Display>
        <Btn label={t('inc_add')} onPress={() => go('income')} />
      </ScreenShell>
    );
  }

  const covMonths = new Map(sp.list.map(r => [r.m, r]));

  if (!S.testRan) {
    return (
      <ScreenShell brand>
        <Display cls="h-xl">{t(n === 1 ? 'home_rec_one' : 'home_rec', { n })}</Display>
        <FigRow p="user" />
        <CovStrip months={covMonths} monthName={monthName} unknownLabel={t('unknown')} />
        <BodyS muted>{t('covspan', { a: monthName(sp.from.m), b: monthName(sp.to.m) })}</BodyS>
        {n < 4 ? <NoteC><BodyS>{t(n === 1 ? 'home_rec_thin_one' : 'home_rec_thin', { n })}</BodyS></NoteC> : null}
        <Btn label={t('home_test')} onPress={() => go('house')} />
      </ScreenShell>
    );
  }

  const cost = totalHomeCost(S.data);
  const rows = testRows(S.data, cost);
  const s = rows.filter(r => r.short).length;
  const g = Math.max(...rows.map(r => r.gap), 0);
  const un = slowUnseen(S.data, S.coverage);

  return (
    <ScreenShell brand>
      <Display cls="h-xl">{s ? t('headline', { s, n }) : t('headline_zero', { n })}</Display>
      <FigRow p="calc" />
      {s ? <KV k={t('gap_lbl')}><Fig value={rm(g)} p="calc" /></KV> : null}
      <CovStrip months={covMonths} monthName={monthName} unknownLabel={t('unknown')} />
      <BodyS muted>{t('covspan', { a: monthName(sp.from.m), b: monthName(sp.to.m) })}</BodyS>
      {un.length ? (
        <NoteC><BodyS>{t('cov_missed', { m: un.map(monthName).join(', ') })}</BodyS></NoteC>
      ) : S.coverage.answer === null ? (
        <BtnLine label={t('cov_unchecked') + ' →'} onPress={() => go('coverage')} />
      ) : null}
      <Btn label={t('home_retest')} onPress={runTest} />
    </ScreenShell>
  );
}
