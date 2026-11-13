import { useState } from 'react';
import {
  Activity,
  Bot,
  Cpu,
  Download,
  Globe,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { getT } from '../i18n/translations';
import { ApiSettings, Language, MarketPulseData, NavTab, StrategyConfig } from '../types';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  settings: ApiSettings;
  marketPulse: MarketPulseData | null;
  strategy: StrategyConfig;
  activeSkillsCount: number;
}

export function TopBar({
  activeTab,
  onSelectTab,
  language,
  onChangeLanguage,
  settings,
  marketPulse,
  strategy,
  activeSkillsCount,
}: TopBarProps) {
  const t = getT(language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'simulator', label: t.nav.simulator, icon: Cpu },
    { id: 'export', label: t.nav.export, icon: Download },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ];

  const btc = marketPulse?.pairs['BTC/USDT'];
  const fng = marketPulse?.fearGreed;
  const isDryRun = settings.tradingMode === 'dry_run';

  const getProviderBadge = () => {
    switch (settings.aiProvider) {
      case 'groq':
        return {
          name: 'Groq',
          model: settings.groqModel || 'Llama 3.3 70B',
          color: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
          icon: Zap,
        };
      case 'openrouter':
        return {
          name: 'OpenRouter',
          model: settings.openRouterModel || 'DeepSeek R1',
          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
          icon: Globe,
        };
      case 'custom':
        return {
          name: 'Custom API',
          model: settings.customModel || 'OpenAI-Compat',
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
          icon: Bot,
        };
      default:
        return {
          name: 'Gemini',
          model: settings.geminiModel || '2.5 Flash',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
          icon: Bot,
        };
    }
  };

  const provider = getProviderBadge();
  const ProviderIcon = provider.icon;

  const handleTabClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#0B101B]/95 backdrop-blur-md transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-950/50">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-100 truncate">
                {t.brandName}
              </span>
              <span
                className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border ${
                  isDryRun
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                {isDryRun ? 'DRY-RUN' : 'LIVE'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono hidden sm:block truncate">
              OKX Spot · {strategy.pairs.length} Pairs
            </div>
          </div>
        </div>

        {/* Desktop Primary Navigation Tabs */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800/60"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isActive
                    ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-3 right-3 h-[2px] bg-emerald-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Ticker, Active AI Provider & Language */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Active AI Provider Badge */}
          <div
            title={`Active Provider: ${provider.name} (${provider.model})`}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium ${provider.color}`}
          >
            <ProviderIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">{provider.name}:</span>
            <span className="text-slate-300 max-w-[110px] truncate">{provider.model}</span>
          </div>

          {/* Live BTC & Fear/Greed Ticker */}
          <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-300 font-mono tabular-nums bg-slate-900/80 border border-slate-800/80 px-3 py-1 rounded-lg">
            {btc && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">BTC</span>
                <strong className="text-slate-100 font-semibold">
                  ${btc.price.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                </strong>
              </span>
            )}
            {btc && fng && <span aria-hidden="true" className="text-slate-600">·</span>}
            {fng && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">F&G</span>
                <strong
                  className={
                    fng.value >= 60
                      ? 'text-emerald-400 font-semibold'
                      : fng.value <= 35
                        ? 'text-rose-400 font-semibold'
                        : 'text-amber-400 font-semibold'
                  }
                >
                  {fng.value}
                </strong>
              </span>
            )}
          </div>

          {/* Language Switcher */}
          <div
            role="group"
            aria-label="Language selector"
            className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 shrink-0" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onChangeLanguage('en')}
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                language === 'en'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onChangeLanguage('tr')}
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                language === 'tr'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              TR
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#0C111C] px-4 pt-3 pb-5 space-y-3">
          <nav aria-label="Mobile Navigation" className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">AI:</span>
              <span className={`px-2 py-0.5 rounded border ${provider.color}`}>
                {provider.name} ({provider.model})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeSkillsCount} / 4 Skills Active</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
