# BitWaves Requests — v1.6.0

## Normal Station/Show ID suppression for request-intro slots

- Added optional multi-group normal-imaging detection via `NORMAL_SWEEPER_TRACK_GROUP_NAMES`.
- Supports comma/semicolon/newline separated PlayIt Track Group names, e.g. `Station ID's,Show ID's`.
- When a REQUEST slot contains the silent `Request Sweeper Placeholder` and a real request intro is successfully inserted, the immediately preceding track is suppressed **only** if it belongs to one of the configured normal-imaging groups.
- Suppression uses the same 0.25-second silent placeholder, avoiding a Station/Show ID immediately followed by a request intro.
- Live-show REQUEST slots without the request-intro placeholder remain unchanged: normal Station/Show imaging is retained and only the requested song is substituted.
- Tracks outside the configured imaging groups are never suppressed.
- If no real request intro is available, normal imaging is left untouched.
- If the requested song assignment fails after imaging was suppressed, the app attempts to restore both the original imaging track and the request-intro placeholder.
- Existing v1.5.0 live expected-play-time behaviour is unchanged.

## Validation performed

- Type-checked the modified request/imaging modules with TypeScript 5.8.
- Mock-tested approved Station/Show ID suppression with a request-intro placeholder.
- Mock-tested live-show compatibility with no placeholder (normal imaging remains).
- Mock-tested unapproved preceding tracks (never suppressed).
- Mock-tested no-request-intro fallback (normal imaging remains).
- Mock-tested rollback of both the normal imaging item and request placeholder when requested-song assignment fails.
- Mock-tested loading multiple normal-imaging Track Groups.

---

# BitWaves Requests — v1.5.0

## Live expected play times

- Persists the PlayIt playout item GUID when a listener request is successfully scheduled.
- Persists the last known expected start time for backward-compatible fallback.
- Public `/api/public/queue` now keeps scheduled requests visible instead of removing them immediately after allocation.
- Scheduled requests are refreshed against PlayIt’s current/next playout log so expected times move with the live log.
- Public queue exposes only `expectedPlayTime` and scheduling state; listener names, messages, IPs and PlayIt item GUIDs remain private.
- Requests disappear from the public queue when PlayIt reports the assigned item as played, skipped or deleted.
- If PlayIt is temporarily unavailable, the last known scheduled time remains visible for a short grace period.
- Existing saved request data remains compatible; the new assignment fields are optional.
- Request sweeper behaviour from v1.4.0 is unchanged.

## Validation performed

- Type-checked the modified backend against local module shims using TypeScript 5.8.
- Syntax-checked the website PHP/JavaScript companion changes.
- Mock-tested live PlayIt schedule lookup by assigned playout item GUID.

---

# BitWaves Requests — v1.4.0

## Request sweeper support

- Added optional PlayIt Track Group support for request sweepers via `REQUEST_SWEEPER_TRACK_GROUP_NAME`.
- Added optional placeholder-title setting via `REQUEST_SWEEPER_PLACEHOLDER_TRACK_NAME` (default: `Request Sweeper Placeholder`).
- REQUEST slots may now use: `REQUEST` Break Note -> silent sweeper placeholder -> normal Song.
- The silent placeholder is replaced only when a listener request is actually allocated to that slot.
- A random sweeper is selected from the configured group, avoiding the immediately previous sweeper where possible.
- Existing REQUEST slots without a placeholder remain backward-compatible and continue to process requests without a sweeper.
- Added rollback protection so a sweeper is restored to the silent placeholder if assigning the requested song fails.
- Break-note annotation failures no longer risk duplicating an already-assigned request into another slot.
- Added HTTP status validation to PlayIt Control API calls used by the request workflow.
- Added `playit-assets/Request Sweeper Placeholder.wav` and setup instructions.

## Validation performed

- Type-checked the modified backend request/sweeper modules.
- Transpiled all TypeScript/TSX source files as a syntax check.
- Ran a mocked PlayIt integration test covering placeholder detection, sweeper substitution, requested-song substitution, break-note update, and sweeper rollback on song-assignment failure.
