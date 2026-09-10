import React from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { RUMA_IMG, rumaFlat } from './ruma';

/* Ruma mascot views. The 3D sheet poses gently float with a soft shadow
   (mirrors .ruma3d / .ruma3dshadow); the flat stickers sit on the auth hero. */

const ASPECT: Record<string, number> = { count: 273 / 280, happy: 253 / 260, wave: 253 / 260, sleepy: 254 / 260, oops: 253 / 260 };

export function Ruma({ w, pose, float = true }: { w: number; pose: string; float?: boolean }) {
  const p = RUMA_IMG[pose] ? pose : 'wave';
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!float) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim, float]);
  const h = Math.round(w * (ASPECT[p] || 1));
  return (
    <View style={{ width: w, alignItems: 'center' }}>
      <Animated.View style={float ? { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] } : undefined}>
        <Image source={{ uri: RUMA_IMG[p] }} style={{ width: w, height: h }} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={{
        width: w * 0.64, height: Math.max(6, w * 0.06), borderRadius: 999,
        backgroundColor: 'rgba(31,44,45,0.18)', marginTop: -Math.max(3, w * 0.02),
        transform: [{ scaleX: float ? anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) : 1 }],
        opacity: float ? anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.5] }) : 0.7,
      }} />
    </View>
  );
}

export function RumaFlat({ mood, w }: { mood: 'waving' | 'curious'; w: number }) {
  return <SvgXml xml={rumaFlat(mood, w)} width={w} height={w} />;
}

/* Small circular avatar used in the assistant header (.hdavatar). */
export function RumaAvatar({ size = 44 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: '#E4EFEC',
      alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden',
    }}>
      <Image source={{ uri: RUMA_IMG.happy }} style={{ width: size * 0.86, height: size * 0.84, marginBottom: -2 }} resizeMode="contain" />
    </View>
  );
}
