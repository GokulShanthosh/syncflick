# Plan: WatchTogether — Full Architecture

## Summary
A watch party web app where one host uploads a video, the server converts it to HLS via FFmpeg, and up to 6 friends join a room to watch in sync with real-time chat. Backend is FastAPI + WebSockets on Render. Frontend is React + hls.js on Vercel.

## User Story
As a friend group member, I want to upload a video and share one link, so that everyone watches the same frame in real time without manual coordination.

## Problem → Solution
Friends share a file link and manually sync over Discord calls → One host uploads to WatchTogether, shares a room URL, everyone is auto-synced with live chat.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/watch-party.prd.md`
- **PRD Phase**: All phases (architecture overview)
- **Estimated Files**: 22 files

---

## Project Structure

```
watch-together/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── routers/
│   │   ├── rooms.py               # POST /rooms, GET /rooms/{id}
│   │   ├── upload.py              # POST /upload/{room_id}
│   │   ├── stream.py              # GET /stream/{room_id}/{filename}
│   │   └── ws.py                  # WS /ws/{room_id}
│   ├── models/
│   │   └── schemas.py             # Pydantic models: Room, SyncEvent, ChatMessage
│   ├── services/
│   │   ├── room_manager.py        # In-memory room store (dict)
│   │   ├── ws_manager.py          # WebSocket connection manager
│   │   └── ffmpeg_service.py      # FFmpeg HLS conversion subprocess
│   ├── requirements.txt
│   ├── render.yaml                # Render deploy config (installs FFmpeg)
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── main.jsx               # React entry point
    │   ├── App.jsx                # Router (Home → /room/:id)
    │   ├── pages/
    │   │   ├── Home.jsx           # Create room + upload video
    │   │   └── Room.jsx           # Watch room (player + chat + viewers)
    │   ├── components/
    │   │   ├── VideoPlayer.jsx    # hls.js player, fires sync events
    │   │   ├── ChatPanel.jsx      # Chat input + message list
    │   │   ├── ViewerList.jsx     # Who's in the room
    │   │   └── UploadProgress.jsx # Upload + processing progress bar
    │   ├── hooks/
    │   │   ├── useWebSocket.js    # WS connection, send/receive
    │   │   └── useSync.js         # Apply incoming sync events to player
    │   └── api/
    │       └── client.js          # Axios HTTP calls (createRoom, uploadVideo)
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── vercel.json
    └── .env.example
```

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│                                                                 │
│  ┌──────────┐    ┌──────────────────────────────────────────┐  │
│  │ Home.jsx │    │               Room.jsx                   │  │
│  │          │    │  ┌──────────────────┐  ┌──────────────┐  │  │
│  │ Create   │    │  │  VideoPlayer.jsx │  │ ChatPanel    │  │  │
│  │ Room     │    │  │  (hls.js)        │  │ .jsx         │  │  │
│  │ Upload   │    │  │                  │  │              │  │  │
│  └────┬─────┘    │  └────────┬─────────┘  └──────┬───────┘  │  │
│       │          │           │                   │          │  │
│       │          │    useSync.js           useWebSocket.js  │  │
│       │          └───────────┼───────────────────┼──────────┘  │
└───────┼────────────────────────────────────────────────────────┘
        │                      │                   │
        │ HTTP                 └─────────┬──────────┘
        │ POST /upload                   │ WebSocket /ws/{room_id}
        │ POST /rooms                    │ (play/pause/seek/chat/join/leave)
        │                               │
┌───────┼───────────────────────────────┼────────────────────────┐
│       │        BACKEND (Render)        │                        │
│  ┌────▼──────────────────┐   ┌────────▼────────────────────┐  │
│  │     routers/          │   │      routers/ws.py          │  │
│  │  rooms.py + upload.py │   │                             │  │
│  └────────────┬──────────┘   │  ws_manager.py              │  │
│               │              │  { room_id: [ws...] }       │  │
│  ┌────────────▼──────────┐   └─────────────────────────────┘  │
│  │  ffmpeg_service.py    │                                     │
│  │  MP4 → FFmpeg → HLS   │   ┌─────────────────────────────┐  │
│  └────────────┬──────────┘   │  room_manager.py             │  │
│               │              │  rooms = {}                  │  │
│  ┌────────────▼──────────┐   │  { id, host_id, status,      │  │
│  │  /tmp/videos/         │   │    stream_url, viewers }     │  │
│  │  {room_id}/           │   └─────────────────────────────┘  │
│  │    stream.m3u8        │                                     │
│  │    seg000.ts ...      │                                     │
│  └───────────────────────┘                                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Pydantic Schemas (`models/schemas.py`)

```python
from pydantic import BaseModel
from typing import Literal, Optional
from enum import Enum

class RoomStatus(str, Enum):
    waiting    = "waiting"     # room created, no video yet
    processing = "processing"  # FFmpeg running
    ready      = "ready"       # HLS ready, viewers can watch

class Room(BaseModel):
    id: str
    host_id: Optional[str] = None
    status: RoomStatus
    stream_url: Optional[str] = None  # /stream/{id}/stream.m3u8

class SyncEvent(BaseModel):
    type: Literal["play", "pause", "seek"]
    time: float              # seconds (float)

class ChatMessage(BaseModel):
    type: Literal["chat"]
    user: str
    message: str

class PresenceEvent(BaseModel):
    type: Literal["join", "leave"]
    user: str

class ProcessingUpdate(BaseModel):
    type: Literal["processing_done", "processing_error"]
    stream_url: Optional[str] = None
    error: Optional[str] = None
```

### In-Memory Room Store (`services/room_manager.py`)

```python
# rooms lives in process memory — fine for v1 single-instance deploy
rooms: dict[str, dict] = {}

# Per-room structure:
# {
#   "abc123": {
#     "id": "abc123",
#     "host_id": None,        # set to first WS client_id
#     "status": "waiting",
#     "stream_url": None,
#     "viewers": []           # list of { id: str, name: str }
#   }
# }
```

---

## WebSocket Message Protocol

```json
// CLIENT → SERVER (host fires sync; anyone sends chat/join)
{ "type": "play",  "time": 42.3 }
{ "type": "pause", "time": 42.3 }
{ "type": "seek",  "time": 120.0 }
{ "type": "chat",  "user": "Gokul", "message": "lmaooo" }
{ "type": "join",  "user": "Gokul" }

// SERVER → ALL CLIENTS (broadcast)
{ "type": "play",  "time": 42.3 }
{ "type": "pause", "time": 42.3 }
{ "type": "seek",  "time": 120.0 }
{ "type": "chat",  "user": "Gokul", "message": "lmaooo" }
{ "type": "join",  "user": "Priya" }
{ "type": "leave", "user": "Priya" }
{ "type": "processing_done",  "stream_url": "/stream/abc123/stream.m3u8" }
{ "type": "processing_error", "error": "FFmpeg failed" }
{ "type": "viewer_list",      "viewers": ["Gokul", "Priya"] }
```

---

## API Endpoints

| Method | Path | Description | Request | Response |
|--------|------|-------------|---------|----------|
| POST | `/rooms` | Create room | `{}` | `{ id, status }` |
| GET | `/rooms/{room_id}` | Get room info | — | `{ id, status, stream_url }` |
| POST | `/upload/{room_id}` | Upload video | multipart `file` | `{ message: "processing" }` |
| GET | `/stream/{room_id}/{filename}` | Serve HLS file | — | file bytes |
| WS | `/ws/{room_id}?name={username}` | Join room WS | — | bidirectional messages |

---

## FFmpeg Pipeline

```
Upload received (MP4 / MKV / AVI / MOV)
         │
         ▼
Save to /tmp/videos/{room_id}/input.mp4
         │
         ▼
Run FFmpeg in ThreadPoolExecutor (non-blocking):
  ffmpeg -i input.mp4
         -codec: copy        ← fast remux, no re-encode
         -start_number 0
         -hls_time 6         ← 6-second segments
         -hls_list_size 0    ← keep all segments
         -f hls
         /tmp/videos/{room_id}/stream.m3u8
         │
         ▼ (on success)
Broadcast → { "type": "processing_done", "stream_url": "..." }
Update room status → "ready"
         │
         ▼ (on failure — fallback)
Re-run with: -c:v libx264 -c:a aac  (for non-H264 inputs)
```

---

## WebSocket Connection Manager

```python
# services/ws_manager.py

class ConnectionManager:
    def __init__(self):
        # { room_id: { client_id: WebSocket } }
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, client_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room_id, {})[client_id] = ws

    def disconnect(self, room_id: str, client_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(client_id, None)

    async def broadcast(self, room_id: str, message: dict, exclude: str = None):
        dead = []
        for cid, ws in self.rooms.get(room_id, {}).items():
            if cid == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.disconnect(room_id, cid)
```

---

## Sync Logic (Frontend)

```javascript
// hooks/useSync.js
// Applies incoming WS events to the video element ref

export function applyEvent(videoRef, event, isHost) {
  if (isHost) return  // host drives, never applies own echoed events
  const video = videoRef.current
  if (!video) return

  if (event.type === "play")  { video.currentTime = event.time; video.play() }
  if (event.type === "pause") { video.currentTime = event.time; video.pause() }
  if (event.type === "seek")  { video.currentTime = event.time }
}

// VideoPlayer.jsx — host fires these (debounce seek by 300ms)
video.addEventListener("play",  () => ws.send({ type: "play",  time: video.currentTime }))
video.addEventListener("pause", () => ws.send({ type: "pause", time: video.currentTime }))
video.addEventListener("seeked",() => debounce(() =>
  ws.send({ type: "seek", time: video.currentTime }), 300
))
```

---

## Frontend Routes

```
/                    → Home.jsx        (create room, upload video)
/room/:roomId        → Room.jsx        (player + chat + viewers)
```

**Host detection on frontend:** The user who creates the room gets `isHost=true` stored in `sessionStorage`. Everyone who joins via URL link is a viewer.

---

## Files to Build — Phase Order

### Phase 1: Backend Core
| File | Action |
|------|--------|
| `backend/main.py` | CREATE |
| `backend/models/schemas.py` | CREATE |
| `backend/services/room_manager.py` | CREATE |
| `backend/services/ws_manager.py` | CREATE |
| `backend/routers/rooms.py` | CREATE |
| `backend/routers/ws.py` | CREATE |
| `backend/requirements.txt` | CREATE |

### Phase 2: FFmpeg Pipeline
| File | Action |
|------|--------|
| `backend/services/ffmpeg_service.py` | CREATE |
| `backend/routers/upload.py` | CREATE |
| `backend/routers/stream.py` | CREATE |
| `backend/render.yaml` | CREATE |

### Phase 3: Frontend Shell
| File | Action |
|------|--------|
| `frontend/package.json` | CREATE |
| `frontend/vite.config.js` | CREATE |
| `frontend/src/main.jsx` | CREATE |
| `frontend/src/App.jsx` | CREATE |
| `frontend/src/pages/Home.jsx` | CREATE |
| `frontend/src/pages/Room.jsx` | CREATE |
| `frontend/src/components/VideoPlayer.jsx` | CREATE |
| `frontend/src/api/client.js` | CREATE |

### Phase 4: Sync Engine
| File | Action |
|------|--------|
| `frontend/src/hooks/useWebSocket.js` | CREATE |
| `frontend/src/hooks/useSync.js` | CREATE |
| `frontend/src/components/VideoPlayer.jsx` | UPDATE — add sync event firing |
| `frontend/src/pages/Room.jsx` | UPDATE — wire useSync + useWebSocket |

### Phase 5: Chat
| File | Action |
|------|--------|
| `frontend/src/components/ChatPanel.jsx` | CREATE |
| `frontend/src/pages/Room.jsx` | UPDATE — add ChatPanel |

### Phase 6: Polish + Deploy
| File | Action |
|------|--------|
| `frontend/src/components/ViewerList.jsx` | CREATE |
| `frontend/src/components/UploadProgress.jsx` | CREATE |
| `frontend/vercel.json` | CREATE |
| `frontend/.env.example` | CREATE |
| `backend/.env.example` | CREATE |

---

## Environment Variables

### Backend `.env.example`
```
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
MAX_FILE_SIZE_MB=2048
VIDEOS_DIR=/tmp/videos
```

### Frontend `.env.example`
```
VITE_BACKEND_URL=https://your-app.onrender.com
```

---

## Render Deploy (`render.yaml`)

```yaml
services:
  - type: web
    name: watch-together-api
    env: python
    buildCommand: |
      apt-get update && apt-get install -y ffmpeg
      pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: CORS_ORIGINS
        sync: false
```

---

## Validation Checklist

- [ ] Phase 1: Two tabs connect to same WS room and exchange a message
- [ ] Phase 2: Upload MP4 → `/stream/{id}/stream.m3u8` plays in browser
- [ ] Phase 3: Home page creates room, redirects to `/room/{id}`, player loads
- [ ] Phase 4: Host pauses → both tabs pause within 1s
- [ ] Phase 5: Chat message in tab 1 appears in tab 2 within 500ms
- [ ] Phase 6: Vercel URL shared with a friend — full session works

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FFmpeg `-codec: copy` fails on non-H264 | M | H | Fallback to `-c:v libx264 -c:a aac` |
| Render ephemeral disk wipes files | L | H | Check file existence; prompt re-upload |
| Large upload times out | M | H | Chunk upload; background FFmpeg task |
| hls.js CORS error on segments | M | M | Set `Access-Control-Allow-Origin` on `/stream/` |
| Sync drift on reconnect | M | M | On join, server sends current host time |

---

*Generated: 2026-05-09*
*Source PRD: .claude/PRPs/prds/watch-party.prd.md*
*Status: READY TO IMPLEMENT*
