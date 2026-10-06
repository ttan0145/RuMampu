import React from 'react';
import Svg, { Defs, Path, Pattern, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { C, DISP_FONT, SEMI_FONT } from './theme';
import { PX_GROUPS, PX_GROUP_OF, PxGroup } from './pxmap';

/* One district outline map, shared by House costs and the Price Explorer. Every
   state has a map (Selangor, Kuala Lumpur and Putrajaya share one); districts with
   a figure are filled and tappable, the rest are hatched. Labels shrink to fit
   each district and drop out where a district is too small to hold them. */

const SHORT: Record<string, string> = {
  'Kuala Lumpur': 'KL', Putrajaya: "P'jaya", 'Seberang Perai Utara': 'SP Utara', 'Seberang Perai Tengah': 'SP Tengah',
  'Seberang Perai Selatan': 'SP Selatan', 'Daerah Kecil Muadzam Shah': 'Muadzam Shah',
};
export const shortName = (d: string): string => SHORT[d] ?? d.replace(/^Bahagian /, '');

export const groupOf = (stateCode: string): PxGroup | null => PX_GROUPS[PX_GROUP_OF[stateCode.toUpperCase()] ?? ''] ?? null;

/* font size that lets `text` sit inside a district with `room` px around its label point */
function fit(text: string, room: number, max: number): number {
  const byWidth = (room * 2.3) / Math.max(1, text.length * 0.56);
  return Math.min(max, byWidth, room * 0.75);
}

export function OutlineMap({ stateCode, fill, value, dark, sel, onPick, canPick, label, hatchId = 'omhatch' }: {
  stateCode: string;
  /* the district's fill, or null when it has no figure here (drawn hatched, not tappable) */
  fill: (district: string) => string | null;
  /* the figure under the name, e.g. "RM 480k" or "36%" */
  value: (district: string) => string | null;
  /* true where the fill is dark enough for white text */
  dark: (district: string) => boolean;
  sel: string | null;
  onPick: (district: string) => void;
  /* which districts can be tapped; by default the filled ones */
  canPick?: (district: string) => boolean;
  label: string;
  hatchId?: string;
}) {
  const g = groupOf(stateCode);
  if (!g) return null;
  const names = Object.keys(g.d);
  const order = [...names.filter(n => n !== sel), ...names.filter(n => n === sel)];
  const thin = names.length > 14;
  return (
    <Svg viewBox={`0 0 ${g.w} ${g.h}`} width="100%" style={{ aspectRatio: g.w / g.h }} accessibilityLabel={label}>
      <Defs>
        <Pattern id={hatchId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={6} height={6} fill="#F2F5F4" />
          <Path d="M0 0v6" stroke="#C9D4D2" strokeWidth={2} />
        </Pattern>
      </Defs>
      {order.map(n => {
        const f = fill(n), tap = canPick ? canPick(n) : !!f;
        return (
          <Path key={n} d={g.d[n].d} fill={f ?? `url(#${hatchId})`}
            stroke={n === sel ? C.caution : '#FFFFFF'} strokeWidth={n === sel ? 3.5 : thin ? 0.9 : 1.4} strokeLinejoin="round"
            onPress={tap ? () => onPick(n) : undefined} accessibilityLabel={`${n}${value(n) ? `: ${value(n)}` : ''}`}
            testID={`map-${n}`} />
        );
      })}
      {names.map(n => {
        const s = g.d[n], v = value(n), nm = shortName(n), filled = !!fill(n);
        if (!v) {
          /* no figure: a quiet name where there is room for it */
          if (s.r < 9) return null;
          const f = fit(nm, s.r, 7);
          return f < 5 ? null : (
            <SvgText key={`l-${n}`} x={s.x} y={s.y + f / 3} textAnchor="middle" pointerEvents="none" fill="#7A8A8B"
              fontSize={f} fontFamily={SEMI_FONT}>{nm}</SvgText>
          );
        }
        const fName = fit(nm, s.r, 8.5), fVal = fit(v, s.r, 8.5);
        const color = !filled ? '#5B6E6F' : dark(n) ? '#FFFFFF' : '#1F2D2E';
        if (fName >= 5 && s.r >= fName * 1.1) {
          const f = Math.min(fName, fVal + 0.5);
          return (
            <SvgText key={`l-${n}`} x={s.x} y={s.y - f * 0.15} textAnchor="middle" pointerEvents="none" fill={color}
              fontSize={f} fontFamily={SEMI_FONT}>
              <TSpan x={s.x}>{nm}</TSpan>
              <TSpan x={s.x} dy={f * 1.15} fontFamily={DISP_FONT}>{v}</TSpan>
            </SvgText>
          );
        }
        /* too small for the name: the figure alone, or nothing */
        return fVal < 4.5 ? null : (
          <SvgText key={`l-${n}`} x={s.x} y={s.y + fVal / 3} textAnchor="middle" pointerEvents="none" fill={color}
            fontSize={fVal} fontFamily={DISP_FONT}>{v}</SvgText>
        );
      })}
    </Svg>
  );
}
