import asyncio
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

executor = ThreadPoolExecutor(max_workers=2)


def _run_ffmpeg(input_path: str, output_dir: str) -> bool:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    playlist = str(out / "stream.m3u8")

    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-codec:", "copy",
        "-start_number", "0",
        "-hls_time", "6",
        "-hls_list_size", "0",
        "-f", "hls", playlist,
    ]
    result = subprocess.run(cmd, capture_output=True)

    if result.returncode != 0:
        # Fallback: re-encode for non-H264 inputs
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libx264", "-c:a", "aac",
            "-start_number", "0",
            "-hls_time", "6",
            "-hls_list_size", "0",
            "-f", "hls", playlist,
        ]
        result = subprocess.run(cmd, capture_output=True)

    return result.returncode == 0


async def convert_to_hls(input_path: str, output_dir: str) -> bool:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _run_ffmpeg, input_path, output_dir)
