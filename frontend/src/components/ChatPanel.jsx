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
    <div className="chat-panel">
      <div className="chat-header">
        <div>
          <h3>Chat</h3>
          <p className="chat-subtitle">Send messages that everyone in the room can see.</p>
        </div>
      </div>

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length > 0 ? (
          messages.map((m, i) => (
            <div key={i} className="chat-message">
              <span className="chat-message-author">{m.user}</span>
              <span className="chat-message-text">{m.message}</span>
            </div>
          ))
        ) : (
          <div className="chat-empty">No messages yet. Start the conversation.</div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="chat-form">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          aria-label="Type your message"
          className="chat-input"
        />
        <button type="submit" className="chat-send-button">
          Send
        </button>
      </form>
    </div>
  );
}
