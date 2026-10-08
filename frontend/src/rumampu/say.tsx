import React from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { SvgXml } from 'react-native-svg';
import { AppState, VoiceItem, VoiceState, useApp } from './state';
import { previewAssistantAction } from './api';
import { rmx } from './calc';
import { BODY_FONT, C, DISP_FONT, XBOLD_FONT } from './theme';
import { Ico } from './svgs';
import { getSpeechOwner, setSpeechOwner, speechLocale } from './speech';

/* v27b3 Say an entry. The person says, or types, what they earned or spent.
   The words go to the same reader Ask Ruma uses, which proposes entries and
   never saves; if it cannot be reached, a small parser in the app drafts them
   instead. Every draft is shown, can be corrected, and nothing is saved until
   Save. If speech recognition is unavailable, the typed-entry path remains
   available without inserting data the person did not provide. */

const MIC_XML = (color: string, size: number) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0"/><path d="M12 17v4.5"/><path d="M8.5 21.5h7"/></svg>`;

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function lastWeekdayIso(weekday: number): string {
  const d = new Date();
  let back = (d.getDay() - weekday + 7) % 7;
  if (back === 0) back = 7;
  d.setDate(d.getDate() - back);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function spokenDate(text: string): string {
  if (/kelmarin|前天/.test(text)) return isoOffset(-2);
  if (/semalam|yesterday|昨天/.test(text)) return isoOffset(-1);
  const weekdays: Array<[RegExp, number]> = [
    [/last sunday|ahad lepas|上周日|上星期日/, 0],
    [/last monday|isnin lepas|上周一|上星期一/, 1],
    [/last tuesday|selasa lepas|上周二|上星期二/, 2],
    [/last wednesday|rabu lepas|上周三|上星期三/, 3],
    [/last thursday|khamis lepas|上周四|上星期四/, 4],
    [/last friday|jumaat lepas|上周五|上星期五/, 5],
    [/last saturday|sabtu lepas|上周六|上星期六/, 6],
  ];
  const match = weekdays.find(([pattern]) => pattern.test(text));
  return match ? lastWeekdayIso(match[1]) : isoOffset(0);
}

/* ---------- the fallback parser (ported from the prototype) ---------- */

const UNITS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/* number words to digits: "dua ratus lima puluh" 250, "seribu lima ratus" 1500, "two hundred and fifty" 250 */
function numberWords(s: string): string {
  const out: string[] = [];
  let on = false, total = 0, hund = 0, unit = 0;
  const flush = () => { if (on) { out.push(String(total + hund + unit)); on = false; total = 0; hund = 0; unit = 0; } };
  for (const w of s.split(/\s+/)) {
    if (!w) continue;
    if (/^\d+(\.\d+)?k$/.test(w)) { flush(); out.push(String(parseFloat(w) * 1000)); continue; }
    if (UNITS[w] != null) { on = true; unit += UNITS[w]; continue; }
    if (w === 'seratus') { on = true; hund += 100; continue; }
    if (w === 'seribu') { on = true; total += 1000; continue; }
    if (on && w === 'belas') { unit += 10; continue; }
    if (on && w === 'puluh') { unit *= 10; continue; }
    if (on && (w === 'ratus' || w === 'hundred')) { hund += (unit || 1) * 100; unit = 0; continue; }
    if (on && (w === 'ribu' || w === 'thousand')) { total += ((hund + unit) || 1) * 1000; hund = 0; unit = 0; continue; }
    if (on && w === 'and') continue;
    flush(); out.push(w);
  }
  flush();
  return out.join(' ');
}

function chineseNumber(str: string): number {
  const D: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const U: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0, sec = 0, num = 0;
  for (const ch of str) {
    if (D[ch] != null) num = D[ch];
    else if (U[ch]) { sec += (num || 1) * U[ch]; num = 0; }
    else if (ch === '万') { total += (sec + num) * 10000; sec = 0; num = 0; }
  }
  return total + sec + num;
}

function customIncomeSource(text: string): string | undefined {
  if (/\b(?:work|job|kerja)\b|mcdonald'?s/.test(text)) return 'Work';
  if (/\bclubs?\b/.test(text)) return 'Clubs';
  const match = text.match(/\b(?:from|dari)\s+(?:my\s+)?([^|,.;!?]{1,60})/i);
  if (!match) return undefined;
  const name = match[1]
    .replace(/\b(?:today|yesterday|last\s+\w+|hari\s+ini|semalam)\b.*$/i, '')
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : undefined;
}

export function parseSpokenEntries(text: string, S: AppState): VoiceItem[] {
  let s = ` ${String(text || '').toLowerCase()} `;
  s = s.replace(/rm\s*/g, ' ').replace(/(\d),(\d{3})/g, '$1$2');
  /* In Malaysian conversational English, "twelve fifty" commonly means
     RM12.50. Handle the specified form before general number-word folding,
     where it would otherwise become 12 + 50. */
  s = s.replace(/\btwelve\s+fifty\b/g, '12.50');
  s = s.replace(/[零一二两三四五六七八九十百千万]+/g, m => ` ${chineseNumber(m)} `);
  s = s.replace(/[，。;!?、]/g, ' | ').replace(/,\s/g, ' | ').replace(/\.(\s|$)/g, ' | ');
  s = numberWords(s);
  /* Colloquial money such as "twelve fifty" is normally RM12.50, not two
     separate entries. numberWords() has already made it "12 50" here. */
  s = s.replace(/\b(\d+)\s+(\d{2})(?=\D|$)/g, '$1.$2');
  const entryDate = spokenDate(s);
  const parts = s.split(/\||\blepas tu\b|\blepastu\b|\bpastu\b|\band then\b|\bthen\b|然后|接着/);
  const sourceBy = (slugs: string[]) => S.data.sources.find(x => slugs.some(sl => x.k === `src_${sl}`))?.id;
  const catBy = (slug: string) => S.data.expenseCats.find(x => x.k === `xc_${slug}`)?.id;
  const items: VoiceItem[] = [];
  for (const p of parts) {
    const m = p.match(/(-?\d+(?:\.\d+)?)/);
    if (!m) continue;
    const a = Math.round(parseFloat(m[1]) * 100) / 100;
    if (!Number.isFinite(a)) continue;
    const incW = /dapat|dpt|earn|earned|\bgot\b|\bmade\b|income|gaji|terima|received|paid me|bayar saya|klien|client|赚|收入|拿到|付了我|客户/;
    const expW = /makan|beli|belanja|spent|spend|bayar|paid|\bpay\b|minyak|petrol|parking|\btol\b|toll|花|吃|买|加油/;
    const iI = p.search(incW), iE = p.search(expW);
    let kind: 'in' | 'out';
    let kindCertain = true;
    if (iI >= 0 && (iE < 0 || /paid me|bayar saya|klien|client|付了我|客户/.test(p))) kind = 'in';
    else if (iE >= 0) kind = 'out';
    else { kind = /grab|foodpanda|lalamove|shopee|freelance/.test(p) ? 'in' : 'out'; kindCertain = false; }
    const it: VoiceItem = {
      kind, a, d: entryDate,
      confidence: {
        kind: kindCertain ? 'high' : 'low',
        amount: (kind === 'in' ? a >= 0 : a > 0) ? 'high' : 'low',
        date: 'high',
        target: 'low',
      },
    };
    if (kind === 'in') {
      const sid = /foodpanda|panda|lalamove|shopee|deliver/.test(p) ? sourceBy(['deliv', 'delivery', 'food'])
        : /grab|e-hailing|ehailing/.test(p) ? sourceBy(['ehail'])
          : /freelance|klien|client|projek|project|自由职业/.test(p) ? sourceBy(['freelance'])
            : /part.?time|gaji/.test(p) ? sourceBy(['parttime']) : undefined;
      it.s = sid;
      if (!sid) it.sourceName = customIncomeSource(p);
      it.confidence!.target = sid || it.sourceName ? 'high' : 'low';
    } else {
      const slug = /makan|lunch|dinner|breakfast|food|nasi|kopi|吃|饭|餐/.test(p) ? 'meals'
        : /barang|grocer|pasar|mart|kedai|超市|菜/.test(p) ? 'groc'
          : /minyak|petrol|parking|\btol\b|toll|lrt|\bbas\b|bus|加油|停车/.test(p) ? 'transp'
            : /\bmak\b|ayah|family|keluarga|anak|家/.test(p) ? 'family'
              : /other|lain|其他/.test(p) ? 'other' : '';
      it.c = slug ? catBy(slug) : undefined;
      it.confidence!.target = it.c ? 'high' : 'low';
    }
    items.push(it);
  }
  return items;
}

/* ---------- the voice draft: listening, reading, saving ---------- */

function useReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduce(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return reduce;
}

function useSayDraft() {
  const { S, t, up, toast, saveIncomeEntry, saveIncomeSource, saveExpenseCategory, saveExpenseEntry, ensureAiDisclosure } = useApp();
  const textRef = React.useRef('');
  const SRef = React.useRef(S);
  SRef.current = S;
  const [saving, setSaving] = React.useState(false);

  const setVoice = React.useCallback((v: VoiceState | null) => up(s => { s.voice = v; }), [up]);

  const shownLabel = (item: { custom?: boolean; name?: string; k?: string }) =>
    item.custom ? item.name || '' : t(item.k || '');

  const routeToAsk = React.useCallback((said: string) => {
    up(s => {
      s.voice = null;
      s.sayOpen = false;
      s.qSay = false;
      s.sheet = null;
      s.assistantDraft = said;
      s.assistantOpen = true;
    });
    toast(t('vo_question_routed'));
  }, [t, toast, up]);

  /* Read the words: the shared reader first, the app's own parser if the
     reader is unreachable or finds nothing to enter. */
  const finish = React.useCallback(async (text: string) => {
    const said = text.trim();
    if (!said) { setVoice(null); return; }
    if (!await ensureAiDisclosure()) return;
    setVoice({ stage: 'parsing', text: said, items: [] });
    const S0 = SRef.current;
    const local = () => parseSpokenEntries(said, SRef.current);
    let items: VoiceItem[] = [];
    let note: string | undefined;
    try {
      const preview = await previewAssistantAction(said, S0.lang, {
        incomeSources: S0.data.sources.map(item => ({ id: item.id, label: shownLabel(item) })),
        expenseCategories: S0.data.expenseCats.map(item => ({ id: item.id, label: shownLabel(item) })),
        commitments: [
          ...S0.data.commitments.living, ...S0.data.commitments.debts, ...S0.data.commitments.savings,
        ].map(item => ({ id: item.id, label: shownLabel(item) })),
        limitCategories: [
          { id: 'total', label: t('lm_total') },
          ...S0.data.expenseCats.map(item => ({ id: item.id, label: shownLabel(item) })),
        ],
        /* An absent source must remain a field for the user to complete; do
           not silently turn the preferred source into something they said. */
        defaultIncomeSourceId: null,
      });
      if (preview.status === 'ready') {
        items = preview.actions
          .filter(a => a.kind === 'income' || a.kind === 'expense')
          .map(a => ({
            kind: a.kind === 'income' ? 'in' : 'out',
            a: Number(a.amount),
            d: a.date || isoOffset(0),
            ...(a.kind === 'income'
              ? { s: a.target_id, sourceName: a.target_id ? undefined : a.target_label || undefined }
              : { c: a.target_id, categoryName: a.target_id ? undefined : a.target_label || undefined }),
            confidence: {
              kind: 'high', amount: 'high', date: 'high',
              target: a.target_id || a.target_label ? 'high' : 'low',
            },
          }) as VoiceItem);
        /* Voice entry is deliberately limited to record entries. A bill,
           limit, housing action or other non-entry command belongs in Ask
           Ruma and must never fall through as a guessed expense. */
        if (!items.length && preview.actions.length) {
          routeToAsk(said);
          return;
        }
      } else if (preview.status === 'needs_clarification') {
        note = preview.message;
      } else if (preview.status === 'not_action') {
        /* Carry the exact words across for review; Ask Ruma never sends the
           question automatically. */
        routeToAsk(said);
        return;
      }
      if (!items.length) items = local();
    } catch {
      items = local();
    }
    if (!SRef.current.voice) return; /* closed while reading */
    setVoice({ stage: 'done', text: said, items, note: items.length ? undefined : note });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAiDisclosure, routeToAsk, setVoice, t]);

  const beginListening = React.useCallback(async () => {
    textRef.current = '';
    setVoice({ stage: 'listen', text: '', items: [] });
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoice(null);
        toast(t('vo_mic_denied'), 'error');
        return;
      }
      setSpeechOwner('say');
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale(SRef.current.lang), interimResults: true, continuous: false, maxAlternatives: 1,
      });
    } catch {
      setVoice(null);
      toast(t('vo_mic_failed'), 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVoice, t, toast]);

  const start = React.useCallback(async () => {
    if (!await ensureAiDisclosure()) return;
    let available = false;
    try { available = ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { available = false; }
    if (!available) {
      setVoice(null);
      toast(t('vo_mic_unavailable'), 'error');
      return;
    }
    if (!SRef.current.voiceDisclosureAccepted) {
      setVoice({ stage: 'permission', text: '', items: [] });
      return;
    }
    await beginListening();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginListening, ensureAiDisclosure, setVoice, t, toast]);

  const mine = () => getSpeechOwner() === 'say';
  useSpeechRecognitionEvent('result', event => {
    if (!mine()) return;
    const said = event.results?.[0]?.transcript ?? '';
    textRef.current = said;
    up(s => { if (s.voice && s.voice.stage === 'listen') s.voice.text = said; });
  });
  useSpeechRecognitionEvent('end', () => {
    if (!mine()) return;
    setSpeechOwner(null);
    const V = SRef.current.voice;
    if (!V || V.stage !== 'listen') return;
    if (textRef.current.trim()) void finish(textRef.current);
    else setVoice(null);
  });
  useSpeechRecognitionEvent('error', event => {
    if (!mine()) return;
    setSpeechOwner(null);
    if (event.error === 'aborted') return;
    if (!textRef.current.trim()) {
      setVoice(null);
      toast(t(event.error === 'not-allowed' ? 'vo_mic_denied' : 'vo_mic_failed'), 'error');
    }
  });

  /* Cancelling discards the transient transcript and draft (AC9.7.2). */
  const halt = React.useCallback(() => {
    if (getSpeechOwner() === 'say') {
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* not listening */ }
      setSpeechOwner(null);
    }
    up(s => { s.voice = null; });
  }, [up]);

  const micTap = () => {
    const V = SRef.current.voice;
    if (V?.stage === 'permission') {
      up(s => { s.voiceDisclosureAccepted = true; });
      void beginListening();
      return;
    }
    if (V && V.stage === 'listen') {
      if (getSpeechOwner() === 'say') {
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* already stopped */ }
      } else {
        void finish(V.text);
      }
      return;
    }
    void start();
  };

  const reset = () => {
    halt();
    setVoice(null);
    void start();
  };

  const edit = (i: number, field: keyof NonNullable<VoiceItem['confidence']>, fn: (it: VoiceItem) => void) => up(s => {
    const it = s.voice?.items[i];
    if (it) {
      fn(it);
      if (it.confidence) it.confidence[field] = 'high';
      s.voice!.outlier = false;
    }
  });

  const confirm = (i: number) => up(s => {
    const it = s.voice?.items[i];
    if (!it) return;
    it.confidence = { kind: 'high', amount: 'high', date: 'high', target: 'high' };
  });

  const close = React.useCallback(() => {
    halt();
    up(s => { s.sayOpen = false; s.qSay = false; });
  }, [halt, up]);

  const save = async (onSaved: (msg: string) => void) => {
    const V = SRef.current.voice;
    if (!V || !V.items.length || saving) return;
    const needsReview = V.items.some(it => Object.values(it.confidence || {}).includes('low'));
    const invalid = V.items.some(it => {
      const amount = Number(it.a);
      return !Number.isFinite(amount) || (it.kind === 'in' ? amount < 0 : amount <= 0)
        || (it.kind === 'in' ? !it.s && !it.sourceName : !it.c && !it.categoryName);
    });
    if (needsReview || invalid) {
      toast(t(needsReview ? 'vo_review_required' : 'vo_invalid_amount'), 'error');
      return;
    }
    setSaving(true);
    const said: string[] = [];
    /* items already saved in this pass; if the save stops part way, they leave the
       draft so a second Save cannot record them twice */
    const doneIdx: number[] = [];
    const dropSaved = () => {
      if (doneIdx.length) up(s => { if (s.voice) s.voice.items = s.voice.items.filter((_, j) => !doneIdx.includes(j)); });
    };
    try {
      /* Income first: an unusually large one stops the save so it can be checked. */
      const order = V.items.map((it, i) => ({ it, i })).sort((a, b) => Number(b.it.kind === 'in') - Number(a.it.kind === 'in'));
      const createdSources = new Map<string, string>();
      const createdCategories = new Map<string, string>();
      for (const { it, i } of order) {
        const a = Math.round((Number(it.a) || 0) * 100) / 100;
        if (!Number.isFinite(a) || (it.kind === 'in' ? a < 0 : a <= 0)) continue;
        if (it.kind === 'in') {
          let sourceId = it.s || '';
          if (!sourceId && it.sourceName) {
            const key = it.sourceName.trim().toLocaleLowerCase();
            sourceId = createdSources.get(key) || await saveIncomeSource(it.sourceName);
            createdSources.set(key, sourceId);
            up(s => {
              const pending = s.voice?.items[i];
              if (pending) pending.s = sourceId;
            });
          }
          const result = await saveIncomeEntry({ amount: a, date: it.d, sourceId, confirmOutlier: !!V.outlier });
          if (result === 'outlier') {
            dropSaved();
            up(s => { if (s.voice) s.voice.outlier = true; });
            toast(t('as_action_outlier'), 'error');
            return;
          }
          doneIdx.push(i);
          said.push(t('vo_saved_in', { a: rmx(a) }));
        } else {
          let categoryId = it.c || '';
          if (!categoryId && it.categoryName) {
            const key = it.categoryName.trim().toLocaleLowerCase();
            categoryId = createdCategories.get(key) || await saveExpenseCategory(it.categoryName);
            createdCategories.set(key, categoryId);
          }
          await saveExpenseEntry({ amount: a, date: it.d, categoryId });
          doneIdx.push(i);
          said.push(t('vo_saved_out', { a: rmx(a) }));
        }
      }
      if (!said.length) return;
      up(s => { s.voice = null; });
      onSaved(t('vo_saved_l', { l: said.join(', ') }));
    } catch {
      dropSaved();
      toast(t('as_action_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return { start, micTap, reset, edit, confirm, close, halt, save, saving, finish };
}

/* ---------- pieces ---------- */

function Pulse({ on, size }: { on: boolean; size: number }) {
  const a = React.useRef(new Animated.Value(0)).current;
  const b = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!on) { a.stopAnimation(); b.stopAnimation(); a.setValue(0); b.setValue(0); return undefined; }
    const loop = (v: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const la = loop(a, 0), lb = loop(b, 800);
    la.start(); lb.start();
    return () => { la.stop(); lb.stop(); };
  }, [on, a, b]);
  if (!on) return null;
  const ring = (v: Animated.Value) => (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: -10, top: -10, width: size + 20, height: size + 20, borderRadius: (size + 20) / 2,
      borderWidth: 3, borderColor: C.short,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.28] }) }],
    }} />
  );
  return <>{ring(a)}{ring(b)}</>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={sy.eyebrow}>{children}</Text>;
}

/* A compact stand-in for a <select>: the current choice, and the options below it when open. */
function InlineSelect({ value, options, onChange, label }: {
  value: string; options: { v: string; l: string }[]; onChange: (v: string) => void; label: string;
}) {
  const [open, setOpen] = React.useState(false);
  const cur = options.find(o => o.v === value);
  return (
    <View style={{ alignItems: 'flex-end', maxWidth: '62%' }}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityLabel={label}
        style={sy.select}>
        <Text numberOfLines={1} style={sy.selectTxt}>{cur ? cur.l : '-'}</Text>
        <Text style={{ fontSize: 12, color: C.ink64 }}>{'▾'}</Text>
      </Pressable>
      {open ? (
        <View style={sy.selectList}>
          {options.map(o => (
            <Pressable key={o.v} onPress={() => { onChange(o.v); setOpen(false); }}
              style={[sy.selectOpt, o.v === value && { backgroundColor: C.card }]}>
              <Text style={[sy.selectTxt, o.v === value && { fontFamily: DISP_FONT }]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DraftCard({ it, i, edit, remove, confirm }: {
  it: VoiceItem;
  i: number;
  edit: (i: number, field: keyof NonNullable<VoiceItem['confidence']>, fn: (it: VoiceItem) => void) => void;
  remove: (i: number) => void;
  confirm?: (i: number) => void;
}) {
  const { S, t, monthName } = useApp();
  const inc = it.kind === 'in';
  const days = [0, -1, -2].map(o => ({ v: isoOffset(o), l: t(o === 0 ? 'vo_today' : o === -1 ? 'vo_yday' : 'vo_2d') }));
  if (!days.some(d => d.v === it.d)) {
    const [y, m, d] = it.d.split('-').map(Number);
    days.push({ v: it.d, l: `${d} ${monthName((m || 1) - 1)} ${y}` });
  }
  const list = inc ? S.data.sources : S.data.expenseCats;
  const proposedSource = '__ai_proposed_source__';
  const proposedCategory = '__ai_proposed_category__';
  const opts = [
    ...(inc && it.sourceName ? [{ v: proposedSource, l: it.sourceName }] : []),
    ...(!inc && it.categoryName ? [{ v: proposedCategory, l: it.categoryName }] : []),
    ...list.map(x => ({ v: x.id, l: x.custom ? x.name || '' : t(x.k || '') })),
  ];
  const [amt, setAmt] = React.useState(String(it.a));
  React.useEffect(() => { setAmt(String(it.a)); }, [it.a]);
  const low = (field: keyof NonNullable<VoiceItem['confidence']>) => it.confidence?.[field] === 'low';
  const anyLow = Object.values(it.confidence || {}).includes('low');
  const check = (field: keyof NonNullable<VoiceItem['confidence']>) => low(field)
    ? <Text style={sy.vflag}>{t('vo_flag')}</Text> : null;
  return (
    <View style={sy.vent}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 30 }}>
        <Text style={[sy.ventK, { color: inc ? '#1E7A33' : '#B8421A' }]}>{t(inc ? 'vo_in' : 'vo_out')}</Text>
        {check('kind')}
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={6} onPress={() => edit(i, 'kind', x => {
          x.kind = x.kind === 'in' ? 'out' : 'in';
          if (x.kind === 'in') {
            x.c = undefined; x.categoryName = undefined;
            if (!x.s && !x.sourceName) x.s = S.preferredIncomeSourceId || S.incomeDraft.s || S.data.sources[0]?.id;
          } else {
            x.s = undefined; x.sourceName = undefined;
            if (!x.c && !x.categoryName) x.c = S.data.expenseCats[0]?.id;
          }
        })}>
          <Text style={sy.vswap}>{t(inc ? 'vo_to_out' : 'vo_to_in')}</Text>
        </Pressable>
        <Pressable hitSlop={6} onPress={() => remove(i)} style={{ marginLeft: 10 }}>
          <Text style={[sy.vswap, { color: C.ink64, textDecorationColor: C.ink40 }]}>{t('vo_del')}</Text>
        </Pressable>
      </View>
      <View style={sy.vrow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={sy.vrowK}>{t('vo_amt')}</Text>{check('amount')}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.ink64 }}>RM</Text>
          <TextInput
            value={amt}
            onChangeText={v => { setAmt(v); edit(i, 'amount', x => { x.a = v; }); }}
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel={t('vo_amt')}
            style={sy.vamtIn}
          />
        </View>
      </View>
      <View style={sy.vrow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={sy.vrowK}>{t('vo_date')}</Text>{check('date')}</View>
        <InlineSelect label={t('vo_date')} value={it.d} options={days} onChange={v => edit(i, 'date', x => { x.d = v; })} />
      </View>
      <View style={sy.vrow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={sy.vrowK}>{t(inc ? 'vo_src' : 'vo_cat')}</Text>{check('target')}</View>
        <InlineSelect label={t(inc ? 'vo_src' : 'vo_cat')}
          value={(inc ? it.s || (it.sourceName ? proposedSource : '') : it.c || (it.categoryName ? proposedCategory : '')) || ''} options={opts}
          onChange={v => edit(i, 'target', x => {
            if (inc) {
              if (v !== proposedSource) { x.s = v; x.sourceName = undefined; }
            } else if (v !== proposedCategory) { x.c = v; x.categoryName = undefined; }
          })} />
      </View>
      {anyLow && confirm ? (
        <Pressable onPress={() => confirm(i)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Text style={sy.btnLine}>{t('vo_confirm_draft')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* The open card's contents, shared by Home and the + menu. */
function SayBody({ title, onSaved }: { title: string; onSaved: (msg: string) => void }) {
  const { S, t, up } = useApp();
  const d = useSayDraft();
  const [typed, setTyped] = React.useState('');
  const [listeningSeconds, setListeningSeconds] = React.useState(0);
  const reduce = useReducedMotion();
  const fade = React.useRef(new Animated.Value(0)).current;
  const V = S.voice || { stage: 'idle', text: '', items: [] } as VoiceState;
  const stage = V.stage;

  React.useEffect(() => {
    if (stage !== 'listen') { setListeningSeconds(0); return undefined; }
    const started = Date.now();
    const timer = setInterval(() => setListeningSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  /* Opening starts listening straight away, only where the device can hear,
     and never over a draft still waiting to be saved. */
  React.useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 260, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    let available = false;
    try { available = ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { available = false; }
    if (available && (!S.voice || S.voice.stage === 'idle')) void d.start();
    return () => d.halt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = stage === 'listen' ? t('vo_listening_time', { n: listeningSeconds })
      : stage === 'parsing' ? t('as_thinking')
        : stage === 'permission' ? t('vo_permission_title')
        : stage === 'done' ? t('vo_done') : t('vo_hint');
  const n = V.items.length;
  const listening = stage === 'listen';
  const cannotSave = V.items.some(it => Object.values(it.confidence || {}).includes('low')
    || !Number.isFinite(Number(it.a))
    || (it.kind === 'in' ? Number(it.a) < 0 || (!it.s && !it.sourceName) : Number(it.a) <= 0 || (!it.c && !it.categoryName)));

  return (
    <Animated.View style={{ opacity: fade, gap: 14 }}>
      {/* The badge and the close button sit in the corners, so the mic can take the top centre. */}
      <View style={{ height: 0, zIndex: 3, position: 'relative' }}>
        <Pressable onPress={d.close} accessibilityLabel={t('close')} accessibilityRole="button"
          style={sy.vx}>
          <Text style={{ fontSize: 18, color: C.ink }}>{'✕'}</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', paddingTop: 12 }}>
        <View style={sy.badge}><Text style={sy.badgeTxt}>{t('vo_badge').toUpperCase()}</Text></View>
        <Pressable onPress={d.micTap} accessibilityRole="button"
          accessibilityLabel={t(listening ? 'vo_stop' : 'vo_tap')}
          style={[sy.vmic, listening && sy.vmicOn]}>
          <Pulse on={listening && !reduce} size={84} />
          <SvgXml xml={MIC_XML('#FFFFFF', 36)} width={36} height={36} />
        </Pressable>
        <Text accessibilityRole="header" style={sy.vttl}>{title}</Text>
        <Text accessibilityLiveRegion="polite" style={sy.vostat}>{status}</Text>
      </View>

      {stage !== 'idle' ? (
        <View style={{ gap: 6 }}>
          <Eyebrow>{t('vo_said')}</Eyebrow>
          <View style={sy.vsaid}>
            <Text style={sy.vsaidTxt}>{`“${V.text}”`}</Text>
            {stage === 'parsing' ? <ActivityIndicator size="small" color={C.ink64} style={{ marginTop: 6, alignSelf: 'flex-start' }} /> : null}
          </View>
        </View>
      ) : null}

      {stage === 'permission' ? (
        <View style={sy.noteC} accessibilityRole="alert">
          <Text style={sy.noteTxt}>{t('vo_permission_body')}</Text>
          <Pressable onPress={d.micTap} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Text style={sy.btnLine}>{t('vo_permission_continue')}</Text>
          </Pressable>
        </View>
      ) : null}

      {stage === 'idle' || stage === 'permission' ? (
        <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: 13, color: C.ink64 }}>{t('vo_type')}</Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder={t('vo_type_ph')}
              placeholderTextColor={C.ink40}
              accessibilityLabel={t('vo_type')}
              onSubmitEditing={() => { if (typed.trim()) { void d.finish(typed); setTyped(''); } }}
              style={sy.input}
            />
            <Pressable onPress={() => { if (typed.trim()) { void d.finish(typed); setTyped(''); } }}
              style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
              <Text style={sy.btnLine}>{t('vo_go')}</Text>
            </Pressable>
        </View>
      ) : null}

      {stage === 'done' ? (
        <>
          {V.note ? (
            <View style={sy.noteC}><Text style={sy.noteTxt}>{V.note}</Text></View>
          ) : null}
          {n ? (
            <>
              <View style={{ gap: 8 }}>
                <Eyebrow>{t('vo_check')}</Eyebrow>
                {V.items.map((it, i) => (
                  <DraftCard key={i} it={it} i={i} edit={d.edit}
                    confirm={d.confirm}
                    remove={k => up(s => { s.voice?.items.splice(k, 1); })} />
                ))}
              </View>
              {V.outlier ? (
                <View style={sy.noteC}><Text style={sy.noteTxt}>{t('as_action_outlier')}</Text></View>
              ) : null}
              <Pressable onPress={() => { void d.save(onSaved); }} disabled={d.saving || cannotSave}
                accessibilityRole="button" style={[sy.btn, (d.saving || cannotSave) && { opacity: 0.6 }]}>
                {d.saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={sy.btnTxt}>
                    {V.outlier ? t('as_action_confirm_again') : n === 2 ? t('vo_save_2') : n > 1 ? t('vo_save_n', { n }) : t('vo_save')}
                  </Text>
                )}
              </Pressable>
              {cannotSave ? <Text style={sy.noteTxt}>{t('vo_review_required')}</Text> : null}
            </>
          ) : (!V.note ? (
            <View style={sy.noteC}><Text style={sy.noteTxt}>{t('vo_none')}</Text></View>
          ) : null)}
          <View style={{ alignItems: 'center' }}>
            <Pressable onPress={d.reset} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={sy.btnLine}>{t('vo_again')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Text style={sy.foot}>{`${t('vo_foot')} ${t('vo_privacy')}`}</Text>
    </Animated.View>
  );
}

/* ---------- Home: the card that opens in place ---------- */

export function SayCard() {
  const { S, t, up, toast, leaveSampleMonths } = useApp();
  if (!S.sayOpen) {
    return (
      <Pressable
        onPress={() => { if (S.demo) leaveSampleMonths(); up(s => { s.sayOpen = true; s.qSay = false; }); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        style={({ pressed }) => [sy.mosay, pressed && { opacity: 0.9 }]}
      >
        <SvgXml pointerEvents="none" style={StyleSheet.absoluteFillObject as object} width="100%" height="100%"
          xml={'<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><linearGradient id="sc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E3F1F0"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sc)"/></svg>'} />
        <View style={sy.mosayIc}><SvgXml xml={MIC_XML('#FFFFFF', 22)} width={22} height={22} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={sy.mosayB}>{t('mo_say_t')}</Text>
          <Text style={sy.mosaySm}>{t('mo_say_d')}</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <View style={[sy.saybox, sy.sayboxOpen]} accessibilityLabel={t('mo_say_t')}>
      {/* the open card's soft teal wash, fading to white below the microphone */}
      <SvgXml pointerEvents="none" style={StyleSheet.absoluteFillObject as object} width="100%" height="100%"
        xml={'<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><linearGradient id="sw" x1="0" y1="0" x2="0" y2="210" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#E6F2F1"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sw)"/></svg>'} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
        <SayBody title={t('mo_say_t')} onSaved={msg => { up(s => { s.sayOpen = false; }); toast(msg); }} />
      </View>
    </View>
  );
}

/* ---------- the + menu: Say it grows upward into the same card ---------- */

export function QuickSay({ width, maxHeight }: { width: number; maxHeight: number }) {
  const { t, up, toast } = useApp();
  return (
    <View style={[sy.qsay, { width }]}>
      <Animated.ScrollView style={{ maxHeight }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled">
        <SayBody title={t('qk_voice')} onSaved={msg => { up(s => { s.qSay = false; s.sheet = null; }); toast(msg); }} />
      </Animated.ScrollView>
    </View>
  );
}

export function QuickSayPill() {
  const { S, t, up, leaveSampleMonths } = useApp();
  return (
    <Pressable onPress={() => { if (S.demo) leaveSampleMonths(); up(s => { s.qSay = true; s.sayOpen = false; }); }} style={sy.qitem}
      accessibilityRole="button" accessibilityState={{ expanded: false }}>
      <Ico name="mic" size={22} color={C.brand} />
      <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, color: C.ink }}>{t('qk_voice')}</Text>
    </Pressable>
  );
}

const sy = StyleSheet.create({
  mosay: {
    flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', minHeight: 62,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: C.brand,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
  },
  mosayIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  mosayB: { fontFamily: DISP_FONT, fontSize: 16, color: C.ink },
  mosaySm: { fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 16, color: C.ink64, marginTop: 2 },
  saybox: { position: 'relative', borderRadius: 16, borderWidth: 1.5, borderColor: C.brand, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  sayboxOpen: {
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  vx: {
    position: 'absolute', right: -10, top: -8, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', left: 0, top: 2, minHeight: 19, paddingVertical: 1, paddingHorizontal: 8,
    borderRadius: 10, backgroundColor: C.caution,
  },
  badgeTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: C.ink },
  vmic: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(74,145,149,1)', shadowOpacity: 0.42, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
  vmicOn: { backgroundColor: C.short, shadowColor: 'rgba(241,89,42,1)' },
  vttl: { marginTop: 20, fontFamily: DISP_FONT, fontSize: 20, lineHeight: 26, color: C.ink, textAlign: 'center' },
  vostat: { marginTop: 4, fontFamily: BODY_FONT, fontSize: 14, lineHeight: 19, color: C.ink64, textAlign: 'center' },
  eyebrow: { fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase', color: C.ink64 },
  vsaid: { backgroundColor: '#EEF4F3', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
  vsaidTxt: { fontFamily: BODY_FONT, fontSize: 16, lineHeight: 23, fontStyle: 'italic', color: C.ink },
  input: {
    minHeight: 48, backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 16, color: C.ink, fontFamily: BODY_FONT,
  },
  btnLine: { fontFamily: BODY_FONT, fontSize: 16, color: C.ink, textDecorationLine: 'underline', textDecorationColor: C.brand },
  vent: { borderWidth: 1, borderColor: C.ink14, borderRadius: 16, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 4, backgroundColor: '#FFFFFF' },
  ventK: { fontFamily: XBOLD_FONT, fontSize: 11.5, letterSpacing: 0.7, textTransform: 'uppercase' },
  vflag: {
    marginLeft: 6, fontFamily: DISP_FONT, fontSize: 11, color: '#7A5800', backgroundColor: '#FFF3D1',
    borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden',
  },
  vswap: { fontFamily: BODY_FONT, fontSize: 12, color: C.brand, textDecorationLine: 'underline' },
  vrow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 46,
    borderTopWidth: 1, borderTopColor: C.ink14,
  },
  vrowK: { fontFamily: BODY_FONT, fontSize: 14, color: C.ink },
  vamtIn: {
    width: 110, minHeight: 40, textAlign: 'right', borderWidth: 1.5, borderColor: C.ink40, borderRadius: 10,
    paddingHorizontal: 10, fontSize: 16, color: C.ink, fontFamily: BODY_FONT, backgroundColor: C.paper,
  },
  select: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 10,
    borderWidth: 1.5, borderColor: C.ink40, borderRadius: 10, backgroundColor: C.paper, maxWidth: '100%',
  },
  selectTxt: { fontFamily: BODY_FONT, fontSize: 14, color: C.ink, flexShrink: 1 },
  selectList: {
    marginTop: 4, marginBottom: 6, borderWidth: 1, borderColor: C.ink14, borderRadius: 10, backgroundColor: C.paper,
    overflow: 'hidden', alignSelf: 'stretch', minWidth: 160,
  },
  selectOpt: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  noteC: {
    borderLeftWidth: 4, borderLeftColor: C.caution, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.card, borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  noteTxt: { fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink },
  btn: { minHeight: 52, backgroundColor: C.brand, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnTxt: { color: '#fff', fontFamily: DISP_FONT, fontSize: 19 },
  foot: { fontFamily: BODY_FONT, fontSize: 12, lineHeight: 17, color: C.ink64 },
  qsay: {
    backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden',
    shadowColor: 'rgba(31,44,45,1)', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
  qitem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 24,
    paddingHorizontal: 16, width: 200, minHeight: 46,
    shadowColor: 'rgba(31,44,45,1)', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
});
