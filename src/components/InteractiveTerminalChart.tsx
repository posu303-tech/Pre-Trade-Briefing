import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  Sliders,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { Candle, ChartTimeframe, PreMarketBrief } from '../types';
import { useLiveTicker } from '../services/useLiveTicker';

interface InteractiveTerminalChartProps {
  brief: PreMarketBrief;
}

export const InteractiveTerminalChart: React.FC<InteractiveTerminalChartProps> = ({ brief }) => {
  const {
    symbol,
    dailyCandles,
    hourlyCandles,
    fifteenMinCandles,
    fiveMinCandles,
    currentPrice,
    pivots,
    volumeProfile,
    sessionVwap,
    movingAverages,
    gaps,
  } = brief;

  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1H');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [showPivots, setShowPivots] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [showMAs, setShowMAs] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);

  // Close maximize on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Live real-time price & bar close countdown
  const { livePrice, priceDirection, isLiveConnected, countdown } = useLiveTicker(
    symbol,
    currentPrice,
    timeframe
  );

  // Select candles according to timeframe (5m, 15m, 1H, 1D) and dynamically breathe active bar with live price
  const candles = useMemo(() => {
    let raw: Candle[] = [];
    if (timeframe === '1D') {
      raw = dailyCandles.slice(-14);
    } else if (timeframe === '1H') {
      raw = hourlyCandles.slice(-36);
    } else if (timeframe === '15m') {
      raw = (fifteenMinCandles && fifteenMinCandles.length > 0)
        ? fifteenMinCandles.slice(-36)
        : hourlyCandles.slice(-36);
    } else if (timeframe === '5m') {
      raw = (fiveMinCandles && fiveMinCandles.length > 0)
        ? fiveMinCandles.slice(-36)
        : hourlyCandles.slice(-36);
    }
    if (!raw.length) return raw;

    // Dynamically update active bar (last candle) with live price
    const last = raw[raw.length - 1];
    const updatedLast: Candle = {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
    };
    return [...raw.slice(0, -1), updatedLast];
  }, [timeframe, dailyCandles, hourlyCandles, fifteenMinCandles, fiveMinCandles, livePrice]);

  // Dimensions: dynamically expand when maximized for broad panoramic clarity
  const svgWidth = isMaximized ? 1600 : 1200;
  const svgHeight = isMaximized ? 750 : 500;
  const profileWidth = showProfile ? (isMaximized ? 260 : 170) : 0;
  const chartWidth = svgWidth - profileWidth - (isMaximized ? 110 : 95); // right y-axis margin for price & countdown tags
  const chartHeight = svgHeight - 40; // 40px bottom x-axis margin
  const marginTop = 20;

  // Min / Max calculation
  const { minPrice, maxPrice } = useMemo(() => {
    let min = Math.min(...candles.map((c) => c.low), livePrice);
    let max = Math.max(...candles.map((c) => c.high), livePrice);

    if (showPivots) {
      min = Math.min(min, pivots.s2);
      max = Math.max(max, pivots.r2);
    }
    if (showProfile && volumeProfile.val > 0) {
      min = Math.min(min, volumeProfile.val);
      max = Math.max(max, volumeProfile.vah);
    }

    const pad = (max - min) * 0.05 || livePrice * 0.02;
    return { minPrice: min - pad, maxPrice: max + pad };
  }, [candles, showPivots, showProfile, pivots, volumeProfile, livePrice]);

  const priceToY = (price: number) => {
    if (maxPrice <= minPrice) return chartHeight / 2;
    return marginTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
  };

  const candleSpacing = chartWidth / candles.length;
  const candleBodyWidth = Math.max(3, candleSpacing * 0.65);

  // Price Grid Lines
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const count = 7;
    const step = (maxPrice - minPrice) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  const containerClasses = isMaximized
    ? 'fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-md p-4 sm:p-6 overflow-y-auto flex flex-col justify-start space-y-4'
    : 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm w-full space-y-4';

  return (
    <div className={containerClasses}>
      {/* Chart Top Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <span className="text-base font-bold font-mono text-white flex items-center gap-2">
            <span>{symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
              Live Terminal Chart
            </span>
            {isMaximized && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                MAXIMIZED VIEW (ESC to Exit)
              </span>
            )}
          </span>

          {/* Timeframe Buttons (5m, 15m, 1H, 1D) & Countdown Indicator */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setTimeframe('5m')}
              className={`px-2 py-0.5 rounded transition ${
                timeframe === '5m' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              5m
            </button>
            <button
              onClick={() => setTimeframe('15m')}
              className={`px-2 py-0.5 rounded transition ${
                timeframe === '15m' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              15m
            </button>
            <button
              onClick={() => setTimeframe('1H')}
              className={`px-2 py-0.5 rounded transition ${
                timeframe === '1H' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1H
            </button>
            <button
              onClick={() => setTimeframe('1D')}
              className={`px-2 py-0.5 rounded transition ${
                timeframe === '1D' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1D
            </button>
            <div className="h-3.5 w-px bg-slate-800 mx-1 hidden sm:block" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[11px] border border-amber-500/20">
              <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>{countdown.formatted}</span>
            </div>
          </div>
        </div>

        {/* Overlay Toggles & Maximize Button */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setShowPivots(!showPivots)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showPivots
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showPivots ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Floor Pivots</span>
          </button>

          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showVwap
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showVwap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Session VWAP</span>
          </button>

          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showProfile
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showProfile ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Volume Profile</span>
          </button>

          <button
            onClick={() => setShowMAs(!showMAs)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showMAs
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showMAs ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>MAs (9/50)</span>
          </button>

          <button
            onClick={() => setShowGaps(!showGaps)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showGaps
                ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showGaps ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>FVG Gaps</span>
          </button>

          {/* Maximize / Minimize Chart and Profile Button */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`px-3 py-1 rounded border flex items-center gap-1.5 transition font-bold ${
              isMaximized
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isMaximized ? 'Minimize Chart (or press Esc)' : 'Maximize Chart and Volume Profile'}
          >
            {isMaximized ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Minimize</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Maximize Chart & Profile</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Crosshair Inspection & Real-Time Bar Close Strip */}
      <div className="flex flex-wrap items-center justify-between text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-400 gap-3">
        <div className="flex flex-wrap items-center space-x-3 sm:space-x-4">
          <span>
            DATE:{' '}
            <span className="text-slate-200">
              {hoverCandle
                ? new Date(hoverCandle.timestamp).toLocaleString('en-US', { hour12: false })
                : 'Hover bar to inspect'}
            </span>
          </span>
          <span>
            O:{' '}
            <span className="text-slate-200">
              {hoverCandle ? `$${hoverCandle.open.toFixed(2)}` : '--'}
            </span>
          </span>
          <span>
            H:{' '}
            <span className="text-emerald-400 font-medium">
              {hoverCandle ? `$${hoverCandle.high.toFixed(2)}` : '--'}
            </span>
          </span>
          <span>
            L:{' '}
            <span className="text-rose-400 font-medium">
              {hoverCandle ? `$${hoverCandle.low.toFixed(2)}` : '--'}
            </span>
          </span>
          <span>
            C:{' '}
            <span className="text-slate-200 font-bold">
              {hoverCandle ? `$${hoverCandle.close.toFixed(2)}` : `--`}
            </span>
          </span>
          <span>
            VOL:{' '}
            <span className="text-slate-200">
              {hoverCandle ? hoverCandle.volume.toFixed(2) : '--'}
            </span>
          </span>
        </div>

        {/* Live Price & Bar Close Countdown Indicators */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Live Price Tag with flash animation */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              {isLiveConnected ? 'Live Feed' : 'Spot'}:
            </span>
            <span
              className={`font-bold transition-colors duration-200 ${
                priceDirection === 'up'
                  ? 'text-emerald-400'
                  : priceDirection === 'down'
                  ? 'text-rose-400'
                  : 'text-cyan-300'
              }`}
            >
              ${livePrice >= 1000 ? livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : livePrice.toFixed(2)}
            </span>
          </div>

          {/* Bar Close Countdown Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            <span className="text-[10px] text-amber-200 uppercase font-bold">
              {timeframe} Close:
            </span>
            <span className="font-bold text-amber-300 font-mono tracking-wider">
              {countdown.formatted}
            </span>
            {/* Progress bar */}
            <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${countdown.progressPct}%` }}
                title={`${countdown.progressPct.toFixed(0)}% elapsed`}
              />
            </div>
            <span className="text-[9px] text-amber-400/80 hidden md:inline">
              ({countdown.closesAtUTC})
            </span>
          </div>
        </div>
      </div>

      {/* Main SVG Visualization Canvas */}
      <div className="relative w-full overflow-hidden bg-slate-950 rounded-lg border border-slate-800">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          style={{ maxHeight: isMaximized ? 'calc(100vh - 160px)' : '580px' }}
        >
          <defs>
            <linearGradient id="profileGradientVA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="profileGradientNonVA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bullishFvgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearishFvgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((price, idx) => {
            const y = priceToY(price);
            return (
              <g key={idx}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth + profileWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                {/* Price labels on right */}
                <text
                  x={chartWidth + profileWidth + 8}
                  y={y + 3}
                  fill="#64748b"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  ${price >= 1000 ? Math.round(price).toLocaleString() : price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* FVG Gap Shaded Zones */}
          {showGaps &&
            gaps.map((gap, idx) => {
              const yHigh = priceToY(gap.highPrice);
              const yLow = priceToY(gap.lowPrice);
              const height = Math.abs(yLow - yHigh);
              const isBull = gap.type === 'BULLISH_FVG';
              return (
                <g key={gap.id}>
                  <rect
                    x={0}
                    y={Math.min(yHigh, yLow)}
                    width={chartWidth}
                    height={Math.max(4, height)}
                    fill={isBull ? 'url(#bullishFvgGradient)' : 'url(#bearishFvgGradient)'}
                    stroke={isBull ? '#10b981' : '#ef4444'}
                    strokeWidth={0.8}
                    strokeDasharray="4 2"
                    opacity={0.7}
                  />
                  <text
                    x={12}
                    y={Math.min(yHigh, yLow) + 12}
                    fill={isBull ? '#34d399' : '#f87171'}
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    Untested {gap.type.replace('_', ' ')} (${gap.lowPrice} - ${gap.highPrice})
                  </text>
                </g>
              );
            })}

          {/* Floor Pivots Overlays */}
          {showPivots && (
            <g className="pivots-layer">
              {/* Pivot */}
              <line
                x1={0}
                y1={priceToY(pivots.pivot)}
                x2={chartWidth}
                y2={priceToY(pivots.pivot)}
                stroke="#c084fc"
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.pivot) - 4}
                fill="#c084fc"
                fontSize={9}
                fontFamily="monospace"
              >
                P: ${pivots.pivot.toLocaleString()}
              </text>

              {/* R1 */}
              <line
                x1={0}
                y1={priceToY(pivots.r1)}
                x2={chartWidth}
                y2={priceToY(pivots.r1)}
                stroke="#f43f5e"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.r1) - 4}
                fill="#f43f5e"
                fontSize={9}
                fontFamily="monospace"
              >
                R1: ${pivots.r1.toLocaleString()}
              </text>

              {/* R2 */}
              <line
                x1={0}
                y1={priceToY(pivots.r2)}
                x2={chartWidth}
                y2={priceToY(pivots.r2)}
                stroke="#e11d48"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.r2) - 4}
                fill="#e11d48"
                fontSize={9}
                fontFamily="monospace"
              >
                R2: ${pivots.r2.toLocaleString()}
              </text>

              {/* S1 */}
              <line
                x1={0}
                y1={priceToY(pivots.s1)}
                x2={chartWidth}
                y2={priceToY(pivots.s1)}
                stroke="#10b981"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.s1) - 4}
                fill="#10b981"
                fontSize={9}
                fontFamily="monospace"
              >
                S1: ${pivots.s1.toLocaleString()}
              </text>

              {/* S2 */}
              <line
                x1={0}
                y1={priceToY(pivots.s2)}
                x2={chartWidth}
                y2={priceToY(pivots.s2)}
                stroke="#059669"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.s2) - 4}
                fill="#059669"
                fontSize={9}
                fontFamily="monospace"
              >
                S2: ${pivots.s2.toLocaleString()}
              </text>
            </g>
          )}

          {/* Session VWAP Line and Bands */}
          {showVwap && (
            <g className="vwap-layer">
              {/* Upper 1 Sigma */}
              <line
                x1={0}
                y1={priceToY(sessionVwap.upper1Sigma)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.upper1Sigma)}
                stroke="#fbbf24"
                strokeWidth={0.8}
                strokeDasharray="2 3"
                opacity={0.6}
              />
              {/* Lower 1 Sigma */}
              <line
                x1={0}
                y1={priceToY(sessionVwap.lower1Sigma)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.lower1Sigma)}
                stroke="#fbbf24"
                strokeWidth={0.8}
                strokeDasharray="2 3"
                opacity={0.6}
              />
              {/* Main VWAP */}
              <line
                x1={0}
                y1={priceToY(sessionVwap.price)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.price)}
                stroke="#f59e0b"
                strokeWidth={2}
              />
              <text
                x={12}
                y={priceToY(sessionVwap.price) - 5}
                fill="#f59e0b"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                Session VWAP: ${sessionVwap.price.toLocaleString()}
              </text>
            </g>
          )}

          {/* Candlesticks */}
          <g className="candles-layer">
            {candles.map((c, i) => {
              const x = i * candleSpacing + candleSpacing / 2;
              const yOpen = priceToY(c.open);
              const yClose = priceToY(c.close);
              const yHigh = priceToY(c.high);
              const yLow = priceToY(c.low);

              const isGreen = c.close >= c.open;
              const candleColor = isGreen ? '#10b981' : '#ef4444';
              const bodyY = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

              return (
                <g
                  key={c.timestamp}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoverCandle(c)}
                  onMouseLeave={() => setHoverCandle(null)}
                >
                  {/* Wick */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth={1.2}
                  />
                  {/* Body */}
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={bodyY}
                    width={candleBodyWidth}
                    height={bodyHeight}
                    fill={candleColor}
                    rx={1}
                  />
                </g>
              );
            })}
          </g>

          {/* Volume Profile on the Right */}
          {showProfile && volumeProfile.bins.length > 0 && (
            <g className="volume-profile-layer" transform={`translate(${chartWidth}, 0)`}>
              {/* Profile Background Container */}
              <rect
                x={0}
                y={marginTop}
                width={profileWidth}
                height={chartHeight}
                fill="#020617"
                opacity={0.85}
                stroke="#1e293b"
              />

              {isMaximized && (
                <text
                  x={10}
                  y={marginTop + 14}
                  fill="#94a3b8"
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  VOLUME PROFILE (70% VA)
                </text>
              )}

              {/* Volume Profile Bins */}
              {(() => {
                const maxBinVol = Math.max(...volumeProfile.bins.map((b) => b.volume));
                const numBins = volumeProfile.bins.length;
                const binHeight = chartHeight / numBins;

                return volumeProfile.bins.map((bin, idx) => {
                  const y = priceToY(bin.price);
                  const barWidth = maxBinVol > 0 ? (bin.volume / maxBinVol) * (profileWidth - (isMaximized ? 40 : 10)) : 0;
                  const isPOC = bin.isPOC;
                  const isVA = bin.isInValueArea;

                  return (
                    <g key={idx}>
                      <rect
                        x={0}
                        y={y - binHeight / 2}
                        width={barWidth}
                        height={Math.max(1.5, binHeight - 1)}
                        fill={isPOC ? '#f59e0b' : isVA ? 'url(#profileGradientVA)' : 'url(#profileGradientNonVA)'}
                      />
                      {isPOC && (
                        <line
                          x1={-chartWidth}
                          y1={y}
                          x2={profileWidth}
                          y2={y}
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                        />
                      )}
                      {isMaximized && isPOC && (
                        <text
                          x={barWidth + 4}
                          y={y + 3}
                          fill="#fbbf24"
                          fontSize={9}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          POC
                        </text>
                      )}
                    </g>
                  );
                });
              })()}

              {/* Profile Labels */}
              <text x={10} y={priceToY(volumeProfile.vah) - 4} fill="#38bdf8" fontSize={9} fontFamily="monospace" fontWeight="bold">
                VAH: ${volumeProfile.vah.toLocaleString()}
              </text>
              <text x={10} y={priceToY(volumeProfile.poc) - 4} fill="#f59e0b" fontSize={9} fontFamily="monospace" fontWeight="bold">
                POC: ${volumeProfile.poc.toLocaleString()}
              </text>
              <text x={10} y={priceToY(volumeProfile.val) + 12} fill="#38bdf8" fontSize={9} fontFamily="monospace" fontWeight="bold">
                VAL: ${volumeProfile.val.toLocaleString()}
              </text>
            </g>
          )}

          {/* Floating HUD over Active Candle */}
          {candles.length > 0 && (() => {
            const lastIndex = candles.length - 1;
            const lastX = lastIndex * candleSpacing + candleSpacing / 2;
            const lastCandle = candles[lastIndex];
            const topY = priceToY(Math.max(lastCandle.high, livePrice));
            const badgeY = Math.max(marginTop + 8, topY - 26);

            return (
              <g className="active-candle-hud select-none">
                {/* Dashed connector down to candle wick */}
                <line
                  x1={lastX}
                  y1={badgeY + 14}
                  x2={lastX}
                  y2={topY}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                {/* Floating pill background */}
                <rect
                  x={lastX - 48}
                  y={badgeY}
                  width={96}
                  height={16}
                  fill="#020617"
                  stroke={
                    priceDirection === 'up'
                      ? '#10b981'
                      : priceDirection === 'down'
                      ? '#ef4444'
                      : '#06b6d4'
                  }
                  strokeWidth={1.2}
                  rx={4}
                  opacity={0.95}
                />
                <text
                  x={lastX}
                  y={badgeY + 11.5}
                  fill={
                    priceDirection === 'up'
                      ? '#34d399'
                      : priceDirection === 'down'
                      ? '#f87171'
                      : '#38bdf8'
                  }
                  fontSize={8.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  LIVE • ⏱ {countdown.formatted}
                </text>
              </g>
            );
          })()}

          {/* Real-time Spot Price Ray & Right-Axis Bar Close Countdown Badge */}
          {(() => {
            const yLive = priceToY(livePrice);
            const tagX = chartWidth + profileWidth + 4;
            const clampedY = Math.min(Math.max(marginTop + 12, yLive), chartHeight - 22);

            const rayColor =
              priceDirection === 'up'
                ? '#10b981'
                : priceDirection === 'down'
                ? '#ef4444'
                : '#06b6d4';

            return (
              <g className="spot-price-tracker select-none">
                {/* Horizontal Ray Across Chart */}
                <line
                  x1={0}
                  y1={yLive}
                  x2={chartWidth + profileWidth}
                  y2={yLive}
                  stroke={rayColor}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />

                {/* Intersection Pulse Dot on Last Active Bar */}
                {candles.length > 0 && (
                  <circle
                    cx={(candles.length - 1) * candleSpacing + candleSpacing / 2}
                    cy={yLive}
                    r={3.5}
                    fill={rayColor}
                    className="animate-ping opacity-75"
                  />
                )}

                {/* Pointer Arrow on Right Margin */}
                <polygon
                  points={`${tagX},${yLive} ${tagX + 4},${yLive - 3} ${tagX + 4},${yLive + 3}`}
                  fill={rayColor}
                />

                {/* Right Margin: Live Price Tag */}
                <g transform={`translate(${tagX + 4}, ${clampedY - 10})`}>
                  {/* Live Price Tag Box */}
                  <rect
                    x={0}
                    y={0}
                    width={78}
                    height={18}
                    fill={rayColor}
                    rx={3}
                  />
                  <text
                    x={39}
                    y={13}
                    fill="#020617"
                    fontSize={10}
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ${livePrice >= 1000 ? Math.round(livePrice).toLocaleString() : livePrice.toFixed(2)}
                  </text>

                  {/* Bar Close Countdown Attached Tag */}
                  <rect
                    x={0}
                    y={20}
                    width={78}
                    height={16}
                    fill="#020617"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    rx={3}
                  />
                  <text
                    x={39}
                    y={32}
                    fill="#fbbf24"
                    fontSize={9.5}
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ⏱ {countdown.formatted}
                  </text>
                </g>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Profile Metrics Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">POINT OF CONTROL (POC):</span>
          <span className="text-amber-400 font-bold text-sm">
            ${volumeProfile.poc.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Max traded volume node</span>
        </div>

        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">VALUE AREA HIGH (VAH):</span>
          <span className="text-cyan-300 font-bold text-sm">
            ${volumeProfile.vah.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Upper 70% value cutoff</span>
        </div>

        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">VALUE AREA LOW (VAL):</span>
          <span className="text-cyan-300 font-bold text-sm">
            ${volumeProfile.val.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Lower 70% value cutoff</span>
        </div>

        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">SESSION VWAP:</span>
          <span className="text-amber-300 font-bold text-sm">
            ${sessionVwap.price.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">±1σ: ${sessionVwap.lower1Sigma.toLocaleString()} - ${sessionVwap.upper1Sigma.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
