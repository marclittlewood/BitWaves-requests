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

export function AdminRequestList({ token, onLogout }: { token: string | null; onLogout: () => void; }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
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
        setRequests((g.pending ?? []).slice().sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setHeld((g.held ?? []).slice().sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setProcessed((g.processed ?? []).slice().sort((a,b)=>+new Date(b.processedAt||0)-+new Date(a.processedAt||0)));
      } else if (Array.isArray(raw)) {
        const pending: RequestItem[] = [];
        const heldArr: RequestItem[] = [];
        const done: RequestItem[] = [];
        for (const r of raw as RequestItem[]) {
          if (r.processedAt) done.push(r);
          else if ((r as any).status === 'held' || (r as any).held === true) heldArr.push(r);
          else pending.push(r);
        }
        setRequests(pending.sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setHeld(heldArr.sort((a,b)=>+new Date(a.requestedAt)-+new Date(b.requestedAt)));
        setProcessed(done.sort((a,b)=>+new Date(b.processedAt||0)-+new Date(a.processedAt||0)));
      } else {
        setRequests([]); setHeld([]); setProcessed([]);
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

  const Section = ({ title, children, count }:{ title:string; children:React.ReactNode; count:number }) => (
    <section style={{maxWidth: '1100px', margin: '0 auto 24px'}}>
      <h2 style={{margin:'12px 0', fontSize:'20px'}}>{title} <span style={{opacity:.7}}>({count})</span></h2>
      <div>{children}</div>
    </section>
  );

  const Card = ({ r, showActions }:{ r:RequestItem; showActions:boolean }) => (
    <div style={{border:'1px solid #e5e7eb', borderRadius:12, padding:12, marginBottom:12, background:'#fff'}}>
      <div style={{fontWeight:600, marginBottom:8}}>{label(r)}</div>
      <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:8}}>
        {r.requestedBy ? <span style={{background:'#f3f4f6', padding:'4px 8px', borderRadius:8}}>By: {r.requestedBy}</span> : null}
        {r.ipAddress ? <span style={{background:'#f3f4f6', padding:'4px 8px', borderRadius:8}}>IP: {r.ipAddress}</span> : null}
        {r.message ? <span style={{background:'#f3f4f6', padding:'4px 8px', borderRadius:8}}>Msg: {r.message}</span> : null}
        <span style={{background:'#f3f4f6', padding:'4px 8px', borderRadius:8}}>At: {fmt(r.requestedAt)}</span>
      </div>
      {showActions && (
        <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
          <button onClick={()=>doDelete(r.id)} style={{background:'#F4320B', color:'#fff', border:'none', borderRadius:8, padding:'6px 10px'}}>Delete</button>
          {((r as any).status === 'held' || (r as any).held) ? (
            <button onClick={()=>doUnhold(r.id)} style={{background:'#F48B0B', color:'#fff', border:'none', borderRadius:8, padding:'6px 10px'}}>Release</button>
          ) : (
            <button onClick={()=>doHold(r.id)} style={{background:'#F48B0B', color:'#fff', border:'none', borderRadius:8, padding:'6px 10px'}}>Hold</button>
          )}
          <button onClick={()=>doProcess(r.id)} style={{background:'#09C816', color:'#fff', border:'none', borderRadius:8, padding:'6px 10px'}}>Process</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{padding:'20px'}}>
      <header style={{maxWidth:'1100px', margin:'0 auto 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{fontSize:'24px', fontWeight:700}}>Requests Admin</h1>
        <button onClick={onLogout} style={{padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb'}}>Log out</button>
      </header>

      {error ? <div style={{maxWidth:'1100px', margin:'0 auto 12px', color:'#b91c1c'}}>{error}</div> : null}
      {loading ? <div style={{maxWidth:'1100px', margin:'0 auto 12px'}}>Loading…</div> : null}

      <Section title="Pending Requests" count={(requests?.length ?? 0)}>
        {requests.map(r => <Card key={r.id} r={r} showActions={true} />)}
        {(!requests || requests.length===0) && <div style={{opacity:.7}}>No pending requests.</div>}
      </Section>

      <Section title="Held Requests" count={(held?.length ?? 0)}>
        {held.map(r => <Card key={r.id} r={r} showActions={true} />)}
        {(!held || held.length===0) && <div style={{opacity:.7}}>No held requests.</div>}
      </Section>

      <Section title="Processed Requests" count={(processed?.length ?? 0)}>
        {processed.map(r => <Card key={r.id} r={r} showActions={false} />)}
        {(!processed || processed.length===0) && <div style={{opacity:.7}}>No processed requests yet.</div>}
      </Section>
    </div>
  );
}

export default AdminRequestList;
