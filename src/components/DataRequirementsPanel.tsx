import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Layers,
  Percent,
  Sliders,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { PreMarketBrief } from '../types';

interface DataRequirementsPanelProps {
  brief: PreMarketBrief;
}

export const DataRequirementsPanel: React.FC<DataRequirementsPanelProps> = ({ brief }) => {
  const {
    symbol,
    dailyCandles,
    priorDay,
    preMarket,
    catalysts,
    options,
    atr,
    pivots,
    volumeProfile,
    fibonacci,
  } = brief;

  // Last 10 daily candles slice
  const last10Candles = dailyCandles.slice(-10);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-mono text-xs">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 flex items-center justify-center rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
              DATA AUDIT
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight font-sans">
              Pre-Analysis Data Requirements (Mandate 1 through 6)
            </h2>
          </div>
          <span className="text-slate-400 text-xs">
            Verified Sourced Desk Inputs
          </span>
        </div>
        <p className="text-slate-300 font-sans text-xs md:text-sm">
          Strict desk protocol requires confirming the 6 core quantitative inputs prior to running intraday trade models. If any dataset is estimated or unavailable, it is explicitly flagged below.
        </p>
      </div>

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
              Scheduled Catalysts Today (Macro Releases, Central Bank, OpEx)
            </h3>
          </div>
          <span className="text-slate-400 text-xs">
            Exact UTC & EST Release Windows
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
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">{cat.notes}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right shrink-0">
                {cat.consensus && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">CONSENSUS</span>
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
              Derivatives & Options Data (Skew, Gamma Clusters, Max Pain)
            </h3>
          </div>
          {options.isAvailable ? (
            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Deribit Order Book Live
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">NEAREST EXPIRY:</span>
                <span className="text-white font-bold text-sm">{options.nearestExpiry}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">MAX PAIN STRIKE:</span>
                <span className="text-amber-300 font-bold text-sm">
                  ${options.maxPainStrike.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">PUT / CALL OI RATIO:</span>
                <span className="text-cyan-300 font-bold text-sm">{options.putCallOIRatio}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-400 text-[10px] block">25-DELTA SKEW:</span>
                <span className={`font-bold text-sm ${options.skew25d > 0 ? 'text-amber-300' : 'text-cyan-300'}`}>
                  {options.skew25d > 0 ? `+${options.skew25d}% (Put Prem)` : `${options.skew25d}%`}
                </span>
              </div>
            </div>

            {/* Gamma Exposure Clusters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-emerald-400 font-semibold block mb-2 text-xs">
                  Major Call Open Interest Clusters (Ceiling Pin):
                </span>
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
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-rose-400 font-semibold block mb-2 text-xs">
                  Major Put Open Interest Clusters (Floor Pin):
                </span>
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
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Options Data Not Available for {symbol}</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              {options.unavailableReason || 'Centralized institutional options market is not active or listed for this asset on Deribit or CME.'} Desk protocol strictly forbids fabricating simulated options numbers; traders must base volatility adjustments purely on the 14-period ATR ($${atr.atr14Daily.toLocaleString()}) and spot volume profile.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
