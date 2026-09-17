import { useEffect, useRef, useState } from 'react';
import { ChartTimeframe, TickerSymbol } from '../types';

export interface BarCountdown {
  formatted: string;
  remainingSeconds: number;
  progressPct: number;
  closesAtUTC: string;
}

export interface LiveTickerState {
  livePrice: number;
  priceDirection: 'up' | 'down' | 'neutral';
  isLiveConnected: boolean;
  countdown: BarCountdown;
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

  const prevPriceRef = useRef<number>(initialPrice);
  const directionTimeoutRef = useRef<any>(null);

  // Sync with initialPrice changes when brief refreshes or symbol changes
  useEffect(() => {
    if (initialPrice && initialPrice > 0) {
      setLivePrice(initialPrice);
      prevPriceRef.current = initialPrice;
    }
  }, [initialPrice, symbol]);

  // Real-time countdown timer (1 second ticks)
  useEffect(() => {
    setCountdown(calculateCountdown(timeframe));
    const timer = setInterval(() => {
      setCountdown(calculateCountdown(timeframe));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeframe]);

  // Real-time price stream via WebSocket (or fallback)
  useEffect(() => {
    const symbolMap: Record<string, string> = {
      'BTC-USD': 'btcusdt',
      'ETH-USD': 'ethusdt',
      'SOL-USD': 'solusdt',
      // Gold is tracked on Binance via the PAXG pair (XAUT itself isn't listed there).
      'XAUT-USD': 'paxgusdt',
    };

    const streamPair = symbolMap[symbol];
    let ws: WebSocket | null = null;
    let pollTimer: any = null;

    const handlePriceUpdate = (newPrice: number) => {
      if (!newPrice || isNaN(newPrice) || newPrice <= 0) return;

      const prev = prevPriceRef.current;
      if (newPrice > prev) {
        setPriceDirection('up');
      } else if (newPrice < prev) {
        setPriceDirection('down');
      }

      if (directionTimeoutRef.current) {
        clearTimeout(directionTimeoutRef.current);
      }
      directionTimeoutRef.current = setTimeout(() => {
        setPriceDirection('neutral');
      }, 1200);

      prevPriceRef.current = newPrice;
      setLivePrice(newPrice);
    };

    if (streamPair && typeof WebSocket !== 'undefined') {
      try {
        const wsUrl = `wss://stream.binance.com:9443/ws/${streamPair}@ticker`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsLiveConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.c) {
              const p = parseFloat(data.c);
              handlePriceUpdate(p);
            }
          } catch {
            // Ignore malformed tick
          }
        };

        ws.onerror = () => {
          setIsLiveConnected(false);
        };

        ws.onclose = () => {
          setIsLiveConnected(false);
        };
      } catch {
        setIsLiveConnected(false);
      }
    }

    // Fallback polling for XAUT-USD or if WebSocket fails to connect
    pollTimer = setInterval(async () => {
      // If WebSocket is already active and sending data, skip polling
      if (ws && ws.readyState === WebSocket.OPEN) return;

      try {
        if (symbol === 'XAUT-USD') {
          const res = await fetch('https://api-pub.bitfinex.com/v2/ticker/tXAUT:USD');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data[6]) {
              handlePriceUpdate(data[6]);
              setIsLiveConnected(true);
              return;
            }
          }
        } else if (streamPair) {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${streamPair.toUpperCase()}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.price) {
              handlePriceUpdate(parseFloat(data.price));
              setIsLiveConnected(true);
              return;
            }
          }
        }
      } catch {
        // network error / offline
      }
    }, 4000);

    return () => {
      if (ws) {
        ws.close();
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (directionTimeoutRef.current) {
        clearTimeout(directionTimeoutRef.current);
      }
    };
  }, [symbol]);

  return {
    livePrice,
    priceDirection,
    isLiveConnected,
    countdown,
  };
}
