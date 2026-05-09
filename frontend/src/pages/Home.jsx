import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, uploadVideo } from "../api/client";
import UploadProgress from "../components/UploadProgress";

export default function Home() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");

  async function handleCreate() {
    setError("");
    setCopySuccess("");

    try {
      const room = await createRoom();
      setRoomId(room.id);
      setIsModalOpen(true);
      setProgress(0);
    } catch (err) {
      console.error(err);
      setError("Unable to create a room. Please try again.");
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !roomId) return;

    setError("");
    setUploading(true);

    try {
      await uploadVideo(roomId, file, setProgress);
      navigate(`/room/${roomId}?host=true`);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again later.");
    } finally {
      setUploading(false);
    }
  }

  function handleCopyLink() {
    const shareLink = `${window.location.origin}/room/${roomId}?host=true`;
    navigator.clipboard.writeText(shareLink);
    setCopySuccess("Invite link copied!");
    window.setTimeout(() => setCopySuccess(""), 2400);
  }

  return (
    <div className="home-container">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <span className="eyebrow">Sync every watch party</span>
            <h1 className="hero-title">Bring movies and friends together in one room.</h1>
            <p className="hero-description">
              Upload videos, invite your group, and keep playback synced across every viewer with live chat and shared controls.
            </p>

            <div className="hero-actions">
              <button className="btn btn-primary" onClick={handleCreate} disabled={uploading}>
                {uploading ? "Preparing room…" : "Create watch party"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(true)}
                disabled={!roomId}
              >
                {roomId ? "Open room details" : "Create a room first"}
              </button>
            </div>

            {error && <p className="page-error">{error}</p>}
          </div>

          <div className="hero-visual">
            <div className="hero-card">
              <div className="hero-card-header">
                <span className="hero-chip">SyncFlick</span>
                <span className="hero-chip">Live viewing</span>
              </div>
              <div className="hero-preview">
                <div className="hero-preview-screen">
                  <span>▶️</span>
                </div>
              </div>
              <div className="hero-card-summary">
                <p>Fast room creation, shareable links, and synced playback so everyone sees the same moment at the same time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">Designed for shared viewing</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Invite friends</h3>
            <p>Send a room link and gather everyone in the same virtual watch space.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <h3>Perfect sync</h3>
            <p>Playback controls stay aligned for every guest in the room.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Live chat</h3>
            <p>Share reactions and commentary while the video plays.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎥</div>
            <h3>Fast upload</h3>
            <p>Upload clips quickly and start your watch party in minutes.</p>
          </div>
        </div>
      </section>

      <section className="workflows">
        <div className="workflow-card">
          <h3>Quick setup</h3>
          <p>Create a private room and share the invite link instantly.</p>
        </div>
        <div className="workflow-card">
          <h3>Smart sharing</h3>
          <p>Guests join via a simple URL and stay in sync throughout playback.</p>
        </div>
        <div className="workflow-card">
          <h3>Better experience</h3>
          <p>Combined chat, viewer status, and host controls make watch parties feel seamless.</p>
        </div>
      </section>

      {isModalOpen && roomId && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Room details</h3>
                <p className="modal-subtitle">Share the room link and upload your video whenever you're ready.</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="room-info">
                <p className="info-label">Invite link</p>
                <div className="room-id-display">
                  <code>{`${window.location.origin}/room/${roomId}?host=true`}</code>
                  <button className="copy-btn" type="button" onClick={handleCopyLink}>
                    Copy link
                  </button>
                </div>
                {copySuccess && <p className="copy-hint">{copySuccess}</p>}
              </div>

              <div className="upload-section">
                <label className="upload-label">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="file-input"
                  />
                  <div className="upload-area">
                    {uploading ? (
                      <div>
                        <p>Uploading your video now</p>
                        <UploadProgress progress={progress} />
                      </div>
                    ) : (
                      <>
                        <span className="upload-icon">📁</span>
                        <p className="upload-text">Select a video file to start streaming</p>
                        <p className="upload-hint">Supported formats include MP4, MOV, and WebM.</p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={uploading}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>&copy; 2024 SyncFlick. Watch videos together, in sync.</p>
      </footer>
    </div>
  );
}
