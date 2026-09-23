import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { PreMarketBrief } from '../types';
import { AtrVolatilityMonitor } from './AtrVolatilityMonitor';

interface ExecutiveRibbonProps {
  brief: PreMarketBrief;
  onOpenAi: () => void;
}

export const ExecutiveRibbon: React.FC<ExecutiveRibbonProps> = ({ brief, onOpenAi }) => {
  const [isThesisOpen, setIsThesisOpen] = useState(false);

  const {
    summaryBias,
    summaryBiasType,
    marketStructure,
    pivots,
    volumeProfile,
    sessionVwap,
  } = brief;

  const biasBadgeColor =
    summaryBiasType === 'BULLISH'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : summaryBiasType === 'BEARISH'
      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

  const biasIcon =
    summaryBiasType === 'BULLISH' ? (
      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
    ) : summaryBiasType === 'BEARISH' ? (
      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
    ) : (
      <Compass className="w-3.5 h-3.5 text-amber-400" />
    );

  return (
    <div className="relative z-20 bg-slate-900/95 border-b border-slate-800 text-xs font-mono px-3 py-1.5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Summary Bias & Market Structure Ribbons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Bias Pill */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-bold ${biasBadgeColor}`}>
            {biasIcon}
            <span>{summaryBiasType} BIAS</span>
          </div>

          {/* HTF & Intraday */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <span className="text-slate-400">HTF:</span>
            <span
              className={`font-semibold ${
                marketStructure.higherTimeframeTrend === 'BULLISH'
                  ? 'text-emerald-400'
                  : marketStructure.higherTimeframeTrend === 'BEARISH'
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {marketStructure.higherTimeframeTrend}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">INTRADAY:</span>
            <span
              className={`font-semibold ${
                marketStructure.intradayTrend === 'BULLISH'
                  ? 'text-emerald-400'
                  : marketStructure.intradayTrend === 'BEARISH'
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {marketStructure.intradayTrend}
            </span>
          </div>

          {/* Dominant Regime */}
          <div className="hidden md:flex items-center gap-1 text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <span className="text-slate-400">REGIME:</span>
            <span className="text-cyan-300 font-semibold">{marketStructure.dominantRegime}</span>
          </div>

          {/* Toggle Thesis Popover */}
          <button
            onClick={() => setIsThesisOpen(!isThesisOpen)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 text-[10.5px] transition"
          >
            <FileText className="w-3 h-3 text-cyan-400" />
            <span>Thesis</span>
            {isThesisOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Right: Key Anchors & Volatility Monitor */}
        <div className="flex items-center flex-wrap gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 hidden lg:inline">ANCHORS:</span>
            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300" title="Floor Pivot">
              P: <strong className="text-purple-300">${pivots.pivot.toFixed(2)}</strong>
            </span>
            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300" title="Volume Profile Point of Control">
              POC: <strong className="text-amber-300">${volumeProfile.poc.toFixed(2)}</strong>
            </span>
            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300" title="Session Volume Weighted Average Price">
              VWAP: <strong className="text-amber-400">${sessionVwap.price.toFixed(2)}</strong>
            </span>
          </div>

          {/* ATR Volatility Monitor */}
          <AtrVolatilityMonitor brief={brief} />

          {/* AI Desk Synthesis Trigger */}
          <button
            onClick={onOpenAi}
            className="flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded font-medium text-[11px] shadow-sm transition"
            title="Generate AI Desk Synthesis from quantitative inputs"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">AI Synthesis</span>
          </button>
        </div>
      </div>

      {/* Floating Collapsible Thesis Drawer */}
      {isThesisOpen && (
        <div className="absolute left-3 top-full mt-1 w-[calc(100%-24px)] max-w-2xl bg-slate-950 border border-slate-700/80 rounded-lg p-3.5 shadow-2xl z-50 text-slate-200 font-sans text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2 font-mono">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                MANDATE 1
              </span>
              <span className="font-bold text-white text-xs">One-Paragraph Executive Bias</span>
            </div>
            <button
              onClick={() => setIsThesisOpen(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <p className="text-slate-200">{summaryBias}</p>
        </div>
      )}
    </div>
  );
};
