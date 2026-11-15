import { useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  ListFilter,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wifi,
  Zap,
} from 'lucide-react';
import { getT } from '../i18n/translations';
import { AiProvider, ApiSettings, ConnectionTestResult, Language, StorageKind } from '../types';

interface SettingsViewProps {
  language: Language;
  settings: ApiSettings;
  onSaveSettings: (next: ApiSettings) => void;
  onClearKeys: () => void;
}

interface SecretInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  hint?: string;
}

function SecretInput({ label, value, onChange, placeholder, hint }: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide secret' : 'Show secret'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function formatModelLabel(opt: string): string {
  if (opt.endsWith(':free')) return `[FREE] ${opt}`;
  if (opt === 'llama-3.3-70b-versatile') return `[FREE] llama-3.3-70b-versatile (Recommended · Tool Calling)`;
  if (opt === 'llama-3.1-8b-instant') return `[FREE] llama-3.1-8b-instant (Ultra Fast · Tool Calling)`;
  if (opt === 'mixtral-8x7b-32768') return `[FREE] mixtral-8x7b-32768 (Tool Calling)`;
  if (opt === 'gemma2-9b-it') return `[FREE] gemma2-9b-it (Auto Prompt Fallback)`;
  if (opt === 'qwen-2.5-32b') return `[FREE] qwen-2.5-32b (Auto Prompt Fallback)`;
  if (opt === 'gemini-2.5-flash') return `[FREE TIER] gemini-2.5-flash (Recommended · Tool Calling)`;
  if (opt === 'gemini-2.5-flash-lite') return `[FREE TIER] gemini-2.5-flash-lite (Ultra Lightweight)`;
  return opt;
}

interface ModelControlProps {
  provider: AiProvider;
  currentModel: string;
  onChangeModel: (model: string) => void;
  options: string[];
  isFetching: boolean;
  onFetch: () => void;
  isCustomInput: boolean;
  onToggleCustomInput: () => void;
  label: string;
  fetchText: string;
  fetchingText: string;
  customToggleText: string;
  listToggleText: string;
}

function ModelControl({
  provider,
  currentModel,
  onChangeModel,
  options,
  isFetching,
  onFetch,
  isCustomInput,
  onToggleCustomInput,
  label,
  fetchText,
  fetchingText,
  customToggleText,
  listToggleText,
}: ModelControlProps) {
  const displayOptions = Array.from(new Set([currentModel, ...options])).filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-300">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCustomInput}
            className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
            title={isCustomInput ? listToggleText : customToggleText}
          >
            {isCustomInput ? (
              <>
                <ListFilter className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">{listToggleText}</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3 h-3" />
                <span>{customToggleText}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onFetch}
            disabled={isFetching}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
            title="Fetch live active models from API"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? fetchingText : fetchText}</span>
          </button>
        </div>
      </div>

      {isCustomInput ? (
        <input
          type="text"
          value={currentModel}
          onChange={(e) => onChangeModel(e.target.value)}
          placeholder={provider === 'groq' ? 'llama-3.3-70b-versatile' : 'model-id'}
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-emerald-500/80 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-400 transition-colors"
        />
      ) : (
        <select
          value={currentModel}
          onChange={(e) => onChangeModel(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          {displayOptions.map((opt) => (
            <option key={opt} value={opt}>
              {formatModelLabel(opt)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function SettingsView({
  language,
  settings,
  onSaveSettings,
  onClearKeys,
}: SettingsViewProps) {
  const t = getT(language);
  const [draft, setDraft] = useState<ApiSettings>(settings);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelFetchNotice, setModelFetchNotice] = useState<string | null>(null);
  const [onlyFreeOpenRouter, setOnlyFreeOpenRouter] = useState(false);
  const [customModelMode, setCustomModelMode] = useState<Record<AiProvider, boolean>>({
    gemini: false,
    groq: false,
    openrouter: false,
    custom: false,
  });

  const [modelOptions, setModelOptions] = useState<Record<AiProvider, string[]>>({
    gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    groq: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'qwen-2.5-32b',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    openrouter: [
      'deepseek/deepseek-r1',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.5-flash',
      'openai/gpt-4o',
    ],
    custom: ['llama3', 'mistral', 'qwen2.5'],
  });

  const handleFetchModels = async (provOverride?: AiProvider) => {
    const prov = provOverride || draft.aiProvider;
    let apiKey = '';
    let baseUrl = '';

    if (prov === 'groq') apiKey = draft.groqApiKey;
    else if (prov === 'openrouter') apiKey = draft.openRouterApiKey;
    else if (prov === 'gemini') apiKey = draft.geminiApiKey;
    else if (prov === 'custom') {
      apiKey = draft.customApiKey;
      baseUrl = draft.customApiBaseUrl;
    }

    setFetchingModels(true);
    setModelFetchNotice(null);

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: prov, apiKey, baseUrl }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.models) && data.models.length > 0) {
        setModelOptions((prev) => ({ ...prev, [prov]: data.models }));
        setModelFetchNotice(
          data.source === 'live_api' ? t.settings.liveModelsLoaded : null
        );

        // Auto-select valid model if current is invalid or decommissioned
        if (prov === 'groq') {
          if (!data.models.includes(draft.groqModel) || draft.groqModel === 'deepseek-r1-distill-llama-70b') {
            setDraft((d) => ({ ...d, groqModel: data.models[0] }));
          }
        } else if (prov === 'openrouter') {
          if (!data.models.includes(draft.openRouterModel)) {
            setDraft((d) => ({ ...d, openRouterModel: data.models[0] }));
          }
        } else if (prov === 'gemini') {
          if (!data.models.includes(draft.geminiModel)) {
            setDraft((d) => ({ ...d, geminiModel: data.models[0] }));
          }
        }
      } else {
        setModelFetchNotice(data.error || t.settings.fetchModelsError);
      }
    } catch (err) {
      setModelFetchNotice(err instanceof Error ? err.message : t.settings.fetchModelsError);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    setNotice(t.settings.savedToast);
    setTimeout(() => setNotice(null), 2600);
  };

  const handleClear = () => {
    onClearKeys();
    const emptyDraft: ApiSettings = {
      ...draft,
      geminiApiKey: '',
      groqApiKey: '',
      openRouterApiKey: '',
      customApiKey: '',
      okxApiKey: '',
      okxSecretKey: '',
      okxPassphrase: '',
      freqtradePassword: '',
      cryptoPanicToken: '',
    };
    setDraft(emptyDraft);
    setTestResult(null);
    setNotice(t.settings.keysCleared);
    setTimeout(() => setNotice(null), 2600);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      setTestResult({
        ai: data.ai || {
          ok: data.gemini?.ok ?? false,
          provider: draft.aiProvider,
          mode: data.gemini?.mode ?? 'env',
          detail: data.gemini?.detail ?? 'Tested',
        },
        gemini: data.gemini,
        okx: data.okx,
        freqtrade: data.freqtrade,
        checkedAt: new Date().toISOString(),
      });
      if (data.ai?.ok) {
        handleFetchModels(draft.aiProvider);
      }
    } catch {
      setTestResult({
        ai: { ok: false, provider: draft.aiProvider, mode: 'missing', detail: 'Network error contacting server' },
        gemini: { ok: false, mode: 'missing', detail: 'Network error contacting server' },
        okx: { ok: false, mode: 'keys_incomplete', detail: 'Could not reach server' },
        freqtrade: { ok: false, reachable: false, detail: 'Could not reach server' },
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

  const providers: Array<{ id: AiProvider; label: string; sub: string; icon: typeof Bot }> = [
    {
      id: 'gemini',
      label: 'Google Gemini',
      sub: 'Gemini 2.5 Flash / Flash Lite',
      icon: Bot,
    },
    {
      id: 'groq',
      label: 'Groq Cloud',
      sub: 'Llama 3.3 70B / DeepSeek R1',
      icon: Zap,
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      sub: 'All Frontier & Open Models',
      icon: Globe,
    },
    {
      id: 'custom',
      label: 'Custom API',
      sub: 'Local Ollama / vLLM / Proxy',
      icon: Cpu,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
          {t.settings.title}
        </h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">{t.settings.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSave}
          className="xl:col-span-7 bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-6"
        >
          {/* Trading Execution Mode */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-100">
              {t.settings.tradingModeTitle}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, tradingMode: 'dry_run' })}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  draft.tradingMode === 'dry_run'
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-sm font-semibold text-slate-100">
                  {t.settings.dryRunTitle}
                </div>
                <div className="mt-1 text-xs text-slate-400">{t.settings.dryRunDesc}</div>
              </button>

              <button
                type="button"
                onClick={() => setDraft({ ...draft, tradingMode: 'live' })}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  draft.tradingMode === 'live'
                    ? 'bg-rose-500/10 border-rose-500/40'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-sm font-semibold text-slate-100">
                  {t.settings.liveTitle}
                </div>
                <div className="mt-1 text-xs text-slate-400">{t.settings.liveDesc}</div>
              </button>
            </div>

            {draft.tradingMode === 'live' && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t.settings.liveWarning}</span>
              </div>
            )}
          </div>

          {/* AI Engine & Model Provider Section */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>{t.settings.aiSectionTitle}</span>
              </h3>
              <p className="mt-1 text-xs text-slate-400">{t.settings.aiSectionDesc}</p>
            </div>

            {/* Provider Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providers.map((p) => {
                const Icon = p.icon;
                const isSelected = draft.aiProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, aiProvider: p.id })}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">{p.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{p.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Provider-Specific Form Inputs */}
            {modelFetchNotice && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{modelFetchNotice}</span>
              </div>
            )}

            {draft.aiProvider === 'gemini' && (
              <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <SecretInput
                  label={t.settings.geminiKeyLabel}
                  value={draft.geminiApiKey}
                  onChange={(val) => setDraft({ ...draft, geminiApiKey: val })}
                  placeholder="AIzaSy..."
                  hint={t.settings.geminiKeyHint}
                />
                <ModelControl
                  provider="gemini"
                  currentModel={draft.geminiModel}
                  onChangeModel={(m) => setDraft({ ...draft, geminiModel: m })}
                  options={modelOptions.gemini || []}
                  isFetching={fetchingModels}
                  onFetch={() => handleFetchModels('gemini')}
                  isCustomInput={customModelMode.gemini}
                  onToggleCustomInput={() =>
                    setCustomModelMode((prev) => ({ ...prev, gemini: !prev.gemini }))
                  }
                  label={t.settings.modelLabel}
                  fetchText={t.settings.fetchModels}
                  fetchingText={t.settings.fetchingModels}
                  customToggleText={t.settings.customModelOption}
                  listToggleText="Listeye Dön"
                />
              </div>
            )}

            {draft.aiProvider === 'groq' && (
              <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <SecretInput
                  label={t.settings.groqKeyLabel}
                  value={draft.groqApiKey}
                  onChange={(val) => setDraft({ ...draft, groqApiKey: val })}
                  placeholder="gsk_..."
                  hint={t.settings.groqKeyHint}
                />
                <ModelControl
                  provider="groq"
                  currentModel={draft.groqModel}
                  onChangeModel={(m) => setDraft({ ...draft, groqModel: m })}
                  options={modelOptions.groq || []}
                  isFetching={fetchingModels}
                  onFetch={() => handleFetchModels('groq')}
                  isCustomInput={customModelMode.groq}
                  onToggleCustomInput={() =>
                    setCustomModelMode((prev) => ({ ...prev, groq: !prev.groq }))
                  }
                  label={t.settings.modelLabel}
                  fetchText={t.settings.fetchModels}
                  fetchingText={t.settings.fetchingModels}
                  customToggleText={t.settings.customModelOption}
                  listToggleText="Listeye Dön"
                />
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-[11px] text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{t.settings.groqFreeNotice}</span>
                    <p className="mt-0.5 text-slate-400">
                      Önerilen: <strong className="text-emerald-300 font-mono">llama-3.3-70b-versatile</strong>. Diğer modeller için otomatik prompt modu devreye girer.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {draft.aiProvider === 'openrouter' && (
              <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <SecretInput
                  label={t.settings.openRouterKeyLabel}
                  value={draft.openRouterApiKey}
                  onChange={(val) => setDraft({ ...draft, openRouterApiKey: val })}
                  placeholder="sk-or-v1-..."
                  hint={t.settings.openRouterKeyHint}
                />
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-xs text-slate-300 font-medium">
                    {t.settings.onlyFreeLabel}
                  </span>
                  <input
                    type="checkbox"
                    id="onlyFreeOpenRouter"
                    checked={onlyFreeOpenRouter}
                    onChange={(e) => setOnlyFreeOpenRouter(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 cursor-pointer"
                  />
                </div>
                <ModelControl
                  provider="openrouter"
                  currentModel={draft.openRouterModel}
                  onChangeModel={(m) => setDraft({ ...draft, openRouterModel: m })}
                  options={
                    onlyFreeOpenRouter
                      ? (modelOptions.openrouter || []).filter((m) => m.endsWith(':free'))
                      : modelOptions.openrouter || []
                  }
                  isFetching={fetchingModels}
                  onFetch={() => handleFetchModels('openrouter')}
                  isCustomInput={customModelMode.openrouter}
                  onToggleCustomInput={() =>
                    setCustomModelMode((prev) => ({ ...prev, openrouter: !prev.openrouter }))
                  }
                  label={t.settings.modelLabel}
                  fetchText={t.settings.fetchModels}
                  fetchingText={t.settings.fetchingModels}
                  customToggleText={t.settings.customModelOption}
                  listToggleText="Listeye Dön"
                />
                <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/50 text-[11px] text-indigo-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span>{t.settings.openRouterFreeNotice}</span>
                    <p className="mt-0.5 text-slate-400">
                      Popüler ücretsizler: <code className="text-emerald-300 font-mono">deepseek/deepseek-r1:free</code>, <code className="text-emerald-300 font-mono">meta-llama/llama-3.3-70b-instruct:free</code>, <code className="text-emerald-300 font-mono">google/gemini-2.0-flash-exp:free</code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {draft.aiProvider === 'custom' && (
              <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.settings.customBaseUrlLabel}
                  </label>
                  <input
                    type="url"
                    value={draft.customApiBaseUrl}
                    onChange={(e) => setDraft({ ...draft, customApiBaseUrl: e.target.value })}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <SecretInput
                  label={t.settings.customKeyLabel}
                  value={draft.customApiKey}
                  onChange={(val) => setDraft({ ...draft, customApiKey: val })}
                  placeholder="optional-bearer-token"
                />
                <ModelControl
                  provider="custom"
                  currentModel={draft.customModel}
                  onChangeModel={(m) => setDraft({ ...draft, customModel: m })}
                  options={modelOptions.custom || []}
                  isFetching={fetchingModels}
                  onFetch={() => handleFetchModels('custom')}
                  isCustomInput={customModelMode.custom}
                  onToggleCustomInput={() =>
                    setCustomModelMode((prev) => ({ ...prev, custom: !prev.custom }))
                  }
                  label={t.settings.modelLabel}
                  fetchText={t.settings.fetchModels}
                  fetchingText={t.settings.fetchingModels}
                  customToggleText={t.settings.customModelOption}
                  listToggleText="Listeye Dön"
                />
              </div>
            )}
          </div>

          {/* OKX Exchange Section */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">{t.settings.okxSection}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SecretInput
                label={t.settings.okxApiKey}
                value={draft.okxApiKey}
                onChange={(val) => setDraft({ ...draft, okxApiKey: val })}
                placeholder="okx-api-key"
              />
              <SecretInput
                label={t.settings.okxSecret}
                value={draft.okxSecretKey}
                onChange={(val) => setDraft({ ...draft, okxSecretKey: val })}
                placeholder="okx-secret-key"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SecretInput
                label={t.settings.okxPassphrase}
                value={draft.okxPassphrase}
                onChange={(val) => setDraft({ ...draft, okxPassphrase: val })}
                placeholder="passphrase"
              />
              <SecretInput
                label={t.settings.cryptoPanicToken}
                value={draft.cryptoPanicToken}
                onChange={(val) => setDraft({ ...draft, cryptoPanicToken: val })}
                placeholder="optional-cryptopanic-token"
              />
            </div>
          </div>

          {/* Freqtrade REST API Section */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">
              {t.settings.freqtradeSection}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.settings.freqtradeUrl}
              </label>
              <input
                type="url"
                value={draft.freqtradeUrl}
                onChange={(e) => setDraft({ ...draft, freqtradeUrl: e.target.value })}
                placeholder="http://100.x.x.x:8080"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.settings.freqtradeUser}
                </label>
                <input
                  type="text"
                  value={draft.freqtradeUsername}
                  onChange={(e) => setDraft({ ...draft, freqtradeUsername: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <SecretInput
                label={t.settings.freqtradePass}
                value={draft.freqtradePassword}
                onChange={(val) => setDraft({ ...draft, freqtradePassword: val })}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Storage Kind & Submit Buttons */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.settings.storageLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['localStorage', 'sessionStorage'] as StorageKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDraft({ ...draft, storageKind: kind })}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      draft.storageKind === kind
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">
                      {kind === 'localStorage'
                        ? t.settings.localStorageOpt
                        : t.settings.sessionStorageOpt}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {notice && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                {notice}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-rose-500/50 text-xs font-medium text-slate-300 hover:text-rose-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.settings.clearKeys}</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? t.settings.testingButton : t.settings.testButton}</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t.settings.saveButton}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Right: Connection Status & Security Checklist */}
        <div className="xl:col-span-5 space-y-6">
          <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  {t.settings.testButton}
                </h3>
              </div>
              {testResult && (
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {new Date(testResult.checkedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {!testResult ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'tr'
                  ? 'Seçili AI sağlayıcısını (Gemini, Groq, OpenRouter), OKX genel borsa erişimini ve özel Tailscale/VPN Freqtrade uç noktasını doğrulamak için Bağlantıyı Test Et düğmesine tıklayın.'
                  : 'Click Test Connection to verify your active AI provider (Gemini, Groq, OpenRouter), OKX market REST availability, and private Freqtrade endpoint.'}
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {/* AI Provider Status Card */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-200 uppercase">
                      AI: {testResult.ai?.provider || draft.aiProvider}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        testResult.ai?.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {testResult.ai?.ok
                        ? t.settings.statusLabels.connected
                        : t.settings.statusLabels.error}
                    </span>
                  </div>
                  <p className="text-slate-400">{testResult.ai?.detail}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-200">OKX Exchange</span>
                    <span
                      className={`font-mono font-semibold ${
                        testResult.okx.ok ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {testResult.okx.ok
                        ? t.settings.statusLabels.connected
                        : t.settings.statusLabels.incomplete}
                    </span>
                  </div>
                  <p className="text-slate-400">{testResult.okx.detail}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-200">
                      Freqtrade REST
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        testResult.freqtrade.ok ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {testResult.freqtrade.ok
                        ? t.settings.statusLabels.connected
                        : t.settings.statusLabels.unreachable}
                    </span>
                  </div>
                  <p className="text-slate-400">{testResult.freqtrade.detail}</p>
                </div>
              </div>
            )}
          </section>

          <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-base font-semibold text-slate-100">
                {t.settings.checklistTitle}
              </h3>
            </div>
            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {t.settings.checklistItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="font-mono text-emerald-400 font-semibold shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
