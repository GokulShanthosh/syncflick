# WatchTogether — Synchronized Watch Party App

## Problem Statement

Friend groups who want to watch the same video together remotely have no simple way to do so with their own video files. Existing solutions (Teleparty, Netflix Party) require everyone to have the same streaming subscription. There is no dead-simple tool where one person uploads a video, shares a room link, and everyone watches in perfect sync with live chat.

## Evidence

- Teleparty requires Netflix/Disney+/HBO subscription on every device
- No mainstream tool supports user-uploaded video files for group watching
- Assumption: friend groups frequently share files via cloud drives and watch separately — this is the gap

## Proposed Solution

A web app where a host uploads a video file, the server converts it to HLS via FFmpeg and streams it, and friends join via a room link. All playback events (play, pause, seek) are broadcast over WebSocket so every client stays in sync. A chat panel runs on the same WebSocket connection alongside the video.

## Key Hypothesis

We believe synchronized video playback with real-time chat will let small friend groups (2–6 people) watch uploaded videos together remotely in a way that feels like being in the same room. We'll know we're right when a group can watch a full video with zero manual re-sync interventions.

## What We're NOT Building

- User accounts / authentication — room links are the access control
- Persistent video storage — files are temporary, rooms expire after the session
- Mobile native apps — web-only for now
- Multi-host control — only the host can play/pause/seek
- Video DRM or piracy prevention — out of scope
- Reactions/emoji overlay — nice to have, not tonight

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Sync drift between clients | < 2 seconds | Manual test with two browser tabs |
| Video starts playing | < 30s after upload | Stopwatch from upload click |
| Chat message delivery | < 500ms | Manual test |
| Concurrent viewers per room | 6 users | Load test with multiple tabs |

## Open Questions

- [ ] Max video file size limit? (suggest 2GB for tonight)
- [ ] Should host be able to re-upload mid-session?
- [ ] What happens when host disconnects? Room dies or video pauses?
- [ ] Do we need a waiting room / lobby before video starts?

---

## Users & Context

**Primary User**
- **Who**: College students or young adults in a friend group, all remote
- **Current behavior**: Share a Google Drive/Telegram link, everyone downloads, then use Discord call to manually sync ("3... 2... 1... play")
- **Trigger**: "Hey let's watch this movie tonight" message in a group chat
- **Success state**: One link shared, everyone watching the same frame with zero coordination overhead

**Job to Be Done**
When my friend group wants to watch a video together remotely, I want to share one link and have everyone automatically in sync, so I can focus on having fun instead of managing playback coordination.

**Non-Users**
- Solo viewers — no need for sync
- Large audiences (50+) — this is for small friend groups only
- Enterprise / corporate use — wrong product entirely

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Video upload + HLS conversion | Core — without this nothing works |
| Must | Room creation with shareable link | Entry point for all users |
| Must | Synchronized play/pause/seek | The whole point of the product |
| Must | Real-time chat | The "fun" part, companion to video |
| Should | Viewer list (who's in the room) | Social presence, basic feature |
| Should | Host-only playback controls | Prevents chaos |
| Could | Emoji reactions overlay | Fun, low priority |
| Could | Room expiry / cleanup | Server hygiene |
| Won't | User accounts | Adds complexity, not needed for v1 |
| Won't | Video library / history | Out of scope |

### MVP Scope

Host uploads video → server converts to HLS → host shares room URL → friends join → synchronized playback + chat. That's it.

### User Flow

```
Host:
  1. Open app → click "Create Room"
  2. Upload video file
  3. Wait for processing (progress bar)
  4. Room ready → share URL with friends
  5. Press play → everyone watches together

Friend:
  1. Click shared URL
  2. Enter name (no account needed)
  3. See video (buffered, waiting for host)
  4. Host presses play → video starts in sync
  5. Chat alongside
```

---

## Technical Approach

**Feasibility**: HIGH

### Architecture

```
Frontend (React + hls.js + Vercel)
    │
    ├── HTTP POST /upload          → Upload video file
    ├── GET /rooms/{id}/stream     → HLS playlist (.m3u8)
    └── WS  /ws/{room_id}         → Sync events + chat

Backend (FastAPI + Render)
    │
    ├── /upload                   → Save file, run FFmpeg → HLS segments
    ├── /rooms                    → Create/get room
    ├── /stream/{room_id}         → Serve HLS segments (static files)
    └── WebSocket /ws/{room_id}   → Broadcast play/pause/seek/chat
```

### WebSocket Message Protocol

```json
// Playback sync (host → server → all clients)
{ "type": "play",  "time": 42.3 }
{ "type": "pause", "time": 42.3 }
{ "type": "seek",  "time": 120.0 }

// Chat
{ "type": "chat", "user": "Gokul", "message": "lmaooo" }

// Presence
{ "type": "join", "user": "Priya" }
{ "type": "leave", "user": "Priya" }
```

### Key Technical Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Video format | HLS via FFmpeg | Direct MP4 serve, DASH | HLS works in all browsers, seekable, streamable |
| WebSocket library | FastAPI native (`websockets`) | Socket.IO, Redis pub/sub | Zero extra deps, sufficient for 6 users |
| File storage | Render local disk (`/tmp/videos`) | S3 | Simpler for tonight, no AWS setup |
| Frontend video player | `hls.js` | Video.js, Plyr | Lightweight, direct HLS control |
| Room IDs | `uuid4` short code | Nanoid | Built-in Python, no extra dep |

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FFmpeg not on Render | M | Use `render.yaml` to install via apt |
| Large file upload timeout | M | Stream upload in chunks, show progress |
| Sync drift on slow connections | M | Client sends local time, server computes delta |
| Render disk ephemeral | L | Acceptable for v1 — files are session-scoped |
| Multiple host events fired | L | Debounce seek events on frontend |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Backend Core | FastAPI app, room model, WebSocket manager, file upload endpoint | pending | - | - | - |
| 2 | FFmpeg Pipeline | Upload → FFmpeg HLS conversion → serve segments | pending | - | 1 | - |
| 3 | Frontend Shell | React app, room create/join UI, video player with hls.js | pending | with 2 | 1 | - |
| 4 | Sync Engine | WebSocket sync: play/pause/seek broadcast + client apply | pending | - | 2, 3 | - |
| 5 | Chat | Chat UI + WebSocket chat messages | pending | with 4 | 3 | - |
| 6 | Polish + Deploy | Viewer list, loading states, error states, deploy Render + Vercel | pending | - | 4, 5 | - |

### Phase Details

**Phase 1: Backend Core**
- Goal: Runnable FastAPI server with room management and WebSocket infrastructure
- Scope: `POST /rooms`, `GET /rooms/{id}`, WebSocket connection manager, in-memory room store
- Success signal: Two clients can connect to the same room via WebSocket and exchange messages

**Phase 2: FFmpeg Pipeline**
- Goal: Upload a video, convert to HLS, serve the stream
- Scope: `POST /upload`, background FFmpeg task, `GET /stream/{room_id}/{file}` static file serve
- Success signal: Upload an MP4, get back a working `.m3u8` URL that plays in browser

**Phase 3: Frontend Shell**
- Goal: React app with create/join room flow and video player
- Scope: Home page (create room), room page (hls.js player + chat panel layout), WebSocket hook
- Success signal: Join a room URL, see the video player load the HLS stream

**Phase 4: Sync Engine**
- Goal: Host play/pause/seek controls sync to all clients in real time
- Scope: Intercept host player events → send WS message → all other clients apply the event
- Success signal: Two tabs open, host presses pause, both pause within 1 second

**Phase 5: Chat**
- Goal: Real-time chat panel alongside video
- Scope: Chat input, message list, username prompt on join, chat WS messages
- Success signal: Send a message in one tab, see it appear in another within 500ms

**Phase 6: Polish + Deploy**
- Goal: Shippable, deployed app
- Scope: Viewer list, upload progress bar, error states, `render.yaml`, `vercel.json`, env vars
- Success signal: Share the Vercel URL with a friend and have a working session

### Parallelism Notes

- Phase 2 (FFmpeg) and Phase 3 (Frontend Shell) can run in parallel after Phase 1 is done
- Phase 5 (Chat) can run in parallel with Phase 4 (Sync) — separate WS message types, independent UI

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Backend language | FastAPI (Python) | Node.js, Go | User knows Python, same stack as vibe-check |
| Video streaming | HLS | Direct MP4, WebRTC | Browser-native, seekable, no plugin needed |
| Auth | None (room link = access) | JWT, OAuth | Overkill for a friend group tool |
| Storage | Ephemeral local disk | S3, Cloudflare R2 | No cloud setup needed for v1 |
| Deploy | Render + Vercel | Railway, Fly.io | Same stack user already knows |

---

*Generated: 2026-05-09*
*Status: DRAFT*
