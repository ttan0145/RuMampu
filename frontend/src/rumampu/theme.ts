import { TextStyle } from 'react-native';

/* Design tokens — mirrors the :root CSS variables of the prototype exactly. */
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
} as const;

export const DISP_FONT = 'SpaceGrotesk_700Bold';

export const CHART_COLS = ['#4A9195', '#F4C64D', '#7B6CC3', '#E58A4E', '#5B8FD9', '#C46A9A'];

/* Type scale — mirrors .display/.h-xl/.h-l/.h-m/.body-s and base paragraph styles. */
export const T: Record<string, TextStyle> = {
  display: { fontFamily: DISP_FONT, color: C.ink, fontVariant: ['tabular-nums'] },
  hXl: { fontSize: 40, lineHeight: 44, letterSpacing: -0.4 },
  hL: { fontSize: 26, lineHeight: 32 },
  hM: { fontSize: 19, lineHeight: 26 },
  bodyS: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 24, color: C.ink },
  muted: { color: C.ink64 },
};
