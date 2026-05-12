# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project: SyncFlick

A synchronized video watch-party app. The host uploads a video, the server transcodes it to HLS with FFmpeg, and viewers join via a shareable room link. Playback (play/pause/seek) and live chat are synchronized over WebSockets.

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, Uvicorn, WebSockets, python-multipart, aiofiles, python-dotenv |
| Video | FFmpeg (remux to HLS, no re-encode) |
| Frontend | React 18, Vite 5, React Router 6, hls.js, axios |
| Deploy | Backend on Render (`render.yaml`), frontend on Vercel (`vercel.json`) |
| Python | 3.11+ (see `backend/runtime.txt`) |
| Node | 18+ |

## Repository Layout

```
syncflick/
├── backend/
│   ├── main.py                   # FastAPI app, CORS, router includes, /health
│   ├── routers/
│   │   ├── rooms.py              # POST /rooms, GET /rooms/{id}
│   │   ├── upload.py             # POST /upload/{room_id} → background HLS transcode
│   │   ├── stream.py             # GET /stream/{room_id}/{file} → HLS segments
│   │   └── ws.py                 # WS /ws/{room_id}?name= → sync + chat + presence
│   ├── services/
│   │   ├── room_manager.py       # In-memory rooms dict (id, host_id, status, viewers, playback_state)
│   │   ├── ws_manager.py         # Connection registry + broadcast()
│   │   └── ffmpeg_service.py     # async HLS conversion
│   ├── models/schemas.py         # Pydantic DTOs
│   ├── requirements.txt
│   ├── render.yaml
│   └── runtime.txt
└── frontend/
    ├── src/
    │   ├── pages/                # Home.jsx, Room.jsx
    │   ├── components/           # VideoPlayer, ChatPanel, ViewerList, UploadProgress
    │   ├── hooks/                # useWebSocket, useSync
    │   └── api/client.js
    ├── vite.config.js
    └── vercel.json
```

## Common Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Docs: http://localhost:8000/docs
# Health: http://localhost:8000/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build
npm run preview
```

### Prerequisite
`ffmpeg -version` must work on the host running the backend.

## Environment Variables

### Backend (`backend/.env`)
| Var | Default | Purpose |
|-----|---------|---------|
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `VIDEOS_DIR` | `/tmp/videos` | HLS output directory (use a writable absolute path on Windows, e.g. `C:/tmp/videos`) |
| `MAX_FILE_SIZE_MB` | `2048` | Upload cap |

### Frontend (`frontend/.env`)
| Var | Purpose |
|-----|---------|
| `VITE_BACKEND_URL` | Backend base URL (empty = same origin in prod) |

## WebSocket Protocol

`WS /ws/{room_id}?name={username}` — see `backend/routers/ws.py`.

```jsonc
// Host → server (server rebroadcasts to others)
{ "type": "play",  "time": 42.3 }
{ "type": "pause", "time": 42.3 }
{ "type": "seek",  "time": 120.0 }

// Anyone → everyone (chat capped at 500 chars)
{ "type": "chat", "user": "Gokul", "message": "lmaooo" }

// Server → client
{ "type": "join"  | "leave",        "user": "..." }
{ "type": "viewer_list",            "viewers": ["..."] }
{ "type": "host_change",            "user": "..." }
{ "type": "processing_done"  | "processing_error", "stream_url"?: "...", "error"?: "..." }
{ "type": "sync_state", "time": 12.0, "is_playing": true, "stream_url": "..." }  // sent on late-join
```

### Sync Invariants (don't break these)
- Only the current `host_id` may emit `play`/`pause`/`seek`. Non-host messages are dropped.
- Sync events are broadcast with `exclude=client_id` so the sender does not echo itself.
- When the host disconnects, the next connected client is promoted; clients are notified via `host_change`.
- Late joiners receive a `sync_state` snapshot when `room.status == "ready"`.
- `name` is trimmed and capped at 30 chars; chat messages at 500 chars.

## Architecture Notes for Edits

- **State is in-memory** (`services/room_manager.py`). Single-instance only — do not introduce horizontal scaling without moving rooms + ws connections to Redis or similar.
- **Uploads are buffered fully into memory** (`await file.read()` in `routers/upload.py`) before size check. For files near `MAX_FILE_SIZE_MB`, this is a memory hit — see Future Improvements.
- **FFmpeg runs as a background task** via `BackgroundTasks`. The upload response returns immediately with `{"message": "processing"}`; clients learn completion via the `processing_done` WS message.
- **HLS files are served via FileResponse** with permissive `Access-Control-Allow-Origin: *` on the `/stream/...` endpoint — needed for hls.js cross-origin playback.
- **Render uses ephemeral storage**: `/tmp/videos` is wiped on redeploy. Rooms are session-scoped by design.

## Coding Standards (project-specific)

Follow the global Python + Web rules already loaded. Highlights that matter here:

- Python: PEP 8, type annotations on all signatures, `black` / `ruff` / `isort`. Use `logging` not `print`.
- Pydantic models go in `backend/models/schemas.py`.
- Keep files focused: <800 lines, functions <50 lines.
- React: PascalCase components, `use` prefix for hooks, kebab-case CSS classes.
- Don't hardcode the backend URL on the frontend — read `import.meta.env.VITE_BACKEND_URL`.
- WebSocket messages: always include a `type` field; new types must be documented in this file and in the README.

## Known Limitations (v1)

- Ephemeral storage; rooms don't survive backend restart.
- Single-instance only (in-memory state, no shared pub/sub).
- No auth — the room ID is the only access control.
- ~6 concurrent viewers comfortably; not built for large audiences.
- Whole-file in-memory upload buffering.
- No automated tests yet.

## Future Improvements

### Reliability & Scale
- **Stream uploads to disk** with `aiofiles` and check size during read instead of `await file.read()`. Removes the per-upload memory spike.
- **Persist rooms in Redis** (or Postgres) so backend restarts and horizontal scaling work. Migrate `room_manager.py` behind a repository interface first, then swap the implementation.
- **Pub/sub for WebSockets** (Redis pub/sub or NATS) so multiple backend instances can broadcast across the same room.
- **Object storage for HLS output** (S3/R2/Backblaze) instead of `/tmp/videos`. Render's ephemeral disk is the current single biggest fragility.
- **Resumable uploads** (tus protocol or chunked multipart) for large files on flaky connections.

### Sync Quality
- **Drift correction**: viewers periodically report `currentTime` and the server nudges them if they drift >0.5s from the host. Today, sync only happens on host events.
- **Latency-aware seek**: pad the broadcast `time` with measured per-client RTT so all viewers land on the same frame.
- **Buffer/ready coordination**: pause everyone until all viewers report `canplay` after a seek.

### Features
- **Auth** (anonymous host token + optional room password) so room IDs aren't the sole gate.
- **Reactions** (emoji bursts over WS) — cheap to add on top of the chat channel.
- **Subtitle track support** (VTT sidecar in HLS playlist).
- **Adaptive bitrate**: today FFmpeg does a single-rendition remux; add 480p/720p/1080p variants for low-bandwidth viewers (trades fast remux for re-encode time).
- **Room expiry / cleanup job** to delete `/tmp/videos/{room_id}` after N hours of inactivity.

### Developer Experience
- **Pytest suite** for routers (use `httpx.AsyncClient`) and `pytest-asyncio` for WS tests. Target 80% as per project rules — currently 0%.
- **Frontend tests** with Vitest + React Testing Library for `useSync` and `useWebSocket`. Playwright E2E for the host-uploads-then-two-viewers-sync flow.
- **Type checking**: add `mypy` (backend) and consider TypeScript migration on the frontend — at minimum, `tsc --noEmit` on JSDoc-typed hooks.
- **CI**: GitHub Actions running ruff, mypy, pytest, npm build, and a Playwright smoke test before deploy.
- **Structured logging** (`structlog` or stdlib `logging` with JSON formatter) instead of implicit print/uvicorn defaults.
- **Pre-commit hooks**: black, ruff, isort, eslint, prettier.

### Security
- **CORS hardening**: `/stream/...` currently returns `Access-Control-Allow-Origin: *`. Echo a configured origin instead once hls.js requirements are confirmed.
- **Filename validation in `stream.py`**: `Path(VIDEOS_DIR) / room_id / filename` should reject `..` and absolute paths defensively even though FastAPI path params don't include slashes.
- **Rate limiting** on `POST /upload/{room_id}` and `POST /rooms` (slowapi or a reverse-proxy layer).
- **Content-Type validation** in addition to extension allowlist; verify with magic bytes before invoking FFmpeg.
- **CSP** on the frontend (`vercel.json` headers).

### Observability
- `/metrics` endpoint (Prometheus) for active rooms, viewers, upload bytes, FFmpeg duration.
- Sentry (or equivalent) on both frontend and backend.

## When Working in This Repo

- After backend changes, run `uvicorn main:app --reload` and hit `/docs` + `/health` to sanity-check.
- After frontend changes, run `npm run dev` and manually verify the host/viewer flow in two browser windows before claiming done.
- Don't add features that assume persistent storage or multi-instance state without first introducing the repository/pub-sub seam described above.
- Don't widen the WS protocol without updating both this file and `README.md`.
