import { useCallback } from "react";

export default function useSync(videoRef, isHost) {
  const applySync = useCallback((event) => {
    if (isHost) return;
    const video = videoRef.current;
    if (!video) return;

    if (event.type === "play")  { video.currentTime = event.time; video.play(); }
    if (event.type === "pause") { video.currentTime = event.time; video.pause(); }
    if (event.type === "seek")  { video.currentTime = event.time; }
  }, [isHost, videoRef]);

  return { applySync };
}
