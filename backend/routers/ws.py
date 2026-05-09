from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.ws_manager import manager
from services import room_manager
import uuid

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, name: str = "Guest"):
    room = room_manager.get_room(room_id)
    if not room:
        await websocket.close(code=4004)
        return

    client_id = uuid.uuid4().hex[:8]
    await manager.connect(room_id, client_id, websocket)

    # First client becomes host
    if room["host_id"] is None:
        room["host_id"] = client_id

    is_host = room["host_id"] == client_id
    room["viewers"].append({"id": client_id, "name": name})

    await manager.broadcast(room_id, {"type": "join", "user": name})
    await manager.broadcast(room_id, {
        "type": "viewer_list",
        "viewers": [v["name"] for v in room["viewers"]],
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type in ("play", "pause", "seek") and is_host:
                await manager.broadcast(room_id, data, exclude=client_id)
            elif msg_type == "chat":
                await manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        manager.disconnect(room_id, client_id)
        room["viewers"] = [v for v in room["viewers"] if v["id"] != client_id]
        await manager.broadcast(room_id, {"type": "leave", "user": name})
        await manager.broadcast(room_id, {
            "type": "viewer_list",
            "viewers": [v["name"] for v in room["viewers"]],
        })
