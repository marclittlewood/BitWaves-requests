import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRequestsQuery, useDeleteRequestMutation, useHoldRequestMutation, useProcessRequestMutation } from './queries/Requests';
import { RequestDto } from '../../shared/RequestDto';

interface AdminRequestListProps {
  token: string | null;
  onLogout: () => void;
}

export function AdminRequestList({ token, onLogout }: AdminRequestListProps) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<{id: string, name: string} | null>(null);

  const { data: requests, refetch } = useRequestsQuery(token, () => {
    onLogout();
    navigate({ to: '/' });
  });

  const deleteMutation = useDeleteRequestMutation(token, onLogout);
  const holdMutation = useHoldRequestMutation(token, onLogout);
  const processMutation = useProcessRequestMutation(token, onLogout);

  const onDelete = (id: string) => setConfirm({ id, name: requests?.find(r => r.id === id)?.requestedBy || '' });
  const confirmDelete = () => {
    if (!confirm) return;
    deleteMutation.mutate(confirm.id, { onSuccess: () => setConfirm(null) });
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Song Requests</h1>
      <div className="space-y-3">
        {(requests || []).map((req) => (
          <RequestRow
            key={req.id}
            request={req}
            onDelete={() => onDelete(req.id)}
            onHold={() => holdMutation.mutate(req.id)}
            onProcess={() => processMutation.mutate(req.id)}
          />
        ))}
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-[420px] shadow-xl">
            <h2 className="text-lg font-medium mb-2">Delete this request?</h2>
            <p className="text-sm text-gray-600 mb-4">From <strong>{confirm.name}</strong>. This will mark it as deleted.</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg text-white" style={{ background: '#F4320B' }} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRow({ request, onDelete, onHold, onProcess }: {
  request: RequestDto;
  onDelete: () => void;
  onHold: () => void;
  onProcess: () => void;
}) {
  const created = new Date(request.requestedAt);
  const processed = request.processedAt ? new Date(request.processedAt) : null;
  const now = Date.now();
  const etaMs = Math.max(0, new Date(request.autoProcessAt).getTime() - now);
  const etaMin = Math.floor(etaMs / 60000);
  const etaSec = Math.floor((etaMs % 60000) / 1000);

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-base">{request.requestedBy}</div>
          {request.message && <div className="text-sm text-gray-700">{request.message}</div>}
          <div className="text-xs text-gray-500 mt-1">
            Requested: {created.toLocaleString()}
            {processed && <> • Processed: {processed.toLocaleString()}</>}
            {' '}• Status: <span className="font-medium">{request.status}</span>
            {request.status === 'pending' && (
              <> • Auto in {etaMin}:{String(etaSec).padStart(2, '0')}</>
            )}
          </div>
        </div>
      </div>
      {/* Action bar below the words, using the same style idea as delete */}
      <div className="mt-3 flex flex-wrap gap-8 items-center">
        <button className="px-4 py-1.5 rounded-lg text-white font-medium shadow-sm" style={{ background: '#F4320B' }} onClick={onDelete}>
          Delete
        </button>
        <button className="px-4 py-1.5 rounded-lg text-white font-medium shadow-sm" style={{ background: '#F48B0B' }} onClick={onHold} disabled={request.status === 'held'}>
          Hold
        </button>
        <button className="px-4 py-1.5 rounded-lg text-white font-medium shadow-sm" style={{ background: '#09C816' }} onClick={onProcess}>
          Process
        </button>
      </div>
    </div>
  );
}
