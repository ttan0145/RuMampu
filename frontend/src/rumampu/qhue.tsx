import React from 'react';
import { View } from 'react-native';

/* Each quick-add choice has its own colour on its icon only, so the pills stay
   quiet: teal for money in, pink for money out, violet for a scan, orange for Say it. */
export type QHue = { c: string };
export const QHUE: Record<'in' | 'out' | 'scan' | 'say', QHue> = {
  in: { c: '#11A09B' },
  out: { c: '#FF4F80' },
  scan: { c: '#7C5CFF' },
  say: { c: '#FF9416' },
};
export function QDot({ hue, children }: { hue: QHue; children: React.ReactNode }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: hue.c, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

