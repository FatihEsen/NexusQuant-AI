import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, RefreshCw, ShieldAlert, Trash2, Wifi } from 'lucide-react';
import { getT } from '../i18n/translations';
import { ApiSettings, ConnectionTestResult, Language, StorageKind } from '../types';

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
          className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide secret' : 'Show secret'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-100 transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
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
        gemini: data.gemini,
        okx: data.okx,
        freqtrade: data.freqtrade,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      setTestResult({
        gemini: { ok: false, mode: 'missing', detail: 'Network error contacting server' },
        okx: { ok: false, mode: 'keys_incomplete', detail: 'Could not reach server' },
        freqtrade: { ok: false, reachable: false, detail: 'Could not reach server' },
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

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
          {/* Trading Mode */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-100">
              {t.settings.tradingModeTitle}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, tradingMode: 'dry_run' })}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
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
                className={`p-3.5 rounded-lg border text-left transition-colors ${
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

          {/* Gemini Section */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">
              {t.settings.geminiSection}
            </h3>
            <SecretInput
              label={t.settings.geminiKeyLabel}
              value={draft.geminiApiKey}
              onChange={(val) => setDraft({ ...draft, geminiApiKey: val })}
              placeholder="AIzaSy..."
              hint={t.settings.geminiKeyHint}
            />
          </div>

          {/* OKX Section */}
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
                placeholder="freqtrade-api-password"
              />
            </div>
          </div>

          {/* Storage Preference & Actions */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                {t.settings.storageLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['localStorage', 'sessionStorage'] as StorageKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDraft({ ...draft, storageKind: kind })}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left ${
                      draft.storageKind === kind
                        ? 'bg-emerald-500/12 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {kind === 'localStorage'
                      ? t.settings.localStorageOpt
                      : t.settings.sessionStorageOpt}
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-rose-500/50 text-xs font-medium text-slate-300 hover:text-rose-300 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.settings.clearKeys}</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? t.settings.testingButton : t.settings.testButton}</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
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
                  ? 'Gemini API anahtarını, OKX genel borsa erişimini ve özel Tailscale/VPN Freqtrade uç noktasını doğrulamak için Bağlantıyı Test Et düğmesine tıklayın.'
                  : 'Click Test Connection to verify Gemini API access, OKX market REST availability, and your private Tailscale/VPN Freqtrade endpoint.'}
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-200">Gemini API</span>
                    <span
                      className={`font-mono font-semibold ${
                        testResult.gemini.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {testResult.gemini.ok
                        ? t.settings.statusLabels.connected
                        : t.settings.statusLabels.error}
                    </span>
                  </div>
                  <p className="text-slate-400">{testResult.gemini.detail}</p>
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
