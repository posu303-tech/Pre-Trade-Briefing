import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Download,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  Share2,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ActionDeckSidebar } from './components/ActionDeckSidebar';
import { DataRequirementsPanel } from './components/DataRequirementsPanel';
import { DeskHeader, WorkspaceViewMode } from './components/DeskHeader';
import { ExecutiveBriefView } from './components/ExecutiveBriefView';
import { ExecutiveRibbon } from './components/ExecutiveRibbon';
import { GeminiAnalystModal } from './components/GeminiAnalystModal';
import { InteractiveTerminalChart } from './components/InteractiveTerminalChart';
import { PositionRiskCalculator } from './components/PositionRiskCalculator';
import { fetchMarketData, getFallbackPayload } from './services/marketData';
import { generateDeskBrief } from './services/quantEngine';
import { PreMarketBrief, TickerSymbol, TradingSession } from './types';

export const App: React.FC = () => {
  const [symbol, setSymbol] = useState<TickerSymbol>('BTC-USD');
  const [session, setSession] = useState<TradingSession>('ALL');
  const [brief, setBrief] = useState<PreMarketBrief>(() => generateDeskBrief(getFallbackPayload('BTC-USD'), 'ALL'));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceViewMode>('split');
  const [isGeminiOpen, setIsGeminiOpen] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadBrief = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMarketData(symbol);
      const deskBrief = generateDeskBrief(payload, session);
      setBrief(deskBrief);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error generating desk brief:', err);
      setBrief((prev) => prev || generateDeskBrief(getFallbackPayload(symbol), session));
      setError(err?.message || 'Using cached desk feed. Live market handshake timed out.');
    } finally {
      setLoading(false);
    }
  }, [symbol, session]);

  useEffect(() => {
    loadBrief();
  }, [loadBrief]);

  const handleCopyBrief = (format: 'markdown' | 'text') => {
    if (!brief) return;

    if (format === 'markdown') {
      const md = `# PRE-MARKET TECHNICAL BRIEF: ${brief.symbol}
**Session:** ${brief.session} | **Date:** ${brief.date} | **Generated:** ${new Date(brief.timestamp).toUTCString()}
**Pre-Market Price:** $${brief.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

## Section 1: Executive Summary & Bias
${brief.summaryBias}

## Section 2: Key Levels Table
| Level | Price | Method / Inputs | Category |
| :--- | :--- | :--- | :--- |
${brief.keyLevels.map((l) => `| ${l.name} | $${l.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${l.method} | ${l.category} |`).join('\n')}

## Section 3: Trade Setups Table
| Setup | Direction | Trigger / Entry | Invalidation (Stop) | Target 1 | Target 2 | R:R | Volume Confirmation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${brief.tradeSetups.map((s) => `| ${s.setup} | ${s.direction} | ${s.triggerEntry} | ${s.invalidationStop} | ${s.target1} | ${s.target2} | ${s.riskReward} | ${s.volumeConfirmation} |`).join('\n')}

## Section 4: Risk Notes
${brief.riskNotes.map((n) => `- ${n}`).join('\n')}

---
*Notice: Pre-market technical planning brief generated for internal desk execution. Not financial advice.*`;
      navigator.clipboard.writeText(md);
    } else {
      const text = `PRE-MARKET TECHNICAL BRIEF: ${brief.symbol} (${brief.session})
Spot: $${brief.currentPrice.toFixed(2)} | Date: ${brief.date}

EXECUTIVE SUMMARY:
${brief.summaryBias}

KEY LEVELS:
${brief.keyLevels.map((l) => `${l.name}: $${l.price.toFixed(2)} (${l.method})`).join('\n')}

SETUPS:
${brief.tradeSetups.map((s) => `[${s.direction}] ${s.setup} -> Trigger: ${s.triggerEntry} | Stop: ${s.invalidationStop} | T1: ${s.target1} | T2: ${s.target2} | RR: ${s.riskReward}`).join('\n')}

RISK NOTES:
${brief.riskNotes.map((n) => `* ${n}`).join('\n')}

Notice: Analysis for planning purposes only, not a trade recommendation.`;
      navigator.clipboard.writeText(text);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Streamlined Institutional Header */}
      <DeskHeader
        symbol={symbol}
        setSymbol={setSymbol}
        session={session}
        setSession={setSession}
        brief={brief}
        loading={loading}
        onRefresh={loadBrief}
        onCopyBrief={handleCopyBrief}
        onPrint={handlePrint}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Ultra-Compact Executive Ribbon (Bias, Regime, Anchors, ATR Monitor & Thesis) */}
      {brief && (
        <ExecutiveRibbon
          brief={brief}
          onOpenAi={() => setIsGeminiOpen(true)}
        />
      )}

      {/* Main Responsive Workspace - Maximize Viewport Utilization */}
      <main className="flex-1 px-2.5 sm:px-3.5 py-2.5 w-full max-w-[1920px] mx-auto">
        {error && (
          <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold block text-xs">Data Connection Notice</span>
                <span className="text-[11px] text-rose-200/80">{error}</span>
              </div>
            </div>
            <button
              onClick={loadBrief}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-mono font-medium transition"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !brief ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="font-mono text-xs text-slate-400">
              Synchronizing multi-timeframe candle stream, VWAP & Volume Profile...
            </p>
          </div>
        ) : brief ? (
          <div className="w-full">
            {/* Split Terminal View (Default: Side-by-side Chart + Action Deck) */}
            {activeTab === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 w-full items-start">
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-w-0">
                  <InteractiveTerminalChart brief={brief} />
                </div>
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col min-w-0">
                  <ActionDeckSidebar brief={brief} />
                </div>
              </div>
            )}

            {/* Standalone Full-Width Panoramic Chart */}
            {activeTab === 'chart' && (
              <div className="w-full">
                <InteractiveTerminalChart brief={brief} />
              </div>
            )}

            {/* High-Density Multi-Column Executive Brief */}
            {activeTab === 'brief' && (
              <div className="w-full">
                <ExecutiveBriefView brief={brief} />
              </div>
            )}

            {/* Detailed Standalone Position Risk Sizer */}
            {activeTab === 'calculator' && (
              <div className="w-full">
                <PositionRiskCalculator brief={brief} />
              </div>
            )}

            {/* Data Requirements & Audit Mandates */}
            {activeTab === 'data' && (
              <div className="w-full">
                <DataRequirementsPanel brief={brief} />
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Gemini Modal */}
      {brief && (
        <GeminiAnalystModal
          isOpen={isGeminiOpen}
          onClose={() => setIsGeminiOpen(false)}
          brief={brief}
        />
      )}
    </div>
  );
};

export default App;
