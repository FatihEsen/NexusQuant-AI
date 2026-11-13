import { ArrowRight, RotateCcw } from 'lucide-react';
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
} from '../types';

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
  logs,
  onNavigate,
}: DashboardViewProps) {
  const t = getT(language);

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
