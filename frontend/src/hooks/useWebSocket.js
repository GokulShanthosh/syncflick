import { useEffect, useRef, useCallback } from "react";

export default function useWebSocket(roomId, name, onMessage) {
  const wsRef = useRef(null);
  const base = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/^http/, "ws");

  useEffect(() => {
    const ws = new WebSocket(`${base}/ws/${roomId}?name=${encodeURIComponent(name)}`);
    wsRef.current = ws;
    ws.onmessage = onMessage;
    ws.onerror = (e) => console.error("WS error", e);
    return () => ws.close();
  }, [roomId, name]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
