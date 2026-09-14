import { CatalystEvent } from '../types';

// Storage key for custom user-added desk catalysts
const DESK_CATALYSTS_KEY = 'pm_desk_custom_catalysts';

export function getStoredCustomCatalysts(): CatalystEvent[] {
  try {
    const raw = localStorage.getItem(DESK_CATALYSTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomCatalyst(event: CatalystEvent): void {
  try {
    const current = getStoredCustomCatalysts();
    const updated = [event, ...current.filter((e) => e.id !== event.id)];
    localStorage.setItem(DESK_CATALYSTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save custom desk catalyst', e);
  }
}

export function removeCustomCatalyst(id: string): void {
  try {
    const current = getStoredCustomCatalysts();
    const updated = current.filter((e) => e.id !== id);
    localStorage.setItem(DESK_CATALYSTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to delete custom catalyst', e);
  }
}

/**
 * Returns scheduled catalysts for the desk brief.
 * Dynamically resolves actual day-of-week and recurring market auction mechanics.
 * Strictly avoids fabricating CPI/FOMC on unverified dates.
 */
export function getScheduledCatalysts(dateStr?: string): CatalystEvent[] {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const catalysts: CatalystEvent[] = [];

  // 1. Check user-defined custom desk catalysts first
  const custom = getStoredCustomCatalysts();
  if (custom.length > 0) {
    catalysts.push(...custom);
  }

  if (isWeekend) {
    catalysts.push({
      id: 'weekend-auction-mode',
      timeUTC: '24 Hours',
      timeEST: '24 Hours',
      category: 'AUCTION_EVENT',
      event: 'Weekend Session: TradFi Equity & Futures Markets Closed',
      impact: 'MEDIUM',
      consensus: 'Thin liquidity book',
      notes:
        'CME Bitcoin futures and traditional cash equities are closed. Spot order books thin with heightened slippage risk on market orders.',
      sourceType: 'RECURRING_AUCTION',
    });
    return catalysts;
  }

  // 2. Day-specific recurring structural events
  if (dayOfWeek === 4) {
    // Thursday: Weekly US Initial Jobless Claims (Real recurring Tier-2 event every Thursday)
    catalysts.push({
      id: 'weekly-jobless-claims',
      timeUTC: '12:30 UTC',
      timeEST: '08:30 AM EST',
      category: 'MACRO',
      event: 'US Initial Jobless Claims (Weekly Bureau of Labor Statistics)',
      impact: 'MEDIUM',
      consensus: 'Labor market indicator',
      previous: '220k-240k range',
      notes:
        'Released every Thursday at 12:30 UTC. Significant surprises (±20k vs trend) trigger short-term US dollar yield adjustments and intraday crypto volatility.',
      sourceType: 'RECURRING_AUCTION',
    });
  }

  if (dayOfWeek === 5) {
    // Friday: Deribit Weekly Options Expiry & CME Futures Cut
    catalysts.push({
      id: 'friday-options-cut',
      timeUTC: '08:00 UTC',
      timeEST: '04:00 AM EST',
      category: 'CRYPTO_SPECIFIC',
      event: 'Deribit Weekly Options Expiry & 08:00 UTC Index Settlement',
      impact: 'HIGH',
      consensus: 'Max Pain Pinning Dynamics',
      notes:
        'Concentrated weekly open interest expires at 08:00 UTC. Dealer gamma rebalancing creates mean-reverting pin risk near max pain strikes before expiry.',
      sourceType: 'RECURRING_AUCTION',
    });
    catalysts.push({
      id: 'cme-settlement-friday',
      timeUTC: '20:00 UTC',
      timeEST: '04:00 PM EST',
      category: 'AUCTION_EVENT',
      event: 'CME Bitcoin & Ether Futures Weekend Settlement Cut',
      impact: 'MEDIUM',
      consensus: 'Position roll & basis unwind',
      notes:
        'Institutional basis trades roll or close prior to weekend break; basis compression and cash-futures convergence typical into the 20:00 UTC cut.',
      sourceType: 'RECURRING_AUCTION',
    });
  }

  // 3. Core Intraday Session Liquidity Windows (Always active on weekdays)
  catalysts.push({
    id: 'london-cash-open',
    timeUTC: '08:00 UTC',
    timeEST: '04:00 AM EST',
    category: 'AUCTION_EVENT',
    event: 'London Interbank Cash Market Open (Europe Session Influx)',
    impact: 'MEDIUM',
    consensus: 'European order flow expansion',
    notes:
      'First major volume expansion of the day. Frequently sweeps Asian session overnight highs/lows before establishing true intraday trend.',
    sourceType: 'RECURRING_AUCTION',
  });

  catalysts.push({
    id: 'us-cash-open',
    timeUTC: '13:30 UTC',
    timeEST: '09:30 AM EST',
    category: 'AUCTION_EVENT',
    event: 'US Equities Cash Open (NYSE/NASDAQ Opening Cross)',
    impact: 'HIGH',
    consensus: 'Highest daily volume cluster',
    notes:
      'Opening 30 minutes (13:30 - 14:00 UTC) features highest daily volume and volatility. Spot ETFs and institutional desks deploy bulk algorithmic flow.',
    sourceType: 'RECURRING_AUCTION',
  });

  catalysts.push({
    id: 'london-fix',
    timeUTC: '15:00 UTC',
    timeEST: '11:00 AM EST',
    category: 'AUCTION_EVENT',
    event: 'WM/Reuters London 4:00 PM FX Fix (16:00 London / 15:00 UTC)',
    impact: 'LOW',
    consensus: 'Sovereign & corporate FX rebalancing',
    notes:
      'Window where international currency hedges are executed. Watch for abrupt 5-minute volatility in USD pairs and precious metals.',
    sourceType: 'RECURRING_AUCTION',
  });

  return catalysts;
}
