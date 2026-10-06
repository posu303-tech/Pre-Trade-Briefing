import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Download,
  Flame,
  Layers,
  Percent,
  Radio,
  RotateCcw,
  Sliders,
  Table,
  TrendingDown,
  TrendingUp,
  Wifi,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Candle, ChartTimeframe, PreMarketBrief } from '../types';
import { getBarDuration, getBarStartTime, useLiveTicker } from '../services/useLiveTicker';

// Clean sans-serif typeface with large x-heights and open letter forms (Plus Jakarta Sans & Inter)
export const CHART_SANS_FONT =
  "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const formatPrice = (val: number | undefined | null): string => {
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

interface DataRequirementsPanelProps {
  brief: PreMarketBrief;
}

export const DataRequirementsPanel: React.FC<DataRequirementsPanelProps> = ({ brief }) => {
  const {
    symbol,
    dailyCandles,
    hourlyCandles,
    fifteenMinCandles,
    fiveMinCandles,
    currentPrice,
    priorDay,
    preMarket,
    catalysts,
    options,
    atr,
    pivots,
    volumeProfile,
    fibonacci,
  } = brief;

  // Active Audit Tab: 'session' (Current Session Granular Data) or 'mandates' (Pre-Analysis Mandates 1-6)
  const [activeTab, setActiveTab] = useState<'session' | 'mandates'>('session');
  // View mode for Granular Candlestick Audit: 'table' or 'chart' or 'split'
  const [auditViewMode, setAuditViewMode] = useState<'table' | 'chart' | 'split'>('chart');
  // Timeframe selector for Current Session Data
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('15m');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [copiedCsv, setCopiedCsv] = useState(false);

  // Zoom & Pan state for Audit Candlestick Chart
  const [auditZoom, setAuditZoom] = useState<number>(1.0);
  const [auditPan, setAuditPan] = useState<number>(0);
  const [auditPricePan, setAuditPricePan] = useState<number>(0);
  const [auditDragging, setAuditDragging] = useState<boolean>(false);
  const [auditHoverCandle, setAuditHoverCandle] = useState<Candle | null>(null);
  const [auditHoverX, setAuditHoverX] = useState<number | null>(null);
  const [auditHoverY, setAuditHoverY] = useState<number | null>(null);

  const auditContainerRef = useRef<HTMLDivElement>(null);
  const auditDragStartRef = useRef<{
    x: number;
    y: number;
    initialPan: number;
    initialPricePan: number;
  }>({ x: 0, y: 0, initialPan: 0, initialPricePan: 0 });
  const isAuditDraggingRef = useRef<boolean>(false);
  const auditTouchDistRef = useRef<number | null>(null);

  // Live WebSocket price feed for real-time audit verification
  const {
    livePrice,
    priceDirection,
    isLiveConnected,
    countdown,
    liveBar,
    tickCount,
    lastTickTime,
    lastClosedBar,
    barIndex,
  } = useLiveTicker(symbol, currentPrice, selectedTimeframe);

  const activeLivePrice = livePrice > 0 ? livePrice : currentPrice;

  // Base raw candles for selected timeframe from brief
  const baseCandles = useMemo(() => {
    let list: Candle[] = [];
    if (selectedTimeframe === '5m') {
      list = fiveMinCandles && fiveMinCandles.length > 0 ? fiveMinCandles : hourlyCandles;
    } else if (selectedTimeframe === '15m') {
      list = fifteenMinCandles && fifteenMinCandles.length > 0 ? fifteenMinCandles : hourlyCandles;
    } else if (selectedTimeframe === '1H') {
      list = hourlyCandles;
    } else {
      list = dailyCandles;
    }
    return list || [];
  }, [selectedTimeframe, fiveMinCandles, fifteenMinCandles, hourlyCandles, dailyCandles]);

  // Dynamic candle population maintaining sliding window of 48 bars as bars close and new bars start
  const [dynamicCandles, setDynamicCandles] = useState<Candle[]>(() => {
    return baseCandles.slice(-48);
  });

  const prevSymbolRef = useRef<string>(symbol);
  const prevTfRef = useRef<ChartTimeframe>(selectedTimeframe);
  const lastBriefTsRef = useRef<number>(brief.timestamp);

  // Synchronize when symbol, timeframe or fresh brief arrives
  useEffect(() => {
    if (
      prevSymbolRef.current !== symbol ||
      prevTfRef.current !== selectedTimeframe ||
      lastBriefTsRef.current !== brief.timestamp
    ) {
      prevSymbolRef.current = symbol;
      prevTfRef.current = selectedTimeframe;
      lastBriefTsRef.current = brief.timestamp;
      setDynamicCandles(baseCandles.slice(-48));
    }
  }, [symbol, selectedTimeframe, brief.timestamp, baseCandles]);

  // Real-time Bar Rollover: When current bar closes (authoritative WebSocket or clock boundary)
  useEffect(() => {
    const expectedBarStart = getBarStartTime(Date.now(), selectedTimeframe);
    const targetBarStart = liveBar ? Math.max(liveBar.timestamp, expectedBarStart) : expectedBarStart;

    setDynamicCandles((prev) => {
      if (!prev || prev.length === 0) return prev;
      const last = prev[prev.length - 1];

      // Check if current bar has finished and a newer bar is opening
      if (targetBarStart > last.timestamp) {
        // Finalize previous closed candle
        const closePrice =
          lastClosedBar && lastClosedBar.timestamp === last.timestamp
            ? lastClosedBar.close
            : liveBar?.open || (activeLivePrice > 0 ? activeLivePrice : last.close);

        const finalizedPrev: Candle = {
          ...last,
          close: closePrice,
          high: Math.max(last.high, lastClosedBar?.high || 0, closePrice),
          low: Math.min(last.low, lastClosedBar?.low || Infinity, closePrice),
          volume: lastClosedBar && lastClosedBar.timestamp === last.timestamp ? lastClosedBar.volume : last.volume,
          quoteVolume: lastClosedBar && lastClosedBar.timestamp === last.timestamp ? lastClosedBar.quoteVolume : last.quoteVolume,
          vwap: lastClosedBar?.vwap || last.vwap || (last.high + last.low + closePrice) / 3,
        };

        // Create new active candle for the new bar
        const newActiveBar: Candle = {
          timestamp: targetBarStart,
          open: liveBar && liveBar.timestamp === targetBarStart ? liveBar.open : closePrice,
          high: liveBar && liveBar.timestamp === targetBarStart ? liveBar.high : closePrice,
          low: liveBar && liveBar.timestamp === targetBarStart ? liveBar.low : closePrice,
          close: liveBar && liveBar.timestamp === targetBarStart ? liveBar.close : closePrice,
          volume: liveBar && liveBar.timestamp === targetBarStart ? liveBar.volume : 0,
          quoteVolume: liveBar && liveBar.timestamp === targetBarStart ? liveBar.quoteVolume : 0,
          vwap: closePrice,
        };

        const updated = [...prev.slice(0, -1), finalizedPrev, newActiveBar];
        // Maintain 48 bars populated
        return updated.length > 48 ? updated.slice(updated.length - 48) : updated;
      }

      return prev;
    });
  }, [liveBar?.timestamp, lastClosedBar, barIndex, countdown.formatted, selectedTimeframe, activeLivePrice]);

  // Dynamic candle population corresponding to selected timeframe
  const sessionCandles = useMemo(() => {
    const sorted = [...dynamicCandles];
    if (sortOrder === 'newest') {
      sorted.reverse();
    }
    return sorted;
  }, [dynamicCandles, sortOrder]);

  // Reset audit pan on timeframe or symbol change
  useEffect(() => {
    setAuditPan(0);
    setAuditPricePan(0);
  }, [selectedTimeframe, symbol]);

  // Windowing for Audit Candlestick Chart (Chronological order)
  const auditBaseCount = 24;
  const auditVisibleCount = Math.max(6, Math.min(dynamicCandles.length, Math.round(auditBaseCount / auditZoom)));
  const auditMaxPan = Math.max(0, dynamicCandles.length - auditVisibleCount);
  const auditEffectivePan = Math.max(0, Math.min(auditMaxPan, auditPan));

  const auditCandles = useMemo(() => {
    if (!dynamicCandles.length) return [];
    const end = dynamicCandles.length - auditEffectivePan;
    const start = Math.max(0, end - auditVisibleCount);
    return dynamicCandles.slice(start, end);
  }, [dynamicCandles, auditEffectivePan, auditVisibleCount]);

  const handleAuditZoomIn = useCallback(() => {
    setAuditZoom((prev) => Math.min(3.5, Number((prev * 1.2).toFixed(2))));
  }, []);

  const handleAuditZoomOut = useCallback(() => {
    setAuditZoom((prev) => Math.max(0.25, Number((prev / 1.2).toFixed(2))));
  }, []);

  const handleAuditPanLeft = useCallback((count = 5) => {
    setAuditPan((prev) => Math.min(auditMaxPan, prev + count));
  }, [auditMaxPan]);

  const handleAuditPanRight = useCallback((count = 5) => {
    setAuditPan((prev) => Math.max(0, prev - count));
  }, []);

  const handleAuditResetView = useCallback(() => {
    setAuditZoom(1.0);
    setAuditPan(0);
    setAuditPricePan(0);
  }, []);

  const handleAuditPreset = useCallback(
    (preset: 'fit' | '100%' | 'focus') => {
      if (preset === 'fit') {
        const fitZoom = Math.max(
          0.25,
          Math.min(1.0, Number((auditBaseCount / Math.max(1, dynamicCandles.length)).toFixed(2)))
        );
        setAuditZoom(fitZoom);
        setAuditPan(0);
        setAuditPricePan(0);
      } else if (preset === '100%') {
        setAuditZoom(1.0);
        setAuditPan(0);
        setAuditPricePan(0);
      } else if (preset === 'focus') {
        setAuditZoom(2.0);
        setAuditPan(0);
        setAuditPricePan(0);
      }
    },
    [auditBaseCount, dynamicCandles.length]
  );

  // Wheel listener for Audit Chart
  useEffect(() => {
    const el = auditContainerRef.current;
    if (!el || auditViewMode === 'table') return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const shift = Math.round(delta / 10);
        setAuditPan((prev) => Math.max(0, Math.min(auditMaxPan, prev + shift)));
      } else {
        if (e.deltaY < 0) {
          setAuditZoom((prev) => Math.min(3.5, Number((prev * 1.15).toFixed(2))));
        } else {
          setAuditZoom((prev) => Math.max(0.25, Number((prev / 1.15).toFixed(2))));
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [auditMaxPan, auditViewMode]);

  // Keyboard navigation for audit chart zoom & pan
  useEffect(() => {
    if (auditViewMode === 'table') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setAuditPan((prev) => Math.min(auditMaxPan, prev + (e.shiftKey ? 12 : 4)));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setAuditPan((prev) => Math.max(0, prev - (e.shiftKey ? 12 : 4)));
      } else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleAuditZoomIn();
      } else if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleAuditZoomOut();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleAuditResetView();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [auditViewMode, auditMaxPan, handleAuditZoomIn, handleAuditZoomOut, handleAuditResetView]);

  // Aggregate metrics calculation for the chosen timeframe with live tick integration
  const sessionStats = useMemo(() => {
    const list = dynamicCandles;

    if (!list.length) {
      return {
        count: 0,
        high: 0,
        low: 0,
        open: 0,
        close: 0,
        range: 0,
        rangePerc: 0,
        netChange: 0,
        netChangePerc: 0,
        totalVol: 0,
        totalQuoteVol: 0,
        vwap: 0,
        avgRange: 0,
        avg20Vol: 0,
      };
    }

    const lastIdx = list.length - 1;
    const latestCandle = list[lastIdx];
    const liveC = activeLivePrice > 0 ? activeLivePrice : latestCandle.close;
    const liveH = Math.max(latestCandle.high, liveBar?.high || 0, liveC);
    const liveL = Math.min(latestCandle.low, liveBar && liveBar.low > 0 ? liveBar.low : Infinity, liveC);
    const liveV = liveBar && liveBar.volume > 0 ? Math.max(latestCandle.volume, liveBar.volume) : latestCandle.volume;

    const high = Math.max(...list.slice(0, lastIdx).map((c) => c.high), liveH);
    const low = Math.min(...list.slice(0, lastIdx).map((c) => c.low), liveL);
    const open = list[0].open;
    const close = liveC;
    const range = high - low;
    const rangePerc = open > 0 ? (range / open) * 100 : 0;
    const netChange = close - open;
    const netChangePerc = open > 0 ? (netChange / open) * 100 : 0;
    const totalVol = list.slice(0, lastIdx).reduce((acc, c) => acc + c.volume, 0) + liveV;
    const totalQuoteVol = list.reduce(
      (acc, c) => acc + (c.quoteVolume || c.volume * c.close),
      0
    );
    const sumWeightedTypical = list.reduce(
      (acc, c) => acc + (c.vwap || (c.high + c.low + c.close) / 3) * c.volume,
      0
    );
    const vwap = totalVol > 0 ? sumWeightedTypical / totalVol : close;
    const avgRange = list.reduce((acc, c) => acc + (c.high - c.low), 0) / list.length;
    const last20 = list.slice(-20);
    const avg20Vol =
      last20.length > 0
        ? (last20.slice(0, -1).reduce((acc, c) => acc + c.volume, 0) + liveV) / last20.length
        : 0;

    return {
      count: list.length,
      high,
      low,
      open,
      close,
      range,
      rangePerc,
      netChange,
      netChangePerc,
      totalVol,
      totalQuoteVol,
      vwap,
      avgRange,
      avg20Vol,
    };
  }, [dynamicCandles, activeLivePrice, liveBar]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Timeframe',
      'Timestamp_UTC',
      'Date_Local',
      'Open',
      'High',
      'Low',
      'Close',
      'Range',
      'Range_Pct',
      'Volume',
      'Dollar_Volume',
      'VWAP',
      'Change_Pct',
    ];
    const rows = sessionCandles.map((c) => {
      const range = c.high - c.low;
      const rangePct = c.open > 0 ? ((range / c.open) * 100).toFixed(2) : '0.00';
      const quoteVol = c.quoteVolume || c.volume * c.close;
      const barVwap = c.vwap || (c.high + c.low + c.close) / 3;
      const chgPct = c.open > 0 ? (((c.close - c.open) / c.open) * 100).toFixed(2) : '0.00';
      return [
        selectedTimeframe,
        new Date(c.timestamp).toISOString(),
        `"${new Date(c.timestamp).toLocaleString()}"`,
        c.open.toFixed(2),
        c.high.toFixed(2),
        c.low.toFixed(2),
        c.close.toFixed(2),
        range.toFixed(2),
        `${rangePct}%`,
        c.volume.toFixed(4),
        quoteVol.toFixed(2),
        barVwap.toFixed(2),
        `${chgPct}%`,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    navigator.clipboard.writeText(csvContent);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2200);
  };

  // Last 10 daily candles slice for Mandate 1
  const last10Candles = dailyCandles.slice(-10);

  return (
    <div className="space-y-6 w-full pb-12 font-mono text-xs">
      {/* Top Header & Audit Sub-Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 flex items-center justify-center rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
              AUDIT SHEET
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight font-sans">
              Quantitative Data Audit & Session Feed ({symbol})
            </h2>
          </div>

          {/* Sub-Tab Switcher: Current Session Data vs Pre-Analysis Mandates */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('session')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-2 ${
                activeTab === 'session'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Current Session Data</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-500/30 font-bold">
                Live
              </span>
            </button>
            <button
              onClick={() => setActiveTab('mandates')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-2 ${
                activeTab === 'mandates'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pre-Analysis Mandates (1–6)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                6 Verified
              </span>
            </button>
          </div>
        </div>

        <p className="text-slate-300 font-sans text-xs md:text-sm">
          {activeTab === 'session'
            ? `Granular intraday session bars for ${symbol}. Select any timeframe (5m, 15m, 1H, 1D) below to dynamically populate all metrics, candle OHLCV ranges, and VWAP calculations.`
            : 'Strict desk protocol requires confirming the 6 core quantitative inputs prior to running intraday trade models. If any dataset is estimated or unavailable, it is explicitly flagged below.'}
        </p>

        {/* Real-Time Live Price Audit Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-cyan-500/25">
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isLiveConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Audit Price Feed:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isLiveConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isLiveConnected ? 'LIVE FEED' : 'STREAM CONNECTING'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-400">LIVE SPOT:</span>
              <span
                className={`text-xl font-mono font-bold tracking-tight transition-colors duration-200 ${
                  priceDirection === 'up'
                    ? 'text-emerald-400'
                    : priceDirection === 'down'
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                ${formatPrice(activeLivePrice)}
              </span>
              <span
                className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                  preMarket.change24hPercent >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {preMarket.change24hPercent >= 0 ? '+' : ''}
                {preMarket.change24hPercent.toFixed(2)}% (24H)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div>
              <span className="text-slate-500 mr-1">24H HIGH / LOW:</span>
              <span className="text-slate-200 font-mono">
                ${formatPrice(preMarket.high24h)} / ${formatPrice(preMarket.low24h)}
              </span>
            </div>
            <div className="hidden sm:block border-l border-slate-800 pl-3">
              <span className="text-slate-500 mr-1">NEXT BAR ({selectedTimeframe}):</span>
              <span className="text-amber-300 font-mono font-bold">{countdown.formatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CURRENT SESSION DATA TAB                          */}
      {/* ======================================================== */}
      {activeTab === 'session' && (
        <div className="space-y-6">
          {/* Timeframe Selector Toolbar & Table Utilities */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Timeframe Selector Buttons */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5 mr-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                TIMEFRAME:
              </span>
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSelectedTimeframe('5m')}
                  className={`px-3 py-1 rounded transition text-xs font-bold ${
                    selectedTimeframe === '5m'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  5m (Micro)
                </button>
                <button
                  onClick={() => setSelectedTimeframe('15m')}
                  className={`px-3 py-1 rounded transition text-xs font-bold ${
                    selectedTimeframe === '15m'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  15m (Execution)
                </button>
                <button
                  onClick={() => setSelectedTimeframe('1H')}
                  className={`px-3 py-1 rounded transition text-xs font-bold ${
                    selectedTimeframe === '1H'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  1H (Structure)
                </button>
                <button
                  onClick={() => setSelectedTimeframe('1D')}
                  className={`px-3 py-1 rounded transition text-xs font-bold ${
                    selectedTimeframe === '1D'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  1D (Macro)
                </button>
              </div>
            </div>

            {/* Sort Order and CSV Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition text-xs"
              >
                <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                <span>Sort: {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center gap-1.5 transition text-xs font-medium"
                title="Copy current timeframe table as CSV"
              >
                {copiedCsv ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied CSV!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-cyan-400" />
                    <span>Copy CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Aggregate Session Stats Cards for Selected Timeframe */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* Live Spot Price Card */}
            <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-3 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 text-[10px] font-bold flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  LIVE SPOT:
                </span>
                <span
                  className={`text-[9px] font-bold px-1 rounded ${
                    priceDirection === 'up'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : priceDirection === 'down'
                      ? 'text-rose-400 bg-rose-500/10'
                      : 'text-slate-400 bg-slate-800'
                  }`}
                >
                  {priceDirection === 'up' ? '▲ Up' : priceDirection === 'down' ? '▼ Down' : '● Live'}
                </span>
              </div>
              <span
                className={`font-bold text-sm block mt-0.5 font-mono ${
                  priceDirection === 'up'
                    ? 'text-emerald-300'
                    : priceDirection === 'down'
                    ? 'text-rose-300'
                    : 'text-white'
                }`}
              >
                ${formatPrice(activeLivePrice)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                24H:{' '}
                <strong className={preMarket.change24hPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {preMarket.change24hPercent >= 0 ? '+' : ''}
                  {preMarket.change24hPercent.toFixed(2)}%
                </strong>
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">TIMEFRAME BARS:</span>
              <span className="text-white font-bold text-sm">{sessionStats.count} Bars</span>
              <span className="text-[10px] text-cyan-400 block mt-0.5">{selectedTimeframe} Resolution</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">SESSION HIGH:</span>
              <span className="text-emerald-400 font-bold text-sm font-mono">
                ${formatPrice(sessionStats.high)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Peak in timeframe</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">SESSION LOW:</span>
              <span className="text-rose-400 font-bold text-sm font-mono">
                ${formatPrice(sessionStats.low)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Trough in timeframe</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">TOTAL RANGE:</span>
              <span className="text-amber-300 font-bold text-sm font-mono">
                ${formatPrice(sessionStats.range)}
              </span>
              <span className="text-[10px] text-amber-400/80 block mt-0.5">
                {sessionStats.rangePerc.toFixed(2)}% of Open
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">TIMEFRAME VWAP:</span>
              <span className="text-amber-400 font-bold text-sm font-mono">
                ${formatPrice(sessionStats.vwap)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Volume-weighted typical</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">NET TIMEFRAME CHANGE:</span>
              <span
                className={`font-bold text-sm flex items-center gap-1 font-mono ${
                  sessionStats.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {sessionStats.netChange >= 0 ? '+' : ''}
                ${formatPrice(sessionStats.netChange)} ({sessionStats.netChangePerc.toFixed(2)}%)
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Avg bar: ${formatPrice(sessionStats.avgRange)} | 20-Bar Avg Vol:{' '}
                {sessionStats.avg20Vol.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            </div>
          </div>

          {/* Populated Columns Data Audit Table for Selected Timeframe */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[11px] border border-cyan-500/40">
                  {selectedTimeframe} FEED
                </span>
                <h3 className="text-sm font-semibold text-white font-sans">
                  Granular Candlestick Audit ({sessionCandles.length} Bars Populated)
                </h3>
                {/* View Mode Toggle: Chart, Split, Table */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setAuditViewMode('chart')}
                    className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                      auditViewMode === 'chart'
                        ? 'bg-cyan-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Interactive Candlestick Chart (Zoom & Pan)"
                  >
                    <BarChart3 className="w-3 h-3" />
                    <span>Chart</span>
                  </button>
                  <button
                    onClick={() => setAuditViewMode('split')}
                    className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                      auditViewMode === 'split'
                        ? 'bg-cyan-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Chart & Data Table Split View"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Split (Chart + Table)</span>
                  </button>
                  <button
                    onClick={() => setAuditViewMode('table')}
                    className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                      auditViewMode === 'table'
                        ? 'bg-cyan-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Populated OHLCV Data Audit Table"
                  >
                    <Table className="w-3 h-3" />
                    <span>Table</span>
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950 border border-emerald-500/30 text-[11px] font-mono shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-bold">LIVE TICK STREAM</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-300">
                    Ticks: <strong className="text-white">{tickCount > 0 ? tickCount.toLocaleString() : '1'}</strong>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">
                    Close: <strong className="text-cyan-300">{countdown.formatted}</strong>
                  </span>
                </div>
                <span className="text-slate-400 text-[11px] hidden xl:inline">
                  Showing Open, Close, Range ($ & %), Change ($), Volume, Vol / 20-Avg, and Direction
                </span>
              </div>
            </div>

            {/* View Mode 1: Interactive Candlestick Chart with Zoom & Pan */}
            {(auditViewMode === 'chart' || auditViewMode === 'split') && (
              <div className="space-y-3">
                {/* Audit Chart Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Zoom:</span>
                    <button
                      onClick={handleAuditZoomOut}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                      title="Zoom Out (- key or Wheel Down)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400 font-bold text-[11px] min-w-[38px] text-center border border-slate-800">
                      {Math.round(auditZoom * 100)}%
                    </span>
                    <button
                      onClick={handleAuditZoomIn}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                      title="Zoom In (+ key or Wheel Up)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-4 bg-slate-800 mx-0.5" />
                    <button
                      onClick={() => handleAuditPreset('fit')}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-[10.5px] transition"
                      title="Fit All 48 Bars in Window"
                    >
                      Fit 48
                    </button>
                    <button
                      onClick={() => handleAuditPreset('100%')}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-[10.5px] transition"
                      title="Default 100% Zoom"
                    >
                      100%
                    </button>
                    <button
                      onClick={() => handleAuditPreset('focus')}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-[10.5px] transition"
                      title="Focus In (2X Zoom)"
                    >
                      Focus
                    </button>
                    <div className="w-px h-4 bg-slate-800 mx-0.5" />
                    <button
                      onClick={() => handleAuditPanLeft(6)}
                      disabled={auditEffectivePan >= auditMaxPan}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      title="Pan Left / History (Arrow Left or Drag Right)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAuditPanRight(6)}
                      disabled={auditEffectivePan <= 0}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      title="Pan Right / Live (Arrow Right or Drag Left)"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {(auditZoom !== 1.0 || auditEffectivePan > 0 || auditPricePan !== 0) && (
                      <button
                        onClick={handleAuditResetView}
                        className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 font-bold text-[10.5px] transition flex items-center gap-1 ml-1"
                        title="Reset Zoom & Pan View (Home Key)"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="hidden sm:inline">
                      Drag canvas to Pan | Wheel / Pinch to Zoom
                    </span>
                    <span>
                      Window: <strong className="text-white">{auditCandles.length}</strong> / {dynamicCandles.length} bars
                    </span>
                    {auditEffectivePan > 0 && (
                      <button
                        onClick={() => {
                          setAuditPan(0);
                          setAuditPricePan(0);
                        }}
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10.5px] hover:bg-amber-500/30 transition flex items-center gap-1"
                        title="Jump to Current Live Bar"
                      >
                        <span>Jump to Live</span>
                        <span>⏩</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* SVG Visual Canvas for Audit Candlesticks with Drag & Pan */}
                <div
                  ref={auditContainerRef}
                  className="relative w-full overflow-hidden bg-slate-950 rounded-lg border border-slate-800 select-none flex items-center justify-center"
                >
                  {/* Floating Panned Banner when looking at historical bars */}
                  {auditEffectivePan > 0 && (
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1 bg-amber-500/15 border border-amber-500/40 rounded-full text-xs font-mono text-amber-300 shadow-lg backdrop-blur-md">
                      <span>PANNED: -{auditEffectivePan} BARS</span>
                      <button
                        onClick={() => {
                          setAuditPan(0);
                          setAuditPricePan(0);
                        }}
                        className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10.5px] hover:bg-amber-400 transition"
                      >
                        Jump to Live ⏩
                      </button>
                    </div>
                  )}

                  {(() => {
                    if (!auditCandles.length) {
                      return <div className="py-20 text-slate-500 text-xs font-mono">No bars available</div>;
                    }

                    const svgW = 1000;
                    const svgH = 380;
                    const rightM = 85;
                    const topM = 25;
                    const botM = 35;
                    const cW = svgW - rightM;
                    const cH = svgH - topM - botM;

                    let cMin = Math.min(...auditCandles.map((c) => c.low));
                    let cMax = Math.max(...auditCandles.map((c) => c.high));
                    const rng = cMax - cMin;
                    const pad = rng > 0 ? rng * 0.1 : (cMax || 100) * 0.02;
                    cMin = cMin - pad + auditPricePan;
                    cMax = cMax + pad + auditPricePan;
                    const effectiveRng = Math.max(0.0001, cMax - cMin);

                    const getY = (val: number) => topM + cH - ((val - cMin) / effectiveRng) * cH;
                    const colW = cW / auditCandles.length;
                    const barW = Math.max(3, colW * 0.72);

                    return (
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="w-full h-auto select-none"
                        style={{ maxHeight: '420px' }}
                      >
                        <defs>
                          <linearGradient id="auditGreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.75" />
                          </linearGradient>
                          <linearGradient id="auditRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#e11d48" stopOpacity="0.75" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines & price labels - clean sans-serif with tabular figures */}
                        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                          const pVal = cMin + pct * effectiveRng;
                          const yPos = getY(pVal);
                          return (
                            <g key={pct}>
                              <line
                                x1={0}
                                y1={yPos}
                                x2={cW}
                                y2={yPos}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                                strokeWidth={1}
                              />
                              <text
                                x={cW + 8}
                                y={yPos + 4}
                                fill="#94a3b8"
                                fontSize={10.5}
                                fontFamily={CHART_SANS_FONT}
                                fontWeight="600"
                                letterSpacing="0.01em"
                                style={{ fontFeatureSettings: '"tnum"' }}
                              >
                                ${formatPrice(pVal)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Candlesticks */}
                        {auditCandles.map((c, idx) => {
                          const isLastInFull = c.timestamp === dynamicCandles[dynamicCandles.length - 1]?.timestamp;
                          const effClose = isLastInFull && liveBar ? liveBar.close : isLastInFull ? activeLivePrice : c.close;
                          const effHigh = isLastInFull && liveBar ? Math.max(c.high, liveBar.high, activeLivePrice) : isLastInFull ? Math.max(c.high, activeLivePrice) : c.high;
                          const effLow = isLastInFull && liveBar && liveBar.low > 0 ? Math.min(c.low, liveBar.low, activeLivePrice) : isLastInFull ? Math.min(c.low, activeLivePrice) : c.low;
                          const effOpen = isLastInFull && liveBar && liveBar.open > 0 ? liveBar.open : c.open;

                          const isGreen = effClose >= effOpen;
                          const xCenter = idx * colW + colW / 2;
                          const yOpen = getY(effOpen);
                          const yClose = getY(effClose);
                          const yHigh = getY(effHigh);
                          const yLow = getY(effLow);
                          const bodyTop = Math.min(yOpen, yClose);
                          const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));

                          return (
                            <g key={c.timestamp + '-' + idx}>
                              {/* Wick */}
                              <line
                                x1={xCenter}
                                y1={yHigh}
                                x2={xCenter}
                                y2={yLow}
                                stroke={isGreen ? '#34d399' : '#f43f5e'}
                                strokeWidth={1.5}
                              />
                              {/* Body */}
                              <rect
                                x={xCenter - barW / 2}
                                y={bodyTop}
                                width={barW}
                                height={bodyH}
                                fill={isGreen ? 'url(#auditGreenGrad)' : 'url(#auditRedGrad)'}
                                rx={1}
                              />
                              {/* Active Bar indicator */}
                              {isLastInFull && (
                                <circle
                                  cx={xCenter}
                                  cy={yClose}
                                  r={3}
                                  fill="#38bdf8"
                                  className="animate-ping"
                                />
                              )}
                            </g>
                          );
                        })}

                        {/* Bottom Time Marks with guaranteed non-overlapping spacing */}
                        {(() => {
                          const minTimeGap = 70; // Minimum gap between adjacent time marks
                          const renderedXs: number[] = [];

                          return auditCandles.map((c, idx) => {
                            const xCenter = idx * colW + colW / 2;

                            // Ensure at least minTimeGap pixels from the previous rendered label
                            if (renderedXs.length > 0 && xCenter - renderedXs[renderedXs.length - 1] < minTimeGap) {
                              return null;
                            }

                            // Avoid collision with chart right edge
                            if (cW - xCenter < minTimeGap / 2 && idx !== auditCandles.length - 1) {
                              return null;
                            }

                            renderedXs.push(xCenter);

                            return (
                              <g key={`time-${c.timestamp}-${idx}`}>
                                <line
                                  x1={xCenter}
                                  y1={topM + cH}
                                  x2={xCenter}
                                  y2={topM + cH + 4}
                                  stroke="#475569"
                                  strokeWidth={1}
                                  shapeRendering="crispEdges"
                                />
                                <text
                                  x={xCenter}
                                  y={topM + cH + 18}
                                  fill="#94a3b8"
                                  fontSize={10.5}
                                  fontFamily={CHART_SANS_FONT}
                                  fontWeight="600"
                                  letterSpacing="0.01em"
                                  textAnchor="middle"
                                  style={{ fontFeatureSettings: '"tnum"' }}
                                >
                                  {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </text>
                              </g>
                            );
                          });
                        })()}

                        {/* Interactive Hover Crosshairs */}
                        {auditHoverX !== null && (
                          <g className="crosshair-layer" pointerEvents="none">
                            <line
                              x1={auditHoverX}
                              y1={topM}
                              x2={auditHoverX}
                              y2={topM + cH}
                              stroke="#64748b"
                              strokeWidth={1}
                              strokeDasharray="2 2"
                              opacity={0.8}
                            />
                            {auditHoverY !== null && (
                              <line
                                x1={0}
                                y1={auditHoverY}
                                x2={cW}
                                y2={auditHoverY}
                                stroke="#64748b"
                                strokeWidth={1}
                                strokeDasharray="2 2"
                                opacity={0.8}
                              />
                            )}
                          </g>
                        )}

                        {/* Floating Hover Candlestick Stats HUD */}
                        {auditHoverCandle && (
                          <g pointerEvents="none">
                            <rect
                              x={10}
                              y={topM + 4}
                              width={cW - 20}
                              height={25}
                              fill="#020617"
                              fillOpacity={0.94}
                              stroke="#334155"
                              strokeWidth={1}
                              rx={4}
                            />
                            <text
                              x={20}
                              y={topM + 20}
                              fill="#94a3b8"
                              fontSize={11}
                              fontFamily={CHART_SANS_FONT}
                              letterSpacing="0.01em"
                              style={{ fontFeatureSettings: '"tnum"' }}
                            >
                              <tspan fill="#38bdf8" fontWeight="700">
                                {new Date(auditHoverCandle.timestamp).toISOString().replace('T', ' ').substring(0, 16)} UTC
                              </tspan>
                              <tspan dx="12">O: </tspan>
                              <tspan fill="#ffffff" fontWeight="700">${formatPrice(auditHoverCandle.open)}</tspan>
                              <tspan dx="10">H: </tspan>
                              <tspan fill="#ffffff" fontWeight="700">${formatPrice(auditHoverCandle.high)}</tspan>
                              <tspan dx="10">L: </tspan>
                              <tspan fill="#ffffff" fontWeight="700">${formatPrice(auditHoverCandle.low)}</tspan>
                              <tspan dx="10">C: </tspan>
                              <tspan fill={auditHoverCandle.close >= auditHoverCandle.open ? '#34d399' : '#f43f5e'} fontWeight="700">
                                ${formatPrice(auditHoverCandle.close)}
                              </tspan>
                              <tspan dx="10">Vol: </tspan>
                              <tspan fill="#ffffff" fontWeight="700">
                                {auditHoverCandle.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </tspan>
                              {sessionStats.avg20Vol > 0 && (() => {
                                const ratio = parseFloat((auditHoverCandle.volume / sessionStats.avg20Vol).toFixed(1));
                                const color = ratio >= 1.3 ? '#34d399' : ratio <= 0.7 ? '#f43f5e' : '#ffffff';
                                return (
                                  <>
                                    <tspan dx="10">Vol/20: </tspan>
                                    <tspan fill={color} fontWeight="700">{ratio.toFixed(1)}X</tspan>
                                  </>
                                );
                              })()}
                              <tspan dx="10">Chg: </tspan>
                              <tspan
                                fill={auditHoverCandle.close >= auditHoverCandle.open ? '#34d399' : '#f43f5e'}
                                fontWeight="700"
                              >
                                {auditHoverCandle.close >= auditHoverCandle.open ? '+' : ''}
                                {(((auditHoverCandle.close - auditHoverCandle.open) / (auditHoverCandle.open || 1)) * 100).toFixed(2)}%
                              </tspan>
                            </text>
                          </g>
                        )}

                        {/* Interactive Drag & Hover Layer */}
                        <rect
                          x={0}
                          y={0}
                          width={svgW}
                          height={svgH}
                          fill="transparent"
                          className={`${auditDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none touch-none`}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            try {
                              e.currentTarget.setPointerCapture(e.pointerId);
                            } catch {
                              // ignore
                            }
                            isAuditDraggingRef.current = true;
                            setAuditDragging(true);
                            auditDragStartRef.current = {
                              x: e.clientX,
                              y: e.clientY,
                              initialPan: auditPan,
                              initialPricePan: auditPricePan,
                            };
                          }}
                          onPointerMove={(e) => {
                            const svgEl = e.currentTarget.ownerSVGElement;
                            if (!svgEl) return;
                            const rect = svgEl.getBoundingClientRect();
                            const screenColW = (rect.width * (cW / svgW)) / Math.max(1, auditCandles.length);
                            const screenChartH = rect.height * (cH / svgH);

                            if (isAuditDraggingRef.current) {
                              const dx = e.clientX - auditDragStartRef.current.x;
                              const dy = e.clientY - auditDragStartRef.current.y;
                              const shift = Math.round(dx / Math.max(2, screenColW));
                              setAuditPan(Math.max(0, Math.min(auditMaxPan, auditDragStartRef.current.initialPan + shift)));
                              const pShift = dy * (effectiveRng / Math.max(1, screenChartH));
                              setAuditPricePan(auditDragStartRef.current.initialPricePan + pShift);

                              setAuditHoverCandle(null);
                              setAuditHoverX(null);
                              setAuditHoverY(null);
                            } else {
                              const pt = svgEl.createSVGPoint();
                              pt.x = e.clientX;
                              pt.y = e.clientY;
                              const ctm = svgEl.getScreenCTM();
                              if (!ctm) return;
                              const svgPt = pt.matrixTransform(ctm.inverse());

                              if (svgPt.x >= 0 && svgPt.x <= cW && auditCandles.length > 0) {
                                const idx = Math.max(0, Math.min(auditCandles.length - 1, Math.floor(svgPt.x / colW)));
                                setAuditHoverCandle(auditCandles[idx]);
                                setAuditHoverX(idx * colW + colW / 2);
                                setAuditHoverY(Math.max(topM, Math.min(topM + cH, svgPt.y)));
                              } else {
                                setAuditHoverCandle(null);
                                setAuditHoverX(null);
                                setAuditHoverY(null);
                              }
                            }
                          }}
                          onPointerLeave={() => {
                            if (!isAuditDraggingRef.current) {
                              setAuditHoverCandle(null);
                              setAuditHoverX(null);
                              setAuditHoverY(null);
                            }
                          }}
                          onPointerUp={(e) => {
                            try {
                              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                              }
                            } catch {
                              // ignore
                            }
                            isAuditDraggingRef.current = false;
                            setAuditDragging(false);
                          }}
                          onPointerCancel={(e) => {
                            try {
                              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                              }
                            } catch {
                              // ignore
                            }
                            isAuditDraggingRef.current = false;
                            setAuditDragging(false);
                          }}
                          onDoubleClick={handleAuditResetView}
                          onTouchStart={(e) => {
                            if (e.touches.length === 2) {
                              const dx = e.touches[0].clientX - e.touches[1].clientX;
                              const dy = e.touches[0].clientY - e.touches[1].clientY;
                              auditTouchDistRef.current = Math.hypot(dx, dy);
                              isAuditDraggingRef.current = false;
                              setAuditDragging(false);
                              return;
                            }
                            if (e.touches.length === 1) {
                              isAuditDraggingRef.current = true;
                              setAuditDragging(true);
                              auditDragStartRef.current = {
                                x: e.touches[0].clientX,
                                y: e.touches[0].clientY,
                                initialPan: auditPan,
                                initialPricePan: auditPricePan,
                              };
                            }
                          }}
                          onTouchMove={(e) => {
                            // Pinch to zoom
                            if (e.touches.length === 2 && auditTouchDistRef.current) {
                              const dx = e.touches[0].clientX - e.touches[1].clientX;
                              const dy = e.touches[0].clientY - e.touches[1].clientY;
                              const dist = Math.hypot(dx, dy);
                              const factor = dist / auditTouchDistRef.current;
                              if (Math.abs(factor - 1) > 0.04) {
                                setAuditZoom((prev) =>
                                  Math.max(0.25, Math.min(3.5, Number((prev * (factor > 1 ? 1.05 : 0.95)).toFixed(2))))
                                );
                                auditTouchDistRef.current = dist;
                              }
                              return;
                            }
                            // Single finger pan
                            if (e.touches.length === 1 && isAuditDraggingRef.current) {
                              const svgEl = (e.currentTarget as SVGRectElement).ownerSVGElement;
                              const rect = svgEl?.getBoundingClientRect();
                              const screenColW = rect ? (rect.width * (cW / svgW)) / Math.max(1, auditCandles.length) : colW;
                              const screenChartH = rect ? rect.height * (cH / svgH) : cH;

                              const dx = e.touches[0].clientX - auditDragStartRef.current.x;
                              const dy = e.touches[0].clientY - auditDragStartRef.current.y;
                              const shift = Math.round(dx / Math.max(2, screenColW));
                              setAuditPan(Math.max(0, Math.min(auditMaxPan, auditDragStartRef.current.initialPan + shift)));
                              const pShift = dy * (effectiveRng / Math.max(1, screenChartH));
                              setAuditPricePan(auditDragStartRef.current.initialPricePan + pShift);
                            }
                          }}
                          onTouchEnd={() => {
                            isAuditDraggingRef.current = false;
                            setAuditDragging(false);
                            auditTouchDistRef.current = null;
                          }}
                        />
                      </svg>
                    );
                  })()}

                  {/* Floating On-Canvas Chart Controls HUD (Bottom-Right) */}
                  <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 p-1 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-xl text-xs font-mono select-none">
                    <button
                      onClick={() => handleAuditPanLeft(6)}
                      disabled={auditEffectivePan >= auditMaxPan}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
                      title="Pan Left / History (Arrow Left)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleAuditZoomOut}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center justify-center"
                      title="Zoom Out (- key or Wheel Down)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAuditPreset('100%')}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 font-bold text-[10.5px] border border-slate-800 transition min-w-[38px] text-center"
                      title="Click to reset zoom to 100%"
                    >
                      {Math.round(auditZoom * 100)}%
                    </button>
                    <button
                      onClick={handleAuditZoomIn}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center justify-center"
                      title="Zoom In (+ key or Wheel Up)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAuditPanRight(6)}
                      disabled={auditEffectivePan <= 0}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
                      title="Pan Right / Live (Arrow Right)"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
                    <button
                      onClick={() => handleAuditPreset('fit')}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-[10px] font-semibold transition"
                      title="Fit All 48 Bars"
                    >
                      Fit
                    </button>
                    {(auditZoom !== 1.0 || auditEffectivePan > 0 || auditPricePan !== 0) && (
                      <button
                        onClick={handleAuditResetView}
                        className="px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900 font-bold text-[10px] transition flex items-center gap-1 shadow-sm"
                        title="Reset View to Live (Home Key)"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* View Mode 2: Audit Table */}
            {(auditViewMode === 'table' || auditViewMode === 'split') && (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Time (UTC)</th>
                    <th className="py-2.5 px-3 text-right">Open ($)</th>
                    <th className="py-2.5 px-3 text-right">Close ($)</th>
                    <th className="py-2.5 px-3 text-right">Range ($)</th>
                    <th className="py-2.5 px-3 text-right">Range (%)</th>
                    <th className="py-2.5 px-3 text-right">Change ($)</th>
                    <th className="py-2.5 px-3 text-right">Volume</th>
                    <th className="py-2.5 px-3 text-right">Vol / 20-Avg</th>
                    <th className="py-2.5 px-3 text-right">Change (%)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessionCandles.map((c, idx) => {
                    // Latest bar check
                    const isLatest = sortOrder === 'newest' ? idx === 0 : idx === sessionCandles.length - 1;
                    const effectiveClose = isLatest && liveBar ? liveBar.close : isLatest ? activeLivePrice : c.close;
                    const effectiveHigh = isLatest && liveBar ? Math.max(c.high, liveBar.high, activeLivePrice) : isLatest ? Math.max(c.high, activeLivePrice) : c.high;
                    const effectiveLow = isLatest && liveBar && liveBar.low > 0 ? Math.min(c.low, liveBar.low, activeLivePrice) : isLatest ? Math.min(c.low, activeLivePrice) : c.low;
                    const effectiveOpen = isLatest && liveBar && liveBar.open > 0 ? liveBar.open : c.open;
                    const effectiveVolume = isLatest && liveBar && liveBar.volume > 0 ? Math.max(c.volume, liveBar.volume) : c.volume;

                    const range = effectiveHigh - effectiveLow;
                    const rangePerc = effectiveOpen > 0 ? (range / effectiveOpen) * 100 : 0;
                    const isGreen = effectiveClose >= effectiveOpen;
                    const changeVal = effectiveClose - effectiveOpen;
                    const changePerc = effectiveOpen > 0 ? (changeVal / effectiveOpen) * 100 : 0;

                    const barVol = effectiveVolume;
                    const volRatio = sessionStats.avg20Vol > 0 ? barVol / sessionStats.avg20Vol : 0;
                    const roundedRatio = parseFloat(volRatio.toFixed(1));
                    const volRatioStr = `${roundedRatio.toFixed(1)}X`;
                    const volRatioColor =
                      roundedRatio >= 1.3
                        ? 'text-emerald-400 font-bold'
                        : roundedRatio <= 0.7
                        ? 'text-rose-400 font-bold'
                        : 'text-white font-medium';

                    const isTickFlashUp = isLatest && priceDirection === 'up';
                    const isTickFlashDown = isLatest && priceDirection === 'down';

                    const dateObj = new Date(c.timestamp);
                    const utcStr = dateObj.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

                    return (
                      <tr
                        key={c.timestamp + '-' + idx}
                        className={`transition-colors duration-150 text-xs ${
                          isLatest
                            ? isTickFlashUp
                              ? 'bg-emerald-500/20 shadow-[inset_0_0_14px_rgba(16,185,129,0.3)] border-y border-emerald-500/40'
                              : isTickFlashDown
                              ? 'bg-rose-500/20 shadow-[inset_0_0_14px_rgba(244,63,94,0.3)] border-y border-rose-500/40'
                              : 'bg-cyan-500/10 font-medium'
                            : idx % 2 === 0
                            ? 'bg-slate-900/40'
                            : 'bg-slate-900'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-500 text-[11px] font-mono">
                          {sortOrder === 'newest' ? sessionCandles.length - idx : idx + 1}
                        </td>
                        <td className="py-2 px-3 text-slate-200 font-mono whitespace-nowrap">
                          {utcStr}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">
                          ${formatPrice(effectiveOpen)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-bold font-mono transition-colors duration-150 ${
                            isGreen ? 'text-emerald-400' : 'text-rose-400'
                          } ${
                            isTickFlashUp
                              ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                              : isTickFlashDown
                              ? 'text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]'
                              : ''
                          }`}
                        >
                          ${formatPrice(effectiveClose)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">
                          ${formatPrice(range)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-300/90 font-mono">
                          {rangePerc.toFixed(2)}%
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-medium ${
                            changeVal > 0
                              ? 'text-emerald-400'
                              : changeVal < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {changeVal > 0 ? '+' : changeVal < 0 ? '-' : ''}${formatPrice(Math.abs(changeVal))}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          <span className={isLatest ? 'text-cyan-300 font-semibold transition-all' : 'text-slate-200'}>
                            {effectiveVolume.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-mono ${volRatioColor}`}>
                          {volRatioStr}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              isGreen
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {changePerc >= 0 ? '+' : ''}
                            {changePerc.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isLatest ? (
                            <div className="flex flex-col items-center justify-center gap-0.5 mx-auto">
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] border border-cyan-500/40 flex items-center justify-center gap-1.5 w-fit shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                                  }`}
                                />
                                LIVE BAR
                              </span>
                              <span className="text-[9px] font-mono text-cyan-400/80">
                                Tick #{tickCount > 0 ? tickCount.toLocaleString() : '1'} • {countdown.formatted}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PRE-ANALYSIS MANDATES (1 THROUGH 6)              */}
      {/* ======================================================== */}
      {activeTab === 'mandates' && (
        <div className="space-y-6">

      {/* REQUIREMENT 1: LAST 10 DAILY CANDLES (OHLCV) */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
              1
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              Last 10 Daily Candles (OHLCV) & Daily Range
            </h3>
          </div>
          <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            10/10 Verified Daily Bars
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3 text-right">Open ($)</th>
                <th className="py-2 px-3 text-right">High ($)</th>
                <th className="py-2 px-3 text-right">Low ($)</th>
                <th className="py-2 px-3 text-right">Close ($)</th>
                <th className="py-2 px-3 text-right">Day Range ($)</th>
                <th className="py-2 px-3 text-right">Volume</th>
                <th className="py-2 px-3 text-right">Day VWAP ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {last10Candles.map((c, idx) => {
                const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
                const range = c.high - c.low;
                const isGreen = c.close >= c.open;
                const isLatest = idx === last10Candles.length - 1;

                return (
                  <tr
                    key={c.timestamp}
                    className={`hover:bg-slate-800/40 transition ${
                      isLatest ? 'bg-cyan-500/10 font-semibold' : idx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900'
                    }`}
                  >
                    <td className="py-2 px-3 text-slate-200">
                      {dateStr} {isLatest && <span className="text-cyan-400 text-[10px] ml-1">(Active)</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300 font-mono">
                      ${formatPrice(c.open)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-medium font-mono">
                      ${formatPrice(c.high)}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-400 font-medium font-mono">
                      ${formatPrice(c.low)}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold font-mono ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${formatPrice(isLatest ? activeLivePrice : c.close)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400 font-mono">
                      ${formatPrice(range)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300 font-mono">
                      {c.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-300 font-mono">
                      ${formatPrice(c.vwap || (c.high + c.low + c.close) / 3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* REQUIREMENT 2 & 3: PRIOR DAY'S OHLC+VWAP & PRE-MARKET VOLUME PACE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* REQUIREMENT 2: PRIOR DAY STATS */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
                2
              </span>
              <h3 className="text-sm font-semibold text-white font-sans">
                Prior Day OHLC + Prior Day VWAP
              </h3>
            </div>
            <span className="text-slate-400 text-[11px]">{priorDay.dateStr}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR OPEN:</span>
              <span className="text-slate-200 font-bold text-sm font-mono">
                ${formatPrice(priorDay.open)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR HIGH (PDH):</span>
              <span className="text-emerald-400 font-bold text-sm font-mono">
                ${formatPrice(priorDay.high)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR LOW (PDL):</span>
              <span className="text-rose-400 font-bold text-sm font-mono">
                ${formatPrice(priorDay.low)}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR CLOSE (PDC):</span>
              <span className="text-white font-bold text-sm font-mono">
                ${formatPrice(priorDay.close)}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded flex items-center justify-between">
            <div>
              <span className="text-amber-300 font-semibold text-xs block">PRIOR DAY VWAP:</span>
              <span className="text-[11px] text-slate-400">Volume-weighted typical price across prior 24h</span>
            </div>
            <span className="text-amber-300 font-bold text-base font-mono">
              ${formatPrice(priorDay.vwap)}
            </span>
          </div>
        </section>

        {/* REQUIREMENT 3: PRE-MARKET VS 20-DAY AVERAGE VOLUME */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
                3
              </span>
              <h3 className="text-sm font-semibold text-white font-sans">
                Pre-Market Price & Volume vs 20-Day Avg
              </h3>
            </div>
            <span className="text-cyan-300 font-bold">
              {preMarket.volumeRatio20d}x Pace
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-cyan-500/30">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                Live Asset Price:
              </span>
              <span
                className={`font-bold text-sm font-mono transition-colors duration-200 ${
                  priceDirection === 'up'
                    ? 'text-emerald-300'
                    : priceDirection === 'down'
                    ? 'text-rose-300'
                    : 'text-white'
                }`}
              >
                ${formatPrice(activeLivePrice)}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">24-Hour Rolling Volume:</span>
              <span className="text-slate-200 font-medium">
                {preMarket.volume24h.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol.split('-')[0]}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">20-Day Average Daily Volume:</span>
              <span className="text-slate-200 font-medium">
                {preMarket.avgVolume20d.toLocaleString(undefined, { maximumFractionDigits: 2 })} {symbol.split('-')[0]}
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Volume Relative Pace:</span>
                <span className={preMarket.volumeRatio20d >= 1.0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {preMarket.volumeRatio20d >= 1.0 ? 'Above Average Expansion' : 'Compressed Activity'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${preMarket.volumeRatio20d >= 1.0 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, preMarket.volumeRatio20d * 60)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* REQUIREMENT 4: OVERNIGHT / GLOBEX HIGH-LOW */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
              4
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              Overnight / Globex & Asian Session Range
            </h3>
          </div>
          <span className="text-slate-400 text-xs">Prior 12 Hours Liquidity Corridor</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px] block">OVERNIGHT HIGH (ONH):</span>
            <span className="text-emerald-400 font-bold text-base font-mono">
              ${formatPrice(preMarket.overnightHigh)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Top of liquidity sweep buffer</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px] block">OVERNIGHT LOW (ONL):</span>
            <span className="text-rose-400 font-bold text-base font-mono">
              ${formatPrice(preMarket.overnightLow)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Base of overnight order flow</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px] block">OVERNIGHT SPREAD / RANGE:</span>
            <span className="text-cyan-300 font-bold text-base font-mono">
              ${formatPrice(preMarket.overnightHigh - preMarket.overnightLow)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {preMarket.currentPrice > 0
                ? (((preMarket.overnightHigh - preMarket.overnightLow) / preMarket.currentPrice) * 100).toFixed(2)
                : '0.00'}
              % of asset price
            </span>
          </div>
        </div>
      </section>

      {/* REQUIREMENT 5: SCHEDULED CATALYSTS TODAY */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
              5
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              Session Catalysts & Liquidity Windows
            </h3>
          </div>
          <span className="text-slate-400 text-xs">
            Calendar-Verified Windows & Intraday Liquidity Cuts
          </span>
        </div>

        <div className="space-y-2.5">
          {catalysts.map((cat) => (
            <div
              key={cat.id}
              className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase shrink-0 border ${
                    cat.impact === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {cat.impact} IMPACT
                </div>
                <div>
                  <div className="text-slate-100 font-semibold text-xs flex items-center gap-2">
                    <span>{cat.event}</span>
                    <span className="text-slate-400 font-normal">({cat.category})</span>
                    {cat.sourceType === 'RECURRING_AUCTION' && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-cyan-300 border border-slate-700">
                        Recurring Auction
                      </span>
                    )}
                    {cat.sourceType === 'CUSTOM_DESK' && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Custom Desk Entry
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">{cat.notes}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right shrink-0">
                {cat.consensus && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">CONSENSUS / MECHANISM</span>
                    <span className="text-slate-200">{cat.consensus}</span>
                  </div>
                )}
                <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold">
                  {cat.timeUTC} <span className="text-slate-400 font-normal">({cat.timeEST})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REQUIREMENT 6: OPTIONS MARKET DATA (PUT/CALL SKEW, GAMMA, MAX PAIN) */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold border border-cyan-500/40">
              6
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">
              Derivatives & Options Volatility (Deribit Live Greeks / Gamma Clusters)
            </h3>
          </div>
          {options.isAvailable ? (
            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {options.sourceVenue || 'Deribit Order Book Live'}
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1 text-[11px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              EXPLICITLY FLAGGED UNAVAILABLE
            </span>
          )}
        </div>

        {options.isAvailable ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">NEAREST EXPIRY:</span>
                <span className="text-white font-bold text-xs">{options.nearestExpiry || 'Upcoming Weekly'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">ATM IMPLIED VOL (IV):</span>
                <span className="text-cyan-300 font-bold text-xs">
                  {options.atmIV ? `${options.atmIV}%` : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">30D REALIZED VOL (HV):</span>
                <span className="text-slate-200 font-bold text-xs">
                  {options.realizedVol30d ? `${options.realizedVol30d}%` : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">MAX PAIN STRIKE:</span>
                <span className="text-amber-300 font-bold text-xs font-mono">
                  {options.maxPainStrike ? `$${formatPrice(options.maxPainStrike)}` : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">PUT / CALL OI RATIO:</span>
                <span className="text-cyan-300 font-bold text-xs">
                  {options.putCallOIRatio ?? 'N/A'}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">25-DELTA SKEW:</span>
                <span className={`font-bold text-xs ${options.skew25d !== undefined && options.skew25d > 0 ? 'text-amber-300' : 'text-cyan-300'}`}>
                  {options.skew25d !== undefined
                    ? `${options.skew25d > 0 ? '+' : ''}${options.skew25d}% (Put Prem)`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Gamma Exposure Clusters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-emerald-400 font-semibold block mb-2 text-xs">
                  Major Call Open Interest Clusters (Ceiling Pin):
                </span>
                {options.gammaClusterCalls.length > 0 ? (
                  <div className="space-y-1.5">
                    {options.gammaClusterCalls.map((c, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-mono">${c.strike.toLocaleString()} Strike</span>
                        <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {c.oi.toLocaleString()} Contracts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs italic">No call gamma clusters registered.</div>
                )}
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-rose-400 font-semibold block mb-2 text-xs">
                  Major Put Open Interest Clusters (Floor Pin):
                </span>
                {options.gammaClusterPuts.length > 0 ? (
                  <div className="space-y-1.5">
                    {options.gammaClusterPuts.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-mono">${p.strike.toLocaleString()} Strike</span>
                        <span className="text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          {p.oi.toLocaleString()} Contracts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs italic">No put gamma clusters registered.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Options Data Not Available for {symbol} ({options.sourceVenue || 'Unlisted'})</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              {options.unavailableReason || 'Centralized institutional options market is not active or listed for this asset on Deribit or CME.'} Desk protocol strictly forbids fabricating simulated options numbers; traders must base volatility adjustments purely on the 14-period ATR (${atr.atr14Daily.toLocaleString()}) and spot volume profile.
            </p>
          </div>
        )}
      </section>
        </div>
      )}
    </div>
  );
};
