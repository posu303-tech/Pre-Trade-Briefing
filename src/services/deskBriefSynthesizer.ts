import { PreMarketBrief } from '../types';

/**
 * Deterministic Sell-Side Technical Desk Note Generator.
 * Generates an institutional pre-market technical brief directly from live
 * calculated quantitative levels without requiring any external server or API key.
 * Guarantees 100% functionality on static hosting (e.g. GitHub Pages).
 */
export function generateDeterministicDeskBrief(brief: PreMarketBrief): string {
  const {
    symbol,
    session,
    date,
    currentPrice,
    summaryBias,
    summaryBiasType,
    keyLevels,
    tradeSetups,
    riskNotes,
    marketStructure,
    volumeProfile,
    sessionVwap,
    pivots,
    priorDay,
    atr,
    options,
    catalysts,
  } = brief;

  const top3Levels = keyLevels.slice(0, 5);

  const levelsBlock = top3Levels
    .map(
      (lvl) =>
        `- $${lvl.price.toLocaleString()} [${lvl.category} | ${lvl.method}]: ${
          lvl.price > currentPrice ? 'Overhead Resistance' : 'Underlying Support'
        }`
    )
    .join('\n');

  const setupsBlock = tradeSetups
    .map(
      (s, i) =>
        `SETUP #${i + 1} (${s.direction} - ${s.setup}):
• Trigger/Entry: ${s.triggerEntry}
• Invalidation Stop: ${s.invalidationStop}
• Target 1: ${s.target1} | Target 2: ${s.target2} (R:R: ${s.riskReward})
• Volume Confirmation: ${s.volumeConfirmation}`
    )
    .join('\n\n');

  const activeCatalyst = catalysts.find((c) => c.impact === 'HIGH') || catalysts[0];
  const catalystText =
    activeCatalyst && activeCatalyst.sourceType !== 'NO_TIER1_CONFIRMED'
      ? `${activeCatalyst.event} at ${activeCatalyst.timeUTC} (${activeCatalyst.timeEST}) [${activeCatalyst.impact} IMPACT]. ${activeCatalyst.notes}`
      : 'No Tier-1 macro releases (CPI/FOMC/NFP) confirmed on calendar for today. Routine session liquidity transitions apply.';

  const optionsBlock =
    options.isAvailable && options.maxPainStrike
      ? `Deribit Options Pin Risk: Weekly Max Pain at $${options.maxPainStrike.toLocaleString()} with Put/Call OI ratio of ${
          options.putCallOIRatio ?? 'N/A'
        } and 25-delta skew of ${options.skew25d !== undefined ? (options.skew25d > 0 ? '+' : '') + options.skew25d + '%' : 'N/A'}. Dealer gamma rebalancing expected to dampen large intraday excursions approaching 08:00 UTC settlement.`
      : `Derivatives Risk Flag: ${
          options.unavailableReason || 'Centralized options order book unavailable for this asset.'
        } Positioning must rely strictly on spot volume profile and floor pivots.`;

  return `================================================================================
INSTITUTIONAL PRE-MARKET TECHNICAL BRIEF: ${symbol}
SESSION: ${session} | DATE: ${date} | SPOT REF: $${currentPrice.toLocaleString()}
================================================================================

SECTION 1: EXECUTIVE SUMMARY & MARKET STRUCTURE BIAS
--------------------------------------------------------------------------------
Primary Stance: ${summaryBiasType}
${summaryBias}

Market Structure Details:
• Higher-Timeframe Trend: ${marketStructure.higherTimeframeDetail}
• Intraday Trend: ${marketStructure.intradayDetail}
• Value Area Alignment: ${marketStructure.dominantRegime}
• Auction Positioning: Price is trading ${
    currentPrice > sessionVwap.price ? 'above' : 'below'
  } Session VWAP ($${sessionVwap.price.toLocaleString()}) and ${
    currentPrice > priorDay.close ? 'above' : 'below'
  } Prior Day Close ($${priorDay.close.toLocaleString()}).
• Relative Strength: ${marketStructure.relativeStrengthDetail}

SECTION 2: KEY LEVELS & CONFLUENCE LADDER
--------------------------------------------------------------------------------
Reference Benchmarks:
• Prior Day High / Low: $${priorDay.high.toLocaleString()} / $${priorDay.low.toLocaleString()}
• Floor Pivot Point (P): $${pivots.pivot.toLocaleString()} | S1: $${pivots.s1.toLocaleString()} | R1: $${pivots.r1.toLocaleString()}
• Volume Profile POC: $${volumeProfile.poc.toLocaleString()} (VAH: $${volumeProfile.vah.toLocaleString()} | VAL: $${volumeProfile.val.toLocaleString()})

Confluence Ladder:
${levelsBlock}

SECTION 3: TACTICAL TRADE SETUPS
--------------------------------------------------------------------------------
${setupsBlock}

SECTION 4: RISK MANAGEMENT & CATALYST SCHEDULE
--------------------------------------------------------------------------------
1. Macro Catalyst Risk:
   ${catalystText}

2. Volatility Sizing Matrix:
   14-period daily ATR is $${atr.atr14Daily.toLocaleString()} (${atr.atrRatioTo20d}x vs 20-day mean). Regime is ${atr.volatilityRegime}. ${
    atr.volatilityRegime === 'EXPANDED' || atr.volatilityRegime === 'EXTREME'
      ? 'Mandatory position haircut to 65% of standard unit risk with stop distance padded to 1.5x 1H ATR.'
      : 'Standard unit risk permitted with 1.25x 1H ATR stop boundaries.'
  }

3. Derivatives & Gamma Pin:
   ${optionsBlock}

4. Invalidation Protocol:
   Setups are strictly invalidated on a 15-minute candle close beyond specified stop levels. No discretionary widening of stops is permitted under desk risk rules. Trailing stop must move to breakeven upon Target 1 achievement.
================================================================================`;
}

/**
 * Client-Side Gemini Generation using direct Google Gemini REST API.
 * Allows client-side AI brief synthesis on static hosts (like GitHub Pages).
 */
export async function generateClientGeminiBrief(
  brief: PreMarketBrief,
  apiKey: string
): Promise<string> {
  // Key travels as a header rather than a `?key=` query param so it doesn't get
  // written into browser history, referrer headers, or any request logs.
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;

  const prompt = `You are a Senior Sell-Side Equity & Futures Trading Desk Analyst preparing a pre-market technical brief for institutional trading desks planning intraday trades.
Write a crisp, authoritative pre-market technical brief for ${brief.symbol} (${brief.session} Session, Date: ${brief.date}) based on the following verified quantitative inputs:

Current Price: $${brief.currentPrice}
Prior Day Stats: Close=$${brief.priorDay.close}, High=$${brief.priorDay.high}, Low=$${brief.priorDay.low}, VWAP=$${brief.priorDay.vwap}
Floor Pivots: Pivot=$${brief.pivots.pivot}, S1=$${brief.pivots.s1}, R1=$${brief.pivots.r1}, S2=$${brief.pivots.s2}, R2=$${brief.pivots.r2}
Volume Profile: POC=$${brief.volumeProfile.poc}, VAH=$${brief.volumeProfile.vah}, VAL=$${brief.volumeProfile.val}
Session VWAP: $${brief.sessionVwap.price}
14-Day ATR: $${brief.atr.atr14Daily} (${brief.atr.volatilityRegime})
Options Data: ${
    brief.options.isAvailable
      ? `Max Pain: $${brief.options.maxPainStrike}, P/C Ratio: ${brief.options.putCallOIRatio}, 25d Skew: ${brief.options.skew25d}%`
      : brief.options.unavailableReason || 'Unlisted / OTC'
  }
Catalysts: ${brief.catalysts.map((c) => `${c.event} (${c.timeUTC})`).join('; ')}

Format your output strictly using these 4 institutional sections:
SECTION 1: SUMMARY BIAS (1-paragraph, bullish/bearish/neutral + rationale grounded in VWAP, POC, and Prior Day Close)
SECTION 2: KEY LEVELS (Price ladder with confluence notes)
SECTION 3: TRADE SETUPS (At least 2 setups: Long and Short, specifying Trigger, Invalidation, Targets, and Volume confirmation)
SECTION 4: RISK & EXECUTION NOTES (Catalyst timing, ATR volatility sizing, Options pin risk, and invalidation rules)`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `Gemini API request failed (${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text generated by Gemini model');
  }
  return text;
}

/**
 * Universal Synthesizer:
 * 1. Checks if server `/api/gemini/generate-brief` responds.
 * 2. If running on static host (GitHub Pages 404):
 *    - Uses user-provided Gemini API key if available.
 *    - Seamlessly falls back to deterministic institutional desk engine.
 */
export async function synthesizeDeskBrief(
  brief: PreMarketBrief,
  userApiKey?: string
): Promise<{ text: string; source: 'server' | 'gemini_client' | 'deterministic' }> {
  // If user provided a client key, use direct client generation.
  // Deliberately NOT reading a VITE_-prefixed env var here: Vite inlines those into
  // the public JS bundle at build time, and this app is meant to run as a static
  // GitHub Pages site, so any key set that way would ship in plaintext to every
  // visitor. The only client-side key path is one the user types in themselves,
  // kept in their own browser's localStorage.
  if (userApiKey) {
    try {
      const text = await generateClientGeminiBrief(brief, userApiKey);
      return { text, source: 'gemini_client' };
    } catch (e) {
      console.warn('Direct client Gemini call failed, trying server or deterministic fallback', e);
    }
  }

  // Attempt server call
  try {
    const res = await fetch('/api/gemini/generate-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: brief.symbol,
        session: brief.session,
        date: brief.date,
        quantData: {
          currentPrice: brief.currentPrice,
          priorDay: brief.priorDay,
          pivots: brief.pivots,
          volumeProfile: {
            poc: brief.volumeProfile.poc,
            vah: brief.volumeProfile.vah,
            val: brief.volumeProfile.val,
          },
          vwap: brief.sessionVwap.price,
          movingAverages: brief.movingAverages,
          atr: brief.atr,
          gaps: brief.gaps,
          catalysts: brief.catalysts,
          options: brief.options,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.briefText) {
        return { text: data.briefText, source: 'server' };
      }
    }
  } catch (err) {
    // Network error or static deploy (404)
    console.info('Server endpoint unreachable (expected on static hosts like GitHub Pages)');
  }

  // Deterministic fall-through
  const text = generateDeterministicDeskBrief(brief);
  return { text, source: 'deterministic' };
}
