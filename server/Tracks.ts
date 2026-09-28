import { TrackDto } from "../shared/TrackDto";
import { PlayItLiveApiClient } from "./PlayItLiveApiClient";

export class Tracks {
    private tracks: TrackDto[];
    private requestableTracks: TrackDto[];
    private requestSweeperTracks: TrackDto[];

    constructor(
        private playItLiveApiClient: PlayItLiveApiClient,
        private requestableTrackGroup?: string,
        private requestSweeperTrackGroup?: string
    ) {
        this.tracks = [];
        this.requestableTracks = [];
        this.requestSweeperTracks = [];
    }

    async init() {
        // Periodically fetch tracks from the API.
        setInterval(() => {
            this.fetchTracks().catch(err => console.error('Failed to refresh PlayIt tracks:', err));
        }, 300 * 1000); // 5 minutes

        await this.fetchTracks();
    }

    getTracks() {
        return this.tracks;
    }

    getRequestableTracks() {
        return this.requestableTracks;
    }

    getRequestSweeperTracks() {
        return this.requestSweeperTracks;
    }

    getTrackByGuid(guid: string) {
        return this.tracks.find(track => track.guid === guid);
    }

    /**
     * Pick a sweeper from the configured request-sweeper Track Group.
     * Where possible, avoid immediately repeating the last sweeper.
     */
    getRandomRequestSweeper(excludeGuid?: string): TrackDto | undefined {
        if (!this.requestSweeperTracks.length) return undefined;

        const candidates = excludeGuid && this.requestSweeperTracks.length > 1
            ? this.requestSweeperTracks.filter(track => track.guid !== excludeGuid)
            : this.requestSweeperTracks;

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    private async findTrackGroupGuid(groupName?: string): Promise<string | undefined> {
        if (!groupName) return undefined;

        const trackGroupData = await this.playItLiveApiClient.getTrackGroupListItems();
        const wanted = groupName.trim().toLowerCase();
        const group = trackGroupData.trackGroups.find(item => item.name.trim().toLowerCase() === wanted);

        if (!group) {
            console.warn(`PlayIt Track Group not found: ${groupName}`);
            return undefined;
        }

        return group.guid;
    }

    private async fetchTracks() {
        const [requestableTrackGroupGuid, requestSweeperTrackGroupGuid] = await Promise.all([
            this.findTrackGroupGuid(this.requestableTrackGroup),
            this.findTrackGroupGuid(this.requestSweeperTrackGroup),
        ]);

        const requestableTrackData = await this.playItLiveApiClient.getTrackListItems(
            'artist_title,type',
            this.requestableTrackGroup ? (requestableTrackGroupGuid ?? '00000000000000000000000000000000') : undefined
        );

        const trackData = await this.playItLiveApiClient.getTrackListItems('artist_title,type');

        let requestSweeperTrackData: { tracks: any[] } = { tracks: [] };
        if (this.requestSweeperTrackGroup && requestSweeperTrackGroupGuid) {
            requestSweeperTrackData = await this.playItLiveApiClient.getTrackListItems(
                'artist_title,type',
                requestSweeperTrackGroupGuid
            );
        }

        this.requestableTracks = this.mapToTrackDto(requestableTrackData.tracks);
        this.tracks = this.mapToTrackDto(trackData.tracks);
        this.requestSweeperTracks = this.mapToTrackDto(requestSweeperTrackData.tracks);

        console.log('requestableTracks', this.requestableTracks.length);
        console.log('tracks', this.tracks.length);
        if (this.requestSweeperTrackGroup) {
            console.log('requestSweeperTracks', this.requestSweeperTracks.length);
        }
    }

    private mapToTrackDto(tracks: any[]): TrackDto[] {
        return tracks.map(track => ({
            guid: track.guid,
            artistTitle: track.values[0].value,
            type: track.values[1].value
        }) satisfies TrackDto);
    }
}
