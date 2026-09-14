import React, { useMemo, useState } from 'react';
import {
  BarChart2,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { Candle, PreMarketBrief } from '../types';

interface InteractiveTerminalChartProps {
  brief: PreMarketBrief;
}

export const InteractiveTerminalChart: React.FC<InteractiveTerminalChartProps> = ({ brief }) => {
  const {
    symbol,
    dailyCandles,
    hourlyCandles,
    currentPrice,
    pivots,
    volumeProfile,
    sessionVwap,
    movingAverages,
    gaps,
  } = brief;

  const [timeframe, setTimeframe] = useState<'1H' | '1D'>('1H');
  const [showPivots, setShowPivots] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [showMAs, setShowMAs] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);

  // Select candles
  const candles = useMemo(() => {
    return timeframe === '1D' ? dailyCandles.slice(-14) : hourlyCandles.slice(-36);
  }, [timeframe, dailyCandles, hourlyCandles]);

  // Dimensions
  const svgWidth = 960;
  const svgHeight = 440;
  const profileWidth = showProfile ? 140 : 0;
  const chartWidth = svgWidth - profileWidth - 70; // 70px right y-axis margin
  const chartHeight = svgHeight - 40; // 40px bottom x-axis margin
  const marginTop = 20;

  // Min / Max calculation
  const { minPrice, maxPrice } = useMemo(() => {
    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    if (showPivots) {
      min = Math.min(min, pivots.s2);
      max = Math.max(max, pivots.r2);
    }
    if (showProfile && volumeProfile.val > 0) {
      min = Math.min(min, volumeProfile.val);
      max = Math.max(max, volumeProfile.vah);
    }

    const pad = (max - min) * 0.05 || currentPrice * 0.02;
    return { minPrice: min - pad, maxPrice: max + pad };
  }, [candles, showPivots, showProfile, pivots, volumeProfile, currentPrice]);

  const priceToY = (price: number) => {
    if (maxPrice <= minPrice) return chartHeight / 2;
    return marginTop + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
  };

  const candleSpacing = chartWidth / candles.length;
  const candleBodyWidth = Math.max(3, candleSpacing * 0.65);

  // Price Grid Lines
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const count = 7;
    const step = (maxPrice - minPrice) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm max-w-6xl mx-auto space-y-4">
      {/* Chart Top Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <span className="text-base font-bold font-mono text-white flex items-center gap-2">
            <span>{symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
              Live Terminal Chart
            </span>
          </span>

          {/* Timeframe Buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setTimeframe('1H')}
              className={`px-2.5 py-0.5 rounded transition ${
                timeframe === '1H' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1H Execution
            </button>
            <button
              onClick={() => setTimeframe('1D')}
              className={`px-2.5 py-0.5 rounded transition ${
                timeframe === '1D' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1D Context
            </button>
          </div>
        </div>

        {/* Overlay Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setShowPivots(!showPivots)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showPivots
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showPivots ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Floor Pivots</span>
          </button>

          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showVwap
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showVwap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Session VWAP</span>
          </button>

          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showProfile
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showProfile ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Volume Profile</span>
          </button>

          <button
            onClick={() => setShowMAs(!showMAs)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showMAs
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showMAs ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>MAs (9/50)</span>
          </button>

          <button
            onClick={() => setShowGaps(!showGaps)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
              showGaps
                ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {showGaps ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>FVG Gaps</span>
          </button>
        </div>
      </div>

      {/* Crosshair Inspection Strip */}
      <div className="flex flex-wrap items-center justify-between text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-400">
        <div className="flex items-center space-x-4">
          <span>
            DATE:{' '}
            <span className="text-slate-200">
              {hoverCandle
                ? new Date(hoverCandle.timestamp).toLocaleString('en-US', { hour12: false })
                : 'Hover bar to inspect'}
            </span>
          </span>
          <span>
            O:{' '}
            <span className="text-slate-200">
              {hoverCandle ? `$${hoverCandle.open.toFixed(2)}` : '--'}
            </span>
          </span>
          <span>
            H:{' '}
            <span className="text-emerald-400 font-medium">
              {hoverCandle ? `$${hoverCandle.high.toFixed(2)}` : '--'}
            </span>
          </span>
          <span>
            L:{' '}
            <span className="text-rose-400 font-medium">
              {hoverCandle ? `$${hoverCandle.low.toFixed(2)}` : '--'}
            </span>
          </span>
          <span>
            C:{' '}
            <span className="text-slate-200 font-bold">
              {hoverCandle ? `$${hoverCandle.close.toFixed(2)}` : `--`}
            </span>
          </span>
          <span>
            VOL:{' '}
            <span className="text-slate-200">
              {hoverCandle ? hoverCandle.volume.toFixed(2) : '--'}
            </span>
          </span>
        </div>

        <div className="text-cyan-400 font-bold">
          SPOT: ${currentPrice.toFixed(2)}
        </div>
      </div>

      {/* Main SVG Visualization Canvas */}
      <div className="relative w-full overflow-hidden bg-slate-950 rounded-lg border border-slate-800">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
          style={{ maxHeight: '520px' }}
        >
          <defs>
            <linearGradient id="profileGradientVA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="profileGradientNonVA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bullishFvgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearishFvgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((price, idx) => {
            const y = priceToY(price);
            return (
              <g key={idx}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth + profileWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                {/* Price labels on right */}
                <text
                  x={chartWidth + profileWidth + 8}
                  y={y + 3}
                  fill="#64748b"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  ${price >= 1000 ? Math.round(price).toLocaleString() : price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* FVG Gap Shaded Zones */}
          {showGaps &&
            gaps.map((gap, idx) => {
              const yHigh = priceToY(gap.highPrice);
              const yLow = priceToY(gap.lowPrice);
              const height = Math.abs(yLow - yHigh);
              const isBull = gap.type === 'BULLISH_FVG';
              return (
                <g key={gap.id}>
                  <rect
                    x={0}
                    y={Math.min(yHigh, yLow)}
                    width={chartWidth}
                    height={Math.max(4, height)}
                    fill={isBull ? 'url(#bullishFvgGradient)' : 'url(#bearishFvgGradient)'}
                    stroke={isBull ? '#10b981' : '#ef4444'}
                    strokeWidth={0.8}
                    strokeDasharray="4 2"
                    opacity={0.7}
                  />
                  <text
                    x={12}
                    y={Math.min(yHigh, yLow) + 12}
                    fill={isBull ? '#34d399' : '#f87171'}
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    Untested {gap.type.replace('_', ' ')} (${gap.lowPrice} - ${gap.highPrice})
                  </text>
                </g>
              );
            })}

          {/* Floor Pivots Overlays */}
          {showPivots && (
            <g className="pivots-layer">
              {/* Pivot */}
              <line
                x1={0}
                y1={priceToY(pivots.pivot)}
                x2={chartWidth}
                y2={priceToY(pivots.pivot)}
                stroke="#c084fc"
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.pivot) - 4}
                fill="#c084fc"
                fontSize={9}
                fontFamily="monospace"
              >
                P: ${pivots.pivot.toLocaleString()}
              </text>

              {/* R1 */}
              <line
                x1={0}
                y1={priceToY(pivots.r1)}
                x2={chartWidth}
                y2={priceToY(pivots.r1)}
                stroke="#f43f5e"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.r1) - 4}
                fill="#f43f5e"
                fontSize={9}
                fontFamily="monospace"
              >
                R1: ${pivots.r1.toLocaleString()}
              </text>

              {/* R2 */}
              <line
                x1={0}
                y1={priceToY(pivots.r2)}
                x2={chartWidth}
                y2={priceToY(pivots.r2)}
                stroke="#e11d48"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.r2) - 4}
                fill="#e11d48"
                fontSize={9}
                fontFamily="monospace"
              >
                R2: ${pivots.r2.toLocaleString()}
              </text>

              {/* S1 */}
              <line
                x1={0}
                y1={priceToY(pivots.s1)}
                x2={chartWidth}
                y2={priceToY(pivots.s1)}
                stroke="#10b981"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.s1) - 4}
                fill="#10b981"
                fontSize={9}
                fontFamily="monospace"
              >
                S1: ${pivots.s1.toLocaleString()}
              </text>

              {/* S2 */}
              <line
                x1={0}
                y1={priceToY(pivots.s2)}
                x2={chartWidth}
                y2={priceToY(pivots.s2)}
                stroke="#059669"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <text
                x={chartWidth - 110}
                y={priceToY(pivots.s2) - 4}
                fill="#059669"
                fontSize={9}
                fontFamily="monospace"
              >
                S2: ${pivots.s2.toLocaleString()}
              </text>
            </g>
          )}

          {/* Session VWAP Line and Bands */}
          {showVwap && (
            <g className="vwap-layer">
              {/* Upper 1 Sigma */}
              <line
                x1={0}
                y1={priceToY(sessionVwap.upper1Sigma)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.upper1Sigma)}
                stroke="#fbbf24"
                strokeWidth={0.8}
                strokeDasharray="2 3"
                opacity={0.6}
              />
              {/* Lower 1 Sigma */}
              <line
                x1={0}
                y1={priceToY(sessionVwap.lower1Sigma)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.lower1Sigma)}
                stroke="#fbbf24"
                strokeWidth={0.8}
                strokeDasharray="2 3"
                opacity={0.6}
              />
              {/* Main VWAP */}
              <line
                x1={0}
                y1={priceToY(sessionVwap.price)}
                x2={chartWidth}
                y2={priceToY(sessionVwap.price)}
                stroke="#f59e0b"
                strokeWidth={2}
              />
              <text
                x={12}
                y={priceToY(sessionVwap.price) - 5}
                fill="#f59e0b"
                fontSize={9}
                fontFamily="monospace"
                fontWeight="bold"
              >
                Session VWAP: ${sessionVwap.price.toLocaleString()}
              </text>
            </g>
          )}

          {/* Candlesticks */}
          <g className="candles-layer">
            {candles.map((c, i) => {
              const x = i * candleSpacing + candleSpacing / 2;
              const yOpen = priceToY(c.open);
              const yClose = priceToY(c.close);
              const yHigh = priceToY(c.high);
              const yLow = priceToY(c.low);

              const isGreen = c.close >= c.open;
              const candleColor = isGreen ? '#10b981' : '#ef4444';
              const bodyY = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

              return (
                <g
                  key={c.timestamp}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoverCandle(c)}
                  onMouseLeave={() => setHoverCandle(null)}
                >
                  {/* Wick */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth={1.2}
                  />
                  {/* Body */}
                  <rect
                    x={x - candleBodyWidth / 2}
                    y={bodyY}
                    width={candleBodyWidth}
                    height={bodyHeight}
                    fill={candleColor}
                    rx={1}
                  />
                </g>
              );
            })}
          </g>

          {/* Volume Profile on the Right */}
          {showProfile && volumeProfile.bins.length > 0 && (
            <g className="volume-profile-layer" transform={`translate(${chartWidth}, 0)`}>
              {/* Profile Background Container */}
              <rect
                x={0}
                y={marginTop}
                width={profileWidth}
                height={chartHeight}
                fill="#020617"
                opacity={0.8}
                stroke="#1e293b"
              />

              {/* Volume Profile Bins */}
              {(() => {
                const maxBinVol = Math.max(...volumeProfile.bins.map((b) => b.volume));
                const numBins = volumeProfile.bins.length;
                const binHeight = chartHeight / numBins;

                return volumeProfile.bins.map((bin, idx) => {
                  const y = priceToY(bin.price);
                  const barWidth = maxBinVol > 0 ? (bin.volume / maxBinVol) * (profileWidth - 10) : 0;
                  const isPOC = bin.isPOC;
                  const isVA = bin.isInValueArea;

                  return (
                    <g key={idx}>
                      <rect
                        x={0}
                        y={y - binHeight / 2}
                        width={barWidth}
                        height={Math.max(1.5, binHeight - 1)}
                        fill={isPOC ? '#f59e0b' : isVA ? 'url(#profileGradientVA)' : 'url(#profileGradientNonVA)'}
                      />
                      {isPOC && (
                        <line
                          x1={-chartWidth}
                          y1={y}
                          x2={profileWidth}
                          y2={y}
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                        />
                      )}
                    </g>
                  );
                });
              })()}

              {/* Profile Labels */}
              <text x={10} y={priceToY(volumeProfile.vah) - 4} fill="#38bdf8" fontSize={9} fontFamily="monospace" fontWeight="bold">
                VAH: ${volumeProfile.vah.toLocaleString()}
              </text>
              <text x={10} y={priceToY(volumeProfile.poc) - 4} fill="#f59e0b" fontSize={9} fontFamily="monospace" fontWeight="bold">
                POC: ${volumeProfile.poc.toLocaleString()}
              </text>
              <text x={10} y={priceToY(volumeProfile.val) + 12} fill="#38bdf8" fontSize={9} fontFamily="monospace" fontWeight="bold">
                VAL: ${volumeProfile.val.toLocaleString()}
              </text>
            </g>
          )}

          {/* Current Spot Price Tracker Line */}
          <g className="spot-price-tracker">
            <line
              x1={0}
              y1={priceToY(currentPrice)}
              x2={chartWidth + profileWidth}
              y2={priceToY(currentPrice)}
              stroke="#06b6d4"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
            <rect
              x={chartWidth + profileWidth - 65}
              y={priceToY(currentPrice) - 9}
              width={60}
              height={18}
              fill="#06b6d4"
              rx={3}
            />
            <text
              x={chartWidth + profileWidth - 35}
              y={priceToY(currentPrice) + 4}
              fill="#0f172a"
              fontSize={10}
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              ${currentPrice >= 1000 ? Math.round(currentPrice) : currentPrice.toFixed(2)}
            </text>
          </g>
        </svg>
      </div>

      {/* Profile Metrics Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">POINT OF CONTROL (POC):</span>
          <span className="text-amber-400 font-bold text-sm">
            ${volumeProfile.poc.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Max traded volume node</span>
        </div>

        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">VALUE AREA HIGH (VAH):</span>
          <span className="text-cyan-300 font-bold text-sm">
            ${volumeProfile.vah.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Upper 70% value cutoff</span>
        </div>

        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">VALUE AREA LOW (VAL):</span>
          <span className="text-cyan-300 font-bold text-sm">
            ${volumeProfile.val.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Lower 70% value cutoff</span>
        </div>

        <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
          <span className="text-slate-400 text-[10px] block">SESSION VWAP:</span>
          <span className="text-amber-300 font-bold text-sm">
            ${sessionVwap.price.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">±1σ: ${sessionVwap.lower1Sigma.toLocaleString()} - ${sessionVwap.upper1Sigma.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
