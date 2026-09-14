import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  Key,
  Loader2,
  Settings,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { PreMarketBrief } from '../types';
import {
  generateDeterministicDeskBrief,
  synthesizeDeskBrief,
} from '../services/deskBriefSynthesizer';

interface GeminiAnalystModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: PreMarketBrief;
}

const STORAGE_KEY_API_KEY = 'desk_gemini_client_api_key';

export const GeminiAnalystModal: React.FC<GeminiAnalystModalProps> = ({
  isOpen,
  onClose,
  brief,
}) => {
  const [loading, setLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [synthesisSource, setSynthesisSource] = useState<
    'server' | 'gemini_client' | 'deterministic' | null
  >(null);

  // Client API key configuration (for static hosts like GitHub Pages)
  const [clientApiKey, setClientApiKey] = useState<string>('');
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    setClientApiKey(saved);
  }, []);

  if (!isOpen) return null;

  const handleSaveKey = (val: string) => {
    setClientApiKey(val);
    if (val.trim()) {
      localStorage.setItem(STORAGE_KEY_API_KEY, val.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
  };

  const handleGenerate = async (forceDeterministic = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceDeterministic) {
        const text = generateDeterministicDeskBrief(brief);
        setAiBrief(text);
        setSynthesisSource('deterministic');
      } else {
        const res = await synthesizeDeskBrief(brief, clientApiKey);
        setAiBrief(res.text);
        setSynthesisSource(res.source);
      }
    } catch (err: any) {
      console.warn('Synthesis error, falling back to deterministic desk brief', err);
      const text = generateDeterministicDeskBrief(brief);
      setAiBrief(text);
      setSynthesisSource('deterministic');
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-sans">
                Sell-Side Desk Analyst Synthesis
              </h3>
              <p className="text-[11px] text-slate-400">
                Institutional brief generation • Works on Full-Stack Server & GitHub Pages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="p-1.5 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition"
              title="Configure Client API Key (for GitHub Pages)"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Key Configuration Drawer */}
        {showKeyConfig && (
          <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                Optional: Client-Side Gemini API Key
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Stored in browser localStorage
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              When deployed to static hosts like GitHub Pages (no Node backend), this enables direct
              client-side Gemini model calls. Without a key, the terminal seamlessly uses its
              built-in Deterministic Desk Engine.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="AIzaSy... (Gemini API Key)"
                value={clientApiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              />
              {clientApiKey && (
                <button
                  onClick={() => handleSaveKey('')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
          {!aiBrief && !loading && !error && (
            <div className="text-center py-8 space-y-3">
              <Bot className="w-12 h-12 text-cyan-400 mx-auto opacity-70" />
              <p className="max-w-md mx-auto text-slate-400 text-xs font-sans leading-relaxed">
                Generate an institutional sell-side technical brief for{' '}
                <span className="text-white font-bold">{brief.symbol}</span> ({brief.session}{' '}
                Session). Formatted strictly across 4 sections: Summary Bias, Confluence Ladder,
                Tactical Setups, and Catalyst Risk.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleGenerate(false)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-600/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Synthesize Brief</span>
                </button>
                <button
                  onClick={() => handleGenerate(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium text-xs border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Deterministic Note (Offline)</span>
                </button>
              </div>
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
                onClick={() => handleGenerate(true)}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs transition mt-2"
              >
                Use Deterministic Desk Engine
              </button>
            </div>
          )}

          {aiBrief && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Synthesis Complete
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                    Source:{' '}
                    {synthesisSource === 'server'
                      ? 'Server Gemini API'
                      : synthesisSource === 'gemini_client'
                      ? 'Direct Client Gemini'
                      : 'Deterministic Desk Engine (100% Client/Static)'}
                  </span>
                </div>
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

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-slate-200 select-text max-h-[55vh] overflow-y-auto">
                {aiBrief}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
          <span>
            {synthesisSource === 'deterministic'
              ? 'Institutional Deterministic Engine (Grounded in calculated order flow levels)'
              : 'Google Gemini 3.8 Flash • Sell-Side Quantitative Persona'}
          </span>
          <div className="flex items-center gap-2">
            {aiBrief && (
              <button
                onClick={() => setAiBrief(null)}
                className="px-2.5 py-1 text-slate-400 hover:text-slate-200 transition"
              >
                Regenerate
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
