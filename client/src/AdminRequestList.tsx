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
  try { return await res.json(); } catch { return {}; }
}

const styles = {
  page: { padding: '20px' },
  wrap: { maxWidth: '1200px', margin: '0 auto' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brand: { fontSize: 28, fontWeight: 800 as const },
  counts: { fontSize: 16, color: '#6b7280' },
  logout: { padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', fontSize: 18 },
  h1: { fontSize: 28, fontWeight: 800 as const, margin: '16px 0' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '18px 0 10px' },
  sectionTitle: { fontSize: 22, fontWeight: 700 as const },
  itemsCount: { color: '#6b7280' },
  tableWrap: { border: '1px solid #d1d5db', borderRadius: 16, overflow: 'hidden', background: '#fff' },
  table: { width: '100%', borderCollapse: 'separate' as const, borderSpacing: 0 },
  th: { textAlign: 'left' as const, padding: '14px 16px', fontWeight: 700 as const, borderBottom: '1px solid #d1d5db', background: '#f9fafb' },
  td: { padding: '12px 16px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' as const },
  titleCell: { fontWeight: 600 as const, maxWidth: 360, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const },
  msg: { maxWidth: 340, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const },
  actionsRow: { background: '#fcfcfd' },
  actionsWrap: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  btn: { border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 10, cursor: 'pointer' },
  btnDelete: { background: '#F4320B' },
  btnHold: { background: '#F48B0B' },
  btnProcess: { background: '#09C816' },
  loading: { marginTop: 8 },
  error: { marginTop: 8, color: '#b91c1c' },
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
        const p = (g.pending ?? []).slice().sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt));
        const h = (g.held ?? []).slice().sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt));
        const d = (g.processed ?? []).slice().sort((a,b)=>+new Date(b.processedAt||0)-+new Date(a.processedAt||0));
        setPending(p); setHeld(h); setProcessed(d);
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

  const renderTable = (items: RequestItem[], includeActions: boolean) => {
    const colCount = 7; // Song, Requested By, Message, Requested Time, IP Address, Processed Time, Status
    return (
      <div style={styles.tableWrap as React.CSSProperties}>
        <table style={styles.table as React.CSSProperties}>
          <thead>
            <tr>
              <th style={{...styles.th, width: '26%'}}>Song</th>
              <th style={{...styles.th, width: '12%'}}>Requested By</th>
              <th style={{...styles.th, width: '18%'}}>Message</th>
              <th style={{...styles.th, width: '14%'}}>Requested Time</th>
              <th style={{...styles.th, width: '12%'}}>IP Address</th>
              <th style={{...styles.th, width: '14%'}}>Processed Time</th>
              <th style={{...styles.th, width: '8%'}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td style={{...styles.td, padding: '18px 16px'}} colSpan={colCount}>
                  <span style={{ color: 'rgba(0,0,0,.55)' }}>No items.</span>
                </td>
              </tr>
            ) : items.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td style={{...styles.td}}>
                    <div style={styles.titleCell as React.CSSProperties}>{label(r)}</div>
                  </td>
                  <td style={styles.td}>{r.requestedBy || '—'}</td>
                  <td style={styles.td}>
                    <div style={styles.msg as React.CSSProperties}>{r.message || '—'}</div>
                  </td>
                  <td style={styles.td}>{fmt(r.requestedAt)}</td>
                  <td style={styles.td}>{r.ipAddress || '—'}</td>
                  <td style={styles.td}>{fmt(r.processedAt)}</td>
                  <td style={styles.td}>{(r as any).status ? ((r as any).status[0].toUpperCase() + (r as any).status.slice(1)) : (r.processedAt ? 'Processed' : 'Pending')}</td>
                </tr>
                {includeActions && (
                  <tr style={styles.actionsRow as React.CSSProperties}>
                    <td style={{...styles.td}} colSpan={colCount}>
                      <div style={styles.actionsWrap as React.CSSProperties}>
                        <button onClick={()=>doDelete(r.id)} style={{...styles.btn, ...styles.btnDelete}}>Delete</button>
                        {((r as any).status === 'held' || (r as any).held) ? (
                          <button onClick={()=>doUnhold(r.id)} style={{...styles.btn, ...styles.btnHold}}>Release</button>
                        ) : (
                          <button onClick={()=>doHold(r.id)} style={{...styles.btn, ...styles.btnHold}}>Hold</button>
                        )}
                        <button onClick={()=>doProcess(r.id)} style={{...styles.btn, ...styles.btnProcess}}>Process</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const totals = { pending: pending.length, held: held.length, processed: processed.length };

  return (
    <div style={styles.page}>
      <div style={styles.wrap as React.CSSProperties}>
        <div style={styles.topBar}>
          <div style={styles.brand}>Song Requests</div>
          <div style={{display:'flex', alignItems:'center', gap: 24}}>
            <div style={styles.counts}>
              <span>Pending: {totals.pending}</span>
              <span style={{margin: '0 12px'}}>Held: {totals.held}</span>
              <span>Processed: {totals.processed}</span>
            </div>
            <button onClick={onLogout} style={styles.logout}>Log out</button>
          </div>
        </div>

        <h1 style={styles.h1}>Song Requests (Admin)</h1>

        <div style={styles.sectionHead}>
          <div style={styles.sectionTitle}>Pending Requests</div>
          <div style={styles.itemsCount}>{pending.length} items</div>
        </div>
        {renderTable(pending, true)}

        <div style={styles.sectionHead}>
          <div style={styles.sectionTitle}>Held Requests</div>
          <div style={styles.itemsCount}>{held.length} items</div>
        </div>
        {renderTable(held, true)}

        <div style={styles.sectionHead}>
          <div style={styles.sectionTitle}>Processed Requests</div>
          <div style={styles.itemsCount}>{processed.length} items</div>
        </div>
        {renderTable(processed, false)}

        {error ? <div style={styles.error}>{error}</div> : null}
        {loading ? <div style={styles.loading}>Loading…</div> : null}
      </div>
    </div>
  );
}

export default AdminRequestList;
