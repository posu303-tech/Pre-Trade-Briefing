import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Compass,
  DollarSign,
  Layers,
  Percent,
  Scale,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { KeyLevelItem, PreMarketBrief, TradeSetup } from '../types';

interface ActionDeckSidebarProps {
  brief: PreMarketBrief;
}

export const ActionDeckSidebar: React.FC<ActionDeckSidebarProps> = ({ brief }) => {
  const {
    symbol,
    currentPrice,
    tradeSetups,
    keyLevels,
    riskNotes,
    catalysts,
    atr,
    marketStructure,
  } = brief;

  // Deck Sub-tabs: 'setups' | 'levels' | 'sizer' | 'risk'
  const [activeDeckTab, setActiveDeckTab] = useState<'setups' | 'levels' | 'sizer' | 'risk'>('setups');
  const [selectedSetupIdx, setSelectedSetupIdx] = useState<number>(0);

  // Position Sizer State
  const [accountSize, setAccountSize] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [atrMultiplier, setAtrMultiplier] = useState<number>(1.25);

  const activeSetup: TradeSetup = tradeSetups[selectedSetupIdx] || tradeSetups[0];
  const isLong = activeSetup.direction === 'LONG';
  const entryPrice = activeSetup.entryPriceRef || currentPrice;
  const calculatedStopBuffer = (atr.atr14Hourly || currentPrice * 0.01) * atrMultiplier;
  const stopPrice =
    activeSetup.stopPriceRef ||
    (isLong ? entryPrice - calculatedStopBuffer : entryPrice + calculatedStopBuffer);
  const target1Price = activeSetup.target1PriceRef;
  const target2Price = activeSetup.target2PriceRef;

  const stopDistance = Math.abs(entryPrice - stopPrice);
  const maxDollarRisk = (accountSize * riskPercent) / 100;
  const volatilityFactor =
    atr.volatilityRegime === 'EXTREME'
      ? 0.5
      : atr.volatilityRegime === 'EXPANDED'
      ? 0.65
      : atr.volatilityRegime === 'COMPRESSED'
      ? 1.15
      : 1.0;
  const adjustedDollarRisk = maxDollarRisk * volatilityFactor;
  const positionUnits = stopDistance > 0 ? adjustedDollarRisk / stopDistance : 0;
  const positionNotional = positionUnits * entryPrice;

  const handleSendToSizer = (idx: number) => {
    setSelectedSetupIdx(idx);
    setActiveDeckTab('sizer');
  };

  const getCategoryBadge = (category: KeyLevelItem['category']) => {
    switch (category) {
      case 'PIVOT':
        return 'text-purple-300 bg-purple-500/10 border-purple-500/30';
      case 'PROFILE':
        return 'text-blue-300 bg-blue-500/10 border-blue-500/30';
      case 'VWAP':
        return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
      case 'PRIOR_DAY':
        return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30';
      case 'MA':
        return 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30';
      case 'FIB':
        return 'text-pink-300 bg-pink-500/10 border-pink-500/30';
      case 'GAP':
        return 'text-orange-300 bg-orange-500/10 border-orange-500/30';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full shadow-sm overflow-hidden">
      {/* Action Deck Header Tabs */}
      <div className="flex items-center justify-between bg-slate-950 px-2.5 py-2 border-b border-slate-800">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveDeckTab('setups')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition flex items-center gap-1.5 ${
              activeDeckTab === 'setups'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Setups ({tradeSetups.length})</span>
          </button>

          <button
            onClick={() => setActiveDeckTab('levels')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition flex items-center gap-1.5 ${
              activeDeckTab === 'levels'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Levels ({keyLevels.length})</span>
          </button>

          <button
            onClick={() => setActiveDeckTab('sizer')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition flex items-center gap-1.5 ${
              activeDeckTab === 'sizer'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Sizer</span>
          </button>

          <button
            onClick={() => setActiveDeckTab('risk')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition flex items-center gap-1.5 ${
              activeDeckTab === 'risk'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Risk</span>
          </button>
        </div>

        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider hidden sm:inline">
          Action Deck
        </span>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs font-mono divide-y divide-slate-800/60">
        {/* TAB 1: SETUPS */}
        {activeDeckTab === 'setups' && (
          <div className="space-y-3">
            {tradeSetups.map((setup, idx) => {
              const isLongSetup = setup.direction === 'LONG';
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLongSetup
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {setup.direction}
                      </span>
                      <span className="font-bold text-slate-200 text-xs">{setup.setup}</span>
                    </div>
                    <span className="text-[11px] font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      R:R {setup.riskReward}
                    </span>
                  </div>

                  {/* Trigger & Invalidation Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-slate-900/90 rounded border border-slate-800/80">
                      <span className="text-slate-400 text-[10px] block">TRIGGER / ENTRY:</span>
                      <span className="text-slate-200 font-medium leading-tight block mt-0.5">
                        {setup.triggerEntry}
                      </span>
                    </div>

                    <div className="p-2 bg-rose-950/20 rounded border border-rose-500/30">
                      <span className="text-rose-400 text-[10px] block font-bold">INVALIDATION (STOP):</span>
                      <span className="text-rose-200 font-medium leading-tight block mt-0.5">
                        {setup.invalidationStop}
                      </span>
                    </div>
                  </div>

                  {/* Targets */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-1.5 bg-emerald-950/20 rounded border border-emerald-500/20">
                      <span className="text-emerald-400 text-[10px] block font-medium">TARGET 1:</span>
                      <span className="text-emerald-200 font-bold block truncate">{setup.target1}</span>
                    </div>
                    <div className="p-1.5 bg-cyan-950/20 rounded border border-cyan-500/20">
                      <span className="text-cyan-400 text-[10px] block font-medium">TARGET 2:</span>
                      <span className="text-cyan-200 font-bold block truncate">{setup.target2}</span>
                    </div>
                  </div>

                  {/* Volume Confirmation & Sizer Link */}
                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/70 text-[10.5px]">
                    <span className="text-slate-400 line-clamp-1 text-[10px]">
                      {setup.volumeConfirmation}
                    </span>
                    <button
                      onClick={() => handleSendToSizer(idx)}
                      className="shrink-0 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 transition"
                      title="Send this setup to ATR Position Sizer"
                    >
                      <Calculator className="w-2.5 h-2.5" />
                      <span>Size Setup</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: KEY LEVELS LADDER */}
        {activeDeckTab === 'levels' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 py-0.5 uppercase tracking-wider font-semibold">
              <span>Level / Method</span>
              <span className="text-right">Price / Distance</span>
            </div>
            {keyLevels.map((lvl, idx) => {
              const diff = lvl.price - currentPrice;
              const diffPerc = ((diff / currentPrice) * 100).toFixed(2);
              const isCurrent = Math.abs(diff) < currentPrice * 0.001;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded border transition ${
                    isCurrent
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-white font-bold'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold border shrink-0 ${getCategoryBadge(
                        lvl.category
                      )}`}
                    >
                      {lvl.category}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate" title={lvl.name}>
                      {lvl.name}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-white text-xs">
                      ${lvl.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`text-[10px] ${
                        diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-cyan-300'
                      }`}
                    >
                      {diff > 0 ? `+${diffPerc}%` : `${diffPerc}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: POSITION SIZER */}
        {activeDeckTab === 'sizer' && (
          <div className="space-y-3 pt-1">
            {/* Active Setup Selector */}
            <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target Setup:</span>
                <div className="flex gap-1">
                  {tradeSetups.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSetupIdx(i)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedSetupIdx === i
                          ? s.direction === 'LONG'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s.direction} #{i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-slate-200 font-semibold truncate">
                {activeSetup.setup}
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <label className="text-slate-400 text-[10px] block mb-1">ACCOUNT CAPITAL ($):</label>
                <input
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(Math.max(1000, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs"
                />
              </div>

              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <label className="text-slate-400 text-[10px] block mb-1">RISK % OF EQUITY:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="5"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Math.max(0.1, Math.min(5, Number(e.target.value))))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs"
                  />
                  <span className="text-slate-400 text-xs">%</span>
                </div>
              </div>
            </div>

            {/* Invalidation & Volatility Sizing Multipliers */}
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ATR Stop Buffer:</span>
                <span className="text-cyan-300 font-bold">{atrMultiplier}x 1H ATR</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1.0, 1.25, 1.5, 2.0].map((m) => (
                  <button
                    key={m}
                    onClick={() => setAtrMultiplier(m)}
                    className={`flex-1 py-1 rounded text-[10px] font-mono transition ${
                      atrMultiplier === m
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>

            {/* Recommended Size Outputs */}
            <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-lg space-y-2 text-[11px]">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                <span className="text-slate-300">MAX ALLOWED LOSS:</span>
                <span className="text-rose-400 font-bold">${adjustedDollarRisk.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                <span className="text-slate-300">STOP DISTANCE:</span>
                <span className="text-amber-300 font-bold">
                  ${stopDistance.toFixed(2)} ({((stopDistance / entryPrice) * 100).toFixed(2)}%)
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                <span className="text-slate-300">POSITION UNITS:</span>
                <span className="text-emerald-300 font-bold text-sm">
                  {positionUnits.toFixed(4)} {symbol.split('-')[0]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">NOTIONAL VALUE:</span>
                <span className="text-white font-bold text-sm">${positionNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RISK & CATALYSTS */}
        {activeDeckTab === 'risk' && (
          <div className="space-y-3 pt-1">
            <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase font-bold mb-1">
                Desk Risk Directives:
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-300">
                {riskNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-rose-400 font-bold shrink-0">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            {catalysts && catalysts.length > 0 && (
              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase font-bold mb-1">
                  Session Catalysts:
                </span>
                <ul className="space-y-1 text-[11px]">
                  {catalysts.map((c, i) => (
                    <li key={i} className="flex items-center justify-between p-1 bg-slate-900 rounded">
                      <span className="text-slate-200 truncate">{c.event}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                          c.impact === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {c.impact}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
