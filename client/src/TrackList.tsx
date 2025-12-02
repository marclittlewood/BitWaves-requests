import React, { useState } from 'react';
import { useTracksQuery } from './queries/Tracks';
import { SearchBox } from './SearchBox';
import { TrackCard } from './TrackCard';

export function TrackList() {
    const { data: tracks, isLoading, isError, error, refetch } = useTracksQuery();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTracks = tracks?.filter(track =>
        track.artistTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full max-w-4xl p-6 space-y-4">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-6">
                Request a Song
            </h1>

            <SearchBox
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search tracks..."
                disabled={isLoading || !!error}
            />

            {isLoading && (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3"
                        >
                            <div className="h-4 w-3/4 rounded bg-gray-200" />
                            <div className="h-3 w-1/2 rounded bg-gray-200" />
                            <div className="h-3 w-2/3 rounded bg-gray-200" />
                            <div className="h-9 w-24 rounded-full bg-gray-200" />
                        </div>
                    ))}
                </div>
            )}

            {isError && !isLoading && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2">
                    <p className="font-semibold">
                        Requests are taking a breather 😅
                    </p>
                    <p>
                        We couldn&apos;t load the BitWaves library just now. This is
                        usually just a quick hiccup.
                    </p>
                    {error instanceof Error && (
                        <p className="text-xs opacity-80 break-words">
                            Technical detail: {error.message}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-1 inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                    >
                        Try again
                    </button>
                </div>
            )}

            {!isLoading && !isError && (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTracks?.map(track => (
                        <TrackCard key={track.guid} track={track} />
                    ))}
                    {!filteredTracks?.length && (
                        <p className="col-span-full text-sm text-gray-500">
                            No tracks matched &quot;{searchTerm}&quot;. Try another
                            artist or song title.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
