import React, { useEffect, useState } from 'react';

type BlockedEntry = {
  ip: string;
  reason?: string;
  addedBy?: string;
  addedAt: string;
};

export function BlockedIPsAdmin({ token }: { token: string }) {
  const [items, setItems] = useState<BlockedEntry[]>([]);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/blocked-ips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to load');
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!ip) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ip, reason })
      });
      if (!res.ok) throw new Error('Failed to add');
      setIp('');
      setReason('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to add');
    } finally {
      setLoading(false);
    }
  }

  async function remove(ip: string) {
    if (!confirm(`Remove ${ip} from blocklist?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blocked-ips/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to remove');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to remove');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h3>Blocked IPs</h3>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={ip} onChange={e => setIp(e.target.value)} placeholder="IP, e.g. 203.0.113.25" />
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" />
        <button onClick={add} disabled={loading || !ip}>Block</button>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <div>Loading…</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>IP</th>
            <th style={{ textAlign: 'left' }}>Reason</th>
            <th style={{ textAlign: 'left' }}>Added By</th>
            <th style={{ textAlign: 'left' }}>Added At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.ip}>
              <td>{it.ip}</td>
              <td>{it.reason || ''}</td>
              <td>{it.addedBy || ''}</td>
              <td>{new Date(it.addedAt).toLocaleString()}</td>
              <td><button onClick={() => remove(it.ip)}>Remove</button></td>
            </tr>
          ))}
          {items.length === 0 && !loading && (
            <tr><td colSpan={5}>No blocked IPs.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
