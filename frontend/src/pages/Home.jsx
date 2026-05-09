import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../api/client";
import UploadProgress from "../components/UploadProgress";
import { uploadVideo } from "../api/client";

export default function Home() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleCreate() {
    const room = await createRoom();
    setRoomId(room.id);
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file || !roomId) return;
    setUploading(true);
    await uploadVideo(roomId, file, setProgress);
    navigate(`/room/${roomId}?host=true`);
  }

  return (
    <div>
      <h1>SyncFlick</h1>
      <p>Watch videos together, in sync.</p>

      {!roomId ? (
        <button onClick={handleCreate}>Create Room</button>
      ) : (
        <div>
          <p>Room created: <strong>{roomId}</strong></p>
          <input type="file" accept="video/*" onChange={handleUpload} disabled={uploading} />
          {uploading && <UploadProgress progress={progress} />}
        </div>
      )}
    </div>
  );
}
