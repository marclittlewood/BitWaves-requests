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
            normalImagingItemGuid?: string;
            normalImagingOriginalTrackGuid?: string;
        } | null = null;

        /*
         * REQUEST clock patterns supported by this build:
         *
         *   Automated/request-intro slot:
         *   Track: Station ID / Show ID                  (optional)
         *   Break Note: REQUEST
         *   Track: Request Sweeper Placeholder           (optional)
         *   Track: normal Song
         *
         *   Live-show slot:
         *   Track: Station ID / Show ID                  (optional)
         *   Break Note: REQUEST
         *   Track: normal Song
         *
         * If a request-intro placeholder is present, the app can replace it with a real request
         * intro. When the immediately preceding track belongs to one of the configured normal
         * imaging groups, that normal ID is replaced with the same silent placeholder so the
         * listener does not hear two sweepers in a row.
         *
         * Crucially, normal imaging is NEVER suppressed on a REQUEST slot that does not contain
         * the request-intro placeholder. Live shows therefore keep their usual Station/Show ID
         * and simply receive the requested song, exactly as before.
         */
        for (let index = 0; index < allItems.length; index++) {
            const item = allItems[index];
            if (!item) continue;

            if (item.type === 'breakNote') {
                const isRequestBreak = item.additionalFields.some(field =>
                    field.name === 'Break Note' && field.value.trim().toUpperCase() === 'REQUEST'
                );

                if (isRequestBreak) {
                    const previousItem = index > 0 ? allItems[index - 1] : undefined;
                    const previousIsConfiguredImaging = previousItem?.type === 'track' &&
                        this.tracks.isNormalImagingTrack(previousItem.trackGuid);

                    pendingPair = {
                        breakNoteItemGuid: item.guid,
                        normalImagingItemGuid: previousIsConfiguredImaging ? previousItem!.guid : undefined,
                        normalImagingOriginalTrackGuid: previousIsConfiguredImaging ? previousItem!.trackGuid : undefined,
                    };
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
                    normalImagingItemGuid: pendingPair.normalImagingItemGuid,
                    normalImagingOriginalTrackGuid: pendingPair.normalImagingOriginalTrackGuid,
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
        let normalImagingWasSuppressed = false;

        /*
         * If this request slot includes the silent placeholder and a request-intro Track Group
         * has been configured, replace the placeholder with a randomly selected request intro.
         *
         * Only after a request intro has actually been inserted do we consider suppressing the
         * normal Station/Show ID immediately before REQUEST. Suppression is done by swapping that
         * playout item to the same 0.25-second silent placeholder, and only when Tracks has already
         * verified that the original track belongs to an explicitly configured imaging group.
         */
        if (pair.sweeperItemGuid && pair.sweeperPlaceholderTrackGuid) {
            const sweeper = this.tracks.getRandomRequestSweeper(this.lastSweeperTrackGuid);
            if (sweeper) {
                await this.playItLiveApiClient.updateTrackInPlayoutLog(pair.sweeperItemGuid, sweeper.guid);
                selectedSweeperGuid = sweeper.guid;
                sweeperWasChanged = true;

                if (pair.normalImagingItemGuid && pair.normalImagingOriginalTrackGuid) {
                    try {
                        await this.playItLiveApiClient.updateTrackInPlayoutLog(
                            pair.normalImagingItemGuid,
                            pair.sweeperPlaceholderTrackGuid
                        );
                        normalImagingWasSuppressed = true;
                    } catch (error) {
                        // Do not fail the listener request just because the preceding station/show
                        // imaging could not be suppressed. The worst case is the old double-sweeper
                        // behaviour for this one slot, which is safer than dropping the request.
                        console.error('Request intro was inserted, but the preceding normal imaging could not be suppressed:', error);
                    }
                }
            } else {
                console.warn('Request sweeper placeholder found, but no request sweepers are available. Request will play without a request intro and normal imaging will be left untouched.');
            }
        }

        try {
            await this.playItLiveApiClient.updateTrackInPlayoutLog(pair.requestItemGuid, trackGuid);
        } catch (error) {
            // If the requested song could not be assigned, restore every audio item changed for
            // this request so the original clock remains intact.
            if (normalImagingWasSuppressed && pair.normalImagingItemGuid && pair.normalImagingOriginalTrackGuid) {
                try {
                    await this.playItLiveApiClient.updateTrackInPlayoutLog(
                        pair.normalImagingItemGuid,
                        pair.normalImagingOriginalTrackGuid
                    );
                } catch (rollbackError) {
                    console.error('Failed to restore normal imaging after request assignment failure:', rollbackError);
                }
            }

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
            normalImagingSuppressed: normalImagingWasSuppressed,
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
    normalImagingItemGuid?: string;
    normalImagingOriginalTrackGuid?: string;
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
