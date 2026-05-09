from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from services import room_manager, ffmpeg_service, ws_manager
from pathlib import Path
import os

router = APIRouter(prefix="/upload", tags=["upload"])

VIDEOS_DIR = os.getenv("VIDEOS_DIR", "/tmp/videos")
ALLOWED_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".webm"}


@router.post("/{room_id}")
async def upload_video(room_id: str, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    out_dir = Path(VIDEOS_DIR) / room_id
    out_dir.mkdir(parents=True, exist_ok=True)
    input_path = str(out_dir / f"input{ext}")

    with open(input_path, "wb") as f:
        content = await file.read()
        f.write(content)

    room_manager.set_processing(room_id)
    background_tasks.add_task(_process, room_id, input_path, str(out_dir))

    return JSONResponse({"message": "processing"})


async def _process(room_id: str, input_path: str, output_dir: str):
    success = await ffmpeg_service.convert_to_hls(input_path, output_dir)
    if success:
        stream_url = f"/stream/{room_id}/stream.m3u8"
        room_manager.set_stream_ready(room_id, stream_url)
        await ws_manager.manager.broadcast(room_id, {
            "type": "processing_done",
            "stream_url": stream_url,
        })
    else:
        await ws_manager.manager.broadcast(room_id, {
            "type": "processing_error",
            "error": "FFmpeg conversion failed",
        })
