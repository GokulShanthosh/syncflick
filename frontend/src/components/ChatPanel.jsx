import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages, onSend }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div style={{ width: 280, display: "flex", flexDirection: "column", height: "80vh" }}>
      <h3>Chat</h3>
      <div style={{ flex: 1, overflowY: "auto", border: "1px solid #ccc", padding: 8 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.user}:</strong> {m.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 4, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          style={{ flex: 1 }}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
