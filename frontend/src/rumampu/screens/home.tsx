import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getHousingTestResult } from '../../../services/housingSession';
import { Route, useApp } from '../state';
import { expByMonth, monthsAgg, recSpan, rm } from '../calc';
import {
  planEnsure, planPhase, planResolveTarget, planSaved, planToggle, syncBufferTarget, upfrontNeed,
} from '../plan';
import { villageEnsure } from '../village';
import { IsoIsland } from '../isosvg';
import { BODY_FONT, C, DISP_FONT } from '../theme';
import { Btn, BodyS, Display } from '../ui';
import { ScreenShell } from './shell';


/* v22 home: total-saving hero + last-month income/expense card, a slim
   house-test row, then the saving-plan card with the village island. */


function arrowXml(up: boolean, color: string): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${up ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M5 12l7 7 7-7"/>'}</svg>`;
}

const HT_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3F7A7E" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/><path d="m9.3 14.8 2 2 3.6-4.2"/></svg>';

function Blob({ size, style, color }: { size: number; style: object; color: string }) {
  return <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/* .hero + .hero2 — the dark balance cards. */
function HomeCards() {
  const { S, t, monthName, go } = useApp();

  const monthKeyOf = (d: string) =>
    (+d.slice(0, 4)) * 12 + (+d.slice(5, 7) - 1);

  // Work out which month should be shown
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();

  const recordedKeys = new Set([
    ...S.data.income.map(e => monthKeyOf(e.d)),
    ...S.data.expenses.map(e => monthKeyOf(e.d)),
  ]);

  const key = recordedKeys.has(thisKey)
    ? thisKey
    : recordedKeys.size
      ? Math.max(...recordedKeys)
      : null;

  const income =
    key != null
      ? S.data.income
          .filter(e => monthKeyOf(e.d) === key)
          .reduce((sum, e) => sum + (+e.a || 0), 0)
      : 0;

  const ex =
    key != null
      ? S.data.expenses
          .filter(e => monthKeyOf(e.d) === key)
          .reduce((sum, e) => sum + (+e.a || 0), 0)
      : 0;

  const mn = key != null
    ? monthName(key % 12)
    : '';

  const gap = Math.max(
    0,
    upfrontNeed(S.data) - S.data.cashOnHand
  );

  const saving = income - ex;

  return (
    <View>
      <View style={st.hero}>
        <Blob
          size={150}
          color="rgba(74,145,149,0.55)"
          style={{ right: -60, top: -70 }}
        />

        <Blob
          size={90}
          color="rgba(254,200,68,0.9)"
          style={{ right: -22, top: -32 }}
        />

        <Blob
          size={120}
          color="rgba(50,177,74,0.55)"
          style={{ left: -60, bottom: -70 }}
        />

        <Text style={st.heroLbl}>
          {t('hm_saving')}
        </Text>

        <Text style={st.heroAmt}>
          {rm(saving)}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              flexShrink: 1,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  gap > 0 ? C.caution : C.confirm,
              }}
            />

            <Text
              style={{
                fontFamily: BODY_FONT,
                fontSize: 12.5,
                lineHeight: 16,
                color: 'rgba(255,255,255,0.88)',
                flexShrink: 1,
              }}
            >
              {gap > 0
                ? t('hm_togo', { g: rm(gap) })
                : t('hm_ready')}
            </Text>
          </View>

          <Pressable
            onPress={() => go('upfront')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 30,
            }}
          >
            <Text
              style={{
                fontFamily: BODY_FONT,
                fontSize: 13,
                color: '#fff',
              }}
            >
              {t('hm_mysav')}
            </Text>

            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#1F3F42',
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                ↓
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          st.hero,
          {
            flexDirection: 'row',
            marginTop: 10,
            paddingVertical: 14,
          },
        ]}
      >
        <Blob
          size={80}
          color="rgba(74,145,149,0.6)"
          style={{ left: -40, top: -40 }}
        />

        <Blob
          size={70}
          color="rgba(254,200,68,0.85)"
          style={{ right: -30, bottom: -35 }}
        />

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <SvgXml
            xml={arrowXml(true, '#5FD37A')}
            width={22}
            height={22}
          />

          <View
            style={{
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <Text
              style={st.heroLbl}
              numberOfLines={1}
            >
              {t('hm_income')}
              {mn ? ' · ' + mn : ''}
            </Text>

            <Text style={st.hero2Amt}>
              {rm(income)}
            </Text>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            borderLeftWidth: 1.5,
            borderLeftColor: 'rgba(255,255,255,0.25)',
            paddingLeft: 14,
          }}
        >
          <SvgXml
            xml={arrowXml(false, '#FF8A66')}
            width={22}
            height={22}
          />

          <View
            style={{
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <Text
              style={st.heroLbl}
              numberOfLines={1}
            >
              {t('hm_exp')}
              {mn ? ' · ' + mn : ''}
            </Text>

            <Text style={st.hero2Amt}>
              {rm(ex)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* .htrow — the slim house-test row under the balance cards. */
function HouseTestRow() {
  const { S, t, monthName, go } = useApp();
  const sp = recSpan(S.data);
  if (!sp) return null;
  const n = sp.list.length;
  const housingResult = getHousingTestResult();
  const tested = S.testRan && housingResult;
  const s = tested ? housingResult.short_month_count : 0;
  const g = tested ? housingResult.largest_gap : 0;
  const nn = tested ? (housingResult.tested_months ?? n) : n;
  const title = tested
    ? (s ? t('ht_short', { s, n: nn }) : t('ht_ok', { n: nn }))
    : t('ht_title');
  const sub = tested && s
    ? t('ht_gap', { g: rm(g) })
    : t('ht_rec', { n, a: monthName(sp.from.m), b: monthName(sp.to.m) });
  const warn = tested ? s > 0 : n < 4;
  return (
    <Pressable onPress={() => go(tested ? 'result' : 'house')} style={st.htrow}>
      <View style={st.htrowIc}><SvgXml xml={HT_SVG} width={22} height={22} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 14.5, lineHeight: 18, color: C.ink }}>{title}</Text>
        <Text style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 15, color: warn ? '#B7791F' : C.ink64, marginTop: 2 }}>{sub}</Text>
      </View>
      <View style={st.plbtn}>
        <Text style={st.plbtnTxt}>{tested ? t('ht_rego') : t('ht_go')}</Text>
      </View>
    </Pressable>
  );
}

/* .plcard — the saving-plan card with village island. */
export function PlanCard() {
  const { S, t, up, monthName, go, toast } = useApp();
  const { width } = useWindowDimensions();
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = getHousingTestResult();
  React.useEffect(() => {
    if (!S.plan || S.plan.key !== monthKey || !S.village) up(s => { planEnsure(s); villageEnsure(s); });
  }, [S.plan, S.village, monthKey, up]);
  React.useEffect(() => {
    up(s => { syncBufferTarget(s, result); planResolveTarget(s, result); });
  }, [result, up]);
  if (!S.plan || S.plan.key !== monthKey || !S.village) return null;

  /* Epic 10: the card follows the phase. Before a target honestly exists
     (setup/explain) home shows a slim hand-off to the plan screen. */
  const phase = planPhase(S, result);
  if (phase === 'setup' || phase === 'explain') {
    return (
      <Pressable onPress={() => go('plan')} style={st.plcard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>{t('pl_title')}</Text>
          <BodyS muted>›</BodyS>
        </View>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 18, lineHeight: 23, color: C.ink, marginTop: 8 }}>
          {t(phase === 'setup' ? 'p10_setup_t' : 'p10_explain_t')}
        </Text>
        <BodyS muted style={{ marginTop: 3 }}>
          {t(phase === 'setup' ? 'p10_setup_btn' : 'p10_explain_btn')}
        </BodyS>
      </Pressable>
    );
  }
  const inBuffer = phase === 'buffer';
  const b = S.buffer;

  const p = S.plan;
  const v = S.village;
  const today = new Date().getDate() - 1;
  const saved = planSaved(p);
  const pct = Math.min(100, Math.round(saved / p.target * 100));
  const doneN = p.done.filter(Boolean).length;
  const mx = Math.max(1, ...p.amounts);
  const nCells = v.cells.filter(Boolean).length;
  const best = Math.max(0, ...v.cells);
  let stats = `${t('vl_builtn', { b: v.built })} · ${t('vl_onplot', { n: nCells })}${best ? ' · ' + t('vl_best', { t: t('vl_t' + best) }) : ''}`;
  if ((v.collection ?? 0) > 0) stats += ` · ${t('vl_collect', { n: v.collection, a: rm(v.savedRm ?? 0) })}`;
  if ((v.queued ?? 0) > 0) stats += ` · ${t('vl_queue', { n: v.queued })}`;

  const toggleToday = () => {
    const wasDone = p.done[today];
    up(s => { planToggle(s, today); });
    toast(wasDone
      ? t('pl_untoast', { a: rm(p.amounts[today]) })
      : t('pl_toast', { a: rm(p.amounts[today]), c: rm(S.data.cashOnHand + p.amounts[today]) }));
  };

  return (
    <View style={st.plcard}>
      <Pressable onPress={() => go('plan')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: DISP_FONT, fontSize: 15, color: C.ink }}>
          {t('pl_title')} · {monthName(new Date().getMonth())}
        </Text>
        <BodyS muted>{t('pl_days', { d: doneN, n: p.n })} ›</BodyS>
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <View>
          <BodyS muted>{t('pl_today')}</BodyS>
          <Text style={{ fontFamily: DISP_FONT, fontSize: 28, lineHeight: 32, color: C.ink, fontVariant: ['tabular-nums'] }}>
            {rm(p.amounts[today])}
          </Text>
        </View>
        <Pressable onPress={toggleToday} style={[st.plbtn, p.done[today] && { backgroundColor: C.confirm }]}>
          <Text style={st.plbtnTxt}>{p.done[today] ? t('pl_saved_today') : t('pl_save_today')}</Text>
        </Pressable>
      </View>
      <View style={st.plbar}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: '#3F8A8E' }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <BodyS muted>{t('pl_progress', { s: rm(saved), t: rm(p.target) })}</BodyS>
        <BodyS muted>{pct}%</BodyS>
      </View>
      <Text style={{
        fontFamily: DISP_FONT, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase',
        color: C.ink64, marginTop: 12,
      }}>{t('vl_daily')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 54, marginTop: 8 }}>
        {p.amounts.map((a, i) => (
          <View key={i} style={{
            flex: 1, minHeight: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2,
            height: `${Math.max(6, Math.round(a / mx * 100))}%`,
            backgroundColor: p.done[i] ? C.brand : i === today ? C.ink : i < today ? '#F4D27A' : C.ink14,
          }} />
        ))}
      </View>
      {inBuffer ? (
        /* Shield phase: a filled meter, no tiles — the game opens later. */
        <BodyS muted style={{ marginTop: 10 }}>
          {t('p10_shield_t')} · {rm(b?.saved ?? 0)} / {rm(b?.target ?? 0)} · {t('p10_target_from')}
        </BodyS>
      ) : (
        <>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <IsoIsland cells={v.cells} width={Math.min(width, 390) - 72} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <BodyS muted style={{ flexShrink: 1 }}>{stats}</BodyS>
            <Pressable onPress={() => up(s => { villageEnsure(s).msg = ''; s.vHelp = false; s.sheet = 'vflash'; })} style={st.plbtn}>
              <Text style={st.plbtnTxt}>▶ {t('vl_play')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export function HomeScreen() {
  const { S, t, go, up } = useApp();
  const sp = recSpan(S.data);

  if (!sp) {
    /* Empty record: keep the start prompt; the plan card below hands off to
       a house test (setup phase) until a real target exists. */
    return (
      <ScreenShell brand>
        <Display cls="h-l">{t('inc_empty')}</Display>
        <Btn label={t('how_title')} onPress={() => up(s => { s.sheet = 'howworks'; })} />
        <Btn label={t('inc_add')} onPress={() => go('income')} />
        <PlanCard />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell brand>
      <HomeCards />
      <HouseTestRow />
      <Btn label={t('how_title')} onPress={() => up(s => { s.sheet = 'howworks'; })} />
      <PlanCard />
    </ScreenShell>
  );
}

const st = StyleSheet.create({
  hero: {
    position: 'relative', overflow: 'hidden', backgroundColor: '#25494D',
    borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    shadowColor: 'rgba(31,63,66,1)', shadowOpacity: 0.26, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroLbl: { fontFamily: BODY_FONT, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroAmt: { fontFamily: DISP_FONT, fontSize: 30, lineHeight: 34, marginTop: 1, color: '#fff', fontVariant: ['tabular-nums'] },
  hero2Amt: { fontFamily: DISP_FONT, fontSize: 19, lineHeight: 24, color: '#fff', fontVariant: ['tabular-nums'] },
  htrow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E3EAE8', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: 'rgba(60,81,82,1)', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  htrowIc: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#E4EFEC',
    alignItems: 'center', justifyContent: 'center',
  },
  plcard: {
    backgroundColor: '#F3F7F6', borderWidth: 1.5, borderColor: '#E3EAE8',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
  },
  plbtn: {
    minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  plbtnTxt: { fontFamily: DISP_FONT, fontSize: 13.5, color: '#fff' },
  plbar: { height: 10, borderRadius: 5, backgroundColor: C.ink14, overflow: 'hidden', marginTop: 12 },
});
