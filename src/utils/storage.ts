import {
  ApiSettings,
  DataFeedsConfig,
  Language,
  ModularSkillsConfig,
  SignalLogEntry,
  StorageKind,
  StrategyConfig,
  TokenOptimizationConfig,
} from '../types';

const KEYS = {
  SETTINGS: 'nq_api_settings_v1',
  STORAGE_PREF: 'nq_storage_kind_v1',
  STRATEGY: 'nq_strategy_v1',
  TOKEN_OPT: 'nq_token_opt_v1',
  FEEDS: 'nq_feeds_v1',
  SKILLS: 'nq_skills_v1',
  LOGS: 'nq_signal_logs_v1',
  LANG: 'nq_language_v1',
};

export const DEFAULT_API_SETTINGS: ApiSettings = {
  geminiApiKey: '',
  okxApiKey: '',
  okxSecretKey: '',
  okxPassphrase: '',
  freqtradeUrl: 'http://100.64.0.12:8080',
  freqtradeUsername: 'freqtrader',
  freqtradePassword: '',
  cryptoPanicToken: '',
  tradingMode: 'dry_run',
  storageKind: 'localStorage',
};

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  timeframe: '15m',
  rsiOversold: 30,
  rsiOverbought: 70,
  emaFast: 9,
  emaSlow: 21,
  stopLossPct: -3.5,
  takeProfitPct: 6.5,
  confidenceThreshold: 80,
  baseStakeUsdt: 250,
  maxOpenTrades: 4,
  pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT'],
};

export const DEFAULT_TOKEN_OPT: TokenOptimizationConfig = {
  preFilterEnabled: true,
  compactCsvMaxCandles: 10,
  cooldownMinutes: 30,
  atrCacheDeltaPct: 0.35,
};

export const DEFAULT_FEEDS: DataFeedsConfig = {
  fearGreed: true,
  cryptoPanic: true,
};

export const DEFAULT_SKILLS: ModularSkillsConfig = {
  fetch_sentiment_and_fear_greed: true,
  check_multi_timeframe_trend: true,
  calculate_dynamic_position_size: true,
  post_trade_journal_summary: true,
};

export const INITIAL_SIGNAL_LOGS: SignalLogEntry[] = [
  {
    id: 'sig-104',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    pair: 'BTC/USDT',
    timeframe: '15m',
    triggerType: 'RSI < 30 + EMA Cross',
    rsi: 28.4,
    action: 'BUY',
    confidence: 86,
    tokensUsed: 412,
    tokensSavedPct: 71,
    reasoningEn: 'RSI oversold rebound aligns with 1H/4H bullish EMA structure and constructive spot inflows.',
    reasoningTr: 'Aşırı satım RSI tepkisi, 1S/4S yükseliş EMA yapısı ve pozitif spot girişleriyle örtüşüyor.',
    journalNoteEn: 'Entered BTC/USDT at 0.95x stake after multi-timeframe support confirmation.',
    journalNoteTr: 'Çoklu zaman dilimi destek onayı sonrası BTC/USDT için 0.95x pozisyon açıldı.',
    positionMultiplier: 0.95,
    executionStatus: 'APPROVED',
  },
  {
    id: 'sig-103',
    timestamp: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
    pair: 'ETH/USDT',
    timeframe: '15m',
    triggerType: 'Idle Candle (46.2 RSI)',
    rsi: 46.2,
    action: 'HOLD',
    confidence: 0,
    tokensUsed: 0,
    tokensSavedPct: 100,
    reasoningEn: 'Pre-Filter Gatekeeper blocked API call: indicators within neutral zone.',
    reasoningTr: 'Ön Filtre Kapısı API çağrısını engelledi: göstergeler nötr bölgede.',
    positionMultiplier: 1.0,
    executionStatus: 'PRE_FILTERED_IDLE',
  },
  {
    id: 'sig-102',
    timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    pair: 'SOL/USDT',
    timeframe: '15m',
    triggerType: 'RSI > 70 Exhaustion',
    rsi: 73.1,
    action: 'HOLD',
    confidence: 68,
    tokensUsed: 389,
    tokensSavedPct: 69,
    reasoningEn: 'Overbought RSI observed, but 4H momentum remains elevated; confidence below 80% threshold.',
    reasoningTr: 'Aşırı alım RSI gözlendi ancak 4S momentum güçlü kalıyor; güven skoru %80 eşiğinin altında.',
    journalNoteEn: 'Skipped counter-trend short due to strong 4H trend alignment.',
    journalNoteTr: 'Güçlü 4S trend uyumu nedeniyle ters yönlü kısa işlem atlandı.',
    positionMultiplier: 0.65,
    executionStatus: 'REJECTED_THRESHOLD',
  },
  {
    id: 'sig-101',
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    pair: 'AVAX/USDT',
    timeframe: '15m',
    triggerType: 'ATR Cache Hit (Cooldown)',
    rsi: 29.8,
    action: 'HOLD',
    confidence: 72,
    tokensUsed: 0,
    tokensSavedPct: 100,
    reasoningEn: 'Reused cached AI decision within 30m cooldown window (ATR delta < 0.35%).',
    reasoningTr: '30 dk bekleme penceresi içinde önbelleğe alınmış AI kararı kullanıldı (ATR farkı < %0.35).',
    positionMultiplier: 0.7,
    executionStatus: 'COOLDOWN_CACHED',
  },
];

function getStorage(kind: StorageKind): Storage {
  return kind === 'sessionStorage' ? window.sessionStorage : window.localStorage;
}

export function loadStorageKind(): StorageKind {
  try {
    const saved = window.localStorage.getItem(KEYS.STORAGE_PREF);
    return saved === 'sessionStorage' ? 'sessionStorage' : 'localStorage';
  } catch {
    return 'localStorage';
  }
}

export function loadApiSettings(): ApiSettings {
  const kind = loadStorageKind();
  try {
    const raw = getStorage(kind).getItem(KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_API_SETTINGS, storageKind: kind };
    return { ...DEFAULT_API_SETTINGS, ...JSON.parse(raw), storageKind: kind };
  } catch {
    return { ...DEFAULT_API_SETTINGS, storageKind: kind };
  }
}

export function saveApiSettings(settings: ApiSettings): void {
  try {
    window.localStorage.setItem(KEYS.STORAGE_PREF, settings.storageKind);
    const active = getStorage(settings.storageKind);
    const other = getStorage(
      settings.storageKind === 'localStorage' ? 'sessionStorage' : 'localStorage'
    );
    active.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    other.removeItem(KEYS.SETTINGS);
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredCredentials(): void {
  try {
    window.localStorage.removeItem(KEYS.SETTINGS);
    window.sessionStorage.removeItem(KEYS.SETTINGS);
  } catch {
    // Ignore
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore
  }
}

export function loadLanguage(): Language {
  try {
    const v = window.localStorage.getItem(KEYS.LANG);
    return v === 'tr' ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

export function saveLanguage(lang: Language): void {
  try {
    window.localStorage.setItem(KEYS.LANG, lang);
  } catch {
    // Ignore
  }
}

export function loadStrategyConfig(): StrategyConfig {
  return loadJson(KEYS.STRATEGY, DEFAULT_STRATEGY_CONFIG);
}

export function saveStrategyConfig(cfg: StrategyConfig): void {
  saveJson(KEYS.STRATEGY, cfg);
}

export function loadTokenOpt(): TokenOptimizationConfig {
  return loadJson(KEYS.TOKEN_OPT, DEFAULT_TOKEN_OPT);
}

export function saveTokenOpt(cfg: TokenOptimizationConfig): void {
  saveJson(KEYS.TOKEN_OPT, cfg);
}

export function loadDataFeeds(): DataFeedsConfig {
  return loadJson(KEYS.FEEDS, DEFAULT_FEEDS);
}

export function saveDataFeeds(cfg: DataFeedsConfig): void {
  saveJson(KEYS.FEEDS, cfg);
}

export function loadSkills(): ModularSkillsConfig {
  return loadJson(KEYS.SKILLS, DEFAULT_SKILLS);
}

export function saveSkills(cfg: ModularSkillsConfig): void {
  saveJson(KEYS.SKILLS, cfg);
}

export function loadSignalLogs(): SignalLogEntry[] {
  try {
    const raw = window.localStorage.getItem(KEYS.LOGS);
    if (!raw) return INITIAL_SIGNAL_LOGS;
    const parsed = JSON.parse(raw) as SignalLogEntry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SIGNAL_LOGS;
  } catch {
    return INITIAL_SIGNAL_LOGS;
  }
}

export function saveSignalLogs(logs: SignalLogEntry[]): void {
  try {
    window.localStorage.setItem(KEYS.LOGS, JSON.stringify(logs.slice(0, 40)));
  } catch {
    // Ignore
  }
}
