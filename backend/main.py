from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import rooms, upload, stream, ws
import os

app = FastAPI(title="SyncFlick API")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(upload.router)
app.include_router(stream.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
