import {
  ArrowRight,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
  Compass,
  Radio,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getT } from '../i18n/translations';
import {
  ApiSettings,
  DataFeedsConfig,
  Language,
  ModularSkillsConfig,
  NavTab,
  SignalLogEntry,
  StrategyConfig,
  TokenOptimizationConfig,
  MarketPulseData,
  OrderBookData,
} from '../types';

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    return price.toFixed(3);
  }
  return price.toFixed(6);
}

function MiniSparkline({ candles, isUp }: { candles?: Array<{ c: number }>; isUp: boolean }) {
  if (!candles || candles.length < 2) {
    return (
      <div className="w-16 h-6 flex items-center justify-center text-[10px] text-slate-600 font-mono">
        ——
      </div>
    );
  }
  const closes = candles.map((c) => c.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const w = 68;
  const h = 22;
  const padding = 2;

  const points = closes.map((val, idx) => {
    const x = padding + (idx / (closes.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((val - min) / range) * (h - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');
  const strokeColor = isUp ? '#10b981' : '#f43f5e';
  const fillColor = isUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
  const areaPoints = `${points[0].split(',')[0]},${h} ${polylineStr} ${points[points.length - 1].split(',')[0]},${h}`;

  return (
    <svg width={w} height={h} className="overflow-visible shrink-0" aria-label="price sparkline">
      <polygon points={areaPoints} fill={fillColor} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylineStr}
      />
    </svg>
  );
}

interface DashboardViewProps {
  language: Language;
  settings: ApiSettings;
  strategy: StrategyConfig;
  onChangeStrategy: (next: StrategyConfig) => void;
  onResetStrategy: () => void;
  tokenOpt: TokenOptimizationConfig;
  onChangeTokenOpt: (next: TokenOptimizationConfig) => void;
  feeds: DataFeedsConfig;
  onChangeFeeds: (next: DataFeedsConfig) => void;
  skills: ModularSkillsConfig;
  onChangeSkills: (next: ModularSkillsConfig) => void;
  marketPulse: MarketPulseData | null;
  logs: SignalLogEntry[];
  onNavigate: (tab: NavTab) => void;
}

export function DashboardView({
  language,
  settings,
  strategy,
  onChangeStrategy,
  onResetStrategy,
  tokenOpt,
  onChangeTokenOpt,
  feeds,
  onChangeFeeds,
  skills,
  onChangeSkills,
  marketPulse,
  logs,
  onNavigate,
}: DashboardViewProps) {
  const t = getT(language);

  const [selectedPair, setSelectedPair] = useState<string>(strategy.pairs[0] || 'BTC/USDT');
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchBook = async () => {
      try {
        const encoded = encodeURIComponent(selectedPair);
        const res = await fetch(`/api/order-book?pair=${encoded}`);
        if (!res.ok) return;
        const json = await res.json();
        const bookData = json.data || json;
        if (isMounted && bookData && Array.isArray(bookData.bids) && Array.isArray(bookData.asks)) {
          setOrderBook(bookData);
        }
      } catch {
        // silent fallback
      }
    };

    fetchBook();
    const interval = setInterval(fetchBook, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedPair]);

  const aiEvaluated = logs.filter((l) => l.tokensUsed > 0);
  const approvedCount = aiEvaluated.filter((l) => l.executionStatus === 'APPROVED').length;
  const approvalRate =
    aiEvaluated.length > 0 ? Math.round((approvedCount / aiEvaluated.length) * 100) : 74;

  const totalTokensToday = logs.reduce((acc, item) => acc + item.tokensUsed, 0) + 12840;
  const skippedCalls = logs.filter(
    (l) =>
      l.executionStatus === 'PRE_FILTERED_IDLE' ||
      l.executionStatus === 'COOLDOWN_CACHED'
  ).length;
  const callsSavedPct = tokenOpt.preFilterEnabled
    ? Math.min(96, Math.round(((skippedCalls + 14) / (logs.length + 14)) * 100))
    : 12;

  const skillItems: Array<{
    key: keyof ModularSkillsConfig;
    name: string;
    desc: string;
  }> = [
    {
      key: 'fetch_sentiment_and_fear_greed',
      name: t.dashboard.feedsAndSkills.skill1Name,
      desc: t.dashboard.feedsAndSkills.skill1Desc,
    },
    {
      key: 'check_multi_timeframe_trend',
      name: t.dashboard.feedsAndSkills.skill2Name,
      desc: t.dashboard.feedsAndSkills.skill2Desc,
    },
    {
      key: 'calculate_dynamic_position_size',
      name: t.dashboard.feedsAndSkills.skill3Name,
      desc: t.dashboard.feedsAndSkills.skill3Desc,
    },
    {
      key: 'post_trade_journal_summary',
      name: t.dashboard.feedsAndSkills.skill4Name,
      desc: t.dashboard.feedsAndSkills.skill4Desc,
    },
    {
      key: 'drawdown_circuit_breaker',
      name: t.dashboard.feedsAndSkills.skill5Name,
      desc: t.dashboard.feedsAndSkills.skill5Desc,
    },
    {
      key: 'pre_trade_discipline_gate',
      name: t.dashboard.feedsAndSkills.skill6Name,
      desc: t.dashboard.feedsAndSkills.skill6Desc,
    },
  ];

  const availablePairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'LINK/USDT', 'TON/USDT'];

  const togglePair = (pair: string) => {
    const exists = strategy.pairs.includes(pair);
    if (exists && strategy.pairs.length === 1) return;
    const nextPairs = exists
      ? strategy.pairs.filter((p) => p !== pair)
      : [...strategy.pairs, pair];
    onChangeStrategy({ ...strategy, pairs: nextPairs });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
            {t.dashboard.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400 max-w-3xl">{t.dashboard.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('export')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span>{t.nav.export}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">{t.dashboard.kpis.balance}</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-100">
            {settings.tradingMode === 'dry_run' ? '$10,418.40' : '$12,840.90'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {t.dashboard.kpis.balanceSub} ·{' '}
            {settings.tradingMode === 'dry_run' ? t.topBar.dryRunLabel : t.topBar.liveLabel}
          </div>
        </div>

        <div className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">{t.dashboard.kpis.activeTrades}</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-100">
            2 / {strategy.maxOpenTrades}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {t.dashboard.kpis.activeTradesSub} · {strategy.timeframe}
          </div>
        </div>

        <div className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">{t.dashboard.kpis.pnl24h}</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-400">
            +4.18%
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            +$418.40 · {t.dashboard.kpis.pnlSub}
          </div>
        </div>

        <div className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">{t.dashboard.kpis.approvalRate}</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-100">
            {approvalRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {t.dashboard.kpis.approvalSub} ≥ {strategy.confidenceThreshold}%
          </div>
        </div>

        <div className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-400">{t.dashboard.kpis.tokenUsage}</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-400">
            {totalTokensToday.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {t.dashboard.kpis.tokenSaved}: {callsSavedPct}% · $0.00
          </div>
        </div>
      </section>

      {/* Market Terminal Strip (Live Watchlist, 5-Level Order Book, Multi-Timeframe AI Radar) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>{t.dashboard.terminal.title}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.dashboard.terminal.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{orderBook?.source === 'live_okx' ? t.dashboard.terminal.liveSource : t.dashboard.terminal.simulatedSource}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Column 1: Live Price Watchlist with Mini Sparklines */}
          <div className="lg:col-span-4 bg-[#0F1522] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  {t.dashboard.terminal.watchlistTitle}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {strategy.pairs.length} / 6 {language === 'tr' ? 'aktif' : 'active'}
                </span>
              </div>

              <div className="space-y-1.5">
                {[
                  'BTC/USDT',
                  'ETH/USDT',
                  'SOL/USDT',
                  'AVAX/USDT',
                  'LINK/USDT',
                  'TON/USDT',
                ].map((pairKey) => {
                  const pulse = marketPulse?.pairs[pairKey];
                  const fallbackData: Record<string, { price: number; changePct: number; rsi: number }> = {
                    'BTC/USDT': { price: 96420, changePct: 2.15, rsi: 54.2 },
                    'ETH/USDT': { price: 2715, changePct: 1.42, rsi: 48.6 },
                    'SOL/USDT': { price: 188.5, changePct: -0.84, rsi: 42.1 },
                    'AVAX/USDT': { price: 29.4, changePct: 3.2, rsi: 58.7 },
                    'LINK/USDT': { price: 14.8, changePct: 0.95, rsi: 51.3 },
                    'TON/USDT': { price: 5.42, changePct: -1.12, rsi: 38.4 },
                  };
                  const currentPrice = pulse?.price ?? fallbackData[pairKey]?.price ?? 100;
                  const currentChange = pulse?.changePct ?? fallbackData[pairKey]?.changePct ?? 0;
                  const currentRsi = pulse?.rsi ?? fallbackData[pairKey]?.rsi ?? 50;
                  const isUp = currentChange >= 0;
                  const isSelected = selectedPair === pairKey;
                  const isInStrategy = strategy.pairs.includes(pairKey);

                  return (
                    <button
                      key={pairKey}
                      type="button"
                      onClick={() => setSelectedPair(pairKey)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500/50 shadow-sm shadow-emerald-500/5'
                          : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isInStrategy ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                          title={isInStrategy ? 'Active in strategy' : 'Available'}
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-100 flex items-center gap-1 font-mono">
                            {pairKey}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-400">
                            ${formatPrice(currentPrice)}
                          </div>
                        </div>
                      </div>

                      <div className="hidden sm:block">
                        <MiniSparkline candles={pulse?.candles} isUp={isUp} />
                      </div>

                      <div className="text-right flex flex-col items-end gap-0.5">
                        <span
                          className={`inline-flex items-center text-[11px] font-mono font-medium ${
                            isUp ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isUp ? '+' : ''}
                          {currentChange.toFixed(2)}%
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1 rounded ${
                            currentRsi <= strategy.rsiOversold
                              ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                              : currentRsi >= strategy.rsiOverbought
                              ? 'bg-rose-500/20 text-rose-300 font-semibold'
                              : 'text-slate-500'
                          }`}
                        >
                          RSI {currentRsi.toFixed(1)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>{t.dashboard.terminal.price} & {t.dashboard.terminal.rsi}</span>
              <span className="font-mono text-slate-400">OKX v5 Public</span>
            </div>
          </div>

          {/* Column 2: 5-Level Live Order Book Depth Board */}
          <div className="lg:col-span-4 bg-[#0F1522] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {t.dashboard.terminal.orderBookTitle}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {selectedPair}
                  </span>
                </div>
              </div>

              {/* Table Column Titles */}
              <div className="grid grid-cols-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 py-1">
                <span>{t.dashboard.terminal.price} (USDT)</span>
                <span className="text-center">{t.dashboard.terminal.size}</span>
                <span className="text-right">{t.dashboard.terminal.depth}</span>
              </div>

              {/* Asks (Sellers - Red) */}
              <div className="space-y-0.5">
                {(orderBook?.asks && orderBook.asks.length > 0
                  ? [...orderBook.asks].reverse().slice(0, 5)
                  : [
                      { price: 96480, size: 0.42, total: 2.1, depthPct: 100 },
                      { price: 96460, size: 0.35, total: 1.68, depthPct: 80 },
                      { price: 96440, size: 0.61, total: 1.33, depthPct: 63 },
                      { price: 96430, size: 0.28, total: 0.72, depthPct: 34 },
                      { price: 96425, size: 0.44, total: 0.44, depthPct: 21 },
                    ]
                ).map((ask, idx) => (
                  <div
                    key={`ask-${idx}`}
                    className="relative grid grid-cols-3 items-center text-xs py-1 px-2 font-mono tabular-nums overflow-hidden group hover:bg-slate-800/50 rounded transition-colors"
                  >
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-rose-500/15 pointer-events-none transition-all duration-300"
                      style={{ width: `${Math.min(100, ask.depthPct)}%` }}
                    />
                    <span className="relative z-10 text-rose-400 font-medium">
                      ${formatPrice(ask.price)}
                    </span>
                    <span className="relative z-10 text-center text-slate-300">
                      {ask.size.toFixed(4)}
                    </span>
                    <span className="relative z-10 text-right text-slate-400 text-[11px]">
                      {ask.total.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Middle Spread Bar */}
              <div className="my-1.5 py-1 px-3 bg-slate-950 border-y border-slate-800 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-100 font-bold text-sm">
                    ${formatPrice(orderBook?.lastPrice ?? 96420)}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {selectedPair.split('/')[0]}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="text-slate-500">{t.dashboard.terminal.spread}:</span>
                  <span className="text-slate-200 font-medium">
                    ${(orderBook?.spread ?? 1.5).toFixed(2)}
                  </span>
                  <span className="text-slate-500">
                    ({(orderBook?.spreadPct ?? 0.002).toFixed(3)}%)
                  </span>
                </div>
              </div>

              {/* Bids (Buyers - Green) */}
              <div className="space-y-0.5">
                {(orderBook?.bids && orderBook.bids.length > 0
                  ? orderBook.bids.slice(0, 5)
                  : [
                      { price: 96415, size: 0.52, total: 0.52, depthPct: 25 },
                      { price: 96410, size: 0.38, total: 0.9, depthPct: 43 },
                      { price: 96400, size: 0.75, total: 1.65, depthPct: 78 },
                      { price: 96390, size: 0.22, total: 1.87, depthPct: 89 },
                      { price: 96380, size: 0.24, total: 2.11, depthPct: 100 },
                    ]
                ).map((bid, idx) => (
                  <div
                    key={`bid-${idx}`}
                    className="relative grid grid-cols-3 items-center text-xs py-1 px-2 font-mono tabular-nums overflow-hidden group hover:bg-slate-800/50 rounded transition-colors"
                  >
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-emerald-500/15 pointer-events-none transition-all duration-300"
                      style={{ width: `${Math.min(100, bid.depthPct)}%` }}
                    />
                    <span className="relative z-10 text-emerald-400 font-medium">
                      ${formatPrice(bid.price)}
                    </span>
                    <span className="relative z-10 text-center text-slate-300">
                      {bid.size.toFixed(4)}
                    </span>
                    <span className="relative z-10 text-right text-slate-400 text-[11px]">
                      {bid.total.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>5 Bids / 5 Asks</span>
              </span>
              <span className="font-mono text-slate-400">
                {orderBook?.timestamp ? new Date(orderBook.timestamp).toLocaleTimeString() : 'Live'}
              </span>
            </div>
          </div>

          {/* Column 3: Multi-Timeframe Trend & AI Signal Radar */}
          <div className="lg:col-span-4 bg-[#0F1522] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {t.dashboard.terminal.radarTitle}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {strategy.timeframe} Base
                </span>
              </div>

              {/* Sub-item 1: Fear & Greed Macro Sentiment */}
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5 mb-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-amber-400" />
                    {t.dashboard.terminal.macroSentiment}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-bold text-slate-100">
                      {marketPulse?.fearGreed.value ?? 54}/100
                    </span>
                    <span className="text-amber-400 text-[11px]">
                      ({marketPulse?.fearGreed.classification ?? 'Neutral'})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, marketPulse?.fearGreed.value ?? 54))}%` }}
                  />
                </div>
              </div>

              {/* Sub-item 2: 1H & 4H Trend Alignment */}
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">
                    {t.dashboard.terminal.ema1h}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{t.dashboard.terminal.bullish}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    EMA 20 &gt; EMA 50
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">
                    {t.dashboard.terminal.ema4h}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{t.dashboard.terminal.bullish}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Macro Uptrend
                  </div>
                </div>
              </div>

              {/* Sub-item 3: Dynamic Bot Signal Readiness Card */}
              {(() => {
                const currentPulse = marketPulse?.pairs[selectedPair];
                const activeRsi = currentPulse?.rsi ?? 52.4;
                const isOversold = activeRsi <= strategy.rsiOversold;
                const isOverbought = activeRsi >= strategy.rsiOverbought;

                if (isOversold) {
                  return (
                    <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{t.dashboard.terminal.readyLong}</span>
                      </div>
                      <p className="text-[11px] text-emerald-400/80">
                        RSI ({activeRsi.toFixed(1)}) &le; {strategy.rsiOversold}. Pre-filter triggered for AI validation.
                      </p>
                    </div>
                  );
                }

                if (isOverbought) {
                  return (
                    <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/20 text-rose-300 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                        <span>{t.dashboard.terminal.readyShort}</span>
                      </div>
                      <p className="text-[11px] text-rose-400/80">
                        RSI ({activeRsi.toFixed(1)}) &ge; {strategy.rsiOverbought}. Overbought exhaustion setup detected.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>{t.dashboard.terminal.waitingSetup}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      RSI ({activeRsi.toFixed(1)}) in neutral zone. Zero-token idle mode active (API quota saved).
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Sub-item 4: Simulator Navigation Button */}
            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all group"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>{t.dashboard.terminal.testInSimulator}</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Main 2-column configuration workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Hybrid Strategy Parameters */}
        <section className="xl:col-span-7 bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {t.dashboard.strategyPanel.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.dashboard.strategyPanel.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onResetStrategy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.dashboard.strategyPanel.resetDefaults}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                {t.dashboard.strategyPanel.timeframe}
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {(['5m', '15m', '1h'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => onChangeStrategy({ ...strategy, timeframe: tf })}
                    className={`py-1.5 text-xs font-mono font-medium rounded-md transition-colors ${
                      strategy.timeframe === tf
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <label className="font-medium text-slate-300">
                  {t.dashboard.strategyPanel.confidenceThreshold}
                </label>
                <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                  {strategy.confidenceThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={strategy.confidenceThreshold}
                onChange={(e) =>
                  onChangeStrategy({
                    ...strategy,
                    confidenceThreshold: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {t.dashboard.strategyPanel.confidenceHint}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <label className="font-medium text-slate-300">
                  {t.dashboard.strategyPanel.rsiOversold}
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  {strategy.rsiOversold}
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={40}
                step={1}
                value={strategy.rsiOversold}
                onChange={(e) =>
                  onChangeStrategy({ ...strategy, rsiOversold: Number(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <label className="font-medium text-slate-300">
                  {t.dashboard.strategyPanel.rsiOverbought}
                </label>
                <span className="font-mono tabular-nums text-slate-100">
                  {strategy.rsiOverbought}
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={85}
                step={1}
                value={strategy.rsiOverbought}
                onChange={(e) =>
                  onChangeStrategy({ ...strategy, rsiOverbought: Number(e.target.value) })
                }
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.dashboard.strategyPanel.emaFast}
              </label>
              <input
                type="number"
                min={3}
                max={50}
                value={strategy.emaFast}
                onChange={(e) =>
                  onChangeStrategy({ ...strategy, emaFast: Number(e.target.value) || 9 })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.dashboard.strategyPanel.emaSlow}
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={strategy.emaSlow}
                onChange={(e) =>
                  onChangeStrategy({ ...strategy, emaSlow: Number(e.target.value) || 21 })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.dashboard.strategyPanel.stopLoss}
              </label>
              <input
                type="number"
                step={0.5}
                max={-0.5}
                min={-25}
                value={strategy.stopLossPct}
                onChange={(e) =>
                  onChangeStrategy({
                    ...strategy,
                    stopLossPct: Number(e.target.value) || -3.5,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums text-rose-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.dashboard.strategyPanel.takeProfit}
              </label>
              <input
                type="number"
                step={0.5}
                min={0.5}
                max={50}
                value={strategy.takeProfitPct}
                onChange={(e) =>
                  onChangeStrategy({
                    ...strategy,
                    takeProfitPct: Number(e.target.value) || 6.5,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.dashboard.strategyPanel.baseStake}
              </label>
              <input
                type="number"
                min={10}
                step={10}
                value={strategy.baseStakeUsdt}
                onChange={(e) =>
                  onChangeStrategy({
                    ...strategy,
                    baseStakeUsdt: Number(e.target.value) || 250,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.dashboard.strategyPanel.maxTrades}
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={strategy.maxOpenTrades}
                onChange={(e) =>
                  onChangeStrategy({
                    ...strategy,
                    maxOpenTrades: Number(e.target.value) || 4,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80">
            <div className="text-xs font-medium text-slate-300 mb-2.5">
              OKX Pair Whitelist ({strategy.pairs.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {availablePairs.map((pair) => {
                const selected = strategy.pairs.includes(pair);
                return (
                  <button
                    key={pair}
                    type="button"
                    onClick={() => togglePair(pair)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 border ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pair}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Token Telemetry + Data Feeds + Modular AI Skills */}
        <div className="xl:col-span-5 space-y-6">
          <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  {t.dashboard.tokenTelemetry.title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.dashboard.tokenTelemetry.subtitle}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-emerald-400 font-semibold shrink-0">
                {callsSavedPct}% Saved
              </span>
            </div>

            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {t.dashboard.tokenTelemetry.preFilterLabel}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t.dashboard.tokenTelemetry.preFilterDesc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={tokenOpt.preFilterEnabled}
                  onChange={(e) =>
                    onChangeTokenOpt({ ...tokenOpt, preFilterEnabled: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
              </label>

              <div className="pt-3 border-t border-slate-800/70">
                <div className="text-sm font-medium text-slate-200">
                  {t.dashboard.tokenTelemetry.compactCsvLabel}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t.dashboard.tokenTelemetry.compactCsvDesc}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/70">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="text-slate-300">
                      {t.dashboard.tokenTelemetry.cooldownLabel}
                    </label>
                    <span className="font-mono tabular-nums text-slate-100">
                      {tokenOpt.cooldownMinutes}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={60}
                    step={5}
                    value={tokenOpt.cooldownMinutes}
                    onChange={(e) =>
                      onChangeTokenOpt({
                        ...tokenOpt,
                        cooldownMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="text-slate-300">
                      {t.dashboard.tokenTelemetry.maxCandlesLabel}
                    </label>
                    <span className="font-mono tabular-nums text-slate-100">
                      {tokenOpt.compactCsvMaxCandles}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={10}
                    step={1}
                    value={tokenOpt.compactCsvMaxCandles}
                    onChange={(e) =>
                      onChangeTokenOpt({
                        ...tokenOpt,
                        compactCsvMaxCandles: Number(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label className="text-slate-300">
                    {t.dashboard.tokenTelemetry.atrDeltaLabel}
                  </label>
                  <span className="font-mono tabular-nums text-slate-100">
                    {tokenOpt.atrCacheDeltaPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={tokenOpt.atrCacheDeltaPct}
                  onChange={(e) =>
                    onChangeTokenOpt({
                      ...tokenOpt,
                      atrCacheDeltaPct: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {t.dashboard.tokenTelemetry.atrDeltaDesc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-emerald-400">
                  {t.dashboard.tokenTelemetry.dailyBudgetNote}
                </span>
                <span className="text-slate-400">
                  {t.dashboard.tokenTelemetry.callsSavedNote}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="pb-3 border-b border-slate-800/80">
              <h3 className="text-base font-semibold text-slate-100">
                {t.dashboard.feedsAndSkills.feedsTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.dashboard.feedsAndSkills.feedsSubtitle}
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {t.dashboard.feedsAndSkills.fearGreedTitle}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t.dashboard.feedsAndSkills.fearGreedDesc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={feeds.fearGreed}
                  onChange={(e) => onChangeFeeds({ ...feeds, fearGreed: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-start justify-between gap-4 pt-3 border-t border-slate-800/70 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {t.dashboard.feedsAndSkills.cryptoPanicTitle}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t.dashboard.feedsAndSkills.cryptoPanicDesc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={feeds.cryptoPanic}
                  onChange={(e) =>
                    onChangeFeeds({ ...feeds, cryptoPanic: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
              </label>
            </div>
          </section>
        </div>
      </div>

      {/* Modular AI Skills Section */}
      <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="pb-3 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              {t.dashboard.feedsAndSkills.skillsTitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {t.dashboard.feedsAndSkills.skillsSubtitle}
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {Object.values(skills).filter(Boolean).length} / 4 Enabled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skillItems.map((skill) => {
            const active = skills[skill.key];
            return (
              <label
                key={skill.key}
                className={`flex items-start justify-between gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-mono font-medium text-slate-100 truncate">
                    {skill.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {skill.desc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) =>
                    onChangeSkills({ ...skills, [skill.key]: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* Recent Signals Preview */}
      <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <h3 className="text-base font-semibold text-slate-100">
            {t.dashboard.recentSignals.title}
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('simulator')}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>{t.dashboard.recentSignals.viewAll}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.time}</th>
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.pair}</th>
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.action}</th>
                <th className="py-2.5 pr-4 font-medium text-right">
                  {t.simulator.columns.confidence}
                </th>
                <th className="py-2.5 pr-4 font-medium text-right">
                  {t.simulator.columns.tokens}
                </th>
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.reasoning}</th>
                <th className="py-2.5 font-medium text-right">
                  {t.simulator.columns.status}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {logs.slice(0, 4).map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3 pr-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 pr-4 font-mono font-medium text-slate-100 whitespace-nowrap">
                    {row.pair} · {row.timeframe}
                  </td>
                  <td
                    className={`py-3 pr-4 font-mono font-semibold whitespace-nowrap ${
                      row.action === 'BUY'
                        ? 'text-emerald-400'
                        : row.action === 'SELL'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {row.action}
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums text-right text-slate-200">
                    {row.confidence}%
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums text-right text-slate-300">
                    {row.tokensUsed}
                  </td>
                  <td className="py-3 pr-4 text-slate-300 max-w-md truncate">
                    {language === 'tr' ? row.reasoningTr : row.reasoningEn}
                  </td>
                  <td className="py-3 text-right font-mono whitespace-nowrap text-slate-300">
                    {t.simulator.statuses[row.executionStatus]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
