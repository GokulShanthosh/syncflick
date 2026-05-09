from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import os

router = APIRouter(prefix="/stream", tags=["stream"])

VIDEOS_DIR = os.getenv("VIDEOS_DIR", "/tmp/videos")


@router.get("/{room_id}/{filename}")
async def serve_segment(room_id: str, filename: str):
    file_path = Path(VIDEOS_DIR) / room_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    media_type = "application/vnd.apple.mpegurl" if filename.endswith(".m3u8") else "video/MP2T"
    cors_headers = {"Access-Control-Allow-Origin": "*"}
    return FileResponse(str(file_path), media_type=media_type, headers=cors_headers)
