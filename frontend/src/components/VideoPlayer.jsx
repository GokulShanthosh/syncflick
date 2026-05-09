import { useEffect } from "react";
import Hls from "hls.js";

export default function VideoPlayer({ videoRef, streamUrl, isHost, onSyncEvent }) {
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
    }
  }, [streamUrl]);

  useEffect(() => {
    if (!isHost || !videoRef.current) return;
    const video = videoRef.current;

    let seekTimer;
    const onPlay  = () => onSyncEvent({ type: "play",  time: video.currentTime });
    const onPause = () => onSyncEvent({ type: "pause", time: video.currentTime });
    const onSeeked = () => {
      clearTimeout(seekTimer);
      seekTimer = setTimeout(() => onSyncEvent({ type: "seek", time: video.currentTime }), 300);
    };

    video.addEventListener("play",  onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("play",  onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [isHost, streamUrl]);

  return (
    <div>
      {!streamUrl && <p>Waiting for video to process...</p>}
      <video
        ref={videoRef}
        controls={isHost}
        style={{ width: "100%", background: "#000" }}
      />
    </div>
  );
}
