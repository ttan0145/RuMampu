import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../state';
import {
  EXP_FULL_DAYS, expByMonth, expCatTotals, latestExpMonth, monthsAgg, nf, rm, rmx,
} from '../calc';
import {
  Badge, BodyS, Btn, BtnLine, BtnQuiet, Card, Chip, Chips, Display, Fig, FromR,
  IcLab, KV, NoteC, NumInput, P, Prov, StackS, TextField,
} from '../ui';
import { C, DISP_FONT } from '../theme';
import { HBar, Shimmer } from '../charts';
import { ScreenShell } from './shell';
import { isValidIsoDate } from '../validation';

function useCatLabel() {
  const { S, t } = useApp();
  return (id: string) => {
    const c = S.data.expenseCats.find(x => x.id === id);
    return c ? (c.custom ? c.name || '' : t(c.k || '')) : id;
  };
}

export function ExpensesScreen() {
  const { S, t, monthName, go, up } = useApp();
  const cats = useCatLabel();
  const ex = [...S.data.expenses].sort((a, b) => (a.d < b.d ? 1 : -1));
  const curKey = ex.length ? (+ex[0].d.slice(0, 4)) * 12 + (+ex[0].d.slice(5, 7) - 1) : 0;
  const cur = expByMonth(S.data).get(curKey) || { total: 0, days: new Set<string>() };
  const curName = ex.length ? monthName(curKey % 12) : '';
  const currentEntries = ex.filter(entry => (
    (+entry.d.slice(0, 4)) * 12 + (+entry.d.slice(5, 7) - 1)
  ) === curKey);

  let bycat: React.ReactNode = null;
  if (S.exCatOpen) {
    const totals = expCatTotals(S.data, curKey);
    bycat = (
      <Card gap={8}>
        {[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
          <KV key={c} k={cats(c)}><Fig value={rm(v)} p="calc" cls="body-s" /></KV>
        ))}
      </Card>
    );
  }

  return (
    <ScreenShell back title={t('money_expenses')}>
      {S.expenseSync === 'loading' ? <NoteC><BodyS>{t('ex_sync_loading')}</BodyS></NoteC> : null}
      {S.expenseSync === 'error' ? <NoteC><BodyS>{t('ex_sync_error')}</BodyS></NoteC> : null}
      <View>
        <Fig value={rm(cur.total)} p="user" cls="h-xl" />
        <BodyS muted>{ex.length
          ? `${t('ex_sofar', { m: curName })} · ${t(cur.days.size === 1 ? 'ex_days_one' : 'ex_days', { d: cur.days.size })}`
          : t('ex_empty')}</BodyS>
      </View>
      <Btn label={t('ex_add')} onPress={() => go('expadd')} />
      <BtnQuiet onPress={() => go('expscan')}>
        <IcLab name="camera">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <P>{t('ex_scan')}</P>
            <Badge label={t('ex_preview')} />
          </View>
        </IcLab>
      </BtnQuiet>
      <StackS>
        {currentEntries.map((e, i) => {
          const dd = (+e.d.slice(8, 10)) + ' ' + monthName(+e.d.slice(5, 7) - 1);
          return (
            <KV key={i} k={`${dd} · ${cats(e.c)}`}>
              <Fig value={rmx(e.a)} p="user" cls="body-s" />
            </KV>
          );
        })}
      </StackS>
      <BtnLine label={t('ex_bycat')} onPress={() => up(s => { s.exCatOpen = !s.exCatOpen; })} />
      {bycat}
      <BtnQuiet onPress={() => go('expmonths')}><IcLab name="calsum"><P>{t('ex_monthly')}</P></IcLab></BtnQuiet>
      <BtnQuiet onPress={() => go('exlimits')}><IcLab name="gauge"><P>{t('ex_limits')}</P></IcLab></BtnQuiet>
      <BodyS muted>{t('ex_rule')}</BodyS>
    </ScreenShell>
  );
}

export function ExpMonthsScreen() {
  const { S, t, monthName, up } = useApp();
  const cats = useCatLabel();
  const em = [...expByMonth(S.data).entries()];
  const asc = [...em].sort((a, b) => a[0] - b[0]);
  const max = Math.max(...em.map(([, v]) => v.total), 1);
  const incomeKeys = new Set(monthsAgg(S.data).map(r => r.y * 12 + r.m));

  const chart = (
    <View style={{ paddingTop: 8, paddingRight: 6, paddingBottom: 4, paddingLeft: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, height: 96 }}>
        {asc.map(([k, v]) => {
          const h = Math.max(6, v.total / max * 100);
          const full = v.days.size >= EXP_FULL_DAYS;
          return (
            <View key={k} style={{ flex: 1, maxWidth: 48, height: '100%', justifyContent: 'flex-end' }}>
              <View style={full
                ? { height: `${h}%`, backgroundColor: C.ink, borderTopLeftRadius: 3, borderTopRightRadius: 3 }
                : { height: `${h}%`, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.caution, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
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
    const full = v.days.size >= EXP_FULL_DAYS;
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
          {full ? (
            <BodyS muted>{t('ex_full') + (incomeKeys.has(k) ? ' · ' + t('ex_used') : '')}</BodyS>
          ) : (
            <FromR label={t(v.days.size === 1 ? 'ex_partial_one' : 'ex_partial', { d: v.days.size })} />
          )}
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
      <BodyS muted>{t('ex_rule')}</BodyS>
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
        s.expDraft = { a: '', c: s.expDraft.c, d: dd };
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
          <TextField value={d.a} keyboardType="numbers-and-punctuation"
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
          <TextField value={d.d} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD"
            onChangeText={v => { setError(null); up(s => { s.expDraft.d = v; }); }} />
        </View>
        {error ? <BodyS>{t(`ex_${error === 'amount' ? 'amount_positive' : error === 'date' ? 'date_invalid' : 'save_failed'}`)}</BodyS> : null}
        <Btn label={saving ? t('ex_saving') : t('ex_add')} onPress={() => { void save(); }} />
      </Card>
    </ScreenShell>
  );
}

export function ExpScanScreen() {
  const { S, t, up, toast, monthName, saveExpenseEntry } = useApp();
  const st = S.scan.stage;
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<'amount' | 'date' | 'save' | 'image' | null>(null);

  /* The mock read step: after 1.4s the "OCR" resolves to a sample receipt. */
  React.useEffect(() => {
    if (S.route !== 'expscan' || st !== 'read') return;
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
        };
      });
    }, 1400);
    return () => clearTimeout(timer);
  }, [S.route, st, up]);

  const pickPhoto = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (!res.canceled && res.assets.length) {
        const uri = res.assets[0].uri;
        up(s => { s.scan = { stage: 'read', thumb: uri }; });
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
    body = (
      <>
        <BodyS>{t('ex_check')}</BodyS>
        {S.scan.thumb ? (
          <Image source={{ uri: S.scan.thumb }} style={{ maxWidth: '100%', height: 140, borderRadius: 12, resizeMode: 'cover' }} />
        ) : null}
        <Card gap={8}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('ex_merchant')}</BodyS><FromR label={t('ex_fromr')} />
            </View>
            <TextField value={v.m} onChangeText={x => up(s => { s.scan.vals!.m = x; })} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('inc_date')}</BodyS><FromR label={t('ex_fromr')} />
            </View>
            <TextField value={v.d} keyboardType="numbers-and-punctuation"
              onChangeText={x => up(s => { s.scan.vals!.d = x; })} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BodyS muted>{t('ex_total')}</BodyS><FromR label={t('ex_fromr')} />
            </View>
            <NumInput decimal value={+v.a || 0} onNum={n => up(s => { s.scan.vals!.a = n; })} />
          </View>
          <View style={{ gap: 6 }}>
            <BodyS muted>{t('ex_cat')}</BodyS>
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
