import type { GetStaticProps, NextPage } from 'next';

interface SignalRecord {
  id: string;
  created_at: string;
  signal_type: 'BUY' | 'SELL';
  status: 'PENDING_C1' | 'COMPLETED';
  c0_timestamp: string;
  c0_open: number;
  c0_high: number;
  c0_low: number;
  c0_close: number;
  c1_timestamp: string | null;
  c1_open: number | null;
  c1_high: number | null;
  c1_low: number | null;
  c1_close: number | null;
  c1_rebound_percentage: number | null;
}

interface DashboardProps {
  signals: SignalRecord[];
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_C1: '#f59e0b',
  COMPLETED: '#10b981',
};

const SIGNAL_COLORS: Record<string, string> = {
  BUY: '#22c55e',
  SELL: '#ef4444',
};

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

function formatPrice(v: number | string | null, decimals = 2): string {
  if (v === null || v === undefined) return '—';
  return parseFloat(String(v)).toFixed(decimals);
}

function formatPct(v: number | string | null): string {
  if (v === null || v === undefined) return '—';
  return `${parseFloat(String(v)).toFixed(4)}%`;
}

const Dashboard: NextPage<DashboardProps> = ({ signals, count }) => {
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 XAUUSD H4 Dashboard</h1>
          <p style={styles.subtitle}>Trend Reversal & Rebound Monitor</p>
        </div>
        <div style={styles.stats}>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{count}</span>
            <span style={styles.statLabel}>Total Sinyal</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>
              {signals.filter((s) => s.status === 'PENDING_C1').length}
            </span>
            <span style={styles.statLabel}>Pending</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>
              {signals.filter((s) => s.status === 'COMPLETED').length}
            </span>
            <span style={styles.statLabel}>Completed</span>
          </div>
        </div>
      </header>

      {/* Info Box */}
      <div style={styles.infoBox}>
        <p>🔄 Endpoint <code>/api/check-signals</code> dipanggil otomatis via Vercel Cron setiap <strong>4 jam</strong>.</p>
        <p>📨 Sinyal baru dikirim ke <strong>Telegram</strong> saat perubahan warna candle terdeteksi.</p>
        <p>📈 Rebound dihitung dari Candle +1 setelah Candle 0 terkunci.</p>
      </div>

      {/* Table */}
      {signals.length === 0 ? (
        <div style={styles.empty}>
          <p>Belum ada data sinyal.</p>
          <p style={styles.emptyHint}>
            Tunggu cron berikutnya atau test manual di{' '}
            <code>/api/check-signals</code>.
          </p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                <th style={styles.th}>Waktu (WIB)</th>
                <th style={styles.th}>Sinyal</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>C0 Open</th>
                <th style={styles.th}>C0 High</th>
                <th style={styles.th}>C0 Low</th>
                <th style={styles.th}>C0 Close</th>
                <th style={styles.th}>C1 High</th>
                <th style={styles.th}>C1 Low</th>
                <th style={styles.th}>Rebound %</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((sig) => {
                const sigColor = SIGNAL_COLORS[sig.signal_type] ?? '#888';
                const statusColor = STATUS_COLORS[sig.status] ?? '#888';
                return (
                  <tr key={sig.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontSize: '12px' }}>
                      {formatWIB(sig.c0_timestamp)}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: sigColor }}>
                        {sig.signal_type}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: statusColor }}>
                        {sig.status}
                      </span>
                    </td>
                    <td style={styles.td}>{formatPrice(sig.c0_open)}</td>
                    <td style={styles.td}>{formatPrice(sig.c0_high)}</td>
                    <td style={styles.td}>{formatPrice(sig.c0_low)}</td>
                    <td style={styles.td}>{formatPrice(sig.c0_close)}</td>
                    <td style={styles.td}>{formatPrice(sig.c1_high)}</td>
                    <td style={styles.td}>{formatPrice(sig.c1_low)}</td>
                    <td style={{ ...styles.td, color: sig.c1_rebound_percentage !== null ? '#22c55e' : '#888' }}>
                      {formatPct(sig.c1_rebound_percentage)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <p>XAUUSD H4 Signal Monitor • Powered by Vercel + Supabase + TwelveData + Telegram</p>
      </footer>
    </div>
  );
};

export const getStaticProps: GetStaticProps<DashboardProps> = async () => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return { props: { signals: [], count: 0 } };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('signal_history')
      .select('*')
      .order('c0_timestamp', { ascending: false })
      .limit(100);

    return {
      props: {
        signals: data ?? [],
        count: data?.length ?? 0,
      },
      revalidate: 60,
    };
  } catch {
    return { props: { signals: [], count: 0 }, revalidate: 60 };
  }
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    padding: '0 0 40px',
  },
  header: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderBottom: '1px solid #1e293b',
    padding: '32px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    margin: '0 0 4px',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: '0',
  },
  stats: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  statBox: {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '16px 20px',
    textAlign: 'center',
    minWidth: '90px',
  },
  statValue: {
    display: 'block',
    fontSize: '28px',
    fontWeight: '800',
    color: '#38bdf8',
  },
  statLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoBox: {
    margin: '32px 40px 0',
    background: '#1e293b',
    borderRadius: '12px',
    padding: '20px 24px',
    border: '1px solid #334155',
  },
  empty: {
    margin: '32px 40px 0',
    textAlign: 'center',
    color: '#94a3b8',
    padding: '40px',
    background: '#1e293b',
    borderRadius: '12px',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '8px',
  },
  tableWrapper: {
    overflowX: 'auto',
    margin: '24px 40px 0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#1e293b',
    borderRadius: '12px',
    overflow: 'hidden',
    fontSize: '13px',
  },
  theadRow: {
    background: '#0f172a',
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#94a3b8',
    borderBottom: '1px solid #334155',
  },
  tr: {
    borderBottom: '1px solid #334155',
    transition: 'background 0.15s',
  },
  td: {
    padding: '14px 16px',
    color: '#e2e8f0',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: '0.03em',
  },
  footer: {
    marginTop: '40px',
    textAlign: 'center',
    color: '#475569',
    fontSize: '12px',
    padding: '0 40px',
  },
};

export default Dashboard;