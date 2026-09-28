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
