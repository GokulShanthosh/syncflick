from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.ws_manager import manager
from services import room_manager
import uuid

router = APIRouter(tags=["websocket"])

MAX_NAME_LEN = 30
MAX_CHAT_LEN = 500


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, name: str = "Guest"):
    room = room_manager.get_room(room_id)
    if not room:
        await websocket.close(code=4004)
        return

    name = name.strip()[:MAX_NAME_LEN] or "Guest"
    client_id = uuid.uuid4().hex[:8]
    await manager.connect(room_id, client_id, websocket)

    if room["host_id"] is None:
        room["host_id"] = client_id

    room["viewers"].append({"id": client_id, "name": name})

    await manager.broadcast(room_id, {"type": "join", "user": name})
    await manager.broadcast(room_id, {
        "type": "viewer_list",
        "viewers": [v["name"] for v in room["viewers"]],
    })

    # Send current playback state to clients who join after video starts
    if room["status"] == "ready":
        ps = room["playback_state"]
        await websocket.send_json({
            "type": "sync_state",
            "time": ps["time"],
            "is_playing": ps["is_playing"],
            "stream_url": room["stream_url"],
        })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # Re-check host status dynamically — supports host reassignment
            is_host = room["host_id"] == client_id

            if msg_type in ("play", "pause", "seek") and is_host:
                t = float(data.get("time", 0.0))
                if msg_type == "play":
                    room_manager.update_playback_state(room_id, time=t, is_playing=True)
                elif msg_type == "pause":
                    room_manager.update_playback_state(room_id, time=t, is_playing=False)
                else:
                    # seek preserves current play/pause state, updates time
                    room_manager.update_playback_state(
                        room_id, time=t, is_playing=room["playback_state"]["is_playing"]
                    )
                await manager.broadcast(room_id, data, exclude=client_id)
            elif msg_type == "chat":
                if len(str(data.get("message", ""))) <= MAX_CHAT_LEN:
                    await manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        manager.disconnect(room_id, client_id)
        room["viewers"] = [v for v in room["viewers"] if v["id"] != client_id]
        await manager.broadcast(room_id, {"type": "leave", "user": name})
        await manager.broadcast(room_id, {
            "type": "viewer_list",
            "viewers": [v["name"] for v in room["viewers"]],
        })

        # Promote next connected client to host when host leaves
        if room["host_id"] == client_id:
            remaining = list(manager.rooms.get(room_id, {}).keys())
            if remaining:
                new_host_id = remaining[0]
                room["host_id"] = new_host_id
                new_host_name = next(
                    (v["name"] for v in room["viewers"] if v["id"] == new_host_id),
                    "Unknown",
                )
                await manager.broadcast(room_id, {
                    "type": "host_change",
                    "user": new_host_name,
                })
            else:
                room["host_id"] = None
