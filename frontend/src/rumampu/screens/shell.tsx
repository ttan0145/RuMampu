import React from 'react';
import { ScrollView, View } from 'react-native';
import { C } from '../theme';
import { Hdr } from '../ui';

/* Screen shell: sticky header + scrolling content column (mirrors #screen + .hdr).
   `bg` paints a decorative layer pinned to the bottom, behind the content. */
export function ScreenShell({
  back, title, brand, greet, right, bg, children,
}: {
  back?: boolean; title?: string; brand?: boolean; greet?: boolean;
  right?: React.ReactNode; bg?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Hdr back={back} title={title} brand={brand} greet={greet} right={right} />
      <View style={{ flex: 1 }}>
        {bg ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {bg}
          </View>
        ) : null}
        <ScrollView
          testID="screen-scroll"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}
