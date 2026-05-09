import { useParams, useSearchParams } from "react-router-dom";
import VideoPlayer from "../components/VideoPlayer";
import ChatPanel from "../components/ChatPanel";
import ViewerList from "../components/ViewerList";
import useWebSocket from "../hooks/useWebSocket";
import useSync from "../hooks/useSync";
import { useRef, useState } from "react";

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get("host") === "true";
  const name = searchParams.get("name") || (isHost ? "Host" : "Guest");

  const videoRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [viewers, setViewers] = useState([]);

  function onMessage(event) {
    const data = JSON.parse(event.data);

    if (data.type === "processing_done") setStreamUrl(data.stream_url);
    if (data.type === "chat") setMessages((m) => [...m, data]);
    if (data.type === "viewer_list") setViewers(data.viewers);
    if (["play", "pause", "seek"].includes(data.type)) applySync(data);
  }

  const { send } = useWebSocket(roomId, name, onMessage);
  const { applySync } = useSync(videoRef, isHost);

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <VideoPlayer
          videoRef={videoRef}
          streamUrl={streamUrl}
          isHost={isHost}
          onSyncEvent={send}
        />
        <ViewerList viewers={viewers} />
      </div>
      <ChatPanel messages={messages} onSend={(msg) => send({ type: "chat", user: name, message: msg })} />
    </div>
  );
}
