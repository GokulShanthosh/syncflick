from fastapi import WebSocket


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

    def count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, {}))


manager = ConnectionManager()
