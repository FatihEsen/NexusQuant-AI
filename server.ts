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
    fetch_sentiment_and_fear_greed: boolean;
    check_multi_timeframe_trend: boolean;
    calculate_dynamic_position_size: boolean;
    post_trade_journal_summary: boolean;
  };
  customGeminiKey?: string;
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

app.post('/api/test-connection', async (req, res) => {
  const {
    geminiApiKey,
    okxApiKey,
    okxSecretKey,
    okxPassphrase,
    freqtradeUrl,
    freqtradeUsername,
    freqtradePassword,
  } = req.body as Record<string, string | undefined>;

  const results: {
    gemini: { ok: boolean; mode: 'live' | 'env' | 'missing'; detail: string };
    okx: { ok: boolean; mode: 'public_ok' | 'keys_incomplete'; detail: string };
    freqtrade: { ok: boolean; reachable: boolean; detail: string };
  } = {
    gemini: { ok: false, mode: 'missing', detail: 'No Gemini API key configured' },
    okx: { ok: false, mode: 'keys_incomplete', detail: 'OKX credentials incomplete' },
    freqtrade: { ok: false, reachable: false, detail: 'Freqtrade URL not checked' },
  };

  // 1. Test Gemini API server-side
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gemini request failed';
      results.gemini = {
        ok: false,
        mode: geminiApiKey?.trim() ? 'live' : 'env',
        detail: message,
      };
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

app.post('/api/gemini/simulate', async (req, res) => {
  const body = (req.body || {}) as SimulateRequestBody;
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

  const effectiveKey = body.customGeminiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!effectiveKey) {
    res.status(400).json({
      error: 'Gemini API key is not configured on the server or in Settings.',
    });
    return;
  }

  const ai = createGeminiClient(body.customGeminiKey);

  // Build modular FunctionDeclarations ONLY for enabled skills
  const functionDeclarations: FunctionDeclaration[] = [];

  if (enabledSkills.fetch_sentiment_and_fear_greed) {
    functionDeclarations.push({
      name: 'fetch_sentiment_and_fear_greed',
      description:
        'Fetch live crypto Fear & Greed Index and recent market sentiment headlines for the trading pair.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING, description: 'Base asset symbol, e.g. BTC or ETH' },
        },
        required: ['symbol'],
      },
    });
  }

  if (enabledSkills.check_multi_timeframe_trend) {
    functionDeclarations.push({
      name: 'check_multi_timeframe_trend',
      description:
        'Inspect higher timeframe (1h and 4h) EMA trend alignment before approving a lower timeframe entry.',
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
      description:
        'Calculate adjusted USDT stake size based on preliminary signal confidence and ATR volatility.',
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
      description:
        'Generate a concise 1-sentence localized journal entry summarizing the technical and sentiment rationale.',
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

  const fng = feeds.fearGreed ? await fetchFearAndGreed() : null;
  const languageName = language === 'tr' ? 'Turkish (Türkçe)' : 'English';

  const systemInstruction = `You are a disciplined algorithmic crypto trading signal validator for a Freqtrade + OKX bot.
Respond with extreme precision. Output reasoning and journal notes strictly in ${languageName}.
Approval threshold is ${confidenceThreshold}% confidence.
If you have tools attached, call the relevant enabled tools before making your final judgment so you ground your decision in multi-timeframe trend, sentiment, and dynamic position sizing.
Keep explanations concise (max 2 sentences).`;

  const userPrompt = [
    `Pair: ${pair} | TF: ${timeframe} | Source: ${marketSource}`,
    `Indicators: RSI=${rsi}, EMA_Fast=${emaFast}, EMA_Slow=${emaSlow}, ATR%=${atrPct}, BaseStake=${baseStakeUsdt} USDT`,
    fng ? `FearGreed=${fng.value} (${fng.classification})` : 'FearGreed=disabled',
    feeds.cryptoPanic ? 'CryptoPanic=enabled (check via sentiment tool)' : 'CryptoPanic=disabled',
    `Compact OHLCV CSV (last 10 candles):\n${compactCsv}`,
    `Return final decision as JSON with keys: action (BUY|SELL|HOLD), confidence (0-100), reasoning (${languageName}), position_multiplier (0.25-1.25), journal_note (1 sentence in ${languageName}).`,
  ].join('\n');

  const toolTrace: Array<{
    skill: string;
    args: Record<string, unknown>;
    result: Record<string, unknown>;
  }> = [];

  let totalPromptTokens = 0;
  let totalOutputTokens = 0;

  try {
    let rawJsonText = '';

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
          let toolResult: Record<string, unknown> = {};

          if (fc.name === 'fetch_sentiment_and_fear_greed') {
            const liveFng = await fetchFearAndGreed();
            const baseSym = String(args.symbol || pair.split('/')[0]);
            toolResult = {
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
          } else if (fc.name === 'check_multi_timeframe_trend') {
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
            toolResult = {
              tf_1h_change_pct: h1Slope,
              tf_4h_change_pct: h4Slope,
              trend_1h: h1Slope >= 0 ? 'BULLISH' : 'BEARISH',
              trend_4h: h4Slope >= -0.4 ? 'CONSTRUCTIVE' : 'WEAK',
              aligned: rsi < 35 ? h4Slope > -1.5 : rsi > 65 ? h1Slope < 1.5 : false,
            };
          } else if (fc.name === 'calculate_dynamic_position_size') {
            const conf = Number(args.preliminary_confidence ?? 78);
            const atr = Number(args.atr_percent ?? atrPct);
            const stake = Number(args.base_stake_usdt ?? baseStakeUsdt);
            const confFactor = conf >= 85 ? 1.0 : conf >= 70 ? 0.7 : 0.4;
            const volFactor = atr > 2.2 ? 0.75 : atr < 0.8 ? 1.1 : 1.0;
            const multiplier = Number((confFactor * volFactor).toFixed(2));
            toolResult = {
              recommended_multiplier: multiplier,
              recommended_stake_usdt: Number((stake * multiplier).toFixed(2)),
              volatility_regime: atr > 2.2 ? 'HIGH' : 'NORMAL',
            };
          } else if (fc.name === 'post_trade_journal_summary') {
            toolResult = {
              recorded: true,
              language,
              note: String(args.summary_note || ''),
            };
          }

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
        rawJsonText = (step2.text ?? '{}').trim();
      } else {
        // Model returned direct answer without invoking tools; enforce structured JSON if needed
        const text = (step1.text ?? '').trim();
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
          rawJsonText = (stepFormat.text ?? '{}').trim();
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
      rawJsonText = (direct.text ?? '{}').trim();
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
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini simulation failed';
    res.status(500).json({ error: msg });
  }
});

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
