export default function UploadProgress({ progress }) {
  return (
    <div className="upload-progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <small className="progress-label">
        {progress < 100 ? `Uploading... ${progress}%` : "Processing video..."}
      </small>
    </div>
  );
}
