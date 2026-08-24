import React from 'react';
import { ScrollView, View } from 'react-native';
import { C } from '../theme';
import { Hdr } from '../ui';

/* Screen shell: sticky header + scrolling content column (mirrors #screen + .hdr). */
export function ScreenShell({
  back, title, brand, children,
}: { back?: boolean; title?: string; brand?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <Hdr back={back} title={title} brand={brand} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
