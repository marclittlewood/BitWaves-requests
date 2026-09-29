# BitWaves Request Intros & Normal Imaging — v1.6.1

This build can automatically place a request intro immediately before a listener-requested song and, when configured, suppress a normal Station ID / Show ID that would otherwise cause two sweepers to play back-to-back.

## On-air behaviour

### Automated/request-intro slot

Recommended clock order:

1. Optional normal Station ID / Show ID
2. Break Note: `REQUEST`
3. Track: `Request Sweeper Placeholder`
4. Normal Song / song-group position

When no listener request is assigned, the normal imaging and scheduled song behave normally and the 0.25-second placeholder is effectively silent.

When a listener request is assigned:

- the placeholder is replaced with a random track from `REQUEST_SWEEPER_TRACK_GROUP_NAME`;
- the normal song slot is replaced with the requested song;
- if the track immediately before `REQUEST` belongs to one of the groups configured in `NORMAL_SWEEPER_TRACK_GROUP_NAMES`, that normal imaging item is replaced with the same 0.25-second silent placeholder for that slot.

Result: **Request Intro -> Requested Song**, without a normal Station/Show ID immediately before it.

### Live-show slot without request intro

A live show can continue to use:

1. Optional normal Station ID / Show ID
2. Break Note: `REQUEST`
3. Song

Because there is **no Request Sweeper Placeholder**, v1.6.1 does not suppress the normal imaging. The requested song is inserted exactly as before.

Result: **Normal Station/Show ID -> Requested Song**.

This rule is deliberate: normal imaging is suppressed only when a real request intro is being inserted.

## Placeholder track

A ready-made silent file is included at:

`playit-assets/Request Sweeper Placeholder.wav`

Import it into PlayIt Live with the title **Request Sweeper Placeholder**. Mark it as a **Sweeper**.

The real request intros in your Request Intros Track Group should also be marked appropriately for the segue behaviour you want.

## DigitalOcean environment variables

### Request intro group

`REQUEST_SWEEPER_TRACK_GROUP_NAME`

For BitWaves this should be the exact PlayIt Track Group name:

`Request Intros`

### Placeholder title (optional)

`REQUEST_SWEEPER_PLACEHOLDER_TRACK_NAME`

Default:

`Request Sweeper Placeholder`

You only need to set this if you use a different title.

### Normal Station/Show imaging groups

Add:

`NORMAL_SWEEPER_TRACK_GROUP_NAMES`

For the current BitWaves setup:

`Station ID's,Show ID's`

You can list multiple exact PlayIt Track Group names separated by commas, semicolons, or new lines.

Only tracks from these explicitly configured groups are eligible to be suppressed. The app never blindly removes whatever happens to be before `REQUEST`.

## Safety behaviour

- No Request Sweeper Placeholder in a slot -> normal imaging is never suppressed.
- Placeholder exists but no real request intro is available -> normal imaging is never suppressed.
- Previous track is not in an approved normal-imaging group -> it is never suppressed.
- Normal-imaging suppression fails -> the request still proceeds; the worst case is the previous double-sweeper behaviour for that one slot.
- Requested-song assignment fails after substitutions -> the app attempts to restore the original Station/Show ID and restore the silent request placeholder.
- Break-note annotation failure does not duplicate an already-assigned request.

## Existing clocks

You do not have to add request-intro placeholders to live shows. Existing `Break Note: REQUEST -> Song` positions remain compatible.

Use the placeholder only on clocks where you want the automatic Request Intro behaviour.


### v1.6.1 imaging-detection note
The request service checks the nearest preceding real audio track before the `REQUEST` marker. It recognises configured normal imaging from either the refreshed Track Group cache or the Track Group metadata returned with the PlayIt playout-log item. This avoids false misses caused by structural/empty log rows.
