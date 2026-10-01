import { useEffect, useRef, useState } from 'react';
import { Candle, ChartTimeframe, TickerSymbol } from '../types';

export interface BarCountdown {
  formatted: string;
  remainingSeconds: number;
  progressPct: number;
  closesAtUTC: string;
}

export interface LiveBarTick {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  timestamp: number;
  isClosed: boolean;
  tradesCount: number;
  lastTickPrice: number;
  lastTickSize: number;
  lastTickTime: number;
  tickDirection: 'up' | 'down' | 'neutral';
}

export interface LiveTickerState {
  livePrice: number;
  priceDirection: 'up' | 'down' | 'neutral';
  isLiveConnected: boolean;
  countdown: BarCountdown;
  liveBar: LiveBarTick | null;
  tickCount: number;
  lastTickTime: number;
  lastTickSize: number;
  lastClosedBar: Candle | null;
  barIndex: number;
}

export function getBarStartTime(time: number, timeframe: ChartTimeframe): number {
  if (timeframe === '5m') {
    return Math.floor(time / (5 * 60 * 1000)) * (5 * 60 * 1000);
  }
  if (timeframe === '15m') {
    return Math.floor(time / (15 * 60 * 1000)) * (15 * 60 * 1000);
  }
  if (timeframe === '1H') {
    return Math.floor(time / (60 * 60 * 1000)) * (60 * 60 * 1000);
  }
  // 1D timeframe (00:00:00 UTC)
  const d = new Date(time);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
}

export function getBarDuration(timeframe: ChartTimeframe): number {
  switch (timeframe) {
    case '5m':
      return 5 * 60 * 1000;
    case '15m':
      return 15 * 60 * 1000;
    case '1H':
      return 60 * 60 * 1000;
    case '1D':
      return 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}

function calculateCountdown(timeframe: ChartTimeframe): BarCountdown {
  const now = Date.now();

  if (timeframe === '5m' || timeframe === '15m' || timeframe === '1H') {
    const barDuration =
      timeframe === '5m'
        ? 5 * 60 * 1000
        : timeframe === '15m'
        ? 15 * 60 * 1000
        : 3600 * 1000;

    const currentBarStart = Math.floor(now / barDuration) * barDuration;
    const nextBarClose = currentBarStart + barDuration;
    const remainingMs = Math.max(0, nextBarClose - now);
    const remainingSeconds = Math.floor(remainingMs / 1000);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const progressPct = Math.min(100, Math.max(0, ((now - currentBarStart) / barDuration) * 100));

    const nextDate = new Date(nextBarClose);
    const closesAtUTC =
      nextDate.toLocaleTimeString('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' UTC';

    return {
      formatted,
      remainingSeconds,
      progressPct,
      closesAtUTC,
    };
  } else {
    // 1D timeframe (resets at 00:00:00 UTC)
    const nowDate = new Date(now);
    const nextMidnightUTC = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1,
      0,
      0,
      0
    );
    const currentMidnightUTC = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate(),
      0,
      0,
      0
    );

    const totalDayMs = 86400 * 1000;
    const remainingMs = Math.max(0, nextMidnightUTC - now);
    const remainingSeconds = Math.floor(remainingMs / 1000);

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const progressPct = Math.min(100, Math.max(0, ((now - currentMidnightUTC) / totalDayMs) * 100));

    return {
      formatted,
      remainingSeconds,
      progressPct,
      closesAtUTC: '00:00 UTC',
    };
  }
}

export function useLiveTicker(
  symbol: TickerSymbol,
  initialPrice: number,
  timeframe: ChartTimeframe
): LiveTickerState {
  const [livePrice, setLivePrice] = useState<number>(initialPrice);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<BarCountdown>(() => calculateCountdown(timeframe));
  const [liveBar, setLiveBar] = useState<LiveBarTick | null>(null);
  const [tickCount, setTickCount] = useState<number>(0);
  const [lastTickTime, setLastTickTime] = useState<number>(Date.now());
  const [lastTickSize, setLastTickSize] = useState<number>(0);
  const [lastClosedBar, setLastClosedBar] = useState<Candle | null>(null);
  const [barIndex, setBarIndex] = useState<number>(0);

  const prevPriceRef = useRef<number>(initialPrice);
  const directionTimeoutRef = useRef<any>(null);
  const tickCounterRef = useRef<number>(0);
  const liveBarRef = useRef<LiveBarTick | null>(null);
  const lastStateFlushRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Sync with initialPrice changes when brief refreshes or symbol changes
  useEffect(() => {
    if (initialPrice && initialPrice > 0) {
      setLivePrice(initialPrice);
      prevPriceRef.current = initialPrice;
    }
  }, [initialPrice, symbol]);

  // Real-time countdown timer (1 second ticks) + Clock bar-boundary transition
  useEffect(() => {
    setCountdown(calculateCountdown(timeframe));
    const timer = setInterval(() => {
      const cd = calculateCountdown(timeframe);
      setCountdown(cd);

      // Check if bar boundary has elapsed by clock time
      const expectedBarStart = getBarStartTime(Date.now(), timeframe);
      if (liveBarRef.current && expectedBarStart > liveBarRef.current.timestamp) {
        const prev = liveBarRef.current;
        const closedCandle: Candle = {
          timestamp: prev.timestamp,
          open: prev.open,
          high: prev.high,
          low: prev.low,
          close: prev.close,
          volume: prev.volume,
          quoteVolume: prev.quoteVolume,
          vwap: prev.volume > 0 ? prev.quoteVolume / prev.volume : prev.close,
        };
        setLastClosedBar(closedCandle);
        setBarIndex((b) => b + 1);

        liveBarRef.current = {
          open: prev.close,
          high: prev.close,
          low: prev.close,
          close: prev.close,
          volume: 0,
          quoteVolume: 0,
          timestamp: expectedBarStart,
          isClosed: false,
          tradesCount: 1,
          lastTickPrice: prev.close,
          lastTickSize: 0,
          lastTickTime: Date.now(),
          tickDirection: 'neutral',
        };

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        setLiveBar({ ...liveBarRef.current });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeframe]);

  // Real-time tick-by-tick stream via WebSocket
  useEffect(() => {
    const symbolMap: Record<TickerSymbol, string> = {
      'BTC-USD': 'btcusdt',
      'ETH-USD': 'ethusdt',
      'SOL-USD': 'solusdt',
      'XAUT-USD': 'paxgusdt',
      'XRP-USD': 'xrpusdt',
      'DOGE-USD': 'dogeusdt',
      'HYPE-USD': 'hypeusdt',
    };

    const streamPair = symbolMap[symbol];
    const isFutures = symbol === 'HYPE-USD';
    const isGold = symbol === 'XAUT-USD';
    const binanceInterval =
      timeframe === '5m' ? '5m' : timeframe === '15m' ? '15m' : timeframe === '1H' ? '1h' : '1d';

    let ws: WebSocket | null = null;
    let bfxWs: WebSocket | null = null;
    let pollTimer: any = null;
    let isDisposed = false;

    // Flush latest tick state to React on animation frame
    const scheduleFlush = () => {
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (isDisposed) return;
        if (liveBarRef.current) {
          setLiveBar({ ...liveBarRef.current });
        }
        setTickCount(tickCounterRef.current);
      });
    };

    const handleTickUpdate = (price: number, size: number, timestamp: number, isKlineAuthoritative = false) => {
      if (!price || isNaN(price) || price <= 0) return;

      const prev = prevPriceRef.current;
      let dir: 'up' | 'down' | 'neutral' = 'neutral';
      if (price > prev) {
        dir = 'up';
      } else if (price < prev) {
        dir = 'down';
      }

      if (dir !== 'neutral') {
        setPriceDirection(dir);
        if (directionTimeoutRef.current) {
          clearTimeout(directionTimeoutRef.current);
        }
        directionTimeoutRef.current = setTimeout(() => {
          if (!isDisposed) setPriceDirection('neutral');
        }, 800);
      }

      prevPriceRef.current = price;
      setLivePrice(price);
      setLastTickTime(timestamp);
      setLastTickSize(size);
      tickCounterRef.current += 1;

      const expectedBarStart = getBarStartTime(timestamp || Date.now(), timeframe);

      // Update or initialize liveBar
      if (!liveBarRef.current) {
        liveBarRef.current = {
          open: price,
          high: price,
          low: price,
          close: price,
          volume: size > 0 ? size : 0,
          quoteVolume: size > 0 ? size * price : 0,
          timestamp: expectedBarStart,
          isClosed: false,
          tradesCount: 1,
          lastTickPrice: price,
          lastTickSize: size,
          lastTickTime: timestamp,
          tickDirection: dir,
        };
      } else if (!isKlineAuthoritative) {
        // If trade timestamp or clock has crossed into the next bar
        if (expectedBarStart > liveBarRef.current.timestamp) {
          const cur = liveBarRef.current;
          const closedCandle: Candle = {
            timestamp: cur.timestamp,
            open: cur.open,
            high: cur.high,
            low: cur.low,
            close: cur.close,
            volume: cur.volume,
            quoteVolume: cur.quoteVolume,
            vwap: cur.volume > 0 ? cur.quoteVolume / cur.volume : cur.close,
          };
          setLastClosedBar(closedCandle);
          setBarIndex((b) => b + 1);

          liveBarRef.current = {
            open: cur.close,
            high: Math.max(cur.close, price),
            low: Math.min(cur.close, price),
            close: price,
            volume: size > 0 ? size : 0,
            quoteVolume: size > 0 ? size * price : 0,
            timestamp: expectedBarStart,
            isClosed: false,
            tradesCount: 1,
            lastTickPrice: price,
            lastTickSize: size,
            lastTickTime: timestamp,
            tickDirection: dir,
          };
        } else {
          const cur = liveBarRef.current;
          cur.close = price;
          cur.high = Math.max(cur.high, price);
          cur.low = Math.min(cur.low, price);
          if (size > 0) {
            cur.volume += size;
            cur.quoteVolume += size * price;
          }
          cur.tradesCount += 1;
          cur.lastTickPrice = price;
          cur.lastTickSize = size;
          cur.lastTickTime = timestamp;
          cur.tickDirection = dir;
        }
      }

      scheduleFlush();
    };

    const handleKlineAuthoritative = (k: any) => {
      if (!k) return;
      const o = parseFloat(k.o);
      const h = parseFloat(k.h);
      const l = parseFloat(k.l);
      const c = parseFloat(k.c);
      const v = parseFloat(k.v);
      const q = parseFloat(k.q);
      const isClosed = Boolean(k.x);
      const tradesCount = k.n || 0;
      const barStartTime = k.t;

      if (!liveBarRef.current || liveBarRef.current.timestamp !== barStartTime) {
        // If a previous bar existed, it has now closed!
        if (liveBarRef.current) {
          const cur = liveBarRef.current;
          const closedCandle: Candle = {
            timestamp: cur.timestamp,
            open: cur.open,
            high: cur.high,
            low: cur.low,
            close: cur.close,
            volume: cur.volume,
            quoteVolume: cur.quoteVolume,
            vwap: cur.volume > 0 ? cur.quoteVolume / cur.volume : cur.close,
          };
          setLastClosedBar(closedCandle);
          setBarIndex((b) => b + 1);
        }

        // New candle bar started
        liveBarRef.current = {
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
          quoteVolume: q,
          timestamp: barStartTime,
          isClosed,
          tradesCount,
          lastTickPrice: c,
          lastTickSize: 0,
          lastTickTime: Date.now(),
          tickDirection: 'neutral',
        };
      } else {
        const cur = liveBarRef.current;
        cur.open = o;
        cur.high = Math.max(cur.high, h);
        cur.low = Math.min(cur.low, l);
        cur.close = c;
        cur.volume = Math.max(cur.volume, v);
        cur.quoteVolume = Math.max(cur.quoteVolume, q);
        cur.isClosed = isClosed;
        cur.tradesCount = Math.max(cur.tradesCount, tradesCount);

        if (isClosed) {
          const closedCandle: Candle = {
            timestamp: cur.timestamp,
            open: cur.open,
            high: cur.high,
            low: cur.low,
            close: cur.close,
            volume: cur.volume,
            quoteVolume: cur.quoteVolume,
            vwap: cur.volume > 0 ? cur.quoteVolume / cur.volume : cur.close,
          };
          setLastClosedBar(closedCandle);
          setBarIndex((b) => b + 1);
        }
      }

      handleTickUpdate(c, 0, Date.now(), true);
    };

    // 1. Bitfinex WebSocket connection for XAUT-USD
    if (isGold && typeof WebSocket !== 'undefined') {
      try {
        bfxWs = new WebSocket('wss://api-pub.bitfinex.com/ws/2');
        bfxWs.onopen = () => {
          setIsLiveConnected(true);
          // Subscribe to live trades and ticker
          bfxWs?.send(
            JSON.stringify({
              event: 'subscribe',
              channel: 'trades',
              symbol: 'tXAUT:USD',
            })
          );
          bfxWs?.send(
            JSON.stringify({
              event: 'subscribe',
              channel: 'ticker',
              symbol: 'tXAUT:USD',
            })
          );
        };

        bfxWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (Array.isArray(data)) {
              const msgType = data[1];
              // Live trade tick: [chanId, "te" | "tu", [id, timestamp, amount, price]]
              if ((msgType === 'te' || msgType === 'tu') && Array.isArray(data[2])) {
                const trade = data[2];
                const tradePrice = Math.abs(trade[3]);
                const tradeAmount = Math.abs(trade[2]);
                const tradeTime = trade[1] || Date.now();
                handleTickUpdate(tradePrice, tradeAmount, tradeTime);
              } else if (Array.isArray(msgType) && msgType.length >= 10) {
                // Ticker snapshot/update: msgType[6] is last price, msgType[7] is volume
                const lastPrice = msgType[6];
                if (lastPrice > 0) {
                  handleTickUpdate(lastPrice, 0, Date.now());
                }
              }
            }
          } catch {
            // ignore
          }
        };

        bfxWs.onerror = () => setIsLiveConnected(false);
        bfxWs.onclose = () => setIsLiveConnected(false);
      } catch {
        setIsLiveConnected(false);
      }
    }

    // 2. Binance Combined WebSocket (Kline + Trade Stream) for crypto
    if (streamPair && typeof WebSocket !== 'undefined' && !isGold) {
      try {
        const wsBase = isFutures ? 'wss://fstream.binance.com' : 'wss://stream.binance.com:9443';
        // Combined stream: @kline_<interval> for authoritative candle stats + @trade for instant trade-by-trade ticks
        const wsUrl = `${wsBase}/stream?streams=${streamPair}@kline_${binanceInterval}/${streamPair}@trade`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsLiveConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const stream = msg.stream || '';
            const data = msg.data || msg;

            if (stream.endsWith('@trade') || data.e === 'trade') {
              const p = parseFloat(data.p);
              const q = parseFloat(data.q || 0);
              const t = data.T || Date.now();
              handleTickUpdate(p, q, t);
            } else if (stream.includes('@kline') || data.e === 'kline') {
              handleKlineAuthoritative(data.k);
            } else if (data.c) {
              handleTickUpdate(parseFloat(data.c), 0, Date.now());
            }
          } catch {
            // ignore malformed message
          }
        };

        ws.onerror = () => setIsLiveConnected(false);
        ws.onclose = () => setIsLiveConnected(false);
      } catch {
        setIsLiveConnected(false);
      }
    }

    // 3. Fallback polling for resilience
    pollTimer = setInterval(async () => {
      const isConnected =
        (ws && ws.readyState === WebSocket.OPEN) || (bfxWs && bfxWs.readyState === WebSocket.OPEN);
      if (isConnected) return;

      try {
        if (isGold) {
          const res = await fetch('https://api-pub.bitfinex.com/v2/ticker/tXAUT:USD');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data[6]) {
              handleTickUpdate(data[6], 0, Date.now());
              setIsLiveConnected(true);
            }
          }
        } else if (streamPair) {
          const ep = isFutures
            ? `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${streamPair.toUpperCase()}`
            : `https://api.binance.com/api/v3/ticker/price?symbol=${streamPair.toUpperCase()}`;
          const res = await fetch(ep);
          if (res.ok) {
            const data = await res.json();
            if (data && data.price) {
              handleTickUpdate(parseFloat(data.price), 0, Date.now());
              setIsLiveConnected(true);
            }
          }
        }
      } catch {
        // network offline
      }
    }, 3000);

    return () => {
      isDisposed = true;
      if (ws) ws.close();
      if (bfxWs) bfxWs.close();
      if (pollTimer) clearInterval(pollTimer);
      if (directionTimeoutRef.current) clearTimeout(directionTimeoutRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [symbol, timeframe]);

  return {
    livePrice,
    priceDirection,
    isLiveConnected,
    countdown,
    liveBar,
    tickCount,
    lastTickTime,
    lastTickSize,
    lastClosedBar,
    barIndex,
  };
}
