import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiAvailable: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Proxy route for market data to eliminate any browser CORS or rate-limit issues
app.get('/api/market-data', async (req, res) => {
  const symbol = (req.query.symbol as string) || 'BTC-USD';
  try {
    if (symbol === 'XAUT-USD') {
      // Bitfinex ticker & candles
      const [candleRes, tickerRes] = await Promise.all([
        fetch('https://api-pub.bitfinex.com/v2/candles/trade:1D:tXAUT:USD/hist?limit=30'),
        fetch('https://api-pub.bitfinex.com/v2/ticker/tXAUT:USD'),
      ]);

      if (candleRes.ok && tickerRes.ok) {
        const rawCandles = await candleRes.json();
        const ticker = await tickerRes.json();
        return res.json({
          provider: 'bitfinex',
          candles: rawCandles,
          ticker: ticker,
        });
      }
    }

    const symbolMap: Record<string, string> = {
      'BTC-USD': 'BTCUSDT',
      'ETH-USD': 'ETHUSDT',
      'SOL-USD': 'SOLUSDT',
      'PAXG-USD': 'PAXGUSDT',
    };

    const binancePair = symbolMap[symbol];
    if (!binancePair) {
      return res.status(400).json({ error: `Unsupported symbol: ${symbol}` });
    }

    const [klineRes, tickerRes, hourRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=1d&limit=30`),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binancePair}`),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=1h&limit=48`),
    ]);

    if (klineRes.ok && tickerRes.ok) {
      const klines = await klineRes.json();
      const ticker = await tickerRes.json();
      const hourly = hourRes.ok ? await hourRes.json() : [];
      return res.json({
        provider: 'binance',
        pair: binancePair,
        klines,
        ticker,
        hourly,
      });
    }

    return res.status(502).json({ error: 'Upstream provider error' });
  } catch (error) {
    console.error('Server market-data proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Gemini endpoint for sell-side analyst brief synthesis
app.post('/api/gemini/generate-brief', async (req, res) => {
  try {
    const ai = getAI();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY environment variable is not configured',
      });
    }

    const { symbol, session, date, quantData } = req.body;

    const systemPrompt = `You are a Senior Sell-Side Equity & Futures Trading Desk Analyst preparing a pre-market technical brief for institutional trading desks planning intraday trades.
Your output must be precise, sourced, and completely free of vague language (never say "could go either way" or "watch for volatility" without attaching exact numbers and computed levels).
Adhere strictly to the requested 4-part output format:
1. One-paragraph summary bias (bullish/bearish/neutral + why, 3 sentences max).
2. Key Levels table (level name, price, method).
3. Trade Setups table (| Setup | Trigger/Entry | Invalidation (Stop) | Target 1 | Target 2 | R:R | Volume/Confirmation Needed |) where each entry and stop references computed levels and states the exact invalidation condition.
4. Risk Notes (bulleted, max 5 items: scheduled catalysts with exact time, volatility regime & ATR sizing).
Do not pad with generic commentary. Keep tone institutional, direct, and rigorous.`;

    const userPrompt = `Generate the Sell-Side Pre-Market Technical Brief for ${symbol} for the ${session} session on date ${date}.
Here is the live verified quantitative desk data:
${JSON.stringify(quantData, null, 2)}

Provide the response in the clean 4-part sell-side format.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      },
    });

    res.json({
      briefText: response.text,
      modelUsed: 'gemini-3.8-flash',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Gemini brief generation error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate brief with Gemini',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sell-side desk terminal running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
