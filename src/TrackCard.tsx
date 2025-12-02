import React, { useState, useEffect } from 'react';
import { TrackDto } from '../../shared/TrackDto';
import useLocalStorage from './hooks/useLocalStorage';
import { useSettingsQuery } from './queries/Settings';


function formatCooldownMessage(nextAllowedAt?: string | Date, fallbackHours?: number) {
    try {
        const now = new Date();
        const target = nextAllowedAt ? new Date(nextAllowedAt) : null;
        if (target && target > now) {
            const ms = target.getTime() - now.getTime();
            const hours = Math.floor(ms / 3600000);
            const mins = Math.ceil((ms % 3600000) / 60000);
            const parts: string[] = [];
            if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
            if (mins) parts.push(`${mins} min`);
            const when = target.toLocaleString();
            const approx = parts.length ? ` (~${parts.join(' ')})` : '';

            return `That song's already been requested. You can request it again after ${when}${approx}.`;
        }
        if (fallbackHours) {
            return `That song's already been requested. Please try again in about ${fallbackHours} hour${fallbackHours === 1 ? '' : 's'}.`;
        }
    } catch {
        // fall through to generic message
    }
    return `That song's already been requested. Please try again a little later.`;
}

export function TrackCard({ track }: { track: TrackDto }) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [requesterName, setRequesterName] = useLocalStorage<string>('songRequestName', '');
    const [requesterMessage, setRequesterMessage] = useState('');
    const [isRequested, setIsRequested] = useState(false);
    const [requestTime, setRequestTime] = useState<Date | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
    const maxMessageLength = useSettingsQuery().data?.maxMessageLength || 150;

    useEffect(() => {
        if (isRequested) {
            const timer = setTimeout(() => {
                setIsRequested(false);
            }, 30000); // 30 seconds
            return () => clearTimeout(timer);
        }
    }, [isRequested]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!requesterName.trim()) {
            // Don't submit if name is empty
            return;
        }

        // Clear previous error for this attempt
        setErrorMessage(null);
        setLastErrorMessage(null);

        console.log('Requesting track:', track.guid);

        fetch('/api/requestTrack', {
            method: 'POST',
            body: JSON.stringify({
                trackGuid: track.guid,
                requestedBy: requesterName,
                message: requesterMessage.trim() || undefined,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then(response => {
                if (response.ok) {
                    setIsRequested(true);
                    setRequestTime(new Date());
                    setShowConfirm(false);
                    setRequesterMessage(''); // Clear message for next request
                    setLastErrorMessage(null);
                    return;
                }

                if (response.status === 429) {
                    return response.json().then(data => {
                        if (data?.error === 'COOLDOWN_ACTIVE') {
                            const friendly = formatCooldownMessage(data.nextAllowedAt, data.cooldownHours);
                            setErrorMessage(friendly);
                            setLastErrorMessage(friendly);
                        } else {
                            const friendly =
                                "You're on fire! You've hit the request limit from this device for now. Please try again a little later.";
                            setErrorMessage(friendly);
                            setLastErrorMessage(friendly);
                        }
                    });
                }

                if (response.status === 409) {
                    // Song is already requested
                    return response.json().then(data => {
                        const friendly =
                            data.message ||
                            "That one's already in the queue. Pick another banger for now!";
                        setErrorMessage(friendly);
                        setLastErrorMessage(friendly);
                    });
                }

                if (response.status === 400) {
                    // Validation error (e.g., message too long)
                    return response.json().then(data => {
                        const friendly =
                            data.message ||
                            'Something did not look right with that request. Check your name/message and try again.';
                        setErrorMessage(friendly);
                        setLastErrorMessage(friendly);
                    });
                }

                // Any other error (5xx, etc.)
                return response.json().then(data => {
                    const friendly =
                        data.message ||
                        'We hit a snag trying to send that request. Please try again in a moment.';
                    setErrorMessage(friendly);
                    setLastErrorMessage(friendly);
                });
            })
            .catch(error => {
                console.error('Error requesting track:', error);
                const friendly = 'Network hiccup. Please check your connection and try again.';
                setErrorMessage(friendly);
                setLastErrorMessage(friendly);
            });
    };

    // Format the time since request
    const getTimeSinceRequest = () => {
        if (!requestTime) return '';

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - requestTime.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return 'just now';
        } else {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
    };

    return (
        <>
            <div
                onClick={() => {
                    setShowConfirm(true);
                    setErrorMessage(null);
                    // keep lastErrorMessage so the chip remains visible on the card
                }}
                className={`bg-white rounded-lg shadow-md p-3 lg:p-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer ${
                    isRequested ? 'border-2 border-green-500' : ''
                }`}
            >
                <div className="text-base lg:text-lg font-semibold text-gray-800">
                    {track.artistTitle}
                </div>

                {lastErrorMessage && !isRequested && (
                    <div className="mt-2 inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800">
                        {lastErrorMessage}
                    </div>
                )}

                {isRequested && (
                    <div className="mt-2 text-sm text-green-600 flex items-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Requested {getTimeSinceRequest()}
                    </div>
                )}
            </div>

            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">
                            {errorMessage ? 'Song Request' : 'Confirm Song Request'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {errorMessage
                                ? `Unable to request: ${track.artistTitle}`
                                : `Would you like to request "${track.artistTitle}"?`}
                        </p>

                        {errorMessage && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{errorMessage}</div>
                        )}

                        {!errorMessage ? (
                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label
                                        htmlFor="requesterName"
                                        className="block text-sm font-medium text-gray-700 mb-1"
                                    >
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        id="requesterName"
                                        name="requesterName"
                                        autoFocus={!requesterName}
                                        value={requesterName}
                                        onChange={e => setRequesterName(e.target.value)}
                                        placeholder="Enter your name"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    {requesterName && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            We&apos;ll show this as who the request is from.
                                        </p>
                                    )}
                                </div>

                                <div className="mb-4">
                                    <label
                                        htmlFor="requesterMessage"
                                        className="block text-sm font-medium text-gray-700 mb-1"
                                    >
                                        Message for the announcer (optional)
                                    </label>
                                    <textarea
                                        id="requesterMessage"
                                        name="requesterMessage"
                                        value={requesterMessage}
                                        autoFocus={!!requesterName}
                                        onChange={e => {
                                            if (e.target.value.length <= maxMessageLength) {
                                                setRequesterMessage(e.target.value);
                                            }
                                        }}
                                        placeholder={`Add a message (max ${maxMessageLength} characters)`}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                                        rows={3}
                                    />
                                    <p className="text-xs text-gray-500 mt-1 flex justify-end">
                                        <span>
                                            {requesterMessage.length}/{maxMessageLength}
                                        </span>
                                    </p>
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowConfirm(false);
                                            setErrorMessage(null);
                                        }}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!requesterName.trim()}
                                        className={`px-4 py-2 ${
                                            requesterName.trim()
                                                ? 'bg-blue-600 hover:bg-blue-700'
                                                : 'bg-blue-300 cursor-not-allowed'
                                        } text-white rounded-lg transition-colors`}
                                    >
                                        Request Song
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="flex justify-center">
                                <button
                                    autoFocus
                                    type="button"
                                    onClick={() => {
                                        setShowConfirm(false);
                                        setErrorMessage(null);
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
