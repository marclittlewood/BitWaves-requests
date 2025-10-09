
import React, { useEffect, useState } from 'react';
import { AdminRequestList } from './AdminRequestList';
import { AdminLoginForm } from './AdminLoginForm';
import { BlockedIPsAdmin } from './BlockedIPs';

type AuthState = 'unknown' | 'authed' | 'unauth';

export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('admin_token');
    } catch {
      return null;
    }
  });
  const [authState, setAuthState] = useState<AuthState>('unknown');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let abort = false;
    async function verify() {
      if (!token) {
        setAuthState('unauth');
        return;
      }
      setAuthState('unknown');
      setError('');
      try {
        const res = await fetch('/api/admin/blocked-ips', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (abort) return;
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('admin_token');
          setToken(null);
          setAuthState('unauth');
          return;
        }
        if (!res.ok) {
          setAuthState('authed');
          return;
        }
        setAuthState('authed');
      } catch (e: any) {
        if (abort) return;
        setError(e?.message || 'Network error');
        setAuthState('authed');
      }
    }
    verify();
    return () => {
      abort = true;
    };
  }, [token]);

  const handleLoggedIn = (newToken: string) => {
    try {
      localStorage.setItem('admin_token', newToken);
    } catch {}
    setToken(newToken);
    setAuthState('authed');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('admin_token');
    } catch {}
    setToken(null);
    setAuthState('unauth');
  };

  if (authState === 'unknown') {
    return (
      <div className="container">
        <h2>Admin</h2>
        <div>Checking your session…</div>
      </div>
    );
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
          {error && <span style={{ color: '#b00' }}>Note: {error}</span>}
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>
      <AdminRequestList token={token!} />
      <BlockedIPsAdmin token={token!} />
    </div>
  );
}
