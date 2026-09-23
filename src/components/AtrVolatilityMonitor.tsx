import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Flame,
  ShieldAlert,
  SlidersHorizontal,
  Info,
  ChevronUp,
  X,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { PreMarketBrief, TickerSymbol } from '../types';

interface AtrVolatilityMonitorProps {
  brief: PreMarketBrief;
}

// Recommended asset-specific default 1H ATR thresholds relative to spot price
const DEFAULT_THRESHOLDS: Record<TickerSymbol, number> = {
  'BTC-USD': 0.85, // 0.85% of spot price
  'ETH-USD': 1.0,  // 1.00% of spot price
  'SOL-USD': 1.3,  // 1.30% of spot price
  'XAUT-USD': 0.35, // 0.35% of spot price (Gold has lower % volatility)
  'XRP-USD': 1.4,  // 1.40% of spot price
  'DOGE-USD': 1.6, // 1.60% of spot price
  'HYPE-USD': 1.5, // 1.50% of spot price
};

export const AtrVolatilityMonitor: React.FC<AtrVolatilityMonitorProps> = ({ brief }) => {
  const { symbol, atr, currentPrice } = brief;
  const defaultThreshold = DEFAULT_THRESHOLDS[symbol] ?? 1.0;

  // Persist user threshold overrides per symbol in localStorage
  const [threshold, setThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`desk_atr_threshold_${symbol}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 10) return parsed;
      }
    } catch {}
    return defaultThreshold;
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Update threshold if symbol changes and no user override exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`desk_atr_threshold_${symbol}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
          setThreshold(parsed);
          return;
        }
      }
    } catch {}
    setThreshold(defaultThreshold);
  }, [symbol, defaultThreshold]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const saveThreshold = (newVal: number) => {
    const clamped = Math.min(Math.max(0.1, Number(newVal.toFixed(2))), 10);
    setThreshold(clamped);
    try {
      localStorage.setItem(`desk_atr_threshold_${symbol}`, clamped.toString());
    } catch {}
  };

  const resetThreshold = () => {
    setThreshold(defaultThreshold);
    try {
      localStorage.removeItem(`desk_atr_threshold_${symbol}`);
    } catch {}
  };

  const hourlyAtr = atr?.atr14Hourly ?? 0;
  const price = currentPrice > 0 ? currentPrice : 1;
  const atrHourlyPercent = (hourlyAtr / price) * 100;
  const thresholdDollarValue = (price * threshold) / 100;

  // High volatility triggers if 1H ATR % exceeds threshold
  const isHighVolatility = atrHourlyPercent >= threshold;
  const isRegimeExtreme = atr?.volatilityRegime === 'EXTREME' || atr?.volatilityRegime === 'EXPANDED';

  const presets = [0.35, 0.5, 0.75, 0.85, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      {/* Trigger Button: switches appearance based on volatility threshold status */}
      {isHighVolatility ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex items-center space-x-1.5 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/80 text-rose-200 shadow-md shadow-rose-950/40 hover:bg-rose-900/90 transition-all cursor-pointer animate-pulse focus:outline-none focus:ring-1 focus:ring-rose-400"
          title={`HIGH VOLATILITY ALERT: 1H ATR is ${atrHourlyPercent.toFixed(2)}% of spot price (Threshold: ${threshold.toFixed(2)}%). Click for desk risk details.`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="font-bold tracking-wider text-[11px] text-white uppercase bg-rose-600 px-1.5 py-0.2 rounded">
            HIGH VOLATILITY
          </span>
          <span className="text-[11px] text-rose-200/90 font-mono hidden sm:inline">
            1H ATR: <strong className="text-white">${hourlyAtr.toFixed(2)}</strong> ({atrHourlyPercent.toFixed(2)}%)
          </span>
          <SlidersHorizontal className="w-3 h-3 text-rose-400/80 group-hover:text-rose-200 ml-0.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
          title={`1H ATR is ${atrHourlyPercent.toFixed(2)}% of spot price (Threshold: ${threshold.toFixed(2)}%). Click to monitor or calibrate volatility threshold.`}
        >
          <span className="text-slate-400">1H ATR:</span>
          <strong className="text-cyan-300">${hourlyAtr.toFixed(2)}</strong>
          <span className="text-[10px] text-slate-400">({atrHourlyPercent.toFixed(2)}%)</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Thresh: {threshold.toFixed(2)}%</span>
          </span>
        </button>
      )}

      {/* Popover Card */}
      {isOpen && (
        <div className="fixed sm:absolute bottom-14 sm:bottom-full left-3 sm:left-0 right-3 sm:right-auto mb-1 sm:mb-2 w-auto sm:w-96 max-w-[calc(100vw-24px)] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl shadow-black/90 p-4 text-xs font-mono z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex items-start justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div
                className={`p-1.5 rounded-lg ${
                  isHighVolatility
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}
              >
                {isHighVolatility ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-slate-100">
                    {isHighVolatility ? 'High Volatility Alert' : 'ATR Volatility Monitor'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isHighVolatility
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isHighVolatility ? 'HIGH' : 'NORMAL'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {symbol} 1H ATR Threshold Monitor
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metric Comparison Grid */}
          <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
            <div className="p-2 bg-slate-900/90 rounded border border-slate-800">
              <span className="text-slate-400 text-[10px] block">1H ATR (14-BAR):</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-white font-bold text-sm">${hourlyAtr.toFixed(2)}</span>
                <span
                  className={`text-[10px] font-bold ${
                    isHighVolatility ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  ({atrHourlyPercent.toFixed(2)}%)
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">
                Relative to spot (${price.toLocaleString()})
              </span>
            </div>

            <div className="p-2 bg-slate-900/90 rounded border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] block">ALERT THRESHOLD:</span>
                {threshold !== defaultThreshold && (
                  <button
                    onClick={resetThreshold}
                    title="Reset to asset default"
                    className="text-[9px] text-cyan-400 hover:underline flex items-center gap-0.5"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-amber-300 font-bold text-sm">{threshold.toFixed(2)}%</span>
                <span className="text-[10px] text-slate-400">
                  (~${thresholdDollarValue.toFixed(2)})
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">
                Default: {defaultThreshold.toFixed(2)}% for {symbol}
              </span>
            </div>
          </div>

          {/* Additional Desk Volatility Context */}
          <div className="mt-2.5 p-2 bg-slate-900/50 rounded border border-slate-800/80 flex items-center justify-between text-[11px]">
            <div>
              <span className="text-slate-400 text-[10px] block">DAILY ATR (14D):</span>
              <span className="text-slate-200 font-bold">${atr?.atr14Daily?.toFixed(2) ?? '0.00'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">20D RATIO:</span>
              <span
                className={`font-bold ${
                  (atr?.atrRatioTo20d ?? 1) > 1.25 ? 'text-rose-400' : 'text-amber-300'
                }`}
              >
                {atr?.atrRatioTo20d ?? 1.0}x
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">REGIME:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  atr?.volatilityRegime === 'EXTREME'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : atr?.volatilityRegime === 'EXPANDED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                }`}
              >
                {atr?.volatilityRegime ?? 'NORMAL'}
              </span>
            </div>
          </div>

          {/* Institutional Risk Guidance Note */}
          <div
            className={`mt-2.5 p-2.5 rounded-lg border text-[11px] leading-relaxed ${
              isHighVolatility
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}
          >
            {isHighVolatility ? (
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 text-rose-400 font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>DESK RISK PROTOCOL ACTIVE</span>
                </div>
                <p className="text-[10.5px] text-rose-200/90">
                  1H ATR is currently <strong>{atrHourlyPercent.toFixed(2)}%</strong> of spot price, exceeding your{' '}
                  <strong>{threshold.toFixed(2)}%</strong> alert trigger. Stop hunting and wider bid-ask spreads are active.
                </p>
                <div className="text-[10px] text-rose-300/80 font-sans pt-1 border-t border-rose-500/20 space-y-0.5">
                  <div>• <strong>Sizing:</strong> Reduce intraday position risk by 30%–50%.</div>
                  <div>• <strong>Stops:</strong> Widen minimum invalidation buffer to 1.25x–1.5x 1H ATR (~${(hourlyAtr * 1.3).toFixed(2)}).</div>
                  <div>• <strong>Execution:</strong> Avoid market fills near breakout boundaries.</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[10.5px] text-slate-300">
                  1H ATR ({atrHourlyPercent.toFixed(2)}%) is operating below the high-volatility threshold ({threshold.toFixed(2)}%). Standard position sizing protocols apply.
                </p>
              </div>
            )}
          </div>

          {/* Threshold Calibration Controls */}
          <div className="mt-3 pt-2.5 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
              <span className="font-bold flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                CALIBRATE THRESHOLD (% OF SPOT):
              </span>
              <span className="text-white font-mono font-bold">{threshold.toFixed(2)}%</span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.05"
              value={threshold}
              onChange={(e) => saveThreshold(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center justify-between gap-1 mt-2">
              <span className="text-[9px] text-slate-400">Presets:</span>
              <div className="flex items-center gap-1 overflow-x-auto">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => saveThreshold(p)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition ${
                      Math.abs(threshold - p) < 0.01
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
