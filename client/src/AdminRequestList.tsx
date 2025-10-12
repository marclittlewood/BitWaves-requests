import React, { useEffect, useMemo, useState } from 'react';

type RequestItem = {
  id: string;
  trackGuid: string;
  requestedBy?: string;
  message?: string;
  ipAddress?: string;
  requestedAt: string | Date;
  processedAt?: string | Date;
  status?: 'pending' | 'held' | 'processed' | 'processing';
};

type TrackItem = { guid: string; artistTitle: string; type?: string };

type ApiRequestsGrouped = {
  pending?: RequestItem[];
  held?: RequestItem[];
  processed?: RequestItem[];
};

async function fetchJSON(url: string, token: string | null) {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function postJSON(url: string, token: string | null, method: 'POST'|'DELETE'='POST') {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

const styles = {
  page: { padding: '20px' },
  wrap: { maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  h1: { fontSize: 24, fontWeight: 700 as const },
  logout: { padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' },
  section: { marginBottom: 28 },
  h2: { fontSize: 18, fontWeight: 600 as const, margin: '8px 0 12px' },
  list: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' },
  row: { borderBottom: '1px solid #e5e7eb', padding: '12px 14px' },
  rowTop: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const },
  title: { fontWeight: 600 as const, fontSize: 16 },
  meta: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  chip: { background: '#f3f4f6', padding: '4px 8px', borderRadius: 8, fontSize: 12 },
  actionBar: { display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginTop: 10 },
  btn: { border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer' },
  btnDelete: { background: '#F4320B' },
  btnHold: { background: '#F48B0B' },
  btnProcess: { background: '#09C816' },
  empty: { padding: 16, color: 'rgba(0,0,0,.6)' },
  loading: { margin: '8px 0' },
  error: { margin: '8px 0', color: '#b91c1c' },
} as const;

export function AdminRequestList({ token, onLogout }: { token: string | null; onLogout: () => void; }) {
  const [pending, setPending] = useState<RequestItem[]>([]);
  const [held, setHeld] = useState<RequestItem[]>([]);
  const [processed, setProcessed] = useState<RequestItem[]>([]);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameByGuid = useMemo(() => {
    const map = new Map<string, string>();
    tracks.forEach(t => map.set(t.guid, t.artistTitle));
    return map;
  }, [tracks]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqBody, trackBody] = await Promise.all([
        fetchJSON('/api/requests', token),
        fetchJSON('/api/tracks', token),
      ]);
      setTracks(Array.isArray(trackBody) ? trackBody : (trackBody?.data ?? []));

      const raw = (reqBody?.data ?? reqBody);
      if (raw && typeof raw === 'object' && !Array.isArray(raw) &&
          ('pending' in raw || 'held' in raw || 'processed' in raw)) {
        const g = raw as ApiRequestsGrouped;
        setPending((g.pending ?? []).slice().sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setHeld((g.held ?? []).slice().sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setProcessed((g.processed ?? []).slice().sort((a,b)=>+new Date(b.processedAt||0)-+new Date(a.processedAt||0)));
      } else if (Array.isArray(raw)) {
        const p: RequestItem[] = [];
        const h: RequestItem[] = [];
        const d: RequestItem[] = [];
        for (const r of raw as RequestItem[]) {
          if (r.processedAt) d.push(r);
          else if ((r as any).status === 'held' || (r as any).held === true) h.push(r);
          else p.push(r);
        }
        setPending(p.sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setHeld(h.sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setProcessed(d.sort((a,b)=>+new Date(b.processedAt||0)-+new Date(a.processedAt||0)));
      } else {
        setPending([]); setHeld([]); setProcessed([]);
      }
    } catch (e:any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [token]);

  const label = (r: RequestItem) => nameByGuid.get(r.trackGuid) || r.trackGuid;
  const fmt = (d?: string|Date) => d ? new Date(d).toLocaleString() : '';

  const doHold = async (id: string) => { await postJSON(`/api/requests/${id}/hold`, token); await load(); };
  const doUnhold = async (id: string) => { await postJSON(`/api/requests/${id}/unhold`, token); await load(); };
  const doProcess = async (id: string) => { await postJSON(`/api/requests/${id}/process`, token); await load(); };
  const doDelete = async (id: string) => { await postJSON(`/api/requests/${id}`, token, 'DELETE'); await load(); };

  const Row = ({ r, showActions }:{ r:RequestItem; showActions:boolean }) => (
    <li style={styles.row}>
      <div style={styles.rowTop}>
        <div style={styles.title}>{label(r)}</div>
        <div style={styles.meta}>
          {r.requestedBy ? <span style={styles.chip}>By: {r.requestedBy}</span> : null}
          {r.ipAddress ? <span style={styles.chip}>IP: {r.ipAddress}</span> : null}
          <span style={styles.chip}>At: {fmt(r.requestedAt)}</span>
          {r.message ? <span style={styles.chip}>Msg: {r.message}</span> : null}
        </div>
      </div>
      {showActions && (
        <div style={styles.actionBar}>
          <button onClick={()=>doDelete(r.id)} style={{...styles.btn, ...styles.btnDelete}}>Delete</button>
          {((r as any).status === 'held' || (r as any).held) ? (
            <button onClick={()=>doUnhold(r.id)} style={{...styles.btn, ...styles.btnHold}}>Release</button>
          ) : (
            <button onClick={()=>doHold(r.id)} style={{...styles.btn, ...styles.btnHold}}>Hold</button>
          )}
          <button onClick={()=>doProcess(r.id)} style={{...styles.btn, ...styles.btnProcess}}>Process</button>
        </div>
      )}
    </li>
  );

  const Section = ({ title, items, showActions }:{ title:string; items:RequestItem[]; showActions:boolean }) => (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title} <span style={{opacity:.7}}>({items?.length || 0})</span></h2>
      <ul style={styles.list as React.CSSProperties}>
        {items && items.length > 0 ? items.map(r => <Row key={r.id} r={r} showActions={showActions} />) : <li style={styles.empty}>No items.</li>}
      </ul>
    </section>
  );

  return (
    <div style={styles.page}>
      <div style={styles.wrap as React.CSSProperties}>
        <header style={styles.header}>
          <h1 style={styles.h1}>Requests Admin</h1>
          <button onClick={onLogout} style={styles.logout}>Log out</button>
        </header>

        {error ? <div style={styles.error}>{error}</div> : null}
        {loading ? <div style={styles.loading}>Loading…</div> : null}

        <Section title="Pending Requests" items={pending} showActions={true} />
        <Section title="Held Requests" items={held} showActions={true} />
        <Section title="Processed Requests" items={processed} showActions={false} />
      </div>
    </div>
  );
}

export default AdminRequestList;
