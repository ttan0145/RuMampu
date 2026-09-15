import React from 'react';
import {
  Animated, Easing, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { TAB_OF, Tab, useApp } from './state';
import { STRINGS, Lang } from './strings';
import { actualMonths, commitFor, commitSwap, monthKeysOf, monthsAgg, pickMonth, rm } from './calc';
import { PLAN_HORIZONS, monthlySaveCapacity, planHorizonEffective, planResolveTarget } from './plan';
import { getHousingTestResult } from '../../services/housingSession';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT } from './theme';
import { Btn, BtnLine, BodyS, EditList, NumInput, PROV_G } from './ui';
import { Ico, Logo } from './svgs';
import { Ruma } from './ruma-view';
import { PEEK_W, peekArt } from './ruma-peek';
import { IsoHouse, IsoIsland } from './isosvg';
import { ISO_TIERS, villagePlay } from './village';
import { logIt } from './log';
import { DatePickerField } from './date-picker';
import { isValidMoneyText } from './validation';
import { deleteSavedHousingTest, updateSavedHousingTest } from '../../services/housingService';

/* ---------- bottom sheets ---------- */

export function SheetFrame({ children, onClose, scroll = false, pose }: {
  children: React.ReactNode; onClose: () => void; scroll?: boolean; pose?: string;
}) {
  const insets = useSafeAreaInsets();
  /* v24 peekWrap: Ruma's flat peek body sits behind the sheet's top edge at the
     right, and the mitts layer over it (mascot handover s4). */
  const w = PEEK_W;
  const hh = w * 110 / 144;
  const below = hh * 18 / 110 + 1;
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={{ flex: 1, backgroundColor: 'rgba(60,81,82,0.45)' }} />
        </Pressable>
        <View style={Platform.OS === 'web' ? { width: '100%', maxWidth: 390, alignSelf: 'center' } : { width: '100%' }}>
          {pose ? (
            <View style={{ alignItems: 'flex-end', paddingRight: 20, marginBottom: -below, zIndex: 1 }} pointerEvents="none">
              <SvgXml xml={peekArt(pose, 'body', w)} width={w} height={hh} />
            </View>
          ) : null}
          <View style={[
            sheetSt.sheet,
            { paddingBottom: 20 + insets.bottom, zIndex: 2 },
            scroll && { maxHeight: '92%' },
          ]}>
            {children}
          </View>
          {pose ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 20, zIndex: 3 }}>
              <SvgXml xml={peekArt(pose, 'mitts', w)} width={w} height={hh} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/* peekSheet — title row with a close ✕, the body, then Done unless the caller
   brings its own footer. */
function PeekSheet({ pose, title, body, onClose, doneLabel }: {
  pose: string; title: string; body: string; onClose: () => void; doneLabel: string;
}) {
  return (
    <SheetFrame pose={pose} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SheetH3 noMargin>{title}</SheetH3>
        <Pressable onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}>
          <Text style={{ fontSize: 18, color: C.ink }}>✕</Text>
        </Pressable>
      </View>
      <BodyS style={{ marginTop: 4 }}>{body}</BodyS>
      <View style={{ marginTop: 16 }}>
        <Btn label={doneLabel} onPress={onClose} />
      </View>
    </SheetFrame>
  );
}

function Opt({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[sheetSt.opt, on && { backgroundColor: C.card }]}>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 17, color: C.ink, fontWeight: on ? '600' : '400' }}>{label}</Text>
      {on ? <Text style={{ fontSize: 17, color: C.brand }}>✓</Text> : null}
    </Pressable>
  );
}

function SheetH3({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <Text style={{ fontFamily: DISP_FONT, fontSize: 19, color: C.ink, marginBottom: noMargin ? 0 : 12 }}>{children}</Text>;
}

function SheetInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={{
        minHeight: 48, backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
        paddingHorizontal: 14, fontSize: 17, color: C.ink,
      }}
      placeholderTextColor={C.ink40}
    />
  );
}

function monthValue(key: number): string {
  const year = Math.floor(key / 12);
  const month = key % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function suggestedPastMonth(dates: string[]): string {
  const now = new Date();
  const currentKey = now.getFullYear() * 12 + now.getMonth();
  const earliest = dates.reduce((result, value) => {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
    if (!match) return result;
    const key = Number(match[1]) * 12 + Number(match[2]) - 1;
    return Math.min(result, key);
  }, currentKey);
  return monthValue(Math.min(currentKey, earliest) - 1);
}

function isValidPastMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  return year * 12 + month - 1 < now.getFullYear() * 12 + now.getMonth();
}

/* ---------- the quick (+) speed-dial ---------- */

const QK_IN_ICO = 'banknote';
const QK_OUT_ICO = 'receipt';

function QuickMenu() {
  const { S, t, up, go } = useApp();
  const insets = useSafeAreaInsets();
  if (S.sheet !== 'quick' && S.sheet !== 'quick2') return null;
  const close = () => up(s => { s.sheet = null; });

  const spGo = (kind: 'in' | 'out') => {
    up(s => {
      s.sheet = null;
      if (kind === 'in') { s.incMode = 'scan'; s.incScan = { stage: 'pick', rows: [] }; s.scanAuto = true; }
      else { s.exMode = 'scan'; s.scan = { stage: 'pick' }; s.scanAuto = true; }
    });
    /* Both land on their tabbed entry screen with the Scan tab selected. */
    go(kind === 'in' ? 'income' : 'expenses');
  };

  const item = (label: string, icon: React.ReactNode, onPress: () => void, delay: number) => (
    <QItem key={label} label={label} icon={icon} onPress={onPress} delay={delay} />
  );

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 44 }]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <View style={{ flex: 1, backgroundColor: 'rgba(60,81,82,0.45)' }} />
      </Pressable>
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 96 + insets.bottom,
        alignItems: 'center', gap: 10,
      }}>
        {S.sheet === 'quick2' ? [
          item(t('qk_income'), <QIo dir="in" />, () => spGo('in'), 100),
          item(t('qk_expense'), <QIo dir="out" />, () => spGo('out'), 50),
        ] : [
          item(t('qk_income'), <Ico name={QK_IN_ICO} size={22} />, () => {
            up(s => { s.sheet = null; s.incMode = 'type'; });
            go('income');
          }, 100),
          item(t('qk_expense'), <Ico name={QK_OUT_ICO} size={22} />, () => {
            up(s => { s.sheet = null; s.exMode = 'type'; });
            go('expenses');
          }, 50),
          item(t('qk_scan'), <Ico name="camera" size={22} />, () => up(s => { s.sheet = 'quick2'; }), 0),
        ]}
      </View>
    </View>
  );
}

function QIo({ dir }: { dir: 'in' | 'out' }) {
  return (
    <View style={{
      width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      backgroundColor: dir === 'in' ? '#E4EFEC' : '#FBE6DA',
    }}>
      <Text style={{ fontWeight: '700', fontSize: 14, color: dir === 'in' ? '#2E6B6F' : '#B54F2B' }}>
        {dir === 'in' ? '↑' : '↓'}
      </Text>
    </View>
  );
}

function QItem({ label, icon, onPress, delay }: { label: string; icon: React.ReactNode; onPress: () => void; delay: number }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 250, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [anim, delay]);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
    }}>
      <Pressable onPress={onPress} style={sheetSt.qitem}>
        {icon}
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- the saving village sheet ---------- */

function VillageFlash() {
  const { t, up } = useApp();
  React.useEffect(() => {
    const timer = setTimeout(() => up(s => { if (s.sheet === 'vflash') s.sheet = 'village'; }), 1100);
    return () => clearTimeout(timer);
  }, [up]);
  return (
    <Modal transparent animationType="none" visible onRequestClose={() => up(s => { s.sheet = 'village'; })}>
      <Pressable style={{ flex: 1, backgroundColor: '#255A5E', alignItems: 'center', justifyContent: 'center', padding: 40 }}
        onPress={() => up(s => { s.sheet = 'village'; })}>
        <Text style={{
          fontFamily: DISP_FONT, fontSize: 40, lineHeight: 46, letterSpacing: 1.6, color: '#fff',
          textTransform: 'uppercase', textAlign: 'center',
        }}>{t('vl_start')}</Text>
      </Pressable>
    </Modal>
  );
}

function VStat({ label, value, hi, gain }: { label: string; value: number; hi?: boolean; gain?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: hi ? C.brand : C.ink, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center' }}>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: DISP_FONT, fontSize: 18, lineHeight: 22, color: '#fff', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {gain ? (
        <Text style={{ position: 'absolute', right: 8, top: -4, fontFamily: DISP_FONT, fontSize: 14, color: '#2E9E4E' }}>+{gain}</Text>
      ) : null}
    </View>
  );
}

function VillageSheet() {
  const { S, t, up } = useApp();
  const { width } = useWindowDimensions();
  const v = S.village || {
    cells: new Array(16).fill(0), pop: [], score: 0, best: 0, moves: 0, gain: 0, built: 0,
    collection: 0, queued: 0, savedRm: 0, msg: '',
  };
  const close = () => up(s => { s.sheet = null; });
  const play = (dir: 'l' | 'r' | 'u' | 'd') => up(s => { villagePlay(s, dir, tier => t('vl_built', { t: t('vl_t' + tier) })); });

  const pan = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.max(Math.abs(g.dx), Math.abs(g.dy)) > 18,
    onPanResponderRelease: (_e, g) => {
      if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) < 24) return;
      const dir = Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 'r' : 'l') : (g.dy > 0 ? 'd' : 'u');
      play(dir);
    },
  })).current;

  const n = v.cells.filter(Boolean).length;
  const best = Math.max(0, ...v.cells);
  let stats = `${t('vl_builtn', { b: v.built })} · ${t('vl_onplot', { n })}${best ? ' · ' + t('vl_best', { t: t('vl_t' + best) }) : ''}`;
  /* Epic 10 anchoring: the collection with its truthful ringgit total (the
     istanas are decorative — the RM figure is the honest signal), plus any
     houses waiting for space so a saved day never looks lost. */
  if ((v.collection ?? 0) > 0) stats += `\n${t('vl_collect', { n: v.collection, a: rm(v.savedRm ?? 0) })}`;
  if ((v.queued ?? 0) > 0) stats += `\n${t('vl_queue', { n: v.queued })}`;
  const isleW = Math.min(width, 390) - 60;

  return (
    <SheetFrame pose="curious" onClose={close} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <SheetH3 noMargin>{t('vl_title')}</SheetH3>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <BodyS muted>{t('vl_short')}</BodyS>
            <Pressable onPress={() => up(s => { s.vHelp = !s.vHelp; })} style={[sheetSt.vinfo, S.vHelp && { backgroundColor: C.ink, borderColor: C.ink }]}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 11, color: S.vHelp ? '#fff' : C.ink64 }}>i</Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={close} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10, marginTop: -8 }}>
          <Text style={{ fontSize: 18, color: C.ink }}>✕</Text>
        </Pressable>
      </View>
      {S.vHelp ? (
        <View style={sheetSt.vhelp}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.ink }}>{t('vl_how')}</Text>
          {[1, 2, 3, 4, 5].map(i => (
            <BodyS key={i} style={{ marginTop: 3 }}>{i}. {t('vl_s' + i)}</BodyS>
          ))}
          {/* LeanKit 10.8.2: what the village is, and what the app cannot know. */}
          <BodyS muted style={{ marginTop: 6 }}>{t('sv_not_advice')}</BodyS>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <VStat label={t('vl_score')} value={v.score} gain={v.gain || undefined} />
        <VStat label={t('vl_bestscore')} value={v.best} hi />
        <VStat label={t('vl_moves')} value={v.moves} />
      </View>
      <View {...pan.panHandlers} style={sheetSt.vscene}>
        <View style={{ position: 'absolute', right: 18, top: 10 }}>
          <SvgXml xml={'<svg viewBox="0 0 40 40" width="34" height="34" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="11" fill="#FEC844"/></svg>'} width={34} height={34} />
        </View>
        <View style={{ position: 'absolute', left: 14, top: 12, opacity: 0.95 }}>
          <SvgXml xml={'<svg viewBox="0 0 64 32" width="70" height="35" fill="#fff" xmlns="http://www.w3.org/2000/svg"><ellipse cx="18" cy="22" rx="14" ry="9"/><ellipse cx="34" cy="16" rx="16" ry="12"/><ellipse cx="49" cy="22" rx="12" ry="8"/></svg>'} width={70} height={35} />
        </View>
        <View style={{ position: 'absolute', left: 16, bottom: 18, zIndex: 2 }}>
          <Ruma w={64} pose="happy" float={false} />
        </View>
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <IsoIsland cells={v.cells} width={isleW} />
        </View>
      </View>
      <BodyS muted style={{ textAlign: 'center', marginTop: 4, fontSize: 11.5 }}>{t('vl_swipe')}</BodyS>
      <Text style={{
        fontFamily: DISP_FONT, minHeight: 18, textAlign: 'center', color: C.confirm,
        fontSize: 13, marginTop: 6,
      }}>{v.msg || ''}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        {([['l', '←'], ['u', '↑'], ['d', '↓'], ['r', '→']] as const).map(([d, a]) => (
          <Pressable key={d} onPress={() => play(d)} style={sheetSt.varrow}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <BodyS muted style={{ marginTop: 8 }}>{stats}</BodyS>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {ISO_TIERS.map((id, i) => (
          <View key={id} style={{ flex: 1, alignItems: 'center' }}>
            <IsoHouse tier={id} size={42} />
            <Text style={{ fontFamily: DISP_FONT, fontSize: 10.5, color: C.ink }}>{t('vl_t' + (i + 1))}</Text>
            {/* 2^tier, matching villageMove's merge scoring. */}
            <Text style={{ fontFamily: BODY_FONT, fontSize: 10.5, color: C.ink64 }}>{Math.pow(2, i)} pt</Text>
          </View>
        ))}
      </View>
    </SheetFrame>
  );
}

/* ---------- sheet host ---------- */

export function SheetHost() {
  const {
    S, t, up, monthName, saveIncomeEntry, updateIncomeEntry, deleteIncomeEntry, saveIncomeSource,
    saveWorkCostCategory, saveExpenseCategory, saveExpenseEntry, refreshSavedHousingTests, toast, enterGuestMode,
  } = useApp();
  const sheet = S.sheet;
  const close = () => up(s => { s.sheet = null; });

  const [ownName, setOwnName] = React.useState('');
  const [pastM, setPastM] = React.useState<string | null>(null);
  const [pastA, setPastA] = React.useState('');
  const [pastError, setPastError] = React.useState<'invalid' | 'exists' | 'amount' | 'cash' | null>(null);
  const [editAmount, setEditAmount] = React.useState('');
  const [editDate, setEditDate] = React.useState('');
  const [editSource, setEditSource] = React.useState('');
  const [editError, setEditError] = React.useState<'amount' | 'date' | 'source' | null>(null);
  /* v24 dc_*: a changed business date is confirmed before it is saved. */
  const [dateConfirm, setDateConfirm] = React.useState<{ f: string; g: string; orig: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [limitA, setLimitA] = React.useState('');
  const [svName, setSvName] = React.useState('');
  const [svPay, setSvPay] = React.useState('');
  React.useEffect(() => {
    setOwnName('');
    setPastError(null);
    const editId = sheet?.startsWith('pastmonth:') ? sheet.slice('pastmonth:'.length) : null;
    const existing = editId ? S.data.income.find(entry => entry.id === editId && entry.method === 'historical_total') : null;
    setPastM(existing ? existing.d.slice(0, 7) : null);
    setPastA(existing ? String(existing.a) : '');
    const itemEditId = sheet?.startsWith('incomeedit:') ? sheet.slice('incomeedit:'.length) : null;
    const itemEntry = itemEditId ? S.data.income.find(entry => (
      entry.id === itemEditId && (entry.method === 'manual' || entry.method === 'import')
    )) : null;
    setEditAmount(itemEntry ? String(itemEntry.a) : '');
    setEditDate(itemEntry ? itemEntry.d : '');
    setEditSource(itemEntry ? itemEntry.s : '');
    setEditError(null);
    if (sheet === 'exlimit') setLimitA(S.data.expenseLimits.total ? String(S.data.expenseLimits.total) : '');
    if (sheet === 'savename') setSvName(S.svDraft || '');
    if (sheet === 'svedit') {
      const k = S.keptTests[S.svIdx];
      setSvName(k?.name || '');
      setSvPay(k ? String(k.pay) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  if (!sheet || sheet === 'shockcustom') return null;

  // EN: US8.3 language selection lives in this sheet. It presents the supported
  // languages and writes the selected language back to current app state.
  // 中文：US8.3 的语言选择在这个底部弹层中完成。它展示支持的语言，并把选择写回当前应用状态。
  if (sheet === 'lang') {
    return (
      <SheetFrame pose="curious" onClose={close}>
        <SheetH3>{t('lang_pick')}</SheetH3>
        {(['en', 'ms', 'zh'] as Lang[]).map(l => (
          <Opt key={l} label={STRINGS[l].langname} on={S.lang === l}
            onPress={() => up(s => { s.lang = l; s.sheet = null; })} />
        ))}
      </SheetFrame>
    );
  }

  /* v24 blswap: the working behind a fully recorded month, from the total's (i). */
  if (sheet === 'blswap') {
    const catNm = (id: string) => {
      const x = S.data.expenseCats.find(z => z.id === id);
      return x ? (x.custom ? x.name || '' : t(x.k || '')) : id;
    };
    const months = actualMonths(S.data)
      .map(r => ({ r, sw: commitSwap(S.data, r.y * 12 + r.m) }))
      .filter(({ sw }) => sw != null);
    return (
      <SheetFrame pose="counting" onClose={close}>
            <SheetH3>{t('cm_total')}</SheetH3>
            <View style={{ gap: 8, marginTop: 6 }}>
              {months.map(({ r, sw }) => {
                const k = r.y * 12 + r.m;
                return (
                  <View key={k} style={{ gap: 8 }}>
                    <BodyS>{t('ex_feeds', { m: monthName(r.m) })}</BodyS>
                    {sw!.lines.map(l => (
                      <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <View style={{ flexShrink: 1 }}>
                          <BodyS>{l.custom ? l.name || '' : t(l.k || '')}</BodyS>
                          <BodyS muted style={{ fontSize: 11.5 }}>{t('cm_wasest', { a: rm(l.est) })}</BodyS>
                        </View>
                        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(l.spent)}</Text>
                      </View>
                    ))}
                    {sw!.loose > 0 ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <View style={{ flexShrink: 1 }}>
                          <BodyS>{t('cm_noline')}</BodyS>
                          <BodyS muted style={{ fontSize: 11.5 }}>{sw!.looseCats.map(catNm).join(', ')}</BodyS>
                        </View>
                        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(sw!.loose)}</Text>
                      </View>
                    ) : null}
                    <View style={{ height: 1, backgroundColor: C.ink14, marginVertical: 6 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <BodyS>{t('cm_usedfor', { m: monthName(r.m) })}</BodyS>
                      <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(commitFor(S.data, k))}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={{ marginTop: 14 }}>
              <Btn label={t('done')} onPress={close} />
            </View>
      </SheetFrame>
    );
  }

  /* v24 guestsure: continuing as a guest is confirmed, with what it means. */
  if (sheet === 'guestsure') {
    return (
      <SheetFrame pose="curious" onClose={close}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SheetH3 noMargin>{t('gs_title')}</SheetH3>
              <Pressable onPress={close} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}>
                <Text style={{ fontSize: 18, color: C.ink }}>✕</Text>
              </Pressable>
            </View>
            <BodyS style={{ marginTop: 8 }}>{t('gs_body')}</BodyS>
            <View style={{ marginTop: 16 }}>
              <Btn label={t('au_guest')} onPress={() => { up(s2 => { s2.sheet = null; }); void enterGuestMode().catch(() => toast(t('inc_sync_error'), 'error')); }} />
            </View>
            <Pressable onPress={close}
              style={({ pressed }) => [{ minHeight: 38, alignSelf: 'center', justifyContent: 'center', marginTop: 8 }, pressed && { opacity: 0.7 }]}>
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 14, color: C.ink, textDecorationLine: 'underline' }}>{t('gs_not')}</Text>
            </Pressable>
      </SheetFrame>
    );
  }

  /* v24 pothow: what the pot is actually made of (shield semantics: the plan's
     declared savings plus what finished months moved in). */
  if (sheet === 'pothow') {
    const planPart = S.village?.savedRm ?? 0;
    const moved = S.potMoved;
    const kvRow = (lbl: string, v: number, bold?: boolean) => (
      <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
        <Text style={{ fontFamily: bold ? DISP_FONT : BODY_FONT, fontSize: 13.5, color: C.ink }}>{lbl}</Text>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 16, color: C.ink, fontVariant: ['tabular-nums'] }}>{rm(v)}</Text>
      </View>
    );
    return (
      <SheetFrame pose="counting" onClose={close}>
            <SheetH3>{t('ph_title')}</SheetH3>
            {kvRow(t('ph_plan'), planPart)}
            {kvRow(t('ph_moved'), moved)}
            <View style={{ height: 1, backgroundColor: C.ink14, marginVertical: 6 }} />
            {kvRow(t('ph_total'), planPart + moved, true)}
            <View style={{ marginTop: 6, alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 11, color: C.ink64 }}>{PROV_G.user} {t('prov_user')}</Text>
            </View>
            <View style={{ marginTop: 14 }}>
              <Btn label={t('done')} onPress={close} />
            </View>
      </SheetFrame>
    );
  }

  /* v24 month filter sheet: which month the recent list shows. */
  if (sheet === 'incmonth' || sheet === 'exmonth') {
    const inc = sheet === 'incmonth';
    const arrs = inc ? [S.data.income] : [S.data.expenses, S.data.workCostEntries];
    const ks = monthKeysOf(arrs);
    const cur = pickMonth(inc ? S.incMonth : S.exMonth, arrs).key;
    return (
      <SheetFrame pose="counting" onClose={close}>
            <SheetH3>{t('mf_title')}</SheetH3>
            {ks.map((k, i) => (
              <Pressable key={k}
                onPress={() => up(s => { if (inc) s.incMonth = k; else s.exMonth = k; s.sheet = null; })}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  minHeight: 46, paddingHorizontal: 4,
                  borderBottomWidth: i < ks.length - 1 ? 1 : 0, borderBottomColor: C.ink14,
                }}>
                <Text style={{
                  fontFamily: k === cur ? SEMI_FONT : BODY_FONT, fontSize: 15,
                  color: k === cur ? C.brand : C.ink,
                }}>{`${monthName(k % 12)} ${Math.floor(k / 12)}`}</Text>
                {k === cur ? <Text style={{ fontSize: 15, color: C.brand }}>✓</Text> : null}
              </Pressable>
            ))}
      </SheetFrame>
    );
  }

  /* Saving plan: how many months the upfront need is spread over. Same
     dropdown-sheet pattern as the month filter. */
  if (sheet === 'plhorizon') {
    const hasRecord = monthlySaveCapacity(S) != null;
    const cur = planHorizonEffective(S);
    const options: { key: number | null; label: string }[] = [
      ...(hasRecord ? [{ key: null, label: t('pl_hz_rec') }] : []),
      ...PLAN_HORIZONS.map(n => ({ key: n, label: t('pl_hz_mo', { n }) })),
    ];
    return (
      <SheetFrame pose="counting" onClose={close}>
        <SheetH3>{t('pl_hz_t')}</SheetH3>
        {options.map((o, i) => {
          const on = o.key === cur;
          return (
            <Pressable key={String(o.key)}
              onPress={() => up(s => { s.planHorizon = o.key; planResolveTarget(s, getHousingTestResult()); s.sheet = null; })}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                minHeight: 46, paddingHorizontal: 4,
                borderBottomWidth: i < options.length - 1 ? 1 : 0, borderBottomColor: C.ink14,
              }}>
              <Text style={{ fontFamily: on ? SEMI_FONT : BODY_FONT, fontSize: 15, color: on ? C.brand : C.ink }}>{o.label}</Text>
              {on ? <Text style={{ fontSize: 15, color: C.brand }}>✓</Text> : null}
            </Pressable>
          );
        })}
      </SheetFrame>
    );
  }

  if (sheet.startsWith('prov:')) {
    const p = sheet.slice(5);
    return (
      <SheetFrame pose="curious" onClose={close}>
        <SheetH3>{PROV_G[p]} {t('prov_' + p)}</SheetH3>
        <BodyS>{t('provf_' + p)}</BodyS>
        <View style={{ marginTop: 16 }}>
          <Btn label={t('done')} onPress={close} />
        </View>
      </SheetFrame>
    );
  }

  /* v22 peek sheets — Ruma leans over the top edge. */
  if (sheet === 'plinfo') return <PeekSheet pose="steady" title={t('pl_title')} body={t('pl_note')} onClose={close} doneLabel={t('done')} />;
  if (sheet === 'potadd') return <PeekSheet pose="counting" title={t('sp_add_t')} body={t('sp_add_b')} onClose={close} doneLabel={t('done')} />;
  if (sheet === 'mailhow') return <PeekSheet pose="listening" title={t('mh_title')} body={t('mh_body')} onClose={close} doneLabel={t('done')} />;
  if (sheet === 'cardinfo' && S.cardInfo) {
    const ci = S.cardInfo;
    return (
      <SheetFrame pose="curious" onClose={close}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SheetH3 noMargin>{t(ci.t)}</SheetH3>
              <Pressable onPress={close} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}>
                <Text style={{ fontSize: 18, color: C.ink }}>✕</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8, marginTop: 6 }}>
              {ci.b.map(k => <BodyS key={k}>{t(k)}</BodyS>)}
              {(ci.x ?? []).map((line, i) => <BodyS key={'x' + i}>{line}</BodyS>)}
            </View>
            {ci.p ? (
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.ink14, gap: 5 }}>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.99, textTransform: 'uppercase', color: C.ink64 }}>
                  {t('ci_tag')}
                </Text>
                <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: C.ink }}>
                  {PROV_G[ci.p]} {t('prov_' + ci.p)}
                </Text>
                <BodyS muted>{t('provf_' + ci.p)}</BodyS>
              </View>
            ) : null}
            <View style={{ marginTop: 14 }}>
              <Btn label={t('done')} onPress={close} />
            </View>
      </SheetFrame>
    );
  }

  if (sheet === 'quick' || sheet === 'quick2') return <QuickMenu />;
  if (sheet === 'vflash') return <VillageFlash />;
  if (sheet === 'village') return <VillageSheet />;

  /* v22: name your own job during get-to-know. */
  if (sheet === 'kjobown') {
    const save = () => {
      const name = ownName.trim();
      if (!name) return;
      up(s => {
        const id = 'own' + Date.now();
        s.ownJobs.push({ id, name });
        s.jobs.push(id);
        s.sheet = null;
      });
    };
    return (
      <SheetFrame pose="pleased" onClose={close}>
        <SheetH3>{t('k_own')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('k_own_h')}</BodyS>
          <SheetInput value={ownName} onChangeText={setOwnName} />
          <Btn label={t('add')} onPress={save} />
        </View>
      </SheetFrame>
    );
  }

  /* v22: loan assumptions behind the instalment row. */
  if (sheet === 'loan') {
    const h = S.data.house;
    return (
      <SheetFrame pose="steady" onClose={close}>
        <SheetH3>{t('tx_loan_t')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('th_rate')}</BodyS>
          <NumInput decimal value={h.rate} onNum={n => up(s => { s.data.house.rate = n; })} />
          <BodyS muted>{t('th_ten')}</BodyS>
          <NumInput decimal={false} value={h.years}
            onNum={n => up(s => { s.data.house.years = Math.max(1, Math.trunc(n || 1)); })} />
          <Btn label={t('done')} onPress={close} />
        </View>
      </SheetFrame>
    );
  }

  /* v22: other monthly home costs behind the "other costs" row. */
  if (sheet === 'hcosts') {
    return (
      <SheetFrame pose="counting" onClose={close} scroll>
        <SheetH3>{t('tx_costs_t')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('tx_costs_h')}</BodyS>
          <EditList
            decimal
            list={S.data.homeCosts.map(c => ({ ...c, p: 'assume' }))}
            onNum={(i, n) => up(s => { s.data.homeCosts[i].a = n; })}
          />
          <Btn label={t('done')} onPress={close} />
        </View>
      </SheetFrame>
    );
  }

  /* v22: monthly spending limit. */
  if (sheet === 'exlimit') {
    const save = () => {
      const v = Math.max(0, parseFloat(limitA) || 0);
      up(s => { s.data.expenseLimits.total = v; s.sheet = null; });
      toast(t('ex_limit_saved'));
    };
    return (
      <SheetFrame pose="steady" onClose={close}>
        <SheetH3>{t('ex_limit_title')}</SheetH3>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink64 }}>RM</Text>
            <View style={{ flex: 1 }}>
              <SheetInput keyboardType="number-pad" inputMode="numeric" value={limitA} onChangeText={setLimitA} placeholder="1500" />
            </View>
          </View>
          <BodyS muted>{t('ex_limit_hint')}</BodyS>
          <Btn label={t('xe_save')} onPress={save} />
        </View>
      </SheetFrame>
    );
  }

  /* v22: name a kept test. */
  if (sheet === 'savename') {
    return (
      <SheetFrame pose="pleased" onClose={close}>
        <SheetH3>{t('sv_name_t')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('sv_name_l')}</BodyS>
          <SheetInput value={svName} onChangeText={setSvName} autoFocus selectTextOnFocus />
          <Btn label={t('rx_keep')} onPress={() => {
            let savedId: number | undefined;
            let name = '';
            up(s => {
              name = (svName || s.svDraft || '').trim();
              const pend = s.keptTests[s.keptTests.length - 1];
              if (pend) {
                pend.name = name || pend.name;
                savedId = pend.id;
              }
              s.sheet = null;
              s.stack = ['househome'];
              s.route = 'savedtests';
            });
            if (savedId) {
              /* Only the write can fail the save; the list is already updated
                 locally, so a slow follow-up read must not report a failure. */
              void updateSavedHousingTest(savedId, { name })
                .then(() => refreshSavedHousingTests().catch(() => undefined))
                .catch(() => toast(t('sv_name_failed'), 'error'));
            }
            toast(t('sv_kept_where'));
          }} />
        </View>
      </SheetFrame>
    );
  }

  /* v22: edit / delete a kept test. */
  if (sheet === 'svedit' && S.keptTests[S.svIdx]) {
    const k = S.keptTests[S.svIdx];
    return (
      <SheetFrame pose="steady" onClose={close}>
        <SheetH3>{t('sv_edit_t')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('sv_name_l')}</BodyS>
          <SheetInput value={svName} onChangeText={setSvName} />
          <BodyS muted>{t('sv_pay_l')}</BodyS>
          <SheetInput keyboardType="number-pad" inputMode="numeric" value={svPay} onChangeText={setSvPay} />
          <BodyS muted>
            {t('cp_short', { s: k.s, n: k.n })}{k.g ? ' · ' + t('gap_lbl') + ' ' + rm(k.g) : ''}
          </BodyS>
          <Btn label={t('done')} onPress={() => {
            let savedId: number | undefined;
            let name = '';
            let pay = 0;
            up(s => {
              const kk = s.keptTests[s.svIdx];
              if (kk) {
                name = svName.trim() || kk.name || '';
                pay = Math.max(0, Math.round(parseFloat(svPay) || kk.pay));
                kk.name = name;
                kk.pay = pay;
                savedId = kk.id;
              }
              s.sheet = null;
            });
            if (savedId) {
              void updateSavedHousingTest(savedId, { name, monthly_payment: pay })
                .then(() => refreshSavedHousingTests().catch(() => undefined))
                .catch(() => toast(t('sv_name_failed'), 'error'));
            }
          }} />
          <View style={{ alignItems: 'center' }}>
            <BtnLine
              label={S.svDelArm ? t('sv_del2') : t('sv_del')}
              style={{ color: C.short, textDecorationColor: C.short, fontSize: 13.5 }}
              onPress={() => {
                let savedId: number | undefined;
                up(s => {
                  if (!s.svDelArm) { s.svDelArm = true; return; }
                  savedId = s.keptTests[s.svIdx]?.id;
                  logIt(s, 'lg_test_del', { name: s.keptTests[s.svIdx]?.name || '' });
                  s.keptTests.splice(s.svIdx, 1);
                  s.svDelArm = false;
                  s.sheet = null;
                });
                if (savedId) {
                  void deleteSavedHousingTest(savedId)
                    .then(() => refreshSavedHousingTests().catch(() => undefined))
                    .catch(() => toast(t('sv_del_failed'), 'error'));
                }
              }}
            />
          </View>
        </View>
      </SheetFrame>
    );
  }

  if (sheet.startsWith('incomeedit:')) {
    const editId = sheet.slice('incomeedit:'.length);
    const dLbl = (v: string) => `${+v.slice(8, 10)} ${monthName(+v.slice(5, 7) - 1)}`;
    const save = async (dateConfirmed = false) => {
      if (saving) return;
      if (!isValidMoneyText(editAmount) || Number(editAmount.trim()) < 0) { setEditError('amount'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) { setEditError('date'); return; }
      if (!editSource) { setEditError('source'); return; }
      const original = S.data.income.find(e => e.id === editId)?.d;
      if (!dateConfirmed && original && original !== editDate) {
        setDateConfirm({ f: dLbl(original), g: dLbl(editDate), orig: original });
        return;
      }
      setSaving(true);
      try {
        await updateIncomeEntry(editId, {
          amount: Number(editAmount.trim()),
          date: editDate,
          sourceId: editSource,
        });
        // Editing an existing entry does not change the total entry count.
        const entryCount = S.data.income.length;
        up(state => {
          if (dateConfirm) logIt(state, 'lg_inc_date', { f: dateConfirm.f, g: dateConfirm.g });
          state.sheet = null;
        });
        setDateConfirm(null);
        toast(t('entry_saved_n', { n: entryCount }));
      } catch {
        toast(t('inc_save_failed'));
      } finally {
        setSaving(false);
      }
    };
    return (
      <SheetFrame pose="counting" onClose={close}>
        <SheetH3>{t('edit')} {t('money_income')}</SheetH3>
        {(() => {
          /* v24 ie_made: when the entry was recorded, distinct from the date
             it is for. */
          const created = S.data.income.find(e => e.id === editId)?.createdAt;
          if (!created) return null;
          const dd = new Date(created);
          if (isNaN(dd.getTime())) return null;
          return (
            <BodyS muted style={{ fontSize: 11.5, marginBottom: 6 }}>
              {t('ie_made', {
                d: `${dd.getDate()} ${monthName(dd.getMonth())}`,
                t: `${String(dd.getHours()).padStart(2, '0')}:${String(dd.getMinutes()).padStart(2, '0')}`,
              })}
            </BodyS>
          );
        })()}
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('inc_amount')}</BodyS>
          <SheetInput
            keyboardType="decimal-pad"
            inputMode="decimal"
            value={editAmount}
            onChangeText={value => { setEditAmount(value); setEditError(null); }}
          />
          <BodyS muted>{t('inc_date')}</BodyS>
          <DatePickerField
            value={editDate}
            mode="date"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date()}
            onChange={value => { setEditDate(value); setEditError(null); }}
          />
          <BodyS muted>{t('inc_source')}</BodyS>
          <View style={{ gap: 2 }}>
            {S.data.sources.map(source => (
              <Opt
                key={source.id}
                label={source.custom ? source.name || '' : t(source.k || '')}
                on={editSource === source.id}
                onPress={() => { setEditSource(source.id); setEditError(null); }}
              />
            ))}
          </View>
          {editError === 'amount' ? <BodyS>{t('inc_past_amount')}</BodyS> : null}
          {editError === 'date' ? <BodyS>{t('inc_invalid_date')}</BodyS> : null}
          {editError === 'source' ? <BodyS>{t('inc_source')}</BodyS> : null}
          {dateConfirm ? (
            <View style={{ backgroundColor: '#FFF8E5', borderRadius: 12, padding: 12, gap: 8 }}>
              <Text style={{ fontFamily: DISP_FONT, fontSize: 14, color: C.ink }}>{t('dc_title')}</Text>
              <BodyS>{t('dc_body', { f: dateConfirm.f, g: dateConfirm.g })}</BodyS>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <BtnLine label={t('dc_yes')} onPress={() => { void save(true); }} />
                <BtnLine label={t('dc_no', { f: dateConfirm.f })} onPress={() => { setEditDate(dateConfirm.orig); setDateConfirm(null); }} />
              </View>
            </View>
          ) : (
            <Btn label={saving ? t('inc_saving') : t('done')} onPress={() => { void save(); }} />
          )}
          <View style={{ alignItems: 'center' }}>
            <BtnLine label={t('ie_del')} style={{ color: C.short, textDecorationColor: C.short, fontSize: 13.5 }}
              onPress={() => {
                void deleteIncomeEntry(editId)
                  .then(() => { up(s => { s.sheet = null; }); toast(t('ie_deleted')); })
                  .catch(() => toast(t('inc_save_failed'), 'error'));
              }} />
          </View>
        </View>
      </SheetFrame>
    );
  }

  if (sheet === 'pastmonth' || sheet.startsWith('pastmonth:')) {
    const editId = sheet.startsWith('pastmonth:') ? sheet.slice('pastmonth:'.length) : null;
    /* v24: the same sheet serves expenses (S.pastT === 'ex') with a plain dated entry. */
    const forEx = !editId && S.pastT === 'ex';
    const sel = pastM ?? suggestedPastMonth(S.data.income.map(entry => entry.d));
    const save = async () => {
      if (saving) return;
      if (!isValidPastMonth(sel)) { setPastError('invalid'); return; }
      // Never let parseFloat turn a partially numeric value such as `200ggg` into 200.
      if (!isValidMoneyText(pastA)) { setPastError('cash'); return; }
      const a = Number(pastA.trim());
      if (a < 0) { setPastError('amount'); return; }
      if (forEx) {
        if (!(a > 0)) { setPastError('amount'); return; }
        setSaving(true);
        try {
          await saveExpenseEntry({ amount: a, date: sel + '-15', categoryId: S.expDraft.c || S.data.expenseCats[0]?.id || '' });
          up(s => { s.sheet = null; });
          toast(t('saved'));
        } catch {
          toast(t('ex_save_failed'));
        } finally {
          setSaving(false);
        }
        return;
      }
      if (S.data.income.some(entry => entry.id !== editId && entry.d.slice(0, 7) === sel)) {
        setPastError('exists');
        return;
      }
      setSaving(true);
      try {
        if (editId) {
          await updateIncomeEntry(editId, { amount: a, date: sel + '-15' });
        } else {
          await saveIncomeEntry({
            amount: a,
            date: sel + '-15',
            entryMethod: 'historical_total',
            confirmOutlier: true,
          });
        }
        // Count saved income entries directly. A new past-month entry adds one;
        // editing an existing past-month entry keeps the same count.
        const entryCount = S.data.income.length + (editId ? 0 : 1);

        up(s => { s.sheet = null; });
        toast(t('entry_saved_n', { n: entryCount }));
      } catch {
        toast(t('inc_save_failed'));
      } finally {
        setSaving(false);
      }
    };
    return (
      <SheetFrame pose="counting" onClose={close}>
        <SheetH3>{editId ? `${t('edit')} ${t('inc_month_total')}` : t('inc_past')}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t('inc_past_hint')}</BodyS>
          {forEx ? null : <BodyS muted>{t('inc_past_no_min')}</BodyS>}
          {forEx ? null : <BodyS muted>{t('inc_past_month')}</BodyS>}
          <DatePickerField
            value={sel}
            mode="month"
            monthNames={Array.from({ length: 12 }, (_, month) => monthName(month))}
            maximumDate={new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)}
            onChange={value => { setPastM(value); setPastError(null); }}
          />
          <BodyS muted>{t('inc_amount')}</BodyS>
          <SheetInput keyboardType="decimal-pad" inputMode="decimal" value={pastA}
            onChangeText={value => { setPastA(value); setPastError(null); }} />
          {pastError ? <BodyS>{t(`inc_past_${pastError}`)}</BodyS> : null}
          <Btn label={saving ? t('inc_saving') : (editId ? t('done') : t('add'))} onPress={() => { void save(); }} />
        </View>
      </SheetFrame>
    );
  }

  if (sheet === 'xcown' || sheet === 'srcown' || sheet === 'wcown') {
    const title = sheet === 'xcown' ? t('xc_own') : sheet === 'srcown' ? t('src_own') : t('wc_own');
    const save = async () => {
      const name = ownName.trim();
      if (!name || saving) return;
      setSaving(true);
      try {
        if (sheet === 'srcown') {
          await saveIncomeSource(name);
          up(s => { s.sheet = null; });
        } else if (sheet === 'xcown') {
          await saveExpenseCategory(name);
          up(s => { s.sheet = null; });
        } else {
          await saveWorkCostCategory(name);
          up(s => { s.sheet = null; });
        }
        toast(t('saved'));
      } catch {
        toast(t(sheet === 'wcown' ? 'wc_save_failed' : 'inc_save_failed'), 'error');
      } finally {
        setSaving(false);
      }
    };
    return (
      <SheetFrame pose="pleased" onClose={close}>
        <SheetH3>{title}</SheetH3>
        <View style={{ gap: 8 }}>
          <BodyS muted>{t(sheet === 'wcown' ? 'wc_name' : sheet === 'xcown' ? 'xc_name' : 'src_name')}</BodyS>
          <SheetInput value={ownName} onChangeText={setOwnName} />
          <Btn label={saving ? t('inc_saving') : t('add')} onPress={() => { void save(); }} />
        </View>
      </SheetFrame>
    );
  }

  return null;
}

const sheetSt = StyleSheet.create({
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  opt: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, paddingHorizontal: 12,
  },
  qitem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 24, paddingHorizontal: 16, width: 200, minHeight: 46,
    shadowColor: 'rgba(31,44,45,1)', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  vinfo: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.ink40,
    alignItems: 'center', justifyContent: 'center',
  },
  vhelp: {
    backgroundColor: '#F3F8F5', borderWidth: 1.5, borderColor: '#D5E3D9', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, marginTop: 10,
  },
  vscene: {
    marginTop: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E2F1EE',
    paddingTop: 26, paddingHorizontal: 6, paddingBottom: 4, minHeight: 230,
  },
  varrow: {
    width: 46, height: 40, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: C.ink14, alignItems: 'center', justifyContent: 'center',
  },
});

/* ---------- splash ---------- */

export function Splash() {
  const { S, t, up } = useApp();
  const mark = React.useRef(new Animated.Value(0)).current;
  const wm = React.useRef(new Animated.Value(0)).current;
  const slg = React.useRef(new Animated.Value(0)).current;
  const out = React.useRef(new Animated.Value(1)).current;
  const ending = React.useRef(false);

  const end = React.useCallback(() => {
    if (ending.current) return;
    ending.current = true;
    Animated.timing(out, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => {
      up(s => { s.splash = false; });
    });
  }, [out, up]);

  /* Keyed on S.splash: a slow auth bootstrap can reset state and raise the
     splash again after it already ended — without re-arming, the faded-out
     splash would stay mounted at opacity 0 and swallow every tap. */
  React.useEffect(() => {
    if (!S.splash) return;
    ending.current = false;
    out.setValue(1);
    Animated.timing(mark, {
      toValue: 1, duration: 800,
      easing: Easing.bezier(0.34, 1.45, 0.5, 1), useNativeDriver: true,
    }).start();
    Animated.timing(wm, { toValue: 1, duration: 500, delay: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    Animated.timing(slg, { toValue: 1, duration: 500, delay: 720, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    const timer = setTimeout(end, 3000);
    return () => clearTimeout(timer);
  }, [S.splash, mark, wm, slg, out, end]);

  if (!S.splash) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 60, opacity: out }]}>
      <Pressable onPress={end} style={{
        flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: 14,
      }} accessibilityLabel="RuMampu">
        <Animated.View style={{
          opacity: mark,
          transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
        }}>
          <Logo size={126} />
        </Animated.View>
        <Animated.Text style={{
          fontSize: 36, fontWeight: '800', letterSpacing: -0.5, color: C.ink,
          opacity: wm,
          transform: [{ translateY: wm.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}>RuMampu</Animated.Text>
        <Animated.Text style={{
          fontSize: 13, lineHeight: 18, color: C.ink64,
          opacity: slg,
          transform: [{ translateY: slg.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}>{t('ob_slogan')}</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

/* ---------- toast ---------- */

export function ToastView() {
  const { toastMsg } = useApp();
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (toastMsg) {
      Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [toastMsg, anim]);
  if (!toastMsg) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: 20, right: 20, bottom: 84, zIndex: 30,
      backgroundColor: C.ink, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    }}>
      <Text style={{ color: toastMsg.tone === 'error' ? C.short : C.confirm, fontSize: 18 }}>
        {toastMsg.tone === 'error' ? '!' : '✓'}
      </Text>
      <Text style={{ color: C.paper, fontSize: 15, flexShrink: 1, fontFamily: BODY_FONT }}>{toastMsg.msg}</Text>
    </Animated.View>
  );
}

/* ---------- tab bar with the centre FAB ---------- */

const TAB_ICO: Record<string, string> = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/>',
  money: '<rect x="3.5" y="6.5" width="17" height="12" rx="2.5"/><path d="M15 12.5h5.5v3H15a1.5 1.5 0 0 1 0-3z"/>',
  test: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m9 13 2 2 4-4.5"/>',
  profile: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="2.8"/><path d="M6.5 18c1.2-2.4 3.2-3.5 5.5-3.5s4.3 1.1 5.5 3.5"/>',
};

function tabIcoXml(id: string, on: boolean): string {
  const color = on ? C.ink : 'rgba(60,81,82,0.64)';
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${color}" stroke-width="${on ? 2.5 : 1.9}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${TAB_ICO[id]}</svg>`;
}

// EN: Epic 8 uses the shared TabBar to satisfy AC8.4 bottom navigation; v22
// adds the centre + FAB whose speed-dial adds income / expense / scan quickly.
// 中文：Epic 8 使用共享 TabBar 满足 AC8.4 底部导航；v22 增加中间的 + 悬浮按钮，
// 其快捷菜单可快速记录收入 / 支出 / 扫描。
export function TabBar() {
  const { S, t, up, goTab } = useApp();
  const insets = useSafeAreaInsets();
  const active = TAB_OF[S.route] || 'home';
  const quickOpen = S.sheet === 'quick';
  const quickBack = S.sheet === 'quick2';

  const tabBtn = (id: Tab, k: string) => {
    const on = active === id;
    return (
      <Pressable
        key={id}
        onPress={() => goTab(id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <SvgXml xml={tabIcoXml(id, on)} width={24} height={24} />
        <Text style={{
          fontFamily: DISP_FONT, fontSize: 11.5, letterSpacing: 0.23,
          color: on ? C.ink : C.ink64,
        }}>{t(k)}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-end',
      backgroundColor: C.paper, paddingTop: 6, paddingHorizontal: 4,
      paddingBottom: 6 + insets.bottom,
      shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: -8 },
      elevation: 12, zIndex: 46,
    }}>
      {tabBtn('home', 'tab_home')}
      {tabBtn('money', 'tab_money')}
      <View style={{ flex: 1, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => up(s => { s.sheet = s.sheet === 'quick2' ? 'quick' : (s.sheet === 'quick' ? null : 'quick'); })}
          accessibilityLabel={t('qk_title')}
          style={({ pressed }) => [{
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: quickOpen || quickBack ? C.ink : C.brand,
            marginTop: -30, marginBottom: 8, borderWidth: 4, borderColor: C.paper,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: quickOpen || quickBack ? 'rgba(31,44,45,1)' : 'rgba(74,145,149,1)',
            shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }, pressed && { transform: [{ translateY: 2 }] }]}
        >
          <SvgXml
            xml={`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${quickBack ? '<path d="M19 12H5M12 5l-7 7 7 7"/>' : '<path d="M12 5v14M5 12h14"/>'}</svg>`}
            width={26} height={26}
            style={quickOpen ? { transform: [{ rotate: '45deg' }] } : undefined}
          />
        </Pressable>
      </View>
      {tabBtn('test', 'tab_test')}
      {tabBtn('profile', 'tab_profile')}
    </View>
  );
}

/* ---------- header language / assistant buttons live in ui.Hdr ---------- */

export const FONT_SEMI = SEMI_FONT;
