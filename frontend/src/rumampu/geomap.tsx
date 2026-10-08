import React from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DISP_FONT } from './theme';
import { PX_GEO } from './pxgeo';

/* A street map drawn by the app itself: OpenStreetMap's standard tiles (free with
   attribution, no key) placed with web-Mercator maths, the DOSM district outlines on
   top, and a price pin per district. It fits a region or a district, and can be dragged.
   No native map module, so it runs the same on web, iOS and Android. */

const TILE = 256;
/* CARTO's tiles now need a key; OpenStreetMap's do not (keep usage light, credit them) */
const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

type Bounds = [[number, number], [number, number]];          // [[south, west], [north, east]]
export type Pad = { top: number; bottom: number; left: number; right: number };
export type DistrictStyle = { fill: string; fillOpacity: number; stroke: string; strokeWidth: number; strokeOpacity: number };
export type MapPin = { d: string; label: string; dot?: string | null; on?: boolean; priority: number };

/* web Mercator: longitude/latitude to world pixels at zoom 0 (0..256) */
const mx = (lon: number) => ((lon + 180) / 360) * TILE;
const my = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE;
};

type View_ = { zoom: number; cx: number; cy: number };   // centre in world pixels at `zoom`

function fit(b: Bounds, w: number, h: number, pad: Pad, maxZoom: number): View_ {
  const x0 = mx(b[0][1]), x1 = mx(b[1][1]), y0 = my(b[1][0]), y1 = my(b[0][0]);
  const aw = Math.max(40, w - pad.left - pad.right), ah = Math.max(40, h - pad.top - pad.bottom);
  let zoom = Math.log2(Math.min(aw / Math.max(1e-9, x1 - x0), ah / Math.max(1e-9, y1 - y0)));
  zoom = Math.min(maxZoom, Math.floor(zoom * 4) / 4);
  const k = 2 ** zoom;
  return { zoom, cx: ((x0 + x1) / 2) * k + (pad.right - pad.left) / 2, cy: ((y0 + y1) / 2) * k + (pad.bottom - pad.top) / 2 };
}

export function GeoMap({ group, fitTo, pad, maxZoom = 12, styleOf, pins, onPick, attribution, zoomLabels }: {
  group: string;
  /* what to show: a region's or a district's bounds; a new value re-fits the map */
  fitTo: Bounds;
  pad: Pad;
  maxZoom?: number;
  styleOf: (district: string) => DistrictStyle | null;
  pins: MapPin[];
  onPick: (district: string) => void;
  attribution: string;
  /* accessible names for the + and - buttons, in the app's language */
  zoomLabels?: { in: string; out: string };
}) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [view, setView] = React.useState<View_ | null>(null);
  const fitKey = `${fitTo.flat().join(',')}|${pad.top},${pad.bottom}|${size.w}x${size.h}`;
  React.useEffect(() => {
    if (size.w && size.h) setView(fit(fitTo, size.w, size.h, pad, maxZoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  /* drag to pan; a tap still reaches the district or pin underneath */
  const start = React.useRef<View_ | null>(null);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
    onPanResponderGrant: () => { start.current = viewRef.current; },
    onPanResponderMove: (_e, g) => {
      const s = start.current;
      if (s) setView({ ...s, cx: s.cx - g.dx, cy: s.cy - g.dy });
    },
    onPanResponderTerminationRequest: () => true,
  }), []);

  /* + and - zoom around the middle of the part of the map above the sheet */
  const zoomBy = (d: number) => setView(v => {
    if (!v || !size.w) return v;
    const zoom = Math.max(5, Math.min(16, v.zoom + d));
    const s = 2 ** (zoom - v.zoom);
    const fx = size.w / 2, fy = (pad.top + size.h - pad.bottom) / 2;
    return { zoom, cx: (v.cx - size.w / 2 + fx) * s + size.w / 2 - fx, cy: (v.cy - size.h / 2 + fy) * s + size.h / 2 - fy };
  });

  const geo = PX_GEO[group];
  let body: React.ReactNode = null;
  if (view && geo && size.w) {
    const k = 2 ** view.zoom, left = view.cx - size.w / 2, top = view.cy - size.h / 2;
    const X = (lon: number) => mx(lon) * k - left, Y = (lat: number) => my(lat) * k - top;

    /* tiles at the nearest whole zoom, scaled to the fractional one */
    const z = Math.max(0, Math.min(18, Math.round(view.zoom))), ts = TILE * 2 ** (view.zoom - z), n = 2 ** z;
    const tiles: React.ReactNode[] = [];
    for (let ix = Math.floor(left / ts); ix <= Math.floor((left + size.w) / ts); ix += 1) {
      for (let iy = Math.max(0, Math.floor(top / ts)); iy <= Math.min(n - 1, Math.floor((top + size.h) / ts)); iy += 1) {
        const wx = ((ix % n) + n) % n;
        tiles.push(
          <Image key={`${z}/${ix}/${iy}`} source={{ uri: TILE_URL(z, wx, iy) }} fadeDuration={0}
            style={{ position: 'absolute', left: ix * ts - left, top: iy * ts - top, width: ts + 0.5, height: ts + 0.5 }} />,
        );
      }
    }

    const names = Object.keys(geo.d);
    const paths = names.map(d => {
      const st = styleOf(d);
      const dpath = geo.d[d].r.map(r => {
        let s = '';
        for (let i = 0; i < r.length; i += 2) s += `${i ? 'L' : 'M'}${X(r[i]).toFixed(1)} ${Y(r[i + 1]).toFixed(1)}`;
        return `${s}Z`;
      }).join('');
      return { d, dpath, st };
    });
    /* the picked district on top */
    paths.sort((a, b) => (a.st?.strokeWidth ?? 0) - (b.st?.strokeWidth ?? 0));

    /* pins: the busiest districts first; one that would overlap a shown pin becomes a dot */
    const taken: number[][] = [];
    const pinEls = [...pins].sort((a, b) => b.priority - a.priority).map(p => {
      const c = geo.d[p.d]?.c;
      if (!c) return null;
      const x = X(c[1]), y = Y(c[0]), w = p.label.length * 7 + (p.dot ? 22 : 16);
      if (x < -40 || y < -10 || x > size.w + 40 || y > size.h + 40) return null;
      const box = [x - w / 2, y - 30, x + w / 2, y];
      const hit = taken.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
      if (hit && !p.on) {
        return (
          <Pressable key={p.d} onPress={() => onPick(p.d)} hitSlop={8} accessibilityLabel={`${p.d} ${p.label}`}
            testID={`dot-${p.d}`} style={[st.dot, { left: x - 6, top: y - 6 }]} />
        );
      }
      taken.push(box);
      return (
        <Pressable key={p.d} onPress={() => onPick(p.d)} accessibilityRole="button" accessibilityLabel={`${p.d} ${p.label}`}
          testID={`pin-${p.d}`} style={[st.pinWrap, { left: x - w / 2, top: y - 34, width: w, zIndex: p.on ? 3 : 2 }]}>
          <View style={[st.pin, p.on && st.pinOn]}>
            {p.dot ? <View style={[st.pinDot, { backgroundColor: p.dot }]} /> : null}
            <Text style={[st.pinT, p.on && { color: '#fff' }]} numberOfLines={1}>{p.label}</Text>
          </View>
          <View style={[st.tail, p.on && { borderTopColor: '#3C5152' }]} />
        </Pressable>
      );
    });

    body = (
      <>
        {tiles}
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          {paths.map(({ d, dpath, st: s }) => (
            <Path key={d} d={dpath} fill={s?.fill ?? 'none'} fillOpacity={s?.fillOpacity ?? 0}
              stroke={s?.stroke ?? '#7C9496'} strokeWidth={s?.strokeWidth ?? 0.8} strokeOpacity={s?.strokeOpacity ?? 0.5}
              strokeLinejoin="round" onPress={s ? () => onPick(d) : undefined} testID={`area-${d}`} />
          ))}
        </Svg>
        {pinEls}
      </>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...pan.panHandlers}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E6EEF0', overflow: 'hidden' }]}>{body}</View>
      <Text style={[st.attr, { top: pad.top - 4 }]}>{attribution}</Text>
      {view ? (
        <View style={[st.zoom, { top: pad.top + 18 }]}>
          <Pressable onPress={() => zoomBy(1)} accessibilityRole="button" accessibilityLabel={zoomLabels?.in ?? 'Zoom in'}
            testID="map-zoom-in" style={({ pressed }) => [st.zoomBtn, pressed && { backgroundColor: '#EEF3F2' }]}>
            <Text style={st.zoomT}>+</Text>
          </Pressable>
          <View style={st.zoomLine} />
          <Pressable onPress={() => zoomBy(-1)} accessibilityRole="button" accessibilityLabel={zoomLabels?.out ?? 'Zoom out'}
            testID="map-zoom-out" style={({ pressed }) => [st.zoomBtn, pressed && { backgroundColor: '#EEF3F2' }]}>
            <Text style={st.zoomT}>{'\u2212'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  pinWrap: { position: 'absolute', alignItems: 'center' },
  pin: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 9,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  pinOn: { backgroundColor: '#3C5152', transform: [{ scale: 1.1 }] },
  pinT: { fontFamily: DISP_FONT, fontSize: 12.5, color: '#3C5152', fontVariant: ['tabular-nums'] },
  pinDot: { width: 8, height: 8, borderRadius: 4 },
  tail: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff',
  },
  dot: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: '#3C5152',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  zoom: {
    /* left edge: Ruma peeks in from the right edge of every screen */
    position: 'absolute', left: 12, width: 44, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  zoomBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomT: { fontFamily: DISP_FONT, fontSize: 22, lineHeight: 24, color: '#3C5152' },
  zoomLine: { height: 1, backgroundColor: '#E3EAE8', marginHorizontal: 8 },
  attr: {
    position: 'absolute', right: 6, fontSize: 9, color: '#3C5152', backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },
});
