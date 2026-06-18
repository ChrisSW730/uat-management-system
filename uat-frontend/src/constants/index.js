/* -----------------------------------------
   CONSTANTS
----------------------------------------- */
export const EXEC_STATUS = {
  "Not Run": { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#cbd5e1" },
  Passed: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  Failed: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", dot: "#f43f5e" },
  Invalid: { bg: "#eef2ff", text: "#3730a3", border: "#c7d2fe", dot: "#6366f1" },
  Blocked: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", dot: "#f97316" },
  Skip: { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe", dot: "#8b5cf6" },
  Deferred: { bg: "#fefce8", text: "#a16207", border: "#fde68a", dot: "#eab308" },
};

export const PRIORITY_META = {
  Showstopper: { bg: "#ef4444", text: "#fff", shadow: "#ef444433" },
  High: { bg: "#f97316", text: "#fff", shadow: "#f9731633" },
  Medium: { bg: "#f59e0b", text: "#fff", shadow: "#f59e0b33" },
  Low: { bg: "#22c55e", text: "#fff", shadow: "#22c55e33" },
};

export const TEST_CASE_PRIORITIES = ["High", "Medium", "Low"];

export const DEFECT_STATUS = {
  New: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  "In Progress": { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7", dot: "#10b981" },
  Fixed: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  Reopened: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", dot: "#f43f5e" },
  Rejected: { bg: "#fefce8", text: "#a16207", border: "#fde68a", dot: "#eab308" },
  "Change Request": { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe", dot: "#8b5cf6" },
  Closed: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8" },
};

export const CATEGORIES = [
  "User Authentication", "User Management",
  "Payout & Clawback Creation (Charity Live Campaign)",
  "Payout & Clawback Creation (Commercial Live Campaign)",
  "Payout Approval", "BMM", "PAF", "Data Insight",
];