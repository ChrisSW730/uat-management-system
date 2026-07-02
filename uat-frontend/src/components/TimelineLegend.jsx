export default function TimelineLegend() {
  const items = [
    { key: "project", label: "Project", className: "project" },
    { key: "completed", label: "Completed", className: "completed" },
    { key: "in-progress", label: "In Progress", className: "in-progress" },
    { key: "not-started", label: "Not Started", className: "not-started" },
    { key: "overdue", label: "Overdue", className: "overdue" },
  ];

  return (
    <div className="timeline-legend" aria-label="Timeline legend">
      {items.map(item => (
        <div key={item.key} className="timeline-legend-item">
          <span className={`timeline-legend-dot ${item.className}`} aria-hidden="true" />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="timeline-legend-item">
        <span className="timeline-legend-today" aria-hidden="true" />
        <span>Today</span>
      </div>
    </div>
  );
}
