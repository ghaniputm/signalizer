import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '../../lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────
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

// ─── TwelveData Fetcher ──────────────────────────────────────────────────
async function fetchLastTwoCandles(): Promise<Candle[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('Missing TWELVEDATA_API_KEY');

  const candidates = ['XAU/USD', 'XAUUSD'];
  let lastError = '';

  for (const symbol of candidates) {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=4h&outputsize=3&apikey=${apiKey}`;
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

    // TwelveData returns newest first → reverse to chronological
    return values.reverse().map(parseCandle);
  }

  throw new Error(`TwelveData fetch failed: ${lastError}`);
}

// ─── Telegram Notifier ───────────────────────────────────────────────────
async function sendTelegramAlert(signalType: 'BUY' | 'SELL', c0: Candle): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('Telegram credentials missing – skipping notification');
    return;
  }

  const directionLabel =
    signalType === 'BUY'
      ? '🔴 ➡️ 🟢 (Merah → Hijau)'
      : '🟢 ➡️ 🔴 (Hijau → Merah)';

  const message = `<b>🚨 SIGNAL XAUUSD H4 - BERUBAH WARNA 🚨</b>
Jenis Sinyal: 🕯️ <b>${signalType} (${directionLabel})</b>
Waktu Close: ${formatWIB(c0.timestamp)}
📊 <b>DATA CANDLE 0 (Berubah Warna):</b>
• Open : ${c0.open.toFixed(2)}
• High : ${c0.high.toFixed(2)}
• Low  : ${c0.low.toFixed(2)}
• Close: ${c0.close.toFixed(2)}
<i>ℹ️ Sistem mengunci data. Persentase rebound Candle +1 akan dihitung otomatis 4 jam dari sekarang.</i>`;

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

// ─── Main Handler ────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();

    // ── Stage 1: Update pending signals (Candle +1) ──────────────────────
    const { data: pendingSignals, error: fetchError } = await supabase
      .from('signal_history')
      .select('*')
      .eq('status', 'PENDING_C1');

    if (fetchError) throw fetchError;

    if (pendingSignals && pendingSignals.length > 0) {
      // Fetch the latest candle to act as Candle +1 for the oldest pending
      const candles = await fetchLastTwoCandles();
      const latestCandle = candles[candles.length - 1]; // most recent closed

      for (const signal of pendingSignals) {
        const c0Close = parseFloat(signal.c0_close);
        let reboundPct: number;

        if (signal.signal_type === 'SELL') {
          // Rebound = (High_C+1 - Close_C0) / Close_C0 * 100
          reboundPct =
            ((latestCandle.high - c0Close) / c0Close) * 100;
        } else {
          // BUY: Rebound = (Close_C0 - Low_C+1) / Close_C0 * 100
          reboundPct =
            ((c0Close - latestCandle.low) / c0Close) * 100;
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

    // ── Stage 2: Detect new signal ───────────────────────────────────────
    const candles = await fetchLastTwoCandles();
    const c2 = candles[candles.length - 2]; // Candle[-2]
    const c1 = candles[candles.length - 1]; // Candle[-1] (latest closed)

    let signalType: 'BUY' | 'SELL' | null = null;

    // BUY: Candle[-2] red (bearish) → Candle[-1] green (bullish)
    if (isBearish(c2) && isBullish(c1)) {
      signalType = 'BUY';
    }
    // SELL: Candle[-2] green (bullish) → Candle[-1] red (bearish)
    else if (isBullish(c2) && isBearish(c1)) {
      signalType = 'SELL';
    }

    if (signalType) {
      // Insert new signal record
      const { error: insertError } = await supabase
        .from('signal_history')
        .insert({
          signal_type: signalType,
          status: 'PENDING_C1',
          c0_timestamp: c1.timestamp,
          c0_open: c1.open,
          c0_high: c1.high,
          c0_low: c1.low,
          c0_close: c1.close,
        });

      if (insertError) throw insertError;

      // Send Telegram notification
      await sendTelegramAlert(signalType, c1);
    }

    res.status(200).json({
      message: 'Signals processed successfully',
      pendingUpdated: pendingSignals?.length ?? 0,
      newSignal: signalType ?? 'none',
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
