import { Globe } from 'lucide-react';
import { getT } from '../i18n/translations';
import { ApiSettings, Language, MarketPulseData, NavTab } from '../types';

interface TopBarProps {
  activeTab: NavTab;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  settings: ApiSettings;
  marketPulse: MarketPulseData | null;
}

export function TopBar({
  activeTab,
  language,
  onChangeLanguage,
  settings,
  marketPulse,
}: TopBarProps) {
  const t = getT(language);

  const tabTitle: Record<NavTab, string> = {
    dashboard: t.nav.dashboard,
    simulator: t.nav.simulator,
    export: t.nav.export,
    settings: t.nav.settings,
  };

  const btc = marketPulse?.pairs['BTC/USDT'];
  const fng = marketPulse?.fearGreed;

  return (
    <header className="h-16 px-6 border-b border-slate-800/80 bg-[#0B101B]/95 backdrop-blur-sm flex items-center justify-between gap-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm text-slate-400 whitespace-nowrap shrink-0">
          {t.brandName}
        </span>
        <span className="text-slate-600" aria-hidden="true">
          /
        </span>
        <h1 className="text-sm font-semibold text-slate-100 truncate">
          {tabTitle[activeTab]}
        </h1>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
          {btc && (
            <>
              <span>
                BTC/USDT{' '}
                <strong className="text-slate-100 font-medium">
                  ${btc.price.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
            </>
          )}
          {fng && (
            <>
              <span>
                {t.topBar.fearGreed}:{' '}
                <strong
                  className={
                    fng.value >= 60
                      ? 'text-emerald-400 font-medium'
                      : fng.value <= 35
                        ? 'text-rose-400 font-medium'
                        : 'text-amber-400 font-medium'
                  }
                >
                  {fng.value} ({fng.classification})
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
            </>
          )}
          <span
            className={
              settings.tradingMode === 'dry_run'
                ? 'text-amber-400 font-medium'
                : 'text-rose-400 font-medium'
            }
          >
            {settings.tradingMode === 'dry_run' ? t.topBar.dryRunLabel : t.topBar.liveLabel}
          </span>
        </div>

        <div
          role="group"
          aria-label="Language switcher"
          className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 shrink-0"
        >
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 shrink-0" />
          <button
            type="button"
            onClick={() => onChangeLanguage('en')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              language === 'en'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onChangeLanguage('tr')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              language === 'tr'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            TR
          </button>
        </div>
      </div>
    </header>
  );
}
