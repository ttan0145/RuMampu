import React from 'react';
import { ScrollView, View } from 'react-native';
import { C } from '../theme';
import { Hdr } from '../ui';
import { noteScroll, registerScroller } from '../tour';
import { SCENE_OF, SceneFoot } from '../scenes';
import { useApp } from '../state';

/* Screen shell: sticky header + scrolling content column (mirrors #screen + .hdr).
   `bg` paints a decorative layer pinned to the bottom, behind the content. */
export function ScreenShell({
  back, title, brand, greet, right, bg, footer, children,
}: {
  back?: boolean; title?: string; brand?: boolean; greet?: boolean;
  right?: React.ReactNode; bg?: React.ReactNode;
  /* v27b: a bar that stays at the bottom while the content scrolls (the lesson reader). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { S } = useApp();
  /* v27b: each screen's scene at the foot of its content, unless it draws its own background */
  const scene = !bg && S.onboarded && S.knew ? SCENE_OF[S.route] : undefined;
  const scrollRef = React.useRef<ScrollView>(null);
  const frameRef = React.useRef<View>(null);
  /* v27b: the tour brings the part a tip points at into view. */
  React.useEffect(() => {
    registerScroller(scrollRef.current, frameRef.current);
    return () => registerScroller(null, null);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Hdr back={back} title={title} brand={brand} greet={greet} right={right} />
      <View ref={frameRef} collapsable={false} style={{ flex: 1 }}>
        {bg ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {bg}
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          onScroll={e => noteScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          testID="screen-scroll"
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }, scene ? { flexGrow: 1 } : null]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
          {scene ? <SceneFoot k={scene} /> : null}
        </ScrollView>
      </View>
      {footer}
    </View>
  );
}
