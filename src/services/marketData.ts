import { Candle, OptionsData, TickerSymbol } from '../types';

export interface RawMarketPayload {
  symbol: TickerSymbol;
  dailyCandles: Candle[];
  hourlyCandles: Candle[];
  fifteenMinCandles?: Candle[];
  fiveMinCandles?: Candle[];
  currentPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  change24hPercent: number;
  dataSource: string;
  timestamp: string;
  isLive: boolean;
  options: OptionsData;
  /** Timeframes that had to fall back to synthetic/cached candles even though the
   * overall payload is otherwise live (e.g. hourly klines request failed but daily
   * + ticker succeeded). Empty array when every timeframe is genuine. */
  syntheticTimeframes: string[];
}

const BINANCE_PAIR_MAP: Record<TickerSymbol, string> = {
  'BTC-USD': 'BTCUSDT',
  'ETH-USD': 'ETHUSDT',
  'SOL-USD': 'SOLUSDT',
  'XAUT-USD': 'PAXGUSDT',
};

// Fallback seed generator if offline or rate limited (provides 30 full daily candles, 48 hourly, 48 15m, 48 5m)
function getFallbackCandles(symbol: TickerSymbol): {
  daily: Candle[];
  hourly: Candle[];
  fifteenMin: Candle[];
  fiveMin: Candle[];
} {
  const basePrice =
    symbol === 'BTC-USD'
      ? 78200
      : symbol === 'ETH-USD'
      ? 2480
      : symbol === 'SOL-USD'
      ? 142
      : 4310;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const fifteenMs = 15 * 60 * 1000;
  const fiveMs = 5 * 60 * 1000;

  // Generate 30 completed daily candles for genuine 20-day moving average volume
  const daily: Candle[] = [];
  let prevClose = basePrice * 0.94;

  for (let i = 29; i >= 0; i--) {
    const time = now - i * dayMs;
    const vol =
      (basePrice > 10000 ? 12000 : 80000) * (0.85 + Math.sin(i * 0.4) * 0.25);
    const range = prevClose * 0.022;
    const open = prevClose;
    const high = open + Math.abs(Math.cos(i) * range);
    const low = open - Math.abs(Math.sin(i) * range);
    const close = (open + high + low) / 3;
    const vwap = (open + high + low + close) / 4;
    daily.push({
      timestamp: time,
      open,
      high,
      low,
      close,
      volume: vol,
      quoteVolume: vol * close,
      vwap,
    });
    prevClose = close;
  }

  const hourly: Candle[] = [];
  let hClose = daily[daily.length - 2].close;
  for (let h = 48; h >= 0; h--) {
    const time = now - h * hourMs;
    const hRange = hClose * 0.007;
    const open = hClose;
    const high = open + Math.abs(Math.sin(h * 0.7) * hRange);
    const low = open - Math.abs(Math.cos(h * 0.7) * hRange);
    const close = (open + high + low) / 3;
    const vol =
      (basePrice > 10000 ? 800 : 5000) * (0.65 + Math.cos(h * 0.3) * 0.35);
    hourly.push({
      timestamp: time,
      open,
      high,
      low,
      close,
      volume: vol,
      quoteVolume: vol * close,
      vwap: (open + high + low + close) / 4,
    });
    hClose = close;
  }

  const fifteenMin: Candle[] = [];
  let m15Close = hourly[hourly.length - 1].close;
  for (let m = 48; m >= 0; m--) {
    const time = now - m * fifteenMs;
    const mRange = m15Close * 0.0035;
    const open = m15Close;
    const high = open + Math.abs(Math.sin(m * 0.85) * mRange);
    const low = open - Math.abs(Math.cos(m * 0.85) * mRange);
    const close = (open + high + low) / 3;
    const vol =
      (basePrice > 10000 ? 250 : 1500) * (0.7 + Math.sin(m * 0.5) * 0.3);
    fifteenMin.push({
      timestamp: time,
      open,
      high,
      low,
      close,
      volume: vol,
      quoteVolume: vol * close,
      vwap: (open + high + low + close) / 4,
    });
    m15Close = close;
  }

  const fiveMin: Candle[] = [];
  let m5Close = fifteenMin[fifteenMin.length - 1].close;
  for (let m = 48; m >= 0; m--) {
    const time = now - m * fiveMs;
    const mRange = m5Close * 0.002;
    const open = m5Close;
    const high = open + Math.abs(Math.sin(m * 1.2) * mRange);
    const low = open - Math.abs(Math.cos(m * 1.2) * mRange);
    const close = (open + high + low) / 3;
    const vol =
      (basePrice > 10000 ? 90 : 600) * (0.6 + Math.cos(m * 0.4) * 0.4);
    fiveMin.push({
      timestamp: time,
      open,
      high,
      low,
      close,
      volume: vol,
      quoteVolume: vol * close,
      vwap: (open + high + low + close) / 4,
    });
    m5Close = close;
  }

  return { daily, hourly, fifteenMin, fiveMin };
}

async function fetchWithTimeout(url: string, timeoutMs: number = 3500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Compute 30-day realized volatility (HV30) from daily candles
function computeHistoricalVol30d(candles: Candle[]): number {
  if (candles.length < 5) return 0;
  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const p1 = candles[i - 1].close;
    const p2 = candles[i].close;
    if (p1 > 0 && p2 > 0) {
      returns.push(Math.log(p2 / p1));
    }
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const dailyStdev = Math.sqrt(variance);
  return Number((dailyStdev * Math.sqrt(365) * 100).toFixed(1));
}

export function getFallbackPayload(symbol: TickerSymbol): RawMarketPayload {
  const { daily, hourly, fifteenMin, fiveMin } = getFallbackCandles(symbol);
  const last = daily[daily.length - 1];
  const prev = daily[daily.length - 2];
  const hv30 = computeHistoricalVol30d(daily);

  return {
    symbol,
    dailyCandles: daily,
    hourlyCandles: hourly,
    fifteenMinCandles: fifteenMin,
    fiveMinCandles: fiveMin,
    currentPrice: last.close,
    high24h: last.high,
    low24h: last.low,
    volume24h: last.volume,
    change24h: last.close - prev.close,
    change24hPercent: ((last.close - prev.close) / prev.close) * 100,
    dataSource: 'Institutional Desk Cache (Fallback Feed)',
    timestamp: new Date().toISOString(),
    isLive: false,
    syntheticTimeframes: ['1D', '1H', '15m', '5m'],
    options: {
      isAvailable: false,
      unavailableReason:
        'Operating in offline/cached desk fallback mode. Real-time Deribit options Greeks and gamma clusters omitted to prevent ungrounded execution decisions.',
      sourceVenue: 'Cache Fallback',
      realizedVol30d: hv30,
      gammaClusterCalls: [],
      gammaClusterPuts: [],
    },
  };
}

export async function fetchLiveMarketData(symbol: TickerSymbol): Promise<RawMarketPayload> {
  const timestamp = new Date().toISOString();
  let dataSource = 'Binance Public REST v3';

  try {
    if (symbol === 'XAUT-USD') {
      // Fetch Bitfinex XAUT data
      try {
        dataSource = 'Bitfinex Public REST v2';
        const resCandles = await fetchWithTimeout(
          'https://api-pub.bitfinex.com/v2/candles/trade:1D:tXAUT:USD/hist?limit=30'
        );
        const resTicker = await fetchWithTimeout(
          'https://api-pub.bitfinex.com/v2/ticker/tXAUT:USD'
        );

        if (resCandles.ok && resTicker.ok) {
          const rawCandles = await resCandles.json();
          const ticker = await resTicker.json();

          const sorted = [...rawCandles].reverse();
          const dailyCandles: Candle[] = sorted.map((c: number[]) => ({
            timestamp: c[0],
            open: c[1],
            close: c[2],
            high: c[3],
            low: c[4],
            volume: c[5],
            vwap: (c[1] + c[3] + c[4] + c[2]) / 4,
          }));

          const resHourly = await fetchWithTimeout(
            'https://api-pub.bitfinex.com/v2/candles/trade:1h:tXAUT:USD/hist?limit=48'
          );
          let hourlyCandles: Candle[] = [];
          const syntheticTimeframes: string[] = [];
          if (resHourly.ok) {
            const rawH = await resHourly.json();
            hourlyCandles = [...rawH].reverse().map((c: number[]) => ({
              timestamp: c[0],
              open: c[1],
              close: c[2],
              high: c[3],
              low: c[4],
              volume: c[5],
              vwap: (c[1] + c[3] + c[4] + c[2]) / 4,
            }));
          } else {
            hourlyCandles = getFallbackCandles('XAUT-USD').hourly;
            syntheticTimeframes.push('1H');
          }
          // Bitfinex has no convenient 15m/5m trade candle endpoint wired up here,
          // so these two timeframes are always synthetic on this path — flag them
          // rather than presenting them as genuine ticks.
          syntheticTimeframes.push('15m', '5m');

          const lastPrice = ticker[6];
          const dailyChange = ticker[4];
          const dailyChangePerc = ticker[5] * 100;
          const high24h = ticker[8];
          const low24h = ticker[9];
          const volume24h = ticker[7];
          const hv30 = computeHistoricalVol30d(dailyCandles);

          return {
            symbol,
            dailyCandles,
            hourlyCandles,
            fifteenMinCandles: getFallbackCandles('XAUT-USD').fifteenMin,
            fiveMinCandles: getFallbackCandles('XAUT-USD').fiveMin,
            currentPrice: lastPrice,
            high24h,
            low24h,
            volume24h,
            change24h: dailyChange,
            change24hPercent: dailyChangePerc,
            dataSource,
            timestamp,
            isLive: true,
            syntheticTimeframes,
            options: {
              isAvailable: false,
              unavailableReason:
                'Options contracts for Tether Gold (XAUT) are not listed on institutional regulated derivatives exchanges (Deribit/CME). Desk flags options data as unavailable/OTC.',
              sourceVenue: 'Unlisted',
              realizedVol30d: hv30,
              gammaClusterCalls: [],
              gammaClusterPuts: [],
            },
          };
        }
      } catch (err) {
        console.warn('Bitfinex fetch failed, falling back to Binance PAXG proxy', err);
        const binanceSymbol = 'PAXGUSDT';
        dataSource = 'Binance Public REST v3 (PAXG Proxy for Gold)';
        const [klineRes, tickerRes, hourRes, m15Res, m5Res] = await Promise.all([
          fetchWithTimeout(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=30`
          ),
          fetchWithTimeout(
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`
          ),
          fetchWithTimeout(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1h&limit=48`
          ),
          fetchWithTimeout(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=15m&limit=48`
          ).catch(() => null),
          fetchWithTimeout(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=5m&limit=48`
          ).catch(() => null),
        ]);

        if (klineRes.ok && tickerRes.ok) {
          const klines = await klineRes.json();
          const t = await tickerRes.json();
          const hKlines = hourRes.ok ? await hourRes.json() : [];
          const m15Klines = m15Res && m15Res.ok ? await m15Res.json() : [];
          const m5Klines = m5Res && m5Res.ok ? await m5Res.json() : [];
          const fallback = getFallbackCandles('XAUT-USD');

          const mapBinanceCandles = (arr: any[]): Candle[] =>
            arr.map((k: (string | number)[]) => {
              const open = parseFloat(String(k[1]));
              const high = parseFloat(String(k[2]));
              const low = parseFloat(String(k[3]));
              const close = parseFloat(String(k[4]));
              const volume = parseFloat(String(k[5]));
              const quoteVol = parseFloat(String(k[7]));
              const vwap = quoteVol > 0 && volume > 0 ? quoteVol / volume : (high + low + close) / 3;
              return {
                timestamp: Number(k[0]),
                open,
                high,
                low,
                close,
                volume,
                quoteVolume: quoteVol,
                vwap,
              };
            });

          const dailyCandles = mapBinanceCandles(klines);
          const hourlyCandles = hKlines.length ? mapBinanceCandles(hKlines) : fallback.hourly;
          const fifteenMinCandles = m15Klines.length ? mapBinanceCandles(m15Klines) : fallback.fifteenMin;
          const fiveMinCandles = m5Klines.length ? mapBinanceCandles(m5Klines) : fallback.fiveMin;
          const hv30 = computeHistoricalVol30d(dailyCandles);
          const syntheticTimeframes: string[] = [
            ...(hKlines.length ? [] : ['1H']),
            ...(m15Klines.length ? [] : ['15m']),
            ...(m5Klines.length ? [] : ['5m']),
          ];

          return {
            symbol: 'XAUT-USD',
            dailyCandles,
            hourlyCandles,
            fifteenMinCandles,
            fiveMinCandles,
            currentPrice: parseFloat(t.lastPrice),
            high24h: parseFloat(t.highPrice),
            low24h: parseFloat(t.lowPrice),
            volume24h: parseFloat(t.volume),
            change24h: parseFloat(t.priceChange),
            change24hPercent: parseFloat(t.priceChangePercent),
            dataSource,
            timestamp,
            isLive: true,
            syntheticTimeframes,
            options: {
              isAvailable: false,
              unavailableReason:
                'Options contracts for Gold Token (PAXG/XAUT) are not listed on institutional regulated crypto derivatives exchanges (Deribit/CME). Desk flags options data as unavailable.',
              sourceVenue: 'Unlisted',
              realizedVol30d: hv30,
              gammaClusterCalls: [],
              gammaClusterPuts: [],
            },
          };
        }
      }
    }

    // BTC, ETH, or SOL from Binance
    const binancePair = BINANCE_PAIR_MAP[symbol] || 'BTCUSDT';

    const [klineRes, tickerRes, hourRes, fifteenRes, fiveRes] = await Promise.all([
      fetchWithTimeout(
        `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=1d&limit=30`
      ),
      fetchWithTimeout(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${binancePair}`
      ),
      fetchWithTimeout(
        `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=1h&limit=48`
      ),
      fetchWithTimeout(
        `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=15m&limit=48`
      ).catch(() => null),
      fetchWithTimeout(
        `https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=5m&limit=48`
      ).catch(() => null),
    ]);

    if (!klineRes.ok || !tickerRes.ok) {
      throw new Error(`Binance API error: ${klineRes.status} ${tickerRes.status}`);
    }

    const rawKlines = await klineRes.json();
    const ticker = await tickerRes.json();
    const rawHourly = hourRes.ok ? await hourRes.json() : [];
    const raw15 = fifteenRes && fifteenRes.ok ? await fifteenRes.json() : [];
    const raw5 = fiveRes && fiveRes.ok ? await fiveRes.json() : [];
    const fallback = getFallbackCandles(symbol);

    const parseKlines = (arr: any[]): Candle[] =>
      arr.map((k: (string | number)[]) => {
        const open = parseFloat(String(k[1]));
        const high = parseFloat(String(k[2]));
        const low = parseFloat(String(k[3]));
        const close = parseFloat(String(k[4]));
        const volume = parseFloat(String(k[5]));
        const quoteVol = parseFloat(String(k[7]));
        const vwap = quoteVol > 0 && volume > 0 ? quoteVol / volume : (high + low + close) / 3;
        return {
          timestamp: Number(k[0]),
          open,
          high,
          low,
          close,
          volume,
          quoteVolume: quoteVol,
          vwap,
        };
      });

    const dailyCandles: Candle[] = parseKlines(rawKlines);
    const hourlyCandles: Candle[] = rawHourly.length ? parseKlines(rawHourly) : fallback.hourly;
    const fifteenMinCandles: Candle[] = raw15.length ? parseKlines(raw15) : fallback.fifteenMin;
    const fiveMinCandles: Candle[] = raw5.length ? parseKlines(raw5) : fallback.fiveMin;
    const syntheticTimeframes: string[] = [
      ...(rawHourly.length ? [] : ['1H']),
      ...(raw15.length ? [] : ['15m']),
      ...(raw5.length ? [] : ['5m']),
    ];

    const lastSpotPrice = parseFloat(ticker.lastPrice);
    const hv30 = computeHistoricalVol30d(dailyCandles);

    // Live options analysis from Deribit if BTC or ETH
    let options: OptionsData;
    if (symbol === 'BTC-USD' || symbol === 'ETH-USD') {
      try {
        const deribitCurr = symbol === 'BTC-USD' ? 'BTC' : 'ETH';
        const dRes = await fetchWithTimeout(
          `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${deribitCurr}&kind=option`,
          4000
        );

        if (dRes.ok) {
          const dData = await dRes.json();
          const items: any[] = dData.result || [];

          if (items.length > 0) {
            let totalCallOI = 0;
            let totalPutOI = 0;
            let totalCallVol = 0;
            let totalPutVol = 0;
            const strikeOI: { [strike: number]: { calls: number; puts: number } } = {};
            let nearestExpiry = '';

            // Map contracts to parse real ATM IV and nearest expiry
            let closestAtmDiff = Infinity;
            let realAtmIV = 0;

            let closestCall25Diff = Infinity;
            let call25IV = 0;
            let closestPut25Diff = Infinity;
            let put25IV = 0;

            for (const it of items) {
              const name: string = it.instrument_name || '';
              const parts = name.split('-');
              if (parts.length >= 4) {
                const exp = parts[1];
                if (!nearestExpiry) nearestExpiry = exp;
                const strike = parseFloat(parts[2]);
                const type = parts[3]; // 'C' or 'P'
                const oi = parseFloat(it.open_interest || '0');
                const vol = parseFloat(it.volume || '0');
                const markIv = parseFloat(it.mark_iv || '0');

                if (!strikeOI[strike]) strikeOI[strike] = { calls: 0, puts: 0 };

                if (type === 'C') {
                  totalCallOI += oi;
                  totalCallVol += vol;
                  strikeOI[strike].calls += oi;

                  // ATM Call IV
                  const diff = Math.abs(strike - lastSpotPrice);
                  if (diff < closestAtmDiff && markIv > 0) {
                    closestAtmDiff = diff;
                    realAtmIV = markIv;
                  }

                  // 25-Delta Call approximation (~1.08x spot)
                  const call25Target = lastSpotPrice * 1.08;
                  const cDiff = Math.abs(strike - call25Target);
                  if (cDiff < closestCall25Diff && markIv > 0) {
                    closestCall25Diff = cDiff;
                    call25IV = markIv;
                  }
                } else if (type === 'P') {
                  totalPutOI += oi;
                  totalPutVol += vol;
                  strikeOI[strike].puts += oi;

                  // 25-Delta Put approximation (~0.92x spot)
                  const put25Target = lastSpotPrice * 0.92;
                  const pDiff = Math.abs(strike - put25Target);
                  if (pDiff < closestPut25Diff && markIv > 0) {
                    closestPut25Diff = pDiff;
                    put25IV = markIv;
                  }
                }
              }
            }

            // Calculate True Max Pain from real OI
            const strikes = Object.keys(strikeOI)
              .map(Number)
              .sort((a, b) => a - b);
            let minPain = Infinity;
            let maxPainStrike = lastSpotPrice;

            for (const s of strikes) {
              let totalLoss = 0;
              for (const other of strikes) {
                if (s > other) {
                  totalLoss += (s - other) * strikeOI[other].calls;
                } else if (s < other) {
                  totalLoss += (other - s) * strikeOI[other].puts;
                }
              }
              if (totalLoss < minPain && totalLoss > 0) {
                minPain = totalLoss;
                maxPainStrike = s;
              }
            }

            // Real Gamma cluster top strikes from live OI
            const topCalls = Object.entries(strikeOI)
              .map(([strk, val]) => ({ strike: Number(strk), oi: val.calls }))
              .filter((c) => c.oi > 0)
              .sort((a, b) => b.oi - a.oi)
              .slice(0, 3);

            const topPuts = Object.entries(strikeOI)
              .map(([strk, val]) => ({ strike: Number(strk), oi: val.puts }))
              .filter((p) => p.oi > 0)
              .sort((a, b) => b.oi - a.oi)
              .slice(0, 3);

            const putCallOIRatio =
              totalCallOI > 0 ? parseFloat((totalPutOI / totalCallOI).toFixed(2)) : undefined;
            const putCallVolRatio =
              totalCallVol > 0 ? parseFloat((totalPutVol / totalCallVol).toFixed(2)) : undefined;

            const computedSkew =
              put25IV > 0 && call25IV > 0
                ? parseFloat((put25IV - call25IV).toFixed(1))
                : undefined;

            const finalAtmIV = realAtmIV > 0 ? parseFloat(realAtmIV.toFixed(1)) : undefined;

            options = {
              isAvailable: true,
              sourceVenue: 'Deribit Live REST v2',
              nearestExpiry: nearestExpiry || 'Upcoming Weekly Expiry',
              putCallVolumeRatio: putCallVolRatio,
              putCallOIRatio: putCallOIRatio,
              atmIV: finalAtmIV,
              realizedVol30d: hv30,
              ivHvSpread:
                finalAtmIV && hv30 > 0 ? parseFloat((finalAtmIV - hv30).toFixed(1)) : undefined,
              maxPainStrike: maxPainStrike > 0 ? maxPainStrike : undefined,
              gammaClusterCalls: topCalls,
              gammaClusterPuts: topPuts,
              skew25d: computedSkew,
            };
          } else {
            throw new Error('Deribit returned empty items array');
          }
        } else {
          throw new Error(`Deribit API returned status ${dRes.status}`);
        }
      } catch (dErr) {
        console.warn('Deribit options live handshake failed, omitting synthetic figures', dErr);
        // NO FAKE NUMBERS: explicitly flag unavailable to avoid misleading traders
        options = {
          isAvailable: false,
          unavailableReason:
            'Deribit options order book API unavailable (CORS or rate limit). Greeks and gamma clusters omitted rather than estimated.',
          sourceVenue: 'API Blocked / Offline',
          realizedVol30d: hv30,
          gammaClusterCalls: [],
          gammaClusterPuts: [],
        };
      }
    } else {
      // SOL options unlisted on centralized institutional venues
      options = {
        isAvailable: false,
        unavailableReason: `Centralized options order books for ${symbol} on institutional venues (Deribit/CME) are thin or not listed. Desk flags derivatives skew as unavailable.`,
        sourceVenue: 'Unlisted',
        realizedVol30d: hv30,
        gammaClusterCalls: [],
        gammaClusterPuts: [],
      };
    }

    return {
      symbol,
      dailyCandles,
      hourlyCandles,
      fifteenMinCandles,
      fiveMinCandles,
      currentPrice: lastSpotPrice,
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice),
      volume24h: parseFloat(ticker.volume),
      change24h: parseFloat(ticker.priceChange),
      change24hPercent: parseFloat(ticker.priceChangePercent),
      dataSource,
      timestamp,
      isLive: true,
      syntheticTimeframes,
      options,
    };
  } catch (err: any) {
    console.warn(`Live feed failed for ${symbol}, utilizing cached desk data:`, err);
    return getFallbackPayload(symbol);
  }
}

export const fetchMarketData = fetchLiveMarketData;
