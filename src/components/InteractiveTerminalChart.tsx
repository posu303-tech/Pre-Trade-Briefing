import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart2,
  Clock,
  Eye,
  EyeOff,
  Hand,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  Sliders,
  Smartphone,
  TrendingUp,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Candle, ChartTimeframe, PreMarketBrief } from '../types';
import { useLiveTicker } from '../services/useLiveTicker';

interface InteractiveTerminalChartProps {
  brief: PreMarketBrief;
}

interface PositionedLabel {
  id: string;
  nominalY: number;
  y: number;
  text: string;
  color: string;
  borderColor?: string;
  bgColor?: string;
}

export const formatExactPrice = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '--';
  const p = Math.abs(val);
  if (p === 0) return '0.00';
  if (p < 0.001) return val.toFixed(6);
  if (p < 0.1) return val.toFixed(5);
  if (p < 1) return val.toFixed(4);
  if (p < 10) return val.toFixed(3);
  if (p >= 1000) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val.toFixed(2);
};

export const formatChartPrice = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '--';
  const p = Math.abs(val);
  if (p === 0) return '0.00';
  if (p < 0.001) return val.toFixed(6);
  if (p < 0.1) return val.toFixed(5);
  if (p < 1) return val.toFixed(4);
  if (p < 10) return val.toFixed(3);
  if (p >= 1000) return Math.round(val).toLocaleString();
  return val.toFixed(2);
};

// Anti-Collision Relaxation: Guarantees labels never overlap by pushing adjacent labels apart
function resolveCollisions(
  labels: PositionedLabel[],
  minY: number,
  maxY: number,
  minGap = 24
): PositionedLabel[] {
  if (labels.length === 0) return [];
  if (labels.length === 1) {
    return [{ ...labels[0], y: Math.max(minY, Math.min(maxY, labels[0].nominalY)) }];
  }

  // Clone and sort by nominal Y
  const sorted = labels.map((l) => ({
    ...l,
    y: Math.max(minY, Math.min(maxY, l.nominalY)),
  })).sort((a, b) => a.nominalY - b.nominalY);

  // Pass 1: push down
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y < sorted[i - 1].y + minGap) {
      sorted[i].y = sorted[i - 1].y + minGap;
    }
  }

  // Pass 2: push up if exceeding maxY
  if (sorted[sorted.length - 1].y > maxY) {
    sorted[sorted.length - 1].y = maxY;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i].y > sorted[i + 1].y - minGap) {
        sorted[i].y = sorted[i + 1].y - minGap;
      }
    }
  }

  // Pass 3: ensure none above minY
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].y = Math.max(minY, Math.min(maxY, sorted[i].y));
  }

  return sorted;
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

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0); // 0.4x (wide context) to 3.0x (detailed magnification)
  const [panOffset, setPanOffset] = useState<number>(0); // number of historical candles panned back
  const [pricePanOffset, setPricePanOffset] = useState<number>(0); // vertical dollar offset
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragMoved, setDragMoved] = useState<boolean>(false);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    initialPan: number;
    initialPricePan: number;
  }>({ x: 0, y: 0, initialPan: 0, initialPricePan: 0 });
  const touchDistRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Reset pan whenever timeframe changes
  useEffect(() => {
    setPanOffset(0);
    setPricePanOffset(0);
  }, [timeframe]);

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

  // Active on mobile screen or portrait mode for crisp readable typography
  const isMobileView = isPortraitMode || isMobileDevice;

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

  // Raw full candles for selected timeframe, breathing active bar with live price
  const rawCandles = useMemo(() => {
    let raw: Candle[] = [];
    if (timeframe === '1D') {
      raw = dailyCandles;
    } else if (timeframe === '1H') {
      raw = hourlyCandles;
    } else if (timeframe === '15m') {
      raw =
        fifteenMinCandles && fifteenMinCandles.length > 0
          ? fifteenMinCandles
          : hourlyCandles;
    } else if (timeframe === '5m') {
      raw =
        fiveMinCandles && fiveMinCandles.length > 0
          ? fiveMinCandles
          : hourlyCandles;
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

  // Windowing with Zoom and Pan
  const baseCount = isPortraitMode ? (timeframe === '1D' ? 14 : 26) : (timeframe === '1D' ? 16 : 38);
  const visibleCount = Math.max(6, Math.min(rawCandles.length, Math.round(baseCount / zoom)));
  const maxPan = Math.max(0, rawCandles.length - visibleCount);
  const effectivePan = Math.max(0, Math.min(maxPan, panOffset));

  const candles = useMemo(() => {
    if (!rawCandles.length) return [];
    const end = rawCandles.length - effectivePan;
    const start = Math.max(0, end - visibleCount);
    return rawCandles.slice(start, end);
  }, [rawCandles, effectivePan, visibleCount]);

  // Mouse wheel zoom listener on chart container
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        // Zoom in
        setZoom((prev) => Math.min(3.0, Number((prev * 1.15).toFixed(2))));
      } else {
        // Zoom out
        setZoom((prev) => Math.max(0.4, Number((prev / 1.15).toFixed(2))));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1.0);
    setPanOffset(0);
    setPricePanOffset(0);
  }, []);

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

  const profileWidth = showProfile ? (isPortraitMode ? 92 : isMaximized ? 260 : 170) : 0;
  const rightMargin = isPortraitMode ? 104 : (isMaximized ? 128 : 112);
  const chartWidth = svgWidth - profileWidth - rightMargin;
  const chartHeight = svgHeight - (isPortraitMode ? 54 : 56);
  const marginTop = isPortraitMode ? 16 : 20;

  // Min / Max calculation with quantized step intervals and vertical pricePanOffset
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

    // Include live price only if viewing the current active bar
    if (effectivePan === 0) {
      min = Math.min(min, livePrice);
      max = Math.max(max, livePrice);
    }

    const range = max - min;
    const rawPad = range > 0 ? range * 0.08 : (livePrice || 100) * 0.02;

    // Step quantization: snap bounds to clean intervals so minor live fluctuations do not shift coordinate axes
    const rawMin = min - rawPad + pricePanOffset;
    const rawMax = max + rawPad + pricePanOffset;
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
  }, [candles, showPivots, showProfile, showVwap, pivots, volumeProfile, sessionVwap, livePrice, effectivePan, pricePanOffset]);

  const priceToY = useCallback(
    (price: number) => {
      if (maxPrice <= minPrice) return chartHeight / 2;
      return marginTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
    },
    [maxPrice, minPrice, chartHeight, marginTop]
  );

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

  // Minimum vertical spacing between labels to avoid overlaps with larger crisp badges
  const labelMinGap = isMobileView ? 34 : 29;

  // Floor Pivots Labels with guaranteed collision resolution (never overlap)
  const pivotLabels: PositionedLabel[] = useMemo(() => {
    if (!showPivots) return [];
    const list: PositionedLabel[] = [
      { id: 'p', text: `P: $${formatExactPrice(pivots.pivot)}`, nominalY: priceToY(pivots.pivot), y: 0, color: '#c084fc' },
      { id: 'r1', text: `R1: $${formatExactPrice(pivots.r1)}`, nominalY: priceToY(pivots.r1), y: 0, color: '#f43f5e' },
      { id: 'r2', text: `R2: $${formatExactPrice(pivots.r2)}`, nominalY: priceToY(pivots.r2), y: 0, color: '#e11d48' },
      { id: 's1', text: `S1: $${formatExactPrice(pivots.s1)}`, nominalY: priceToY(pivots.s1), y: 0, color: '#10b981' },
      { id: 's2', text: `S2: $${formatExactPrice(pivots.s2)}`, nominalY: priceToY(pivots.s2), y: 0, color: '#059669' },
    ].filter((l) => l.nominalY >= marginTop - 20 && l.nominalY <= marginTop + chartHeight + 20);

    return resolveCollisions(list, marginTop + 16, marginTop + chartHeight - 16, labelMinGap);
  }, [showPivots, pivots, priceToY, marginTop, chartHeight, labelMinGap]);

  // Moving Average Labels with guaranteed collision resolution
  const maLabels: PositionedLabel[] = useMemo(() => {
    if (!showMAs || !movingAverages) return [];
    const list: PositionedLabel[] = movingAverages
      .filter((ma) => ma.period === 9 || ma.period === 50)
      .map((ma) => ({
        id: `ma-${ma.period}`,
        text: `${ma.type} ${ma.period}: $${formatExactPrice(ma.value)}`,
        nominalY: priceToY(ma.value),
        y: 0,
        color: ma.period === 9 ? '#818cf8' : '#6366f1',
      }))
      .filter((l) => l.nominalY >= marginTop - 20 && l.nominalY <= marginTop + chartHeight + 20);

    return resolveCollisions(list, marginTop + 16, marginTop + chartHeight - 16, labelMinGap);
  }, [showMAs, movingAverages, priceToY, marginTop, chartHeight, labelMinGap]);

  // Left-Side Overlay Labels (Session VWAP & Bands) with guaranteed collision resolution
  const leftLabels: PositionedLabel[] = useMemo(() => {
    const list: PositionedLabel[] = [];
    if (showVwap && sessionVwap.price > 0) {
      list.push({
        id: 'vwap',
        text: `Session VWAP: $${formatExactPrice(sessionVwap.price)}`,
        nominalY: priceToY(sessionVwap.price),
        y: 0,
        color: '#f59e0b',
      });
      if (sessionVwap.upper1Sigma) {
        list.push({
          id: 'vwap-upper',
          text: `VWAP +1σ: $${formatExactPrice(sessionVwap.upper1Sigma)}`,
          nominalY: priceToY(sessionVwap.upper1Sigma),
          y: 0,
          color: '#fbbf24',
        });
      }
      if (sessionVwap.lower1Sigma) {
        list.push({
          id: 'vwap-lower',
          text: `VWAP -1σ: $${formatExactPrice(sessionVwap.lower1Sigma)}`,
          nominalY: priceToY(sessionVwap.lower1Sigma),
          y: 0,
          color: '#fbbf24',
        });
      }
    }
    const filtered = list.filter((l) => l.nominalY >= marginTop - 20 && l.nominalY <= marginTop + chartHeight + 20);
    return resolveCollisions(filtered, marginTop + 16, marginTop + chartHeight - 16, labelMinGap);
  }, [showVwap, sessionVwap, priceToY, marginTop, chartHeight, labelMinGap]);

  // Volume Profile Level Labels with guaranteed collision resolution
  const profileLabels: PositionedLabel[] = useMemo(() => {
    if (!showProfile) return [];
    const list: PositionedLabel[] = [
      { id: 'vah', text: `VAH: $${formatExactPrice(volumeProfile.vah)}`, nominalY: priceToY(volumeProfile.vah), y: 0, color: '#38bdf8' },
      { id: 'poc', text: `POC: $${formatExactPrice(volumeProfile.poc)}`, nominalY: priceToY(volumeProfile.poc), y: 0, color: '#f59e0b' },
      { id: 'val', text: `VAL: $${formatExactPrice(volumeProfile.val)}`, nominalY: priceToY(volumeProfile.val), y: 0, color: '#38bdf8' },
    ].filter((l) => l.nominalY >= marginTop - 20 && l.nominalY <= marginTop + chartHeight + 20);

    return resolveCollisions(list, marginTop + 16, marginTop + chartHeight - 16, labelMinGap);
  }, [showProfile, volumeProfile, priceToY, marginTop, chartHeight, labelMinGap]);

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

          {/* Zoom & Pan Navigation Controls */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 sm:p-1 rounded border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setZoom((prev) => Math.max(0.4, Number((prev / 1.15).toFixed(2))))}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition flex items-center justify-center"
              title="Zoom Out (or scroll down on chart)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span
              className="px-1 text-[11px] text-cyan-400 font-bold min-w-[34px] text-center select-none"
              title="Current Zoom Magnification"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(3.0, Number((prev * 1.15).toFixed(2))))}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition flex items-center justify-center"
              title="Zoom In (or scroll up on chart)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {(zoom !== 1.0 || effectivePan > 0 || pricePanOffset !== 0) && (
              <button
                onClick={handleResetView}
                className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 font-bold text-[10.5px] transition flex items-center gap-1"
                title="Reset Zoom & Pan to live view"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
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
            O: <span className="text-slate-200">{hoverCandle ? `$${formatExactPrice(hoverCandle.open)}` : '--'}</span>
          </span>
          <span>
            H: <span className="text-emerald-400 font-medium">{hoverCandle ? `$${formatExactPrice(hoverCandle.high)}` : '--'}</span>
          </span>
          <span>
            L: <span className="text-rose-400 font-medium">{hoverCandle ? `$${formatExactPrice(hoverCandle.low)}` : '--'}</span>
          </span>
          <span>
            C: <span className="text-slate-200 font-bold">{hoverCandle ? `$${formatExactPrice(hoverCandle.close)}` : '--'}</span>
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
              className={`font-bold transition-colors duration-200 text-xs sm:text-sm font-mono ${
                priceDirection === 'up'
                  ? 'text-emerald-400'
                  : priceDirection === 'down'
                  ? 'text-rose-400'
                  : 'text-cyan-300'
              }`}
            >
              ${formatExactPrice(livePrice)}
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

      {/* Historical Pan Banner if panned back in time */}
      {effectivePan > 0 && (
        <div className="flex items-center justify-between px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs font-mono text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">⏪</span>
            <span className="font-bold">Viewing Historical Action:</span>
            <span>{effectivePan} bars shifted into the past</span>
          </div>
          <button
            onClick={() => {
              setPanOffset(0);
              setPricePanOffset(0);
            }}
            className="px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400 transition flex items-center gap-1"
          >
            <span>Jump to Live</span>
            <span>⏩</span>
          </button>
        </div>
      )}

      {/* Main SVG Visualization Canvas */}
      <div
        ref={svgContainerRef}
        className={`relative w-full overflow-hidden bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center select-none ${
          isMaximized ? 'flex-1 min-h-0' : ''
        }`}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          textRendering="geometricPrecision"
          shapeRendering="geometricPrecision"
          className={`w-full ${isMaximized ? 'h-full object-contain' : 'h-auto'} select-none`}
          style={{ maxHeight: isMaximized ? '100%' : '580px' }}
        >
          <defs>
            <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.85" />
            </filter>
            <linearGradient id="profileGradientVA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="profileGradientNonVA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bullishFvgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearishFvgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines & Right Price Ticks */}
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
                {/* Price labels on right margin - crisp, enlarged and high contrast for mobile devices */}
                <text
                  x={chartWidth + profileWidth + 8}
                  y={y + (isMobileView ? 5 : 4.5)}
                  fill="#f8fafc"
                  fontSize={isMobileView ? 14 : 12.5}
                  fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  fontWeight="bold"
                >
                  ${formatChartPrice(price)}
                </text>
              </g>
            );
          })}

          {/* FVG Gap Shaded Zones */}
          {showGaps &&
            gaps.map((gap) => {
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
                    opacity={0.75}
                  />
                  <rect
                    x={10}
                    y={Math.min(yHigh, yLow) + 2}
                    width={isMobileView ? 245 : 255}
                    height={isMobileView ? 26 : 22}
                    fill="#020617"
                    stroke={isBull ? '#10b981' : '#ef4444'}
                    strokeWidth={1.5}
                    rx={4}
                    opacity={0.98}
                    filter="url(#badgeShadow)"
                  />
                  <text
                    x={16}
                    y={Math.min(yHigh, yLow) + (isMobileView ? 18 : 16.5)}
                    fill={isBull ? '#34d399' : '#f87171'}
                    fontSize={isMobileView ? 13 : 11.5}
                    fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    fontWeight="bold"
                  >
                    Untested {gap.type.replace('_', ' ')} (${formatExactPrice(gap.lowPrice)} - ${formatExactPrice(gap.highPrice)})
                  </text>
                </g>
              );
            })}

          {/* Floor Pivots Overlays (Lines + De-conflicted Non-Overlapping Labels) */}
          {showPivots && (
            <g className="pivots-layer">
              <line
                x1={0}
                y1={priceToY(pivots.pivot)}
                x2={chartWidth}
                y2={priceToY(pivots.pivot)}
                stroke="#c084fc"
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <line
                x1={0}
                y1={priceToY(pivots.r1)}
                x2={chartWidth}
                y2={priceToY(pivots.r1)}
                stroke="#f43f5e"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <line
                x1={0}
                y1={priceToY(pivots.r2)}
                x2={chartWidth}
                y2={priceToY(pivots.r2)}
                stroke="#e11d48"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <line
                x1={0}
                y1={priceToY(pivots.s1)}
                x2={chartWidth}
                y2={priceToY(pivots.s1)}
                stroke="#10b981"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <line
                x1={0}
                y1={priceToY(pivots.s2)}
                x2={chartWidth}
                y2={priceToY(pivots.s2)}
                stroke="#059669"
                strokeWidth={1}
                strokeDasharray="2 2"
              />

              {/* Anti-Overlap Resolved Floor Pivot Badges */}
              {pivotLabels.map((lbl) => {
                const isShifted = Math.abs(lbl.y - lbl.nominalY) > 3;
                const badgeWidth = isMobileView ? 146 : 142;
                const badgeHeight = isMobileView ? 28 : 25;
                const badgeX = chartWidth - badgeWidth - 4;
                return (
                  <g key={lbl.id} className="pivot-label-badge" pointerEvents="none" filter="url(#badgeShadow)">
                    {isShifted && (
                      <line
                        x1={chartWidth - 2}
                        y1={lbl.nominalY}
                        x2={chartWidth - 6}
                        y2={lbl.y}
                        stroke={lbl.color}
                        strokeWidth={isMobileView ? 1.75 : 1.5}
                        strokeDasharray="2 2"
                      />
                    )}
                    <rect
                      x={badgeX}
                      y={lbl.y - badgeHeight / 2}
                      width={badgeWidth}
                      height={badgeHeight}
                      fill="#020617"
                      stroke={lbl.color}
                      strokeWidth={isMobileView ? 1.75 : 1.5}
                      rx={4}
                      opacity={0.98}
                    />
                    <text
                      x={badgeX + badgeWidth - 8}
                      y={lbl.y + (isMobileView ? 5 : 4.5)}
                      fill={lbl.color}
                      fontSize={isMobileView ? 14 : 12.5}
                      fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {lbl.text}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Session VWAP Line, Bands & De-conflicted Left-Side Labels */}
          {showVwap && (
            <g className="vwap-layer">
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
              <line
                x1={0}
                y1={priceToY(sessionVwap.price)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.price)}
                stroke="#f59e0b"
                strokeWidth={2}
              />

              {/* Anti-Overlap Resolved Left-Side VWAP Badges */}
              {leftLabels.map((lbl) => {
                const isShifted = Math.abs(lbl.y - lbl.nominalY) > 3;
                const badgeWidth = isMobileView ? 204 : 198;
                const badgeHeight = isMobileView ? 28 : 25;
                const badgeX = 8;
                return (
                  <g key={lbl.id} className="vwap-label-badge" pointerEvents="none" filter="url(#badgeShadow)">
                    {isShifted && (
                      <line
                        x1={badgeX + badgeWidth}
                        y1={lbl.nominalY}
                        x2={badgeX + badgeWidth + 6}
                        y2={lbl.y}
                        stroke={lbl.color}
                        strokeWidth={isMobileView ? 1.75 : 1.5}
                        strokeDasharray="2 2"
                      />
                    )}
                    <rect
                      x={badgeX}
                      y={lbl.y - badgeHeight / 2}
                      width={badgeWidth}
                      height={badgeHeight}
                      fill="#020617"
                      stroke={lbl.color}
                      strokeWidth={isMobileView ? 1.75 : 1.5}
                      rx={4}
                      opacity={0.98}
                    />
                    <text
                      x={badgeX + 8}
                      y={lbl.y + (isMobileView ? 5 : 4.5)}
                      fill={lbl.color}
                      fontSize={isMobileView ? 14 : 12.5}
                      fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      {lbl.text}
                    </text>
                  </g>
                );
              })}
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
                    <line
                      key={`ma-line-${ma.period}`}
                      x1={0}
                      y1={y}
                      x2={chartWidth}
                      y2={y}
                      stroke={color}
                      strokeWidth={1.2}
                      strokeDasharray={ma.period === 9 ? '4 2' : '6 3'}
                      opacity={0.85}
                    />
                  );
                })}

              {/* Anti-Overlap Resolved MA Badges in Dedicated Column to Left of Pivots */}
              {maLabels.map((lbl) => {
                const isShifted = Math.abs(lbl.y - lbl.nominalY) > 3;
                const badgeWidth = isMobileView ? 156 : 150;
                const badgeHeight = isMobileView ? 28 : 25;
                const badgeX = chartWidth - (isMobileView ? 152 : 152) - badgeWidth;
                return (
                  <g key={lbl.id} className="ma-label-badge" pointerEvents="none" filter="url(#badgeShadow)">
                    {isShifted && (
                      <line
                        x1={badgeX + badgeWidth}
                        y1={lbl.nominalY}
                        x2={badgeX + badgeWidth + 6}
                        y2={lbl.y}
                        stroke={lbl.color}
                        strokeWidth={isMobileView ? 1.75 : 1.5}
                        strokeDasharray="2 2"
                      />
                    )}
                    <rect
                      x={badgeX}
                      y={lbl.y - badgeHeight / 2}
                      width={badgeWidth}
                      height={badgeHeight}
                      fill="#020617"
                      stroke={lbl.color}
                      strokeWidth={isMobileView ? 1.75 : 1.5}
                      rx={4}
                      opacity={0.98}
                    />
                    <text
                      x={badgeX + badgeWidth - 8}
                      y={lbl.y + (isMobileView ? 5 : 4.5)}
                      fill={lbl.color}
                      fontSize={isMobileView ? 13.5 : 12}
                      fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {lbl.text}
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

          {/* Bottom X-Axis Time Marks */}
          <g className="time-axis-layer select-none" pointerEvents="none">
            {candles.map((c, i) => {
              const step = visibleCount > 32 ? 6 : visibleCount > 18 ? 4 : 2;
              if (i % step !== 0 && i !== candles.length - 1) return null;
              const x = i * candleSpacing + candleSpacing / 2;
              const d = new Date(c.timestamp);
              const label =
                timeframe === '1D'
                  ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

              return (
                <g key={`time-${c.timestamp}`}>
                  <line
                    x1={x}
                    y1={marginTop + chartHeight}
                    x2={x}
                    y2={marginTop + chartHeight + 5}
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={x}
                    y={marginTop + chartHeight + (isMobileView ? 21 : 19)}
                    fill="#f8fafc"
                    fontSize={isMobileView ? 13.5 : 11.5}
                    fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
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
                  fontSize={isPortraitMode ? 9.5 : 11}
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
                          fontSize={10}
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

              {/* Anti-Overlap Resolved Volume Profile Level Labels */}
              {profileLabels.map((lbl) => {
                const isShifted = Math.abs(lbl.y - lbl.nominalY) > 3;
                const badgeWidth = isMobileView ? 116 : 120;
                const badgeHeight = isMobileView ? 27 : 22;
                const badgeX = 5;
                return (
                  <g key={lbl.id} className="profile-label-badge" pointerEvents="none" filter="url(#badgeShadow)">
                    {isShifted && (
                      <line
                        x1={0}
                        y1={lbl.nominalY}
                        x2={badgeX}
                        y2={lbl.y}
                        stroke={lbl.color}
                        strokeWidth={isMobileView ? 1.5 : 1.2}
                        strokeDasharray="2 2"
                      />
                    )}
                    <rect
                      x={badgeX}
                      y={lbl.y - badgeHeight / 2}
                      width={badgeWidth}
                      height={badgeHeight}
                      fill="#020617"
                      stroke={lbl.color}
                      strokeWidth={isMobileView ? 1.75 : 1.4}
                      rx={3.5}
                      opacity={0.98}
                    />
                    <text
                      x={badgeX + 6}
                      y={lbl.y + (isMobileView ? 5 : 4.5)}
                      fill={lbl.color}
                      fontSize={isMobileView ? 13.5 : 12}
                      fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      {lbl.text}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Floating HUD over Active Candle */}
          {candles.length > 0 && (() => {
            const lastIndex = candles.length - 1;
            const lastX = lastIndex * candleSpacing + candleSpacing / 2;
            const lastCandle = candles[lastIndex];
            const topY = priceToY(Math.max(lastCandle.high, livePrice));
            const badgeY = Math.max(marginTop + 8, topY - (isMobileView ? 32 : 28));
            const hudWidth = isMobileView ? 148 : 124;

            return (
              <g className="active-candle-hud select-none" pointerEvents="none" filter="url(#badgeShadow)">
                {/* Dashed connector down to candle wick */}
                <line
                  x1={lastX}
                  y1={badgeY + (isMobileView ? 18 : 16)}
                  x2={lastX}
                  y2={topY}
                  stroke="#475569"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                />
                {/* Floating pill background */}
                <rect
                  x={lastX - hudWidth / 2}
                  y={badgeY}
                  width={hudWidth}
                  height={isMobileView ? 25 : 22}
                  fill="#020617"
                  stroke="#0284c7"
                  strokeWidth={1.5}
                  rx={5}
                  opacity={0.98}
                />
                <text
                  x={lastX}
                  y={badgeY + (isMobileView ? 17 : 15)}
                  fill="#38bdf8"
                  fontSize={isMobileView ? 13 : 11}
                  fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
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
                {/* Horizontal Ray Across Chart */}
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

                {/* Stable Beacon Dot on Last Active Bar */}
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
                  {/* Volume Value Tag Directly Above Price Label */}
                  {(() => {
                    const tagWidth = isMobileView ? 98 : 96;
                    const tagHeight = isMobileView ? 28 : 25;

                    return (
                      <>
                        <g className="timeframe-volume-badge">
                          <rect
                            x={0}
                            y={-25}
                            width={tagWidth}
                            height={22}
                            fill="#020617"
                            stroke="#38bdf8"
                            strokeWidth={1.2}
                            rx={3.5}
                          />
                          <text
                            x={tagWidth / 2}
                            y={-10}
                            fill="#38bdf8"
                            fontSize={isMobileView ? 12 : 11}
                            fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {timeframe} Vol: {volumeFormatted}
                          </text>
                        </g>

                        {/* Live Price Tag Box */}
                        <rect
                          x={0}
                          y={0}
                          width={tagWidth}
                          height={tagHeight}
                          fill={priceTagBg}
                          rx={4}
                        />
                        <text
                          x={tagWidth / 2}
                          y={tagHeight / 2 + 5}
                          fill="#ffffff"
                          fontSize={isMobileView ? 14.5 : 12.5}
                          fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ${formatExactPrice(livePrice)}
                        </text>

                        {/* Bar Close Countdown Attached Tag */}
                        <rect
                          x={0}
                          y={tagHeight + 3}
                          width={tagWidth}
                          height={22}
                          fill="#020617"
                          stroke="#f59e0b"
                          strokeWidth={1.2}
                          rx={3.5}
                        />
                        <text
                          x={tagWidth / 2}
                          y={tagHeight + (isMobileView ? 18 : 17.5)}
                          fill="#fbbf24"
                          fontSize={isMobileView ? 12 : 11}
                          fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
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

          {/* Interactive Mouse & Touch Tracking Layer - Smooth hover & pan/drag gesture support */}
          <rect
            x={0}
            y={marginTop}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            className={`select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              isDraggingRef.current = true;
              setIsDragging(true);
              setDragMoved(false);
              dragStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                initialPan: panOffset,
                initialPricePan: pricePanOffset,
              };
            }}
            onMouseMove={(e) => {
              const svgEl = e.currentTarget.ownerSVGElement;
              if (!svgEl) return;
              const pt = svgEl.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const ctm = svgEl.getScreenCTM();
              if (!ctm) return;
              const svgPt = pt.matrixTransform(ctm.inverse());

              if (isDraggingRef.current) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                  setDragMoved(true);
                }

                // Horizontal candle shifting: positive dx pulls earlier candles into view
                const candleShift = Math.round(dx / Math.max(4, candleSpacing));
                const newPan = Math.max(0, Math.min(maxPan, dragStartRef.current.initialPan + candleShift));
                setPanOffset(newPan);

                // Vertical dollar shifting
                const pricePerPixel = (maxPrice - minPrice) / chartHeight;
                const priceShift = dy * pricePerPixel;
                setPricePanOffset(dragStartRef.current.initialPricePan + priceShift);

                setHoverCandle(null);
                setHoverX(null);
                setHoverY(null);
              } else {
                if (svgPt.x >= 0 && svgPt.x <= chartWidth && candles.length > 0) {
                  const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(svgPt.x / candleSpacing)));
                  setHoverCandle(candles[idx]);
                  setHoverX(idx * candleSpacing + candleSpacing / 2);
                  setHoverY(Math.max(marginTop, Math.min(marginTop + chartHeight, svgPt.y)));
                }
              }
            }}
            onMouseUp={() => {
              isDraggingRef.current = false;
              setIsDragging(false);
            }}
            onMouseLeave={() => {
              isDraggingRef.current = false;
              setIsDragging(false);
              setHoverCandle(null);
              setHoverX(null);
              setHoverY(null);
            }}
            onDoubleClick={handleResetView}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                touchDistRef.current = Math.hypot(dx, dy);
                isDraggingRef.current = false;
                setIsDragging(false);
                return;
              }
              if (e.touches.length === 1) {
                isDraggingRef.current = true;
                setIsDragging(true);
                setDragMoved(false);
                dragStartRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  initialPan: panOffset,
                  initialPricePan: pricePanOffset,
                };
              }
            }}
            onTouchMove={(e) => {
              // Pinch to zoom
              if (e.touches.length === 2 && touchDistRef.current) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const factor = dist / touchDistRef.current;
                if (Math.abs(factor - 1) > 0.04) {
                  setZoom((prev) =>
                    Math.max(0.4, Math.min(3.0, Number((prev * (factor > 1 ? 1.05 : 0.95)).toFixed(2))))
                  );
                  touchDistRef.current = dist;
                }
                return;
              }

              // Single finger pan / drag
              if (e.touches.length === 1 && isDraggingRef.current) {
                const dx = e.touches[0].clientX - dragStartRef.current.x;
                const dy = e.touches[0].clientY - dragStartRef.current.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                  setDragMoved(true);
                }

                const candleShift = Math.round(dx / Math.max(4, candleSpacing));
                const newPan = Math.max(0, Math.min(maxPan, dragStartRef.current.initialPan + candleShift));
                setPanOffset(newPan);

                const pricePerPixel = (maxPrice - minPrice) / chartHeight;
                const priceShift = dy * pricePerPixel;
                setPricePanOffset(dragStartRef.current.initialPricePan + priceShift);

                const svgEl = e.currentTarget.ownerSVGElement;
                if (svgEl && !dragMoved) {
                  const pt = svgEl.createSVGPoint();
                  pt.x = e.touches[0].clientX;
                  pt.y = e.touches[0].clientY;
                  const ctm = svgEl.getScreenCTM();
                  if (ctm) {
                    const svgPt = pt.matrixTransform(ctm.inverse());
                    if (svgPt.x >= 0 && svgPt.x <= chartWidth && candles.length > 0) {
                      const idx = Math.max(0, Math.min(candles.length - 1, Math.floor(svgPt.x / candleSpacing)));
                      setHoverCandle(candles[idx]);
                      setHoverX(idx * candleSpacing + candleSpacing / 2);
                      setHoverY(Math.max(marginTop, Math.min(marginTop + chartHeight, svgPt.y)));
                    }
                  }
                }
              }
            }}
            onTouchEnd={() => {
              isDraggingRef.current = false;
              setIsDragging(false);
              touchDistRef.current = null;
              if (dragMoved) {
                setHoverCandle(null);
                setHoverX(null);
                setHoverY(null);
              }
            }}
          />
        </svg>
      </div>

      {/* Profile Metrics Summary Bar - Adaptive for Mobile Portrait */}
      {isMaximized && isPortraitMode ? (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-slate-300 shrink-0">
          <div>POC: <span className="text-amber-400 font-bold">${formatExactPrice(volumeProfile.poc)}</span></div>
          <div>VAH: <span className="text-cyan-300 font-bold">${formatExactPrice(volumeProfile.vah)}</span></div>
          <div>VAL: <span className="text-cyan-300 font-bold">${formatExactPrice(volumeProfile.val)}</span></div>
          <div>VWAP: <span className="text-amber-300 font-bold">${formatExactPrice(sessionVwap.price)}</span></div>
        </div>
      ) : (
        <div className={`${isMaximized ? 'hidden sm:grid' : 'grid'} grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs shrink-0`}>
          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">POC (MAX VOL):</span>
            <span className="text-amber-400 font-bold text-xs">
              ${formatExactPrice(volumeProfile.poc)}
            </span>
          </div>

          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">VAH (VALUE HIGH):</span>
            <span className="text-cyan-300 font-bold text-xs">
              ${formatExactPrice(volumeProfile.vah)}
            </span>
          </div>

          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">VAL (VALUE LOW):</span>
            <span className="text-cyan-300 font-bold text-xs">
              ${formatExactPrice(volumeProfile.val)}
            </span>
          </div>

          <div className={`p-2 bg-slate-950 rounded border border-slate-800 ${isMaximized ? 'hidden sm:block' : ''}`}>
            <span className="text-slate-400 text-[9.5px] block">SESSION VWAP:</span>
            <span className="text-amber-300 font-bold text-xs">
              ${formatExactPrice(sessionVwap.price)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
