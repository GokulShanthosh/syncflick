export default function ViewerList({ viewers }) {
  return (
    <div className="viewer-card">
      <div className="viewer-header">
        <h4>Viewers</h4>
        <span className="viewer-count">{viewers.length}</span>
      </div>

      {viewers.length > 0 ? (
        <div className="viewer-list">
          {viewers.map((viewer, index) => (
            <span key={index} className="viewer-chip">
              {viewer}
            </span>
          ))}
        </div>
      ) : (
        <p className="viewer-empty">No viewers yet. Share the room link to invite people.</p>
      )}
    </div>
  );
}
