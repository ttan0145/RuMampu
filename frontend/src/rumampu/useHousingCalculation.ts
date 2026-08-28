import React from 'react';

import { calculateHousing } from '../../services/housingService';
import {
  getHousingCalculationResult,
  setHousingCalculationResult,
} from '../../services/housingSession';
import { AppData } from './mock';

/** Keep the latest successful Django calculation as the displayed result. */
export function useHousingCalculation(data: AppData) {
  const [result, setResult] = React.useState(getHousingCalculationResult());
  const housingCostsKey = data.homeCosts.map(item => `${item.id}:${item.a}`).join('|');
  const upfrontCostsKey = data.upfront.map(item => `${item.id}:${item.a}`).join('|');

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void calculateHousing(data).then(next => {
        if (!active) return;
        setHousingCalculationResult(next);
        setResult(next);
      }).catch(() => undefined);
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    data.house.price,
    data.house.deposit,
    data.house.rate,
    data.house.years,
    data.house.knownPayment,
    data.cashOnHand,
    housingCostsKey,
    upfrontCostsKey,
  ]);

  return result;
}
