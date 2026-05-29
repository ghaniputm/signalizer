import Head from 'next/head';
import Link from 'next/link';
import type { CSSProperties } from 'react';

export default function Home() {
  return (
    <>
      <Head>
        <title>XAUUSD H4 Signal Monitor</title>
        <meta
          name="description"
          content="XAUUSD H4 Trend Reversal & Rebound Monitor"
        />
      </Head>

      <div style={styles.page}>
        <div style={styles.hero}>
          <div style={styles.badge}>📊 SIGNAL MONITOR</div>
          <h1 style={styles.title}>XAUUSD H4</h1>
          <p style={styles.subtitle}>Trend Reversal & Rebound Monitor</p>
          <p style={styles.desc}>
            Sistem monitoring perubahan warna candle H4 secara otomatis.
            Deteksi sinyal BUY/SELL, hitung rebound %, dan kirim notifikasi Telegram.
          </p>

          <div style={styles.actions}>
            <Link href="/dashboard" style={styles.btnPrimary}>
              📈 Lihat Dashboard
            </Link>
            <a
              href="/api/check-signals"
              style={styles.btnSecondary}
              target="_blank"
              rel="noopener noreferrer"
            >
              ⚡ Test Endpoint
            </a>
          </div>
        </div>

        <div style={styles.grid}>
          <Card
            icon="🔄"
            title="Deteksi Warna Candle"
            desc="BUY: Candle[-2] merah → Candle[-1] hijau. SELL: Candle[-2] hijau → Candle[-1] merah."
          />
          <Card
            icon="📈"
            title="Kalkulasi Rebound"
            desc="Ukur seberapa jauh harga memantul setelah Candle 0 terkunci, dihitung saat Candle +1 selesai."
          />
          <Card
            icon="🕐"
            title="Auto Cron 4 Jam"
            desc="Vercel Cron menembak endpoint otomatis setiap 4 jam tepat saat pergantian candle."
          />
          <Card
            icon="📨"
            title="Notifikasi Telegram"
            desc="Alert instan format HTML ke Telegram saat sinyal baru terdeteksi."
          />
          <Card
            icon="🗄️"
            title="Histori Supabase"
            desc="Seluruh data candle, status signal, dan rebound tersimpan rapi di PostgreSQL Supabase."
          />
          <Card
            icon="⚙️"
            title="Serverless Engine"
            desc="Arsitektur hemat biaya dengan Next.js API Route + Vercel + Supabase."
          />
        </div>

        <footer style={styles.footer}>
          XAUUSD H4 Signal Monitor • Powered by Vercel + Supabase + TwelveData + Telegram
        </footer>
      </div>
    </>
  );
}

function Card({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.icon}>{icon}</div>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardDesc}>{desc}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
    padding: '0 24px 60px',
  },
  hero: {
    textAlign: 'center',
    padding: '80px 0 56px',
    maxWidth: 760,
    margin: '0 auto',
  },
  badge: {
    display: 'inline-block',
    background: '#1e293b',
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '7px 16px',
    borderRadius: 999,
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 52,
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#f8fafc',
  },
  subtitle: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 18,
  },
  desc: {
    margin: '16px auto 0',
    maxWidth: 620,
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 1.7,
  },
  actions: {
    marginTop: 26,
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    background: '#2563eb',
    color: '#fff',
    border: '1px solid #2563eb',
    padding: '10px 16px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 700,
  },
  btnSecondary: {
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    padding: '10px 16px',
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 700,
  },
  grid: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#111b30',
    border: '1px solid #1f2a44',
    borderRadius: 14,
    padding: 16,
  },
  icon: {
    fontSize: 24,
  },
  cardTitle: {
    margin: '10px 0 6px',
    fontSize: 16,
    color: '#f8fafc',
  },
  cardDesc: {
    margin: 0,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.6,
  },
  footer: {
    maxWidth: 1100,
    margin: '28px auto 0',
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
};