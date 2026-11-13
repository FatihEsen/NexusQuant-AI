import {
  ApiSettings,
  DataFeedsConfig,
  Language,
  ModularSkillsConfig,
  StrategyConfig,
  TokenOptimizationConfig,
} from '../types';

export function generateConfigJson(
  settings: ApiSettings,
  strategy: StrategyConfig
): string {
  const config = {
    max_open_trades: strategy.maxOpenTrades,
    stake_currency: 'USDT',
    stake_amount: strategy.baseStakeUsdt,
    tradable_balance_ratio: 0.99,
    fiat_display_currency: 'USD',
    timeframe: strategy.timeframe,
    dry_run: settings.tradingMode === 'dry_run',
    dry_run_wallet: 10000,
    cancel_open_orders_on_exit: false,
    trading_mode: 'spot',
    margin_mode: '',
    unfilledtimeout: {
      entry: 10,
      exit: 10,
      exit_timeout_count: 0,
      unit: 'minutes',
    },
    entry_pricing: {
      price_side: 'same',
      use_order_book: true,
      order_book_top: 1,
      price_last_balance: 0.0,
      check_depth_of_market: {
        enabled: false,
        bids_to_ask_delta: 1,
      },
    },
    exit_pricing: {
      price_side: 'same',
      use_order_book: true,
      order_book_top: 1,
    },
    exchange: {
      name: 'okx',
      key: settings.okxApiKey || '${OKX_API_KEY}',
      secret: settings.okxSecretKey || '${OKX_SECRET_KEY}',
      password: settings.okxPassphrase || '${OKX_PASSPHRASE}',
      ccxt_config: {},
      ccxt_async_config: {},
      pair_whitelist: strategy.pairs,
      pair_blacklist: ['.*_PREMIUM', '.*3L/.*', '.*3S/.*'],
    },
    pairlists: [{ method: 'StaticPairList' }],
    api_server: {
      enabled: true,
      listen_ip_address: '127.0.0.1',
      listen_port: 8080,
      verbosity: 'error',
      enable_openapi: false,
      jwt_secret_key: 'replace-with-random-64-char-hex-secret',
      ws_token: 'replace-with-ws-token',
      CORS_origins: [],
      username: settings.freqtradeUsername || 'freqtrader',
      password: settings.freqtradePassword || 'CHANGE_STRONG_PASSWORD',
    },
    bot_name: 'nexusquant-okx-gemini',
    initial_state: 'running',
    force_entry_enable: false,
    internals: {
      process_throttle_secs: 5,
    },
  };

  return JSON.stringify(config, null, 2);
}

export function generateStrategyPy(
  settings: ApiSettings,
  strategy: StrategyConfig,
  tokenOpt: TokenOptimizationConfig,
  feeds: DataFeedsConfig,
  skills: ModularSkillsConfig,
  language: Language
): string {
  const isGroq = settings.aiProvider === 'groq';
  const isOpenRouter = settings.aiProvider === 'openrouter';
  const isCustom = settings.aiProvider === 'custom';
  const isOpenAiCompatible = isGroq || isOpenRouter || isCustom;

  const activeSkillMethods: string[] = [];
  const toolDeclarations: string[] = [];

  if (skills.fetch_sentiment_and_fear_greed) {
    activeSkillMethods.push(`
    def fetch_sentiment_and_fear_greed(self, symbol: str) -> dict:
        """Skill 1: Fetch Fear & Greed Index and CryptoPanic headlines only on trigger."""
        result = {"fear_greed": None, "classification": "unknown", "headlines": []}
        try:
            if ${feeds.fearGreed ? 'True' : 'False'}:
                fng = requests.get("https://api.alternative.me/fng/?limit=1", timeout=3).json()
                item = fng.get("data", [{}])[0]
                result["fear_greed"] = int(item.get("value", 50))
                result["classification"] = item.get("value_classification", "Neutral")
            if ${feeds.cryptoPanic ? 'True' : 'False'} and os.getenv("CRYPTOPANIC_API_KEY"):
                cp_url = (
                    f"https://cryptopanic.com/api/v1/posts/?auth_token="
                    f"{os.getenv('CRYPTOPANIC_API_KEY')}&currencies={symbol}&public=true"
                )
                posts = requests.get(cp_url, timeout=3).json().get("results", [])[:3]
                result["headlines"] = [p.get("title", "")[:90] for p in posts]
        except Exception as exc:
            logger.warning("Sentiment fetch degraded: %s", exc)
        return result`);
    toolDeclarations.push('self.fetch_sentiment_and_fear_greed');
  }

  if (skills.check_multi_timeframe_trend) {
    activeSkillMethods.push(`
    def check_multi_timeframe_trend(self, pair: str) -> dict:
        """Skill 2: Inspect higher timeframe (1h / 4h) EMA alignment."""
        trend = {"tf_1h": "NEUTRAL", "tf_4h": "NEUTRAL"}
        try:
            for tf_key, tf_val in [("tf_1h", "1h"), ("tf_4h", "4h")]:
                df_htf = self.dp.get_pair_dataframe(pair=pair, timeframe=tf_val)
                if len(df_htf) >= 21:
                    ema_fast = df_htf["close"].ewm(span=${strategy.emaFast}).mean().iloc[-1]
                    ema_slow = df_htf["close"].ewm(span=${strategy.emaSlow}).mean().iloc[-1]
                    trend[tf_key] = "BULLISH" if ema_fast > ema_slow else "BEARISH"
        except Exception as exc:
            logger.warning("Multi-timeframe check fallback: %s", exc)
        return trend`);
    toolDeclarations.push('self.check_multi_timeframe_trend');
  }

  if (skills.calculate_dynamic_position_size) {
    activeSkillMethods.push(`
    def calculate_dynamic_position_size(self, confidence: int, atr_pct: float, base_stake: float) -> float:
        """Skill 3: Adjust USDT stake based on Gemini confidence & ATR volatility."""
        conf_factor = 1.0 if confidence >= 85 else (0.7 if confidence >= 70 else 0.4)
        vol_factor = 0.75 if atr_pct > 2.2 else (1.1 if atr_pct < 0.8 else 1.0)
        return round(base_stake * conf_factor * vol_factor, 2)`);
    toolDeclarations.push('self.calculate_dynamic_position_size');
  }

  if (skills.post_trade_journal_summary) {
    activeSkillMethods.push(`
    def post_trade_journal_summary(self, pair: str, action: str, note: str) -> None:
        """Skill 4: Record concise 1-sentence localized (${language.toUpperCase()}) post-mortem / entry log."""
        logger.info("[AI-JOURNAL][%s][%s] %s", pair, action, note)`);
    toolDeclarations.push('self.post_trade_journal_summary');
  }

  const skillsComment =
    toolDeclarations.length > 0
      ? toolDeclarations.map((t) => `#   - ${t}`).join('\n')
      : '#   - (No external skill tools attached)';

  const skillCallsSnippet = [
    skills.fetch_sentiment_and_fear_greed
      ? '        sentiment = self.fetch_sentiment_and_fear_greed(pair.split("/")[0])'
      : '        sentiment = {}',
    skills.check_multi_timeframe_trend
      ? '        htf_trend = self.check_multi_timeframe_trend(pair)'
      : '        htf_trend = {}',
  ].join('\n');

  const journalSnippet = skills.post_trade_journal_summary
    ? `        self.post_trade_journal_summary(pair, decision.action, decision.journal_note)`
    : `        logger.info("Gemini %s (%s%%): %s", decision.action, decision.confidence, decision.reasoning)`;

  const customStakeMethod = skills.calculate_dynamic_position_size
    ? `
    def custom_stake_amount(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_stake: float,
        min_stake: Optional[float],
        max_stake: float,
        leverage: float,
        entry_tag: Optional[str],
        side: str,
        **kwargs,
    ) -> float:
        cached = self._decision_cache.get(pair)
        if not cached:
            return proposed_stake
        adjusted = self.calculate_dynamic_position_size(
            confidence=cached["confidence"],
            atr_pct=cached["atr_pct"],
            base_stake=proposed_stake,
        )
        if min_stake is not None:
            adjusted = max(min_stake, adjusted)
        return min(adjusted, max_stake)`
    : '';

  return `# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
import json
import logging
import os
import time
from typing import Dict, Optional

import numpy as np
import pandas as pd
import requests
from datetime import datetime
from freqtrade.strategy import IStrategy
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Active Modular AI Skills compiled from NexusQuant Dashboard:
${skillsComment}


class GeminiDecision(BaseModel):
    action: str = Field(description="BUY, SELL, or HOLD")
    confidence: int = Field(ge=0, le=100)
    reasoning: str = Field(description="Concise rationale in ${language === 'tr' ? 'Turkish' : 'English'}")
    journal_note: str = Field(description="1-sentence localized journal entry")


class GeminiHybridStrategy(IStrategy):
    """
    Hybrid OKX Spot Strategy with Zero-Token Pre-Filter Gatekeeper,
    Compact CSV Serialization, and Per-Pair ATR Cooldown Caching.
    """

    INTERFACE_VERSION = 3
    timeframe = "${strategy.timeframe}"
    stoploss = ${Number((strategy.stopLossPct / 100).toFixed(4))}
    minimal_roi = {
        "0": ${Number((strategy.takeProfitPct / 100).toFixed(4))},
        "60": ${Number((strategy.takeProfitPct / 200).toFixed(4))},
        "180": 0.01
    }

    # Pre-Filter & Quota Optimization Settings
    PRE_FILTER_ENABLED = ${tokenOpt.preFilterEnabled ? 'True' : 'False'}
    MAX_COMPACT_CANDLES = ${tokenOpt.compactCsvMaxCandles}
    COOLDOWN_SECONDS = ${tokenOpt.cooldownMinutes * 60}
    ATR_CACHE_DELTA_PCT = ${tokenOpt.atrCacheDeltaPct}
    CONFIDENCE_THRESHOLD = ${strategy.confidenceThreshold}
    UI_LANGUAGE = "${language}"

    _client: Optional[genai.Client] = None
    _decision_cache: Dict[str, dict] = {}

    def _get_gemini_client(self) -> genai.Client:
        if self._client is None:
            self._client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))
        return self._client

    def _call_ai_decision(self, prompt: str) -> GeminiDecision:
${
  isOpenAiCompatible
    ? `        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ.get('${isGroq ? 'GROQ_API_KEY' : isOpenRouter ? 'OPENROUTER_API_KEY' : 'CUSTOM_API_KEY'}', '')}",
        }
        payload = {
            "model": "${
              isGroq
                ? settings.groqModel || 'llama-3.3-70b-versatile'
                : isOpenRouter
                  ? settings.openRouterModel || 'deepseek/deepseek-r1'
                  : settings.customModel || 'llama3'
            }",
            "messages": [
                {"role": "system", "content": f"Validate OKX entry. Return strict JSON with keys: action (BUY|SELL|HOLD), confidence (0-100), reasoning (in {self.UI_LANGUAGE}), journal_note (in {self.UI_LANGUAGE})."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        endpoint = "${
          isGroq
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : isOpenRouter
              ? 'https://openrouter.ai/api/v1/chat/completions'
              : (settings.customApiBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '') + '/chat/completions'
        }"
        res = requests.post(endpoint, headers=headers, json=payload, timeout=8)
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        return GeminiDecision(**data)`
    : `        client = self._get_gemini_client()
        response = client.models.generate_content(
            model="${settings.geminiModel || 'gemini-2.5-flash'}",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    f"Validate OKX entry. Respond in {self.UI_LANGUAGE} JSON matching GeminiDecision."
                ),
                response_mime_type="application/json",
                response_schema=GeminiDecision,
            ),
        )
        return GeminiDecision.model_validate_json(response.text)`
}

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        delta = dataframe["close"].diff()
        gain = delta.clip(lower=0).rolling(window=14).mean()
        loss = (-delta.clip(upper=0)).rolling(window=14).mean()
        rs = gain / loss.replace(0, np.nan)
        dataframe["rsi"] = 100 - (100 / (1 + rs))
        dataframe["ema_fast"] = dataframe["close"].ewm(span=${strategy.emaFast}).mean()
        dataframe["ema_slow"] = dataframe["close"].ewm(span=${strategy.emaSlow}).mean()

        tr = pd.concat([
            dataframe["high"] - dataframe["low"],
            (dataframe["high"] - dataframe["close"].shift()).abs(),
            (dataframe["low"] - dataframe["close"].shift()).abs(),
        ], axis=1).max(axis=1)
        dataframe["atr_pct"] = (tr.rolling(14).mean() / dataframe["close"]) * 100
        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        # Gatekeeper Step 1: Local pre-filter triggers only on genuine setups (Zero-Token Idle Mode)
        oversold_cross = (
            (dataframe["rsi"] < ${strategy.rsiOversold})
            & (dataframe["ema_fast"] >= dataframe["ema_slow"] * 0.998)
        )
        dataframe.loc[oversold_cross, "enter_long"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        overbought = dataframe["rsi"] > ${strategy.rsiOverbought}
        dataframe.loc[overbought, "exit_long"] = 1
        return dataframe

    def _serialize_compact_candles(self, dataframe: pd.DataFrame) -> str:
        """Compress last N candles to compact CSV (rounded 2-4 decimals) to cut tokens ~70%."""
        tail = dataframe.tail(self.MAX_COMPACT_CANDLES)
        lines = ["t,o,h,l,c,v"]
        for _, row in tail.iterrows():
            dec = 1 if row["close"] >= 1000 else (2 if row["close"] >= 10 else 4)
            ts = int(pd.Timestamp(row["date"]).timestamp() // 60)
            lines.append(
                f"{ts},{row['open']:.{dec}f},{row['high']:.{dec}f},"
                f"{row['low']:.{dec}f},{row['close']:.{dec}f},{row['volume']:.1f}"
            )
        return "\\n".join(lines)
${activeSkillMethods.join('\n')}

    def confirm_trade_entry(
        self,
        pair: str,
        order_type: str,
        amount: float,
        rate: float,
        time_in_force: str,
        current_time: datetime,
        entry_tag: Optional[str],
        side: str,
        **kwargs,
    ) -> bool:
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe.empty:
            return False

        last = dataframe.iloc[-1]
        rsi_val = float(last.get("rsi", 50.0))
        atr_pct = float(last.get("atr_pct", 1.0))

        # Zero-Token Idle Pre-Filter Check
        if self.PRE_FILTER_ENABLED and not (rsi_val < ${strategy.rsiOversold} or rsi_val > ${strategy.rsiOverbought}):
            return False

        # Cooldown & ATR Volatility Decision Cache
        now_ts = time.time()
        cached = self._decision_cache.get(pair)
        if cached:
            age_sec = now_ts - cached["ts"]
            atr_diff = abs(atr_pct - cached["atr_pct"])
            if age_sec < self.COOLDOWN_SECONDS and atr_diff < self.ATR_CACHE_DELTA_PCT:
                return cached["approved"]

        compact_csv = self._serialize_compact_candles(dataframe)
${skillCallsSnippet}

        prompt = (
            f"Pair={pair} TF={self.timeframe} RSI={rsi_val:.2f} ATR%={atr_pct:.2f}\\n"
            f"Sentiment={json.dumps(sentiment)} HTF={json.dumps(htf_trend)}\\n"
            f"CompactCandles:\\n{compact_csv}"
        )

        try:
            decision = self._call_ai_decision(prompt)
            approved = decision.action.upper() == "BUY" and decision.confidence >= self.CONFIDENCE_THRESHOLD
            self._decision_cache[pair] = {
                "ts": now_ts,
                "atr_pct": atr_pct,
                "confidence": decision.confidence,
                "approved": approved,
            }
${journalSnippet}
            return approved
        except Exception as exc:
            logger.error("AI validation failed for %s: %s", pair, exc)
            return False
${customStakeMethod}
`;
}

export function generateDockerfile(): string {
  return `FROM freqtradeorg/freqtrade:stable

USER root

RUN pip install --no-cache-dir --upgrade pip \\
    && pip install --no-cache-dir google-genai pydantic requests

USER ftuser

WORKDIR /freqtrade
`;
}

export function generateDockerCompose(settings: ApiSettings): string {
  return `services:
  freqtrade:
    build:
      context: .
      dockerfile: Dockerfile
    image: nexusquant-freqtrade-gemini:latest
    container_name: freqtrade_okx_gemini
    restart: unless-stopped
    volumes:
      - ./user_data:/freqtrade/user_data
    # Strict localhost/VPN binding so the Freqtrade REST API is never exposed publicly
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - AI_PROVIDER=${settings.aiProvider || 'gemini'}
      - GEMINI_API_KEY=${settings.geminiApiKey || '${GEMINI_API_KEY}'}
      - GROQ_API_KEY=${settings.groqApiKey || '${GROQ_API_KEY}'}
      - OPENROUTER_API_KEY=${settings.openRouterApiKey || '${OPENROUTER_API_KEY}'}
      - CUSTOM_API_KEY=${settings.customApiKey || ''}
      - CUSTOM_API_BASE_URL=${settings.customApiBaseUrl || ''}
      - OKX_API_KEY=${settings.okxApiKey || '${OKX_API_KEY}'}
      - OKX_SECRET_KEY=${settings.okxSecretKey || '${OKX_SECRET_KEY}'}
      - OKX_PASSPHRASE=${settings.okxPassphrase || '${OKX_PASSPHRASE}'}
      - CRYPTOPANIC_API_KEY=${settings.cryptoPanicToken || ''}
    command: >
      trade
      --logfile /freqtrade/user_data/logs/freqtrade.log
      --db-url sqlite:////freqtrade/user_data/tradesv3.sqlite
      --config /freqtrade/user_data/config.json
      --strategy GeminiHybridStrategy
`;
}
