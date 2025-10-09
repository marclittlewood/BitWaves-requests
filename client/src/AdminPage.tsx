
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
    return <div className="container"><h2>Admin</h2><div>Checking your session…</div></div>;
  }

  if (authState === 'unauth') {
    return (
      <div className="container">
        <h2>Admin Login</h2>
        <form onSubmit={handleLogin} style={{ maxWidth: 360 }}>
          <label htmlFor="admin-password">Admin password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            required
          />
          <div style={{ marginTop: 8 }}>
            <button type="submit" disabled={isLoggingIn || !password}>
              {isLoggingIn ? 'Logging in…' : 'Login'}
            </button>
          </div>
          {loginError && <div className="error" style={{ marginTop: 8, color: '#b00' }}>{loginError}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Admin</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {note && <span style={{ color: '#555' }}>{note}</span>}
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Song Requests</h3>
          <button onClick={() => loadRequests()}>Refresh</button>
        </div>
        {err && <div className="error" style={{ color: '#b00' }}>{err}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{textAlign:'left'}}>Song</th>
              <th style={{textAlign:'left'}}>Requested By</th>
              <th style={{textAlign:'left'}}>Message</th>
              <th style={{textAlign:'left'}}>Requested Time</th>
              <th style={{textAlign:'left'}}>IP Address</th>
              <th style={{textAlign:'left'}}>Processed Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(requests || []).map(r => (
              <tr key={r.id}>
                <td>{r.trackName || r.trackGuid}</td>
                <td>{r.requestedBy}</td>
                <td>{r.message || ''}</td>
                <td>{fmt(r.requestedAt)}</td>
                <td>{r.ipAddress || ''}</td>
                <td>{fmt(r.processedAt)}</td>
                <td><button onClick={() => handleDelete(r.id)}>Delete</button></td>
              </tr>
            ))}
            {(!requests || requests.length === 0) && (
              <tr><td colSpan={7}>No requests yet</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <BlockedIPsAdmin token={token!} />
    </div>
  );
}
