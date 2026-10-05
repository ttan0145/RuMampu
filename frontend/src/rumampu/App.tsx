import React from 'react';
import { BackHandler, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, Route, useApp } from './state';
import { C } from './theme';
import { SheetHost, Splash, TabBar, ToastView } from './overlays';
import { EntryFlow, GetToKnow } from './entry';
import { AssistantFab, AssistantSheet } from './assistant';
import { TourHost, registerRoot } from './tour';
import { HomeScreen } from './screens/home';
import { PlanScreen } from './screens/plan';
import { ProfileScreen } from './screens/profile';
import {
  CommitScreen, CoverageScreen, IncomeScreen, MoneyScreen, PatternScreen, RecordScreen, WorkcostsScreen,
} from './screens/money';
import {
  ExLimitsScreen, ExpAddScreen, ExpMonthsScreen, ExpScanScreen, ExpensesScreen,
} from './screens/expenses';
import {
  CompareScreen, HomecostScreen, HousehomeScreen, HouseScreen, PrecheckScreen, RangeScreen,
  ResultScreen, SavedtestsScreen, ShockScreen,
} from './screens/test';
import {
  BufferScreen, DocsScreen, PrepareComingSoonScreen, PrepareScreen, PvCompareScreen, PvMonthScreen, PvSwitchScreen, UpfrontScreen,
} from './screens/prepare';
import { ImportIncomeScreen } from './screens/imports';
import { HomeCostsScreen } from './screens/homecosts';
import { AcctDetailsScreen } from './screens/acctdetails';
import { LearnCele, LearnReadScreen, LearnScreen, LearnSecScreen } from './screens/learn';

const SCREENS: Record<Route, React.ComponentType> = {
  home: HomeScreen, plan: PlanScreen,
  money: MoneyScreen, income: IncomeScreen, incomeimport: ImportIncomeScreen,
  workcosts: WorkcostsScreen, commit: CommitScreen,
  pattern: PatternScreen, coverage: CoverageScreen, record: RecordScreen,
  expenses: ExpensesScreen, expadd: ExpAddScreen, expscan: ExpScanScreen,
  expmonths: ExpMonthsScreen, exlimits: ExLimitsScreen,
  house: HouseScreen, homecost: HomecostScreen, precheck: PrecheckScreen, result: ResultScreen,
  range: RangeScreen, compare: CompareScreen, shock: ShockScreen,
  househome: HousehomeScreen, savedtests: SavedtestsScreen, profile: ProfileScreen,
  homecosts: HomeCostsScreen, acctdetails: AcctDetailsScreen,
  prepare: PrepareScreen, prepare_soon: PrepareComingSoonScreen, upfront: UpfrontScreen, buffer: BufferScreen, docs: DocsScreen,
  pv_switch: PvSwitchScreen, pv_month: PvMonthScreen, pv_compare: PvCompareScreen,
  learn: LearnScreen, learnsec: LearnSecScreen, learnread: LearnReadScreen,
};

function Root() {
  const { S, authReady, backNav } = useApp();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!S.onboarded || !S.knew || S.sheet) return false;
      backNav();
      return true;
    });
    return () => sub.remove();
  }, [S.onboarded, S.knew, S.sheet, backNav]);

  const Screen = SCREENS[S.route] || HomeScreen;

  return (
    <View ref={registerRoot} collapsable={false} style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
      <View style={{ flex: 1 }}>
        <Screen key={S.route} />
      </View>
      <TabBar />
      <ToastView />
      {/* v22 entry flow: language → meet Ruma → auth, then get-to-know. */}
      {authReady && (!S.onboarded || S.authEntryOpen) ? <EntryFlow /> : null}
      {authReady && S.onboarded && !S.knew ? <GetToKnow /> : null}
      {!authReady || !S.onboarded ? <Splash /> : null}
      <SheetHost />
      {/* US6.2: available on every page after onboarding, never before (AC6.2.10). */}
      {S.onboarded && S.knew ? <AssistantFab /> : null}
      {S.onboarded ? <AssistantSheet /> : null}
      {/* v27b: a finished topic's badge first, then Ruma's invitation, then the tour. */}
      <LearnCele />
      {/* v27b screen tips: the invitation, the hint and the tour sit above everything. */}
      <TourHost tabBarHeight={76 + insets.bottom} />
    </View>
  );
}

/* The two branches must stay structurally identical. Returning a different
   element tree either side of the threshold makes React remount the whole
   subtree on resize or zoom, wiping local state in every screen below. */
function Framed({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width > 430;
  return (
    <View style={
      framed
        ? { flex: 1, backgroundColor: C.frame, alignItems: 'center', justifyContent: 'center' }
        : { flex: 1 }
    }>
      <View style={
        framed
          ? { width: 390, height: Math.min(844, height), borderRadius: 28, overflow: 'hidden', backgroundColor: C.paper }
          : { flex: 1, width: '100%' }
      }>
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
