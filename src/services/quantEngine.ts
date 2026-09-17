import {
  ATRData,
  Candle,
  CatalystEvent,
  FibonacciData,
  FibonacciLevel,
  KeyLevelItem,
  MarketStructure,
  MovingAverageStatus,
  OptionsData,
  PivotPoints,
  PreMarketBrief,
  PreMarketData,
  PriorDayStats,
  TickerSymbol,
  TradeSetup,
  TradingSession,
  UntestedGap,
  VolumeProfileData,
  VolumeProfileLevel,
} from '../types';
import { getScheduledCatalysts } from './macroCatalysts';
import { RawMarketPayload } from './marketData';

export function computePriorDayStats(dailyCandles: Candle[], hourlyCandles: Candle[]): PriorDayStats {
  if (dailyCandles.length < 2) {
    const c = dailyCandles[0] || { open: 0, high: 0, low: 0, close: 0, volume: 0, timestamp: Date.now() };
    return {
      dateStr: new Date(c.timestamp).toISOString().split('T')[0],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      vwap: (c.high + c.low + c.close) / 3,
      volume: c.volume
    };
  }

  // The prior completed daily candle is the second to last candle
  const priorDayCandle = dailyCandles[dailyCandles.length - 2];
  const dateStr = new Date(priorDayCandle.timestamp).toISOString().split('T')[0];

  // Calculate prior day VWAP from hourly candles of that day if available
  const dayStart = priorDayCandle.timestamp;
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const dayHourly = hourlyCandles.filter(h => h.timestamp >= dayStart && h.timestamp < dayEnd);

  let vwap = priorDayCandle.vwap || (priorDayCandle.high + priorDayCandle.low + priorDayCandle.close) / 3;
  if (dayHourly.length > 0) {
    let sumPV = 0;
    let sumV = 0;
    for (const h of dayHourly) {
      const tp = (h.high + h.low + h.close) / 3;
      sumPV += tp * h.volume;
      sumV += h.volume;
    }
    if (sumV > 0) {
      vwap = sumPV / sumV;
    }
  }

  return {
    dateStr,
    open: priorDayCandle.open,
    high: priorDayCandle.high,
    low: priorDayCandle.low,
    close: priorDayCandle.close,
    vwap,
    volume: priorDayCandle.volume
  };
}

export function computeFloorPivots(priorDay: PriorDayStats): PivotPoints {
  const { high: H, low: L, close: C } = priorDay;
  const pivot = (H + L + C) / 3;
  const r1 = 2 * pivot - L;
  const s1 = 2 * pivot - H;
  const r2 = pivot + (H - L);
  const s2 = pivot - (H - L);
  const r3 = H + 2 * (pivot - L);
  const s3 = L - 2 * (H - pivot);

  return {
    pivot: Number(pivot.toFixed(2)),
    r1: Number(r1.toFixed(2)),
    r2: Number(r2.toFixed(2)),
    r3: Number(r3.toFixed(2)),
    s1: Number(s1.toFixed(2)),
    s2: Number(s2.toFixed(2)),
    s3: Number(s3.toFixed(2))
  };
}

export function computeVolumeProfile(hourlyCandles: Candle[], lookbackDays = 10): VolumeProfileData {
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - lookbackMs;
  const candles = hourlyCandles.filter(c => c.timestamp >= cutoff);

  if (candles.length === 0) {
    return {
      lookbackSessions: lookbackDays,
      poc: 0,
      vah: 0,
      val: 0,
      totalVolume: 0,
      valueAreaVolume: 0,
      bins: []
    };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += c.volume;
  }

  const numBins = 50;
  const binStep = (maxPrice - minPrice) / numBins || 1;
  const bins: VolumeProfileLevel[] = Array.from({ length: numBins }, (_, i) => ({
    price: minPrice + (i + 0.5) * binStep,
    volume: 0,
    isPOC: false,
    isInValueArea: false
  }));

  // Distribute volume into bins
  for (const c of candles) {
    const cLow = Math.max(minPrice, c.low);
    const cHigh = Math.min(maxPrice, c.high);
    const lowBin = Math.min(numBins - 1, Math.max(0, Math.floor((cLow - minPrice) / binStep)));
    const highBin = Math.min(numBins - 1, Math.max(0, Math.floor((cHigh - minPrice) / binStep)));

    const binsSpanned = highBin - lowBin + 1;
    const volPerBin = c.volume / binsSpanned;

    for (let b = lowBin; b <= highBin; b++) {
      bins[b].volume += volPerBin;
    }
  }

  // Find POC
  let maxVol = -1;
  let pocIdx = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i].volume > maxVol) {
      maxVol = bins[i].volume;
      pocIdx = i;
    }
  }
  bins[pocIdx].isPOC = true;
  const pocPrice = bins[pocIdx].price;

  // Compute 70% Value Area starting at POC expanding outward
  const targetVAVolume = totalVolume * 0.70;
  let vaVolume = bins[pocIdx].volume;
  bins[pocIdx].isInValueArea = true;

  let upIdx = pocIdx + 1;
  let downIdx = pocIdx - 1;

  while (vaVolume < targetVAVolume && (upIdx < numBins || downIdx >= 0)) {
    const upVol = upIdx < numBins ? bins[upIdx].volume : -1;
    const downVol = downIdx >= 0 ? bins[downIdx].volume : -1;

    if (upVol >= downVol && upIdx < numBins) {
      bins[upIdx].isInValueArea = true;
      vaVolume += bins[upIdx].volume;
      upIdx++;
    } else if (downIdx >= 0) {
      bins[downIdx].isInValueArea = true;
      vaVolume += bins[downIdx].volume;
      downIdx--;
    } else if (upIdx < numBins) {
      bins[upIdx].isInValueArea = true;
      vaVolume += bins[upIdx].volume;
      upIdx++;
    } else {
      break;
    }
  }

  let val = Infinity;
  let vah = -Infinity;
  for (const b of bins) {
    if (b.isInValueArea) {
      if (b.price < val) val = b.price;
      if (b.price > vah) vah = b.price;
    }
  }

  return {
    lookbackSessions: lookbackDays,
    poc: Number(pocPrice.toFixed(2)),
    vah: Number(vah.toFixed(2)),
    val: Number(val.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(2)),
    valueAreaVolume: Number(vaVolume.toFixed(2)),
    bins
  };
}

export function computeMovingAverages(dailyCandles: Candle[], currentPrice: number): MovingAverageStatus[] {
  const closes = dailyCandles.map(c => c.close);
  const results: MovingAverageStatus[] = [];

  // Helper for SMA. Returns null (rather than a same-value stand-in) when there
  // isn't enough history for the requested period, so callers/UI can distinguish
  // "genuinely insufficient data" from a real reading instead of two different
  // periods silently collapsing to an identical averaged-over-everything number.
  const calcSMA = (period: number): number | null => {
    if (closes.length < period) return null;
    const slice = closes.slice(closes.length - period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  // Helper for EMA. Seeds with the SMA of the first `period` closes (standard
  // practice) rather than the single oldest close, which otherwise biases the
  // early values of the series and takes longer to converge on short history.
  const calcEMA = (period: number): number | null => {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const list = [
    { period: 9, type: 'EMA' as const, value: calcEMA(9) },
    { period: 20, type: 'EMA' as const, value: calcEMA(20) },
    { period: 50, type: 'SMA' as const, value: calcSMA(50) },
    { period: 200, type: 'SMA' as const, value: calcSMA(200) },
  ];

  for (const ma of list) {
    if (ma.value === null) continue; // not enough history yet — omit rather than fake it
    const isPriceAbove = currentPrice >= ma.value;
    const distancePercent = ((currentPrice - ma.value) / ma.value) * 100;
    results.push({
      period: ma.period,
      type: ma.type,
      value: Number(ma.value.toFixed(2)),
      isPriceAbove,
      distancePercent: Number(distancePercent.toFixed(2))
    });
  }

  return results;
}

export function computeATR(dailyCandles: Candle[], hourlyCandles: Candle[]): ATRData {
  // Wilder's 14-period ATR on daily
  const calcCandleATR = (candles: Candle[], period = 14) => {
    if (candles.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }

    if (trs.length < period) {
      return trs.reduce((a, b) => a + b, 0) / trs.length;
    }

    // Wilder's smoothing
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
    }
    return atr;
  };

  const atr14Daily = calcCandleATR(dailyCandles, 14);
  const atr20DailyAvg = calcCandleATR(dailyCandles, 20) || atr14Daily;
  const atr14Hourly = calcCandleATR(hourlyCandles, 14);

  const ratio = atr20DailyAvg > 0 ? atr14Daily / atr20DailyAvg : 1.0;

  let regime: 'COMPRESSED' | 'NORMAL' | 'EXPANDED' | 'EXTREME' = 'NORMAL';
  if (ratio < 0.85) regime = 'COMPRESSED';
  else if (ratio <= 1.25) regime = 'NORMAL';
  else if (ratio <= 1.75) regime = 'EXPANDED';
  else regime = 'EXTREME';

  return {
    atr14Daily: Number(atr14Daily.toFixed(2)),
    atr14Hourly: Number(atr14Hourly.toFixed(2)),
    atr20DailyAvg: Number(atr20DailyAvg.toFixed(2)),
    atrRatioTo20d: Number(ratio.toFixed(2)),
    volatilityRegime: regime
  };
}

export function computeFibonacci(dailyCandles: Candle[]): FibonacciData {
  // Locate significant swing high and swing low in the last 10-15 daily candles
  const candleSlice = dailyCandles.slice(-14);
  let swingHigh = -Infinity;
  let swingHighIdx = 0;
  let swingHighDate = '';

  let swingLow = Infinity;
  let swingLowIdx = 0;
  let swingLowDate = '';

  for (let i = 0; i < candleSlice.length; i++) {
    const c = candleSlice[i];
    if (c.high > swingHigh) {
      swingHigh = c.high;
      swingHighIdx = i;
      swingHighDate = new Date(c.timestamp).toISOString().split('T')[0];
    }
    if (c.low < swingLow) {
      swingLow = c.low;
      swingLowIdx = i;
      swingLowDate = new Date(c.timestamp).toISOString().split('T')[0];
    }
  }

  // If swing high was reached prior to swing low, trend is DOWN
  const isDown = swingHighIdx < swingLowIdx;
  const swingDirection = isDown ? 'DOWN' : 'UP';
  const range = swingHigh - swingLow;

  const ratios = [
    { level: 0.0, label: '0.0% (Swing Base)' },
    { level: 0.236, label: '23.6% Retracement' },
    { level: 0.382, label: '38.2% Retracement' },
    { level: 0.50, label: '50.0% Equilibrium' },
    { level: 0.618, label: '61.8% Golden Pocket' },
    { level: 0.786, label: '78.6% Deep Retracement' },
    { level: 1.0, label: '100.0% Swing Origin' },
    { level: 1.618, label: '161.8% Extension' }
  ];

  const levels: FibonacciLevel[] = ratios.map(r => {
    const price = isDown
      ? swingLow + r.level * range // measuring retracement back up from swing low
      : swingHigh - r.level * range; // measuring pullbacks down from swing high
    return {
      level: r.level,
      label: r.label,
      price: Number(price.toFixed(2))
    };
  });

  return {
    swingHigh: Number(swingHigh.toFixed(2)),
    swingHighDate,
    swingLow: Number(swingLow.toFixed(2)),
    swingLowDate,
    swingDirection,
    levels
  };
}

export function detectUntestedGaps(hourlyCandles: Candle[], dailyCandles: Candle[], currentPrice: number): UntestedGap[] {
  const gaps: UntestedGap[] = [];
  
  // Scan 3-candle Fair Value Gaps on 1h candles
  if (hourlyCandles.length >= 3) {
    for (let i = hourlyCandles.length - 1; i >= Math.max(2, hourlyCandles.length - 24); i--) {
      const c1 = hourlyCandles[i - 2];
      const c3 = hourlyCandles[i];
      
      // Bullish FVG: c3 low > c1 high
      if (c3.low > c1.high) {
        const gapHigh = c3.low;
        const gapLow = c1.high;
        const isUntested = currentPrice > gapHigh; // price hasn't dipped back inside
        if (isUntested && gapHigh - gapLow > currentPrice * 0.001) {
          gaps.push({
            id: `gap-bull-${i}`,
            type: 'BULLISH_FVG',
            timeframe: '1H Intraday',
            highPrice: Number(gapHigh.toFixed(2)),
            lowPrice: Number(gapLow.toFixed(2)),
            midPrice: Number(((gapHigh + gapLow) / 2).toFixed(2)),
            candleDate: new Date(c1.timestamp).toISOString().replace('T', ' ').slice(0, 16),
            status: 'UNTESTED'
          });
          if (gaps.length >= 2) break;
        }
      }

      // Bearish FVG: c3 high < c1 low
      if (c3.high < c1.low) {
        const gapHigh = c1.low;
        const gapLow = c3.high;
        const isUntested = currentPrice < gapLow;
        if (isUntested && gapHigh - gapLow > currentPrice * 0.001) {
          gaps.push({
            id: `gap-bear-${i}`,
            type: 'BEARISH_FVG',
            timeframe: '1H Intraday',
            highPrice: Number(gapHigh.toFixed(2)),
            lowPrice: Number(gapLow.toFixed(2)),
            midPrice: Number(((gapHigh + gapLow) / 2).toFixed(2)),
            candleDate: new Date(c1.timestamp).toISOString().replace('T', ' ').slice(0, 16),
            status: 'UNTESTED'
          });
          if (gaps.length >= 2) break;
        }
      }
    }
  }

  // Check Daily / Weekend CME or Session Gap
  if (dailyCandles.length >= 2) {
    const today = dailyCandles[dailyCandles.length - 1];
    const prev = dailyCandles[dailyCandles.length - 2];
    if (today.low > prev.high) {
      gaps.push({
        id: 'gap-session-up',
        type: 'SESSION_GAP',
        timeframe: 'Daily Open',
        highPrice: Number(today.low.toFixed(2)),
        lowPrice: Number(prev.high.toFixed(2)),
        midPrice: Number(((today.low + prev.high) / 2).toFixed(2)),
        candleDate: new Date(today.timestamp).toISOString().split('T')[0],
        status: 'UNTESTED'
      });
    } else if (today.high < prev.low) {
      gaps.push({
        id: 'gap-session-down',
        type: 'SESSION_GAP',
        timeframe: 'Daily Open',
        highPrice: Number(prev.low.toFixed(2)),
        lowPrice: Number(today.high.toFixed(2)),
        midPrice: Number(((prev.low + today.high) / 2).toFixed(2)),
        candleDate: new Date(today.timestamp).toISOString().split('T')[0],
        status: 'UNTESTED'
      });
    }
  }

  return gaps.slice(0, 3);
}

export function computeSessionVWAP(hourlyCandles: Candle[], session: TradingSession, currentPrice: number) {
  // Filter candles anchored to session open
  // UTC session anchors:
  // ASIAN: 00:00 UTC
  // EUROPEAN: 08:00 UTC
  // US: 13:30 UTC
  // ALL: 00:00 UTC (Daily open)
  const now = new Date();
  let anchorHour = 0;
  let anchorDesc = 'Anchored from 00:00 UTC Daily / Asian Session Open';

  if (session === 'EUROPEAN') {
    anchorHour = 8;
    anchorDesc = 'Anchored from 08:00 UTC European (London) Session Open';
  } else if (session === 'US') {
    anchorHour = 13;
    anchorDesc = 'Anchored from 13:30 UTC US Globex/Cash Session Open';
  } else if (session === 'ASIAN') {
    anchorHour = 0;
    anchorDesc = 'Anchored from 00:00 UTC Asian (Tokyo/HK) Session Open';
  }

  const anchorDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), anchorHour, 0, 0));
  let anchorMs = anchorDate.getTime();
  if (anchorMs > now.getTime()) {
    // Session opened yesterday
    anchorMs -= 24 * 60 * 60 * 1000;
  }

  const sessionCandles = hourlyCandles.filter(c => c.timestamp >= anchorMs);
  let vwap = currentPrice;
  let variance = 0;

  if (sessionCandles.length > 0) {
    let sumPV = 0;
    let sumV = 0;
    for (const c of sessionCandles) {
      const tp = (c.high + c.low + c.close) / 3;
      sumPV += tp * c.volume;
      sumV += c.volume;
    }
    if (sumV > 0) {
      vwap = sumPV / sumV;
      // Compute standard deviation
      let sumVar = 0;
      for (const c of sessionCandles) {
        const tp = (c.high + c.low + c.close) / 3;
        sumVar += Math.pow(tp - vwap, 2) * c.volume;
      }
      variance = Math.sqrt(sumVar / sumV);
    }
  }

  const sigma = variance > 0 ? variance : currentPrice * 0.008;

  return {
    price: Number(vwap.toFixed(2)),
    upper1Sigma: Number((vwap + sigma).toFixed(2)),
    lower1Sigma: Number((vwap - sigma).toFixed(2)),
    anchorDescription: anchorDesc
  };
}

export function computePreMarketData(
  currentPrice: number,
  high24h: number,
  low24h: number,
  volume24h: number,
  change24h: number,
  change24hPercent: number,
  dailyCandles: Candle[],
  hourlyCandles: Candle[]
): PreMarketData {
  // Compute 20-day average volume
  const volSlice = dailyCandles.slice(-20);
  const avgVolume20d = volSlice.length > 0
    ? volSlice.reduce((sum, c) => sum + c.volume, 0) / volSlice.length
    : volume24h;

  const volumeRatio20d = avgVolume20d > 0 ? Number((volume24h / avgVolume20d).toFixed(2)) : 1.0;

  // Overnight range (last 8-12 hours of hourly candles)
  const overnightCandles = hourlyCandles.slice(-8);
  let overnightHigh = high24h;
  let overnightLow = low24h;
  if (overnightCandles.length > 0) {
    overnightHigh = Math.max(...overnightCandles.map(c => c.high));
    overnightLow = Math.min(...overnightCandles.map(c => c.low));
  }

  const sessionOpenPrice = overnightCandles[0]?.open || currentPrice;

  return {
    currentPrice,
    change24h,
    change24hPercent,
    high24h,
    low24h,
    volume24h,
    avgVolume20d: Number(avgVolume20d.toFixed(2)),
    volumeRatio20d,
    overnightHigh: Number(overnightHigh.toFixed(2)),
    overnightLow: Number(overnightLow.toFixed(2)),
    sessionOpenPrice: Number(sessionOpenPrice.toFixed(2))
  };
}

export function deriveMarketStructure(
  currentPrice: number,
  priorDay: PriorDayStats,
  sessionVwap: number,
  vp: VolumeProfileData,
  mas: MovingAverageStatus[],
  symbol: TickerSymbol,
  dailyCandles: Candle[],
  change24hPercent: number,
  volumeRatio20d: number
): MarketStructure {
  const ema9 = mas.find(m => m.period === 9 && m.type === 'EMA')?.value || currentPrice;
  const sma50 = mas.find(m => m.period === 50 && m.type === 'SMA')?.value || currentPrice;

  const isHTFBullish = currentPrice > sma50 && ema9 > sma50;
  const isHTFBearish = currentPrice < sma50 && ema9 < sma50;
  const htfTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = isHTFBullish ? 'BULLISH' : isHTFBearish ? 'BEARISH' : 'NEUTRAL';

  const isIntradayBullish = currentPrice > sessionVwap && currentPrice > priorDay.close;
  const isIntradayBearish = currentPrice < sessionVwap && currentPrice < priorDay.close;
  const intradayTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = isIntradayBullish ? 'BULLISH' : isIntradayBearish ? 'BEARISH' : 'NEUTRAL';

  const trendConflict = htfTrend !== intradayTrend && htfTrend !== 'NEUTRAL' && intradayTrend !== 'NEUTRAL';

  let dominantRegime = '';
  if (currentPrice >= vp.val && currentPrice <= vp.vah) {
    dominantRegime = `Balancing inside 10-session Value Area (${vp.val.toLocaleString()} - ${vp.vah.toLocaleString()}), testing POC ${vp.poc.toLocaleString()}`;
  } else if (currentPrice > vp.vah) {
    dominantRegime = `Trending above 10-session Value Area High (${vp.vah.toLocaleString()}) with initiative auction expansion`;
  } else {
    dominantRegime = `Trading below 10-session Value Area Low (${vp.val.toLocaleString()}) in responsive discount discovery`;
  }

  // Dynamic calculation of relative strength metrics from actual historical candles
  const last20Candles = dailyCandles.slice(-20);
  const high20d = last20Candles.length > 0 ? Math.max(...last20Candles.map(c => c.high)) : currentPrice;
  const low20d = last20Candles.length > 0 ? Math.min(...last20Candles.map(c => c.low)) : currentPrice;
  const range20dPos = high20d > low20d ? Math.round(((currentPrice - low20d) / (high20d - low20d)) * 100) : 50;

  const return7d =
    dailyCandles.length >= 8
      ? ((currentPrice - dailyCandles[dailyCandles.length - 8].close) /
          dailyCandles[dailyCandles.length - 8].close) *
        100
      : change24hPercent;

  const sign24 = change24hPercent >= 0 ? '+' : '';
  const sign7 = return7d >= 0 ? '+' : '';
  const pacingDesc =
    volumeRatio20d >= 1.2
      ? 'elevated institutional volume pacing'
      : volumeRatio20d <= 0.8
      ? 'contracted volume pacing'
      : 'in-line volume pacing';

  const rangeDesc =
    range20dPos >= 75
      ? 'upper quartile (expansion testing)'
      : range20dPos <= 25
      ? 'lower quartile (discount accumulation)'
      : 'mid-range equilibrium';

  const relativeStrength = `24H price change is ${sign24}${change24hPercent.toFixed(
    2
  )}% with trailing 7-day return of ${sign7}${return7d.toFixed(
    2
  )}%. Intraday volume is running at ${volumeRatio20d}x of the 20-day mean (${pacingDesc}). Price sits in the ${rangeDesc} (${range20dPos}th percentile of the 20-day range: $${low20d.toLocaleString()} - $${high20d.toLocaleString()}).`;

  const htfDetail = `${htfTrend} structure: Price is ${currentPrice > sma50 ? 'above' : 'below'} Daily 50 SMA (${sma50.toLocaleString()}) and ${currentPrice > ema9 ? 'above' : 'below'} 9 EMA.`;
  const intraDetail = `${intradayTrend} bias: Price is trading ${currentPrice > sessionVwap ? 'above' : 'below'} Session VWAP (${sessionVwap.toLocaleString()}) and ${currentPrice > priorDay.close ? 'above' : 'below'} Prior Day Close (${priorDay.close.toLocaleString()}).`;

  return {
    higherTimeframeTrend: htfTrend,
    higherTimeframeDetail: htfDetail,
    intradayTrend,
    intradayDetail: intraDetail,
    trendConflict,
    conflictNotes: trendConflict
      ? `HTF trend (${htfTrend}) conflicts with intraday momentum (${intradayTrend}). Favor tight trailing stops and target conservative floor pivots over trend runners.`
      : undefined,
    dominantRegime,
    relativeStrengthDetail: relativeStrength
  };
}

export function generateKeyLevels(
  priorDay: PriorDayStats,
  pivots: PivotPoints,
  vp: VolumeProfileData,
  sessionVwap: number,
  mas: MovingAverageStatus[],
  fib: FibonacciData,
  gaps: UntestedGap[]
): KeyLevelItem[] {
  const levels: KeyLevelItem[] = [
    { name: 'Prior Day High (PDH)', price: priorDay.high, method: 'Prior 24H Session Peak', category: 'PRIOR_DAY' },
    { name: 'Prior Day Low (PDL)', price: priorDay.low, method: 'Prior 24H Session Trough', category: 'PRIOR_DAY' },
    { name: 'Prior Day Close (PDC)', price: priorDay.close, method: '00:00 UTC Candle Settlement', category: 'PRIOR_DAY' },
    { name: 'Prior Day VWAP', price: priorDay.vwap, method: 'Volume-Weighted Average Price (Prior Day)', category: 'VWAP' },
    { name: 'Current Session VWAP', price: sessionVwap, method: 'Volume-Weighted Average Price (Anchored Session Open)', category: 'VWAP' },
    { name: 'Floor Pivot (P)', price: pivots.pivot, method: 'Classic Floor Formula (H+L+C)/3', category: 'PIVOT' },
    { name: 'Resistance 1 (R1)', price: pivots.r1, method: 'Classic Floor Formula 2P - L', category: 'PIVOT' },
    { name: 'Resistance 2 (R2)', price: pivots.r2, method: 'Classic Floor Formula P + (H - L)', category: 'PIVOT' },
    { name: 'Resistance 3 (R3)', price: pivots.r3, method: 'Classic Floor Formula H + 2(P - L)', category: 'PIVOT' },
    { name: 'Support 1 (S1)', price: pivots.s1, method: 'Classic Floor Formula 2P - H', category: 'PIVOT' },
    { name: 'Support 2 (S2)', price: pivots.s2, method: 'Classic Floor Formula P - (H - L)', category: 'PIVOT' },
    { name: 'Support 3 (S3)', price: pivots.s3, method: 'Classic Floor Formula L - 2(H - P)', category: 'PIVOT' },
    { name: 'Point of Control (POC)', price: vp.poc, method: `10-Session Highest Volume Node (${vp.lookbackSessions}D)`, category: 'PROFILE' },
    { name: 'Value Area High (VAH)', price: vp.vah, method: '70% Volume Profile Upper Boundary', category: 'PROFILE' },
    { name: 'Value Area Low (VAL)', price: vp.val, method: '70% Volume Profile Lower Boundary', category: 'PROFILE' },
  ];

  // Add 9 EMA and 50 SMA
  const ema9 = mas.find(m => m.period === 9 && m.type === 'EMA');
  if (ema9) {
    levels.push({ name: 'Daily 9 EMA', price: ema9.value, method: '9-Period Exponential Moving Average', category: 'MA' });
  }
  const sma50 = mas.find(m => m.period === 50 && m.type === 'SMA');
  if (sma50) {
    levels.push({ name: 'Daily 50 SMA', price: sma50.value, method: '50-Period Simple Moving Average', category: 'MA' });
  }

  // Golden pocket Fib
  const fib618 = fib.levels.find(l => l.level === 0.618);
  if (fib618) {
    levels.push({ name: 'Fibonacci 61.8%', price: fib618.price, method: `Swing ${fib.swingHigh} to ${fib.swingLow} Retracement`, category: 'FIB' });
  }

  // Untested Gap
  if (gaps.length > 0) {
    levels.push({ name: `Untested ${gaps[0].type.replace('_', ' ')} Mid`, price: gaps[0].midPrice, method: `1H Fair Value Gap [${gaps[0].lowPrice} - ${gaps[0].highPrice}]`, category: 'GAP' });
  }

  // Sort descending by price for desk readability
  return levels.sort((a, b) => b.price - a.price);
}

export function generateTradeSetups(
  currentPrice: number,
  priorDay: PriorDayStats,
  pivots: PivotPoints,
  vp: VolumeProfileData,
  sessionVwap: number,
  atr: ATRData,
  marketStructure: MarketStructure
): TradeSetup[] {
  const atrStopIntra = atr.atr14Hourly > 0 ? atr.atr14Hourly * 1.25 : currentPrice * 0.012;
  const setups: TradeSetup[] = [];

  // Setup 1: Value Area Re-test / Responsive Mean Reversion (Long or Short depending on price vs POC)
  if (currentPrice >= sessionVwap) {
    // Bullish re-test of Session VWAP or VAL
    const entry = Math.max(sessionVwap, vp.val);
    const stop = Number((entry - atrStopIntra).toFixed(2));
    const target1 = Math.max(vp.poc, pivots.pivot);
    const target2 = Math.max(vp.vah, pivots.r1);
    const risk = entry - stop;
    const reward = target1 - entry;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.10';

    setups.push({
      setup: 'Setup 1: Value Area Pullback Long (Responsive Bid)',
      triggerEntry: `Limit bid at Session VWAP ($${entry.toLocaleString()}) or retest of Value Area Low ($${vp.val.toLocaleString()}) on 5m absorption volume.`,
      invalidationStop: `15-min candle close below S1 ($${pivots.s1.toLocaleString()}) or sustained tape through stop level $${stop.toLocaleString()} (1.25x 1H ATR buffer).`,
      target1: `Target 1: Point of Control (POC) $${target1.toLocaleString()}`,
      target2: `Target 2: Value Area High (VAH) / R1 Pivot $${target2.toLocaleString()}`,
      riskReward: `1:${rr} (Target 1) / 1:${risk > 0 ? ((target2 - entry) / risk).toFixed(2) : '3.40'} (Target 2)`,
      volumeConfirmation: 'Positive cumulative volume delta (CVD) divergence and bid delta expansion at session VWAP.',
      direction: 'LONG',
      entryPriceRef: entry,
      stopPriceRef: stop,
      target1PriceRef: target1,
      target2PriceRef: target2
    });
  } else {
    // Bearish pullback to VWAP / Pivot
    const entry = Math.min(sessionVwap, pivots.pivot);
    const stop = Number((entry + atrStopIntra).toFixed(2));
    const target1 = Math.min(vp.val, pivots.s1);
    const target2 = Number((pivots.s2).toFixed(2));
    const risk = stop - entry;
    const reward = entry - target1;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.05';

    setups.push({
      setup: 'Setup 1: Session VWAP Rejection Short (Mean Reversion)',
      triggerEntry: `Short entry on test and rejection of Session VWAP ($${entry.toLocaleString()}) or Pivot ($${pivots.pivot.toLocaleString()}) with upper wick exhaustion.`,
      invalidationStop: `15-min candle close above R1 ($${pivots.r1.toLocaleString()}) or print through $${stop.toLocaleString()} (1.25x 1H ATR buffer).`,
      target1: `Target 1: Value Area Low (VAL) $${target1.toLocaleString()}`,
      target2: `Target 2: Floor Support S2 $${target2.toLocaleString()}`,
      riskReward: `1:${rr} (Target 1) / 1:${risk > 0 ? ((entry - target2) / risk).toFixed(2) : '3.20'} (Target 2)`,
      volumeConfirmation: 'Selling volume surge on the 5m tape with negative delta acceleration.',
      direction: 'SHORT',
      entryPriceRef: entry,
      stopPriceRef: stop,
      target1PriceRef: target1,
      target2PriceRef: target2
    });
  }

  // Setup 2: Initiative Breakout / Trend Continuation
  if (marketStructure.higherTimeframeTrend === 'BULLISH' || currentPrice > vp.poc) {
    const entry = Number((pivots.r1).toFixed(2));
    const stop = Number((pivots.pivot).toFixed(2));
    const target1 = Number((pivots.r2).toFixed(2));
    const target2 = Number((pivots.r3).toFixed(2));
    const risk = entry - stop;
    const reward = target1 - entry;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.25';

    setups.push({
      setup: 'Setup 2: Value Area High / R1 Breakout Long (Initiative Auction)',
      triggerEntry: `Clean 15-min acceptance and retest above Resistance R1 ($${entry.toLocaleString()}) following VAH breakout.`,
      invalidationStop: `Failed auction re-entering Value Area with 15-min close back below Floor Pivot ($${stop.toLocaleString()}).`,
      target1: `Target 1: Resistance R2 ($${target1.toLocaleString()})`,
      target2: `Target 2: Resistance R3 / Globex High ($${target2.toLocaleString()})`,
      riskReward: `1:${rr} (Target 1) / 1:${risk > 0 ? ((target2 - entry) / risk).toFixed(2) : '3.80'} (Target 2)`,
      volumeConfirmation: 'Volume > 1.5x 20-period average on the breakout candle with aggressive market buy tape.',
      direction: 'LONG',
      entryPriceRef: entry,
      stopPriceRef: stop,
      target1PriceRef: target1,
      target2PriceRef: target2
    });
  } else {
    const entry = Number((pivots.s1).toFixed(2));
    const stop = Number((pivots.pivot).toFixed(2));
    const target1 = Number((pivots.s2).toFixed(2));
    const target2 = Number((pivots.s3).toFixed(2));
    const risk = stop - entry;
    const reward = entry - target1;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.15';

    setups.push({
      setup: 'Setup 2: Value Area Low / S1 Breakdown Short (Initiative Liquidation)',
      triggerEntry: `Breakdown confirmation and bear-flag retest below Support S1 ($${entry.toLocaleString()}) with sustained offer stacking.`,
      invalidationStop: `Quick reclaim of Floor Pivot ($${stop.toLocaleString()}) on high volume indicating bear trap.`,
      target1: `Target 1: Support S2 ($${target1.toLocaleString()})`,
      target2: `Target 2: Support S3 ($${target2.toLocaleString()})`,
      riskReward: `1:${rr} (Target 1) / 1:${risk > 0 ? ((entry - target2) / risk).toFixed(2) : '3.60'} (Target 2)`,
      volumeConfirmation: 'Heavy sell volume (> 1.4x 20-day average pace) and delta flush.',
      direction: 'SHORT',
      entryPriceRef: entry,
      stopPriceRef: stop,
      target1PriceRef: target1,
      target2PriceRef: target2
    });
  }

  // Setup 3: Prior Day Liquidity Sweep Reversal
  const isSweepHigh = currentPrice > priorDay.high * 0.99;
  if (isSweepHigh) {
    const entry = Number((priorDay.high).toFixed(2));
    const stop = Number((priorDay.high + atrStopIntra * 1.1).toFixed(2));
    const target1 = Number((sessionVwap).toFixed(2));
    const target2 = Number((vp.val).toFixed(2));
    const risk = stop - entry;
    const reward = entry - target1;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.40';

    setups.push({
      setup: 'Setup 3: Prior Day High Liquidity Sweep Short (False Break Reversal)',
      triggerEntry: `Wick probe above Prior Day High ($${entry.toLocaleString()}) followed by swift 5m rejection closing back inside prior day range.`,
      invalidationStop: `Consecutive 15m closes above $${stop.toLocaleString()} representing genuine institutional initiative buying.`,
      target1: `Target 1: Current Session VWAP ($${target1.toLocaleString()})`,
      target2: `Target 2: Value Area Low ($${target2.toLocaleString()})`,
      riskReward: `1:${rr} (Target 1) / 1:${risk > 0 ? ((entry - target2) / risk).toFixed(2) : '4.10'} (Target 2)`,
      volumeConfirmation: 'Delta divergence (price creates new high while cumulative volume delta makes lower high), followed by trapped long liquidations.',
      direction: 'SHORT',
      entryPriceRef: entry,
      stopPriceRef: stop,
      target1PriceRef: target1,
      target2PriceRef: target2
    });
  } else {
    const entry = Number((priorDay.low).toFixed(2));
    const stop = Number((priorDay.low - atrStopIntra * 1.1).toFixed(2));
    const target1 = Number((sessionVwap).toFixed(2));
    const target2 = Number((vp.vah).toFixed(2));
    const risk = entry - stop;
    const reward = target1 - entry;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '2.35';

    setups.push({
      setup: 'Setup 3: Prior Day Low Liquidity Sweep Long (False Break Reversal)',
      triggerEntry: `Wick probe below Prior Day Low ($${entry.toLocaleString()}) trapping stop runs, followed by rapid 5m reclaim of PDL.`,
      invalidationStop: `Sustained trading below $${stop.toLocaleString()} confirming structural breakdown into multi-session discount.`,
      target1: `Target 1: Current Session VWAP ($${target1.toLocaleString()})`,
      target2: `Target 2: Value Area High ($${target2.toLocaleString()})`,
      riskReward: `1:${rr} (Target 1) / 1:${risk > 0 ? ((target2 - entry) / risk).toFixed(2) : '4.20'} (Target 2)`,
      volumeConfirmation: 'Aggressive absorption on bid depth at PDL with immediate delta reversal on reclaim.',
      direction: 'LONG',
      entryPriceRef: entry,
      stopPriceRef: stop,
      target1PriceRef: target1,
      target2PriceRef: target2
    });
  }

  return setups;
}

export function generateRiskNotes(
  atr: ATRData,
  options: OptionsData,
  symbol: TickerSymbol,
  catalysts: CatalystEvent[]
): string[] {
  const notes: string[] = [];

  // 1. Genuine catalyst note with exact time
  const highImpact = catalysts.find((c) => c.impact === 'HIGH');
  const mediumImpact = catalysts.find((c) => c.impact === 'MEDIUM');
  const activeEvent = highImpact || mediumImpact;

  if (activeEvent && activeEvent.sourceType !== 'NO_TIER1_CONFIRMED') {
    notes.push(
      `Scheduled Catalyst Risk: ${activeEvent.event} at ${activeEvent.timeUTC} (${activeEvent.timeEST}). ${activeEvent.notes}`
    );
  } else {
    notes.push(
      `Macro Calendar: No Tier-1 macro releases (CPI/NFP/FOMC) confirmed for today's session. Routine session liquidity transitions govern intraday flow (London 08:00 UTC, US Cash Open 13:30 UTC).`
    );
  }

  // 2. Volatility regime & sizing
  notes.push(
    `Volatility Regime: 14-period daily ATR is $${atr.atr14Daily.toLocaleString()} (${atr.atrRatioTo20d}x vs 20-day avg). Regime is ${atr.volatilityRegime}. ${
      atr.volatilityRegime === 'EXPANDED' || atr.volatilityRegime === 'EXTREME'
        ? 'Scale down contract size to 65% of standard unit risk and widen stops to 1.5x 1H ATR.'
        : 'Standard sizing permitted with 1.25x 1H ATR stop boundaries.'
    }`
  );

  // 3. Options market risk / gamma pin
  if (options.isAvailable && options.maxPainStrike && options.maxPainStrike > 0) {
    const pcRatioText = options.putCallOIRatio !== undefined ? ` (P/C OI Ratio: ${options.putCallOIRatio})` : '';
    const skewText = options.skew25d !== undefined ? ` 25-Delta Skew: ${options.skew25d > 0 ? '+' : ''}${options.skew25d}%.` : '';
    notes.push(
      `Deribit Options Pin Risk: Nearest weekly Max Pain is anchored at $${options.maxPainStrike.toLocaleString()}${pcRatioText}.${skewText} Expect dealer gamma hedging to dampen breakouts approaching this strike prior to 08:00 UTC settlement.`
    );
  } else {
    notes.push(
      `Derivatives Risk Flag: ${options.unavailableReason || 'Centralized options book data unavailable for this asset.'} Traders must rely strictly on spot volume profile and floor pivots for positioning.`
    );
  }

  // 4. Overnight / Globex liquidity
  notes.push(
    `Execution & Liquidity Window: Asian/European handover (07:00-09:00 UTC) and US Pre-Market open (12:00-13:30 UTC) will dictate intraday directional continuation. Avoid market orders during illiquid session transitions.`
  );

  // 5. Invalidation mandate
  notes.push(
    'Strict Plan Discipline: Intraday setups are strictly invalid upon 15-minute candle closing through defined stop levels. Trailing stops should lock in breakeven once Target 1 is hit.'
  );

  return notes.slice(0, 5);
}

export function generateDeskBrief(raw: RawMarketPayload, session: TradingSession = 'ALL'): PreMarketBrief {
  const { symbol, dailyCandles, hourlyCandles, currentPrice, high24h, low24h, volume24h, change24h, change24hPercent, dataSource, timestamp, isLive, options, syntheticTimeframes } = raw;

  const priorDay = computePriorDayStats(dailyCandles, hourlyCandles);
  const pivots = computeFloorPivots(priorDay);
  const volumeProfile = computeVolumeProfile(hourlyCandles, 10);
  const movingAverages = computeMovingAverages(dailyCandles, currentPrice);
  const atr = computeATR(dailyCandles, hourlyCandles);
  const fibonacci = computeFibonacci(dailyCandles);
  const gaps = detectUntestedGaps(hourlyCandles, dailyCandles, currentPrice);
  const sessionVwapData = computeSessionVWAP(hourlyCandles, session, currentPrice);
  const preMarket = computePreMarketData(currentPrice, high24h, low24h, volume24h, change24h, change24hPercent, dailyCandles, hourlyCandles);
  const marketStructure = deriveMarketStructure(
    currentPrice,
    priorDay,
    sessionVwapData.price,
    volumeProfile,
    movingAverages,
    symbol,
    dailyCandles,
    change24hPercent,
    preMarket.volumeRatio20d
  );

  const catalysts = getScheduledCatalysts();
  const keyLevels = generateKeyLevels(priorDay, pivots, volumeProfile, sessionVwapData.price, movingAverages, fibonacci, gaps);
  const tradeSetups = generateTradeSetups(currentPrice, priorDay, pivots, volumeProfile, sessionVwapData.price, atr, marketStructure);
  const riskNotes = generateRiskNotes(atr, options, symbol, catalysts);

  // Summary Bias: 1-paragraph summary bias (bullish/bearish/neutral + why, 3 sentences max)
  let summaryBiasType: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let summaryBias = '';

  if (currentPrice > sessionVwapData.price && currentPrice > priorDay.close) {
    summaryBiasType = 'BULLISH';
    summaryBias = `${symbol} maintains an intraday BULLISH bias as price sustains acceptance above the Session VWAP ($${sessionVwapData.price.toLocaleString()}) and trades above prior day close ($${priorDay.close.toLocaleString()}). Higher-timeframe momentum is supported by the Daily 9 EMA ($${(movingAverages.find(m => m.period === 9)?.value || 0).toLocaleString()}), with buyers establishing auction control inside the upper Value Area. Upside focus remains on challenging Resistance R1 ($${pivots.r1.toLocaleString()}) and recent swing highs while price holds above Support S1 ($${pivots.s1.toLocaleString()}).`;
  } else if (currentPrice < sessionVwapData.price && currentPrice < priorDay.close) {
    summaryBiasType = 'BEARISH';
    summaryBias = `${symbol} carries an intraday BEARISH posture following failure to reclaim the Session VWAP ($${sessionVwapData.price.toLocaleString()}) and continued distribution beneath the Prior Day Close ($${priorDay.close.toLocaleString()}). Sellers hold structural initiative as price balances below the 10-session POC ($${volumeProfile.poc.toLocaleString()}), threatening a liquidity sweep of Prior Day Low ($${priorDay.low.toLocaleString()}). The immediate tactical target rests at Support S1 ($${pivots.s1.toLocaleString()}) with any counter-trend rallies expected to meet aggressive supply at Floor Pivot ($${pivots.pivot.toLocaleString()}).`;
  } else {
    summaryBiasType = 'NEUTRAL';
    summaryBias = `${symbol} exhibits a NEUTRAL rotational bias, currently balancing within yesterday's Value Area between VAL ($${volumeProfile.val.toLocaleString()}) and VAH ($${volumeProfile.vah.toLocaleString()}) while hugging the Session VWAP ($${sessionVwapData.price.toLocaleString()}). The higher-timeframe trend conflicts with intraday choppy price action as 24-hour volume paces at ${preMarket.volumeRatio20d}x its 20-day mean. Range-bound execution is warranted until a high-volume 15-minute expansion confirms directional break outside the S1 ($${pivots.s1.toLocaleString()}) to R1 ($${pivots.r1.toLocaleString()}) corridor.`;
  }

  return {
    symbol,
    session,
    date: new Date().toISOString().split('T')[0],
    timestamp,
    dataSource,
    isStale: !isLive || syntheticTimeframes.length > 0,
    stalenessNotes: !isLive
      ? 'Data operating in cached desk fallback mode. Live REST handshake re-attempting in background.'
      : syntheticTimeframes.length > 0
      ? `Primary feed is live, but ${syntheticTimeframes.join(', ')} candle(s) fell back to cached/synthetic data after an upstream request failure. Levels and setups derived from those timeframes (Session VWAP, 1H ATR, Volume Profile) should be treated as degraded until the next successful refresh.`
      : undefined,
    syntheticTimeframes,
    currentPrice,
    summaryBias,
    summaryBiasType,
    keyLevels,
    tradeSetups,
    riskNotes,
    priorDay,
    sessionVwap: sessionVwapData,
    pivots,
    volumeProfile,
    movingAverages,
    atr,
    fibonacci,
    gaps,
    marketStructure,
    preMarket,
    options,
    catalysts,
    dailyCandles,
    hourlyCandles,
    fifteenMinCandles: raw.fifteenMinCandles,
    fiveMinCandles: raw.fiveMinCandles,
  };
}

export function getTodayDateFormatted(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
