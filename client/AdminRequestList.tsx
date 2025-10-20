import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  useRequestsQuery,
  useDeleteRequestMutation,
  useHoldRequestMutation,
  useProcessRequestMutation
} from './queries/Requests';
import { RequestDto } from '../../shared/RequestDto';
import { useTracksQuery } from './queries/Tracks';

interface AdminRequestListProps {
  token: string | null;
  onLogout: () => void;
}

type SectionKey = 'Pending' | 'Held' | 'Processing' | 'Processed';

function SectionTable({
  title,
  rows,
  trackMap,
  showActions,
  onDelete,
  onHold,
  onProcess,
}: {
  title: string;
  rows: RequestDto[];
  trackMap: Map<string, string>;
  showActions: boolean;
  onDelete?: (id: string) => void;
  onHold?: (id: string) => void;
  onProcess?: (id: string) => void;
}) {
  const getTitle = (guid: string) => trackMap.get(guid) || guid;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-sm text-gray-500">
          {rows.length} item{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto bg-white rounded-md shadow border border-gray-200">
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
            {rows.map((r) => {
              const created = new Date(r.requestedAt);
              const processed = r.processedAt ? new Date(r.processedAt) : null;

              const ActionsBar = showActions ? (
                <div className="flex gap-2 flex-wrap pt-2">
                  <button
                    className="px-3 py-1.5 rounded-md text-white font-medium shadow"
                    style={{ background: '#F4320B' }}
                    onClick={() => onDelete && onDelete(r.id)}
                  >
                    Delete
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md text-white font-medium shadow disabled:opacity-60"
                    style={{ background: '#F48B0B' }}
                    onClick={() => onHold && onHold(r.id)}
                    disabled={r.status === 'held'}
                  >
                    Hold
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md text-white font-medium shadow"
                    style={{ background: '#09C816' }}
                    onClick={() => onProcess && onProcess(r.id)}
                  >
                    Process
                  </button>
                </div>
              ) : null;

              return (
                <React.Fragment key={r.id}>
                  <tr className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {getTitle(r.trackGuid)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.requestedBy || '-'}
                    </td>
                    <td className="px-4 py-3 max-w-[150ch] whitespace-normal break-words" title={r.message || ''}>
                      {r.message ? (
                        <span>{r.message}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {created.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.ipAddress || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {processed ? processed.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100">
                        {r.status === 'deleted' ? 'Deleted' : (r.status || (r.processedAt ? 'processed' : 'pending'))}
                      </span>
                    </td>
                    
                  </tr>

                  {showActions ? (
                    <tr className="border-b">
                      <td className="px-4 pb-4 pt-0" colSpan={7}>
                        {ActionsBar}
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b">
                      <td colSpan={7} className="p-0" />
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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

  // Hide deleted; everything else shows.
  const all = (requests || []);

  // Buckets
  const bucket = {
    Pending:   all.filter(r => r.status === 'pending'),
    Held:      all.filter(r => r.status === 'held'),
    Processing:all.filter(r => r.status === 'processing'),
    Processed: all.filter(r => r.status === 'processed'),
  } as Record<SectionKey, RequestDto[]>;

  // Sorts
  const sortByRequestedDesc = (a: RequestDto, b: RequestDto) =>
    +new Date(b.requestedAt) - +new Date(a.requestedAt);
  const sortByProcessedDesc = (a: RequestDto, b: RequestDto) => {
    const aT = new Date(a.processedAt || a.requestedAt).getTime();
    const bT = new Date(b.processedAt || b.requestedAt).getTime();
    return bT - aT;
  };

  bucket.Pending.sort(sortByRequestedDesc);
  bucket.Held.sort(sortByRequestedDesc);
  bucket.Processing.sort(sortByRequestedDesc);
  bucket.Processed.sort(sortByProcessedDesc);

  return (
    <div className="mx-auto w-full max-w-7xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Song Requests (Admin)</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>Pending: {bucket.Pending.length}</span>
          <span>Held: {bucket.Held.length}</span>
          <span>Processing: {bucket.Processing.length}</span>
          <span>Processed: {bucket.Processed.length}</span>
        </div>
        <button
          className="px-4 py-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 shadow"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          Log out
        </button>
      </div>

      {/* Pending */}
      <SectionTable
        title="Pending Requests"
        rows={bucket.Pending}
        trackMap={trackMap}
        showActions={true}
        onDelete={(id) => deleteMutation.mutate(id)}
        onHold={(id) => holdMutation.mutate(id)}
        onProcess={(id) => processMutation.mutate(id)}
      />

      {/* Held */}
      <SectionTable
        title="Held Requests"
        rows={bucket.Held}
        trackMap={trackMap}
        showActions={true}
        onDelete={(id) => deleteMutation.mutate(id)}
        onHold={(id) => holdMutation.mutate(id)}
        onProcess={(id) => processMutation.mutate(id)}
      />

      {/* Processing */}
      <SectionTable
        title="Processing Requests"
        rows={bucket.Processing}
        trackMap={trackMap}
        showActions={true}
        onDelete={(id) => deleteMutation.mutate(id)}
        onHold={(id) => holdMutation.mutate(id)}
        onProcess={(id) => processMutation.mutate(id)}
      />

      {/* Processed (no actions) */}
      <SectionTable
        title="Processed Requests"
        rows={bucket.Processed}
        trackMap={trackMap}
        showActions={true}
      />
    </div>
  );
}
