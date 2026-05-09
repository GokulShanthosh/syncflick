from pydantic import BaseModel
from typing import Literal, Optional
from enum import Enum


class RoomStatus(str, Enum):
    waiting = "waiting"
    processing = "processing"
    ready = "ready"


class Room(BaseModel):
    id: str
    host_id: Optional[str] = None
    status: RoomStatus
    stream_url: Optional[str] = None


class SyncEvent(BaseModel):
    type: Literal["play", "pause", "seek"]
    time: float


class ChatMessage(BaseModel):
    type: Literal["chat"]
    user: str
    message: str


class PresenceEvent(BaseModel):
    type: Literal["join", "leave"]
    user: str
