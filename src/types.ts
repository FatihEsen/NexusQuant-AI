export type Language = 'en' | 'tr';

export type NavTab = 'dashboard' | 'simulator' | 'export' | 'settings';

export type StorageKind = 'localStorage' | 'sessionStorage';

export type AiProvider = 'gemini' | 'groq' | 'openrouter' | 'custom';

export interface ApiSettings {
  aiProvider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  customApiBaseUrl: string;
  customApiKey: string;
  customModel: string;

  okxApiKey: string;
  okxSecretKey: string;
  okxPassphrase: string;
  freqtradeUrl: string;
  freqtradeUsername: string;
  freqtradePassword: string;
  cryptoPanicToken: string;
  tradingMode: 'dry_run' | 'live';
  storageKind: StorageKind;
}

export interface StrategyConfig {
  timeframe: '5m' | '15m' | '1h';
  rsiOversold: number;
  rsiOverbought: number;
  emaFast: number;
  emaSlow: number;
  stopLossPct: number;
  takeProfitPct: number;
  confidenceThreshold: number;
  baseStakeUsdt: number;
  maxOpenTrades: number;
  pairs: string[];
}

export interface TokenOptimizationConfig {
  preFilterEnabled: boolean;
  compactCsvMaxCandles: number;
  cooldownMinutes: number;
  atrCacheDeltaPct: number;
}

export interface DataFeedsConfig {
  fearGreed: boolean;
  cryptoPanic: boolean;
}

export interface ModularSkillsConfig {
  fetch_sentiment_and_fear_greed: boolean;
  check_multi_timeframe_trend: boolean;
  calculate_dynamic_position_size: boolean;
  post_trade_journal_summary: boolean;
}

export interface ToolTraceItem {
  skill: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface SignalLogEntry {
  id: string;
  timestamp: string;
  pair: string;
  timeframe: string;
  triggerType: string;
  rsi: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  tokensUsed: number;
  tokensSavedPct: number;
  reasoningEn: string;
  reasoningTr: string;
  journalNoteEn?: string;
  journalNoteTr?: string;
  positionMultiplier: number;
  executionStatus: 'APPROVED' | 'REJECTED_THRESHOLD' | 'PRE_FILTERED_IDLE' | 'COOLDOWN_CACHED';
  toolTrace?: ToolTraceItem[];
  compactCsv?: string;
}

export interface MarketPulsePair {
  pair: string;
  price: number;
  changePct: number;
  rsi: number;
  source: 'live' | 'fallback';
  compactCsv: string;
}

export interface MarketPulseData {
  fearGreed: {
    value: number;
    classification: string;
    timestamp: string;
    source: 'live' | 'fallback';
  };
  pairs: Record<string, MarketPulsePair>;
  fetchedAt: string;
}

export interface ConnectionTestResult {
  ai: { ok: boolean; provider: AiProvider; mode: string; detail: string };
  gemini?: { ok: boolean; mode: 'live' | 'env' | 'missing'; detail: string };
  okx: { ok: boolean; mode: 'public_ok' | 'keys_incomplete'; detail: string };
  freqtrade: { ok: boolean; reachable: boolean; detail: string };
  checkedAt: string;
}
