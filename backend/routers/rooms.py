from fastapi import APIRouter, HTTPException
from services import room_manager

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("")
def create_room():
    room = room_manager.create_room()
    return {"id": room["id"], "status": room["status"]}


@router.get("/{room_id}")
def get_room(room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room
