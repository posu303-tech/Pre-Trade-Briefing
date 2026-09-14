export type TickerSymbol = 'BTC-USD' | 'ETH-USD' | 'SOL-USD' | 'XAUT-USD';

export type TradingSession = 'ALL' | 'ASIAN' | 'EUROPEAN' | 'US';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  vwap?: number;
}

export interface PriorDayStats {
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
}

export interface PreMarketData {
  currentPrice: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  avgVolume20d: number;
  volumeRatio20d: number;
  overnightHigh: number;
  overnightLow: number;
  sessionOpenPrice: number;
}

export interface PivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  isPOC: boolean;
  isInValueArea: boolean;
}

export interface VolumeProfileData {
  lookbackSessions: number;
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
  valueAreaVolume: number;
  bins: VolumeProfileLevel[];
}

export interface MovingAverageStatus {
  period: number;
  type: 'EMA' | 'SMA';
  value: number;
  isPriceAbove: boolean;
  distancePercent: number;
}

export interface ATRData {
  atr14Daily: number;
  atr14Hourly: number;
  atr20DailyAvg: number;
  atrRatioTo20d: number;
  volatilityRegime: 'COMPRESSED' | 'NORMAL' | 'EXPANDED' | 'EXTREME';
}

export interface FibonacciLevel {
  level: number; // e.g. 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618
  label: string;
  price: number;
}

export interface FibonacciData {
  swingHigh: number;
  swingHighDate: string;
  swingLow: number;
  swingLowDate: string;
  swingDirection: 'UP' | 'DOWN';
  levels: FibonacciLevel[];
}

export interface UntestedGap {
  id: string;
  type: 'BULLISH_FVG' | 'BEARISH_FVG' | 'SESSION_GAP' | 'CME_GAP';
  timeframe: string;
  highPrice: number;
  lowPrice: number;
  midPrice: number;
  candleDate: string;
  status: 'UNTESTED' | 'PARTIALLY_FILLED';
}

export interface OptionsData {
  isAvailable: boolean;
  unavailableReason?: string;
  sourceVenue?: string; // 'Deribit Live REST v2' | 'Unlisted'
  nearestExpiry?: string;
  putCallVolumeRatio?: number;
  putCallOIRatio?: number;
  atmIV?: number;
  realizedVol30d?: number;
  ivHvSpread?: number;
  maxPainStrike?: number;
  gammaClusterCalls: { strike: number; oi: number }[];
  gammaClusterPuts: { strike: number; oi: number }[];
  skew25d?: number;
}

export interface CatalystEvent {
  id: string;
  timeUTC: string;
  timeEST: string;
  category: 'MACRO' | 'CENTRAL_BANK' | 'CRYPTO_SPECIFIC' | 'AUCTION_EVENT' | 'EARNINGS';
  event: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  consensus?: string;
  previous?: string;
  sourceType?: 'VERIFIED_CALENDAR' | 'RECURRING_AUCTION' | 'CUSTOM_DESK' | 'NO_TIER1_CONFIRMED';
  notes: string;
}

export interface MarketStructure {
  higherTimeframeTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  higherTimeframeDetail: string;
  intradayTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  intradayDetail: string;
  trendConflict: boolean;
  conflictNotes?: string;
  dominantRegime: string; // e.g. "Balancing inside yesterday's Value Area"
  relativeStrengthDetail: string;
}

export interface KeyLevelItem {
  name: string;
  price: number;
  method: string;
  category: 'PIVOT' | 'PROFILE' | 'VWAP' | 'PRIOR_DAY' | 'MA' | 'FIB' | 'GAP';
}

export interface TradeSetup {
  setup: string;
  triggerEntry: string;
  invalidationStop: string;
  target1: string;
  target2: string;
  riskReward: string;
  volumeConfirmation: string;
  direction: 'LONG' | 'SHORT';
  entryPriceRef: number;
  stopPriceRef: number;
  target1PriceRef: number;
  target2PriceRef: number;
}

export interface PreMarketBrief {
  symbol: TickerSymbol;
  session: TradingSession;
  date: string;
  timestamp: string;
  dataSource: string;
  isStale: boolean;
  stalenessNotes?: string;
  currentPrice: number;
  
  // Section 1: One-paragraph summary bias (max 3 sentences)
  summaryBias: string;
  summaryBiasType: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  // Section 2: Key Levels table (level name, price, method)
  keyLevels: KeyLevelItem[];
  
  // Section 3: Trade Setups table
  tradeSetups: TradeSetup[];
  
  // Section 4: Risk Notes (bulleted, max 5 items)
  riskNotes: string[];

  // Supporting Underlying Computed Data
  priorDay: PriorDayStats;
  sessionVwap: {
    price: number;
    upper1Sigma: number;
    lower1Sigma: number;
    anchorDescription: string;
  };
  pivots: PivotPoints;
  volumeProfile: VolumeProfileData;
  movingAverages: MovingAverageStatus[];
  atr: ATRData;
  fibonacci: FibonacciData;
  gaps: UntestedGap[];
  marketStructure: MarketStructure;
  preMarket: PreMarketData;
  options: OptionsData;
  catalysts: CatalystEvent[];
  dailyCandles: Candle[];
  hourlyCandles: Candle[];
}
