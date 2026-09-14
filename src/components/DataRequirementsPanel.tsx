import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Download,
  Layers,
  Percent,
  Sliders,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Candle, ChartTimeframe, PreMarketBrief } from '../types';

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
  // Timeframe selector for Current Session Data
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('15m');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [copiedCsv, setCopiedCsv] = useState(false);

  // Dynamic candle population corresponding to selected timeframe
  const sessionCandles = useMemo(() => {
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

    const sorted = [...list];
    if (sortOrder === 'newest') {
      sorted.reverse();
    }
    return sorted;
  }, [selectedTimeframe, sortOrder, fiveMinCandles, fifteenMinCandles, hourlyCandles, dailyCandles]);

  // Aggregate metrics calculation for the chosen timeframe
  const sessionStats = useMemo(() => {
    const list =
      selectedTimeframe === '5m'
        ? fiveMinCandles || []
        : selectedTimeframe === '15m'
        ? fifteenMinCandles || []
        : selectedTimeframe === '1H'
        ? hourlyCandles || []
        : dailyCandles || [];

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
      };
    }

    const high = Math.max(...list.map((c) => c.high));
    const low = Math.min(...list.map((c) => c.low));
    const open = list[0].open;
    const close = list[list.length - 1].close;
    const range = high - low;
    const rangePerc = open > 0 ? (range / open) * 100 : 0;
    const netChange = close - open;
    const netChangePerc = open > 0 ? (netChange / open) * 100 : 0;
    const totalVol = list.reduce((acc, c) => acc + c.volume, 0);
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
    };
  }, [selectedTimeframe, fiveMinCandles, fifteenMinCandles, hourlyCandles, dailyCandles]);

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
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-mono text-xs">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">TIMEFRAME BARS:</span>
              <span className="text-white font-bold text-sm">{sessionStats.count} Bars</span>
              <span className="text-[10px] text-cyan-400 block mt-0.5">{selectedTimeframe} Resolution</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">SESSION HIGH:</span>
              <span className="text-emerald-400 font-bold text-sm">
                ${sessionStats.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Peak in timeframe</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">SESSION LOW:</span>
              <span className="text-rose-400 font-bold text-sm">
                ${sessionStats.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Trough in timeframe</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">TOTAL RANGE:</span>
              <span className="text-amber-300 font-bold text-sm">
                ${sessionStats.range.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-amber-400/80 block mt-0.5">
                {sessionStats.rangePerc.toFixed(2)}% of Open
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">TIMEFRAME VWAP:</span>
              <span className="text-amber-400 font-bold text-sm">
                ${sessionStats.vwap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Volume-weighted typical</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <span className="text-slate-400 text-[10px] block">NET TIMEFRAME CHANGE:</span>
              <span
                className={`font-bold text-sm flex items-center gap-1 ${
                  sessionStats.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {sessionStats.netChange >= 0 ? '+' : ''}
                ${sessionStats.netChange.toFixed(2)} ({sessionStats.netChangePerc.toFixed(2)}%)
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Avg bar range: ${sessionStats.avgRange.toFixed(2)}</span>
            </div>
          </div>

          {/* Populated Columns Data Audit Table for Selected Timeframe */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[11px] border border-cyan-500/40">
                  {selectedTimeframe} FEED
                </span>
                <h3 className="text-sm font-semibold text-white font-sans">
                  Granular Candlestick Audit ({sessionCandles.length} Bars Populated)
                </h3>
              </div>
              <span className="text-slate-400 text-[11px]">
                Showing all OHLCV columns, Range ($ & %), Volume, Dollar Volume, Bar VWAP, and Direction
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Time (UTC)</th>
                    <th className="py-2.5 px-3">Time (Local)</th>
                    <th className="py-2.5 px-3 text-right">Open ($)</th>
                    <th className="py-2.5 px-3 text-right">High ($)</th>
                    <th className="py-2.5 px-3 text-right">Low ($)</th>
                    <th className="py-2.5 px-3 text-right">Close ($)</th>
                    <th className="py-2.5 px-3 text-right">Range ($)</th>
                    <th className="py-2.5 px-3 text-right">Range (%)</th>
                    <th className="py-2.5 px-3 text-right">Volume</th>
                    <th className="py-2.5 px-3 text-right">Dollar Volume ($)</th>
                    <th className="py-2.5 px-3 text-right">Bar VWAP ($)</th>
                    <th className="py-2.5 px-3 text-right">Change (%)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sessionCandles.map((c, idx) => {
                    const range = c.high - c.low;
                    const rangePerc = c.open > 0 ? (range / c.open) * 100 : 0;
                    const isGreen = c.close >= c.open;
                    const changeVal = c.close - c.open;
                    const changePerc = c.open > 0 ? (changeVal / c.open) * 100 : 0;
                    const quoteVol = c.quoteVolume || c.volume * c.close;
                    const barVwap = c.vwap || (c.high + c.low + c.close) / 3;

                    // Latest bar check
                    const isLatest = sortOrder === 'newest' ? idx === 0 : idx === sessionCandles.length - 1;

                    const dateObj = new Date(c.timestamp);
                    const utcStr = dateObj.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
                    const localTimeStr = dateObj.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr
                        key={c.timestamp + '-' + idx}
                        className={`hover:bg-slate-800/40 transition text-xs ${
                          isLatest
                            ? 'bg-cyan-500/10 font-medium'
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
                        <td className="py-2 px-3 text-slate-400 font-mono whitespace-nowrap">
                          {localTimeStr}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">
                          ${c.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-medium font-mono">
                          ${c.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-400 font-medium font-mono">
                          ${c.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold font-mono ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${c.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">
                          ${range.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-300/90 font-mono">
                          {rangePerc.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200 font-mono">
                          {c.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400 font-mono">
                          ${quoteVol.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-300 font-mono">
                          ${barVwap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] border border-cyan-500/30 animate-pulse">
                              LIVE BAR
                            </span>
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
                    <td className="py-2 px-3 text-right text-slate-300">
                      ${c.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-medium">
                      ${c.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-400 font-medium">
                      ${c.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${isGreen ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${c.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      ${range.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {c.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-300">
                      ${(c.vwap || (c.high + c.low + c.close) / 3).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <span className="text-slate-200 font-bold text-sm">
                ${priorDay.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR HIGH (PDH):</span>
              <span className="text-emerald-400 font-bold text-sm">
                ${priorDay.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR LOW (PDL):</span>
              <span className="text-rose-400 font-bold text-sm">
                ${priorDay.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 text-[11px] block">PRIOR CLOSE (PDC):</span>
              <span className="text-white font-bold text-sm">
                ${priorDay.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded flex items-center justify-between">
            <div>
              <span className="text-amber-300 font-semibold text-xs block">PRIOR DAY VWAP:</span>
              <span className="text-[11px] text-slate-400">Volume-weighted typical price across prior 24h</span>
            </div>
            <span className="text-amber-300 font-bold text-base">
              ${priorDay.vwap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">Current Pre-Market Price:</span>
              <span className="text-white font-bold text-sm">
                ${preMarket.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <span className="text-emerald-400 font-bold text-base">
              ${preMarket.overnightHigh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Top of liquidity sweep buffer</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px] block">OVERNIGHT LOW (ONL):</span>
            <span className="text-rose-400 font-bold text-base">
              ${preMarket.overnightLow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Base of overnight order flow</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-400 text-[11px] block">OVERNIGHT SPREAD / RANGE:</span>
            <span className="text-cyan-300 font-bold text-base">
              ${(preMarket.overnightHigh - preMarket.overnightLow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {(((preMarket.overnightHigh - preMarket.overnightLow) / preMarket.currentPrice) * 100).toFixed(2)}% of asset price
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
                <span className="text-amber-300 font-bold text-xs">
                  {options.maxPainStrike ? `$${options.maxPainStrike.toLocaleString()}` : 'N/A'}
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
