export default function TimelineTodayIndicator({ mode, show, left }) {
  if (!show) return null;

  if (mode === "header") {
    return (
      <span
        className="timeline-today-header-dot"
        aria-hidden="true"
        style={{ left }}
      />
    );
  }

  return (
    <span
      className="timeline-today-line"
      aria-hidden="true"
      style={{ left }}
    />
  );
}
