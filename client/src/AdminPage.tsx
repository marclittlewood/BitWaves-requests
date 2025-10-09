import React, { useState } from 'react';
import { AdminRequestList } from './AdminRequestList';
import { AdminLoginForm } from './AdminLoginForm';
import { BlockedIPsAdmin } from './BlockedIPs';

export function AdminPage() {
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const [token, setToken] = useState<string | null>(storedToken);
  const isAuthenticated = !!token;

  const handleLoggedIn = (newToken: string) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="container">
        <h2>Admin Login</h2>
        <AdminLoginForm onLoggedIn={handleLoggedIn} />
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Admin</h2>
        <button onClick={handleLogout}>Log out</button>
      </div>

      {/* Existing Requests admin table */}
      <AdminRequestList token={token!} />

      {/* New: Blocked IPs section */}
      <BlockedIPsAdmin token={token!} />
    </div>
  );
}