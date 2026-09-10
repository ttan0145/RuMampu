import { TextStyle } from 'react-native';

/* Design tokens — mirrors the :root CSS variables of the rumampu22 prototype exactly. */
// EN: Epic 8 uses these shared tokens for AC8.5 colour consistency; the token
// file is shared visual infrastructure, not Epic 8-only implementation.
// 中文：Epic 8 使用这些共享 token 满足 AC8.5 的颜色一致性；此文件是共享视觉基础设施，不是 Epic 8 专属实现。
export const C = {
  ink: '#3C5152',
  paper: '#FFFFFF',
  brand: '#4A9195',
  confirm: '#32B14A',
  caution: '#FEC844',
  short: '#F1592A',
  card: '#EFF3F2',
  ink64: 'rgba(60,81,82,0.64)',
  ink40: 'rgba(60,81,82,0.40)',
  ink14: 'rgba(60,81,82,0.14)',
  frame: '#2E3E3F',
  /* The warm "out" variant used by the expense entry card (.incard.out). */
  out: '#D9663D',
  outDeep: '#B54F2B',
} as const;

/* v22 switches the design font to Inter (400/600/700/800). */
export const BODY_FONT = 'Inter_400Regular';
export const SEMI_FONT = 'Inter_600SemiBold';
export const DISP_FONT = 'Inter_700Bold';
export const XBOLD_FONT = 'Inter_800ExtraBold';

export const CHART_COLS = ['#4A9195', '#F4C64D', '#7B6CC3', '#E58A4E', '#5B8FD9', '#C46A9A'];

/* Type scale — mirrors .display/.h-xl/.h-l/.h-m/.body-s and base paragraph styles. */
export const T: Record<string, TextStyle> = {
  display: { fontFamily: DISP_FONT, color: C.ink, fontVariant: ['tabular-nums'] },
  hXl: { fontSize: 26, lineHeight: 32, letterSpacing: -0.26 },
  hL: { fontSize: 22, lineHeight: 28 },
  hM: { fontSize: 19, lineHeight: 26 },
  bodyS: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 24, color: C.ink, fontFamily: BODY_FONT },
  muted: { color: C.ink64 },
};
