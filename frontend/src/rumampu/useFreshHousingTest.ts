import React from 'react';
import { runHousingTest } from '../../services/housingService';
import { getHousingScenario, getHousingTestResult, setHousingTestResult } from '../../services/housingSession';
import { housingResultStale, monthsAgg } from './calc';
import { useApp } from './state';

/* A housing test result is a snapshot of the months it ran against. When the
   record has gained or lost a month since (a past month added after the
   test), every screen that shows the verdict re-runs the same scenario once
   per record shape, so the verdict, the month count and the chart describe
   the record as it is now. Once per shape, never in a loop: a month the
   backend cannot test does not trigger a second run. A saved test being
   viewed is a record of its day and is left alone. Returns true while a
   re-run is in flight. */
export function useFreshHousingTest(enabled = true): boolean {
  const { S, up } = useApp();
  const base = getHousingTestResult();
  const scenarioId = getHousingScenario()?.id ?? base?.scenario_id;
  const recordKey = monthsAgg(S.data).map(r => `${r.y}-${r.m + 1}`).join(',');
  const stale = enabled && !S.viewTestName && !!scenarioId && !!base && housingResultStale(S.data, base);
  const refreshedFor = React.useRef<string | null>(null);
  const [running, setRunning] = React.useState(false);
  React.useEffect(() => {
    if (!stale || !scenarioId || refreshedFor.current === recordKey) return;
    refreshedFor.current = recordKey;
    let active = true;
    setRunning(true);
    void runHousingTest(scenarioId)
      .then(next => {
        if (!active) return;
        setHousingTestResult(next);
        up(state => { state.testRan = true; });
      })
      .catch(() => undefined)
      .finally(() => { if (active) setRunning(false); });
    return () => { active = false; };
  }, [stale, scenarioId, recordKey, up]);
  return running;
}
