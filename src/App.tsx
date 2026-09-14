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
import { DataRequirementsPanel } from './components/DataRequirementsPanel';
import { DeskHeader } from './components/DeskHeader';
import { ExecutiveBriefView } from './components/ExecutiveBriefView';
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
  const [activeTab, setActiveTab] = useState<'brief' | 'chart' | 'data' | 'calculator'>('brief');
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

  // Auto-refresh every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      loadBrief();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadBrief]);

  const handleCopyBrief = (format: 'markdown' | 'text') => {
    if (!brief) return;

    if (format === 'markdown') {
      const levelsMd = brief.keyLevels
        .map((lvl) => `| ${lvl.name} | $${lvl.price.toFixed(2)} | ${lvl.method} | ${lvl.category} |`)
        .join('\n');

      const setupsMd = brief.tradeSetups
        .map(
          (s) =>
            `| ${s.setup} | ${s.triggerEntry} | ${s.invalidationStop} | ${s.target1} | ${s.target2} | ${s.riskReward} | ${s.volumeConfirmation} |`
        )
        .join('\n');

      const riskMd = brief.riskNotes.map((r, i) => `${i + 1}. ${r}`).join('\n');

      const md = `# PRE-MARKET TECHNICAL BRIEF: ${brief.symbol}
**Session:** ${brief.session} | **Date:** ${brief.date} | **Spot:** $${brief.currentPrice.toFixed(2)}
**Source:** ${brief.dataSource} (${new Date(brief.timestamp).toUTCString()})

---

### 1. SUMMARY BIAS
**${brief.summaryBiasType} BIAS**
${brief.summaryBias}

---

### 2. KEY LEVELS TABLE
| Level Name | Price ($) | Method / Inputs Used | Category |
| :--- | :--- | :--- | :--- |
${levelsMd}

---

### 3. TRADE SETUPS TABLE
| Setup | Trigger / Entry | Invalidation (Stop) | Target 1 | Target 2 | R:R | Volume / Confirmation Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${setupsMd}

---

### 4. RISK NOTES
${riskMd}

---
*Notice: This is analysis for planning purposes only, not a recommendation to buy or sell.*
`;
      navigator.clipboard.writeText(md);
    } else {
      const text = `PRE-MARKET TECHNICAL BRIEF: ${brief.symbol} (${brief.session} Session - ${brief.date})
Spot: $${brief.currentPrice.toFixed(2)} | Source: ${brief.dataSource}

1. SUMMARY BIAS (${brief.summaryBiasType}):
${brief.summaryBias}

2. KEY LEVELS:
${brief.keyLevels.map((l) => `- ${l.name}: $${l.price.toFixed(2)} (${l.method})`).join('\n')}

3. TRADE SETUPS:
${brief.tradeSetups
  .map(
    (s) =>
      `[${s.direction}] ${s.setup}\n  Entry: ${s.triggerEntry}\n  Stop: ${s.invalidationStop}\n  Target: ${s.target1} / ${s.target2} (R:R ${s.riskReward})\n  Confirmation: ${s.volumeConfirmation}`
  )
  .join('\n\n')}

4. RISK NOTES:
${brief.riskNotes.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Notice: Analysis for planning purposes only, not a trade recommendation.`;
      navigator.clipboard.writeText(text);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header */}
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

      {/* Main Content Area */}
      <main className="flex-1 px-4 lg:px-8 py-6 max-w-7xl w-full mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold block text-sm">Data Connection Warning</span>
                <span className="text-xs text-rose-200/80">{error}</span>
              </div>
            </div>
            <button
              onClick={loadBrief}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-mono font-medium transition"
            >
              Retry Feed
            </button>
          </div>
        )}

        {loading && !brief ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            <p className="font-mono text-xs text-slate-400">
              Fetching 10-session OHLCV, calculating Floor Pivots, Session VWAP, and Volume Profile...
            </p>
          </div>
        ) : brief ? (
          <div>
            {activeTab === 'brief' && <ExecutiveBriefView brief={brief} />}
            {activeTab === 'chart' && <InteractiveTerminalChart brief={brief} />}
            {activeTab === 'data' && <DataRequirementsPanel brief={brief} />}
            {activeTab === 'calculator' && <PositionRiskCalculator brief={brief} />}
          </div>
        ) : null}
      </main>

      {/* Bottom Sticky Quick-Action Bar */}
      {brief && (
        <div className="sticky bottom-0 z-30 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-4 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Quick Level Badges */}
            <div className="flex items-center space-x-3 overflow-x-auto py-1">
              <span className="text-slate-400 uppercase text-[10px] font-bold">Key Anchors:</span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-200">
                P: <strong className="text-purple-300">${brief.pivots.pivot.toFixed(2)}</strong>
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-200">
                POC: <strong className="text-amber-300">${brief.volumeProfile.poc.toFixed(2)}</strong>
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-200">
                VWAP: <strong className="text-amber-400">${brief.sessionVwap.price.toFixed(2)}</strong>
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-200">
                1H ATR: <strong className="text-cyan-300">${brief.atr.atr14Hourly.toFixed(2)}</strong>
              </span>
            </div>

            {/* AI Assistant Button */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsGeminiOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded font-medium shadow-md shadow-cyan-900/20 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Desk Synthesis</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
