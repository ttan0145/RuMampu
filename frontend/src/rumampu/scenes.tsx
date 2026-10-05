import React from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Route } from './state';
import { RUMA_IMG } from './ruma';

/* v27b scenes: the app's meadow at the foot of each screen, with one thing
   that says what the screen is for. Decoration only: hidden from screen
   readers and never carrying meaning. */

type SceneKey = 'home' | 'money' | 'house' | 'town' | 'books' | 'garden' | 'profile';

export const SCENE_OF: Partial<Record<Route, SceneKey>> = {
  home: 'home',
  money: 'money', income: 'money', expenses: 'money', commit: 'money', pattern: 'money', coverage: 'money',
  record: 'money', expmonths: 'money', exlimits: 'money', buffer: 'money',
  househome: 'house', house: 'house', precheck: 'house', result: 'house', range: 'house', compare: 'house',
  shock: 'house', savedtests: 'house', prepare: 'house', upfront: 'house', docs: 'house',
  pv_switch: 'house', pv_month: 'house', pv_compare: 'house',
  homecosts: 'town', learn: 'books', learnsec: 'books', plan: 'garden', profile: 'profile', acctdetails: 'profile',
};

function meadow(props: string, back: string): string {
  return '<svg viewBox="0 0 390 200" width="100%" height="200" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M-20 200 L-20 132 Q 95 74 240 122 Q 330 150 410 118 L410 200 Z" fill="#CBE6CF"/>' + back
    + '<path d="M-20 200 L-20 168 Q 90 118 210 152 Q 320 182 410 150 L410 200 Z" fill="#A5D6AE"/>'
    + '<g stroke="#63A96F" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M52 172 q-2 -8 1 -12 M58 172 q0 -9 4 -12 M64 173 q3 -7 8 -9"/><path d="M300 168 q-2 -8 1 -12 M306 168 q0 -9 4 -12 M312 169 q3 -7 8 -9"/></g>'
    + '<circle cx="86" cy="150" r="4.6" fill="#FFFFFF"/><circle cx="86" cy="150" r="1.7" fill="#F4D27A"/><circle cx="346" cy="178" r="4.6" fill="#FFFFFF"/><circle cx="346" cy="178" r="1.7" fill="#F4D27A"/>'
    + props + '</svg>';
}

function scene(k: SceneKey): { xml: string; ruma: string | null } {
  const tree = (x: number, y: number) => `<rect x="${x - 3}" y="${y}" width="6" height="20" rx="2" fill="#8B7B66"/><circle cx="${x}" cy="${y - 8}" r="15" fill="#8FC49A"/><circle cx="${x + 9}" cy="${y - 2}" r="10" fill="#7DB88A"/>`;
  const tiny = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="${w * 0.72}" fill="#F4F8F6" stroke="#8FB5A5" stroke-width="1.5"/><polygon points="${x - 3},${y} ${x + w / 2},${y - w * 0.5} ${x + w + 3},${y}" fill="#9CC3B8"/>`;
  let back = '', props = '', ruma: string | null = null;
  if (k === 'home') {
    back = tiny(300, 104, 24) + tiny(334, 110, 18) + tree(40, 106);
  } else if (k === 'money') {
    props = '<path d="M60 142h32a4 4 0 0 1 4 4v24a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8v-24a4 4 0 0 1 4-4z" fill="#FFFFFF" stroke="#3C5152" stroke-width="2"/>'
      + '<rect x="58" y="158" width="36" height="16" rx="6" fill="#4A9195" opacity=".75"/><rect x="64" y="135" width="24" height="7" rx="2" fill="#FFFFFF" stroke="#3C5152" stroke-width="2"/>'
      + '<ellipse cx="116" cy="178" rx="10" ry="4.5" fill="#FEC844" stroke="#B88A12" stroke-width="1.5"/><ellipse cx="116" cy="173" rx="10" ry="4.5" fill="#FEC844" stroke="#B88A12" stroke-width="1.5"/><ellipse cx="134" cy="181" rx="10" ry="4.5" fill="#FEC844" stroke="#B88A12" stroke-width="1.5"/>';
    ruma = 'count';
  } else if (k === 'house') {
    props = '<ellipse cx="148" cy="166" rx="17" ry="4.5" fill="#3C5152" opacity="0.12"/><g transform="translate(148 148) rotate(-14)"><circle r="14" fill="#FFFFFF" stroke="#3C5152" stroke-width="2"/><path d="M0 -5.2 L5 -1.6 L3.1 4.3 L-3.1 4.3 L-5 -1.6 Z" fill="#3C5152"/><path d="M0 -14 L0 -9.4 M9.5 -6.8 L5 -1.6 M9.5 6.8 L3.1 4.3 M-9.5 6.8 L-3.1 4.3 M-9.5 -6.8 L-5 -1.6" stroke="#3C5152" stroke-width="1.6"/></g>'
      + '<g stroke="#7FB08A" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.9"><path d="M104 150 q10 -12 24 -14"/><path d="M112 162 q9 -8 20 -9"/></g>';
    ruma = 'happy';
  } else if (k === 'town') {
    const b = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#EEF5F2" stroke="#9DBFB4" stroke-width="1.5"/>`
      + `<rect x="${x + 5}" y="${y + 6}" width="5" height="5" fill="#C9DDD6"/><rect x="${x + w - 10}" y="${y + 6}" width="5" height="5" fill="#C9DDD6"/>`;
    back = b(196, 90, 24, 44) + b(224, 78, 20, 58) + tiny(250, 108, 26) + b(282, 86, 22, 48) + tiny(310, 112, 24) + b(338, 98, 26, 38) + tree(40, 110);
  } else if (k === 'books') {
    props = '<rect x="52" y="166" width="54" height="11" rx="3" fill="#9FCFD1" stroke="#3C5152" stroke-width="1.6"/><rect x="58" y="155" width="46" height="11" rx="3" fill="#F6D98A" stroke="#3C5152" stroke-width="1.6"/><rect x="54" y="144" width="50" height="11" rx="3" fill="#B9DEB0" stroke="#3C5152" stroke-width="1.6"/>'
      + '<path d="M120 168l14-5 14 5v-14l-14-5-14 5z" fill="#FFFFFF" stroke="#3C5152" stroke-width="1.6" stroke-linejoin="round"/><path d="M134 163v-14" stroke="#3C5152" stroke-width="1.4"/>';
    back = tree(330, 108);
  } else if (k === 'garden') {
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 24, y = 176 - (i % 2) * 4;
      props += `<path d="M${x} ${y}v-10 M${x} ${y - 6}q0 -6 7 -7 M${x} ${y - 4}q0 -5 -6 -6" stroke="#4F9B5E" stroke-width="2" stroke-linecap="round" fill="none"/>`;
    }
    props += '<g transform="translate(96 0)"><path d="M232 150h26v18a4 4 0 0 1-4 4h-18a4 4 0 0 1-4-4z" fill="#9FCFD1" stroke="#3C5152" stroke-width="1.8"/><path d="M258 156l14-8" stroke="#3C5152" stroke-width="2" stroke-linecap="round"/><path d="M236 150q9-10 18 0" fill="none" stroke="#3C5152" stroke-width="1.8"/></g>';
    ruma = 'happy';
  } else if (k === 'profile') {
    props = '<rect x="70" y="138" width="4" height="40" fill="#8B7B66"/><rect x="48" y="126" width="48" height="20" rx="4" fill="#FFFFFF" stroke="#3C5152" stroke-width="1.8"/>';
    ruma = 'wave';
  }
  return { xml: meadow(props, back), ruma };
}

export function SceneFoot({ k }: { k: SceneKey }) {
  const { xml, ruma } = React.useMemo(() => scene(k), [k]);
  const bob = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!alive || reduce || !ruma) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 2250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => undefined);
    return () => { alive = false; loop?.stop(); };
  }, [bob, ruma]);
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ marginTop: 'auto', marginHorizontal: -20, marginBottom: -24, height: 200 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 }}>
        <SvgXml xml={xml} width="100%" height={200} />
      </View>
      {ruma ? (
        <Animated.Image source={{ uri: RUMA_IMG[ruma] }} resizeMode="contain" style={{
          position: 'absolute', right: 78, bottom: 20, width: 100, height: 96,
          transform: [{ rotate: '-8deg' }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
        }} />
      ) : null}
    </View>
  );
}
