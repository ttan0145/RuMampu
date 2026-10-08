import React from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ISO_TIERS } from './village';

/* v22 isometric village tiles — SVG strings ported verbatim from the prototype,
   rendered through SvgXml. */

const ISO_GROUND =
  '<polygon points="60,102 112,76 60,50 8,76" fill="#A8CE9E"/>' +
  '<polygon points="60,102 112,76 112,83 60,109" fill="#86B07C"/>' +
  '<polygon points="60,102 8,76 8,83 60,109" fill="#6F9866"/>';

export const ISO_BODY: Record<string, string> = {
  pondok: '<polygon points="36,80 60,92 60,66 36,54" fill="#C89F63"/>' +
    '<polygon points="84,80 60,92 60,66 84,54" fill="#A87F45"/>' +
    '<polygon points="62,86 72,81 72,68 62,73" fill="#5B4226"/>' +
    '<polygon points="60,32 28,58 60,72" fill="#8A6A3E"/>' +
    '<polygon points="60,32 92,58 60,72" fill="#6E5330"/>' +
    '<circle cx="60" cy="32" r="3" fill="#5B4226"/>',
  kampung: '<polygon points="34,78 60,90 60,58 34,46" fill="#EBDCBC"/>' +
    '<polygon points="86,78 60,90 60,58 86,46" fill="#D3BE97"/>' +
    /* a full roof over the walls (it used to be two thin strips with an empty gap) */
    '<polygon points="60,24 25,47 60,63" fill="#6B8688"/>' +
    '<polygon points="60,24 95,47 60,63" fill="#52696B"/>' +
    '<polyline points="25,47 60,63 95,47" fill="none" stroke="#3F5455" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<polygon points="64,72 76,66 76,57 64,63" fill="#35494A"/>' +
    '<polygon points="42,73 52,78 52,64 42,59" fill="#7A5C33"/>',
  teres: '<polygon points="60,30 90,45 60,60 30,45" fill="#F0EAD9"/>' +
    '<polygon points="30,45 60,60 60,94 30,79" fill="#E6DFC9"/>' +
    '<polygon points="90,45 60,60 60,94 90,79" fill="#CEC5A8"/>' +
    '<polygon points="66,66 82,58 82,64 66,72" fill="#35494A"/>' +
    '<polygon points="66,78 82,70 82,76 66,84" fill="#35494A"/>' +
    '<polygon points="38,72 48,77 48,89 38,84" fill="#4E6668"/>',
  kondo: '<polygon points="60,22 86,35 60,48 34,35" fill="#DDEBEA"/>' +
    '<polygon points="34,35 60,48 60,98 34,85" fill="#7FA6AA"/>' +
    '<polygon points="86,35 60,48 60,98 86,85" fill="#5E878B"/>' +
    '<polygon points="64,58 82,49 82,54 64,63" fill="#DFF3F2" opacity=".9"/>' +
    '<polygon points="64,70 82,61 82,66 64,75" fill="#DFF3F2" opacity=".9"/>' +
    '<polygon points="64,82 82,73 82,78 64,87" fill="#DFF3F2" opacity=".9"/>' +
    '<polygon points="38,53 56,62 56,67 38,58" fill="#B9D2D3" opacity=".8"/>' +
    '<polygon points="38,65 56,74 56,79 38,70" fill="#B9D2D3" opacity=".8"/>',
  istana: '<polygon points="30,80 60,94 60,64 30,50" fill="#EFE6D2"/>' +
    '<polygon points="90,80 60,94 60,64 90,50" fill="#D8CBAC"/>' +
    '<polygon points="60,30 26,52 60,66" fill="#E7B93B"/>' +
    '<polygon points="60,30 94,52 60,66" fill="#C79612"/>' +
    '<polygon points="60,16 44,28 60,36" fill="#F2CD5C"/>' +
    '<polygon points="60,16 76,28 60,36" fill="#D9A81F"/>' +
    '<line x1="60" y1="16" x2="60" y2="4" stroke="#6B4F1F" stroke-width="2.4"/>' +
    '<polygon points="60,4 75,8 60,12" fill="#E24A1B"/>' +
    '<polygon points="64,84 76,78 76,66 64,72" fill="#6B4F2A"/>',
};

/* One tier on its ground tile (used by the legend). */
export function isoHouseXml(tierId: string): string {
  return `<svg viewBox="0 0 120 118" xmlns="http://www.w3.org/2000/svg">${ISO_GROUND}${ISO_BODY[tierId] || ''}</svg>`;
}

/* One contiguous isometric island: shared tile edges, a thick base, houses drawn back to front. */
export function isoIslandXml(cells: number[], glow: number[] = []): string {
  const cx = 220, cy = 165, tw = 52, th = 26, base = 16;
  const top = cy - 4 * th, right = cx + 4 * tw, bottom = cy + 4 * th, left = cx - 4 * tw;
  let s = '<svg viewBox="0 0 440 292" xmlns="http://www.w3.org/2000/svg">';
  s += `<polygon points="${left},${cy} ${cx},${bottom} ${cx},${bottom + base} ${left},${cy + base}" fill="#7FA275"/>`;
  s += `<polygon points="${right},${cy} ${cx},${bottom} ${cx},${bottom + base} ${right},${cy + base}" fill="#6B8F62"/>`;
  s += `<polygon points="${cx},${top} ${right},${cy} ${cx},${bottom} ${left},${cy}" fill="#B9D9AE"/>`;
  for (let k = 1; k < 4; k++) {
    s += `<line x1="${cx - k * tw}" y1="${cy + (k - 4) * th}" x2="${cx + (4 - k) * tw}" y2="${cy + k * th}" stroke="#A3C797" stroke-width="1.5"/>`;
    s += `<line x1="${cx + k * tw}" y1="${cy + (k - 4) * th}" x2="${cx - (4 - k) * tw}" y2="${cy + k * th}" stroke="#A3C797" stroke-width="1.5"/>`;
  }
  /* the square a saved day just filled, lit gold under its house */
  for (const i of glow) {
    const r = i >> 2, c = i & 3, x = cx + (c - r) * tw, y = cy + (c + r - 3) * th;
    s += `<polygon points="${x},${y - th} ${x + tw},${y} ${x},${y + th} ${x - tw},${y}" fill="#FFD66B" stroke="#E2A93B" stroke-width="2.5"/>`;
  }
  const order: number[] = [];
  for (let i = 0; i < 16; i++) if (cells[i]) order.push(i);
  order.sort((a, b) => (((a >> 2) + (a & 3)) - ((b >> 2) + (b & 3))) || ((a >> 2) - (b >> 2)));
  for (const i of order) {
    const r = i >> 2, c = i & 3, x = cx + (c - r) * tw, y = cy + (c + r - 3) * th;
    s += `<g transform="translate(${x - 60},${y - 76})">${ISO_BODY[ISO_TIERS[cells[i] - 1]]}</g>`;
  }
  return s + '</svg>';
}

/* A house drawn on its own, so it can travel across the plot. */
function isoBodyXml(tier: number): string {
  return `<svg viewBox="0 0 120 118" xmlns="http://www.w3.org/2000/svg">${ISO_BODY[ISO_TIERS[tier - 1]] || ''}</svg>`;
}
const SLIDE_MS = 190;

/* burst: change it (e.g. to the save time) to play a short "+1" above the first glowing square.
   slide + slideKey: when slideKey changes, every house in slide travels from its square to
   where the move took it (two that merge meet on one square), then the plot redraws. */
export function IsoIsland({ cells, width, glow = [], burst, slide, slideKey }: {
  cells: number[]; width: number; glow?: number[]; burst?: number;
  slide?: Array<{ f: number; t: number; tier: number }>; slideKey?: number;
}) {
  const h = width * 292 / 440, k = width / 440;
  const anim = React.useRef(new Animated.Value(1)).current;
  const move = React.useRef(new Animated.Value(1)).current;
  const [still, setStill] = React.useState(false);
  const [sliding, setSliding] = React.useState<Array<{ f: number; t: number; tier: number }> | null>(null);
  React.useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined); }, []);
  const firstKey = React.useRef(slideKey);
  React.useEffect(() => {
    /* only a move made while this plot is on screen slides, not the one before it opened */
    if (slideKey === firstKey.current) return;
    firstKey.current = slideKey;
    if (still || !slide || !slide.some(m => m.f !== m.t)) return;
    setSliding(slide);
    move.setValue(0);
    Animated.timing(move, { toValue: 1, duration: SLIDE_MS, easing: Easing.out(Easing.quad), useNativeDriver: false })
      .start(() => setSliding(null));
  }, [slideKey, slide, still, move]);
  React.useEffect(() => {
    if (!burst || still) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [burst, still, anim]);
  const g = glow[0];
  const gx = g == null ? 0 : (220 + ((g & 3) - (g >> 2)) * 52) * k;
  const gy = g == null ? 0 : (165 + ((g & 3) + (g >> 2) - 3) * 26) * k;
  const at = (i: number) => ({ x: (220 + ((i & 3) - (i >> 2)) * 52) * k, y: (165 + ((i & 3) + (i >> 2) - 3) * 26) * k });
  if (sliding) {
    /* back to front by where each house ends up, as the still plot draws them */
    const depth = (i: number) => ((i >> 2) + (i & 3)) * 4 + (i >> 2);
    const order = [...sliding].sort((a, b) => depth(a.t) - depth(b.t));
    return (
      <View style={{ width, height: h }}>
        <SvgXml xml={isoIslandXml(new Array(16).fill(0))} width={width} height={h} />
        {order.map((m, n) => {
          const a = at(m.f), b = at(m.t);
          return (
            <Animated.View key={`${m.f}-${n}`} pointerEvents="none" style={{
              position: 'absolute', left: a.x - 60 * k, top: a.y - 76 * k, width: 120 * k, height: 118 * k,
              transform: [
                { translateX: move.interpolate({ inputRange: [0, 1], outputRange: [0, b.x - a.x] }) },
                { translateY: move.interpolate({ inputRange: [0, 1], outputRange: [0, b.y - a.y] }) },
              ],
            }}>
              <SvgXml xml={isoBodyXml(m.tier)} width={120 * k} height={118 * k} />
            </Animated.View>
          );
        })}
      </View>
    );
  }
  return (
    <View style={{ width, height: h }}>
      <SvgXml xml={isoIslandXml(cells, glow)} width={width} height={h} />
      {g != null && burst && !still ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', left: gx - 20, top: gy - 70 * k - 18, width: 40, alignItems: 'center',
          opacity: anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, -22] }) }],
        }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#B97F00' }}>+1</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function IsoHouse({ tier, size }: { tier: string; size: number }) {
  return <SvgXml xml={isoHouseXml(tier)} width={size} height={size * 118 / 120} />;
}
