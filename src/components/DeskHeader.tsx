import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flame,
  LayoutGrid,
  Maximize2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { PreMarketBrief, TickerSymbol, TradingSession } from '../types';

export type WorkspaceViewMode = 'split' | 'chart' | 'brief' | 'data' | 'calculator';

interface DeskHeaderProps {
  symbol: TickerSymbol;
  setSymbol: (s: TickerSymbol) => void;
  session: TradingSession;
  setSession: (s: TradingSession) => void;
  brief: PreMarketBrief | null;
  loading: boolean;
  onRefresh: () => void;
  onCopyBrief: (format: 'markdown' | 'text') => void;
  onPrint: () => void;
  activeTab: WorkspaceViewMode;
  setActiveTab: (t: WorkspaceViewMode) => void;
}

export const DeskHeader: React.FC<DeskHeaderProps> = ({
  symbol,
  setSymbol,
  session,
  setSession,
  brief,
  loading,
  onRefresh,
  onCopyBrief,
  onPrint,
  activeTab,
  setActiveTab,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<{
    utc: string;
    ist: string;
  }>({ utc: '', ist: '' });

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setCurrentTime({
        utc: now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC',
        ist: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST',
      });
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (format: 'markdown' | 'text') => {
    onCopyBrief(format);
    setCopied(format);
    setTimeout(() => setCopied(null), 2500);
  };

  const tickers: { key: TickerSymbol; label: string }[] = [
    { key: 'BTC-USD', label: 'BTC' },
    { key: 'ETH-USD', label: 'ETH' },
    { key: 'SOL-USD', label: 'SOL' },
    { key: 'XAUT-USD', label: 'XAUT' },
  ];

  const sessions: { key: TradingSession; label: string; hours: string }[] = [
    { key: 'ALL', label: '24H', hours: '00:00 - 23:59 UTC' },
    { key: 'ASIAN', label: 'Asia', hours: '00:00 - 08:00 UTC' },
    { key: 'EUROPEAN', label: 'LDN', hours: '08:00 - 16:00 UTC' },
    { key: 'US', label: 'US', hours: '13:30 - 20:00 UTC' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-3 py-2 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Section: Institutional Branding, Ticker Selector & Spot Price */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Desk Brand Badge */}
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs shadow-inner">
              DESK
            </div>
            <span className="font-mono font-bold text-sm text-white hidden xl:inline">
              PRE-MARKET BRIEF
            </span>
          </div>

          {/* Ticker Segmented Buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {tickers.map((t) => (
              <button
                key={t.key}
                onClick={() => setSymbol(t.key)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition ${
                  symbol === t.key
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Live Spot Price */}
          {brief && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono">
              <span className="text-[10px] text-slate-400">SPOT:</span>
              <span className="text-xs font-bold text-white">
                ${brief.currentPrice >= 1000
                  ? brief.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : brief.currentPrice.toFixed(2)}
              </span>
            </div>
          )}

          {/* Session Switcher */}
          <div className="hidden sm:flex items-center space-x-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {sessions.map((s) => (
              <button
                key={s.key}
                onClick={() => setSession(s.key)}
                className={`px-2 py-1 text-[11px] font-mono rounded transition ${
                  session === s.key
                    ? 'bg-slate-700 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={s.hours}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Workspace View Selector (Pro Split, Chart, Brief, Audit, Sizer) */}
        <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('split')}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 ${
              activeTab === 'split'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Split Terminal: Side-by-Side Chart & Action Deck for maximum screen utilization"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="font-medium">Split Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'chart'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Full-Width Panoramic Chart & Volume Profile"
          >
            Chart
          </button>

          <button
            onClick={() => setActiveTab('brief')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'brief'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Executive 4-Part Mandate Briefing"
          >
            Brief
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'calculator'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="ATR Sizing Calculator"
          >
            Sizer
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`px-2.5 py-1 rounded transition ${
              activeTab === 'data'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Data Audit & Session OHLCV"
          >
            Audit
          </button>
        </div>

        {/* Right Section: Clocks, Feed Status, Refresh & Export Tools */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          {/* Clocks */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[11px] text-slate-400">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">{currentTime.utc}</span>
            <span className="text-slate-700">•</span>
            <span className="text-amber-300">{currentTime.ist}</span>
          </div>

          {/* Feed Status Dot */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px]">
            {brief?.isStale ? (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="hidden lg:inline">Cached</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="hidden lg:inline">Live</span>
              </span>
            )}
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded border border-slate-700 transition disabled:opacity-50"
            title="Refresh market data feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Copy Markdown */}
          <button
            onClick={() => handleCopy('markdown')}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition flex items-center gap-1 text-[11px]"
            title="Copy brief formatted in Markdown for Slack, Telegram, or Notion"
          >
            {copied === 'markdown' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">{copied === 'markdown' ? 'Copied' : 'Copy'}</span>
          </button>

          {/* PDF / Print */}
          <button
            onClick={onPrint}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Export desk brief to Print or PDF"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
