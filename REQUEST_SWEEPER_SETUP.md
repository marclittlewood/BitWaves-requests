# BitWaves Request Sweepers — v1.4.0

This build can automatically place a request sweeper immediately before a listener-requested song.

## On-air behaviour

- No listener request assigned to the slot: the silent placeholder remains and the normal scheduled song plays.
- Listener request assigned to the slot: the app replaces the silent placeholder with a random track from the configured Request Sweeper Track Group, then replaces the normal song slot with the requested song.
- If the sweeper group contains more than one track, the app avoids immediately repeating the last sweeper where possible.
- Existing REQUEST clock positions without a sweeper placeholder still work exactly as before; they simply do not receive a sweeper.

## PlayIt Live clock layout

For each request position, use this order:

1. Break Note: `REQUEST`
2. Track: `Request Sweeper Placeholder`
3. Your normal Song / song-group position

A ready-made silent file is included at:

`playit-assets/Request Sweeper Placeholder.wav`

Import that file into PlayIt Live with the title **Request Sweeper Placeholder**. Mark it as a **Sweeper** so the silent placeholder does not add an audible gap before the following song.

The real sweepers in your Request Sweeper Track Group should also be marked as **Sweeper** in PlayIt Live if you want them to play over the intro of the requested song.

## DigitalOcean environment variables

Add:

`REQUEST_SWEEPER_TRACK_GROUP_NAME`

Set its value to the exact name of your existing PlayIt Track Group containing the request sweeper IDs/tracks.

Optional:

`REQUEST_SWEEPER_PLACEHOLDER_TRACK_NAME`

The default is `Request Sweeper Placeholder`, so you only need this variable if you use a different placeholder title.

## Failure-safe behaviour

The request system is deliberately fail-safe:

- If the sweeper group is missing or empty, the requested song still gets scheduled and the silent placeholder remains.
- If the sweeper is swapped in but the requested song cannot be assigned, the app attempts to restore the silent placeholder so a request sweeper is not left in front of an unrelated scheduled song.
- A failure to update the presenter Break Note after the audio has already been assigned does not cause the request to be inserted into a second slot.

## Existing clocks

You do not have to update every clock before deploying this build. v1.4.0 is backward-compatible with the current `Break Note: REQUEST -> Song` layout. Add the placeholder to clocks progressively; sweeper playback activates only on request positions where the placeholder is present.
