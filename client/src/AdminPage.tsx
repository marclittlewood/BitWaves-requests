
import React, { useEffect, useState } from 'react';
import { BlockedIPsAdmin } from './BlockedIPs';

type AuthState = 'unknown' | 'authed' | 'unauth';

type RequestRow = {
  id: string;
  trackGuid: string;
  trackName?: string;
  requestedBy: string;
  message?: string;
  requestedAt: string;
  ipAddress?: string;
  processedAt?: string | null;
};

const fmt = (d?: string | Date | null) => d ? new Date(d).toLocaleString() : '';

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1100, margin: '0 auto', padding: '16px' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  subtle: { color: '#666' },
  btn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' },
  btnPrimary: { padding: '10px 14px', borderRadius: 12, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer' },
  card: { background: '#fff', borderRadius: 16, boxShadow: '0 6px 20px rgba(0,0,0,0.06)', padding: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 8px', borderBottom: '1px solid #eee', fontWeight: 600, fontSize: 14, color: '#333' },
  td: { padding: '10px 8px', borderBottom: '1px solid #f0f0f0', fontSize: 14, color: '#222' },
  center: { display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 },
  loginCard: { maxWidth: 420, width: '100%', padding: 24, borderRadius: 18, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', background: '#fff' },
  loginTitle: { margin: 0, fontSize: 24, fontWeight: 700 },
  loginSub: { marginTop: 6, fontSize: 14, color: '#6b7280' },
  formRow: { display: 'grid', gap: 8, marginTop: 14 },
  input: { padding: '12px 14px', borderRadius: 12, border: '1px solid #e5e7eb', outline: 'none', fontSize: 14 },
  error: { marginTop: 8, color: '#b00020', fontSize: 13 },
  spacer16: { height: 16 },
  spacer8: { height: 8 },
};

export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem('admin_token'); } catch { return null; }
  });
  const [authState, setAuthState] = useState<AuthState>('unknown');
  const [note, setNote] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [requests, setRequests] = useState<RequestRow[] | null>(null);

  // Embedded login form state
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Verify token by calling a protected endpoint
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!token) { setAuthState('unauth'); return; }
      setAuthState('unknown');
      try {
        const res = await fetch('/api/admin/blocked-ips', { headers: { Authorization: `Bearer ${token}` }});
        if (abort) return;
        if (res.status === 401 || res.status === 403) {
          try { localStorage.removeItem('admin_token'); } catch {}
          setToken(null);
          setAuthState('unauth');
          return;
        }
        setAuthState('authed');
      } catch (e: any) {
        setNote('Network issue while checking session. Continuing…');
        setAuthState('authed');
      }
    })();
    return () => { abort = true; };
  }, [token]);

  async function loadRequests() {
    if (!token) return;
    setErr('');
    try {
      const res = await fetch('/api/requests', { headers: { Authorization: `Bearer ${token}` } });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(`Unexpected response (${res.status})`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || []);
      setRequests(arr);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load requests');
    }
  }
  useEffect(() => { if (authState === 'authed') loadRequests(); }, [authState]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.token) {
        throw new Error(data?.message || 'Login failed');
      }
      try { localStorage.setItem('admin_token', data.token); } catch {}
      setToken(data.token);
      setAuthState('authed');
      setPassword('');
      setLoginError('');
      setNote('Logged in successfully.');
    } catch (e: any) {
      setLoginError(e?.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    try { localStorage.removeItem('admin_token'); } catch {}
    setToken(null);
    setAuthState('unauth');
    setRequests(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this request?')) return;
    if (!token) return;
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      alert(j?.message || `Failed with ${res.status}`);
      return;
    }
    setRequests(prev => (prev || []).filter(r => r.id !== id));
  }

  if (authState === 'unknown') {
    return (
      <div style={styles.container}>
        <div style={{...styles.card}}>
          <h2 style={{ margin: 0 }}>Admin</h2>
          <div style={{...styles.subtle, marginTop: 8}}>Checking your session…</div>
        </div>
      </div>
    );
  }

  if (authState === 'unauth') {
    return (
      <div style={styles.center}>
        <div style={styles.loginCard}>
          <h2 style={styles.loginTitle}>BitWaves Admin</h2>
          <div style={styles.loginSub}>Sign in to manage song requests and block abusive IPs.</div>
          <div style={styles.spacer16} />
          <form onSubmit={handleLogin}>
            <div style={styles.formRow}>
              <label htmlFor="admin-password" style={styles.subtle}>Admin password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.spacer8} />
            <button type="submit" style={styles.btnPrimary} disabled={isLoggingIn || !password}>
              {isLoggingIn ? 'Logging in…' : 'Login'}
            </button>
            {loginError && <div style={styles.error}>{loginError}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.topbar}>
        <h2 style={{ margin: 0 }}>Admin</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {note && <span style={styles.subtle}>{note}</span>}
          <button style={styles.btn} onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Song Requests</h3>
          <button style={styles.btn} onClick={() => loadRequests()}>Refresh</button>
        </div>
        {err && <div style={{ ...styles.error, marginTop: 8 }}>{err}</div>}
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Song</th>
                <th style={styles.th}>Requested By</th>
                <th style={styles.th}>Message</th>
                <th style={styles.th}>Requested Time</th>
                <th style={styles.th}>IP Address</th>
                <th style={styles.th}>Processed Time</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(requests || []).map(r => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.trackName || r.trackGuid}</td>
                  <td style={styles.td}>{r.requestedBy}</td>
                  <td style={styles.td}>{r.message || ''}</td>
                  <td style={styles.td}>{fmt(r.requestedAt)}</td>
                  <td style={styles.td}>{r.ipAddress || ''}</td>
                  <td style={styles.td}>{fmt(r.processedAt)}</td>
                  <td style={styles.td}><button style={styles.btn} onClick={() => handleDelete(r.id)}>Delete</button></td>
                </tr>
              ))}
              {(!requests || requests.length === 0) && (
                <tr><td style={styles.td} colSpan={7}>No requests yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ height: 16 }} />
      <div style={styles.card}>
        <BlockedIPsAdmin token={token!} />
      </div>
    </div>
  );
}
