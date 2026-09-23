import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  Smartphone,
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
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  // Viewport tracking for mobile portrait vs landscape detection
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));
  // User orientation override when maximized (defaults to portrait on mobile, like TradingView mobile)
  const [maximizedOrientation, setMaximizedOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isMobileDevice =
    viewport.width < 768 ||
    (typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
      viewport.width < 1024);
  const isDevicePortrait = viewport.height >= viewport.width;

  // TradingView mobile portrait mode: active when maximized on mobile/tablet or when explicitly set to portrait
  const isPortraitMode =
    isMaximized &&
    (isMobileDevice
      ? maximizedOrientation === 'portrait'
      : maximizedOrientation === 'portrait' && isDevicePortrait);

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

  // Select candles according to timeframe and dynamically breathe active bar with live price
  // In TradingView mobile portrait mode, shows recent 28-30 candles so candles are bold, legible, and uncompressed
  const candles = useMemo(() => {
    let raw: Candle[] = [];
    const count = isPortraitMode ? (timeframe === '1D' ? 12 : 28) : (timeframe === '1D' ? 14 : 36);
    if (timeframe === '1D') {
      raw = dailyCandles.slice(-count);
    } else if (timeframe === '1H') {
      raw = hourlyCandles.slice(-count);
    } else if (timeframe === '15m') {
      raw =
        fifteenMinCandles && fifteenMinCandles.length > 0
          ? fifteenMinCandles.slice(-count)
          : hourlyCandles.slice(-count);
    } else if (timeframe === '5m') {
      raw =
        fiveMinCandles && fiveMinCandles.length > 0
          ? fiveMinCandles.slice(-count)
          : hourlyCandles.slice(-count);
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
  }, [timeframe, dailyCandles, hourlyCandles, fifteenMinCandles, fiveMinCandles, livePrice, isPortraitMode]);

  // Dimensions: dynamically adapt to mobile portrait (TradingView style tall vertical canvas) vs desktop panoramic
  const svgWidth = isPortraitMode ? 560 : isMaximized ? 1600 : 1200;
  // Compute portrait aspect ratio to precisely match mobile viewport height
  const mobileHeightRatio = isPortraitMode
    ? Math.max(1.4, Math.min(2.05, (viewport.height - 95) / Math.max(300, viewport.width)))
    : 0.46875;
  const svgHeight = isPortraitMode
    ? Math.round(560 * mobileHeightRatio)
    : isMaximized
    ? 750
    : 500;

  const profileWidth = showProfile ? (isPortraitMode ? 85 : isMaximized ? 260 : 170) : 0;
  const rightMargin = isPortraitMode ? 74 : (isMaximized ? 110 : 95);
  const chartWidth = svgWidth - profileWidth - rightMargin;
  const chartHeight = svgHeight - (isPortraitMode ? 36 : 40);
  const marginTop = isPortraitMode ? 16 : 20;

  // Min / Max calculation with quantized step intervals to eliminate sub-pixel grid flickering
  const { minPrice, maxPrice } = useMemo(() => {
    if (!candles.length) return { minPrice: 0, maxPrice: 100 };

    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    if (showPivots) {
      if (pivots.s2 > 0) min = Math.min(min, pivots.s2);
      if (pivots.r2 > 0) max = Math.max(max, pivots.r2);
    }
    if (showProfile && volumeProfile.val > 0) {
      min = Math.min(min, volumeProfile.val);
      max = Math.max(max, volumeProfile.vah);
    }
    if (showVwap && sessionVwap.price > 0) {
      if (sessionVwap.lower1Sigma) min = Math.min(min, sessionVwap.lower1Sigma);
      if (sessionVwap.upper1Sigma) max = Math.max(max, sessionVwap.upper1Sigma);
    }

    // Include live price
    min = Math.min(min, livePrice);
    max = Math.max(max, livePrice);

    const range = max - min;
    const rawPad = range > 0 ? range * 0.06 : (livePrice || 100) * 0.02;

    // Step quantization: snap bounds to clean intervals so minor live fluctuations do not shift coordinate axes
    const rawMin = min - rawPad;
    const rawMax = max + rawPad;
    const step =
      range > 20000 ? 250 :
      range > 5000 ? 50 :
      range > 1000 ? 10 :
      range > 200 ? 2 :
      range > 50 ? 0.5 :
      range > 5 ? 0.1 : 0.02;

    const quantizedMin = Math.floor(rawMin / step) * step;
    const quantizedMax = Math.ceil(rawMax / step) * step;

    return { minPrice: quantizedMin, maxPrice: quantizedMax };
  }, [candles, showPivots, showProfile, showVwap, pivots, volumeProfile, sessionVwap, livePrice]);

  const priceToY = (price: number) => {
    if (maxPrice <= minPrice) return chartHeight / 2;
    return marginTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
  };

  const candleSpacing = chartWidth / candles.length;
  const candleBodyWidth = Math.max(3, candleSpacing * 0.65);

  // Maximum volume across visible timeframe candles for relative volume scaling
  const maxCandleVol = useMemo(() => {
    return Math.max(...candles.map((c) => c.volume), 1);
  }, [candles]);

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
    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between h-[100dvh] w-screen overflow-hidden p-2 sm:p-3 select-none'
    : 'bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm w-full flex flex-col space-y-2.5';

  return (
    <div className={containerClasses}>
      {/* Chart Top Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="text-sm sm:text-base font-bold font-mono text-white flex items-center gap-1.5 sm:gap-2">
            <span>{symbol}</span>
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
              {isPortraitMode ? 'TV Mobile' : 'Terminal'}
            </span>
            {isMaximized && (
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                {isPortraitMode ? 'PORTRAIT' : 'LANDSCAPE'}
              </span>
            )}
          </span>

          {/* Timeframe Buttons (5m, 15m, 1H, 1D) & Countdown Indicator */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 sm:p-1 rounded border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setTimeframe('5m')}
              className={`px-1.5 sm:px-2 py-0.5 rounded transition ${
                timeframe === '5m' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              5m
            </button>
            <button
              onClick={() => setTimeframe('15m')}
              className={`px-1.5 sm:px-2 py-0.5 rounded transition ${
                timeframe === '15m' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              15m
            </button>
            <button
              onClick={() => setTimeframe('1H')}
              className={`px-1.5 sm:px-2 py-0.5 rounded transition ${
                timeframe === '1H' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1H
            </button>
            <button
              onClick={() => setTimeframe('1D')}
              className={`px-1.5 sm:px-2 py-0.5 rounded transition ${
                timeframe === '1D' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1D
            </button>
            <div className="h-3 w-px bg-slate-800 mx-0.5 hidden sm:block" />
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[10.5px] border border-amber-500/20">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 animate-pulse" />
              <span>{countdown.formatted}</span>
            </div>
          </div>
        </div>

        {/* Overlay Toggles, Orientation Switcher & Maximize Button */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {/* Mobile Orientation Switcher when Maximized */}
          {isMaximized && (
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10.5px]">
              <button
                onClick={() => setMaximizedOrientation('portrait')}
                className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                  maximizedOrientation === 'portrait'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Portrait Mode (TradingView Mobile vertical screen utilization)"
              >
                <Smartphone className="w-3 h-3" />
                <span className="hidden xs:inline">Portrait</span>
              </button>
              <button
                onClick={() => setMaximizedOrientation('landscape')}
                className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                  maximizedOrientation === 'landscape'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Landscape Mode (Panoramic wide chart)"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden xs:inline">Landscape</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setShowPivots(!showPivots)}
            className={`px-2 py-1 rounded border flex items-center gap-1 transition ${
              showPivots
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showPivots ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden md:inline">Floor </span><span>Pivots</span>
          </button>

          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2 py-1 rounded border flex items-center gap-1 transition ${
              showVwap
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showVwap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>VWAP</span>
          </button>

          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`px-2 py-1 rounded border flex items-center gap-1 transition ${
              showProfile
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showProfile ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span className="hidden sm:inline">Volume </span><span>Profile</span>
          </button>

          <button
            onClick={() => setShowMAs(!showMAs)}
            className={`px-2 py-1 rounded border hidden lg:flex items-center gap-1 transition ${
              showMAs
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showMAs ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>MAs</span>
          </button>

          <button
            onClick={() => setShowGaps(!showGaps)}
            className={`px-2 py-1 rounded border hidden lg:flex items-center gap-1 transition ${
              showGaps
                ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showGaps ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>FVG</span>
          </button>

          {/* Maximize / Minimize Chart Button */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1 transition font-bold ${
              isMaximized
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isMaximized ? 'Exit Maximized (or press Esc)' : 'Maximize Chart'}
          >
            {isMaximized ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Close</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Maximize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Crosshair Inspection & Real-Time Bar Close Strip */}
      <div className="flex flex-wrap items-center justify-between text-[11px] sm:text-xs font-mono bg-slate-950 px-2 sm:px-2.5 py-1.5 rounded border border-slate-800 text-slate-400 gap-1.5 sm:gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-4">
          <span>
            {hoverCandle
              ? new Date(hoverCandle.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
              : 'Tap/Hover bar'}
          </span>
          <span>
            O: <span className="text-slate-200">{hoverCandle ? `$${hoverCandle.open.toFixed(2)}` : '--'}</span>
          </span>
          <span>
            H: <span className="text-emerald-400 font-medium">{hoverCandle ? `$${hoverCandle.high.toFixed(2)}` : '--'}</span>
          </span>
          <span>
            L: <span className="text-rose-400 font-medium">{hoverCandle ? `$${hoverCandle.low.toFixed(2)}` : '--'}</span>
          </span>
          <span>
            C: <span className="text-slate-200 font-bold">{hoverCandle ? `$${hoverCandle.close.toFixed(2)}` : '--'}</span>
          </span>
          <span className="hidden sm:inline">
            VOL: <span className="text-slate-200">{hoverCandle ? hoverCandle.volume.toFixed(2) : '--'}</span>
          </span>
        </div>

        {/* Live Price & Bar Close Countdown Indicators */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Live Price Tag with flash animation */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:py-1 rounded bg-slate-900 border border-slate-700">
            <span
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            <span className="text-[9.5px] sm:text-[10px] text-slate-400 uppercase font-semibold">
              {isLiveConnected ? 'Live' : 'Spot'}:
            </span>
            <span
              className={`font-bold transition-colors duration-200 text-xs sm:text-sm ${
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
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Clock className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
            <span className="text-[9.5px] sm:text-[10px] text-amber-200 uppercase font-bold">
              {timeframe}:
            </span>
            <span className="font-bold text-amber-300 font-mono tracking-wider text-xs">
              {countdown.formatted}
            </span>
          </div>
        </div>
      </div>

      {/* Main SVG Visualization Canvas */}
      <div className={`relative w-full overflow-hidden bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center ${isMaximized ? 'flex-1 min-h-0' : ''}`}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={`w-full ${isMaximized ? 'h-full object-contain' : 'h-auto'} select-none`}
          style={{ maxHeight: isMaximized ? '100%' : '580px' }}
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

          {/* Moving Averages Overlays (Daily 9 EMA & 50 SMA) */}
          {showMAs && movingAverages && movingAverages.length > 0 && (
            <g className="ma-layer" pointerEvents="none">
              {movingAverages
                .filter((ma) => ma.period === 9 || ma.period === 50)
                .map((ma) => {
                  const y = priceToY(ma.value);
                  if (y < marginTop || y > marginTop + chartHeight) return null;
                  const color = ma.period === 9 ? '#818cf8' : '#6366f1';
                  return (
                    <g key={`ma-${ma.period}-${ma.type}`}>
                      <line
                        x1={0}
                        y1={y}
                        x2={chartWidth}
                        y2={y}
                        stroke={color}
                        strokeWidth={1.2}
                        strokeDasharray={ma.period === 9 ? '4 2' : '6 3'}
                        opacity={0.85}
                      />
                      <text
                        x={chartWidth - 200}
                        y={y - 4}
                        fill={color}
                        fontSize={9}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {ma.type} {ma.period}: ${ma.value.toLocaleString()}
                      </text>
                    </g>
                  );
                })}
            </g>
          )}

          {/* Timeframe Volume Histogram Bars at Bottom */}
          <g className="volume-bars-layer select-none" pointerEvents="none">
            {candles.map((c, i) => {
              const x = i * candleSpacing + candleSpacing / 2;
              const isGreen = c.close >= c.open;
              const isHovered = hoverCandle?.timestamp === c.timestamp;
              const isCurrent = i === candles.length - 1;
              const volBarMaxHeight = 45;
              const volHeight = Math.max(2, (c.volume / maxCandleVol) * volBarMaxHeight);
              const volBaseY = marginTop + chartHeight;

              return (
                <rect
                  key={`vol-${c.timestamp}`}
                  x={x - candleBodyWidth / 2}
                  y={volBaseY - volHeight}
                  width={candleBodyWidth}
                  height={volHeight}
                  fill={isGreen ? '#10b981' : '#ef4444'}
                  opacity={isHovered ? 0.9 : isCurrent ? 0.6 : 0.25}
                  rx={1}
                />
              );
            })}
          </g>

          {/* Candlesticks */}
          <g className="candles-layer select-none" pointerEvents="none">
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
                <g key={c.timestamp}>
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
              <g className="active-candle-hud select-none" pointerEvents="none">
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
                  stroke="#0284c7"
                  strokeWidth={1.2}
                  rx={4}
                  opacity={0.95}
                />
                <text
                  x={lastX}
                  y={badgeY + 11.5}
                  fill="#38bdf8"
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

          {/* Real-time Spot Price Ray, Right-Axis Timeframe Volume Tag, Live Price Tag & Countdown Tag */}
          {(() => {
            const yLive = priceToY(livePrice);
            const tagX = chartWidth + profileWidth + 4;
            const clampedY = Math.min(Math.max(marginTop + 24, yLive), chartHeight - 32);

            // Selected timeframe volume: active forming candle or currently hovered candle
            const activeCandle = candles[candles.length - 1];
            const targetCandle = hoverCandle || activeCandle;
            const targetVolume = targetCandle?.volume ?? 0;

            const formatVol = (val: number) => {
              if (!val || isNaN(val)) return '0';
              if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
              if (val >= 10_000) return `${(val / 1_000).toFixed(1)}K`;
              if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
              if (val >= 100) return val.toFixed(0);
              return val.toFixed(1);
            };

            const volumeFormatted = formatVol(targetVolume);
            const priceTagBg =
              priceDirection === 'up'
                ? '#059669'
                : priceDirection === 'down'
                ? '#dc2626'
                : '#0284c7';

            return (
              <g className="spot-price-tracker select-none" pointerEvents="none">
                {/* Horizontal Ray Across Chart - Steady calm institutional cyan */}
                <line
                  x1={0}
                  y1={yLive}
                  x2={chartWidth + profileWidth}
                  y2={yLive}
                  stroke="#0284c7"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  opacity={0.85}
                />

                {/* Stable Beacon Dot on Last Active Bar - Clean SVG dual ring without animate-ping glitch */}
                {candles.length > 0 && (
                  <g>
                    <circle
                      cx={(candles.length - 1) * candleSpacing + candleSpacing / 2}
                      cy={yLive}
                      r={6}
                      fill="#38bdf8"
                      fillOpacity={0.25}
                    />
                    <circle
                      cx={(candles.length - 1) * candleSpacing + candleSpacing / 2}
                      cy={yLive}
                      r={3}
                      fill="#38bdf8"
                    />
                  </g>
                )}

                {/* Pointer Arrow on Right Margin */}
                <polygon
                  points={`${tagX},${yLive} ${tagX + 4},${yLive - 3} ${tagX + 4},${yLive + 3}`}
                  fill={priceTagBg}
                />

                {/* Right Margin: Live Price Tag & Volume Badge */}
                <g transform={`translate(${tagX + 4}, ${clampedY - 10})`}>
                  {/* Volume Value Tag Directly Above the Price Label (Corresponding to Selected Timeframe) */}
                  <g className="timeframe-volume-badge">
                    <rect
                      x={0}
                      y={-20}
                      width={82}
                      height={17}
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth={1}
                      rx={3}
                    />
                    <text
                      x={41}
                      y={-8}
                      fill="#38bdf8"
                      fontSize={isPortraitMode ? 7.5 : 8.5}
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      letterSpacing="-0.2px"
                    >
                      {timeframe} Vol: {volumeFormatted}
                    </text>
                  </g>

                  {/* Live Price Tag Box */}
                  {(() => {
                    const tagWidth = isPortraitMode ? 66 : 82;
                    return (
                      <>
                        <rect
                          x={0}
                          y={0}
                          width={tagWidth}
                          height={18}
                          fill={priceTagBg}
                          rx={3}
                        />
                        <text
                          x={tagWidth / 2}
                          y={13}
                          fill="#ffffff"
                          fontSize={isPortraitMode ? 8.5 : 10}
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ${livePrice >= 1000 ? Math.round(livePrice).toLocaleString() : livePrice.toFixed(2)}
                        </text>

                        {/* Bar Close Countdown Attached Tag */}
                        <rect
                          x={0}
                          y={21}
                          width={tagWidth}
                          height={16}
                          fill="#020617"
                          stroke="#f59e0b"
                          strokeWidth={1}
                          rx={3}
                        />
                        <text
                          x={tagWidth / 2}
                          y={33}
                          fill="#fbbf24"
                          fontSize={isPortraitMode ? 8 : 9.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ⏱ {countdown.formatted}
                        </text>
                      </>
                    );
                  })()}
                </g>
              </g>
            );
          })()}

          {/* Subtle Crosshairs when Hovering */}
          {hoverX !== null && (
            <g className="crosshair-layer" pointerEvents="none">
              <line
                x1={hoverX}
                y1={marginTop}
                x2={hoverX}
                y2={marginTop + chartHeight}
                stroke="#475569"
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={0.7}
              />
              {hoverY !== null && (
                <line
                  x1={0}
                  y1={hoverY}
                  x2={chartWidth + profileWidth}
                  y2={hoverY}
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.7}
                />
              )}
            </g>
          )}

          {/* Interactive Mouse & Touch Tracking Layer - Smooth hover & mobile slide */}
          <rect
            x={0}
            y={marginTop}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            className="cursor-crosshair touch-none"
            onMouseMove={(e) => {
              const svgEl = e.currentTarget.ownerSVGElement;
              if (!svgEl) return;
              const pt = svgEl.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const ctm = svgEl.getScreenCTM();
              if (!ctm) return;
              const svgPt = pt.matrixTransform(ctm.inverse());

              if (svgPt.x >= 0 && svgPt.x <= chartWidth && candles.length > 0) {
                const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(svgPt.x / candleSpacing)));
                setHoverCandle(candles[idx]);
                setHoverX(idx * candleSpacing + candleSpacing / 2);
                setHoverY(Math.max(marginTop, Math.min(marginTop + chartHeight, svgPt.y)));
              }
            }}
            onMouseLeave={() => {
              setHoverCandle(null);
              setHoverX(null);
              setHoverY(null);
            }}
            onTouchStart={(e) => {
              if (!e.touches.length) return;
              const touch = e.touches[0];
              const svgEl = e.currentTarget.ownerSVGElement;
              if (!svgEl) return;
              const pt = svgEl.createSVGPoint();
              pt.x = touch.clientX;
              pt.y = touch.clientY;
              const ctm = svgEl.getScreenCTM();
              if (!ctm) return;
              const svgPt = pt.matrixTransform(ctm.inverse());
              if (svgPt.x >= 0 && svgPt.x <= chartWidth && candles.length > 0) {
                const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(svgPt.x / candleSpacing)));
                setHoverCandle(candles[idx]);
                setHoverX(idx * candleSpacing + candleSpacing / 2);
                setHoverY(Math.max(marginTop, Math.min(marginTop + chartHeight, svgPt.y)));
              }
            }}
            onTouchMove={(e) => {
              if (!e.touches.length) return;
              const touch = e.touches[0];
              const svgEl = e.currentTarget.ownerSVGElement;
              if (!svgEl) return;
              const pt = svgEl.createSVGPoint();
              pt.x = touch.clientX;
              pt.y = touch.clientY;
              const ctm = svgEl.getScreenCTM();
              if (!ctm) return;
              const svgPt = pt.matrixTransform(ctm.inverse());
              if (svgPt.x >= 0 && svgPt.x <= chartWidth && candles.length > 0) {
                const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(svgPt.x / candleSpacing)));
                setHoverCandle(candles[idx]);
                setHoverX(idx * candleSpacing + candleSpacing / 2);
                setHoverY(Math.max(marginTop, Math.min(marginTop + chartHeight, svgPt.y)));
              }
            }}
            onTouchEnd={() => {
              setHoverCandle(null);
              setHoverX(null);
              setHoverY(null);
            }}
          />
        </svg>
      </div>

      {/* Profile Metrics Summary Bar - Adaptive for Mobile Portrait */}
      {isMaximized && isPortraitMode ? (
        <div className="flex items-center justify-between px-2.5 py-1 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-slate-300 shrink-0">
          <div>POC: <span className="text-amber-400 font-bold">${volumeProfile.poc.toLocaleString()}</span></div>
          <div>VAH: <span className="text-cyan-300 font-bold">${volumeProfile.vah.toLocaleString()}</span></div>
          <div>VAL: <span className="text-cyan-300 font-bold">${volumeProfile.val.toLocaleString()}</span></div>
          <div>VWAP: <span className="text-amber-300 font-bold">${sessionVwap.price.toLocaleString()}</span></div>
        </div>
      ) : (
        <div className={`${isMaximized ? 'hidden sm:grid' : 'grid'} grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs shrink-0`}>
          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">POC (MAX VOL):</span>
            <span className="text-amber-400 font-bold text-xs">
              ${volumeProfile.poc.toLocaleString()}
            </span>
          </div>

          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">VAH (VALUE HIGH):</span>
            <span className="text-cyan-300 font-bold text-xs">
              ${volumeProfile.vah.toLocaleString()}
            </span>
          </div>

          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">VAL (VALUE LOW):</span>
            <span className="text-cyan-300 font-bold text-xs">
              ${volumeProfile.val.toLocaleString()}
            </span>
          </div>

          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">SESSION VWAP:</span>
            <span className="text-amber-300 font-bold text-xs">
              ${sessionVwap.price.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
