import { TrackDto } from "../shared/TrackDto";
import { PlayItLiveApiClient } from "./PlayItLiveApiClient";

export class Tracks {
    private tracks: TrackDto[];
    private requestableTracks: TrackDto[];
    private requestSweeperTracks: TrackDto[];
    private normalImagingTrackGuids: Set<string>;
    private normalImagingTrackGroupNames: Set<string>;

    constructor(
        private playItLiveApiClient: PlayItLiveApiClient,
        private requestableTrackGroup?: string,
        private requestSweeperTrackGroup?: string,
        private normalImagingTrackGroups: string[] = []
    ) {
        this.tracks = [];
        this.requestableTracks = [];
        this.requestSweeperTracks = [];
        this.normalImagingTrackGuids = new Set<string>();
        this.normalImagingTrackGroups = this.normalImagingTrackGroups
            .map(name => name.trim())
            .filter(Boolean);
        this.normalImagingTrackGroupNames = new Set(
            this.normalImagingTrackGroups.map(name => this.normaliseGroupName(name))
        );
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

    isNormalImagingTrack(guid: string | undefined, playoutTrackGroups?: string): boolean {
        if (guid && this.normalImagingTrackGuids.has(guid)) {
            return true;
        }

        // PlayIt also exposes Track Group membership directly on playout-log items.
        // Use that as a second source of truth because a playout item can appear before
        // the periodic track-group cache has refreshed, and some PlayIt builds include
        // structural/empty log rows that make GUID-only matching less reliable.
        if (!playoutTrackGroups || !this.normalImagingTrackGroupNames.size) {
            return false;
        }

        const rawGroups = playoutTrackGroups
            .split(/[,;|\r\n]+/)
            .map(value => this.normaliseGroupName(value))
            .filter(Boolean);

        if (rawGroups.some(group => this.normalImagingTrackGroupNames.has(group))) {
            return true;
        }

        // Fallback for PlayIt versions that return Track Groups as one formatted string
        // rather than a clean delimited list. Group names are admin-configured, so an
        // exact normalised substring is still narrower than matching by title/type.
        const normalisedAllGroups = this.normaliseGroupName(playoutTrackGroups);
        return [...this.normalImagingTrackGroupNames].some(group =>
            !!group && normalisedAllGroups.includes(group)
        );
    }


    private normaliseGroupName(value: string | undefined): string {
        return (value ?? '')
            .trim()
            .toLowerCase()
            .replace(/[’‘`]/g, "'")
            .replace(/\s+/g, ' ');
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

    private resolveTrackGroupGuid(
        groupName: string | undefined,
        trackGroups: Array<{ guid: string; name: string }>
    ): string | undefined {
        if (!groupName) return undefined;

        const wanted = groupName.trim().toLowerCase();
        const group = trackGroups.find(item => item.name.trim().toLowerCase() === wanted);

        if (!group) {
            console.warn(`PlayIt Track Group not found: ${groupName}`);
            return undefined;
        }

        return group.guid;
    }

    private async fetchTracks() {
        const hasConfiguredGroups = !!this.requestableTrackGroup ||
            !!this.requestSweeperTrackGroup ||
            this.normalImagingTrackGroups.length > 0;

        const trackGroupData = hasConfiguredGroups
            ? await this.playItLiveApiClient.getTrackGroupListItems()
            : { trackGroups: [] as Array<{ guid: string; name: string }> };

        const requestableTrackGroupGuid = this.resolveTrackGroupGuid(
            this.requestableTrackGroup,
            trackGroupData.trackGroups
        );
        const requestSweeperTrackGroupGuid = this.resolveTrackGroupGuid(
            this.requestSweeperTrackGroup,
            trackGroupData.trackGroups
        );
        const normalImagingTrackGroupGuids = this.normalImagingTrackGroups
            .map(name => this.resolveTrackGroupGuid(name, trackGroupData.trackGroups))
            .filter((guid): guid is string => !!guid);

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

        const normalImagingTrackData = await Promise.all(
            normalImagingTrackGroupGuids.map(guid =>
                this.playItLiveApiClient.getTrackListItems('artist_title,type', guid)
            )
        );

        this.requestableTracks = this.mapToTrackDto(requestableTrackData.tracks);
        this.tracks = this.mapToTrackDto(trackData.tracks);
        this.requestSweeperTracks = this.mapToTrackDto(requestSweeperTrackData.tracks);
        this.normalImagingTrackGuids = new Set(
            normalImagingTrackData.flatMap(data => data.tracks.map(track => track.guid))
        );

        console.log('requestableTracks', this.requestableTracks.length);
        console.log('tracks', this.tracks.length);
        if (this.requestSweeperTrackGroup) {
            console.log('requestSweeperTracks', this.requestSweeperTracks.length);
        }
        if (this.normalImagingTrackGroups.length) {
            console.log(
                'normalImagingTracks',
                this.normalImagingTrackGuids.size,
                `(${this.normalImagingTrackGroups.join(', ')})`
            );
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
