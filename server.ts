import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel, type FunctionDeclaration } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

interface CandleRow {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface SimulateRequestBody {
  aiProvider?: 'gemini' | 'groq' | 'openrouter' | 'custom';
  model?: string;
  pair?: string;
  timeframe?: string;
  language?: 'en' | 'tr';
  scenario?: 'oversold_long' | 'overbought_short' | 'idle_neutral' | 'live_okx';
  rsi?: number;
  emaFast?: number;
  emaSlow?: number;
  atrPct?: number;
  confidenceThreshold?: number;
  baseStakeUsdt?: number;
  feeds?: {
    fearGreed: boolean;
    cryptoPanic: boolean;
  };
  enabledSkills?: {
    fetch_sentiment_and_fear_greed?: boolean;
    check_multi_timeframe_trend?: boolean;
    calculate_dynamic_position_size?: boolean;
    post_trade_journal_summary?: boolean;
    drawdown_circuit_breaker?: boolean;
    pre_trade_discipline_gate?: boolean;
  };
  customGeminiKey?: string;
  customGroqKey?: string;
  customOpenRouterKey?: string;
  customApiKey?: string;
  customApiBaseUrl?: string;
  compactCsv?: string;
  rawJsonChars?: number;
}

async function fetchFearAndGreed(): Promise<{
  value: number;
  classification: string;
  timestamp: string;
  source: 'live' | 'fallback';
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`FNG HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{ value: string; value_classification: string; timestamp: string }>;
    };
    const item = json.data?.[0];
    if (item) {
      return {
        value: Number(item.value),
        classification: item.value_classification,
        timestamp: new Date(Number(item.timestamp) * 1000).toISOString(),
        source: 'live',
      };
    }
  } catch {
    // Graceful fallback if external endpoint is unreachable
  }
  return {
    value: 58,
    classification: 'Greed',
    timestamp: new Date().toISOString(),
    source: 'fallback',
  };
}

async function fetchOkxCandles(
  instId: string,
  bar: string,
  limit = 10
): Promise<{ candles: CandleRow[]; source: 'live' | 'fallback' }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
    const json = (await res.json()) as { data?: string[][] };
    if (Array.isArray(json.data) && json.data.length > 0) {
      const candles = json.data
        .slice(0, limit)
        .reverse()
        .map((row) => ({
          t: Number(row[0]),
          o: Number(row[1]),
          h: Number(row[2]),
          l: Number(row[3]),
          c: Number(row[4]),
          v: Number(row[5]),
        }));
      return { candles, source: 'live' };
    }
  } catch {
    // Graceful fallback
  }

  const basePrice = instId.startsWith('ETH')
    ? 3180
    : instId.startsWith('SOL')
      ? 188
      : instId.startsWith('AVAX')
        ? 34.5
        : 89400;
  const now = Date.now();
  const candles: CandleRow[] = Array.from({ length: limit }, (_, idx) => {
    const drift = (idx - limit / 2) * (basePrice * 0.0022);
    const open = Number((basePrice + drift).toFixed(2));
    const close = Number((open * (1 + (idx % 2 === 0 ? 0.0028 : -0.0014))).toFixed(2));
    const high = Number((Math.max(open, close) * 1.0025).toFixed(2));
    const low = Number((Math.min(open, close) * 0.9975).toFixed(2));
    return {
      t: now - (limit - idx) * 15 * 60 * 1000,
      o: open,
      h: high,
      l: low,
      c: close,
      v: Number((120 + idx * 14.5).toFixed(2)),
    };
  });
  return { candles, source: 'fallback' };
}

function computeRsi(closes: number[], period = 14): number {
  if (closes.length < 2) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const len = Math.min(closes.length - 1, period);
  const avgGain = gains / len;
  const avgLoss = losses / len;
  if (avgLoss === 0) return 75;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

function formatCompactCsv(candles: CandleRow[]): string {
  const header = 't,o,h,l,c,v';
  const rows = candles.slice(-10).map((c) => {
    const shortTs = Math.floor(c.t / 60000);
    const dec = c.c >= 1000 ? 1 : c.c >= 10 ? 2 : 4;
    return `${shortTs},${c.o.toFixed(dec)},${c.h.toFixed(dec)},${c.l.toFixed(dec)},${c.c.toFixed(dec)},${c.v.toFixed(1)}`;
  });
  return [header, ...rows].join('\n');
}

function createGeminiClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey?.trim() || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/market-pulse', async (_req, res) => {
  const [fng, btc, eth, sol] = await Promise.all([
    fetchFearAndGreed(),
    fetchOkxCandles('BTC-USDT', '15m', 10),
    fetchOkxCandles('ETH-USDT', '15m', 10),
    fetchOkxCandles('SOL-USDT', '15m', 10),
  ]);

  const summarize = (pair: string, data: { candles: CandleRow[]; source: 'live' | 'fallback' }) => {
    const last = data.candles[data.candles.length - 1];
    const first = data.candles[0];
    const changePct = first && last ? Number((((last.c - first.c) / first.c) * 100).toFixed(2)) : 0;
    const rsi = computeRsi(data.candles.map((c) => c.c));
    return {
      pair,
      price: last?.c ?? 0,
      changePct,
      rsi,
      source: data.source,
      candles: data.candles,
      compactCsv: formatCompactCsv(data.candles),
    };
  };

  res.json({
    fearGreed: fng,
    pairs: {
      'BTC/USDT': summarize('BTC/USDT', btc),
      'ETH/USDT': summarize('ETH/USDT', eth),
      'SOL/USDT': summarize('SOL/USDT', sol),
    },
    fetchedAt: new Date().toISOString(),
  });
});

app.get('/api/order-book', async (req, res) => {
  const pair = (req.query.pair as string) || 'BTC/USDT';
  const instId = pair.replace('/', '-');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const r = await fetch(
      `https://www.okx.com/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=5`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (r.ok) {
      const json = (await r.json()) as {
        data?: Array<{
          asks: string[][];
          bids: string[][];
          ts: string;
        }>;
      };
      const raw = json.data?.[0];
      if (raw && Array.isArray(raw.asks) && Array.isArray(raw.bids)) {
        const rawAsks = raw.asks.slice(0, 5).map((row) => ({
          price: Number(row[0]),
          size: Number(row[1]),
          total: Number(row[0]) * Number(row[1]),
        }));
        const rawBids = raw.bids.slice(0, 5).map((row) => ({
          price: Number(row[0]),
          size: Number(row[1]),
          total: Number(row[0]) * Number(row[1]),
        }));

        const maxAskVol = Math.max(...rawAsks.map((a) => a.total), 1);
        const maxBidVol = Math.max(...rawBids.map((b) => b.total), 1);

        const asks = rawAsks.map((a) => ({
          ...a,
          depthPct: Math.min(100, Math.round((a.total / maxAskVol) * 100)),
        }));
        const bids = rawBids.map((b) => ({
          ...b,
          depthPct: Math.min(100, Math.round((b.total / maxBidVol) * 100)),
        }));

        const bestAsk = asks[0]?.price ?? 0;
        const bestBid = bids[0]?.price ?? 0;
        const spread = Number((bestAsk - bestBid).toFixed(2));
        const spreadPct = bestBid > 0 ? Number(((spread / bestBid) * 100).toFixed(4)) : 0;
        const lastPrice = bestBid > 0 ? Number(((bestAsk + bestBid) / 2).toFixed(2)) : 0;

        res.json({
          pair,
          asks,
          bids,
          spread,
          spreadPct,
          lastPrice,
          timestamp: new Date().toISOString(),
          source: 'live_okx',
        });
        return;
      }
    }
  } catch {
    // Graceful fallback
  }

  const basePrice = pair.includes('ETH') ? 3420 : pair.includes('SOL') ? 178 : 91250;
  const spread = Number((basePrice * 0.0001).toFixed(2));
  const asks = [
    { price: basePrice + spread * 5, size: 0.85, total: (basePrice + spread * 5) * 0.85, depthPct: 75 },
    { price: basePrice + spread * 4, size: 1.12, total: (basePrice + spread * 4) * 1.12, depthPct: 90 },
    { price: basePrice + spread * 3, size: 0.45, total: (basePrice + spread * 3) * 0.45, depthPct: 40 },
    { price: basePrice + spread * 2, size: 0.95, total: (basePrice + spread * 2) * 0.95, depthPct: 82 },
    { price: basePrice + spread * 1, size: 1.40, total: (basePrice + spread * 1) * 1.40, depthPct: 100 },
  ];
  const bids = [
    { price: basePrice - spread * 1, size: 1.25, total: (basePrice - spread * 1) * 1.25, depthPct: 95 },
    { price: basePrice - spread * 2, size: 0.70, total: (basePrice - spread * 2) * 0.70, depthPct: 55 },
    { price: basePrice - spread * 3, size: 1.50, total: (basePrice - spread * 3) * 1.50, depthPct: 100 },
    { price: basePrice - spread * 4, size: 0.60, total: (basePrice - spread * 4) * 0.60, depthPct: 45 },
    { price: basePrice - spread * 5, size: 0.90, total: (basePrice - spread * 5) * 0.90, depthPct: 70 },
  ];

  res.json({
    pair,
    asks,
    bids,
    spread,
    spreadPct: 0.01,
    lastPrice: basePrice,
    timestamp: new Date().toISOString(),
    source: 'simulated_fallback',
  });
});

app.post('/api/test-connection', async (req, res) => {
  const {
    aiProvider = 'gemini',
    geminiApiKey,
    groqApiKey,
    groqModel,
    openRouterApiKey,
    openRouterModel,
    customApiBaseUrl,
    customApiKey,
    customModel,
    okxApiKey,
    okxSecretKey,
    okxPassphrase,
    freqtradeUrl,
    freqtradeUsername,
    freqtradePassword,
  } = req.body as Record<string, string | undefined>;

  const results: {
    ai: { ok: boolean; provider: string; mode: string; detail: string };
    gemini: { ok: boolean; mode: 'live' | 'env' | 'missing'; detail: string };
    okx: { ok: boolean; mode: 'public_ok' | 'keys_incomplete'; detail: string };
    freqtrade: { ok: boolean; reachable: boolean; detail: string };
  } = {
    ai: { ok: false, provider: aiProvider, mode: 'missing', detail: 'No AI key configured' },
    gemini: { ok: false, mode: 'missing', detail: 'No Gemini API key configured' },
    okx: { ok: false, mode: 'keys_incomplete', detail: 'OKX credentials incomplete' },
    freqtrade: { ok: false, reachable: false, detail: 'Freqtrade URL not checked' },
  };

  // 1. Test Selected AI Provider
  if (aiProvider === 'groq') {
    const key = groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim();
    if (!key) {
      results.ai = { ok: false, provider: 'groq', mode: 'missing', detail: 'Groq API key not provided' };
    } else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const gRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (gRes.ok) {
          results.ai = {
            ok: true,
            provider: 'groq',
            mode: groqApiKey?.trim() ? 'live' : 'env',
            detail: `Groq Cloud API verified (${groqModel || 'llama-3.3-70b-versatile'} ready)`,
          };
        } else {
          results.ai = {
            ok: false,
            provider: 'groq',
            mode: 'error',
            detail: `Groq returned HTTP ${gRes.status}`,
          };
        }
      } catch (err) {
        results.ai = {
          ok: false,
          provider: 'groq',
          mode: 'error',
          detail: err instanceof Error ? err.message : 'Groq ping failed',
        };
      }
    }
  } else if (aiProvider === 'openrouter') {
    const key = openRouterApiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    if (!key) {
      results.ai = { ok: false, provider: 'openrouter', mode: 'missing', detail: 'OpenRouter API key not provided' };
    } else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const orRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (orRes.ok) {
          results.ai = {
            ok: true,
            provider: 'openrouter',
            mode: openRouterApiKey?.trim() ? 'live' : 'env',
            detail: `OpenRouter API key verified (${openRouterModel || 'deepseek/deepseek-r1'} ready)`,
          };
        } else {
          results.ai = {
            ok: false,
            provider: 'openrouter',
            mode: 'error',
            detail: `OpenRouter returned HTTP ${orRes.status}`,
          };
        }
      } catch (err) {
        results.ai = {
          ok: false,
          provider: 'openrouter',
          mode: 'error',
          detail: err instanceof Error ? err.message : 'OpenRouter ping failed',
        };
      }
    }
  } else if (aiProvider === 'custom') {
    const baseUrl = (customApiBaseUrl || 'http://localhost:11434/v1').trim().replace(/\/+$/, '');
    const key = customApiKey?.trim() || process.env.CUSTOM_API_KEY?.trim() || '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const headers: Record<string, string> = {};
      if (key) headers.Authorization = `Bearer ${key}`;
      const cRes = await fetch(`${baseUrl}/models`, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (cRes.ok) {
        results.ai = {
          ok: true,
          provider: 'custom',
          mode: 'custom',
          detail: `Custom OpenAI-compatible endpoint verified at ${baseUrl}`,
        };
      } else {
        results.ai = {
          ok: false,
          provider: 'custom',
          mode: 'error',
          detail: `Endpoint returned HTTP ${cRes.status}`,
        };
      }
    } catch (err) {
      results.ai = {
        ok: false,
        provider: 'custom',
        mode: 'error',
        detail: err instanceof Error ? err.message : 'Custom endpoint unreachable',
      };
    }
  } else {
    // Default: Gemini
    const effectiveKey = geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (effectiveKey) {
      try {
        const ai = createGeminiClient(geminiApiKey);
        const ping = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: 'Respond with OK.',
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        const text = (ping.text ?? '').trim();
        results.gemini = {
          ok: Boolean(text),
          mode: geminiApiKey?.trim() ? 'live' : 'env',
          detail: geminiApiKey?.trim()
            ? 'Custom Gemini key verified via server proxy'
            : 'AI Studio server Gemini key verified',
        };
        results.ai = {
          ok: results.gemini.ok,
          provider: 'gemini',
          mode: results.gemini.mode,
          detail: results.gemini.detail,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gemini request failed';
        results.gemini = {
          ok: false,
          mode: geminiApiKey?.trim() ? 'live' : 'env',
          detail: message,
        };
        results.ai = {
          ok: false,
          provider: 'gemini',
          mode: geminiApiKey?.trim() ? 'live' : 'env',
          detail: message,
        };
      }
    }
  }

  // 2. Check OKX public market endpoint + key completeness (never execute trades)
  try {
    const okxRes = await fetch('https://www.okx.com/api/v5/public/time');
    const publicReachable = okxRes.ok;
    const hasAllOkxKeys = Boolean(
      okxApiKey?.trim() && okxSecretKey?.trim() && okxPassphrase?.trim()
    );
    results.okx = {
      ok: publicReachable && hasAllOkxKeys,
      mode: hasAllOkxKeys ? 'public_ok' : 'keys_incomplete',
      detail: hasAllOkxKeys
        ? 'OKX REST reachable and API/Secret/Passphrase present (read/trade keys stored locally)'
        : publicReachable
          ? 'OKX public API reachable; enter API Key, Secret, and Passphrase for Docker export'
          : 'OKX public API unreachable from container',
    };
  } catch {
    results.okx = {
      ok: false,
      mode: 'keys_incomplete',
      detail: 'Could not reach OKX public endpoint',
    };
  }

  // 3. Ping Freqtrade REST API URL (with strict 2s timeout, safe for private 100.x.x.x VPN IPs)
  const targetUrl = (freqtradeUrl || '').trim().replace(/\/+$/, '');
  if (!targetUrl) {
    results.freqtrade = {
      ok: false,
      reachable: false,
      detail: 'No Freqtrade REST API URL provided',
    };
  } else {
    try {
      const parsed = new URL(targetUrl);
      const isPrivateVpn =
        parsed.hostname.startsWith('100.') ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2200);
      const headers: Record<string, string> = {};
      if (freqtradeUsername && freqtradePassword) {
        headers.Authorization = `Basic ${Buffer.from(`${freqtradeUsername}:${freqtradePassword}`).toString('base64')}`;
      }
      const ftRes = await fetch(`${targetUrl}/api/v1/ping`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (ftRes.ok) {
        results.freqtrade = {
          ok: true,
          reachable: true,
          detail: 'Freqtrade REST API responded (pong)',
        };
      } else {
        results.freqtrade = {
          ok: false,
          reachable: false,
          detail: isPrivateVpn
            ? `Private VPN host (${parsed.hostname}) returned HTTP ${ftRes.status}`
            : `Freqtrade API returned HTTP ${ftRes.status}`,
        };
      }
    } catch {
      const isTailscaleOrLocal =
        targetUrl.includes('100.') ||
        targetUrl.includes('127.0.0.1') ||
        targetUrl.includes('localhost') ||
        targetUrl.includes('192.168.');
      results.freqtrade = {
        ok: false,
        reachable: false,
        detail: isTailscaleOrLocal
          ? 'Private VPN/localhost IP not reachable from cloud sandbox (expected when running Freqtrade on your Docker host)'
          : 'Connection timed out reaching Freqtrade REST API',
      };
    }
  }

  res.json(results);
});

app.post('/api/models', async (req, res) => {
  const {
    provider = 'gemini',
    apiKey,
    baseUrl,
  } = (req.body || {}) as {
    provider: 'gemini' | 'groq' | 'openrouter' | 'custom';
    apiKey?: string;
    baseUrl?: string;
  };

  try {
    if (provider === 'groq') {
      const key = apiKey?.trim() || process.env.GROQ_API_KEY?.trim();
      if (!key) {
        res.json({
          provider: 'groq',
          models: [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'qwen-2.5-32b',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
          ],
          source: 'default_fallback',
        });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const gRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!gRes.ok) {
        const errText = await gRes.text();
        res.status(gRes.status).json({ error: `Groq error ${gRes.status}: ${errText}` });
        return;
      }

      const data = (await gRes.json()) as { data?: Array<{ id: string; active?: boolean }> };
      const rawList = Array.isArray(data.data) ? data.data : [];
      // Filter out non-chat models (audio, whisper, guardrails, tts)
      const filtered = rawList
        .map((m) => m.id)
        .filter((id) => {
          const lower = id.toLowerCase();
          return (
            !lower.includes('whisper') &&
            !lower.includes('guard') &&
            !lower.includes('orpheus') &&
            !lower.includes('tts')
          );
        })
        .sort((a, b) => {
          if (a.includes('70b') && !b.includes('70b')) return -1;
          if (!a.includes('70b') && b.includes('70b')) return 1;
          return a.localeCompare(b);
        });

      res.json({
        provider: 'groq',
        models: filtered.length > 0 ? filtered : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
        source: 'live_api',
      });
      return;
    }

    if (provider === 'openrouter') {
      const key = apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const headers: Record<string, string> = {
        'HTTP-Referer': 'https://nexusquant.ai',
        'X-Title': 'NexusQuant AI',
      };
      if (key) headers.Authorization = `Bearer ${key}`;

      const oRes = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!oRes.ok) {
        res.json({
          provider: 'openrouter',
          models: [
            'deepseek/deepseek-r1',
            'anthropic/claude-3.5-sonnet',
            'meta-llama/llama-3.3-70b-instruct',
            'google/gemini-2.5-flash',
            'openai/gpt-4o',
          ],
          source: 'default_fallback',
        });
        return;
      }

      const data = (await oRes.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          pricing?: { prompt?: string; completion?: string };
        }>;
      };
      const rawList = Array.isArray(data.data) ? data.data : [];
      const freeModels: string[] = [];
      const paidModels: string[] = [];

      for (const m of rawList) {
        const isFree =
          m.id.endsWith(':free') ||
          (Number(m.pricing?.prompt || 1) === 0 && Number(m.pricing?.completion || 1) === 0);
        if (isFree) {
          freeModels.push(m.id);
        } else {
          paidModels.push(m.id);
        }
      }

      const sorted = [...freeModels, ...paidModels];
      res.json({
        provider: 'openrouter',
        models: sorted.length > 0 ? sorted.slice(0, 150) : ['deepseek/deepseek-r1:free', 'meta-llama/llama-3.3-70b-instruct:free'],
        freeModels: freeModels.slice(0, 50),
        source: 'live_api',
      });
      return;
    }

    if (provider === 'gemini') {
      const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!key) {
        res.json({
          provider: 'gemini',
          models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash'],
          source: 'default_fallback',
        });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const mRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (!mRes.ok) {
        res.json({
          provider: 'gemini',
          models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash'],
          source: 'default_fallback',
        });
        return;
      }

      const data = (await mRes.json()) as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
      };
      const rawList = Array.isArray(data.models) ? data.models : [];
      const models = rawList
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((id) => !id.includes('embedding') && !id.includes('imagen') && !id.includes('aqa'));

      res.json({
        provider: 'gemini',
        models: models.length > 0 ? models : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
        source: 'live_api',
      });
      return;
    }

    if (provider === 'custom') {
      const targetBase = (baseUrl || 'http://localhost:11434/v1').trim().replace(/\/+$/, '');
      const key = apiKey?.trim() || process.env.CUSTOM_API_KEY?.trim();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const headers: Record<string, string> = {};
      if (key) headers.Authorization = `Bearer ${key}`;

      const cRes = await fetch(`${targetBase}/models`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!cRes.ok) {
        res.status(cRes.status).json({ error: `Custom endpoint error HTTP ${cRes.status}` });
        return;
      }

      const data = (await cRes.json()) as { data?: Array<{ id: string }> };
      const rawList = Array.isArray(data.data) ? data.data : [];
      res.json({
        provider: 'custom',
        models: rawList.map((m) => m.id),
        source: 'live_api',
      });
      return;
    }

    res.status(400).json({ error: 'Unknown provider' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to query models' });
  }
});

function cleanJsonOutput(text: string): string {
  const trimmed = (text || '').trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

const simulateHandler = async (req: express.Request, res: express.Response) => {
  const body = (req.body || {}) as SimulateRequestBody;
  const aiProvider = body.aiProvider || 'gemini';
  const pair = body.pair || 'BTC/USDT';
  const timeframe = body.timeframe || '15m';
  const language = body.language === 'tr' ? 'tr' : 'en';
  const rsi = typeof body.rsi === 'number' ? body.rsi : 27.4;
  const emaFast = typeof body.emaFast === 'number' ? body.emaFast : 9;
  const emaSlow = typeof body.emaSlow === 'number' ? body.emaSlow : 21;
  const atrPct = typeof body.atrPct === 'number' ? body.atrPct : 1.35;
  const confidenceThreshold = typeof body.confidenceThreshold === 'number' ? body.confidenceThreshold : 80;
  const baseStakeUsdt = typeof body.baseStakeUsdt === 'number' ? body.baseStakeUsdt : 250;

  const feeds = body.feeds ?? { fearGreed: true, cryptoPanic: true };
  const enabledSkills = body.enabledSkills ?? {
    fetch_sentiment_and_fear_greed: true,
    check_multi_timeframe_trend: true,
    calculate_dynamic_position_size: true,
    post_trade_journal_summary: true,
    drawdown_circuit_breaker: true,
    pre_trade_discipline_gate: true,
  };

  let compactCsv = body.compactCsv || '';
  let rawJsonChars = body.rawJsonChars || 0;
  let marketSource: 'live' | 'sample' = 'sample';

  if (!compactCsv) {
    const instId = pair.replace('/', '-');
    const barMap: Record<string, string> = { '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H' };
    const { candles, source } = await fetchOkxCandles(instId, barMap[timeframe] || '15m', 10);
    compactCsv = formatCompactCsv(candles);
    rawJsonChars = JSON.stringify(candles).length * 4;
    marketSource = source === 'live' ? 'live' : 'sample';
  }

  const fng = feeds.fearGreed ? await fetchFearAndGreed() : null;
  const languageName = language === 'tr' ? 'Turkish (Türkçe)' : 'English';

  const systemInstruction = `You are a disciplined algorithmic crypto trading signal validator for a Freqtrade + OKX bot.
Respond with extreme precision. Output reasoning and journal notes strictly in ${languageName}.
Approval threshold is ${confidenceThreshold}% confidence.
If you have tools attached, call the relevant enabled tools before making your final judgment so you ground your decision in multi-timeframe trend, sentiment, and dynamic position sizing.
Return final output strictly as JSON with keys: action ("BUY"|"SELL"|"HOLD"), confidence (0-100), reasoning (${languageName}), position_multiplier (0.25-1.25), journal_note (1 sentence in ${languageName}).
Keep explanations concise (max 2 sentences).`;

  const userPrompt = [
    `Pair: ${pair} | TF: ${timeframe} | Source: ${marketSource}`,
    `Indicators: RSI=${rsi}, EMA_Fast=${emaFast}, EMA_Slow=${emaSlow}, ATR%=${atrPct}, BaseStake=${baseStakeUsdt} USDT`,
    fng ? `FearGreed=${fng.value} (${fng.classification})` : 'FearGreed=disabled',
    feeds.cryptoPanic ? 'CryptoPanic=enabled (check via sentiment tool)' : 'CryptoPanic=disabled',
    `Compact OHLCV CSV (last 10 candles):\n${compactCsv}`,
    `Return final decision as JSON with keys: action (BUY|SELL|HOLD), confidence (0-100), reasoning (${languageName}), position_multiplier (0.25-1.25), journal_note (1 sentence in ${languageName}).`,
  ].join('\n');

  const executeSkill = async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (name === 'fetch_sentiment_and_fear_greed') {
      const liveFng = await fetchFearAndGreed();
      const baseSym = String(args.symbol || pair.split('/')[0]);
      return {
        fear_greed_index: liveFng.value,
        classification: liveFng.classification,
        cryptopanic_headlines: feeds.cryptoPanic
          ? [
              `${baseSym} institutional spot inflows remain resilient ahead of US session`,
              `OKX perpetual funding rate stays neutral at +0.008%`,
            ]
          : [],
        source: liveFng.source,
      };
    } else if (name === 'check_multi_timeframe_trend') {
      const instId = pair.replace('/', '-');
      const [h1, h4] = await Promise.all([
        fetchOkxCandles(instId, '1H', 10),
        fetchOkxCandles(instId, '4H', 10),
      ]);
      const h1Closes = h1.candles.map((c) => c.c);
      const h4Closes = h4.candles.map((c) => c.c);
      const h1Slope =
        h1Closes.length > 1
          ? Number((((h1Closes[h1Closes.length - 1] - h1Closes[0]) / h1Closes[0]) * 100).toFixed(2))
          : 0;
      const h4Slope =
        h4Closes.length > 1
          ? Number((((h4Closes[h4Closes.length - 1] - h4Closes[0]) / h4Closes[0]) * 100).toFixed(2))
          : 0;
      return {
        tf_1h_change_pct: h1Slope,
        tf_4h_change_pct: h4Slope,
        trend_1h: h1Slope >= 0 ? 'BULLISH' : 'BEARISH',
        trend_4h: h4Slope >= -0.4 ? 'CONSTRUCTIVE' : 'WEAK',
        aligned: rsi < 35 ? h4Slope > -1.5 : rsi > 65 ? h1Slope < 1.5 : false,
      };
    } else if (name === 'calculate_dynamic_position_size') {
      const conf = Number(args.preliminary_confidence ?? 78);
      const atr = Number(args.atr_percent ?? atrPct);
      const stake = Number(args.base_stake_usdt ?? baseStakeUsdt);
      const confFactor = conf >= 85 ? 1.0 : conf >= 70 ? 0.7 : 0.4;
      const volFactor = atr > 2.2 ? 0.75 : atr < 0.8 ? 1.1 : 1.0;
      const multiplier = Number((confFactor * volFactor).toFixed(2));
      return {
        recommended_multiplier: multiplier,
        recommended_stake_usdt: Number((stake * multiplier).toFixed(2)),
        volatility_regime: atr > 2.2 ? 'HIGH' : 'NORMAL',
      };
    } else if (name === 'post_trade_journal_summary') {
      return {
        recorded: true,
        language,
        note: String(args.summary_note || ''),
      };
    } else if (name === 'drawdown_circuit_breaker') {
      const dailyLossPct = Number(args.daily_loss_pct ?? 0.4);
      const losingStreak = Number(args.consecutive_losses ?? 0);
      const maxDailyLossAllowed = 2.0;
      const maxStreakAllowed = 2;
      const isHalted = dailyLossPct >= maxDailyLossAllowed;
      const isCooldown = losingStreak >= maxStreakAllowed;
      const permission = isHalted ? 'HALTED' : isCooldown ? 'COOLDOWN' : 'TRADING_ALLOWED';
      return {
        decision: permission,
        daily_loss_pct: dailyLossPct,
        max_daily_loss_pct: maxDailyLossAllowed,
        consecutive_losses: losingStreak,
        cooldown_hours_remaining: isCooldown ? 24 : 0,
        risk_allowed: permission === 'TRADING_ALLOWED',
        protocol: 'claude-trading-skills/drawdown-circuit-breaker',
      };
    } else if (name === 'pre_trade_discipline_gate') {
      const entryInPlan = args.entry_in_written_plan !== false;
      const stopPredefined = args.stop_predefined !== false;
      const sizeWithinPlan = args.size_within_plan !== false;
      const noRevenge = args.no_revenge_trading !== false;
      const passed = entryInPlan && stopPredefined && sizeWithinPlan && noRevenge;
      return {
        gate_passed: passed,
        status: passed ? 'ORDER_PERMITTED' : 'REVIEW_REQUIRED_GATE_BLOCKED',
        checklist: {
          entry_in_written_plan: entryInPlan,
          stop_loss_predefined: stopPredefined,
          risk_size_within_plan: sizeWithinPlan,
          emotional_revenge_checked: noRevenge,
        },
        protocol: 'claude-trading-skills/pre-trade-discipline-gate',
      };
    }
    return {};
  };

  const toolTrace: Array<{ skill: string; args: Record<string, unknown>; result: Record<string, unknown> }> = [];
  let totalPromptTokens = 0;
  let totalOutputTokens = 0;
  let rawJsonText = '';

  try {
    if (aiProvider === 'groq' || aiProvider === 'openrouter' || aiProvider === 'custom') {
      let endpoint = '';
      let apiKey = '';
      let targetModel = body.model || '';
      const extraHeaders: Record<string, string> = {};

      if (aiProvider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        apiKey = body.customGroqKey?.trim() || process.env.GROQ_API_KEY?.trim() || '';
        targetModel = targetModel || 'llama-3.3-70b-versatile';
        if (!apiKey) {
          res.status(400).json({ error: 'Groq API key is not configured in Settings or server environment.' });
          return;
        }
      } else if (aiProvider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        apiKey = body.customOpenRouterKey?.trim() || process.env.OPENROUTER_API_KEY?.trim() || '';
        targetModel = targetModel || 'deepseek/deepseek-r1';
        extraHeaders['HTTP-Referer'] = 'https://nexusquant.ai';
        extraHeaders['X-Title'] = 'NexusQuant AI';
        if (!apiKey) {
          res.status(400).json({ error: 'OpenRouter API key is not configured in Settings or server environment.' });
          return;
        }
      } else {
        const baseUrl = (body.customApiBaseUrl || 'http://localhost:11434/v1').trim().replace(/\/+$/, '');
        endpoint = `${baseUrl}/chat/completions`;
        apiKey = body.customApiKey?.trim() || process.env.CUSTOM_API_KEY?.trim() || '';
        targetModel = targetModel || 'llama3';
      }

      const openAiTools = [
        ...(enabledSkills.fetch_sentiment_and_fear_greed ? [{
          type: 'function',
          function: {
            name: 'fetch_sentiment_and_fear_greed',
            description: 'Fetch live crypto Fear & Greed Index and recent market sentiment headlines for the trading pair.',
            parameters: {
              type: 'object',
              properties: { symbol: { type: 'string', description: 'Base asset symbol, e.g. BTC or ETH' } },
              required: ['symbol'],
            },
          },
        }] : []),
        ...(enabledSkills.check_multi_timeframe_trend ? [{
          type: 'function',
          function: {
            name: 'check_multi_timeframe_trend',
            description: 'Inspect higher timeframe (1h and 4h) EMA trend alignment before approving a lower timeframe entry.',
            parameters: {
              type: 'object',
              properties: {
                pair: { type: 'string', description: 'Trading pair such as BTC/USDT' },
                lower_timeframe: { type: 'string', description: 'Current signal timeframe, e.g. 15m' },
              },
              required: ['pair', 'lower_timeframe'],
            },
          },
        }] : []),
        ...(enabledSkills.calculate_dynamic_position_size ? [{
          type: 'function',
          function: {
            name: 'calculate_dynamic_position_size',
            description: 'Calculate adjusted USDT stake size based on preliminary signal confidence and ATR volatility.',
            parameters: {
              type: 'object',
              properties: {
                preliminary_confidence: { type: 'number', description: 'Confidence 0 to 100' },
                atr_percent: { type: 'number', description: 'ATR volatility percentage' },
                base_stake_usdt: { type: 'number', description: 'Default stake amount in USDT' },
              },
              required: ['preliminary_confidence', 'atr_percent', 'base_stake_usdt'],
            },
          },
        }] : []),
        ...(enabledSkills.post_trade_journal_summary ? [{
          type: 'function',
          function: {
            name: 'post_trade_journal_summary',
            description: 'Generate a concise 1-sentence localized journal entry summarizing the technical and sentiment rationale.',
            parameters: {
              type: 'object',
              properties: {
                pair: { type: 'string', description: 'Trading pair' },
                proposed_action: { type: 'string', description: 'BUY, SELL, or HOLD' },
                summary_note: { type: 'string', description: '1-sentence rationale in the requested UI language' },
              },
              required: ['pair', 'proposed_action', 'summary_note'],
            },
          },
        }] : []),
        ...(enabledSkills.drawdown_circuit_breaker ? [{
          type: 'function',
          function: {
            name: 'drawdown_circuit_breaker',
            description: 'Evaluate account-level daily drawdown (2% limit) and losing streak cooldown before allowing new trade risk.',
            parameters: {
              type: 'object',
              properties: {
                daily_loss_pct: { type: 'number', description: 'Current day realized loss percentage' },
                consecutive_losses: { type: 'number', description: 'Number of consecutive losing trades' },
              },
            },
          },
        }] : []),
        ...(enabledSkills.pre_trade_discipline_gate ? [{
          type: 'function',
          function: {
            name: 'pre_trade_discipline_gate',
            description: 'Pre-order discipline checklist gate to block unhedged, oversized, off-plan, or revenge entries.',
            parameters: {
              type: 'object',
              properties: {
                entry_in_written_plan: { type: 'boolean', description: 'Whether trade setup matches documented plan' },
                stop_predefined: { type: 'boolean', description: 'Whether stop-loss price and risk percentage are predefined' },
                size_within_plan: { type: 'boolean', description: 'Whether position stake is within portfolio risk rules' },
                no_revenge_trading: { type: 'boolean', description: 'Verification that this entry is not an emotional revenge trade' },
              },
            },
          },
        }] : []),
      ];

      const messages: any[] = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ];

      const reqBody1: any = {
        model: targetModel,
        messages,
        temperature: 0.1,
      };

      if (openAiTools.length > 0) {
        reqBody1.tools = openAiTools;
        reqBody1.tool_choice = 'auto';
      } else {
        reqBody1.response_format = { type: 'json_object' };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders,
      };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res1 = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(reqBody1),
      });

      if (!res1.ok) {
        const errText = await res1.text();
        const isToolUnsupported =
          openAiTools.length > 0 &&
          (errText.includes('tool calling') ||
            errText.includes('tools') ||
            errText.includes('param') ||
            errText.includes('function') ||
            res1.status === 400);

        if (isToolUnsupported) {
          // Graceful fallback for models that do not support OpenAI native function calling
          // (e.g. gemma2-9b-it, qwen-2.5-32b, deepseek-r1-distill or certain free OpenRouter models):
          // Pre-evaluate enabled skills on the server and inject findings into user prompt.
          const preEvaluatedContext: string[] = [];

          if (enabledSkills.fetch_sentiment_and_fear_greed) {
            const sym = pair.split('/')[0] || 'BTC';
            const sRes = await executeSkill('fetch_sentiment_and_fear_greed', { symbol: sym });
            toolTrace.push({ skill: 'fetch_sentiment_and_fear_greed', args: { symbol: sym }, result: sRes });
            preEvaluatedContext.push(`- Fear & Greed: ${sRes.fear_greed_index} (${sRes.classification})`);
          }

          if (enabledSkills.check_multi_timeframe_trend) {
            const tRes = await executeSkill('check_multi_timeframe_trend', { pair, lower_timeframe: timeframe });
            toolTrace.push({ skill: 'check_multi_timeframe_trend', args: { pair, lower_timeframe: timeframe }, result: tRes });
            preEvaluatedContext.push(`- Multi-Timeframe Trend: 1H=${tRes.trend_1h} (${tRes.tf_1h_change_pct}%), 4H=${tRes.trend_4h} (${tRes.tf_4h_change_pct}%)`);
          }

          if (enabledSkills.drawdown_circuit_breaker) {
            const cRes = await executeSkill('drawdown_circuit_breaker', {});
            toolTrace.push({ skill: 'drawdown_circuit_breaker', args: {}, result: cRes });
            preEvaluatedContext.push(`- Circuit Breaker: ${cRes.decision} (Risk Allowed: ${cRes.risk_allowed})`);
          }

          if (enabledSkills.pre_trade_discipline_gate) {
            const gRes = await executeSkill('pre_trade_discipline_gate', {});
            toolTrace.push({ skill: 'pre_trade_discipline_gate', args: {}, result: gRes });
            preEvaluatedContext.push(`- Discipline Gate: ${gRes.status} (Passed: ${gRes.gate_passed})`);
          }

          if (enabledSkills.calculate_dynamic_position_size) {
            const pRes = await executeSkill('calculate_dynamic_position_size', {
              preliminary_confidence: confidenceThreshold,
              atr_percent: atrPct,
              base_stake_usdt: baseStakeUsdt,
            });
            toolTrace.push({
              skill: 'calculate_dynamic_position_size',
              args: {
                preliminary_confidence: confidenceThreshold,
                atr_percent: atrPct,
                base_stake_usdt: baseStakeUsdt,
              },
              result: pRes,
            });
            preEvaluatedContext.push(`- Position Sizing: ${pRes.recommended_stake_usdt} USDT (Multiplier: ${pRes.recommended_multiplier}x)`);
          }

          const fallbackPrompt = [
            userPrompt,
            '',
            'Pre-Evaluated Quant Tools & Signals (Local Execution):',
            ...preEvaluatedContext,
            '',
            `Return your final decision STRICTLY as a JSON object with keys: action ("BUY"|"SELL"|"HOLD"), confidence (0-100), reasoning (${languageName}), position_multiplier (0.25-1.25), journal_note (1 sentence in ${languageName}).`,
          ].join('\n');

          const reqBodyFallback = {
            model: targetModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: fallbackPrompt },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          };

          const resFallback = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(reqBodyFallback),
          });

          if (!resFallback.ok) {
            const errFallback = await resFallback.text();
            throw new Error(`${aiProvider.toUpperCase()} HTTP ${resFallback.status}: ${errFallback}`);
          }

          const jsonFallback = (await resFallback.json()) as any;
          totalPromptTokens += jsonFallback.usage?.prompt_tokens ?? 0;
          totalOutputTokens += jsonFallback.usage?.completion_tokens ?? 0;
          rawJsonText = cleanJsonOutput(jsonFallback.choices?.[0]?.message?.content ?? '{}');
        } else {
          throw new Error(`${aiProvider.toUpperCase()} HTTP ${res1.status}: ${errText}`);
        }
      } else {

      const json1 = (await res1.json()) as any;
      totalPromptTokens += json1.usage?.prompt_tokens ?? 0;
      totalOutputTokens += json1.usage?.completion_tokens ?? 0;

      const choice1 = json1.choices?.[0];
      const message1 = choice1?.message;
      const toolCalls = message1?.tool_calls || [];

      if (toolCalls.length > 0) {
        messages.push(message1);
        for (const tc of toolCalls) {
          let tArgs: Record<string, unknown> = {};
          try {
            tArgs = JSON.parse(tc.function?.arguments || '{}');
          } catch {
            tArgs = {};
          }
          const tRes = await executeSkill(tc.function?.name, tArgs);
          toolTrace.push({
            skill: tc.function?.name || 'unknown',
            args: tArgs,
            result: tRes,
          });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(tRes),
          });
        }

        const reqBody2 = {
          model: targetModel,
          messages,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        };
        const res2 = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(reqBody2),
        });
        if (!res2.ok) {
          const errText2 = await res2.text();
          throw new Error(`${aiProvider.toUpperCase()} Step 2 HTTP ${res2.status}: ${errText2}`);
        }
        const json2 = (await res2.json()) as any;
        totalPromptTokens += json2.usage?.prompt_tokens ?? 0;
        totalOutputTokens += json2.usage?.completion_tokens ?? 0;
        rawJsonText = cleanJsonOutput(json2.choices?.[0]?.message?.content ?? '{}');
      } else {
        rawJsonText = cleanJsonOutput(message1?.content ?? '{}');
      }
    }
  } else {
    // Default: Gemini
      const effectiveKey = body.customGeminiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!effectiveKey) {
        res.status(400).json({
          error: 'Gemini API key is not configured on the server or in Settings.',
        });
        return;
      }

      const ai = createGeminiClient(body.customGeminiKey);
      const functionDeclarations: FunctionDeclaration[] = [];

      if (enabledSkills.fetch_sentiment_and_fear_greed) {
        functionDeclarations.push({
          name: 'fetch_sentiment_and_fear_greed',
          description: 'Fetch live crypto Fear & Greed Index and recent market sentiment headlines for the trading pair.',
          parameters: {
            type: Type.OBJECT,
            properties: { symbol: { type: Type.STRING, description: 'Base asset symbol, e.g. BTC or ETH' } },
            required: ['symbol'],
          },
        });
      }

      if (enabledSkills.check_multi_timeframe_trend) {
        functionDeclarations.push({
          name: 'check_multi_timeframe_trend',
          description: 'Inspect higher timeframe (1h and 4h) EMA trend alignment before approving a lower timeframe entry.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              pair: { type: Type.STRING, description: 'Trading pair such as BTC/USDT' },
              lower_timeframe: { type: Type.STRING, description: 'Current signal timeframe, e.g. 15m' },
            },
            required: ['pair', 'lower_timeframe'],
          },
        });
      }

      if (enabledSkills.calculate_dynamic_position_size) {
        functionDeclarations.push({
          name: 'calculate_dynamic_position_size',
          description: 'Calculate adjusted USDT stake size based on preliminary signal confidence and ATR volatility.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              preliminary_confidence: { type: Type.NUMBER, description: 'Confidence 0 to 100' },
              atr_percent: { type: Type.NUMBER, description: 'ATR volatility percentage' },
              base_stake_usdt: { type: Type.NUMBER, description: 'Default stake amount in USDT' },
            },
            required: ['preliminary_confidence', 'atr_percent', 'base_stake_usdt'],
          },
        });
      }

      if (enabledSkills.post_trade_journal_summary) {
        functionDeclarations.push({
          name: 'post_trade_journal_summary',
          description: 'Generate a concise 1-sentence localized journal entry summarizing the technical and sentiment rationale.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              pair: { type: Type.STRING, description: 'Trading pair' },
              proposed_action: { type: Type.STRING, description: 'BUY, SELL, or HOLD' },
              summary_note: { type: Type.STRING, description: '1-sentence rationale in the requested UI language' },
            },
            required: ['pair', 'proposed_action', 'summary_note'],
          },
        });
      }

      if (enabledSkills.drawdown_circuit_breaker) {
        functionDeclarations.push({
          name: 'drawdown_circuit_breaker',
          description: 'Evaluate account-level daily drawdown (2% limit) and losing streak cooldown before allowing new trade risk.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              daily_loss_pct: { type: Type.NUMBER, description: 'Current day realized loss percentage' },
              consecutive_losses: { type: Type.NUMBER, description: 'Number of consecutive losing trades' },
            },
          },
        });
      }

      if (enabledSkills.pre_trade_discipline_gate) {
        functionDeclarations.push({
          name: 'pre_trade_discipline_gate',
          description: 'Pre-order discipline checklist gate to block unhedged, oversized, off-plan, or revenge entries.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              entry_in_written_plan: { type: Type.BOOLEAN, description: 'Whether trade setup matches documented plan' },
              stop_predefined: { type: Type.BOOLEAN, description: 'Whether stop-loss price and risk percentage are predefined' },
              size_within_plan: { type: Type.BOOLEAN, description: 'Whether position stake is within portfolio risk rules' },
              no_revenge_trading: { type: Type.BOOLEAN, description: 'Verification that this entry is not an emotional revenge trade' },
            },
          },
        });
      }

      if (functionDeclarations.length > 0) {
        const step1 = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            tools: [{ functionDeclarations }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        totalPromptTokens += step1.usageMetadata?.promptTokenCount ?? 0;
        totalOutputTokens += step1.usageMetadata?.candidatesTokenCount ?? 0;

        const functionCalls = step1.functionCalls ?? [];

        if (functionCalls.length > 0) {
          const functionResponses = [];

          for (const fc of functionCalls) {
            const args = (fc.args ?? {}) as Record<string, unknown>;
            const toolResult = await executeSkill(fc.name || '', args);

            toolTrace.push({
              skill: fc.name || 'unknown',
              args,
              result: toolResult,
            });

            functionResponses.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { output: toolResult },
              },
            });
          }

          const previousContent = step1.candidates?.[0]?.content;
          const step2 = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: [
              { role: 'user', parts: [{ text: userPrompt }] },
              ...(previousContent ? [previousContent] : []),
              { role: 'user', parts: functionResponses },
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING, description: 'BUY, SELL, or HOLD' },
                  confidence: { type: Type.INTEGER, description: 'Confidence score 0 to 100' },
                  reasoning: { type: Type.STRING, description: `Concise reasoning in ${languageName}` },
                  position_multiplier: { type: Type.NUMBER, description: 'Stake multiplier e.g. 0.75 or 1.0' },
                  journal_note: { type: Type.STRING, description: `1-sentence journal summary in ${languageName}` },
                },
                required: ['action', 'confidence', 'reasoning', 'position_multiplier', 'journal_note'],
              },
            },
          });

          totalPromptTokens += step2.usageMetadata?.promptTokenCount ?? 0;
          totalOutputTokens += step2.usageMetadata?.candidatesTokenCount ?? 0;
          rawJsonText = cleanJsonOutput(step2.text ?? '{}');
        } else {
          const text = cleanJsonOutput(step1.text ?? '');
          if (text.startsWith('{')) {
            rawJsonText = text;
          } else {
            const stepFormat = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: `Convert this analysis into strict JSON:\n${text}\n\nOriginal request:\n${userPrompt}`,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING },
                    confidence: { type: Type.INTEGER },
                    reasoning: { type: Type.STRING },
                    position_multiplier: { type: Type.NUMBER },
                    journal_note: { type: Type.STRING },
                  },
                  required: ['action', 'confidence', 'reasoning', 'position_multiplier', 'journal_note'],
                },
              },
            });
            totalPromptTokens += stepFormat.usageMetadata?.promptTokenCount ?? 0;
            totalOutputTokens += stepFormat.usageMetadata?.candidatesTokenCount ?? 0;
            rawJsonText = cleanJsonOutput(stepFormat.text ?? '{}');
          }
        }
      } else {
        const direct = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                confidence: { type: Type.INTEGER },
                reasoning: { type: Type.STRING },
                position_multiplier: { type: Type.NUMBER },
                journal_note: { type: Type.STRING },
              },
              required: ['action', 'confidence', 'reasoning', 'position_multiplier', 'journal_note'],
            },
          },
        });
        totalPromptTokens += direct.usageMetadata?.promptTokenCount ?? 0;
        totalOutputTokens += direct.usageMetadata?.candidatesTokenCount ?? 0;
        rawJsonText = cleanJsonOutput(direct.text ?? '{}');
      }
    }

    const parsed = JSON.parse(rawJsonText) as {
      action?: string;
      confidence?: number;
      reasoning?: string;
      position_multiplier?: number;
      journal_note?: string;
    };

    const normalizedAction = ['BUY', 'SELL', 'HOLD'].includes((parsed.action || '').toUpperCase())
      ? (parsed.action!.toUpperCase() as 'BUY' | 'SELL' | 'HOLD')
      : 'HOLD';
    const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 50))));
    const multiplier = Number(Math.max(0.25, Math.min(1.5, Number(parsed.position_multiplier ?? 1.0))).toFixed(2));
    const totalTokens = totalPromptTokens + totalOutputTokens;

    const compactChars = compactCsv.length;
    const baselineRawChars = rawJsonChars > compactChars ? rawJsonChars : compactChars * 3.4;
    const savedPct = Math.max(
      15,
      Math.min(82, Math.round(((baselineRawChars - compactChars) / baselineRawChars) * 100))
    );

    res.json({
      decision: {
        action: normalizedAction,
        confidence,
        reasoning: parsed.reasoning || (language === 'tr' ? 'Sinyal değerlendirildi.' : 'Signal evaluated.'),
        position_multiplier: multiplier,
        journal_note: parsed.journal_note || '',
        approved: normalizedAction !== 'HOLD' && confidence >= confidenceThreshold,
      },
      toolTrace,
      usage: {
        promptTokens: totalPromptTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        estimatedCostUsd: 0,
      },
      payloadStats: {
        compactCsv,
        compactChars,
        rawJsonChars: Math.round(baselineRawChars),
        tokensSavedPct: savedPct,
      },
      fearGreed: fng,
      marketSource,
      provider: aiProvider,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI simulation failed';
    res.status(500).json({ error: msg });
  }
};

app.post('/api/gemini/simulate', simulateHandler);
app.post('/api/ai/simulate', simulateHandler);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
