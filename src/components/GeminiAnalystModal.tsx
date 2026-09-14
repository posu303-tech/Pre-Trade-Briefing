import React, { useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { PreMarketBrief } from '../types';

interface GeminiAnalystModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: PreMarketBrief;
}

export const GeminiAnalystModal: React.FC<GeminiAnalystModalProps> = ({
  isOpen,
  onClose,
  brief,
}) => {
  const [loading, setLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gemini/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: brief.symbol,
          session: brief.session,
          date: brief.date,
          quantData: {
            currentPrice: brief.currentPrice,
            priorDay: brief.priorDay,
            pivots: brief.pivots,
            volumeProfile: {
              poc: brief.volumeProfile.poc,
              vah: brief.volumeProfile.vah,
              val: brief.volumeProfile.val,
            },
            vwap: brief.sessionVwap.price,
            movingAverages: brief.movingAverages,
            atr: brief.atr,
            gaps: brief.gaps,
            catalysts: brief.catalysts,
            options: brief.options,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to synthesize brief with Gemini');
      }

      setAiBrief(data.briefText);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to analyst engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!aiBrief) return;
    navigator.clipboard.writeText(aiBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-sans">
                Gemini Sell-Side Analyst Synthesis
              </h3>
              <p className="text-[11px] text-slate-400">
                Institutional brief generation grounded in live quant levels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
          {!aiBrief && !loading && !error && (
            <div className="text-center py-8 space-y-3">
              <Bot className="w-12 h-12 text-cyan-400 mx-auto opacity-70" />
              <p className="max-w-md mx-auto text-slate-400 text-xs font-sans leading-relaxed">
                Generate an AI-synthesized, sell-side formatted technical note for{' '}
                <span className="text-white font-bold">{brief.symbol}</span> for the{' '}
                <span className="text-cyan-300 font-bold">{brief.session}</span> session, incorporating live floor pivots, VWAP deviation, and ATR risk brackets.
              </p>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold text-xs transition flex items-center gap-2 mx-auto shadow-lg shadow-cyan-600/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Desk Synthesis</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-xs">
                Synthesizing institutional order flow & computing risk notes...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>Synthesis Error</span>
              </div>
              <p className="text-slate-300 text-xs">{error}</p>
              <button
                onClick={handleGenerate}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs transition mt-2"
              >
                Retry
              </button>
            </div>
          )}

          {aiBrief && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Synthesis Ready (Grounded in Verified Data)
                </span>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] transition flex items-center gap-1.5"
                >
                  {copied ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-slate-200 select-text">
                {aiBrief}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
          <span>Engine: Google Gemini 3.8 Flash • Institutional Prompt Profile</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
