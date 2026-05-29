import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '../../lib/supabaseClient';

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

type Timeframe = 'H4' | 'M15';

const TIMEFRAME_INTERVAL: Record<Timeframe, string> = {
  H4: '4h',
  M15: '15min',
};

function parseCandle(raw: TwelveDataCandle): Candle {
  return {
    timestamp: raw.datetime,
    open: parseFloat(raw.open),
    high: parseFloat(raw.high),
    low: parseFloat(raw.low),
    close: parseFloat(raw.close),
  };
}

function isBullish(c: Candle): boolean {
  return c.close > c.open;
}

function isBearish(c: Candle): boolean {
  return c.close < c.open;
}

function formatWIB(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchLastTwoCandles(timeframe: Timeframe): Promise<Candle[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('Missing TWELVEDATA_API_KEY');

  const candidates = ['XAU/USD', 'XAUUSD'];
  let lastError = '';
  const interval = TIMEFRAME_INTERVAL[timeframe];

  for (const symbol of candidates) {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=3&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      lastError = `HTTP ${res.status} for symbol ${symbol}`;
      continue;
    }

    const json = await res.json();

    if (json.status === 'error') {
      lastError = `${json.code || 'TD_ERROR'}: ${json.message || 'Unknown TwelveData error'} (symbol ${symbol})`;
      continue;
    }

    const values: TwelveDataCandle[] = json.values;
    if (!values || values.length < 2) {
      lastError = `Insufficient candle data for symbol ${symbol}`;
      continue;
    }

    return values.reverse().map(parseCandle);
  }

  throw new Error(`TwelveData fetch failed (${timeframe}): ${lastError}`);
}

async function sendTelegramAlert(signalType: 'BUY' | 'SELL', c0: Candle, timeframe: Timeframe): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('Telegram credentials missing – skipping notification');
    return;
  }

  const directionLabel =
    signalType === 'BUY' ? '🔴 ➡️ 🟢 (Merah → Hijau)' : '🟢 ➡️ 🔴 (Hijau → Merah)';

  const message = `<b>🚨 SIGNAL XAUUSD ${timeframe} - BERUBAH WARNA 🚨</b>
Jenis Sinyal: 🕯️ <b>${signalType} (${directionLabel})</b>
Waktu Close: ${formatWIB(c0.timestamp)}
📊 <b>DATA CANDLE 0 (Berubah Warna):</b>
• Open : ${c0.open.toFixed(2)}
• High : ${c0.high.toFixed(2)}
• Low  : ${c0.low.toFixed(2)}
• Close: ${c0.close.toFixed(2)}
<i>ℹ️ Sistem mengunci data. Persentase rebound Candle +1 akan dihitung otomatis pada timeframe yang sama.</i>`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error('Telegram send failed:', errBody);
  }
}

async function processTimeframe(timeframe: Timeframe) {
  const supabase = getSupabaseClient();

  const { data: pendingSignals, error: fetchError } = await supabase
    .from('signal_history')
    .select('*')
    .eq('status', 'PENDING_C1')
    .eq('timeframe', timeframe);

  if (fetchError) throw fetchError;

  if (pendingSignals && pendingSignals.length > 0) {
    const candles = await fetchLastTwoCandles(timeframe);
    const latestCandle = candles[candles.length - 1];

    for (const signal of pendingSignals) {
      const c0Close = parseFloat(signal.c0_close);
      let reboundPct: number;

      if (signal.signal_type === 'SELL') {
        reboundPct = ((latestCandle.high - c0Close) / c0Close) * 100;
      } else {
        reboundPct = ((c0Close - latestCandle.low) / c0Close) * 100;
      }

      const { error: updateError } = await supabase
        .from('signal_history')
        .update({
          status: 'COMPLETED',
          c1_timestamp: latestCandle.timestamp,
          c1_open: latestCandle.open,
          c1_high: latestCandle.high,
          c1_low: latestCandle.low,
          c1_close: latestCandle.close,
          c1_rebound_percentage: parseFloat(reboundPct.toFixed(4)),
        })
        .eq('id', signal.id);

      if (updateError) {
        console.error(`Failed to update signal ${signal.id}:`, updateError);
      }
    }
  }

  const candles = await fetchLastTwoCandles(timeframe);
  const c2 = candles[candles.length - 2];
  const c1 = candles[candles.length - 1];

  let signalType: 'BUY' | 'SELL' | null = null;
  if (isBearish(c2) && isBullish(c1)) {
    signalType = 'BUY';
  } else if (isBullish(c2) && isBearish(c1)) {
    signalType = 'SELL';
  }

  if (signalType) {
    const { error: insertError } = await supabase.from('signal_history').insert({
      timeframe,
      signal_type: signalType,
      status: 'PENDING_C1',
      c0_timestamp: c1.timestamp,
      c0_open: c1.open,
      c0_high: c1.high,
      c0_low: c1.low,
      c0_close: c1.close,
    });

    if (insertError) throw insertError;
    await sendTelegramAlert(signalType, c1, timeframe);
  }

  return {
    timeframe,
    pendingUpdated: pendingSignals?.length ?? 0,
    newSignal: signalType ?? 'none',
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const results = [];
    for (const tf of ['H4', 'M15'] as Timeframe[]) {
      const result = await processTimeframe(tf);
      results.push(result);
    }

    res.status(200).json({
      message: 'Signals processed successfully',
      results,
    });
  } catch (error: unknown) {
    const normalized =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : typeof error === 'object' && error !== null
          ? JSON.parse(JSON.stringify(error))
          : { message: String(error) };

    console.error('check-signals error (detailed):', normalized);

    res.status(500).json({
      message: 'Error processing signals',
      error: normalized,
    });
  }
}
