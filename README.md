<<<<<<< HEAD
# XAUUSD H4 Trend Reversal & Rebound Monitor

Backend monitor sinyal XAU/USD timeframe H4 berbasis:
- **Next.js API Route** (serverless-ready)
- **Vercel Cron** (trigger otomatis tiap 4 jam)
- **Supabase PostgreSQL** (histori sinyal & rebound)
- **Telegram Bot API** (notifikasi instan)
- **TwelveData API** (sumber OHLC candle)

> Catatan: Project ini adalah **engine backend + automation**. Belum ada UI dashboard halaman web.

---

## 1) Fitur Utama

1. Deteksi perubahan warna candle H4:
   - **BUY**: Candle[-2] merah → Candle[-1] hijau
   - **SELL**: Candle[-2] hijau → Candle[-1] merah
2. Simpan Candle 0 (saat sinyal terdeteksi) ke Supabase dengan status `PENDING_C1`.
3. Pada eksekusi berikutnya, update Candle +1, hitung `% rebound`, ubah status jadi `COMPLETED`.
4. Kirim notifikasi Telegram format HTML saat sinyal baru muncul.
5. Jalan otomatis lewat cron setiap 4 jam.

---

## 2) Struktur Project

```bash
.
├─ lib/
│  └─ supabaseClient.ts
├─ pages/
│  └─ api/
│     └─ check-signals.ts
├─ .env.example
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
└─ vercel.json
```

---

## 3) Prasyarat

- Node.js 18+
- Akun Supabase
- API key TwelveData
- Telegram bot token + chat id
- (Opsional) Akun Vercel untuk deploy + cron production

---

## 4) Setup Environment Variables

Buat file **`.env.local`** di root project (untuk lokal):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
TWELVEDATA_API_KEY=your_twelvedata_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### Cara ambil value Supabase
- `NEXT_PUBLIC_SUPABASE_URL` = **Project URL**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = **Publishable key** (anon/public)

⚠️ Jangan pakai `service_role` untuk `NEXT_PUBLIC_*`.

---

## 5) Setup Database (Supabase SQL)

Buka **Supabase → SQL Editor**, jalankan:

```sql
CREATE TABLE IF NOT EXISTS public.signal_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    signal_type VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING_C1',

    -- Candle 0 (saat sinyal terbentuk)
    c0_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    c0_open NUMERIC NOT NULL,
    c0_high NUMERIC NOT NULL,
    c0_low NUMERIC NOT NULL,
    c0_close NUMERIC NOT NULL,

    -- Candle +1
    c1_timestamp TIMESTAMP WITH TIME ZONE,
    c1_open NUMERIC,
    c1_high NUMERIC,
    c1_low NUMERIC,
    c1_close NUMERIC,

    -- Rebound
    c1_rebound_percentage NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_signal_history_status
ON public.signal_history(status);

CREATE INDEX IF NOT EXISTS idx_signal_history_c0_timestamp
ON public.signal_history(c0_timestamp DESC);
```

---

## 6) Install & Run Lokal

```bash
npm install
npm run dev
```

Test endpoint:

```bash
http://localhost:3000/api/check-signals
```

Contoh response sukses:

```json
{
  "message": "Signals processed successfully",
  "pendingUpdated": 0,
  "newSignal": "none"
}
```

Build check:

```bash
npm run build
```

---

## 7) Cara Kerja Endpoint `/api/check-signals`

Setiap dipanggil, endpoint melakukan 2 tahap:

### Tahap 1 — Update Sinyal Pending
- Query `signal_history` dengan `status = 'PENDING_C1'`
- Ambil candle terbaru dari TwelveData sebagai Candle +1
- Hitung rebound:
  - SELL: `((High_C1 - Close_C0) / Close_C0) * 100`
  - BUY: `((Close_C0 - Low_C1) / Close_C0) * 100`
- Update kolom `c1_*`, `c1_rebound_percentage`, `status = COMPLETED`

### Tahap 2 — Deteksi Sinyal Baru
- Ambil 2 candle terakhir H4 (Candle[-2], Candle[-1])
- Jika ada perubahan warna valid:
  - Insert record baru `PENDING_C1` (Candle 0)
  - Kirim notifikasi Telegram

---

## 8) Deploy ke Vercel

1. Push project ke GitHub/GitLab.
2. Import ke Vercel.
3. Set Environment Variables di Vercel (sama seperti `.env.local`).
4. Deploy.

### Cron Schedule
File `vercel.json` sudah berisi:

```json
{
  "crons": [
    {
      "path": "/api/check-signals",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

Artinya endpoint dipanggil tiap 4 jam.

---

## 9) Troubleshooting

### A) 404 saat akses `/api/check-signals`
- Pastikan `npm run dev` sedang jalan
- Pastikan path benar: `/api/check-signals`
- Restart dev server setelah ubah env

### B) `supabaseUrl is required`
- `.env.local` belum ada / typo nama key
- Pastikan key:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### C) `PGRST205 Could not find table public.signal_history`
- Tabel belum dibuat → jalankan SQL setup di atas

### D) `TwelveData HTTP 404` atau data kosong
- API key salah / limit habis / simbol tidak tersedia
- Endpoint sudah mencoba fallback simbol `XAU/USD` dan `XAUUSD`

### E) Telegram tidak mengirim
- Cek `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`
- Pastikan chat id benar (private/group/channel)
- Pastikan bot tidak diblokir

### F) Tidak ada sinyal baru (`newSignal: none`)
- Ini normal jika candle terakhir tidak memenuhi logika transisi warna

---

## 10) Catatan Keamanan

- Jangan commit `.env.local`
- Jangan expose secret sensitif
- `NEXT_PUBLIC_*` memang public-safe untuk publishable key
- Untuk operasi admin (jika nanti dibutuhkan), gunakan server-only env non-public

---

## 11) Pengembangan Lanjutan (Opsional)

- Tambah proteksi duplikasi sinyal (unique constraint)
- Tambah endpoint health check `/api/health`
- Tambah UI dashboard `/dashboard` untuk list histori sinyal
- Tambah logging terstruktur & alert error

---

## 12) Lisensi

Internal project / private use.
=======
# signalizer
signal for xauusd
>>>>>>> 23a6cc1ddce360463dc5f449c2b15657ac9ab1e6
