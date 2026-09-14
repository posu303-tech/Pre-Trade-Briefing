import React, { useEffect, useState } from 'react';
import {
  Activity,
  Clock,
  Copy,
  Download,
  Flame,
  Globe2,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { PreMarketBrief, TickerSymbol, TradingSession } from '../types';

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
  activeTab: 'brief' | 'chart' | 'data' | 'calculator';
  setActiveTab: (t: 'brief' | 'chart' | 'data' | 'calculator') => void;
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
    ny: string;
    london: string;
    tokyo: string;
  }>({ utc: '', ny: '', london: '', tokyo: '' });

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setCurrentTime({
        utc: now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC',
        ny: now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }) + ' NY',
        london: now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }) + ' LDN',
        tokyo: now.toLocaleTimeString('en-US', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) + ' TKY',
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

  const tickers: { key: TickerSymbol; label: string; name: string }[] = [
    { key: 'BTC-USD', label: 'BTC', name: 'Bitcoin' },
    { key: 'ETH-USD', label: 'ETH', name: 'Ethereum' },
    { key: 'SOL-USD', label: 'SOL', name: 'Solana' },
    { key: 'XAUT-USD', label: 'XAUT', name: 'Tether Gold' },
  ];

  const sessions: { key: TradingSession; label: string; hours: string }[] = [
    { key: 'ALL', label: 'All Sessions (24H)', hours: '00:00 - 23:59 UTC' },
    { key: 'ASIAN', label: 'Asian Session', hours: '00:00 - 08:00 UTC' },
    { key: 'EUROPEAN', label: 'European (London)', hours: '08:00 - 16:00 UTC' },
    { key: 'US', label: 'US (New York/Globex)', hours: '13:30 - 20:00 UTC' },
  ];

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3">
      {/* Top row: Institutional Brand, World Clocks, and Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm shadow-inner">
            DESK
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base lg:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Sell-Side Pre-Market Technical Brief
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono uppercase bg-slate-800 text-slate-300 rounded border border-slate-700">
                  Intraday Desk
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Institutional quantitative brief for intraday order flow & trade planning
            </p>
          </div>
        </div>

        {/* Global Trading Clocks */}
        <div className="hidden md:flex items-center space-x-4 text-xs font-mono text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-md border border-slate-800">
          <div className="flex items-center space-x-1.5 text-cyan-300">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{currentTime.utc}</span>
          </div>
          <span className="text-slate-700">•</span>
          <span>{currentTime.ny}</span>
          <span className="text-slate-700">•</span>
          <span>{currentTime.london}</span>
          <span className="text-slate-700">•</span>
          <span>{currentTime.tokyo}</span>
        </div>

        {/* Feed Status & Refresh */}
        <div className="flex items-center space-x-3 text-xs">
          {brief?.isStale ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Offline / Cached</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Feed: {brief?.dataSource.split(' ')[0] || 'Connected'}</span>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded border border-slate-700 transition disabled:opacity-50"
            title="Refresh live price action"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="font-mono">Refresh</span>
          </button>
        </div>
      </div>

      {/* Bottom row: Instrument Selector, Session Selector, Tabs, and Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        {/* Ticker Selector */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 uppercase font-semibold">
            Instrument:
          </span>
          {tickers.map((t) => (
            <button
              key={t.key}
              onClick={() => setSymbol(t.key)}
              className={`px-3 py-1 text-xs font-mono font-medium rounded transition flex items-center space-x-1.5 ${
                symbol === t.key
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{t.label}</span>
              <span className="text-[10px] opacity-70 hidden sm:inline">{t.name}</span>
            </button>
          ))}
        </div>

        {/* Session Selector */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 px-2 uppercase font-semibold">
            Session:
          </span>
          {sessions.map((s) => (
            <button
              key={s.key}
              onClick={() => setSession(s.key)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition ${
                session === s.key
                  ? 'bg-slate-700 text-cyan-300 font-semibold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={s.hours}
            >
              {s.label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              activeTab === 'brief'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Brief View (4-Part)
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              activeTab === 'chart'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Chart & Profile
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              activeTab === 'data'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Data Audit (6 Reqs)
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              activeTab === 'calculator'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            4. ATR Sizing Calculator
          </button>
        </div>

        {/* Export & Distribution Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleCopy('markdown')}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Copy brief formatted in Markdown for Slack, Telegram, or Notion"
          >
            {copied === 'markdown' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied === 'markdown' ? 'Copied MD' : 'Copy MD'}</span>
          </button>

          <button
            onClick={onPrint}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Export desk brief to Print or PDF format"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF / Print</span>
          </button>
        </div>
      </div>
    </header>
  );
};
