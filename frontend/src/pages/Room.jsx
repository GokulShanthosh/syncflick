import { useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import VideoPlayer from "../components/VideoPlayer";
import ChatPanel from "../components/ChatPanel";
import ViewerList from "../components/ViewerList";
import useWebSocket from "../hooks/useWebSocket";
import useSync from "../hooks/useSync";

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get("host") === "true";
  const name = searchParams.get("name") || (isHost ? "Host" : "Guest");
  const [streamUrl, setStreamUrl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [copySuccess, setCopySuccess] = useState("");

  const videoRef = useRef(null);

  const shareLink = useMemo(() => {
    return `${window.location.origin}/room/${roomId}`;
  }, [roomId]);

  function onMessage(event) {
    const data = JSON.parse(event.data);

    if (data.type === "processing_done") {
      setStreamUrl(data.stream_url);
    }

    if (data.type === "chat") {
      setMessages((current) => [...current, data]);
    }

    if (data.type === "viewer_list") {
      setViewers(data.viewers);
    }

    if (["play", "pause", "seek"].includes(data.type)) {
      applySync(data);
    }
  }

  const { send } = useWebSocket(roomId, name, onMessage);
  const { applySync } = useSync(videoRef, isHost);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopySuccess("Invite link copied!");
    window.setTimeout(() => setCopySuccess(""), 2400);
  };

  return (
    <div className="room-page">
      <div className="room-banner">
        <div>
          <p className="eyebrow">Room #{roomId}</p>
          <h1 className="room-title">Your synchronized watch party</h1>
        </div>
        <button className="btn btn-secondary" onClick={handleCopyLink}>
          Copy invite link
        </button>
      </div>

      <div className="room-grid">
        <main className="room-main">
          <section className="room-player-card">
            <div className="room-header">
              <div>
                <h2>Room #{roomId}</h2>
                <p className="room-details">You are watching as {name}.</p>
              </div>
              <span className="room-chip">{isHost ? "Host" : "Guest"}</span>
            </div>

            <div className="room-meta-grid">
              <span className="room-status-chip">{streamUrl ? "Video ready" : "Waiting for upload"}</span>
              <span className="room-status-chip">{viewers.length} viewer{viewers.length === 1 ? "" : "s"}</span>
            </div>

            <VideoPlayer
              videoRef={videoRef}
              streamUrl={streamUrl}
              isHost={isHost}
              onSyncEvent={send}
            />

            <p className="room-footnote">
              {streamUrl
                ? "Playback is synced for everyone in the room."
                : "The host's uploaded video will appear here once processing completes."}
            </p>
          </section>

          <ViewerList viewers={viewers} />
        </main>

        <aside className="room-sidebar">
          <section className="room-share-card">
            <div className="room-share-header">
              <h4>Share this room</h4>
              <p className="room-share-note">Send this link to anyone you want to join.</p>
            </div>
            <div className="room-id-display">
              <code>{shareLink}</code>
              <button className="copy-btn" type="button" onClick={handleCopyLink}>
                Copy
              </button>
            </div>
            {copySuccess && <p className="copy-hint">{copySuccess}</p>}
          </section>

          <ChatPanel
            messages={messages}
            onSend={(msg) => send({ type: "chat", user: name, message: msg })}
          />
        </aside>
      </div>
    </div>
  );
}
