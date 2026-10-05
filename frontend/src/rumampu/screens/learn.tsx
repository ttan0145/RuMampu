import React from 'react';
import {
  Animated, Easing, Image, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { AppState, Route, useApp } from '../state';
import { rm } from '../calc';
import { legalFee, stampDutyLoan, stampDutyTransfer, ufSource } from '../fees';
import {
  LEARN, LN_META, LN_SPOT, LN_SRC, LN_TOPIC, LnArticle, LnBlock, LnSection,
  lnArt, lnBadges, lnDone, lnDoneIn, lnPct, lnPicOf, lnSecDone, lnSecOf, lnSeen,
} from '../learn-data';
import { ICONS } from '../svgs';
import { Ruma } from '../ruma-view';
import { BODY_FONT, C, DISP_FONT, SEMI_FONT, XBOLD_FONT } from '../theme';
import { BodyS, Display, Prov } from '../ui';
import { GuideTarget } from '../tour';
import { ScreenShell } from './shell';

/* v26/v27b What buying involves: learning with pictures, progress and badges.
   Progress counts pages read, so the House card, each topic and the whole
   section move together. A badge marks a finished topic; nothing is locked
   behind reading and nothing is taken away (change note on AC5.7.6). */

/* a lesson's "go" link names a prototype screen; these are ours */
const GO_ROUTE: Record<string, Route> = { famhome: 'homecosts', upfront: 'upfront', docs: 'docs', house: 'house' };

const CHECK = (color: string, size = 14) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

function iconXml(v: string, color: string, size: number, width = 1.7): string {
  const body = ICONS[v] || v;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

/* ---------- the badge ---------- */

export function LnBadge({ sec, size = 42, label = true, pop = false }: {
  sec: LnSection; size?: number; label?: boolean; pop?: boolean;
}) {
  const { S, t } = useApp();
  const on = lnSecDone(S.lnProg, sec);
  const m = LN_META[sec.id] || { ic: 'book' };
  const a = React.useRef(new Animated.Value(pop ? 0 : 1)).current;
  React.useEffect(() => {
    if (!pop) return;
    Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [pop, a]);
  const ring = on
    ? `<circle cx="24" cy="24" r="21" fill="#4A9195" stroke="#FEC844" stroke-width="3"/>`
    : `<circle cx="24" cy="24" r="21" fill="#F2F5F4" stroke="#C9D4D2" stroke-width="2" stroke-dasharray="4 3"/>`;
  const xml = `<svg viewBox="0 0 48 48" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${ring}`
    + `<g transform="translate(12 12)" fill="none" stroke="${on ? '#FFFFFF' : '#9FB0AE'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[m.ic] || ICONS.book}</g></svg>`;
  return (
    <View accessible accessibilityLabel={`${t(`ln_bd_${sec.id}`)}, ${t(on ? 'ln_bd_on' : 'ln_bd_off')}`}
      style={{ alignItems: 'center', flex: label ? 1 : undefined }}>
      <Animated.View style={{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
        <SvgXml xml={xml} width={size} height={size} />
      </Animated.View>
      {label ? (
        <Text style={[ls.badgeLbl, on && { color: C.ink, fontFamily: DISP_FONT }]}>{t(`ln_bd_${sec.id}`)}</Text>
      ) : null}
    </View>
  );
}

/* ---------- the section ---------- */

export function LearnScreen() {
  const { S, t, up, go } = useApp();
  const p = lnPct(S.lnProg);
  const fill = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fill, { toValue: p, duration: 1100, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [p, fill]);
  /* a badge pops once, when its topic has just been finished */
  React.useEffect(() => { if (S.lnPop) up(s => { s.lnPop = null; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ScreenShell back title={t('hh_learn')}>
      {S.lang !== 'en' ? <BodyS muted>{t('ln_en_only')}</BodyS> : null}
      <GuideTarget id="ln.hero">
        <View style={ls.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ruma w={66} pose="happy" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display cls="h-m">{t('ln_your')}</Display>
              <BodyS muted>{p ? t('ln_pct', { p }) : t('ln_start_h')}</BodyS>
            </View>
          </View>
          <View style={ls.big} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: p }}>
            <Animated.View style={[ls.bigFill, { width: fill.interpolate({ inputRange: [0, 100], outputRange: ['3%', '100%'] }) }]} />
          </View>
          <GuideTarget id="ln.badges" style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
            {LEARN.map(x => <LnBadge key={x.id} sec={x} pop={S.lnPop === x.id} />)}
          </GuideTarget>
        </View>
      </GuideTarget>
      <GuideTarget id="ln.secs" style={{ gap: 8 }}>
        {LEARN.map(x => {
          const d = lnDoneIn(S.lnProg, x), n = x.articles.length, m = LN_META[x.id] || { bg: '#E3F3F1' };
          const done = d === n;
          return (
            <Pressable key={x.id} accessibilityRole="button"
              onPress={() => { up(s => { s.lnTab = x.id; }); go('learnsec'); }}
              style={({ pressed }) => [ls.sc, pressed && { opacity: 0.9 }]}>
              <View style={[ls.scArt, { backgroundColor: m.bg }]}>
                {LN_TOPIC[x.id] ? (
                  <Image source={LN_TOPIC[x.id]} resizeMode="cover" style={[{ width: '100%', height: '100%' }, done && { opacity: 0.85 }]} />
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, justifyContent: 'center', gap: 6 }}>
                <Text style={[ls.scT, done && { color: C.ink }]}>{x.title}</Text>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 12.5, color: C.ink64 }}>{t('ln_sec_prog', { a: d, b: n })}</Text>
                <View style={ls.mini}><View style={[ls.miniFill, { width: `${Math.round(d / n * 100)}%` }]} /></View>
              </View>
              <Text style={ls.scGo}>{done ? '✓' : '›'}</Text>
            </Pressable>
          );
        })}
      </GuideTarget>
      {Object.keys(S.lnProg || {}).length ? (
        <Pressable onPress={() => up(s => { s.lnProg = {}; })} accessibilityRole="button"
          style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Text style={ls.reset}>{t('ln_reset')}</Text>
        </Pressable>
      ) : null}
    </ScreenShell>
  );
}

/* ---------- one topic ---------- */

function openLesson(a: LnArticle) {
  return (s: AppState) => {
    const k = lnSeen(s.lnProg, a);
    s.lnWas = lnSecDone(s.lnProg, lnSecOf(a));
    s.lnArtWas = lnDone(s.lnProg, a);
    s.lnTab = lnSecOf(a).id;
    s.lnArt = a.id;
    s.lnPg = (k && k < a.pages.length) ? k : 1;
    s.lnProg = s.lnProg || {};
    if ((s.lnProg[a.id] || 0) < s.lnPg) s.lnProg[a.id] = s.lnPg;
  };
}

export function LearnSecScreen() {
  const { S, t, up, go } = useApp();
  const sec = LEARN.find(x => x.id === S.lnTab) || LEARN[0];
  const done = lnDoneIn(S.lnProg, sec), n = sec.articles.length, m = LN_META[sec.id] || { bg: '#E3F3F1', ic: 'book' };
  return (
    <ScreenShell back title={sec.title}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LEARN.map(x => {
          const on = x === sec;
          return (
            <Pressable key={x.id} accessibilityRole="tab" accessibilityState={{ selected: on }}
              onPress={() => up(s => { s.lnTab = x.id; })}
              style={[ls.chip, on && ls.chipOn]}>
              {lnSecDone(S.lnProg, x) ? <SvgXml xml={CHECK(on ? '#fff' : C.ink)} width={14} height={14} /> : null}
              <Text style={{ fontFamily: SEMI_FONT, fontSize: 14, color: on ? C.paper : C.ink }}>{x.tab}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[ls.banner, { backgroundColor: m.bg }]}>
        {LN_TOPIC[sec.id] ? <Image source={LN_TOPIC[sec.id]} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : null}
      </View>
      <View style={{ gap: 7 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink, flexShrink: 1 }}>{sec.title}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 13, color: C.ink64, fontVariant: ['tabular-nums'] }}>{t('ln_sec_prog', { a: done, b: n })}</Text>
        </View>
        <View style={ls.bar}><View style={[ls.barFill, { width: `${Math.round(done / n * 100)}%` }]} /></View>
        {done === n ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <LnBadge sec={sec} label={false} pop={S.lnPop === sec.id} />
            <Text style={{ fontFamily: DISP_FONT, fontSize: 13.5, color: C.ink, flexShrink: 1 }}>{t('ln_sec_earned', { b: t(`ln_bd_${sec.id}`) })}</Text>
          </View>
        ) : (
          <BodyS muted style={{ marginTop: 6 }}>{t('ln_sec_badge', { n, b: t(`ln_bd_${sec.id}`) })}</BodyS>
        )}
      </View>
      <View style={{ gap: 10 }}>
        {sec.articles.map((a, i) => {
          const k = lnSeen(S.lnProg, a), fin = lnDone(S.lnProg, a);
          const pic = lnPicOf(a, 1);
          return (
            <Pressable key={a.id} accessibilityRole="button"
              accessibilityLabel={`${a.title}. ${fin ? t('ln_a_read') : k ? t('ln_a_part', { a: k, b: a.pages.length }) : t('ln_a_new')}`}
              onPress={() => { up(openLesson(a)); go('learnread'); }}
              style={[ls.card, fin && { opacity: 0.66 }]}>
              <View style={[ls.cart, pic ? ls.cartPic : null, { backgroundColor: m.bg }]}>
                {pic ? (
                  <Image source={pic} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                ) : (
                  <SvgXml xml={iconXml(LN_SPOT[a.id] || 'book', C.ink, 32)} width={32} height={32} />
                )}
                <View style={[ls.cartN, fin && { backgroundColor: C.confirm }]}>
                  <Text style={{ fontFamily: XBOLD_FONT, fontSize: 11.5, color: '#fff' }}>{i + 1}</Text>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, lineHeight: 19, color: C.ink }}>{a.title}</Text>
                <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 16, color: C.ink64, marginTop: 2 }}>{a.lead}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                {fin ? <SvgXml xml={CHECK(C.brand, 15)} width={15} height={15} /> : null}
                <Text style={{ fontFamily: fin || k ? DISP_FONT : SEMI_FONT, fontSize: 12, color: fin || k ? C.brand : C.ink64 }}>
                  {fin ? t('ln_read_done') : k ? `${k}/${a.pages.length}` : t('ln_pages', { n: a.pages.length })}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {sec.epf ? (
        <>
          <View style={ls.noteC}><Text style={[ls.noteTx, { fontSize: 15, lineHeight: 22 }]}>{t('ln_epf')}</Text></View>
          <LnLink label={t('ln_epf_btn')} ext onPress={() => { void Linking.openURL('https://www.kwsp.gov.my'); }} />
        </>
      ) : null}
    </ScreenShell>
  );
}

/* ---------- the reader ---------- */

function LnLink({ label, onPress, ext }: { label: string; onPress: () => void; ext?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={ext ? 'link' : 'button'} style={({ pressed }) => [ls.lnk, pressed && { opacity: 0.85 }]}>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 15, color: C.ink, flexShrink: 1 }}>{label}</Text>
      <Text style={{ fontSize: 16, color: C.ink }}>{ext ? '↗' : '›'}</Text>
    </Pressable>
  );
}

/* [[Term|definition]]: the term is a button in the sentence; its definition opens below. */
function TermText({ text, style }: { text: string; style: object }) {
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  const parts: { s: string; term?: string; def?: string }[] = [];
  const re = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ s: text.slice(last, m.index) });
    parts.push({ s: m[1], term: m[1], def: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ s: text.slice(last) });
  return (
    <View>
      <Text style={style}>
        {parts.map((p, i) => p.term ? (
          <Text key={i} onPress={() => setOpen(o => ({ ...o, [i]: !o[i] }))} accessibilityRole="button"
            accessibilityState={{ expanded: !!open[i] }}
            style={[ls.term, open[i] && { textDecorationStyle: 'solid' }]}>{p.s}</Text>
        ) : <Text key={i}>{p.s}</Text>)}
      </Text>
      {parts.map((p, i) => (p.term && open[i] ? (
        <View key={`d${i}`} style={ls.def}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.ink, marginBottom: 2 }}>{p.term}</Text>
          <Text style={{ fontFamily: BODY_FONT, fontSize: 14.5, lineHeight: 21, color: C.ink }}>{p.def}</Text>
        </View>
      ) : null))}
    </View>
  );
}

/* US5.5.6: where an explanation lands on the person's own tested home. Same fee
   functions as Upfront cash, so the two screens always agree. */
function Mine({ kind }: { kind: string }) {
  const { S, t, go } = useApp();
  const src = ufSource(S), price = +src.price || 0, dep = +src.dep || 0, loan = Math.max(0, price - dep);
  if (!(price > 0)) {
    return (
      <View style={ls.mine}>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 14.5, lineHeight: 21, color: C.ink64 }}>{t('ln_mine_none')}</Text>
        <View style={{ marginTop: 10 }}><LnLink label={t('ln_test_btn')} onPress={() => go('house')} /></View>
      </View>
    );
  }
  const home = src.name ? `${src.name}, ${rm(price)}` : rm(price);
  let v: string, txt: string, p: string;
  if (kind === 'sjkp120') {
    const x = price * 1.2; v = rm(x); p = 'calc';
    txt = `120% of your ${rm(price)} home is ${rm(x)}. ${x <= 360000 ? 'That is within the RM360,000 limit.' : 'That is above the RM360,000 limit, so RM360,000 is the most SJKP MADANI would cover.'}`;
  } else if (kind === 'deposit') {
    v = rm(dep); p = 'user';
    txt = `The deposit you tested with on your ${rm(price)} home.${dep === 0 ? ' A test with RM0 deposit is allowed.' : ''}`;
  } else if (kind === 'legal') {
    const a = legalFee(price), b = loan > 0 ? legalFee(loan) : 0; v = rm(a + b); p = 'calc';
    txt = `Legal fees of ${rm(a)} on the purchase${loan > 0 ? ` and ${rm(b)} on a ${rm(loan)} loan` : ''}, for your ${rm(price)} home.`;
  } else if (kind === 'exempt') {
    p = 'calc';
    if (price <= 500000) {
      const a = stampDutyTransfer(price), b = loan > 0 ? stampDutyLoan(loan) : 0; v = rm(a + b);
      txt = `What the exemption would save on your ${rm(price)} home, if it applies to you: ${rm(a)} on the transfer${loan > 0 ? ` and ${rm(b)} on a ${rm(loan)} loan` : ''}.`;
    } else { v = rm(0); txt = 'Your tested price is above RM500,000, so this exemption would not apply to it.'; }
  } else {
    /* valuation: an assumed 5% lower valuation, the bank lending the same share */
    p = 'assume';
    if (loan <= 0) { v = rm(0); txt = 'You tested without a loan, so a lower valuation would not change what you pay upfront.'; } else {
      const low = Math.round(price * 0.95), lowLoan = Math.round(low * loan / price); v = rm(loan - lowLoan);
      txt = `Extra cash you would need if your ${rm(price)} home were valued 5% lower, at ${rm(low)}, and the bank lent the same share of it. The loan would fall from ${rm(loan)} to ${rm(lowLoan)}.`;
    }
  }
  return (
    <View style={ls.mine}>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink64 }}>{t('ln_mine_who', { h: home })}</Text>
      <Text style={ls.mineV}>{v}</Text>
      <Text style={{ fontFamily: BODY_FONT, fontSize: 14.5, lineHeight: 21, color: C.ink, marginTop: 6 }}>{txt}</Text>
      <View style={{ marginTop: 10 }}><Prov p={p} /></View>
    </View>
  );
}

function Block({ b, onJump }: { b: LnBlock; onJump: (id: string) => void }) {
  const { go } = useApp();
  if ('p' in b) return <TermText text={b.p} style={ls.p} />;
  if ('ul' in b) {
    return (
      <View style={{ gap: 9 }}>
        {b.ul.map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 11 }}>
            <View style={ls.dotUl} />
            <Text style={[ls.li, { flex: 1 }]}>{x}</Text>
          </View>
        ))}
      </View>
    );
  }
  if ('steps' in b) {
    const st0 = b.start || 1;
    return (
      <View style={{ gap: 12 }}>
        {b.steps.map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={ls.stepN}><Text style={{ fontFamily: XBOLD_FONT, fontSize: 12, color: '#fff' }}>{st0 + i}</Text></View>
            <View style={{ flex: 1 }}><TermText text={x} style={ls.li} /></View>
          </View>
        ))}
      </View>
    );
  }
  if ('mine' in b) return <Mine kind={b.mine} />;
  if ('note' in b) return <View style={ls.noteC}><Text style={[ls.noteTx, { fontSize: 15, lineHeight: 22 }]}>{b.note}</Text></View>;
  if ('ext' in b) return <LnLink label={b.ext.label} ext onPress={() => { void Linking.openURL(b.ext.href); }} />;
  if ('go' in b) return <LnLink label={b.go.label} onPress={() => go(GO_ROUTE[b.go.to] || 'househome')} />;
  if ('jump' in b) return <LnLink label={b.jump.label} onPress={() => onJump(b.jump.a)} />;
  return null;
}

export function LearnReadScreen() {
  const { S, t, up, backNav, toast } = useApp();
  const a = lnArt(S.lnArt) || LEARN[0].articles[0];
  const sec = lnSecOf(a), n = a.pages.length, pg = Math.min(Math.max(1, S.lnPg || 1), n), last = pg === n;
  const seen = Math.max(lnSeen(S.lnProg, a), pg);
  const srcs = (a.src || []).map(k => LN_SRC[k]).filter(Boolean);
  const fade = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [pg, a.id, fade]);

  const step = (d: number) => up(s => {
    s.lnPg = Math.min(n, Math.max(1, (s.lnPg || 1) + d));
    if ((s.lnProg[a.id] || 0) < s.lnPg) s.lnProg[a.id] = s.lnPg;
  });
  const finish = () => {
    let celebrate = false;
    up(s => {
      s.lnProg[a.id] = Math.max(s.lnProg[a.id] || 0, n);
      if (s.lnWas === false && lnSecDone(s.lnProg, sec)) { s.lnCele = sec.id; s.lnPop = sec.id; celebrate = true; }
      s.lnWas = null;
    });
    backNav();
    setTimeout(() => { if (!celebrate) toast(t('ln_art_done')); }, 0);
  };

  const footer = (
    <View style={ls.nav}>
      <Pressable onPress={() => step(-1)} disabled={pg === 1} accessibilityRole="button"
        style={[ls.navBtn, { backgroundColor: C.card }, pg === 1 && { opacity: 0.4 }]}>
        <Text style={[ls.navTx, { color: C.ink }]}>{t('ln_prev')}</Text>
      </Pressable>
      <Pressable onPress={() => (last ? finish() : step(1))} accessibilityRole="button"
        style={[ls.navBtn, { backgroundColor: C.brand, flex: 1.4 }]}>
        <Text style={[ls.navTx, { color: '#fff' }]}>{t(last ? 'ln_finish' : 'ln_next')}</Text>
      </Pressable>
    </View>
  );

  return (
    <ScreenShell back title={sec.title} footer={footer}>
      <View style={[ls.pic, { backgroundColor: (LN_META[sec.id] || { bg: '#E3F3F1' }).bg }]}>
        <Image source={lnPicOf(a, pg)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      </View>
      {S.lnArtWas ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 }}>
          <SvgXml xml={'<svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#32B14A"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'} width={22} height={22} />
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: '#1E7A33' }}>{t('ln_completed')}</Text>
        </View>
      ) : null}
      <View>
        <Display cls="h-l">{a.title}</Display>
        <View style={{ flexDirection: 'row', gap: 4, height: 6, marginTop: 14 }} accessibilityElementsHidden>
          {a.pages.map((_, i) => <View key={i} style={{ flex: 1, borderRadius: 3, backgroundColor: i < seen ? C.brand : C.ink14 }} />)}
        </View>
        <Text style={{ marginTop: 8, fontFamily: BODY_FONT, fontSize: 13, color: C.ink64, fontVariant: ['tabular-nums'] }}>{t('ln_page', { a: pg, b: n })}</Text>
      </View>
      <Animated.View style={{ opacity: fade, gap: 16, paddingTop: 6, paddingBottom: 12 }}>
        {a.pages[pg - 1].map((b, i) => (
          <Block key={`${pg}-${i}`} b={b} onJump={id => {
            const target = lnArt(id);
            /* a jump replaces the page being read, so Back still returns to the list */
            if (target) up(openLesson(target));
          }} />
        ))}
        {last ? (
          <View style={{ borderTopWidth: 1, borderTopColor: C.ink14, paddingTop: 12, gap: 6 }}>
            {srcs.length ? <Prov p="official" /> : null}
            {srcs.map(x => (
              <Text key={x.h} style={ls.src}>
                {t('ln_src')}: {x.n},{' '}
                <Text onPress={() => { void Linking.openURL(x.h); }} style={{ textDecorationLine: 'underline', textDecorationColor: C.ink40 }}>
                  {x.h.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </Text>
                . {t('ln_checked', { d: x.d })}.
              </Text>
            ))}
            {a.draft ? <Text style={[ls.src, { color: C.ink64 }]}>{t('ln_draft')}</Text> : null}
            <Text style={[ls.src, { color: C.ink64, marginTop: 2 }]}>{t('ln_adv')}</Text>
          </View>
        ) : null}
      </Animated.View>
    </ScreenShell>
  );
}

/* ---------- a finished topic: its badge first, with a little confetti ---------- */

export function LearnCele() {
  const { S, t, up } = useApp();
  const sec = LEARN.find(x => x.id === S.lnCele);
  const fall = React.useRef(new Animated.Value(0)).current;
  const card = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!sec) return;
    fall.setValue(0); card.setValue(0);
    Animated.timing(fall, { toValue: 1, duration: 1900, easing: Easing.bezier(0.3, 0.6, 0.4, 1), useNativeDriver: true }).start();
    Animated.spring(card, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [sec, fall, card]);
  if (!sec) return null;
  const close = () => up(s => { s.lnCele = null; });
  const cols = ['#4A9195', '#FEC844', '#32B14A', '#F1592A', '#A6D3D4'];
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 70 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,34,35,0.55)' }]} onPress={close} accessibilityLabel={t('ln_cele_btn')} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        {Array.from({ length: 30 }).map((_, i) => (
          <Animated.View key={i} style={{
            position: 'absolute', top: -16, left: `${3 + ((i * 37) % 94)}%`, width: 8, height: 13, borderRadius: 2,
            backgroundColor: cols[i % 5],
            transform: [
              { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 700 + (i % 7) * 30] }) },
              { rotate: `${(i * 47) % 360}deg` },
            ],
            opacity: fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          }} />
        ))}
      </View>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View accessibilityViewIsModal accessibilityLiveRegion="polite" style={[ls.cele, {
          opacity: card, transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }]}>
          <LnBadge sec={sec} size={88} label={false} pop />
          <Text style={{ fontFamily: DISP_FONT, fontSize: 13, color: C.ink }}>{t(`ln_bd_${sec.id}`)}</Text>
          <Display cls="h-m">{t('ln_cele_t')}</Display>
          <BodyS style={{ textAlign: 'center' }}>{t('ln_cele_b', { s: sec.title, b: t(`ln_bd_${sec.id}`) })}</BodyS>
          <Pressable onPress={close} accessibilityRole="button" style={ls.celeBtn}>
            <Text style={{ fontFamily: DISP_FONT, fontSize: 17, color: '#fff' }}>{t('ln_cele_btn')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/* A way into a topic from elsewhere (Upfront cash, the document checklist). */
export function LnEnter({ tab, k }: { tab: string; k: string }) {
  const { t, up, go } = useApp();
  return <LnLink label={t(k)} onPress={() => { up(s => { s.lnTab = tab; }); go('learnsec'); }} />;
}

/* the House card's strip: pages read and badges earned */
export function LearnStrip() {
  const { S, t } = useApp();
  const p = lnPct(S.lnProg), b = lnBadges(S.lnProg);
  return (
    <View style={{ gap: 7, width: '100%' }}>
      <View style={{ height: 8, borderRadius: 5, backgroundColor: C.ink14, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(p ? 4 : 0, p)}%`, height: '100%', borderRadius: 5, backgroundColor: C.confirm }} />
      </View>
      <Text style={{ fontFamily: SEMI_FONT, fontSize: 12, color: p ? C.brand : C.ink64 }}>
        {t('ln_strip', { p, a: b, b: LEARN.length })}
      </Text>
    </View>
  );
}

const ls = StyleSheet.create({
  hero: {
    borderRadius: 22, backgroundColor: '#EAF5F4', borderWidth: 1, borderColor: C.ink14,
    paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, overflow: 'hidden',
  },
  big: { height: 12, borderRadius: 8, backgroundColor: 'rgba(60,81,82,0.12)', overflow: 'hidden', marginTop: 12 },
  bigFill: { height: '100%', borderRadius: 8, backgroundColor: '#3FA06A' },
  badgeLbl: { fontFamily: BODY_FONT, fontSize: 9.5, lineHeight: 12, color: C.ink64, textAlign: 'center', marginTop: 3 },
  sc: {
    flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.ink14,
    borderRadius: 18, overflow: 'hidden', minHeight: 106,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  scArt: { width: 112, borderTopRightRadius: 56, borderBottomRightRadius: 56, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scT: { fontFamily: DISP_FONT, fontSize: 15.5, lineHeight: 20, color: '#1F6E73' },
  scGo: { alignSelf: 'center', paddingRight: 12, color: C.brand, fontSize: 22, fontWeight: '700' },
  mini: { height: 8, borderRadius: 5, backgroundColor: 'rgba(60,81,82,0.12)', overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 5, backgroundColor: C.brand },
  reset: { fontFamily: BODY_FONT, fontSize: 13, color: C.ink64, textDecorationLine: 'underline' },
  chip: {
    minHeight: 40, paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  banner: { borderRadius: 22, aspectRatio: 16 / 9, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 4, backgroundColor: C.ink14, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: C.brand },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.ink14,
    borderRadius: 16, paddingVertical: 8, paddingLeft: 8, paddingRight: 12,
  },
  cart: { width: 62, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cartPic: { width: 92, height: 64, padding: 0 },
  cartN: {
    position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF',
  },
  noteC: {
    borderLeftWidth: 4, borderLeftColor: C.caution, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.card, borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  noteTx: { fontFamily: BODY_FONT, fontSize: 13, lineHeight: 18, color: C.ink },
  lnk: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 52,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.ink14, borderRadius: 14, paddingHorizontal: 16,
  },
  pic: { borderRadius: 22, overflow: 'hidden', aspectRatio: 16 / 10, marginTop: 2 },
  p: { fontFamily: BODY_FONT, fontSize: 17, lineHeight: 27, color: C.ink },
  li: { fontFamily: BODY_FONT, fontSize: 16.5, lineHeight: 25, color: C.ink },
  dotUl: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.brand, marginTop: 11, marginLeft: 2 },
  stepN: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  term: {
    fontFamily: SEMI_FONT, color: C.ink, textDecorationLine: 'underline', textDecorationStyle: 'dotted',
    textDecorationColor: C.brand,
  },
  def: { marginTop: 10, backgroundColor: C.card, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13 },
  mine: { borderWidth: 1.5, borderColor: C.brand, borderRadius: 18, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(74,145,149,0.06)' },
  mineV: { fontFamily: XBOLD_FONT, fontSize: 34, lineHeight: 40, marginTop: 4, color: C.ink, fontVariant: ['tabular-nums'] },
  src: { fontFamily: BODY_FONT, fontSize: 13, lineHeight: 19, color: C.ink },
  nav: {
    flexDirection: 'row', gap: 10, paddingTop: 12, paddingBottom: 12, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: C.ink14, backgroundColor: C.paper,
  },
  navBtn: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  navTx: { fontFamily: DISP_FONT, fontSize: 17 },
  cele: {
    backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 16,
    width: '82%', maxWidth: 320, alignItems: 'center', gap: 8,
  },
  celeBtn: { marginTop: 6, minHeight: 52, alignSelf: 'stretch', borderRadius: 14, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
});
