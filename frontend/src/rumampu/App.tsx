import React from 'react';
import { BackHandler, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, Route, useApp } from './state';
import { C } from './theme';
import { Onboarding, SheetHost, Splash, TabBar, ToastView } from './overlays';
import { HomeScreen } from './screens/home';
import {
  CommitScreen, CoverageScreen, IncomeScreen, MoneyScreen, PatternScreen, RecordScreen, WorkcostsScreen,
} from './screens/money';
import {
  ExLimitsScreen, ExpAddScreen, ExpMonthsScreen, ExpScanScreen, ExpensesScreen,
} from './screens/expenses';
import {
  CompareScreen, HomecostScreen, HouseScreen, PrecheckScreen, RangeScreen, ResultScreen, ShockScreen,
} from './screens/test';
import {
  BufferScreen, DocsScreen, PrepareScreen, PvCompareScreen, PvMonthScreen, PvSwitchScreen, UpfrontScreen,
} from './screens/prepare';
import { ImportIncomeScreen } from './screens/imports';

const SCREENS: Record<Route, React.ComponentType> = {
  home: HomeScreen,
  money: MoneyScreen, income: IncomeScreen, incomeimport: ImportIncomeScreen,
  workcosts: WorkcostsScreen, commit: CommitScreen,
  pattern: PatternScreen, coverage: CoverageScreen, record: RecordScreen,
  expenses: ExpensesScreen, expadd: ExpAddScreen, expscan: ExpScanScreen,
  expmonths: ExpMonthsScreen, exlimits: ExLimitsScreen,
  house: HouseScreen, homecost: HomecostScreen, precheck: PrecheckScreen, result: ResultScreen,
  range: RangeScreen, compare: CompareScreen, shock: ShockScreen,
  prepare: PrepareScreen, upfront: UpfrontScreen, buffer: BufferScreen, docs: DocsScreen,
  pv_switch: PvSwitchScreen, pv_month: PvMonthScreen, pv_compare: PvCompareScreen,
};

function Root() {
  const { S, backNav } = useApp();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!S.onboarded || S.sheet) return false;
      backNav();
      return true;
    });
    return () => sub.remove();
  }, [S.onboarded, S.sheet, backNav]);

  const Screen = SCREENS[S.route] || HomeScreen;

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
      <View style={{ flex: 1 }}>
        <Screen key={S.route} />
      </View>
      <TabBar />
      <ToastView />
      {!S.onboarded ? <Onboarding /> : null}
      {!S.onboarded ? <Splash /> : null}
      <SheetHost />
    </View>
  );
}

/* On wide web viewports, show the app inside a phone frame like the prototype does. */
function Framed({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width <= 430) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: C.frame, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 390, height: Math.min(844, height),
        borderRadius: 28, overflow: 'hidden', backgroundColor: C.paper,
      }}>
        {children}
      </View>
    </View>
  );
}

export default function RuMampuApp() {
  return (
    <AppProvider>
      <Framed>
        <Root />
      </Framed>
    </AppProvider>
  );
}
