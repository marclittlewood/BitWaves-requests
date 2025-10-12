import React, { useState } from 'react';

export default function TrackCard(props: any) {
  // Be flexible with incoming props so this drops in cleanly
  const track =
    props.track ??
    props.item ??
    {
      guid: props.guid ?? props.trackGuid,
      artistTitle:
        props.artistTitle ??
        (props.artist && props.title ? `${props.artist} - ${props.title}` : props.title) ??
        props.name ??
        'Unknown Track',
    };

  const trackGuid: string = track?.guid ?? props.trackGuid;
  const artistTitle: string = track?.artistTitle ?? `${props.artist ?? ''} ${props.title ?? ''}`.trim();

  const [requestedBy, setRequestedBy] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!trackGuid) {
    return (
      <div className="p-4 border rounded-xl bg-white">
        <div className="text-sm text-red-600">Missing track GUID.</div>
      </div>
    );
  }

  const onSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    setSuccess(false);
    setErrorMessage('');

    fetch('/api/requestTrack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackGuid,
        requestedBy: requestedBy?.trim() || undefined,
        message: message?.trim() || undefined,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          setSuccess(true);
          setErrorMessage('');
          return;
        }

        // Distinguish between per-track cooldown and per-IP/user rate limit
        if (response.status === 429) {
          const data = await response.json().catch(() => ({} as any));

          if (data?.error === 'COOLDOWN_ACTIVE') {
            const when = data.nextAllowedAt ? new Date(data.nextAllowedAt).toLocaleString() : 'later';
            setErrorMessage(`That song was requested recently. You can request it again after ${when}.`);
            return;
          }

          if (data?.error === 'TOO_MANY_REQUESTS') {
            const when = data.nextAllowedAt ? new Date(data.nextAllowedAt).toLocaleString() : 'later';
            const scope = data.window === 'hour' ? 'this hour' : 'today';
            const limit =
              typeof data.limit === 'number' ? ` (limit: ${data.limit} per ${scope})` : '';
            setErrorMessage(`You’ve reached the request limit${limit}. Try again after ${when}.`);
            return;
          }

          setErrorMessage('You’ve hit a limit. Please try again later.');
          return;
        }

        if (response.status === 409) {
          // If you already have a specific 409 meaning, keep it here
          const data = await response.json().catch(() => ({} as any));
          setErrorMessage(data?.message || 'Your request could not be processed right now.');
          return;
        }

        // Generic fallback for other errors
        const data = await response.json().catch(() => ({} as any));
        setErrorMessage(data?.message || 'Something went wrong. Please try again.');
      })
      .catch(() => {
        setErrorMessage('Network error. Please try again.');
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="p-4 border rounded-xl bg-white shadow-sm flex flex-col gap-3">
      <div className="font-medium">{artistTitle || 'Untitled'}</div>

      {/* Optional inputs; keep if you already surface these on your public page */}
      <div className="flex flex-col gap-2">
        <input
          placeholder="Your name (optional)"
          className="border rounded-lg px-3 py-2"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
        />
        <input
          placeholder="Message (optional)"
          className="border rounded-lg px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {errorMessage ? <div className="text-sm text-red-600">{errorMessage}</div> : null}
      {success ? (
        <div className="text-sm text-green-600">Request received — thanks!</div>
      ) : null}

      <button
        className="px-4 py-2 rounded-lg text-white font-medium shadow-sm disabled:opacity-60"
        style={{ background: '#09C816' }}
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? 'Requesting…' : 'Request Song'}
      </button>
    </div>
  );
}
