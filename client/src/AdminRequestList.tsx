import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRequestsQuery, useDeleteRequestMutation, useHoldRequestMutation, useProcessRequestMutation } from './queries/Requests';
import { RequestDto } from '../../shared/RequestDto';
import { useTracksQuery } from './queries/Tracks';

interface AdminRequestListProps {
  token: string | null;
  onLogout: () => void;
}

export function AdminRequestList({ token, onLogout }: AdminRequestListProps) {
  const navigate = useNavigate();

  const { data: requests } = useRequestsQuery(token, () => {
    onLogout();
    navigate({ to: '/' });
  });

  const { data: tracks } = useTracksQuery();
  const trackMap = new Map((tracks || []).map(t => [t.guid, t.artistTitle]));

  const deleteMutation = useDeleteRequestMutation(token, onLogout);
  const holdMutation = useHoldRequestMutation(token, onLogout);
  const processMutation = useProcessRequestMutation(token, onLogout);

  const getTitle = (guid: string) => trackMap.get(guid) || guid;

  return (
    <div className="mx-auto w-full max-w-7xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Song Requests (Admin)</h1>
        <button
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          Log out
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Song</th>
              <th className="px-4 py-3 font-semibold">Requested By</th>
              <th className="px-4 py-3 font-semibold">Message</th>
              <th className="px-4 py-3 font-semibold">Requested Time</th>
              <th className="px-4 py-3 font-semibold">IP Address</th>
              <th className="px-4 py-3 font-semibold">Processed Time</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {(requests || []).map((r) => {
              const created = new Date(r.requestedAt);
              const processed = r.processedAt ? new Date(r.processedAt) : null;

              const ActionsBar = (
                <div className="flex gap-2 flex-wrap pt-2">
                  <button
                    className="px-3 py-1.5 rounded-lg text-white font-medium shadow-sm"
                    style={{ background: '#F4320B' }}
                    onClick={() => deleteMutation.mutate(r.id)}
                  >
                    Delete
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-white font-medium shadow-sm disabled:opacity-60"
                    style={{ background: '#F48B0B' }}
                    onClick={() => holdMutation.mutate(r.id)}
                    disabled={r.status === 'held'}
                  >
                    Hold
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-white font-medium shadow-sm"
                    style={{ background: '#09C816' }}
                    onClick={() => processMutation.mutate(r.id)}
                  >
                    Process
                  </button>
                </div>
              );

              return (
                <React.Fragment key={r.id}>
                  <tr className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{getTitle(r.trackGuid)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.requestedBy || '-'}</td>
                    <td className="px-4 py-3 max-w-[36ch]" title={r.message || ''}>
                      {r.message ? <span className="line-clamp-2">{r.message}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{created.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.ipAddress || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{processed ? processed.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100">
                        {r.status || (r.processedAt ? 'processed' : 'pending')}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 pb-4 pt-0" colSpan={7}>
                      {ActionsBar}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
