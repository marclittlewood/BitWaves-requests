
import React, { useEffect, useMemo, useState } from 'react';
import { AdminLoginForm } from './AdminLoginForm';
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
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

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
          localStorage.removeItem('admin_token');
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

  // Load requests list
  const loadRequests = async () => {
    if (!token) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/requests', { headers: { Authorization: `Bearer ${token}` } });
      // Fallback: if server returns HTML (not JSON), throw a readable error
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Unexpected response (${res.status}). Is the requests endpoint protected and returning JSON?`);
      }
      const data = await res.json();
      // Accept {items: [...] } or plain array
      const arr = Array.isArray(data) ? data : (data.items || []);
      setRequests(arr);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authState === 'authed') loadRequests();
  }, [authState]);

  const handleLoggedIn = (newToken: string) => {
    try { localStorage.setItem('admin_token', newToken); } catch {}
    setToken(newToken);
    setAuthState('authed');
  };

  const handleLogout = () => {
    try { localStorage.removeItem('admin_token'); } catch {}
    setToken(null);
    setAuthState('unauth');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this request?')) return;
    if (!token) return;
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || `Failed with ${res.status}`);
      }
      setRequests(prev => (prev || []).filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    }
  };

  if (authState === 'unknown') {
    return <div className="container"><h2>Admin</h2><div>Checking your session…</div></div>;
  }

  if (authState === 'unauth') {
    return (
      <div className="container">
        <h2>Admin Login</h2>
        <AdminLoginForm onLoggedIn={handleLoggedIn} />
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
          <button onClick={loadRequests} disabled={loading}>Refresh</button>
        </div>
        {err && <div className="error" style={{ color: '#b00' }}>{err}</div>}
        {loading && <div>Loading…</div>}
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
                <td>
                  <button onClick={() => handleDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {(!requests || requests.length === 0) && !loading && (
              <tr><td colSpan={7}>No requests yet</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Blocked IPs panel */}
      <BlockedIPsAdmin token={token!} />
    </div>
  );
}
