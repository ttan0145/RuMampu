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
/* Ruma as the help desk: the same happy 3D pose wearing a headset (band
   arching over the roof apex like headphones over a head, ear cups at the
   eaves, a mic boom to the mouth). Used for the Ask Ruma bubble
   and the chat header so the assistant reads as "customer service by Ruma",
   not a generic robot. `ring``ring` adds the white outline that lifts it off the page as a button. */
export function RumaHelpAvatar({ size = 56, ring = false }: { size?: number; ring?: boolean }) {
  /* Ink, not brand teal: the roof is teal, so a teal band disappeared into it.
     The gold mic tip is the app's accent. Tuned at 320px, checked at 56/44. */
  const ink = '#2B3D3E';
  const headset = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 46C14 2 86 2 86 46" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>
    <rect x="7" y="42" width="14" height="22" rx="6.5" fill="${ink}"/>
    <rect x="79" y="42" width="14" height="22" rx="6.5" fill="${ink}"/>
    <path d="M87 64C88 76 74 82 62 79" stroke="${ink}" stroke-width="4.2" stroke-linecap="round"/>
    <circle cx="60" cy="79" r="5" fill="${ink}"/>
    <circle cx="60" cy="79" r="2.4" fill="#FEC844"/>
  </svg>`;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: '#E4EFEC',
      alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden',
      borderWidth: ring ? Math.max(2, size * 0.045) : 0, borderColor: '#FFFFFF',
    }}>
      {/* Mascot and headset scale together and sit a touch left, so the right
          ear cup and the mic keep clear of the disc edge. */}
      <View style={{
        width: size, height: size, alignItems: 'center', justifyContent: 'flex-end',
        transform: [{ translateX: -size * 0.035 }, { scale: 0.8 }],
      }}>
        <Image source={{ uri: RUMA_IMG.happy }} style={{ width: size * 0.86, height: size * 0.84, marginBottom: -2 }} resizeMode="contain" />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
          <SvgXml xml={headset} width={size} height={size} />
        </View>
      </View>
    </View>
  );
}

/* Ruma holding up a wooden sign, the "coming soon" crayon design with the
   word swapped: the mascot and the stick come from that picture (board cut
   off), and the board with its grain and the word are drawn here so the text
   can change. Shown in the parked bubble while the chat is open, where the
   word is EXIT: tapping the dimmed page, bubble included, closes the chat. */
export function RumaSignAvatar({ size = 56, ring = false, word = 'EXIT' }: {
  size?: number; ring?: boolean; word?: string;
}) {
  const board = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="13" width="64" height="33" rx="6" fill="#EBB980" stroke="#D5A066" stroke-width="1.5"/>
    <path d="M19 21H43M49 21H70M18 39H35M41 39H71" stroke="#F4D3A6" stroke-width="1.6" stroke-linecap="round"/>
    <text x="45" y="37" text-anchor="middle" font-family="Arial Rounded MT Bold, Nunito, Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="1.5" fill="#4F6272">${word}</text>
  </svg>`;
  /* The cropped picture starts at the top of the stick; its width is set so the
     stick's top meets the board's bottom edge, and it is shifted so the stick
     (38% in from the picture's left) sits under the board's centre. */
  const imgW = size * 0.73;
  const imgH = imgW * 0.741;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: '#E4EFEC', overflow: 'hidden',
      borderWidth: ring ? Math.max(2, size * 0.045) : 0, borderColor: '#FFFFFF',
    }}>
      <Image source={{ uri: RUMA_IMG.sign }} resizeMode="contain"
        style={{ position: 'absolute', left: size * 0.17, bottom: -1, width: imgW, height: imgH }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <SvgXml xml={board} width={size} height={size} />
      </View>
    </View>
  );
}

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
