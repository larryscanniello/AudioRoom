# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AudioRoom is a browser-based collaborative DAW (Digital Audio Workstation) for musicians. Two users can video chat via WebRTC and record/play loop-based music together in real time with sample-accurate synchronization.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev      # Start Vite dev server
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint
npm run test     # Run all tests (vitest, node env)
```

Run a single test file:
```bash
npx vitest run tests/timelineReducer.test.ts
```

### Backend (from `backend/`)
```bash
node app.js      # Start Express server (port 3000)
# or with nodemon:
npx nodemon app.js
```

### Environment variables
Backend requires a `.env` with: `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL`, `FRONTEND_URL`, `DATABASE_URL` (PostgreSQL).
Frontend requires `VITE_BACKEND_URL`.

### Critical Vite requirement
The dev server sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers (required for `SharedArrayBuffer` and `Atomics`). Any deployment must also set these headers.

## Architecture

### Thread Model
The app runs across four threads to keep UI responsive:
1. **UI thread** — React components, `State`, `Mediator`, `AudioController`, `UIEngine`
2. **AudioWorklet thread** — `AudioProcessor.ts` (real-time DSP; playback/recording loop)
3. **Worker thread** — `opfs_worker.ts` (OPFS disk I/O, mipmap generation, Opus packet handling)
4. **Opus thread** -  `opus_worker.ts` (handles encoding / decoding of streamed audio)

### SharedArrayBuffer Ring Buffers (`src/Core/RingSAB.ts`)
Three ring buffers (1 second of audio each) connect the AudioWorklet and OPFS worker:
- `staging` — playback buffer for the staging track
- `mix` — playback buffer for the mix track (multi-track, 16 tracks by default)
- `record` — capture buffer for the recording track

The AudioWorklet and OPFS worker continuously poll these buffers using `Atomics` to avoid blocking the audio thread.

Two mipmap ring buffers (SAB's) connect the OPFS worker and main UI thread.

### Event / Observer System
`Mediator.ts` is the central hub. All state changes flow as `DispatchEvent` objects:
1. UI or controller calls `context.dispatch(SomeEvent.getDispatchEvent({...}))`.
2. `Mediator` runs a state transaction (queries + mutations) on `State`.
3. On success, it notifies all `Observer`s: `AudioEngine`, `UIEngine`, `SocketManager`, `PeerJSManager`.

Each event is a static object conforming to `EventNamespace<K>` (`src/Core/Events/EventNamespace.ts`). It declares:
- `stateTransaction` — preconditions and mutations on `State`
- `getLocalPayload` — data extracted from state for observers
- `executeAudio`, `executeUI`, `executeSocket`, `executeRTC` — per-observer side effects

New events go in `src/Core/Events/Audio/`, `Events/UI/`, etc. following existing patterns.

### Distributed State / Transactions
`State` (`src/Core/State/State.ts`) tracks two subsets:
- **reactState** — keys that trigger a React re-render when mutated
- **sharedState** — keys synced over sockets to collaborators

State changes use a transaction model (`TransactionData` = queries + mutations). The same transaction logic runs identically on the backend (`socketManager.js`) for server validation and on the frontend for optimistic updates.

### Session Construction (`src/Core/Builders/SessionBuilder.ts`)
Call chain to bootstrap a collaborative room:
```
new SessionBuilder(roomID)
  .withReact(setDawInternalState)
  .withAudEngine("worklet", { opfsFilePath, workletFilePath })
  .withMixTracks(16)
  .withSockets()
  .withPeerJSWebRTC()
  .buildRTC()   // sets up socket + WebRTC (pre-user-gesture)
  .build()      // creates AudioContext + AudioWorklet (requires user gesture)
```
`buildRTC()` must be called before `build()`. The `AudioContext` is created inside `build()` to satisfy browser autoplay policy.

### Timeline State (`src/Core/State/timelineReducer.ts`)
Timeline has two tracks:
- **staging** — active recording track (one layer, cleared on bounce)
- **mix** — immutable bounced layers (array of arrays)

`add_region` runs a shard-based algorithm to handle overlapping regions (newer recordings cut holes in older ones). `bounce_to_mix` moves staging to mix and resets staging.

### Key File Locations
| Concern | Path |
|---|---|
| Main room component | `frontend/src/Components/Room/Room.tsx` |
| DAW UI | `frontend/src/Components/Room/AudioBoard/AudioBoard.tsx` |
| AudioWorklet processor | `frontend/src/Workers/AudioProcessor.ts` |
| OPFS worker | `frontend/src/Workers/opfs_worker.ts` |
| Opus codec worker | `frontend/src/Workers/opus/opus_worker.js` |
| State container | `frontend/src/Core/State/State.ts` |
| Event types enum | `frontend/src/Core/Events/EventNamespace.ts` |
| Session bootstrap | `frontend/src/Core/Builders/SessionBuilder.ts` |
| Ring buffer utility | `frontend/src/Core/RingSAB.ts` |
| Timeline reducer | `frontend/src/Core/State/timelineReducer.ts` |
| Constants (sample rate, etc.) | `frontend/src/Constants/constants.ts` |
| Backend entry | `backend/app.js` |
| Socket/room state server | `backend/socketManager.js` |

### Backend
Express + Socket.io server. Room state is held in-memory in `roomStates` (a `Map`). The server validates transactions using the same comparitor logic as the frontend. Auth is Google OAuth via Passport.js with sessions stored in PostgreSQL (`connect-pg-simple`).

### Tests
Tests live in `frontend/tests/`. Run with `vitest` in node environment. They cover:
- `timelineReducer.test.ts` — timeline state transitions
- `RingSAB.test.ts` — ring buffer read/write
- `fillPlaybackBufferUtil.test.ts` — OPFS→ring buffer fill logic
- `opfs_worker.test.ts` — OPFS worker unit tests
- `playback-flow.integration.test.ts` — end-to-end playback data flow
