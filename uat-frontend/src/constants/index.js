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
  Critical: {
    bg: "#FEE2E2",
    text: "#B91C1C",
    border: "#FCA5A5",
    shadow: "rgba(239,68,68,.18)",
  },

  High: {
    bg: "#FFF7ED",
    text: "#C2410C",
    border: "#FDBA74",
    shadow: "rgba(249,115,22,.18)",
  },

  Medium: {
    bg: "#EFF6FF",
    text: "#1D4ED8",
    border: "#93C5FD",
    shadow: "rgba(59,130,246,.18)",
  },

  Low: {
    bg: "#ECFDF5",
    text: "#15803D",
    border: "#86EFAC",
    shadow: "rgba(34,197,94,.18)",
  },
};

export const DASHBOARD_PRIORITY_META = {
  Critical: {
    bg: "#DC2626",
    text: "#FFFFFF",
    shadow: "#DC262633",
  },

  High: {
    bg: "#F97316",
    text: "#FFFFFF",
    shadow: "#F9731633",
  },

  Medium: {
    bg: "#3B82F6",
    text: "#FFFFFF",
    shadow: "#3B82F633",
  },

  Low: {
    bg: "#22C55E",
    text: "#FFFFFF",
    shadow: "#22C55E33",
  },
};

export const DEFECT_PRIORITIES = ["Critical", "High", "Medium", "Low"];

export function normalizeDefectPriority(priority) {
  const value = String(priority ?? "").trim();
  if (!value) return "";

  const aliases = {
    showstopper: "Critical",
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  return aliases[value.toLowerCase()] || value;
}

export const TEST_CASE_PRIORITIES = ["High", "Medium", "Low"];

export const DEFECT_STATUS = {
  New: {
    bg: "#eef2ff",
    text: "#4f46e5",
    border: "#c7d2fe",
    dot: "#6366f1",
  },

  "In Progress": {
    bg: "#fff7ed",
    text: "#c2410c",
    border: "#fdba74",
    dot: "#f97316",
  },

  Fixed: {
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
    dot: "#10b981",
  },

  Reopened: {
    bg: "#fef2f2",
    text: "#dc2626",
    border: "#fecaca",
    dot: "#ef4444",
  },

  Rejected: {
    bg: "#f8fafc",
    text: "#475569",
    border: "#cbd5e1",
    dot: "#64748b",
  },

  "Change Request": {
    bg: "#faf5ff",
    text: "#7c3aed",
    border: "#ddd6fe",
    dot: "#8b5cf6",
  },

  "Pending Deployment": {
    bg: "#ecfeff",
    text: "#0f766e",
    border: "#a7f3d0",
    dot: "#14b8a6",
  },

  Closed: {
    bg: "#f1f5f9",
    text: "#64748b",
    border: "#e2e8f0",
    dot: "#94a3b8",
  },
};

export const DEFECT_SOURCES = [
  "Test Execution",
  "Exploratory Testing",
  "UAT Feedback",
  "Automation",
  "Production Verification",
  "Customer Report",
  "Other",
];

export const DEFECT_SEVERITIES = ["Critical", "High", "Medium", "Low"];

export const DEFECT_ISSUE_TYPES = [
  "Functional",
  "UIUX",
  "Performance",
  "Test Data",
  "Environment",
  "Configuration",
  "Data Synchronization",
  "Compatibility",
  "Security",
  "Backend Script/Scheduler",
  "Enhancement",
  "Other",
];

export const CATEGORIES = [
  "User Authentication", "User Management",
  "Payout & Clawback Creation (Charity Live Campaign)",
  "Payout & Clawback Creation (Commercial Live Campaign)",
  "Payout Approval", "BMM", "PAF", "Data Insight",
];

export const DATE_RANGE_LABEL = {
    last7: "Last 7 Days",
    last30: "Last 30 Days",
    thisMonth: "This Month",
    lastMonth: "Last Month",
    custom: "Custom Range",
};