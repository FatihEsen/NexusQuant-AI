import { useMemo, useState } from 'react';
import { Play, Search, ShieldAlert } from 'lucide-react';
import { getT } from '../i18n/translations';
import {
  ApiSettings,
  DataFeedsConfig,
  Language,
  MarketPulseData,
  ModularSkillsConfig,
  SignalLogEntry,
  StrategyConfig,
  TokenOptimizationConfig,
  ToolTraceItem,
} from '../types';

interface SimulatorViewProps {
  language: Language;
  settings: ApiSettings;
  strategy: StrategyConfig;
  tokenOpt: TokenOptimizationConfig;
  feeds: DataFeedsConfig;
  skills: ModularSkillsConfig;
  marketPulse: MarketPulseData | null;
  logs: SignalLogEntry[];
  onAddLog: (entry: SignalLogEntry) => void;
}

type ScenarioId = 'live_okx' | 'oversold_long' | 'overbought_short' | 'idle_neutral';
type LogFilter = 'all' | 'BUY' | 'SELL' | 'HOLD' | 'PRE_FILTERED';

interface LastSimulationResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  positionMultiplier: number;
  journalNote: string;
  approved: boolean;
  tokensUsed: number;
  promptTokens: number;
  outputTokens: number;
  tokensSavedPct: number;
  toolTrace: ToolTraceItem[];
  preFiltered?: boolean;
}

export function SimulatorView({
  language,
  settings,
  strategy,
  tokenOpt,
  feeds,
  skills,
  marketPulse,
  logs,
  onAddLog,
}: SimulatorViewProps) {
  const t = getT(language);

  const [pair, setPair] = useState<string>(strategy.pairs[0] || 'BTC/USDT');
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '1h'>(strategy.timeframe);
  const [scenario, setScenario] = useState<ScenarioId>('oversold_long');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LastSimulationResult | null>(null);

  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const scenarioMetrics = useMemo(() => {
    const livePair = marketPulse?.pairs[pair];
    if (scenario === 'live_okx' && livePair) {
      return {
        rsi: livePair.rsi,
        atrPct: 1.42,
        compactCsv: livePair.compactCsv,
        rawChars: livePair.compactCsv.length * 3.5,
      };
    }
    if (scenario === 'oversold_long') {
      const csv = [
        't,o,h,l,c,v',
        '29910450,89420.5,89490.0,89110.2,89160.0,142.4',
        '29910465,89160.0,89210.4,88840.0,88905.5,188.2',
        '29910480,88905.5,88960.0,88510.0,88590.2,231.9',
        '29910495,88590.2,88720.0,88490.5,88695.0,196.7',
        '29910510,88695.0,88980.4,88650.0,88940.8,214.1',
      ].join('\n');
      return { rsi: 27.4, atrPct: 1.38, compactCsv: csv, rawChars: csv.length * 3.4 };
    }
    if (scenario === 'overbought_short') {
      const csv = [
        't,o,h,l,c,v',
        '29910450,90120.0,90480.0,90090.0,90440.5,198.3',
        '29910465,90440.5,90890.0,90410.0,90825.0,254.6',
        '29910480,90825.0,91180.0,90790.0,91090.4,289.1',
        '29910495,91090.4,91260.0,90940.0,90995.2,221.0',
        '29910510,90995.2,91040.0,90680.5,90730.0,240.8',
      ].join('\n');
      return { rsi: 74.2, atrPct: 1.64, compactCsv: csv, rawChars: csv.length * 3.4 };
    }
    const idleCsv = [
      't,o,h,l,c,v',
      '29910450,89610.0,89680.0,89540.0,89630.0,88.1',
      '29910465,89630.0,89670.0,89590.0,89615.0,76.4',
      '29910480,89615.0,89660.0,89560.0,89640.0,82.0',
      '29910495,89640.0,89695.0,89600.0,89655.0,79.5',
      '29910510,89655.0,89700.0,89610.0,89645.0,84.2',
    ].join('\n');
    return { rsi: 48.6, atrPct: 0.42, compactCsv: idleCsv, rawChars: idleCsv.length * 3.4 };
  }, [scenario, marketPulse, pair]);

  const isPreFilteredByGatekeeper =
    tokenOpt.preFilterEnabled &&
    scenarioMetrics.rsi >= strategy.rsiOversold &&
    scenarioMetrics.rsi <= strategy.rsiOverbought;

  const runSimulation = async (forceBypassGatekeeper = false) => {
    setErrorMsg(null);

    if (isPreFilteredByGatekeeper && !forceBypassGatekeeper) {
      const skippedEntry: SignalLogEntry = {
        id: `sig-${Date.now()}`,
        timestamp: new Date().toISOString(),
        pair,
        timeframe,
        triggerType: `Idle Candle (RSI ${scenarioMetrics.rsi})`,
        rsi: scenarioMetrics.rsi,
        action: 'HOLD',
        confidence: 0,
        tokensUsed: 0,
        tokensSavedPct: 100,
        reasoningEn: `Pre-Filter Gatekeeper blocked API call: RSI ${scenarioMetrics.rsi} is inside neutral zone (${strategy.rsiOversold}–${strategy.rsiOverbought}).`,
        reasoningTr: `Ön Filtre Kapısı API çağrısını engelledi: RSI ${scenarioMetrics.rsi} nötr bölgede (${strategy.rsiOversold}–${strategy.rsiOverbought}).`,
        positionMultiplier: 1.0,
        executionStatus: 'PRE_FILTERED_IDLE',
        compactCsv: scenarioMetrics.compactCsv,
      };
      onAddLog(skippedEntry);
      setLastResult({
        action: 'HOLD',
        confidence: 0,
        reasoning: language === 'tr' ? skippedEntry.reasoningTr : skippedEntry.reasoningEn,
        positionMultiplier: 1.0,
        journalNote: '',
        approved: false,
        tokensUsed: 0,
        promptTokens: 0,
        outputTokens: 0,
        tokensSavedPct: 100,
        toolTrace: [],
        preFiltered: true,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/gemini/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          timeframe,
          language,
          scenario,
          rsi: scenarioMetrics.rsi,
          emaFast: strategy.emaFast,
          emaSlow: strategy.emaSlow,
          atrPct: scenarioMetrics.atrPct,
          confidenceThreshold: strategy.confidenceThreshold,
          baseStakeUsdt: strategy.baseStakeUsdt,
          feeds,
          enabledSkills: skills,
          customGeminiKey: settings.geminiApiKey || undefined,
          compactCsv: scenario === 'live_okx' ? undefined : scenarioMetrics.compactCsv,
          rawJsonChars: Math.round(scenarioMetrics.rawChars),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      const executionStatus = data.decision.approved
        ? 'APPROVED'
        : data.decision.action === 'HOLD'
          ? 'REJECTED_THRESHOLD'
          : 'REJECTED_THRESHOLD';

      const newLog: SignalLogEntry = {
        id: `sig-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        pair,
        timeframe,
        triggerType: `RSI ${scenarioMetrics.rsi} · ${timeframe}`,
        rsi: scenarioMetrics.rsi,
        action: data.decision.action,
        confidence: data.decision.confidence,
        tokensUsed: data.usage.totalTokens,
        tokensSavedPct: data.payloadStats.tokensSavedPct,
        reasoningEn: data.decision.reasoning,
        reasoningTr: data.decision.reasoning,
        journalNoteEn: data.decision.journal_note,
        journalNoteTr: data.decision.journal_note,
        positionMultiplier: data.decision.position_multiplier,
        executionStatus,
        toolTrace: data.toolTrace,
        compactCsv: data.payloadStats.compactCsv,
      };

      onAddLog(newLog);
      setLastResult({
        action: data.decision.action,
        confidence: data.decision.confidence,
        reasoning: data.decision.reasoning,
        positionMultiplier: data.decision.position_multiplier,
        journalNote: data.decision.journal_note,
        approved: data.decision.approved,
        tokensUsed: data.usage.totalTokens,
        promptTokens: data.usage.promptTokens,
        outputTokens: data.usage.outputTokens,
        tokensSavedPct: data.payloadStats.tokensSavedPct,
        toolTrace: data.toolTrace || [],
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (logFilter === 'PRE_FILTERED' && entry.executionStatus !== 'PRE_FILTERED_IDLE') {
        return false;
      }
      if (
        (logFilter === 'BUY' || logFilter === 'SELL' || logFilter === 'HOLD') &&
        entry.action !== logFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const reason = (language === 'tr' ? entry.reasoningTr : entry.reasoningEn).toLowerCase();
        return entry.pair.toLowerCase().includes(q) || reason.includes(q);
      }
      return true;
    });
  }, [logs, logFilter, searchQuery, language]);

  const compactChars = scenarioMetrics.compactCsv.length;
  const rawChars = Math.round(scenarioMetrics.rawChars);
  const reductionPct = Math.round(((rawChars - compactChars) / rawChars) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
          {t.simulator.title}
        </h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">{t.simulator.subtitle}</p>
      </div>

      {/* Interactive Workbench */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-5 bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-5">
          <div className="pb-3 border-b border-slate-800/80">
            <h3 className="text-base font-semibold text-slate-100">
              {t.simulator.controlsTitle}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.simulator.pairLabel}
              </label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {strategy.pairs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.simulator.timeframeLabel}
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as '5m' | '15m' | '1h')}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {t.simulator.scenarioLabel}
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioId)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="oversold_long">{t.simulator.scenarios.oversold_long}</option>
              <option value="overbought_short">{t.simulator.scenarios.overbought_short}</option>
              <option value="live_okx">{t.simulator.scenarios.live_okx}</option>
              <option value="idle_neutral">{t.simulator.scenarios.idle_neutral}</option>
            </select>
          </div>

          {/* Compact Payload Preview */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                {t.simulator.payloadComparison}
              </span>
              <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                -{reductionPct}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-slate-500">{t.simulator.rawChars}</div>
                <div className="text-slate-300 mt-0.5">{rawChars} chars</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30">
                <div className="text-slate-500">{t.simulator.compactChars}</div>
                <div className="text-emerald-400 mt-0.5">{compactChars} chars</div>
              </div>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {scenarioMetrics.compactCsv}
            </pre>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => runSimulation(false)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Play className="w-4 h-4" />
            <span>{loading ? t.simulator.runningButton : t.simulator.runButton}</span>
          </button>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}
        </section>

        {/* Result & Tool Execution Trace */}
        <section className="xl:col-span-7 bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-5">
          <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-100">
              {t.simulator.decisionOutputTitle}
            </h3>
            {lastResult && (
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {t.simulator.tokensUsed}: {lastResult.tokensUsed} (In {lastResult.promptTokens} / Out{' '}
                {lastResult.outputTokens})
              </span>
            )}
          </div>

          {!lastResult && !loading && (
            <div className="py-12 text-center text-sm text-slate-400">
              {t.simulator.emptyLogs}
            </div>
          )}

          {loading && (
            <div className="py-12 space-y-3 animate-pulse">
              <div className="h-6 bg-slate-800/80 rounded w-1/3" />
              <div className="h-4 bg-slate-800/60 rounded w-5/6" />
              <div className="h-4 bg-slate-800/60 rounded w-2/3" />
            </div>
          )}

          {lastResult && !loading && (
            <div className="space-y-5">
              {lastResult.preFiltered ? (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-300">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">
                        {t.simulator.preFilterBlockedTitle}
                      </div>
                      <p className="text-xs text-amber-200/80 mt-1">
                        {t.simulator.preFilterBlockedDesc}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runSimulation(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors"
                  >
                    {t.simulator.overridePreFilter}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-400">{t.simulator.columns.action}</div>
                      <div
                        className={`mt-1 text-xl font-mono font-bold ${
                          lastResult.action === 'BUY'
                            ? 'text-emerald-400'
                            : lastResult.action === 'SELL'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                        }`}
                      >
                        {lastResult.action}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{t.simulator.confidence}</div>
                      <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-slate-100">
                        {lastResult.confidence}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">
                        {t.simulator.stakeMultiplier}
                      </div>
                      <div className="mt-1 text-xl font-mono tabular-nums font-semibold text-slate-100">
                        {lastResult.positionMultiplier}x
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{t.simulator.status}</div>
                      <div
                        className={`mt-1 text-sm font-mono font-semibold ${
                          lastResult.approved ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {lastResult.approved
                          ? t.simulator.statuses.APPROVED
                          : t.simulator.statuses.REJECTED_THRESHOLD}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 space-y-2">
                    <div className="text-xs font-medium text-slate-400">
                      {t.simulator.columns.reasoning}
                    </div>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      {lastResult.reasoning}
                    </p>
                    {lastResult.journalNote && (
                      <p className="text-xs text-slate-400 font-mono">
                        Journal: {lastResult.journalNote}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
                    <div className="text-xs font-medium text-slate-400">
                      {t.simulator.toolTraceTitle}
                    </div>
                    {lastResult.toolTrace.length === 0 ? (
                      <div className="text-xs text-slate-500">{t.simulator.noToolsCalled}</div>
                    ) : (
                      <div className="space-y-2">
                        {lastResult.toolTrace.map((trace, idx) => (
                          <div
                            key={`${trace.skill}-${idx}`}
                            className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono"
                          >
                            <div className="text-emerald-400 font-semibold">{trace.skill}()</div>
                            <div className="mt-1 text-slate-400 break-all">
                              {JSON.stringify(trace.result)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Live AI Decision & Signal Log Table */}
      <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <h3 className="text-base font-semibold text-slate-100">{t.simulator.logTitle}</h3>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.simulator.searchPlaceholder}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
              {(['all', 'BUY', 'SELL', 'HOLD', 'PRE_FILTERED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLogFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    logFilter === f
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {t.simulator.filters[f]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-xs text-slate-400">
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.time}</th>
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.pair}</th>
                <th className="py-2.5 pr-4 font-medium">{t.simulator.columns.trigger}</th>
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
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {t.simulator.emptyLogs}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 pr-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 pr-4 font-mono font-medium text-slate-100 whitespace-nowrap">
                      {row.pair} · {row.timeframe}
                    </td>
                    <td className="py-3 pr-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {row.triggerType}
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
                    <td className="py-3 pr-4 text-slate-300 max-w-md">
                      {language === 'tr' ? row.reasoningTr : row.reasoningEn}
                    </td>
                    <td className="py-3 text-right font-mono whitespace-nowrap text-slate-300">
                      {t.simulator.statuses[row.executionStatus]}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
