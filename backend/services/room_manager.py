from datetime import datetime
import uuid

# In-memory store — { room_id: room_dict }
rooms: dict[str, dict] = {}


def create_room() -> dict:
    room_id = uuid.uuid4().hex[:8]
    room = {
        "id": room_id,
        "host_id": None,
        "status": "waiting",
        "stream_url": None,
        "viewers": [],
        "created_at": datetime.utcnow().isoformat(),
        "playback_state": {"time": 0.0, "is_playing": False},
    }
    rooms[room_id] = room
    return room


def get_room(room_id: str) -> dict | None:
    return rooms.get(room_id)


def set_stream_ready(room_id: str, stream_url: str):
    if room_id in rooms:
        rooms[room_id]["status"] = "ready"
        rooms[room_id]["stream_url"] = stream_url


def set_processing(room_id: str):
    if room_id in rooms:
        rooms[room_id]["status"] = "processing"


def update_playback_state(room_id: str, time: float, is_playing: bool):
    if room_id in rooms:
        rooms[room_id]["playback_state"] = {"time": time, "is_playing": is_playing}
