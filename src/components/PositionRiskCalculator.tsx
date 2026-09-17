import React, { useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  DollarSign,
  Layers,
  Percent,
  Scale,
  ShieldAlert,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { PreMarketBrief, TradeSetup } from '../types';

interface PositionRiskCalculatorProps {
  brief: PreMarketBrief;
}

export const PositionRiskCalculator: React.FC<PositionRiskCalculatorProps> = ({ brief }) => {
  const { symbol, currentPrice, atr, tradeSetups } = brief;

  const [accountSize, setAccountSize] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [selectedSetupIdx, setSelectedSetupIdx] = useState<number>(0);
  const [atrMultiplier, setAtrMultiplier] = useState<number>(1.25);

  const activeSetup = tradeSetups[selectedSetupIdx] || tradeSetups[0];

  // Entry & stop references from setup
  const entryPrice = activeSetup.entryPriceRef || currentPrice;
  const isLong = activeSetup.direction === 'LONG';

  // ATR-based stop buffer
  const calculatedStopBuffer = (atr.atr14Hourly || currentPrice * 0.01) * atrMultiplier;
  const stopPrice = activeSetup.stopPriceRef || (isLong ? entryPrice - calculatedStopBuffer : entryPrice + calculatedStopBuffer);
  const target1Price = activeSetup.target1PriceRef;
  const target2Price = activeSetup.target2PriceRef;

  // Stop distance
  const stopDistance = Math.abs(entryPrice - stopPrice);
  const stopDistancePercent = entryPrice > 0 ? (stopDistance / entryPrice) * 100 : 1;

  // Maximum dollar risk
  const maxDollarRisk = (accountSize * riskPercent) / 100;

  // Recommended volatility sizing factor
  const volatilityFactor =
    atr.volatilityRegime === 'EXTREME'
      ? 0.5
      : atr.volatilityRegime === 'EXPANDED'
      ? 0.65
      : atr.volatilityRegime === 'COMPRESSED'
      ? 1.15
      : 1.0;

  const adjustedDollarRisk = maxDollarRisk * volatilityFactor;

  // Position size in units / contracts
  const positionUnits = stopDistance > 0 ? adjustedDollarRisk / stopDistance : 0;
  const positionNotional = positionUnits * entryPrice;

  // Potential rewards
  const target1Distance = Math.abs(target1Price - entryPrice);
  const target1Profit = positionUnits * target1Distance;
  const target1RR = stopDistance > 0 ? (target1Distance / stopDistance).toFixed(2) : '2.00';

  const target2Distance = Math.abs(target2Price - entryPrice);
  const target2Profit = positionUnits * target2Distance;
  const target2RR = stopDistance > 0 ? (target2Distance / stopDistance).toFixed(2) : '3.50';

  return (
    <div className="space-y-6 w-full pb-12 font-mono text-xs">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 flex items-center justify-center rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
              ATR STOP SIZING
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight font-sans">
              Intraday Stop-Sizing & Position Risk Calculator
            </h2>
          </div>
          <span className="text-slate-400">
            Mandate: Size Stops by 14-Period ATR
          </span>
        </div>
        <p className="text-slate-300 font-sans text-xs md:text-sm">
          Desk risk guidelines require sizing position invalidations mathematically via the 14-period execution ATR rather than arbitrary round percentage stops.
        </p>
      </div>

      {/* Volatility Regime & ATR Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-400 text-[10px] block">1H EXECUTION ATR (14-P):</span>
          <span className="text-cyan-300 font-bold text-base">
            ${atr.atr14Hourly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Execution timeframe volatility</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-400 text-[10px] block">DAILY ATR (14-P):</span>
          <span className="text-white font-bold text-base">
            ${atr.atr14Daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Daily range expectation</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-400 text-[10px] block">20-DAY ATR RATIO:</span>
          <span className="text-amber-300 font-bold text-base">{atr.atrRatioTo20d}x</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Ratio vs 20-day historical ATR</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-slate-400 text-[10px] block">VOLATILITY REGIME:</span>
          <span
            className={`font-bold text-base ${
              atr.volatilityRegime === 'COMPRESSED'
                ? 'text-cyan-300'
                : atr.volatilityRegime === 'NORMAL'
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {atr.volatilityRegime}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Sizing adjustment: {Math.round(volatilityFactor * 100)}%
          </span>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Inputs & Setup Selector (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-white font-sans border-b border-slate-800 pb-2">
            Order Plan Parameters
          </h3>

          {/* Select Setup */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold">
              SELECT PRE-MARKET TRADE SETUP:
            </label>
            <div className="space-y-1.5">
              {tradeSetups.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSetupIdx(idx)}
                  className={`w-full text-left p-2.5 rounded border transition flex items-center justify-between text-xs ${
                    selectedSetupIdx === idx
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="font-bold text-white block truncate">{s.setup.split(':')[0]}</span>
                    <span className="text-[11px] opacity-80 truncate block">{s.setup.split(':')[1]}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      s.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {s.direction}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Account Size */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold">
              TRADING DESK CAPITAL / ACCOUNT EQUITY ($):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500">$</span>
              <input
                type="number"
                value={accountSize}
                onChange={(e) => setAccountSize(Math.max(1000, Number(e.target.value)))}
                step="10000"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 pl-7 text-white font-bold focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Risk Percentage */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold flex justify-between">
              <span>RISK PER TRADE (%):</span>
              <span className="text-cyan-300 font-bold">${maxDollarRisk.toLocaleString()} Max Risk</span>
            </label>
            <div className="flex items-center space-x-2">
              {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRiskPercent(pct)}
                  className={`flex-1 py-1.5 rounded border text-xs font-bold transition ${
                    riskPercent === pct
                      ? 'bg-cyan-600 text-white border-cyan-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* ATR Stop Buffer Multiplier */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-semibold flex justify-between">
              <span>ATR STOP BUFFER MULTIPLIER:</span>
              <span className="text-amber-300 font-bold">±${calculatedStopBuffer.toFixed(2)} Buffer</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1.0, 1.25, 1.5, 2.0].map((mult) => (
                <button
                  key={mult}
                  onClick={() => setAtrMultiplier(mult)}
                  className={`py-1.5 rounded border text-xs font-bold transition ${
                    atrMultiplier === mult
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {mult}x ATR
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Output: Execution Sizing Card (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-white font-sans">
              Computed Desk Order Sizing Output
            </h3>
            <span className="text-emerald-400 text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Formula Grounded
            </span>
          </div>

          {/* Key Pricing Rows */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-400 text-[10px] block">ENTRY LEVEL:</span>
              <span className="text-white font-bold text-sm">
                ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">INVALIDATION STOP:</span>
              <span className="text-rose-400 font-bold text-sm">
                ${stopPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">STOP DISTANCE:</span>
              <span className="text-amber-300 font-bold text-sm">
                ${stopDistance.toFixed(2)} ({stopDistancePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Sizing Recommendations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg">
              <span className="text-cyan-400 text-[10px] block uppercase font-bold">
                Max Allowed Units / Contracts:
              </span>
              <span className="text-white font-bold text-xl block mt-1">
                {positionUnits.toFixed(4)} {symbol.split('-')[0]}
              </span>
              <span className="text-slate-400 text-[10px] block mt-0.5">
                Exact contract count for ${adjustedDollarRisk.toLocaleString()} risk
              </span>
            </div>

            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg">
              <span className="text-cyan-400 text-[10px] block uppercase font-bold">
                Total Notional Position Value:
              </span>
              <span className="text-white font-bold text-xl block mt-1">
                ${positionNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-slate-400 text-[10px] block mt-0.5">
                Leverage: {(positionNotional / accountSize).toFixed(2)}x Account Equity
              </span>
            </div>
          </div>

          {/* Profit & Loss Matrix */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-slate-400 text-[11px] block font-semibold">
              TARGET PROJECTION & REALIZED R:R:
            </span>

            <div className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-emerald-400 font-bold block">
                  Target 1: ${target1Price.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">
                  Spread: +${target1Distance.toFixed(2)} from Entry
                </span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-sm block">
                  +${target1Profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  1:{target1RR} Risk/Reward
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-cyan-300 font-bold block">
                  Target 2: ${target2Price.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">
                  Spread: +${target2Distance.toFixed(2)} from Entry
                </span>
              </div>
              <div className="text-right">
                <span className="text-cyan-300 font-bold text-sm block">
                  +${target2Profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  1:{target2RR} Risk/Reward
                </span>
              </div>
            </div>
          </div>

          {/* Invalidation condition notice */}
          <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg text-rose-300 flex items-start gap-2 text-[11px]">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">EXECUTION INVALIDATION MANDATE:</span>
              <span>{activeSetup.invalidationStop}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
