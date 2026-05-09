export default function UploadProgress({ progress }) {
  return (
    <div>
      <div style={{ background: "#eee", borderRadius: 4, overflow: "hidden", height: 8 }}>
        <div style={{ width: `${progress}%`, background: "#e50914", height: "100%", transition: "width 0.2s" }} />
      </div>
      <small>{progress < 100 ? `Uploading... ${progress}%` : "Processing video..."}</small>
    </div>
  );
}
