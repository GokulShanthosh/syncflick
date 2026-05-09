export default function ViewerList({ viewers }) {
  if (!viewers.length) return null;
  return (
    <div>
      <small>{viewers.length} watching: {viewers.join(", ")}</small>
    </div>
  );
}
