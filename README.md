# SyncFlick

Watch videos together, in perfect sync. Upload a video, share a room link, and your friends join — everyone sees the same frame with live chat alongside.

---

## What It Does

- **Host** uploads any video file (MP4, MKV, AVI, MOV)
- Server converts it to HLS using FFmpeg (fast remux, no re-encode)
- **Friends** join via a shareable room link — no account needed
- Play, pause, and seek controls sync to all viewers in real time
- Live chat panel runs alongside the video

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + WebSockets |
| Video processing | FFmpeg (HLS) |
| Frontend | React + Vite + hls.js |
| Deploy backend | Render |
| Deploy frontend | Vercel |

---

## Project Structure

```
syncflick/
├── backend/
│   ├── main.py                  # FastAPI app entry
│   ├── routers/
│   │   ├── rooms.py             # POST /rooms, GET /rooms/{id}
│   │   ├── upload.py            # POST /upload/{room_id}
│   │   ├── stream.py            # GET /stream/{room_id}/{file}
│   │   └── ws.py                # WS /ws/{room_id}
│   ├── models/
│   │   └── schemas.py           # Pydantic models
│   ├── services/
│   │   ├── room_manager.py      # In-memory room store
│   │   ├── ws_manager.py        # WebSocket connection manager
│   │   └── ffmpeg_service.py    # FFmpeg HLS conversion
│   ├── requirements.txt
│   ├── render.yaml              # Render deploy config
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Home.jsx         # Create room + upload
    │   │   └── Room.jsx         # Watch + chat
    │   ├── components/
    │   │   ├── VideoPlayer.jsx  # hls.js player
    │   │   ├── ChatPanel.jsx    # Real-time chat
    │   │   ├── ViewerList.jsx   # Who's watching
    │   │   └── UploadProgress.jsx
    │   ├── hooks/
    │   │   ├── useWebSocket.js  # WS connection
    │   │   └── useSync.js       # Apply sync events
    │   └── api/
    │       └── client.js        # HTTP + upload calls
    ├── package.json
    ├── vite.config.js
    └── vercel.json
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- FFmpeg installed (`ffmpeg -version` should work)

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env and configure
cp .env.example .env

# Run
uvicorn main:app --reload --port 8000
```

API will be at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env and configure
cp .env.example .env

# Run
npm run dev
```

App will be at `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `VIDEOS_DIR` | `/tmp/videos` | Where HLS files are stored |
| `MAX_FILE_SIZE_MB` | `2048` | Max upload size in MB |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_BACKEND_URL` | Backend URL (empty = same origin in prod) |

---

## WebSocket Protocol

All real-time communication goes through `WS /ws/{room_id}?name={username}`.

### Message Types

```json
// Playback sync (host → all viewers)
{ "type": "play",  "time": 42.3 }
{ "type": "pause", "time": 42.3 }
{ "type": "seek",  "time": 120.0 }

// Chat (anyone → everyone)
{ "type": "chat", "user": "Gokul", "message": "lmaooo" }

// Presence (server → all)
{ "type": "join",  "user": "Priya" }
{ "type": "leave", "user": "Priya" }
{ "type": "viewer_list", "viewers": ["Gokul", "Priya"] }

// Video ready (server → all, after FFmpeg finishes)
{ "type": "processing_done",  "stream_url": "/stream/abc123/stream.m3u8" }
{ "type": "processing_error", "error": "FFmpeg conversion failed" }
```

---

## Deployment

### Backend — Render

1. Push code to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your GitHub repo, set root directory to `backend/`
4. Render picks up `render.yaml` automatically (installs FFmpeg + Python deps)
5. Add env var `CORS_ORIGINS` = your Vercel frontend URL

### Frontend — Vercel

1. Create a new project on [vercel.com](https://vercel.com)
2. Connect your GitHub repo, set root directory to `frontend/`
3. Add env var `VITE_BACKEND_URL` = your Render backend URL
4. Deploy — `vercel.json` handles SPA routing

---

## How Sync Works

```
Host presses Play
    │
    ▼
VideoPlayer.jsx fires { type: "play", time: 42.3 } over WebSocket
    │
    ▼
Server (ws.py) broadcasts to all clients in the room
    │
    ▼
useSync.js on each viewer applies: video.currentTime = 42.3; video.play()
```

Only the host can fire sync events. Viewers receive and apply them but cannot trigger them.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/rooms` | Create a new room |
| `GET` | `/rooms/{id}` | Get room info |
| `POST` | `/upload/{room_id}` | Upload video file |
| `GET` | `/stream/{room_id}/{filename}` | Serve HLS segments |
| `WS` | `/ws/{room_id}?name=` | Join room WebSocket |

Full interactive docs: `http://localhost:8000/docs`

---

## Known Limitations (v1)

- **Ephemeral storage** — video files on Render are lost on redeploy. Rooms are session-scoped.
- **Single instance** — in-memory room store; WebSocket connections don't survive horizontal scaling.
- **No auth** — room link is the only access control.
- **Max ~6 concurrent viewers** — designed for friend groups, not large audiences.

---

## Contributing

Frontend is open for collaboration. Clone the repo, branch off `main`, and open a PR.

```bash
git clone https://github.com/your-username/syncflick.git
cd syncflick/frontend
npm install
npm run dev
```

---

## License

MIT
