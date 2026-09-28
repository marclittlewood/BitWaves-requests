import { PlayItLiveApiClient } from "./PlayItLiveApiClient";
import { Tracks } from "./Tracks";

export class RequestAgent {
    private lastSweeperTrackGuid?: string;
    private readonly sweeperPlaceholderTrackName: string;

    constructor(
        private playItLiveApiClient: PlayItLiveApiClient,
        private tracks: Tracks,
        sweeperPlaceholderTrackName = 'Request Sweeper Placeholder'
    ) {
        this.sweeperPlaceholderTrackName = sweeperPlaceholderTrackName.trim();
    }

    async getAvailableItems(): Promise<RequestPair[]> {
        /*
         * Get the current playout log item and use it to find the current hour's start time.
         * Then get all playout log items for the current hour and next hour.
         * Find the current item's position and inspect all items after it plus next hour's items.
         */
        const currentPlayoutLogItem = await this.playItLiveApiClient.getCurrentPlayoutLogItem();
        const currentHourStartTime = new Date(currentPlayoutLogItem.hourStartTime);
        const playoutLogItems = await this.playItLiveApiClient.getPlayoutLogItems(currentHourStartTime);
        const nextHourStartTime = new Date(currentHourStartTime.getTime() + 60 * 60 * 1000);
        const nextHourPlayoutLogItems = await this.playItLiveApiClient.getPlayoutLogItems(nextHourStartTime);
        const currentItemIndex = playoutLogItems.findIndex(item => item.guid === currentPlayoutLogItem.guid);
        const itemsAfterCurrentItem = currentItemIndex >= 0
            ? playoutLogItems.slice(currentItemIndex + 1)
            : playoutLogItems;
        const allItems = [...itemsAfterCurrentItem, ...nextHourPlayoutLogItems];

        const requestPairs: RequestPair[] = [];

        let pendingPair: {
            breakNoteItemGuid: string;
            sweeperItemGuid?: string;
            sweeperPlaceholderTrackGuid?: string;
        } | null = null;

        /*
         * REQUEST clock pattern supported by this build:
         *
         *   Break Note: REQUEST
         *   Track: Request Sweeper Placeholder   (optional, but required for sweeper playback)
         *   Track: normal Song
         *
         * The placeholder is deliberately a real Track item so the existing PlayIt Control API
         * updateTrack endpoint can safely swap it for a real request sweeper only when a listener
         * request is actually allocated to this slot. If there is no request, PlayIt simply plays
         * the silent placeholder and the normal scheduled song.
         *
         * Existing clocks without the placeholder remain fully compatible: requests are still
         * inserted into the next Song exactly as before, just without a sweeper.
         */
        for (const item of allItems) {
            if (!item) continue;

            if (item.type === 'breakNote') {
                const isRequestBreak = item.additionalFields.some(field =>
                    field.name === 'Break Note' && field.value.trim().toUpperCase() === 'REQUEST'
                );

                if (isRequestBreak) {
                    pendingPair = { breakNoteItemGuid: item.guid };
                }
                continue;
            }

            if (!pendingPair || item.type !== 'track') continue;

            const track = this.tracks.getTrackByGuid(item.trackGuid);
            if (!track) continue;

            if (
                !pendingPair.sweeperItemGuid &&
                this.isSweeperPlaceholder(track.artistTitle)
            ) {
                pendingPair.sweeperItemGuid = item.guid;
                pendingPair.sweeperPlaceholderTrackGuid = item.trackGuid;
                continue;
            }

            if (track.type === 'Song') {
                requestPairs.push({
                    breakNoteItemGuid: pendingPair.breakNoteItemGuid,
                    requestItemGuid: item.guid,
                    sweeperItemGuid: pendingPair.sweeperItemGuid,
                    sweeperPlaceholderTrackGuid: pendingPair.sweeperPlaceholderTrackGuid,
                    scheduledStartTime: item.startTime,
                    displayStartTime: item.displayStartTime,
                });
                pendingPair = null;
            }
        }

        return requestPairs;
    }

    /**
     * Resolve assigned request item GUIDs against PlayIt's current and next
     * playout hours.  This is used by the public queue so an already-scheduled
     * request can keep following the live log as earlier items run long/short.
     * A single two-hour fetch services every request ID in the call.
     */
    async getLiveScheduleForItems(itemGuids: string[]): Promise<Map<string, RequestScheduleItem>> {
        const wanted = new Set(itemGuids.filter(Boolean));
        const found = new Map<string, RequestScheduleItem>();
        if (!wanted.size) return found;

        const currentPlayoutLogItem = await this.playItLiveApiClient.getCurrentPlayoutLogItem();
        const currentHourStartTime = new Date(currentPlayoutLogItem.hourStartTime);
        const currentHourItems = await this.playItLiveApiClient.getPlayoutLogItems(currentHourStartTime);
        const nextHourStartTime = new Date(currentHourStartTime.getTime() + 60 * 60 * 1000);
        const nextHourItems = await this.playItLiveApiClient.getPlayoutLogItems(nextHourStartTime);

        for (const item of [...currentHourItems, ...nextHourItems]) {
            if (!item || !wanted.has(item.guid)) continue;
            found.set(item.guid, {
                guid: item.guid,
                startTime: item.startTime,
                displayStartTime: item.displayStartTime,
                hasPlayed: !!item.hasPlayed,
                isInPast: !!item.isInPast,
                willSkip: !!item.willSkip,
                isSoftDeleted: !!item.isSoftDeleted,
            });
        }

        return found;
    }

    async canRequestTrack(trackGuid: string, itemGuid: string) {
        return true;
    }

    async requestTrack(trackGuid: string, pair: RequestPair, requestText: string) {
        let selectedSweeperGuid: string | undefined;
        let sweeperWasChanged = false;

        /*
         * If this request slot includes the silent placeholder and a sweeper Track Group has
         * been configured, replace the placeholder with a randomly selected sweeper. We avoid
         * an immediate repeat when the group contains more than one item.
         */
        if (pair.sweeperItemGuid && pair.sweeperPlaceholderTrackGuid) {
            const sweeper = this.tracks.getRandomRequestSweeper(this.lastSweeperTrackGuid);
            if (sweeper) {
                await this.playItLiveApiClient.updateTrackInPlayoutLog(pair.sweeperItemGuid, sweeper.guid);
                selectedSweeperGuid = sweeper.guid;
                sweeperWasChanged = true;
            } else {
                console.warn('Request sweeper placeholder found, but no request sweepers are available. Request will play without a sweeper.');
            }
        }

        try {
            await this.playItLiveApiClient.updateTrackInPlayoutLog(pair.requestItemGuid, trackGuid);
        } catch (error) {
            // If the requested song could not be assigned, restore the silent placeholder so a
            // sweeper cannot accidentally play in front of the original scheduled song.
            if (sweeperWasChanged && pair.sweeperItemGuid && pair.sweeperPlaceholderTrackGuid) {
                try {
                    await this.playItLiveApiClient.updateTrackInPlayoutLog(
                        pair.sweeperItemGuid,
                        pair.sweeperPlaceholderTrackGuid
                    );
                } catch (rollbackError) {
                    console.error('Failed to restore request sweeper placeholder after request assignment failure:', rollbackError);
                }
            }
            throw error;
        }

        // The break-note annotation is useful to presenters but is not required for the audio
        // request to be considered successfully assigned. Do not duplicate a request into another
        // slot just because the note update fails after the song has already been replaced.
        try {
            await this.playItLiveApiClient.updateBreakNoteInPlayoutLog(
                pair.breakNoteItemGuid,
                '00:00',
                `REQUESTED BY: ${requestText}`
            );
        } catch (error) {
            console.error('Requested song was assigned, but the REQUEST break note could not be updated:', error);
        }

        if (selectedSweeperGuid) {
            this.lastSweeperTrackGuid = selectedSweeperGuid;
        }

        return {
            success: true,
            sweeperTrackGuid: selectedSweeperGuid,
            requestItemGuid: pair.requestItemGuid,
            scheduledStartTime: pair.scheduledStartTime,
            displayStartTime: pair.displayStartTime,
        };
    }

    private normaliseTrackLabel(value: string | undefined): string {
        return (value ?? '').trim().toLowerCase();
    }

    private isSweeperPlaceholder(trackLabel: string | undefined): boolean {
        const label = this.normaliseTrackLabel(trackLabel);
        const wanted = this.normaliseTrackLabel(this.sweeperPlaceholderTrackName);
        if (!label || !wanted) return false;

        return label === wanted ||
            label.endsWith(` - ${wanted}`) ||
            label.endsWith(` – ${wanted}`) ||
            label.endsWith(` — ${wanted}`);
    }
}

export interface RequestPair {
    breakNoteItemGuid: string;
    requestItemGuid: string;
    sweeperItemGuid?: string;
    sweeperPlaceholderTrackGuid?: string;
    scheduledStartTime?: string;
    displayStartTime?: string;
}

export interface RequestScheduleItem {
    guid: string;
    startTime?: string;
    displayStartTime?: string;
    hasPlayed: boolean;
    isInPast: boolean;
    willSkip: boolean;
    isSoftDeleted: boolean;
}
