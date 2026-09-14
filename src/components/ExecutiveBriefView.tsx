import React from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileText,
  Layers,
  Percent,
  Scale,
  ShieldAlert,
  Sliders,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { KeyLevelItem, PreMarketBrief, TradeSetup } from '../types';

interface ExecutiveBriefViewProps {
  brief: PreMarketBrief;
}

export const ExecutiveBriefView: React.FC<ExecutiveBriefViewProps> = ({ brief }) => {
  const {
    symbol,
    session,
    date,
    timestamp,
    dataSource,
    isStale,
    stalenessNotes,
    currentPrice,
    summaryBias,
    summaryBiasType,
    keyLevels,
    tradeSetups,
    riskNotes,
    marketStructure,
    atr,
    pivots,
    volumeProfile,
    priorDay,
  } = brief;

  const biasBadgeColor =
    summaryBiasType === 'BULLISH'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : summaryBiasType === 'BEARISH'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/30';

  const biasIcon =
    summaryBiasType === 'BULLISH' ? (
      <TrendingUp className="w-4 h-4 text-emerald-400" />
    ) : summaryBiasType === 'BEARISH' ? (
      <TrendingDown className="w-4 h-4 text-rose-400" />
    ) : (
      <Compass className="w-4 h-4 text-amber-400" />
    );

  const getCategoryBadge = (category: KeyLevelItem['category']) => {
    switch (category) {
      case 'PIVOT':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'PROFILE':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'VWAP':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'PRIOR_DAY':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'MA':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
      case 'FIB':
        return 'bg-pink-500/10 text-pink-300 border-pink-500/30';
      case 'GAP':
        return 'bg-orange-500/10 text-orange-300 border-orange-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Institutional Metadata Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold text-white tracking-tight">
                {symbol}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                Session: {session}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                Date: {date}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-2">
              <span>Source: {dataSource}</span>
              <span>•</span>
              <span>Timestamp: {new Date(timestamp).toUTCString()}</span>
              {isStale && (
                <span className="text-amber-400 font-semibold">
                  (FLAGGED: {stalenessNotes})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase font-mono tracking-wider">
                Current Pre-Market Price
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Market Structure Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs font-mono">
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 block text-[11px] mb-1">HIGHER-TIMEFRAME TREND:</span>
            <span className={`font-semibold ${marketStructure.higherTimeframeTrend === 'BULLISH' ? 'text-emerald-400' : marketStructure.higherTimeframeTrend === 'BEARISH' ? 'text-rose-400' : 'text-slate-300'}`}>
              {marketStructure.higherTimeframeTrend}
            </span>
            <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{marketStructure.higherTimeframeDetail}</p>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 block text-[11px] mb-1">INTRADAY TREND:</span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${marketStructure.intradayTrend === 'BULLISH' ? 'text-emerald-400' : marketStructure.intradayTrend === 'BEARISH' ? 'text-rose-400' : 'text-slate-300'}`}>
                {marketStructure.intradayTrend}
              </span>
              {marketStructure.trendConflict && (
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px]">
                  CONFLICT
                </span>
              )}
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{marketStructure.intradayDetail}</p>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
            <span className="text-slate-400 block text-[11px] mb-1">DOMINANT REGIME:</span>
            <span className="text-cyan-300 font-semibold">
              {marketStructure.dominantRegime}
            </span>
            <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{marketStructure.relativeStrengthDetail}</p>
          </div>
        </div>
      </div>

      {/* SECTION 1: ONE-PARAGRAPH SUMMARY BIAS */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              SECTION 1
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight">
              One-Paragraph Summary Bias
            </h2>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-semibold ${biasBadgeColor}`}>
            {biasIcon}
            <span>{summaryBiasType} BIAS</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/80">
          <p className="text-slate-200 leading-relaxed text-sm md:text-base font-sans">
            {summaryBias}
          </p>
        </div>
      </section>

      {/* SECTION 2: KEY LEVELS TABLE */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              SECTION 2
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Key Levels Table
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {keyLevels.length} Computed & Labeled Levels
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4">Level Name</th>
                <th className="py-2.5 px-4 text-right">Computed Price ($)</th>
                <th className="py-2.5 px-4 text-center">Distance vs Spot</th>
                <th className="py-2.5 px-4">Method / Inputs Used</th>
                <th className="py-2.5 px-4 text-center">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {keyLevels.map((lvl, idx) => {
                const diff = lvl.price - currentPrice;
                const diffPerc = ((diff / currentPrice) * 100).toFixed(2);
                const isCurrent = Math.abs(diff) < currentPrice * 0.001;

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/40 transition ${
                      isCurrent ? 'bg-cyan-500/10 font-semibold' : idx % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-200 flex items-center gap-2">
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                      <span>{lvl.name}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-white">
                      ${lvl.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          diff > 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : diff < 0
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-cyan-300 bg-cyan-500/20'
                        }`}
                      >
                        {diff > 0 ? `+${diffPerc}%` : `${diffPerc}%`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{lvl.method}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getCategoryBadge(
                          lvl.category
                        )}`}
                      >
                        {lvl.category}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: TRADE SETUPS TABLE */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              SECTION 3
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Trade Setups Table (Intraday Action Plan)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {tradeSetups.length} Setups • Strict Computed Level References
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 min-w-[150px]">Setup</th>
                <th className="py-3 px-3 min-w-[200px]">Trigger / Entry</th>
                <th className="py-3 px-3 min-w-[200px]">Invalidation (Stop)</th>
                <th className="py-3 px-3 min-w-[140px]">Target 1</th>
                <th className="py-3 px-3 min-w-[140px]">Target 2</th>
                <th className="py-3 px-3 text-center min-w-[90px]">R:R</th>
                <th className="py-3 px-3 min-w-[220px]">Volume / Confirmation Needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {tradeSetups.map((setup, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  {/* Setup */}
                  <td className="py-3 px-3 font-semibold text-slate-100 align-top">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          setup.direction === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {setup.direction}
                      </span>
                    </div>
                    <span>{setup.setup}</span>
                  </td>

                  {/* Trigger/Entry */}
                  <td className="py-3 px-3 text-slate-300 align-top leading-relaxed">
                    {setup.triggerEntry}
                  </td>

                  {/* Invalidation (Stop) */}
                  <td className="py-3 px-3 text-rose-300/90 align-top leading-relaxed bg-rose-950/10">
                    <div className="flex items-start gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{setup.invalidationStop}</span>
                    </div>
                  </td>

                  {/* Target 1 */}
                  <td className="py-3 px-3 text-emerald-300/90 font-medium align-top">
                    {setup.target1}
                  </td>

                  {/* Target 2 */}
                  <td className="py-3 px-3 text-cyan-300/90 font-medium align-top">
                    {setup.target2}
                  </td>

                  {/* R:R */}
                  <td className="py-3 px-3 text-center font-bold text-white align-top bg-slate-950/50">
                    <span className="px-2 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700 block whitespace-nowrap">
                      {setup.riskReward}
                    </span>
                  </td>

                  {/* Volume/Confirmation */}
                  <td className="py-3 px-3 text-slate-300 align-top leading-relaxed">
                    {setup.volumeConfirmation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 4: RISK NOTES */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
              SECTION 4
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Risk Notes (Catalysts, Sizing & Volatility Regime)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {riskNotes.length} Items (Max 5 Mandate)
          </span>
        </div>

        <ul className="space-y-3 font-mono text-xs md:text-sm">
          {riskNotes.map((note, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-slate-300 leading-relaxed hover:border-slate-700 transition"
            >
              <div className="w-5 h-5 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold shrink-0 mt-0.5 text-xs">
                {idx + 1}
              </div>
              <div>{note}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Mandatory Institutional Planning Disclaimer */}
      <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500 font-mono text-center">
        <p className="font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Trading Desk Notice & Constraints
        </p>
        <p>
          This is analysis for planning purposes only, not a recommendation to buy or sell. Intraday execution should be conducted strictly according to firm risk limits, capital allocation parameters, and explicit invalidation criteria.
        </p>
      </div>
    </div>
  );
};
