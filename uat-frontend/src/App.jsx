import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import loginBg from "../public/login.png";
import html2canvas from "html2canvas";
import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  Play,
  Bug,
  Settings,
  Users,
  Files,
  CheckCircle2,
  XCircle,
  Ban,
  Activity,
  Bell,
  Trash2,
  Target,
  Search,
  Eye,
  EyeOff
} from "lucide-react";

/* -----------------------------------------
   CONSTANTS
----------------------------------------- */
const EXEC_STATUS = {
  "Not Run": { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#cbd5e1" },
  Passed: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  Failed: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", dot: "#f43f5e" },
  Invalid: { bg: "#eef2ff", text: "#3730a3", border: "#c7d2fe", dot: "#6366f1" },
  Blocked: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", dot: "#f97316" },
  Skip: { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe", dot: "#8b5cf6" },
  Deferred: { bg: "#fefce8", text: "#a16207", border: "#fde68a", dot: "#eab308" },
};

const PRIORITY_META = {
  Showstopper: { bg: "#ef4444", text: "#fff", shadow: "#ef444433" },
  High: { bg: "#f97316", text: "#fff", shadow: "#f9731633" },
  Medium: { bg: "#f59e0b", text: "#fff", shadow: "#f59e0b33" },
  Low: { bg: "#22c55e", text: "#fff", shadow: "#22c55e33" },
};

const TEST_CASE_PRIORITIES = ["High", "Medium", "Low"];

const DEFECT_STATUS = {
  New: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  "In Progress": { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7", dot: "#10b981" },
  Fixed: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  Reopened: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", dot: "#f43f5e" },
  Rejected: { bg: "#fefce8", text: "#a16207", border: "#fde68a", dot: "#eab308" },
  "Change Request": { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe", dot: "#8b5cf6" },
  Closed: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8" },
};

const CATEGORIES = [
  "User Authentication", "User Management",
  "Payout & Clawback Creation (Charity Live Campaign)",
  "Payout & Clawback Creation (Commercial Live Campaign)",
  "Payout Approval", "BMM", "PAF", "Data Insight",
];

/* -----------------------------------------
   SMALL UI COMPONENTS
----------------------------------------- */
function Dot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

function DiamondMark({ size = 32, outer = "#ffffff", inner = "#4f46e5", stroke = 6 }) {
  return (
    <span style={{ width: size, height: size, transform: "rotate(45deg)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `${stroke}px solid ${outer}`, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: "48%", height: "48%", background: inner, borderRadius: 1 }} />
      </span>
    </span>
  );
}

function ExecBadge({ status }) {
  const c = EXEC_STATUS[status] || EXEC_STATUS["Not Run"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, border: `1.5px solid ${c.border}`, padding: "3px 10px 3px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Dot color={c.dot} />{status}
    </span>
  );
}

function DefBadge({ status }) {
  const c = DEFECT_STATUS[status] || DEFECT_STATUS.New;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c.bg, color: c.text, border: `1.5px solid ${c.border}`, padding: "3px 10px 3px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Dot color={c.dot} />{status || "New"}
    </span>
  );
}

function PriBadge({ label }) {
  const m = PRIORITY_META[label] || { bg: "#e2e8f0", text: "#334155", shadow: "#0000001a" };
  return <span style={{ background: m.bg, color: m.text, padding: "3px 10px", borderRadius: 6, fontSize: 14, fontWeight: 700, textTransform: "uppercase", boxShadow: `0 2px 8px ${m.shadow}`, whiteSpace: "nowrap" }}>{label}</span>;
}

function Modal({ children, onClose, wide, zIndex = 1000, onPaste }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(5px)", zIndex, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} onPaste={onPaste} style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: wide ? 900 : 700, maxHeight: "93vh", overflowY: "auto", overscrollBehavior: "contain", boxShadow: "0 32px 80px rgba(0,0,0,0.18)", border: "1px solid #f1f5f9" }}>
        {children}
      </div>
    </div>
  );
}

function DetailBlock({ label, value, pre, accent, danger }) {
  const bg = accent ? "#eff6ff" : danger ? "#fff1f2" : "#f8fafc";
  const bd = accent ? "#bfdbfe" : danger ? "#fecdd3" : "#f1f5f9";
  const cl = accent ? "#1d4ed8" : danger ? "#be123c" : "#334155";
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      {pre
        ? <pre style={{ background: "#f8fafc", border: "1.5px solid #f1f5f9", borderRadius: 8, padding: "10px 14px", color: "#334155", fontSize: 14, whiteSpace: "pre-wrap", margin: 0, fontFamily: "ui-monospace,monospace", lineHeight: 1.6 }}>{value}</pre>
        : <span style={{ display: "block", background: bg, border: `1.5px solid ${bd}`, borderRadius: 8, padding: "10px 14px", color: cl, fontSize: 14, lineHeight: 1.5 }}>{value || "-"}</span>}
    </div>
  );
}

function readStoredAuth() {
  try {
    const sessionAuth = JSON.parse(sessionStorage.getItem("uatAuth") || "null");
    if (sessionAuth?.token && sessionAuth?.user) return sessionAuth;
  } catch {
    // ignore malformed auth cache
  }

  try {
    const localAuth = JSON.parse(localStorage.getItem("uatAuth") || "null");
    if (localAuth?.token && localAuth?.user) return localAuth;
  } catch {
    // ignore malformed auth cache
  }

  return null;
}

function persistAuth(result, rememberMe) {
  const serialized = JSON.stringify(result);
  const storage = rememberMe ? localStorage : sessionStorage;
  const alternateStorage = rememberMe ? sessionStorage : localStorage;

  alternateStorage.removeItem("uatAuth");
  alternateStorage.removeItem("uatToken");
  alternateStorage.removeItem("uatUserName");
  alternateStorage.removeItem("uatUserRole");

  storage.setItem("uatAuth", serialized);
  storage.setItem("uatToken", result.token);
  storage.setItem("uatUserName", result.user.username);
  storage.setItem("uatUserRole", result.user.role);
}

function clearStoredAuth() {
  localStorage.removeItem("uatAuth");
  localStorage.removeItem("uatToken");
  localStorage.removeItem("uatUserName");
  localStorage.removeItem("uatUserRole");
  sessionStorage.removeItem("uatAuth");
  sessionStorage.removeItem("uatToken");
  sessionStorage.removeItem("uatUserName");
  sessionStorage.removeItem("uatUserRole");
}

function normalizeExcelHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function LoginScreen({ username, password, rememberMe, error, busy, onUsernameChange, onPasswordChange, onRememberMeChange, onSubmit, onContactAdmin, onForgotPassword }) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f8faff" }}>
      <img src={loginBg} alt="Test Management System" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />

      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", justifyContent: "flex-end", alignItems: "center", paddingRight: "8%" }}>
        <div style={{ width: "100%", height: "auto", maxWidth: 520, padding: "80px 42px", borderRadius: 36, background: "rgba(255,255,255,0.32)", border: "1px solid rgba(255,255,255,0.28)", boxShadow: "0 8px 32px rgba(31,38,135,0.12), inset 0 1px 1px rgba(255,255,255,0.18)", position: "absolute", right: "8%", top: "50%", transform: "translateY(-50%)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{ width: 78, height: 78, borderRadius: 24, background: "linear-gradient(135deg,#6366f1,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px rgba(99,102,241,0.22)" }}><DiamondMark size={34} outer="#ffffff" inner="#4f46e5" stroke={6} /></div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <div style={{ fontSize: 34, fontWeight: 750, color: "#0f172a", letterSpacing: "-0.03em", marginBottom: 10 }}>Welcome Back</div>
            <div style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>Sign in to continue to your account</div>
          </div>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 22 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>Username</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 16, zIndex: 2, pointerEvents: "none" }}>👤</span>
                <input
                  value={username}
                  onChange={e => onUsernameChange(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter your email address"
                  style={{ width: "100%", padding: "15px 18px 15px 48px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", fontSize: 15, color: "#0f172a", outline: "none", boxSizing: "border-box", boxShadow: "0 8px 20px rgba(15,23,42,0.03)", transition: "all 0.18s ease" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>Password</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 16, zIndex: 2, pointerEvents: "none" }}>🔒</span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => onPasswordChange(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  style={{ width: "100%", padding: "15px 52px 15px 48px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", fontSize: 15, color: "#0f172a", outline: "none", boxSizing: "border-box", boxShadow: "0 8px 20px rgba(15,23,42,0.03)", transition: "all 0.18s ease" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  title={showPw ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={rememberMe} onChange={e => onRememberMeChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#6366f1" }} />
                Remember me
              </label>
              <span
                onClick={onForgotPassword}
                style={{ color: "#4f46e5", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "underline" }}
              >
                Forgot password?
              </span>
            </div>

            {error && <div style={{ background: "rgba(255,240,242,0.92)", border: "1px solid rgba(244,63,94,0.12)", color: "#be123c", padding: "12px 14px", borderRadius: 14, fontSize: 13 }}>{error}</div>}

            <button type="submit" disabled={busy} style={{ marginTop: 4, width: "100%", padding: "16px 18px", border: "none", borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 14px 35px rgba(99,102,241,0.22)", transition: "all 0.18s ease" }}>
              {busy ? "Signing in..." : "→ Login"}
            </button>

            <div style={{ textAlign: "center", marginTop: 4, fontSize: 15, color: "#475569" }}>
              Don't have an account?{" "}
              <span onClick={onContactAdmin} style={{ color: "#4f46e5", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Contact Administrator</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getInitialDefectLinkId() {
  try {
    const url = new URL(window.location.href);
    const queryId = url.searchParams.get("defect");
    if (queryId) {
      const parsed = Number(queryId);
      if (Number.isFinite(parsed)) return String(parsed);
    }

    const defectMatch = url.pathname.match(/\/defects\/(\d+)$/);
    if (defectMatch) return defectMatch[1];
  } catch {
    return null;
  }

  return null;
}

/* -----------------------------------------
   SHARED STYLES
----------------------------------------- */
const vw = window.innerWidth;
const scale = vw < 1280 ? vw / 1280 : 1;
const inp = { background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#0f172a", padding: "9px 13px", width: "100%", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { color: "#94a3b8", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", display: "block", marginBottom: 5 };
const btnP = { background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px #6366f144" };
const btnS = { background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const btnD = { background: "#fff1f2", color: "#be123c", border: "1.5px solid #fecdd3", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const xBtn = { background: "#f1f5f9", border: "none", color: "#64748b", width: 32, height: 32, borderRadius: 8, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

/* -----------------------------------------
   MAIN APP
----------------------------------------- */
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [allTestCases, setAllTestCases] = useState([]);
  const [runs, setRuns] = useState([]);
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTestPlanId, setSelectedTestPlanId] = useState("");

  // TC filters
  const [tcSearch, setTcSearch] = useState("");
  const [tcCatFilter, setTcCatFilter] = useState("All");
  const [tcPriFilter, setTcPriFilter] = useState("All");
  const [defSearch, setDefSearch] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRememberMe, setLoginRememberMe] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const importTestCaseInputRef = useRef(null);
  const [importingTestCases, setImportingTestCases] = useState(false);
  const [pendingDefectLinkId, setPendingDefectLinkId] = useState(() => getInitialDefectLinkId());
  const [authUser, setAuthUser] = useState(() => readStoredAuth()?.user || null);
  const [defStatusFilter, setDefStatusFilter] = useState("All");
  const [defPriFilter, setDefPriFilter] = useState("All");
  const [defMarketFilter, setDefMarketFilter] = useState("All");
  const [defPlanFilter, setDefPlanFilter] = useState("All");
  const [defOpenRule, setDefOpenRule] = useState("Any");
  const [dashProjectId, setDashProjectId] = useState("");
  const [dashPlanId, setDashPlanId] = useState("");
  const [dashRunId, setDashRunId] = useState("");
  const [defOpenDate, setDefOpenDate] = useState("");
  const [defCloseRule, setDefCloseRule] = useState("Any");
  const [defCloseDate, setDefCloseDate] = useState("");
  const [users, setUsers] = useState([]);
  // cooldownEndsAt: { ["reset-{id}"]: timestampMs }
  const [pwCooldowns, setPwCooldowns] = useState({});
  const [, setPwTick] = useState(0); // forces re-render each second
  useEffect(() => {
    const id = setInterval(() => setPwTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const getPwCooldownRemaining = (key) => {
    const endsAt = pwCooldowns[key];
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  };
  const [defDateFilterPanel, setDefDateFilterPanel] = useState(null);
  const [runSearch, setRunSearch] = useState("");
  const [runDateRule, setRunDateRule] = useState("Any");
  const [runDateValue, setRunDateValue] = useState("");
  const [runDateFilterPanel, setRunDateFilterPanel] = useState(null);
  const [tcSortCol, setTcSortCol] = useState("tcNumber");
  const [tcSortDir, setTcSortDir] = useState("desc");
  const [defSortCol, setDefSortCol] = useState("");
  const [defSortDir, setDefSortDir] = useState("asc");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [userActiveFilter, setUserActiveFilter] = useState("All");
  const [testerSearch, setTesterSearch] = useState("");
  const [userSortCol, setUserSortCol] = useState("username");
  const [userSortDir, setUserSortDir] = useState("asc");
  const [selectedTcIds, setSelectedTcIds] = useState([]);
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [selectedDefectIds, setSelectedDefectIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [hoveredRunId, setHoveredRunId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [defectCommentDrafts, setDefectCommentDrafts] = useState({});
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionPicker, setMentionPicker] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [defectAttachments, setDefectAttachments] = useState({});
  const [uploadingDefectId, setUploadingDefectId] = useState(null);
  const [newDefAttachments, setNewDefAttachments] = useState([]);
  const [testCaseAttachments, setTestCaseAttachments] = useState({});
  const [uploadingTestCaseId, setUploadingTestCaseId] = useState(null);
  const [newTCAttachments, setNewTCAttachments] = useState([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showManageScopes, setShowManageScopes] = useState(false);
  const [managingTestPlan, setManagingTestPlan] = useState(null);
  const [newScopeName, setNewScopeName] = useState("");
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [categories, setCategories] = useState(() => {
    try {
      const stored = localStorage.getItem("uat_categories");
      if (stored) return JSON.parse(stored);
    } catch { }
    return [
      "User Authentication", "User Management",
      "Payout & Clawback Creation (Charity Live Campaign)",
      "Payout & Clawback Creation (Commercial Live Campaign)",
      "Payout Approval", "BMM", "PAF", "Data Insight",
    ];
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showEditProject, setShowEditProject] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserRole, setNewUserRole] = useState("Viewer");
  const [newUserActive, setNewUserActive] = useState(true);
  const [editProjectName, setEditProjectName] = useState("");
  const [editPlanName, setEditPlanName] = useState("");
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [newProjectEndDate, setNewProjectEndDate] = useState("");
  const [newPlanStartDate, setNewPlanStartDate] = useState("");
  const [newPlanEndDate, setNewPlanEndDate] = useState("");
  const [editProjectStartDate, setEditProjectStartDate] = useState("");
  const [editProjectEndDate, setEditProjectEndDate] = useState("");
  const [editPlanStartDate, setEditPlanStartDate] = useState("");
  const [editPlanEndDate, setEditPlanEndDate] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingPlanId, setEditingPlanId] = useState(null);

  // Modals
  const [viewTC, setViewTC] = useState(null);
  const [viewRun, setViewRun] = useState(null);
  const [viewDef, setViewDef] = useState(null);
  const [showAddTC, setShowAddTC] = useState(false);
  const [showAddRun, setShowAddRun] = useState(false);
  const [showAddDef, setShowAddDef] = useState(null);
  const [editTC, setEditTC] = useState(null);
  const [editDef, setEditDef] = useState(null);
  const [editRun, setEditRun] = useState(null);
  const [editRunTesterSearch, setEditRunTesterSearch] = useState("");
  const [showForcePasswordChange, setShowForcePasswordChange] = useState(false);
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState("");
  const [newPasswordForChange, setNewPasswordForChange] = useState("");
  const [confirmPasswordForChange, setConfirmPasswordForChange] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");

  const blankTC = { name: "", description: "", steps: "", expected: "", priority: "Medium", category: "User Authentication", remarks: "", testScopeId: "" };
  const blankRun = { name: "", selectedTcIds: [], selectedTesters: [], testerSearch: "" };
  const defaultDefectTemplate = [
    "Marketing Company: ",
    "WE Date: ",
    "Impacted Area: ",
    "BA / Owner ID: ",
    "Sample Serial Number: ",
  ].join("\n");
  const blankDef = { market: "SG", description: defaultDefectTemplate, issueType: "Functional Issue", expected: "", actual: "", targetFix: "", raisedBy: "", priority: "Medium", assignedTo: "", remarks: "" };

  const [newTC, setNewTC] = useState(blankTC);
  const [newRun, setNewRun] = useState(blankRun);
  const [newDef, setNewDef] = useState(blankDef);

  const TABS = [
    ["dashboard", <LayoutDashboard size={18} />, "Dashboard"],
    ["projects", <Briefcase size={18} />, "Projects"],
    ["testcases", <ClipboardList size={18} />, "Test Cases"],
    ["runs", <Play size={18} />, "Test Runs"],
    ["defects", <Bug size={18} />, "Defect Log"]
  ];

  const canWrite = !!authUser && authUser.role !== "Viewer" && authUser.role !== "Developer";
  const canComment = !!authUser && authUser.role !== "Viewer";
  const canAssignDefect = !!authUser && authUser.role !== "Viewer";
  const canUpdateDefectStatus = !!authUser && ["Admin", "Test Lead", "Tester", "Developer"].includes(authUser.role);
  const canManageProjects = !!authUser && (authUser.role === "Admin" || authUser.role === "Test Lead");
  const canDelete = !!authUser && (authUser.role === "Admin" || authUser.role === "Test Lead");
  const isAdmin = authUser?.role === "Admin";
  const fallbackAdminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "admin@uatsystem.local").trim();
  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;
  const allUserDisplayNames = useMemo(() => {
    const names = [
      ...(mentionUsers || []).map(u => (u.displayName || "").trim()),
      ...(users || []).map(u => (u.displayName || "").trim()),
      (authUser?.displayName || "").trim(),
    ].filter(Boolean);

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [mentionUsers, users, authUser?.displayName]);

  const assignableUserDisplayNames = useMemo(() => {
    const names = [
      ...(users || [])
        .filter(u => (u.role || "").toLowerCase() !== "viewer")
        .map(u => (u.displayName || "").trim()),
      ...(mentionUsers || [])
        .filter(u => !u.role || (u.role || "").toLowerCase() !== "viewer")
        .map(u => (u.displayName || "").trim()),
      authUser?.role !== "Viewer" ? (authUser?.displayName || "").trim() : "",
    ].filter(Boolean);

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [users, mentionUsers, authUser?.displayName, authUser?.role]);

  function getCurrentUserName() {
    return authUser?.username || localStorage.getItem("uatUserName") || "Chris";
  }

  function getCurrentUserDisplayName() {
    return authUser?.displayName || getCurrentUserName();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
  }

  function formatTimeAgo(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getMentionSuggestions(text) {
    const match = (text || "").match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;
    const query = (match[1] || "").trim().toLowerCase();
    const list = mentionUsers
      .filter(u => (u.displayName || "").toLowerCase().includes(query))
      .slice(0, 8);
    return { query, list };
  }

  function applyMentionText(text, displayName) {
    return (text || "").replace(/(?:^|\s)@([^\s@]*)$/, m => {
      const prefix = m.startsWith(" ") ? " " : "";
      return `${prefix}@${displayName} `;
    });
  }

  const mentionInputRefs = useRef({});
  const dashboardRef = useRef(null);
  const ctxMenuRef = useRef(null);

  useLayoutEffect(() => {
    if (!ctxMenuRef.current || !contextMenu) return;
    const el = ctxMenuRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      el.style.top = Math.max(0, contextMenu.y - rect.height) + "px";
    }
    if (rect.right > window.innerWidth) {
      el.style.left = Math.max(0, contextMenu.x - rect.width) + "px";
    }
  }, [contextMenu]);

  function registerMentionInputRef(key, node) {
    if (!key) return;
    if (node) mentionInputRefs.current[key] = node;
    else delete mentionInputRefs.current[key];
  }

  function focusMentionInput(key) {
    const input = mentionInputRefs.current[key];
    if (!input) return;
    input.focus();
    const len = input.value?.length || 0;
    if (input.setSelectionRange) input.setSelectionRange(len, len);
  }

  function handleMentionInputChange(pickerType, pickerKey, value, setValue) {
    setValue(value);
    const result = getMentionSuggestions(value);
    if (result && result.list.length > 0) {
      setMentionPicker({ type: pickerType, key: pickerKey, list: result.list, activeIndex: 0 });
    } else {
      setMentionPicker(p => (p?.type === pickerType && p?.key === pickerKey ? null : p));
    }
  }

  function selectMention(pickerType, pickerKey, currentValue, setValue, displayName) {
    const nextValue = applyMentionText(currentValue, displayName);
    setValue(nextValue);
    setMentionPicker(null);
    requestAnimationFrame(() => focusMentionInput(pickerKey));
  }

  function replyToComment(pickerKey, currentValue, setValue, displayName) {
    const mention = `@${displayName}`;
    const base = currentValue || "";
    const alreadyMentioned = base.includes(mention);
    const needsSpace = base.length > 0 && !/\s$/.test(base);
    const nextValue = alreadyMentioned ? base : `${base}${needsSpace ? " " : ""}${mention} `;
    setValue(nextValue);
    setMentionPicker(null);
    requestAnimationFrame(() => focusMentionInput(pickerKey));
  }

  async function copyDefectLink(defectId) {
    const url = new URL(window.location.href);
    url.searchParams.set("defect", String(defectId));
    url.hash = "";

    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt("Copy defect link", url.toString());
    }
  }

  function handleMentionKeyDown(e, pickerType, pickerKey, currentValue, setValue) {
    if (mentionPicker?.type !== pickerType || mentionPicker?.key !== pickerKey || !mentionPicker.list?.length) return;

    const len = mentionPicker.list.length;
    const currentIndex = Number.isInteger(mentionPicker.activeIndex) ? mentionPicker.activeIndex : 0;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionPicker(p => {
        if (!p || p.type !== pickerType || p.key !== pickerKey || !p.list?.length) return p;
        const nextIndex = (Number.isInteger(p.activeIndex) ? p.activeIndex : 0) + 1;
        return { ...p, activeIndex: nextIndex % p.list.length };
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionPicker(p => {
        if (!p || p.type !== pickerType || p.key !== pickerKey || !p.list?.length) return p;
        const base = Number.isInteger(p.activeIndex) ? p.activeIndex : 0;
        return { ...p, activeIndex: (base - 1 + p.list.length) % p.list.length };
      });
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const selected = mentionPicker.list[currentIndex] || mentionPicker.list[0];
      if (selected) {
        selectMention(pickerType, pickerKey, currentValue, setValue, selected.displayName);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setMentionPicker(null);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      const result = await api.login(loginUsername, loginPassword, loginRememberMe);
      persistAuth(result, loginRememberMe);
      setAuthUser(result.user);
      setActiveTab("dashboard");
      setLoginPassword("");

      if (result.user.mustChangePassword) {
        setShowForcePasswordChange(true);
        setCurrentPasswordForChange("");
        setNewPasswordForChange("");
        setConfirmPasswordForChange("");
        setPasswordChangeError("");
      } else {
        setLoading(true);
      }
    } catch (error) {
      setLoginError(error.message || "Login failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleContactAdministrator() {
    const subject = "Test Management System: Access Request";
    const body = [
      "Hello Admin,",
      "",
      "I need help with my system account.",
      loginUsername ? `Username: ${loginUsername}` : "",
      "",
      "Thank you."
    ].filter(Boolean).join("\n");

    let recipient = fallbackAdminEmail;
    try {
      const adminContacts = await api.getAdminContacts();
      const recipients = Array.isArray(adminContacts?.usernames)
        ? adminContacts.usernames.filter(Boolean)
        : adminContacts?.username
          ? [adminContacts.username]
          : [];

      if (recipients.length > 0) {
        recipient = recipients.join(",");
      }
    } catch (error) {
      console.warn("Failed to load admin contacts from database:", error);
    }

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.location.href = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
  }

  async function handleForgotPassword() {
    const subject = "Test Management System: Password Reset Request";
    const body = [
      "Hello Admin,",
      "",
      "I have forgotten my password and need to reset it.",
      loginUsername ? `Username: ${loginUsername}` : "Username: [Not provided]",
      "",
      "Please help me reset my password so I can access the system again.",
      "",
      "Thank you."
    ].filter(Boolean).join("\n");

    let recipient = fallbackAdminEmail;
    try {
      const adminContacts = await api.getAdminContacts();
      const recipients = Array.isArray(adminContacts?.usernames)
        ? adminContacts.usernames.filter(Boolean)
        : adminContacts?.username
          ? [adminContacts.username]
          : [];

      if (recipients.length > 0) {
        recipient = recipients.join(",");
      }
    } catch (error) {
      console.warn("Failed to load admin contacts from database:", error);
    }

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.location.href = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
  }

  function handleLogout() {
    clearStoredAuth();
    setAuthUser(null);
    setProjects([]);
    setTestCases([]);
    setAllTestCases([]);
    setRuns([]);
    setDefects([]);
    setUsers([]);
    setMentionUsers([]);
    setMentionPicker(null);
    setNotifications([]);
    setShowNotifications(false);
    setSelectedProjectId("");
    setSelectedTestPlanId("");
    setActiveTab("testcases");
  }

  function toInputDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  function isValidDateRange(startDate, endDate) {
    return !!startDate && !!endDate && new Date(startDate) <= new Date(endDate);
  }

  function formatTimeline(startDate, endDate) {
    if (!startDate || !endDate) return "No timeline";
    return `${startDate.slice(0, 10)} to ${endDate.slice(0, 10)}`;
  }

  function getTimelineMeta(startDate, endDate) {
    if (!startDate || !endDate) {
      return { progress: 0, status: "No timeline", color: "#94a3b8" };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { progress: 0, status: "Invalid timeline", color: "#ef4444" };
    }

    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

    if (current < startMs) {
      return { progress: 0, status: "Not started", color: "#94a3b8" };
    }

    if (current > endMs) {
      return { progress: 100, status: "Completed", color: "#22c55e" };
    }

    const total = Math.max(endMs - startMs, 1);
    const elapsed = current - startMs;
    const progress = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    return { progress, status: "In progress", color: "#3b82f6" };
  }

  function timelineBadgeStyle(status) {
    if (status === "Completed") {
      return { bg: "#f0fdf4", text: "#166534", border: "#86efac" };
    }
    if (status === "In progress") {
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" };
    }
    return { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" };
  }

  function toggleDefDateFilterPanel(e, type) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const panelWidth = 190;
    const left = Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 150);
    setDefDateFilterPanel(p => p?.type === type ? null : { type, top, left });
  }

  function toggleRunDateFilterPanel(e) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const panelWidth = 190;
    const left = Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 150);
    setRunDateFilterPanel(p => p ? null : { top, left });
  }

  /* ── Load data from API ── */
  /* useEffect(() => {
     Promise.all([api.getTestCases(), api.getTestRuns(), api.getDefects()])
       .then(([tcs, rs, defs]) => {
         setTestCases(tcs);
         setRuns(rs);
         setDefects(defs);
       })
       .catch(err => console.error("Failed to load data:", err))
       .finally(() => setLoading(false));
   }, []);*/
  useEffect(() => {
    if (!authUser) {
      setMentionUsers([]);
      setMentionPicker(null);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      api.getProjects().then(ps => {
        setProjects(ps || []);
        if ((ps || []).length > 0) {
          const p = ps[0];
          setSelectedProjectId(String(p.id));
          const firstPlan = (p.testPlans || [])[0];
          if (firstPlan) setSelectedTestPlanId(String(firstPlan.id));
        }
      }),
      api.getTestCases().then(tcs => {
        setTestCases(tcs);
        setAllTestCases(tcs || []);
      }),
      api.getTestRuns().then(setRuns),
      api.getDefects().then(setDefects),
      api.getMentionUsers().then(setMentionUsers).catch(err => console.error("Mention users error:", err)),
      isAdmin ? api.getUsers().then(setUsers).catch(err => console.error("Users Error:", err)) : Promise.resolve([]),
      api.getNotifications(false).then(setNotifications).catch(err => console.error("Notifications Error:", err)),
    ])
      .catch(err => console.error("Failed to load data:", err))
      .finally(() => setLoading(false));

  }, [authUser, isAdmin]);

  useEffect(() => {
    if (!authUser || loading || !pendingDefectLinkId) return;

    const defectId = Number(pendingDefectLinkId);
    if (!Number.isFinite(defectId)) {
      setPendingDefectLinkId(null);
      return;
    }

    const targetDefect = (defects || []).find(d => Number(d.id) === defectId);
    if (!targetDefect) return;

    setActiveTab("defects");
    setViewDef(targetDefect);
    setShowNotifications(false);
    setPendingDefectLinkId(null);
  }, [authUser, loading, pendingDefectLinkId, defects]);

  useEffect(() => {
    api.getTestCases(selectedTestPlanId || undefined)
      .then(setTestCases)
      .catch(err => console.error("TC Error:", err));
  }, [selectedTestPlanId]);

  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
      setDefDateFilterPanel(null);
      setRunDateFilterPanel(null);
      setShowNotifications(false);
      setShowSettingsMenu(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!viewDef?.id) return;
    api.getDefectAttachments(viewDef.id)
      .then(list => setDefectAttachments(p => ({ ...p, [viewDef.id]: list })))
      .catch(err => console.error("Attachment load error:", err));
  }, [viewDef?.id]);

  useEffect(() => {
    if (!viewTC?.id) return;
    api.getTestCaseAttachments(viewTC.id)
      .then(list => setTestCaseAttachments(p => ({ ...p, [viewTC.id]: list })))
      .catch(err => console.error("Test case attachment load error:", err));
  }, [viewTC?.id]);

  useEffect(() => {
    if (!editTC?.id) return;
    api.getTestCaseAttachments(editTC.id)
      .then(list => setTestCaseAttachments(p => ({ ...p, [editTC.id]: list })))
      .catch(err => console.error("Edit test case attachment load error:", err));
  }, [editTC?.id]);

  /* ── Filters ── */
  const filteredTC = useMemo(() => testCases.filter(tc => {
    const q = tcSearch.toLowerCase();
    return (tc.name.toLowerCase().includes(q) || tc.tcNumber.toLowerCase().includes(q))
      && (tcCatFilter === "All" || tc.category === tcCatFilter)
      && (tcPriFilter === "All" || tc.priority === tcPriFilter);
  }), [testCases, tcSearch, tcCatFilter, tcPriFilter]);

  const filteredDefects = useMemo(() => defects.filter(def => {
    const q = defSearch.trim().toLowerCase();
    const openAt = def.openDateTime || def.dateRaised;
    const closeAt = def.closeDateTime;

    function matchDateRule(sourceDate, rule, selectedDate) {
      if (rule === "Any" || !selectedDate) return true;
      if (!sourceDate) return false;

      const source = new Date(sourceDate);
      const start = new Date(`${selectedDate}T00:00:00`);
      const end = new Date(`${selectedDate}T23:59:59`);
      if (Number.isNaN(source.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;

      if (rule === "Before") return source < start;
      if (rule === "After") return source > end;
      if (rule === "On") return source >= start && source <= end;
      return true;
    }

    const matchesSearch = !q
      || def.defectNumber?.toLowerCase().includes(q)
      || def.runNumber?.toLowerCase().includes(q)
      || def.tcNumber?.toLowerCase().includes(q)
      || def.description?.toLowerCase().includes(q)
      || def.assignedTo?.toLowerCase().includes(q)
      || def.raisedBy?.toLowerCase().includes(q);

    const matchesOpenRule = matchDateRule(openAt, defOpenRule, defOpenDate);
    const matchesCloseRule = matchDateRule(closeAt, defCloseRule, defCloseDate);

    return matchesSearch
      && (defStatusFilter === "All" || def.status === defStatusFilter)
      && (defPriFilter === "All" || def.priority === defPriFilter)
      && (defMarketFilter === "All" || def.market === defMarketFilter)
      && (defPlanFilter === "All" || String(def.testPlanId) === defPlanFilter)
      && matchesOpenRule
      && matchesCloseRule;
  }), [defects, defSearch, defStatusFilter, defPriFilter, defMarketFilter, defPlanFilter, defOpenRule, defOpenDate, defCloseRule, defCloseDate]);

  const dashboardStats = useMemo(() => {
    const filteredProjects = dashProjectId
      ? projects.filter(p => String(p.id) === dashProjectId)
      : projects;
    const allDashPlans = filteredProjects.flatMap(p => p.testPlans || []);
    const activePlanIds = new Set(
      dashPlanId ? [Number(dashPlanId)] : allDashPlans.map(p => p.id)
    );
    const filteredTCs = allTestCases.filter(tc => tc.testPlanId != null && activePlanIds.has(tc.testPlanId));
    const tcIdSet = new Set(filteredTCs.map(tc => tc.id));
    const scopedRuns = dashRunId ? runs.filter(r => String(r.id) === dashRunId) : runs;
    const availableRuns = runs.filter(r => (r.entries || []).some(e => tcIdSet.has(e.testCaseId)));
    const allEntries = scopedRuns.flatMap(r => r.entries || []);
    const filteredEntries = allEntries.filter(e => tcIdSet.has(e.testCaseId));
    const runTcCount = dashRunId ? new Set(filteredEntries.map(e => e.testCaseId)).size : filteredTCs.length;
    const execByStatus = Object.fromEntries(Object.keys(EXEC_STATUS).map(s => [s, 0]));
    filteredEntries.forEach(e => { const s = e.execStatus || "Not Run"; if (s in execByStatus) execByStatus[s]++; });
    const filteredDefects = dashProjectId
      ? defects.filter(d => d.testPlanId != null && activePlanIds.has(d.testPlanId))
      : defects;
    const defByStatus = Object.fromEntries(Object.keys(DEFECT_STATUS).map(s => [s, 0]));
    filteredDefects.forEach(d => { if (d.status in defByStatus) defByStatus[d.status]++; });
    const defByPriority = Object.fromEntries([...Object.keys(PRIORITY_META), "Other"].map(p => [p, 0]));
    filteredDefects.forEach(d => { if (d.priority in defByPriority) defByPriority[d.priority]++; else defByPriority["Other"]++; });
    const perPlanStats = allDashPlans.map(tp => {
      const proj = filteredProjects.find(p => (p.testPlans || []).some(t => t.id === tp.id));
      const tcCount = allTestCases.filter(tc => tc.testPlanId === tp.id).length;
      const planEntries = allEntries.filter(e => { const tc = allTestCases.find(t => t.id === e.testCaseId); return tc?.testPlanId === tp.id; });
      const defCount = defects.filter(d => d.testPlanId === tp.id).length;
      const openDefs = defects.filter(d => d.testPlanId === tp.id && d.status !== "Closed" && d.status !== "Rejected").length;
      const passed = planEntries.filter(e => e.execStatus === "Passed").length;
      const failed = planEntries.filter(e => e.execStatus === "Failed").length;
      return { tp, projectName: proj?.name || "", tcCount, defCount, openDefs, passed, failed, totalEntries: planEntries.length };
    });
    const passedTotal = filteredEntries.filter(e => e.execStatus === "Passed").length;
    const failedTotal = filteredEntries.filter(e => e.execStatus === "Failed").length;
    const openDefs = filteredDefects.filter(d => d.status !== "Closed" && d.status !== "Rejected").length;
    // Last 7 days trend
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - 6 + i); return d.toISOString().slice(0, 10); });
    const trendDays = last7.map(dateStr => {
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const dayRuns = scopedRuns.filter(r => r.createdAt?.slice(0, 10) === dateStr);
      const dayEntries = dayRuns.flatMap(r => (r.entries || []).filter(e => tcIdSet.has(e.testCaseId)));
      return { label, passed: dayEntries.filter(e => e.execStatus === "Passed").length, failed: dayEntries.filter(e => e.execStatus === "Failed").length, blocked: dayEntries.filter(e => e.execStatus === "Blocked").length };
    });
    const defectTrendDays = last7.map(dateStr => {
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { label, newCount: filteredDefects.filter(d => (d.dateRaised || d.createdAt || "").slice(0, 10) === dateStr).length, closedCount: filteredDefects.filter(d => d.closeDateTime?.slice(0, 10) === dateStr).length };
    });
    return {
      allDashPlans, tcCount: dashRunId ? runTcCount : filteredTCs.length, entryCount: filteredEntries.length,
      passedTotal, failedTotal,
      passRate: runTcCount > 0 ? Math.round((new Set(filteredEntries.filter(e => e.execStatus !== "Not Run").map(e => e.testCaseId)).size / runTcCount) * 100) : 0,
      defTotal: filteredDefects.length, openDefs,
      execByStatus, defByStatus, defByPriority, perPlanStats, trendDays, defectTrendDays, availableRuns,
    };
  }, [dashProjectId, dashPlanId, dashRunId, projects, allTestCases, runs, defects]);

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
  }, [runs]);

  const sortedFilteredTC = useMemo(
    () => applySort(filteredTC, tcSortCol, tcSortDir),
    [filteredTC, tcSortCol, tcSortDir]
  );

  const sortedFilteredDefects = useMemo(
    () => applySort(filteredDefects, defSortCol, defSortDir),
    [filteredDefects, defSortCol, defSortDir]
  );

  function applySort(arr, col, dir) {
    if (!col) return arr;
    return [...arr].sort((a, b) => {
      let av = col === "aged"
        ? agedDays(a.dateRaised)
        : col === "openDateTime" || col === "closeDateTime"
          ? new Date(a[col] || 0).getTime()
          : (a[col] ?? "");
      let bv = col === "aged"
        ? agedDays(b.dateRaised)
        : col === "openDateTime" || col === "closeDateTime"
          ? new Date(b[col] || 0).getTime()
          : (b[col] ?? "");
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const filteredRuns = useMemo(() => {
    const q = runSearch.trim().toLowerCase();
    return sortedRuns.filter(run => {
      const matchesSearch = !q
        || run.runNumber?.toLowerCase().includes(q)
        || run.name?.toLowerCase().includes(q)
        || run.tester?.toLowerCase().includes(q);

      let matchesDate = true;
      if (runDateRule !== "Any" && runDateValue) {
        const src = run.createdAt ? new Date(run.createdAt) : null;
        if (!src || Number.isNaN(src.getTime())) {
          matchesDate = false;
        } else {
          const start = new Date(`${runDateValue}T00:00:00`);
          const end = new Date(`${runDateValue}T23:59:59`);
          if (runDateRule === "Before") matchesDate = src < start;
          else if (runDateRule === "After") matchesDate = src > end;
          else if (runDateRule === "On") matchesDate = src >= start && src <= end;
        }
      }

      return matchesSearch && matchesDate;
    });
  }, [sortedRuns, runSearch, runDateRule, runDateValue]);

  const filteredSortedUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const filtered = (users || []).filter(user => {
      const matchesSearch = !q
        || user.username?.toLowerCase().includes(q)
        || user.displayName?.toLowerCase().includes(q)
        || user.role?.toLowerCase().includes(q);

      const matchesRole = userRoleFilter === "All" || user.role === userRoleFilter;
      const matchesActive = userActiveFilter === "All"
        || (userActiveFilter === "Active" && user.isActive)
        || (userActiveFilter === "Inactive" && !user.isActive);

      return matchesSearch && matchesRole && matchesActive;
    });

    const sorted = [...filtered].sort((a, b) => {
      let av;
      let bv;

      if (userSortCol === "createdAt") {
        av = new Date(a.createdAt || 0).getTime();
        bv = new Date(b.createdAt || 0).getTime();
      } else if (userSortCol === "isActive") {
        av = a.isActive ? 1 : 0;
        bv = b.isActive ? 1 : 0;
      } else {
        av = (a[userSortCol] ?? "").toString().toLowerCase();
        bv = (b[userSortCol] ?? "").toString().toLowerCase();
      }

      if (av < bv) return userSortDir === "asc" ? -1 : 1;
      if (av > bv) return userSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [users, userSearch, userRoleFilter, userActiveFilter, userSortCol, userSortDir]);

  function toggleUserSort(col) {
    if (userSortCol === col) {
      setUserSortDir(d => d === "asc" ? "desc" : "asc");
      return;
    }
    setUserSortCol(col);
    setUserSortDir("asc");
  }

  const selectedProject = useMemo(
    () => projects.find(p => String(p.id) === String(selectedProjectId)) || null,
    [projects, selectedProjectId]
  );

  const selectedProjectPlans = useMemo(
    () => selectedProject?.testPlans || [],
    [selectedProject]
  );

  const allTestCaseById = useMemo(() => {
    const map = {};
    (allTestCases || []).forEach(tc => {
      map[tc.id] = tc;
    });
    return map;
  }, [allTestCases]);

  const testPlanMetaById = useMemo(() => {
    const map = {};
    (projects || []).forEach(p => {
      (p.testPlans || []).forEach(tp => {
        map[tp.id] = { testPlanName: tp.name, projectName: p.name };
      });
    });
    return map;
  }, [projects]);

  const testScopesByPlanId = useMemo(() => {
    const map = {};
    (projects || []).forEach(p => {
      (p.testPlans || []).forEach(tp => {
        map[tp.id] = tp.testScopes || [];
      });
    });
    return map;
  }, [projects]);

  const testScopeNameById = useMemo(() => {
    const map = {};
    Object.values(testScopesByPlanId).forEach(scopes => {
      (scopes || []).forEach(scope => {
        map[scope.id] = scope.name;
      });
    });
    return map;
  }, [testScopesByPlanId]);

  const visibleTabs = TABS;

  useEffect(() => {
    if (!isAdmin && activeTab === "users") {
      setActiveTab("projects");
    }
  }, [isAdmin, activeTab]);

  /* ── CRUD functions ── */
  async function addTC() {
    if (!selectedTestPlanId) {
      alert("Please select a test plan first.");
      return;
    }

    try {
      const tc = await api.createTestCase({
        testPlanId: Number(selectedTestPlanId),
        testScopeId: newTC.testScopeId ? Number(newTC.testScopeId) : null,
        name: newTC.name,
        description: newTC.description,
        steps: newTC.steps,
        expectedResult: newTC.expected,
        priority: newTC.priority,
        category: newTC.category,
        remarks: newTC.remarks,
      });

      if (newTCAttachments.length > 0) {
        const uploaded = await api.uploadTestCaseAttachments(tc.id, newTCAttachments, getCurrentUserName());
        setTestCaseAttachments(p => ({ ...p, [tc.id]: uploaded }));
      }

      setTestCases(p => [...p, tc]);
      setAllTestCases(p => [...p, tc]);
      setNewTC(blankTC);
      setNewTCAttachments([]);
      setShowAddTC(false);
    } catch (e) { alert("Failed to add test case: " + e.message); }
  }

  async function handleImportTestCases(file) {
    if (!file) return;
    if (!canWrite) {
      alert("You do not have permission to import test cases.");
      return;
    }

    setImportingTestCases(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames.find(name => /test\s*cases?/i.test(name)) || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("The workbook does not contain any sheets.");
      }

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      if (!rows.length) {
        throw new Error("No data rows were found in the selected sheet.");
      }

      const allPlans = (projects || []).flatMap(project => project.testPlans || []);
      const imported = [];
      const failures = [];

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + 2;
        const rowMap = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeExcelHeader(key), value]));
        const pick = (...keys) => {
          for (const key of keys) {
            const normalized = normalizeExcelHeader(key);
            const value = rowMap[normalized];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
              return value;
            }
          }
          return undefined;
        };

        const name = String(pick("Name", "Test Name", "Title") ?? "").trim();
        if (!name) {
          failures.push(`Row ${rowNumber}: Name is required.`);
          continue;
        }

        const planValue = String(pick("Test Plan", "Plan") ?? "").trim();
        const matchedPlan = allPlans.find(plan => String(plan.name || "").trim().toLowerCase() === planValue.toLowerCase());
        const testPlanId = matchedPlan?.id;

        if (!planValue) {
          failures.push(`Row ${rowNumber}: Test Plan is required.`);
          continue;
        }

        if (!testPlanId) {
          failures.push(`Row ${rowNumber}: Test Plan '${planValue}' not found.`);
          continue;
        }

        const scopeValue = pick("Test Scope", "Scope");
        let testScopeId = null;
        if (scopeValue !== undefined) {
          const plan = allPlans.find(item => item.id === testPlanId);
          const scopeName = String(scopeValue).trim().toLowerCase();
          if (scopeName) {
            const matchedScope = (plan?.testScopes || []).find(scope => String(scope.name || "").trim().toLowerCase() === scopeName);
            if (matchedScope) {
              testScopeId = matchedScope.id;
            } else {
              failures.push(`Row ${rowNumber}: Test Scope '${String(scopeValue).trim()}' not found under Test Plan '${planValue}'.`);
              continue;
            }
          }
        }

        try {
          const created = await api.createTestCase({
            testPlanId,
            testScopeId,
            name,
            description: String(pick("Description") ?? ""),
            steps: String(pick("Steps", "Step") ?? ""),
            expectedResult: String(pick("Expected Result", "Expected") ?? ""),
            priority: String(pick("Priority") ?? "Medium") || "Medium",
            category: String(pick("Category") ?? "General") || "General",
            remarks: String(pick("Remarks", "Remark") ?? ""),
          });
          imported.push(created);
        } catch (error) {
          failures.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      if (imported.length > 0) {
        setTestCases(p => [...p, ...imported]);
        setAllTestCases(p => [...p, ...imported]);
      }

      alert(
        `Imported ${imported.length} test case(s).` +
        (failures.length ? ` ${failures.length} row(s) failed.` : "")
      );
    } catch (error) {
      alert(`Failed to import test cases: ${error.message}`);
    } finally {
      setImportingTestCases(false);
    }
  }

  async function updateTC() {
    try {
      const updated = await api.updateTestCase(editTC.id, {
        testPlanId: editTC.testPlanId,
        testScopeId: editTC.testScopeId ? Number(editTC.testScopeId) : null,
        name: editTC.name,
        description: editTC.description,
        steps: editTC.steps,
        expectedResult: editTC.expected,
        priority: editTC.priority,
        category: editTC.category,
        remarks: editTC.remarks,
      });

      setTestCases(p =>
        p.map(tc => tc.id === updated.id ? updated : tc)
      );

      setAllTestCases(p =>
        p.map(tc => tc.id === updated.id ? updated : tc)
      );

      setViewTC(updated);
      setEditTC(null);

    } catch (e) {
      alert("Failed to update test case: " + e.message);
    }
  }

  async function addRun() {
    try {
      const selectedTesters = newRun.selectedTesters.length > 0 ? newRun.selectedTesters : [getCurrentUserName()];
      const run = await api.createTestRun({
        name: newRun.name,
        tester: selectedTesters.join(", "),
        testCaseIds: newRun.selectedTcIds,
      });
      setRuns(p => [...p, run]);
      setNewRun(blankRun);
      setTesterSearch("");
      setShowAddRun(false);
    } catch (e) { alert("Failed to create run: " + e.message); }
  }

  async function saveRunEdits() {
    if (!editRun) return;
    try {
      const selectedTesters = editRun.selectedTesters.length > 0 ? editRun.selectedTesters : [editRun.tester || getCurrentUserName()];
      const updated = await api.updateTestRun(editRun.id, {
        name: editRun.name,
        tester: selectedTesters.join(", "),
      });
      setRuns(p => p.map(r => r.id === updated.id ? { ...r, name: updated.name, tester: updated.tester } : r));
      setViewRun(r => r?.id === updated.id ? { ...r, name: updated.name, tester: updated.tester } : r);
      setEditRun(null);
      setEditRunTesterSearch("");
    } catch (e) { alert("Failed to update run: " + e.message); }
  }

  async function deleteRuns(ids) {
    try {
      await Promise.all(ids.map(id => api.deleteTestRun(id)));
      setRuns(p => p.filter(r => !ids.includes(r.id)));
      setViewRun(r => (r && ids.includes(r.id) ? null : r));
      setSelectedRunIds([]);
    } catch (e) { alert("Failed to delete run(s): " + e.message); }
  }

  async function deleteTestCases(ids) {
    try {
      await Promise.all(ids.map(id => api.deleteTestCase(id)));
      setTestCases(p => p.filter(tc => !ids.includes(tc.id)));
      setAllTestCases(p => p.filter(tc => !ids.includes(tc.id)));
      setSelectedTcIds([]);
    } catch (e) { alert("Failed to delete: " + e.message); }
  }

  async function deleteDefects(ids) {
    try {
      await Promise.all(ids.map(id => api.deleteDefect(id)));
      setDefects(p => p.filter(def => !ids.includes(def.id)));
      setSelectedDefectIds([]);
      setViewDef(d => (d && ids.includes(d.id) ? null : d));
    } catch (e) { alert("Failed to delete defect(s): " + e.message); }
  }

  function openAddUser() {
    setNewUserName("");
    setNewUserDisplayName("");
    setNewUserRole("Viewer");
    setNewUserActive(true);
    setShowAddUser(true);
  }

  async function createUserAccount() {
    if (!isValidEmail(newUserName)) {
      alert("Username must be a valid email address.");
      return;
    }

    try {
      const created = await api.createUser({
        username: newUserName.trim(),
        displayName: newUserDisplayName.trim(),
        role: newUserRole,
        isActive: newUserActive,
      });

      setUsers(p => [...p, created.user]);
      setShowAddUser(false);

      // Open admin's email client with pre-filled initial password email to the new user
      const subject = "Test Management System - Your Account Has Been Created";
      const body = [
        `Dear ${newUserDisplayName.trim()},`,
        "",
        "Welcome to the Test Management System! Your account has been created.",
        "",
        "Your login credentials:",
        `  Username (Email): ${newUserName.trim()}`,
        `  Password: ${created.initialPassword}`,
        "",
        "Please log in and update your password immediately when prompted.",
        "",
        "Best regards,",
        getCurrentUserName() || "System Administrator",
      ].join("\n");

      const mailto = `mailto:${encodeURIComponent(newUserName.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    } catch (error) {
      alert(`Failed to create user: ${error.message}`);
    }
  }

  async function handleForcePasswordChange() {
    setPasswordChangeError("");

    if (!currentPasswordForChange.trim()) {
      setPasswordChangeError("Current password is required.");
      return;
    }

    if (!newPasswordForChange.trim()) {
      setPasswordChangeError("New password cannot be empty.");
      return;
    }

    if (newPasswordForChange !== confirmPasswordForChange) {
      setPasswordChangeError("New passwords do not match.");
      return;
    }

    if (newPasswordForChange.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters.");
      return;
    }

    try {
      await api.changeUserPassword(authUser.id, currentPasswordForChange, newPasswordForChange);
      const updatedAuth = JSON.parse(localStorage.getItem("uatAuth"));
      updatedAuth.user.mustChangePassword = false;
      localStorage.setItem("uatAuth", JSON.stringify(updatedAuth));
      setCurrentPasswordForChange("");
      setNewPasswordForChange("");
      setConfirmPasswordForChange("");
      setPasswordChangeError("");
      setShowForcePasswordChange(false);
      // Update authUser last — this triggers the intercept screen to dismiss and loads the app
      setAuthUser({ ...authUser, mustChangePassword: false });
    } catch (error) {
      setPasswordChangeError(error.message || "Failed to change password.");
    }
  }

  function openEditUser(user) {
    setEditUser(user);
  }

  async function saveUserAccount() {
    if (!isValidEmail(editUser?.username)) {
      alert("Username must be a valid email address.");
      return;
    }

    try {
      const updated = await api.updateUser(editUser.id, {
        username: editUser.username.trim(),
        displayName: editUser.displayName.trim(),
        password: editUser.password || "",
        role: editUser.role,
        isActive: editUser.isActive,
      });
      setUsers(p => p.map(user => user.id === updated.id ? updated : user));
      setEditUser(null);
    } catch (error) {
      alert(`Failed to update user: ${error.message}`);
    }
  }

  async function deleteUserAccount(id) {
    try {
      await api.deleteUser(id);
      setUsers(p => p.filter(user => user.id !== id));
      if (authUser?.id === id) {
        handleLogout();
      }
    } catch (error) {
      alert(`Failed to delete user: ${error.message}`);
    }
  }

  async function resetUserPassword(user) {
    const cooldownKey = `reset-${user.id}`;
    const remaining = getPwCooldownRemaining(cooldownKey);
    if (remaining > 0) {
      alert(`Please wait ${remaining} second(s) before resetting this user's password again.`);
      return;
    }
    const ok = window.confirm(`Reset password for ${user.username}? A new temporary password will be generated.`);
    if (!ok) return;

    try {
      const result = await api.resetUserPassword(user.id);

      // Start cooldown based on server response or fallback to 60s
      const cooldownSec = result.cooldownSeconds ?? 60;
      setPwCooldowns(prev => ({ ...prev, [cooldownKey]: Date.now() + cooldownSec * 1000 }));

      setUsers(prev => prev.map(u => (u.id === result.user.id ? result.user : u)));

      const subject = "Test Management System - Your Password Has Been Reset";
      const body = [
        `Dear ${user.displayName},`,
        "",
        "Your password has been reset by the administrator.",
        "Your updated login credentials:",
        `  Username (Email): ${user.username}`,
        `  Password: ${result.initialPassword}`,
        "",
        "Please log in and update your password immediately when prompted.",
        "",
        "Best regards,",
        getCurrentUserName() || "System Administrator",
      ].join("\n");

      const mailto = `mailto:${encodeURIComponent(user.username)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    } catch (error) {
      // Parse 429 remaining seconds if available
      try {
        const errData = JSON.parse(error.message);
        if (errData?.remainingSeconds) {
          setPwCooldowns(prev => ({ ...prev, [cooldownKey]: Date.now() + errData.remainingSeconds * 1000 }));
          alert(`Please wait ${errData.remainingSeconds} second(s) before resetting this user's password again.`);
          return;
        }
      } catch (_) { /* not JSON */ }
      alert(`Failed to reset password: ${error.message}`);
    }
  }

  async function toggleNotificationsPanel() {
    const next = !showNotifications;
    setShowNotifications(next);
    if (!next) return;

    try {
      const items = await api.getNotifications(false);
      setNotifications(items || []);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }

  async function markNotificationAsRead(notification) {
    try {
      if (!notification.isRead) {
        await api.markNotificationRead(notification.id);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      }

      const link = (notification.link || "").trim();
      const runMatch = link.match(/^\/runs\/(\d+)$/);
      const defectMatch = link.match(/^\/defects\/(\d+)$/);

      if (runMatch) {
        const runId = Number(runMatch[1]);
        setActiveTab("runs");

        let targetRun = (runs || []).find(r => r.id === runId);
        if (!targetRun) {
          const refreshedRuns = await api.getTestRuns();
          setRuns(refreshedRuns || []);
          targetRun = (refreshedRuns || []).find(r => r.id === runId);
        }

        if (targetRun) {
          setViewRun(targetRun);
          setShowNotifications(false);
        }
        return;
      }

      if (defectMatch) {
        const defectId = Number(defectMatch[1]);
        setActiveTab("defects");

        let targetDefect = (defects || []).find(d => d.id === defectId);
        if (!targetDefect) {
          const refreshedDefects = await api.getDefects();
          setDefects(refreshedDefects || []);
          targetDefect = (refreshedDefects || []).find(d => d.id === defectId);
        }

        if (targetDefect) {
          setViewDef(targetDefect);
          setShowNotifications(false);
        }
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function markAllNotificationsAsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }

  async function clearAllNotifications() {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
    } catch (error) {
      console.error("Failed to clear all notifications:", error);
    }
  }

  async function duplicateTC(tc) {
    try {
      const duped = await api.createTestCase({
        testPlanId: tc.testPlanId || (selectedTestPlanId ? Number(selectedTestPlanId) : null),
        testScopeId: tc.testScopeId || null,
        name: tc.name + " (Copy)",
        description: tc.description,
        steps: tc.steps,
        expectedResult: tc.expectedResult,
        priority: tc.priority,
        category: tc.category,
        remarks: tc.remarks,
      });
      setTestCases(p => [...p, duped]);
      setAllTestCases(p => [...p, duped]);
      setContextMenu(null);
    } catch (e) { alert("Failed to duplicate: " + e.message); }
  }

  async function addProject() {
    if (!canManageProjects) {
      alert("You do not have permission to create projects.");
      return;
    }
    if (!newProjectName.trim() || !isValidDateRange(newProjectStartDate, newProjectEndDate)) return;
    try {
      const p = await api.createProject({
        name: newProjectName.trim(),
        startDate: newProjectStartDate,
        endDate: newProjectEndDate,
      });
      setProjects(prev => [...prev, { ...p, testPlans: p.testPlans || [] }]);
      setSelectedProjectId(String(p.id));
      setSelectedTestPlanId("");
      setNewProjectName("");
      setNewProjectStartDate("");
      setNewProjectEndDate("");
      setShowAddProject(false);
    } catch (e) {
      alert("Failed to create project: " + e.message);
    }
  }

  async function addTestPlan() {
    if (!canManageProjects) {
      alert("You do not have permission to create test plans.");
      return;
    }
    if (!selectedProjectId) {
      alert("Please select a project first.");
      return;
    }
    if (!newPlanName.trim() || !isValidDateRange(newPlanStartDate, newPlanEndDate)) return;

    try {
      const plan = await api.createTestPlan(selectedProjectId, {
        name: newPlanName.trim(),
        startDate: newPlanStartDate,
        endDate: newPlanEndDate,
      });
      setProjects(prev => prev.map(p => String(p.id) !== String(selectedProjectId)
        ? p
        : { ...p, testPlans: [...(p.testPlans || []), plan] }));
      setSelectedTestPlanId(String(plan.id));
      setNewPlanName("");
      setNewPlanStartDate("");
      setNewPlanEndDate("");
      setShowAddPlan(false);
    } catch (e) {
      alert("Failed to create test plan: " + e.message);
    }
  }

  async function updateProjectName() {
    if (!canManageProjects) {
      alert("You do not have permission to edit projects.");
      return;
    }
    if (!editingProjectId || !editProjectName.trim() || !isValidDateRange(editProjectStartDate, editProjectEndDate)) return;
    try {
      const updated = await api.updateProject(editingProjectId, {
        name: editProjectName.trim(),
        startDate: editProjectStartDate,
        endDate: editProjectEndDate,
      });
      setProjects(prev => prev.map(p => String(p.id) !== String(editingProjectId)
        ? p
        : { ...p, name: updated.name, startDate: updated.startDate, endDate: updated.endDate }));
      setShowEditProject(false);
      setEditingProjectId(null);
      setEditProjectName("");
      setEditProjectStartDate("");
      setEditProjectEndDate("");
    } catch (e) {
      alert("Failed to update project: " + e.message);
    }
  }

  async function updateTestPlanName() {
    if (!editingPlanId || !editPlanName.trim() || !isValidDateRange(editPlanStartDate, editPlanEndDate)) return;
    try {
      const updated = await api.updateTestPlan(editingPlanId, {
        name: editPlanName.trim(),
        startDate: editPlanStartDate,
        endDate: editPlanEndDate,
      });
      setProjects(prev => prev.map(p => ({
        ...p,
        testPlans: (p.testPlans || []).map(tp => String(tp.id) !== String(editingPlanId)
          ? tp
          : { ...tp, name: updated.name, startDate: updated.startDate, endDate: updated.endDate })
      })));
      setShowEditPlan(false);
      setEditingPlanId(null);
      setEditPlanName("");
      setEditPlanStartDate("");
      setEditPlanEndDate("");
    } catch (e) {
      alert("Failed to update test plan: " + e.message);
    }
  }

  async function deleteProject(projectId) {
    try {
      await api.deleteProject(projectId);
      const remainingProjects = projects.filter(p => String(p.id) !== String(projectId));
      setProjects(remainingProjects);

      if (String(selectedProjectId) === String(projectId)) {
        const first = remainingProjects[0];
        setSelectedProjectId(first ? String(first.id) : "");
        const firstPlan = first?.testPlans?.[0];
        setSelectedTestPlanId(firstPlan ? String(firstPlan.id) : "");
      }
    } catch (e) {
      alert("Failed to delete project: " + e.message);
    }
  }

  async function deleteTestPlan(testPlanId) {
    try {
      await api.deleteTestPlan(testPlanId);
      setProjects(prev => prev.map(p => ({
        ...p,
        testPlans: (p.testPlans || []).filter(tp => String(tp.id) !== String(testPlanId))
      })));

      if (String(selectedTestPlanId) === String(testPlanId)) {
        setSelectedTestPlanId("");
      }

      if (managingTestPlan?.id === testPlanId) {
        setShowManageScopes(false);
        setManagingTestPlan(null);
      }
    } catch (e) {
      alert("Failed to delete test plan: " + e.message);
    }
  }

  function openManageScopes(tp) {
    setManagingTestPlan({ id: tp.id, name: tp.name });
    setNewScopeName("");
    setShowManageScopes(true);
  }

  async function addTestingScope() {
    if (!managingTestPlan?.id || !newScopeName.trim()) return;
    try {
      const created = await api.createTestPlanScope(managingTestPlan.id, newScopeName.trim());
      setProjects(prev => prev.map(project => ({
        ...project,
        testPlans: (project.testPlans || []).map(plan =>
          plan.id !== managingTestPlan.id
            ? plan
            : { ...plan, testScopes: [...(plan.testScopes || []), created].sort((a, b) => a.name.localeCompare(b.name)) }
        )
      })));
      setNewScopeName("");
    } catch (error) {
      alert(`Failed to add testing scope: ${error.message}`);
    }
  }

  async function deleteTestingScope(scopeId) {
    if (!managingTestPlan?.id) return;
    try {
      await api.deleteTestPlanScope(managingTestPlan.id, scopeId);
      setProjects(prev => prev.map(project => ({
        ...project,
        testPlans: (project.testPlans || []).map(plan =>
          plan.id !== managingTestPlan.id
            ? plan
            : { ...plan, testScopes: (plan.testScopes || []).filter(scope => scope.id !== scopeId) }
        )
      })));

      setNewTC(prev => String(prev.testScopeId) === String(scopeId) ? { ...prev, testScopeId: "" } : prev);
      setEditTC(prev => prev && String(prev.testScopeId) === String(scopeId) ? { ...prev, testScopeId: "" } : prev);
      setViewTC(prev => prev && String(prev.testScopeId) === String(scopeId) ? { ...prev, testScopeId: null } : prev);
    } catch (error) {
      alert(`Failed to delete testing scope: ${error.message}`);
    }
  }

  async function duplicateDefect(def) {
    try {
      const run = runs.find(r => r.runNumber === def.runNumber);
      const tc = testCases.find(t => t.tcNumber === def.tcNumber);
      if (!run || !tc) { alert("Cannot duplicate: linked run or TC not found."); return; }
      const duped = await api.createDefect({
        testRunId: run.id,
        testCaseId: tc.id,
        testPlanId: def.testPlanId ?? null,
        market: def.market,
        description: def.description + " (Copy)",
        issueType: def.issueType,
        expectedResult: def.expectedResult,
        actualResult: def.actualResult,
        priority: def.priority,
        raisedBy: def.raisedBy,
        assignedTo: def.assignedTo,
        targetFixDate: def.targetFixDate || null,
        remarks: def.remarks,
      });
      setDefects(p => [...p, duped]);
      setContextMenu(null);
    } catch (e) { alert("Failed to duplicate: " + e.message); }
  }

  async function addTcToRun(runId, tcId) {
    try {
      const updatedRun = await api.addEntryToRun(runId, tcId);
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r,
        entries: r.entries.map(e =>
          e.testCaseId !== tcId
            ? e
            : { ...e, defects: [...(e.defects || []), duped] }
        )
      }));
      setViewRun(updatedRun);
    } catch (e) { alert("Failed to add TC: " + e.message); }
  }

  async function removeTcFromRun(runId, tcId) {
    try {
      await api.removeEntryFromRun(runId, tcId);
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r,
        entries: r.entries.filter(e => e.testCaseId !== tcId)
      }));
      setViewRun(r => ({
        ...r,
        entries: r.entries.filter(e => e.testCaseId !== tcId)
      }));
    } catch (e) { alert("Failed to remove TC: " + e.message); }
  }

  async function updateExecStatus(runId, tcId, status) {
    try {
      const run = runs.find(r => r.id === runId);
      const entry = run?.entries.find(e => e.testCaseId === tcId);
      if (!entry) return;
      const result = await api.updateEntry(runId, tcId, { execStatus: status, comment: entry.comment });
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r,
        entries: r.entries.map(e =>
          e.testCaseId !== tcId
            ? e
            : { ...e, execStatus: status, statusChangedAt: result.statusChangedAt, statusChangedBy: result.statusChangedBy }
        )
      }));
      setViewRun(r => ({
        ...r,
        entries: r.entries.map(e =>
          e.testCaseId !== tcId
            ? e
            : { ...e, execStatus: status, statusChangedAt: result.statusChangedAt, statusChangedBy: result.statusChangedBy }
        )
      }));
    } catch (e) { console.error("Failed to update status:", e); }
  }

  async function updateExecComment(runId, tcId, comment) {
    try {
      const run = runs.find(r => r.id === runId);
      const entry = run?.entries.find(e => e.testCaseId === tcId);
      if (!entry) return;
      await api.updateEntry(runId, tcId, { execStatus: entry.execStatus, comment });
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r,
        entries: r.entries.map(e =>
          e.testCaseId !== tcId
            ? e
            : { ...e, comment }
        )
      }));
      setViewRun(r => ({
        ...r,
        entries: r.entries.map(e =>
          e.testCaseId !== tcId
            ? e
            : { ...e, comment }
        )
      }));
    } catch (e) { console.error("Failed to update comment:", e); }
  }

  async function addComment(runId, tcId) {

    const message = commentDrafts[tcId];

    if (!message?.trim()) return;

    try {
      const savedComment = await api.addRunEntryComment(runId, tcId, message.trim());

      setRuns(p =>
        p.map(r =>
          r.id !== runId
            ? r
            : {
              ...r,
              entries: r.entries.map(e =>
                e.testCaseId !== tcId
                  ? e
                  : {
                    ...e,
                    comments: [
                      ...(e.comments || []),
                      savedComment
                    ]
                  }
              )
            }
        )
      );

      setViewRun(r => r && r.id === runId
        ? {
          ...r,
          entries: (r.entries || []).map(e =>
            e.testCaseId !== tcId
              ? e
              : {
                ...e, comments: [
                  ...(e.comments || []),
                  savedComment
                ]
              }
          )
        }
        : r
      );

      setCommentDrafts(p => ({
        ...p,
        [tcId]: ""
      }));
    } catch (error) {
      alert(`Failed to add comment: ${error.message}`);
    }
  }

  async function deleteComment(runId, tcId, commentId) {
    try {
      await api.deleteRunEntryComment(runId, tcId, commentId);

      setRuns(p =>
        p.map(r =>
          r.id !== runId
            ? r
            : {
              ...r,
              entries: r.entries.map(e =>
                e.testCaseId !== tcId
                  ? e
                  : {
                    ...e,
                    comments: (e.comments || []).filter(
                      c => c.id !== commentId
                    )
                  }
              )
            }
        )
      );

      setViewRun(r => r && r.id === runId
        ? {
          ...r,
          entries: (r.entries || []).map(e =>
            e.testCaseId !== tcId
              ? e
              : {
                ...e, comments: (e.comments || []).filter(
                  c => c.id !== commentId
                )
              }
          )
        }
        : r
      );
    } catch (error) {
      alert(`Failed to delete comment: ${error.message}`);
    }
  }

  function createDefect(runId, tcId) {
    const tc = allTestCaseById[tcId];
    setNewDef({ ...blankDef, raisedBy: getCurrentUserDisplayName() });
    setNewDefAttachments([]);
    setShowAddDef({ runId, tcId, tcName: tc?.name || tcId });
  }

  function createStandaloneDefect() {
    setNewDef({ ...blankDef, issueType: "Functional Issue", raisedBy: getCurrentUserDisplayName() });
    setNewDefAttachments([]);
    setShowAddDef({ runId: null, tcId: null, tcName: "No linked test case" });
  }

  async function submitDefect() {
    try {
      const { runId, tcId } = showAddDef;
      const defect = await api.createDefect({
        testRunId: runId,
        testCaseId: tcId,
        testPlanId: selectedTestPlanId ? Number(selectedTestPlanId) : null,
        market: newDef.market,
        description: newDef.description,
        issueType: newDef.issueType,
        expectedResult: newDef.expected,
        actualResult: newDef.actual,
        priority: newDef.priority,
        raisedBy: getCurrentUserDisplayName(),
        assignedTo: newDef.assignedTo,
        targetFixDate: newDef.targetFix || null,
        remarks: newDef.remarks,
      });

      if (newDefAttachments.length > 0) {
        const uploaded = await api.uploadDefectAttachments(defect.id, newDefAttachments, getCurrentUserName());
        setDefectAttachments(p => ({ ...p, [defect.id]: uploaded }));
      }

      setDefects(p => [...p, defect]);
      if (runId && tcId) {
        setRuns(p => p.map(r => r.id !== runId ? r : {
          ...r,
          entries: r.entries.map(e =>
            e.testCaseId !== tcId
              ? e
              : { ...e, defects: [...(e.defects || []), defect] }
          )
        }));
        setViewRun(r => !r || r?.id !== runId ? r : {
          ...r,
          entries: (r.entries || []).map(e =>
            e.testCaseId !== tcId
              ? e
              : { ...e, defects: [...(e.defects || []), defect] }
          )
        });
      }
      setNewDef(blankDef);
      setNewDefAttachments([]);
      setShowAddDef(null);
    } catch (e) { alert("Failed to create defect: " + e.message); }
  }

  function queueNewDefectFiles(files) {
    const selected = Array.from(files || []).filter(f => f && f.size > 0);
    if (selected.length === 0) return;
    setNewDefAttachments(p => [...p, ...selected]);
  }

  function removeQueuedNewDefectFile(indexToRemove) {
    setNewDefAttachments(p => p.filter((_, i) => i !== indexToRemove));
  }

  function onNewDefectPasteUpload(e) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type?.startsWith("image/"));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    queueNewDefectFiles(imageFiles);
  }

  async function updateDefStatus(id, v) {
    if (!canUpdateDefectStatus) return;
    try {
      const updated = await api.updateDefectStatus(id, v, getCurrentUserName());
      setDefects(p => p.map(d => d.id === id ? updated : d));
      setViewDef(d => d?.id === id ? updated : d);
    } catch (e) { console.error("Failed to update defect status:", e); }
  }

  async function updateDefAssignedTo(def, assignedTo) {
    if (!canAssignDefect) return;

    try {
      const updated = await api.updateDefectAssignee(def.id, assignedTo, getCurrentUserName());

      setDefects(p => p.map(d => d.id === def.id ? updated : d));
      setViewDef(d => d?.id === def.id ? updated : d);
      setEditDef(d => d?.id === def.id ? updated : d);
    } catch (e) {
      alert("Failed to update assignee: " + e.message);
    }
  }

  async function saveDefectEdits() {
    if (!editDef) return;

    const runId = editDef.linkedRunId ? Number(editDef.linkedRunId) : null;
    const tcId = editDef.linkedTestCaseId ? Number(editDef.linkedTestCaseId) : null;

    if (!runId && tcId) {
      alert("Please select a Run when selecting a Test Case.");
      return;
    }

    try {
      const updated = await api.updateDefect(editDef.id, {
        testRunId: runId,
        testCaseId: tcId,
        testPlanId: editDef.testPlanId ?? null,
        market: editDef.market,
        description: editDef.description,
        issueType: editDef.issueType,
        expectedResult: editDef.expectedResult,
        actualResult: editDef.actualResult,
        priority: editDef.priority,
        raisedBy: editDef.raisedBy,
        assignedTo: editDef.assignedTo,
        dateRaised: editDef.dateRaised,
        targetFixDate: editDef.targetFixDate || null,
        remarks: editDef.remarks,
        status: editDef.status,
      }, getCurrentUserName());

      setDefects(p => p.map(d => d.id === updated.id ? updated : d));
      setViewDef(d => d?.id === updated.id ? updated : d);

      if (newDefAttachments.length > 0) {
        try {
          const uploaded = await api.uploadDefectAttachments(updated.id, newDefAttachments, getCurrentUserName());
          setDefectAttachments(p => ({
            ...p,
            [updated.id]: [...(p[updated.id] || []), ...uploaded],
          }));
        } catch (uploadErr) {
          alert("Defect saved but attachment upload failed: " + uploadErr.message);
        }
        setNewDefAttachments([]);
      }

      setEditDef(null);
    } catch (e) {
      alert("Failed to update defect: " + e.message);
    }
  }

  async function addDefectComment(defectId) {
    const message = defectCommentDrafts[defectId];
    if (!message?.trim()) return;

    try {
      const savedComment = await api.addDefectComment(defectId, message.trim());

      setDefects(p => p.map(d => d.id !== defectId
        ? d
        : { ...d, comments: [...(d.comments || []), savedComment] }
      ));

      setViewDef(d => d?.id !== defectId
        ? d
        : { ...d, comments: [...(d.comments || []), savedComment] }
      );

      setEditDef(d => d?.id !== defectId
        ? d
        : { ...d, comments: [...(d.comments || []), savedComment] }
      );

      setDefectCommentDrafts(p => ({
        ...p,
        [defectId]: "",
      }));
    } catch (error) {
      alert(`Failed to add defect comment: ${error.message}`);
    }
  }

  async function deleteDefectComment(defectId, commentId) {
    try {
      await api.deleteDefectComment(defectId, commentId);

      setDefects(p => p.map(d => d.id !== defectId
        ? d
        : {
          ...d, comments: (d.comments || []).filter(
            c => c.id !== commentId
          )
        }
      ));

      setViewDef(d => d?.id !== defectId
        ? d
        : {
          ...d, comments: (d.comments || []).filter(
            c => c.id !== commentId
          )
        }
      );

      setEditDef(d => d?.id !== defectId
        ? d
        : {
          ...d, comments: (d.comments || []).filter(
            c => c.id !== commentId
          )
        }
      );
    } catch (error) {
      alert(`Failed to delete defect comment: ${error.message}`);
    }
  }

  async function uploadDefectFiles(defectId, files) {
    const selected = Array.from(files || []).filter(f => f && f.size > 0);
    if (selected.length === 0) return;

    try {
      setUploadingDefectId(defectId);
      const uploaded = await api.uploadDefectAttachments(defectId, selected, getCurrentUserName());
      if (!Array.isArray(uploaded)) throw new Error("Unexpected server response");
      setDefectAttachments(p => ({
        ...p,
        [defectId]: [...(p[defectId] || []), ...uploaded],
      }));
    } catch (e) {
      alert("Failed to upload attachment(s): " + e.message);
    } finally {
      setUploadingDefectId(null);
    }
  }

  async function deleteDefectAttachment(defectId, attachmentId) {
    try {
      await api.deleteDefectAttachment(defectId, attachmentId);
      setDefectAttachments(p => ({
        ...p,
        [defectId]: (p[defectId] || []).filter(a => a.id !== attachmentId),
      }));
    } catch (e) {
      alert("Failed to delete attachment: " + e.message);
    }
  }

  function onDefectPasteUpload(e, defectId) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type?.startsWith("image/"));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    uploadDefectFiles(defectId, imageFiles);
  }

  async function uploadTestCaseFiles(testCaseId, files) {
    const selected = Array.from(files || []).filter(f => f && f.size > 0);
    if (selected.length === 0) return;

    try {
      setUploadingTestCaseId(testCaseId);
      const uploaded = await api.uploadTestCaseAttachments(testCaseId, selected, getCurrentUserName());
      setTestCaseAttachments(p => ({
        ...p,
        [testCaseId]: [...(p[testCaseId] || []), ...uploaded],
      }));
    } catch (e) {
      alert("Failed to upload test case attachment(s): " + e.message);
    } finally {
      setUploadingTestCaseId(null);
    }
  }

  async function deleteTestCaseAttachment(testCaseId, attachmentId) {
    try {
      await api.deleteTestCaseAttachment(testCaseId, attachmentId);
      setTestCaseAttachments(p => ({
        ...p,
        [testCaseId]: (p[testCaseId] || []).filter(a => a.id !== attachmentId),
      }));
    } catch (e) {
      alert("Failed to delete test case attachment: " + e.message);
    }
  }

  async function openAttachment(url, fileName) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Session expired or access denied. Please login again.");
        }
        if (response.status === 404) {
          throw new Error("Attachment file was not found on server.");
        }

        const text = await response.text();
        throw new Error(text || `Failed to open attachment (HTTP ${response.status}).`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = fileName || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
    } catch (e) {
      alert("Failed to open attachment: " + e.message);
    }
  }

  function onTestCasePasteUpload(e, testCaseId) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type?.startsWith("image/"));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    uploadTestCaseFiles(testCaseId, imageFiles);
  }

  function queueNewTestCaseFiles(files) {
    const selected = Array.from(files || []).filter(f => f && f.size > 0);
    if (selected.length === 0) return;
    setNewTCAttachments(p => [...p, ...selected]);
  }

  function removeQueuedNewTestCaseFile(indexToRemove) {
    setNewTCAttachments(p => p.filter((_, i) => i !== indexToRemove));
  }

  function onNewTestCasePasteUpload(e) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(f => f.type?.startsWith("image/"));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    queueNewTestCaseFiles(imageFiles);
  }

  /* ── Run stats ── */
  function runStats(run) {
    const entries = run.entries || [];
    return {
      total: entries.length,
      pass: entries.filter(e => e.execStatus === "Pass" || e.execStatus === "Passed").length,
      fail: entries.filter(e => e.execStatus === "Fail" || e.execStatus === "Failed").length,
      notRun: entries.filter(e => e.execStatus === "Not Run").length,
    };
  }

  function runStatusPriorityStats(run) {
    const byStatus = {};
    (run.entries || []).forEach(entry => {
      const status = entry.execStatus || "Not Run";
      const tc = allTestCaseById[entry.testCaseId];
      const priority = TEST_CASE_PRIORITIES.includes(tc?.priority) ? tc.priority : "Medium";

      if (!byStatus[status]) {
        byStatus[status] = { High: 0, Medium: 0, Low: 0, total: 0 };
      }

      byStatus[status][priority] += 1;
      byStatus[status].total += 1;
    });

    return byStatus;
  }

  function sortRunEntriesByTestCaseId(entries) {
    return [...(entries || [])].sort((a, b) => {
      const aId = Number(a.testCaseId) || 0;
      const bId = Number(b.testCaseId) || 0;
      return aId - bId;
    });
  }

  function agedDays(dateStr) {
    if (!dateStr) return 0;
    return Math.floor((new Date() - new Date(dateStr)) / 86400000);
  }

  function formatExportDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function appendSheet(workbook, name, rows) {
    const sheetRows = rows.length > 0 ? rows : [{ Info: "No data" }];
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  function downloadWorkbook(filename, sheets) {
    const workbook = XLSX.utils.book_new();
    sheets.forEach(sheet => appendSheet(workbook, sheet.name, sheet.rows));
    XLSX.writeFileXLSX(workbook, filename);
  }

  function downloadTestCaseImportTemplate() {
    const workbook = XLSX.utils.book_new();
    const headers = [
      "Name",
      "Description",
      "Steps",
      "Expected Result",
      "Priority",
      "Category",
      "Remarks",
      "Test Plan",
      "Test Scope",
    ];
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Test Cases");

    const categoryHint = (categories || []).length
      ? (categories || []).join(", ")
      : "Free text (recommended: existing categories in Settings)";

    const guide = XLSX.utils.aoa_to_sheet([
      ["How to Use", "Details"],
      ["Step 1", "Fill in row 2 onward in the Test Cases sheet."],
      ["Step 2", "Upload the file using Import > Import Excel."],
      ["Where to find values", "Use the Test Plan Scope Lookup sheet in this template, or check values in the Projects tab."],
      ["", ""],
      ["Column", "Accepted Values / Rules"],
      ["Name", "Required. Any non-empty text."],
      ["Test Plan", "Required. Must match an existing test plan name exactly."],
      ["Priority", `Optional. Accepted values: ${TEST_CASE_PRIORITIES.join(", ")}. Default: Medium.`],
      ["Category", `Optional. ${categoryHint}`],
      ["Test Scope", "Optional scope name (exact name match). Must belong to the provided Test Plan."],
      ["Description / Steps / Expected Result / Remarks", "Optional free text."],
    ]);
    XLSX.utils.book_append_sheet(workbook, guide, "Instructions");

    const lookupRows = [["Project", "Test Plan", "Test Scope"]];
    (projects || []).forEach(project => {
      const plans = project.testPlans || [];
      if (plans.length === 0) return;

      plans.forEach(plan => {
        const scopes = plan.testScopes || [];
        if (scopes.length === 0) {
          lookupRows.push([project.name || "", plan.name || "", ""]);
          return;
        }

        scopes.forEach(scope => {
          lookupRows.push([project.name || "", plan.name || "", scope.name || ""]);
        });
      });
    });

    if (lookupRows.length === 1) {
      lookupRows.push(["No project/test plan data loaded.", "", ""]);
    }

    const lookupSheet = XLSX.utils.aoa_to_sheet(lookupRows);
    XLSX.utils.book_append_sheet(workbook, lookupSheet, "Test Plan Scope Lookup");

    XLSX.writeFileXLSX(workbook, `test-case-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportTestCases() {
    try {
      const summaryRows = sortedFilteredTC.map(tc => {
        const planMeta = tc.testPlanId ? testPlanMetaById[tc.testPlanId] : null;
        const linkedRuns = runs.filter(run =>
          (run.entries || []).some(entry => entry.testCaseId === tc.id)
        );
        return {
          ID: tc.tcNumber,
          Project: planMeta?.projectName || "",
          "Test Plan": planMeta?.testPlanName || "",
          "Test Name": tc.name || "",
          Category: tc.category || "",
          Priority: tc.priority || "",
          Description: tc.description || "",
          Steps: tc.steps || "",
          "Expected Result": tc.expectedResult || "",
          Remarks: tc.remarks || "",
          "Coverage Count": linkedRuns.length,
          "Covered Runs": linkedRuns.map(run => run.runNumber).join(", "),
        };
      });

      const coverageRows = sortedFilteredTC.flatMap(tc => {
        const planMeta = tc.testPlanId ? testPlanMetaById[tc.testPlanId] : null;
        const linkedRuns = runs.filter(run =>
          (run.entries || []).some(entry => entry.testCaseId === tc.id)
        );
        if (linkedRuns.length === 0) {
          return [{
            ID: tc.tcNumber,
            "Test Name": tc.name || "",
            Project: planMeta?.projectName || "",
            "Test Plan": planMeta?.testPlanName || "",
            Run: "",
            Tester: "",
            "Run Created At": "",
          }];
        }
        return linkedRuns.map(run => ({
          ID: tc.tcNumber,
          "Test Name": tc.name || "",
          Project: planMeta?.projectName || "",
          "Test Plan": planMeta?.testPlanName || "",
          Run: run.runNumber || "",
          Tester: run.tester || "",
          "Run Created At": formatExportDateTime(run.createdAt),
        }));
      });

      const attachmentLists = await Promise.all(
        sortedFilteredTC.map(async tc => ({
          tc,
          attachments: await api.getTestCaseAttachments(tc.id).catch(() => []),
        }))
      );

      const attachmentRows = attachmentLists.flatMap(({ tc, attachments }) => {
        const planMeta = tc.testPlanId ? testPlanMetaById[tc.testPlanId] : null;
        if (!attachments.length) {
          return [];
        }
        return attachments.map(attachment => ({
          ID: tc.tcNumber,
          "Test Name": tc.name || "",
          Project: planMeta?.projectName || "",
          "Test Plan": planMeta?.testPlanName || "",
          File: attachment.fileName || "",
          Url: attachment.url || "",
          "Size (KB)": Math.max(1, Math.round((attachment.size || 0) / 1024)),
          "Uploaded By": attachment.uploadedBy || "",
          "Uploaded At": formatExportDateTime(attachment.uploadedAt),
        }));
      });

      downloadWorkbook(`test-cases-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: "Test Cases", rows: summaryRows },
        { name: "Coverage", rows: coverageRows },
        { name: "Attachments", rows: attachmentRows },
      ]);
    } catch (error) {
      alert(`Failed to export test cases: ${error.message}`);
    }
  }

  function exportRuns() {
    const summaryRows = filteredRuns.map(run => {
      const stats = runStats(run);
      const progress = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
      return {
        Run: run.runNumber || "",
        Name: run.name || "",
        Tester: run.tester || "",
        "Created At": formatExportDateTime(run.createdAt),
        Total: stats.total,
        Pass: stats.pass,
        Fail: stats.fail,
        "Not Run": stats.notRun,
        Progress: `${progress}%`,
      };
    });

    const entryRows = filteredRuns.flatMap(run =>
      (run.entries || []).map(entry => {
        const tc = allTestCaseById[entry.testCaseId] || {};
        return {
          Run: run.runNumber || "",
          "Run Name": run.name || "",
          Tester: run.tester || "",
          "Created At": formatExportDateTime(run.createdAt),
          "TC ID": tc.tcNumber || entry.testCaseId || "",
          "TC Name": tc.name || "",
          Category: tc.category || "",
          Priority: tc.priority || "",
          "TC Description": tc.description || "",
          Steps: tc.steps || "",
          "Expected Result": tc.expectedResult || "",
          Status: entry.execStatus || "Not Run",
          Comment: entry.comment || "",
          "Comment Count": (entry.comments || []).length,
          Comments: (entry.comments || []).map(c => `${c.author || c.createdBy || "User"}: ${c.text || c.comment || ""}`).join(" | "),
          Defects: (entry.defects || []).map(def => def.defectNumber).join(", "),
          "Defect Count": (entry.defects || []).length,
        };
      })
    );

    const commentRows = filteredRuns.flatMap(run =>
      (run.entries || []).flatMap(entry => {
        const tc = allTestCaseById[entry.testCaseId] || {};
        const comments = entry.comments || [];
        if (comments.length === 0) {
          return [];
        }
        return comments.map(comment => ({
          Run: run.runNumber || "",
          "TC ID": tc.tcNumber || entry.testCaseId || "",
          "TC Name": tc.name || "",
          Author: comment.author || comment.createdBy || "",
          Comment: comment.text || comment.comment || "",
          "Created At": formatExportDateTime(comment.createdAt),
        }));
      })
    );

    downloadWorkbook(`test-runs-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Runs", rows: summaryRows },
      { name: "Run Entries", rows: entryRows },
      { name: "Comments", rows: commentRows },
    ]);
  }

  async function exportDefects() {
    try {
      const detailRows = sortedFilteredDefects.map(def => ({
        ID: def.defectNumber || "",
        Run: def.runNumber || "",
        TC: def.tcNumber || "",
        Market: def.market || "",
        Status: def.status || "",
        Priority: def.priority || "",
        "Issue Type": def.issueType || "",
        Description: def.description || "",
        "Expected Result": def.expectedResult || "",
        "Actual Result": def.actualResult || "",
        "Raised By": def.raisedBy || "",
        "Assigned To": def.assignedTo || "",
        Remarks: def.remarks || "",
        "Target Fix Date": formatExportDateTime(def.targetFixDate),
        "Date Raised": formatExportDateTime(def.dateRaised),
        "Open Datetime": formatExportDateTime(def.openDateTime),
        "Close Datetime": formatExportDateTime(def.closeDateTime),
        "Aged (Days)": agedDays(def.dateRaised),
      }));

      const statusRows = sortedFilteredDefects.map(def => ({
        ID: def.defectNumber || "",
        Status: def.status || "",
        Priority: def.priority || "",
        "Raised By": def.raisedBy || "",
        "Assigned To": def.assignedTo || "",
        "Open Datetime": formatExportDateTime(def.openDateTime),
        "Close Datetime": formatExportDateTime(def.closeDateTime),
        "Aged (Days)": agedDays(def.dateRaised),
      }));

      const detailLists = await Promise.all(
        sortedFilteredDefects.map(async def => ({
          def,
          attachments: await api.getDefectAttachments(def.id).catch(() => []),
        }))
      );

      const attachmentRows = detailLists.flatMap(({ def, attachments }) =>
        attachments.map(attachment => ({
          ID: def.defectNumber || "",
          Run: def.runNumber || "",
          TC: def.tcNumber || "",
          File: attachment.fileName || "",
          Url: attachment.url || "",
          "Size (KB)": Math.max(1, Math.round((attachment.size || 0) / 1024)),
          "Uploaded By": attachment.uploadedBy || "",
          "Uploaded At": formatExportDateTime(attachment.uploadedAt),
        }))
      );

      downloadWorkbook(`defects-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: "Defects", rows: detailRows },
        { name: "Status View", rows: statusRows },
        { name: "Attachments", rows: attachmentRows },
      ]);
    } catch (error) {
      alert(`Failed to export defects: ${error.message}`);
    }
  }

  if (!authUser) {
    return (
      <LoginScreen
        username={loginUsername}
        password={loginPassword}
        rememberMe={loginRememberMe}
        error={loginError}
        busy={loginBusy}
        onUsernameChange={setLoginUsername}
        onPasswordChange={setLoginPassword}
        onRememberMeChange={setLoginRememberMe}
        onSubmit={handleLogin}
        onContactAdmin={handleContactAdministrator}
        onForgotPassword={handleForgotPassword}
      />
    );
  }

  if (authUser.mustChangePassword || showForcePasswordChange) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Segoe UI',sans-serif", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 460, boxShadow: "0 32px 80px rgba(0,0,0,0.12)", border: "1px solid #f1f5f9" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,#6366f1,#4f46e5)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 4px 12px #6366f155" }}>
              <span style={{ fontSize: 22, color: "#fff" }}>🔒</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Update Your Password</div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>Welcome, <strong>{authUser.displayName}</strong>! For security, you must set a new password before continuing.</div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Current Password <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="password"
                value={currentPasswordForChange}
                onChange={e => setCurrentPasswordForChange(e.target.value)}
                placeholder="Enter your initial password"
                style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>New Password <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="password"
                value={newPasswordForChange}
                onChange={e => setNewPasswordForChange(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Confirm New Password <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="password"
                value={confirmPasswordForChange}
                onChange={e => setConfirmPasswordForChange(e.target.value)}
                placeholder="Re-enter new password"
                style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            {passwordChangeError && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                {passwordChangeError}
              </div>
            )}

            <button
              onClick={handleForcePasswordChange}
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
            >
              Update Password & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 16, color: "#64748b", fontFamily: "Inter,sans-serif" }}>
      Loading…
    </div>
  );

  return (
    //<div style={{ minHeight:"100vh", background:"#fff", fontFamily:"'Inter','Segoe UI',sans-serif", color:"#0f172a" }}>
    <div onClick={() => { setShowNotifications(false); setShowUserMenu(false); setShowImportMenu(false); }} style={{ height: "100vh", background: "#fff", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#0f172a", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* ── Body (sidebar + content) ── */}
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Dark Navy Sidebar */}
        <div
          style={{
            width: sidebarCollapsed ? 78 : 280,
            height: "100vh",

            // Modern dark gradient
            background: `
linear-gradient(
  180deg,
  #0b1020 0%,
  #111827 45%,
  #312e81 100%
)
`,
            boxShadow:
              "0 0 40px rgba(99,102,241,.18)",

            // Layout
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",

            // Modern animation
            transition:
              "width 0.22s cubic-bezier(.4,0,.2,1), all 0.25s ease",

            overflow: "hidden",
            flexShrink: 0,

            // Floating sidebar feel
            margin: 12,
            borderRadius: 24,

            // Depth
            boxShadow: `
      0 10px 30px rgba(0,0,0,0.28),
      inset 0 1px 0 rgba(255,255,255,0.04)
    `,

            // Glass border
            border: "1px solid rgba(255,255,255,0.06)",

            // Glass effect
            backdropFilter: "blur(18px)",

            // Better spacing
            padding: "14px 12px",
          }}
        >
          {/* Logo area */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: sidebarCollapsed ? "0" : "0 14px 0 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, height: 100 }}>
            {sidebarCollapsed ? (
              <button onClick={() => setSidebarCollapsed(false)} title="Expand sidebar"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8892a4", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>›</button>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 46, height: 46, background: "linear-gradient(135deg,#6366f1,#4f46e5)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DiamondMark size={24} outer="#ffffff" inner="#4f46e5" stroke={4} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 750, color: "#fff", lineHeight: 1.2 }}>TMS</div>
                    <div style={{ fontSize: 12, color: "#8892a4", fontWeight: 500 }}>Test Management System</div>
                  </div>
                </div>
                <button onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar"
                  style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8892a4", fontSize: 16, flexShrink: 0 }}>‹</button>
              </>
            )}
          </div>
          {/* Nav groups */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
            {[
              {
                group: "MAIN",
                items: [
                  ["dashboard", <LayoutDashboard size={18} />, "Dashboard"],
                  ["projects", <Briefcase size={18} />, "Projects"],
                ]
              },

              {
                group: "TESTING",
                items: [
                  ["testcases", <ClipboardList size={18} />, "Test Cases"],
                  ["runs", <Play size={18} />, "Test Runs"],
                  ["defects", <Bug size={18} />, "Defect Log"],
                ]
              },

              ...(isAdmin
                ? [{
                  group: "SETTINGS",
                  items: [
                    ["settings_cat", <Settings size={18} />, "Settings"],
                    ["users", <Users size={18} />, "Users"],
                  ]
                }]
                : []),
            ].map(({ group, items }) => (
              <div key={group}>
                {!sidebarCollapsed && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5568", letterSpacing: "0.1em", padding: "14px 12px 4px", textTransform: "uppercase" }}>{group}</div>
                )}
                {sidebarCollapsed && <div style={{ height: 10 }} />}
                {items.map(([key, icon, label]) => {
                  const active = activeTab === key;
                  return (
                    <button key={key}
                      onClick={() => { if (key === "settings_cat") { setShowCategorySettings(true); } else { setActiveTab(key); } }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background =
                            "rgba(255,255,255,0.035)";
                        }
                      }}

                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background =
                            "transparent";
                        }
                      }}

                      title={sidebarCollapsed ? label : ""}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,

                        // PREMIUM GLASS ACTIVE BG
                        background: active
                          ? "rgba(255,255,255,0.07)"
                          : "transparent",

                        // SOFT GLASS BLUR
                        backdropFilter: active ? "blur(12px)" : "none",

                        // SUBTLE BORDER
                        border: active
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "1px solid transparent",

                        borderRadius: 14,

                        // TEXT COLOR
                        color: active ? "#ffffff" : "#94A3B8",

                        padding: "12px 14px",

                        fontSize: 13,

                        // LESS AGGRESSIVE BOLD
                        fontWeight: active ? 600 : 500,

                        cursor: "pointer",

                        width: sidebarCollapsed
                          ? "100%"
                          : "calc(100% - 24px)",

                        margin: sidebarCollapsed
                          ? "4px 0"
                          : "4px 12px",

                        whiteSpace: "nowrap",

                        justifyContent: sidebarCollapsed
                          ? "center"
                          : "flex-start",

                        transition: "all 0.22s ease",

                        // MODERN HOVER FEEL
                        boxShadow: active
                          ? "0 4px 18px rgba(0,0,0,0.18)"
                          : "none",
                      }}>
                      <span
                        style={{
                          fontSize: 16,

                          flexShrink: 0,

                          width: 32,

                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",

                          // PREMIUM ICON LOOK
                          color: active
                            ? "#8B5CF6"
                            : "#94A3B8",

                          opacity: active ? 1 : 0.72,

                          transition: "all 0.2s ease",

                          // SOFT ACTIVE GLOW
                          filter: active
                            ? "drop-shadow(0 0 10px rgba(139,92,246,0.35))"
                            : "none",
                        }}
                      >
                        {icon}
                      </span>
                      {!sidebarCollapsed && <span>{label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Bottom user / logout */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: sidebarCollapsed ? "12px 0" : "30px 12px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10, justifyContent: sidebarCollapsed ? "center" : "space-between" }}>
            {!sidebarCollapsed ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                    {(authUser.displayName || authUser.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{authUser.displayName || authUser.username}</div>
                    <div style={{ fontSize: 12, color: "#8892a4" }}>{authUser.role}</div>
                  </div>
                </div>
                <button onClick={handleLogout} title="Logout" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8892a4", fontSize: 13, flexShrink: 0 }}>⏻</button>
              </>
            ) : (
              <button onClick={handleLogout} title="Logout" style={{ background: "none", border: "none", cursor: "pointer", color: "#8892a4", fontSize: 16 }}>⏻</button>
            )}
          </div>
        </div>
        {/* Main content */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>

          {/* ── Page Header ── */}
          <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "45px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 750, color: "#0f172a" }}>
                {({ dashboard: "Dashboard", testcases: "Test Cases", runs: "Test Runs", defects: "Defect Log", projects: "Projects", users: "Users", settings_cat: "Settings" })[activeTab] || ""}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                {({ dashboard: "Overview of test execution and defects", testcases: "Manage and track all test cases", runs: "Execute and monitor test runs", defects: "Track and manage defects", projects: "Manage your test projects", users: "Manage user accounts and permissions", settings_cat: "Configure categories and options" })[activeTab] || ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Notification bell */}
              <div style={{ position: "relative" }}>
                <button onClick={(e) => {
                  e.stopPropagation();

                  // OPEN/CLOSE PANEL
                  toggleNotificationsPanel();

                  // AUTO MARK ALL READ WHEN OPEN
                  if (!showNotifications) {
                    markAllNotificationsAsRead();
                  }
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.78)";

                    e.currentTarget.style.color =
                      "#6366F1";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.55)";

                    e.currentTarget.style.color =
                      "#94A3B8";
                  }}
                  style={{ ...btnS, padding: "8px 10px", fontSize: 18, lineHeight: 1, position: "relative", border: "none", background: "transparent", boxShadow: "none" }} aria-label="Notifications" title="Notifications">
                  <Bell size={18} strokeWidth={2.2} />
                  {unreadNotificationsCount > 0 && (
                    <span style={{
                      position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 999, background: "linear-gradient(135deg,#EF4444,#F87171)", boxShadow:
                        "0 0 14px rgba(239,68,68,0.35)", color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px", border: "2px solid #fff"
                    }}>
                      {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 360, maxHeight: 360, overflowY: "auto", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", padding: 8, zIndex: 2600 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 8px", borderBottom: "1px solid #f1f5f9", marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Notifications</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={markAllNotificationsAsRead} style={{ border: "none", background: "none", color: "#4f46e5", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark all read</button>
                        <button type="button" onClick={clearAllNotifications} title="Clear all notifications" aria-label="Clear all notifications" style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#475569", borderRadius: 8, height: 28, cursor: "pointer", fontSize: 12, fontWeight: 700, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 9px" }}>
                          <span style={{ fontSize: 13, lineHeight: 1 }}><Trash2 size={14} /></span>
                          <span>Clear all</span>
                        </button>
                      </div>
                    </div>
                    {notifications.length === 0 && (
                      <div style={{ padding: "10px 8px", color: "#94a3b8", fontSize: 13 }}>No notifications yet.</div>
                    )}
                    {notifications.map(n => (
                      <button key={n.id} onClick={() => markNotificationAsRead(n)} style={{ width: "100%", textAlign: "left", border: "1px solid #f1f5f9", background: n.isRead ? "#fff" : "#eef2ff", borderRadius: 8, padding: "9px 10px", marginBottom: 6, cursor: "pointer" }} title={n.link || ""}>
                        <div style={{ color: "#0f172a", fontSize: 13, fontWeight: n.isRead ? 600 : 800, lineHeight: 1.35 }}>{n.message}</div>
                        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{formatTimeAgo(n.createdAt)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* User pill */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu(v => !v); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px 6px 0", background: "none", border: "none", cursor: "pointer" }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 750, flexShrink: 0 }}>
                    {(authUser.displayName || authUser.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 750, color: "#0f172a" }}>{authUser.displayName || authUser.username}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em" }}>{authUser.role}</div>
                  </div>
                  <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 2 }}>▼</span>
                </button>
                {showUserMenu && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 160, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", padding: 6, zIndex: 2600 }}
                  >
                    <button
                      onClick={() => { setShowUserMenu(false); handleLogout(); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: "none", background: "transparent", color: "#dc2626", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                    >
                      <span>⏻</span>
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════
          TAB: USERS
      ══════════════════════════════════ */}
          {activeTab === "users" && isAdmin && (
            <div style={{ padding: "20px 2.5%" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={openAddUser} style={btnP}>+ Add User</button>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>🔍</span>
                  <input
                    placeholder="Search username, display name, role..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    style={{ ...inp, paddingLeft: 32, width: 300 }}
                  />
                </div>
                <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} style={{ ...inp, width: 170 }}>
                  <option value="All">All Roles</option>
                  {["Admin", "Test Lead", "Tester", "Developer", "Viewer"].map(role => <option key={role}>{role}</option>)}
                </select>
                <select value={userActiveFilter} onChange={e => setUserActiveFilter(e.target.value)} style={{ ...inp, width: 140 }}>
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <button
                  onClick={() => {
                    setUserSearch("");
                    setUserRoleFilter("All");
                    setUserActiveFilter("All");
                    setUserSortCol("username");
                    setUserSortDir("asc");
                  }}
                  style={btnS}
                >
                  Clear
                </button>
              </div>
              <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13, fontWeight: 700 }}>Showing {filteredSortedUsers.length} of {users.length} users</div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#e2ebf3", borderBottom: "2px solid #f1f5f9" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Actions</th>
                      {[
                        { label: "Username", col: "username" },
                        { label: "Display Name", col: "displayName" },
                        { label: "Role", col: "role" },
                        { label: "Active", col: "isActive" },
                        { label: "Created", col: "createdAt" },
                      ].map(({ label, col }) => (
                        <th
                          key={label}
                          onClick={() => toggleUserSort(col)}
                          style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: userSortCol === col ? "#d4dff0" : undefined }}>
                          {label}{userSortCol === col ? (userSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedUsers.length === 0 && <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No users found</td></tr>}
                    {filteredSortedUsers.map((user, i) => {
                      const resetCooldown = getPwCooldownRemaining(`reset-${user.id}`);
                      return (
                        <tr key={user.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "13px 16px", width: 190, minWidth: 190 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                              <button onClick={() => openEditUser({ ...user, password: "" })} style={{ ...btnS, padding: "5px 12px", fontSize: 14 }}>Edit</button>
                              <button
                                onClick={() => resetUserPassword(user)}
                                disabled={resetCooldown > 0}
                                title={resetCooldown > 0 ? `Wait ${resetCooldown}s before resetting again` : undefined}
                                style={{ ...btnS, padding: "5px 10px", fontSize: 12, borderColor: "#c7d2fe", color: resetCooldown > 0 ? "#a5b4fc" : "#4338ca", opacity: resetCooldown > 0 ? 0.65 : 1, cursor: resetCooldown > 0 ? "not-allowed" : "pointer" }}
                              >
                                {resetCooldown > 0 ? `Reset (${resetCooldown}s)` : "Reset Password"}
                              </button>
                              <button onClick={() => { if (window.confirm(`Delete ${user.username}?`)) deleteUserAccount(user.id); }} style={xBtn}>✕</button>
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", fontWeight: 800, color: "#6366f1" }}>{user.username}</td>
                          <td style={{ padding: "13px 16px", color: "#1e293b", fontWeight: 600 }}>{user.displayName}</td>
                          <td style={{ padding: "13px 16px" }}><span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>{user.role}</span></td>
                          <td style={{ padding: "13px 16px" }}>{user.isActive ? "Yes" : "No"}</td>
                          <td style={{ padding: "13px 16px", color: "#64748b" }}>{toInputDate(user.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
          TAB: PROJECTS
      ══════════════════════════════════ */}
          {activeTab === "projects" && (
            <div style={{ padding: "20px 2.5%" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {canManageProjects && <button onClick={() => setShowAddProject(true)} style={btnP}>+ Add Project</button>}
                {canManageProjects && <button onClick={() => setShowAddPlan(true)} style={{ ...btnS, opacity: !selectedProjectId ? 0.5 : 1 }} disabled={!selectedProjectId}>+ Add Test Plan</button>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16 }}>
                <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 17, color: "#334155" }}>Projects</div>
                  {(projects || []).length === 0 && <div style={{ padding: 18, color: "#94a3b8", fontSize: 15 }}>No projects yet.</div>}
                  {(projects || []).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f8fafc", padding: "8px 10px", background: String(selectedProjectId) === String(p.id) ? "#eff6ff" : "#fff" }}>
                      <button onClick={() => { setSelectedProjectId(String(p.id)); setSelectedTestPlanId(""); }}
                        style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", padding: "6px 4px", cursor: "pointer", fontWeight: 700, fontSize: 16, color: String(selectedProjectId) === String(p.id) ? "#1d4ed8" : "#334155" }}>
                        <div>{p.name}</div>
                        {(() => {
                          const tm = getTimelineMeta(p.startDate, p.endDate);
                          const badge = timelineBadgeStyle(tm.status);
                          return (
                            <div style={{ marginTop: 4 }}>
                              <div>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  fontSize: 13,
                                  fontWeight: 800,
                                  letterSpacing: "0.01em",
                                  whiteSpace: "nowrap",
                                  background: badge.bg,
                                  color: badge.text,
                                  border: `1px solid ${badge.border}`
                                }}>
                                  📅 {formatTimeline(p.startDate, p.endDate)}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
                                  <div style={{ width: `${tm.progress}%`, height: "100%", background: tm.color, borderRadius: 99, transition: "width 0.25s ease" }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: tm.color, minWidth: 76, textAlign: "right" }}>{tm.status} {tm.progress}%</span>
                              </div>
                            </div>
                          );
                        })()}
                      </button>
                      {canManageProjects && <button
                        onClick={() => {
                          setEditingProjectId(p.id);
                          setEditProjectName(p.name || "");
                          setEditProjectStartDate(toInputDate(p.startDate));
                          setEditProjectEndDate(toInputDate(p.endDate));
                          setShowEditProject(true);
                        }}
                        style={{ ...btnS, padding: "5px 11px", fontSize: 13 }}
                      >
                        Edit
                      </button>}
                      {canDelete && <button
                        onClick={() => {
                          if (window.confirm(`Delete project "${p.name}" and all its test plans?`)) {
                            deleteProject(p.id);
                          }
                        }}
                        style={{ ...btnD, padding: "5px 11px", fontSize: 13 }}
                      >
                        Delete
                      </button>}
                    </div>
                  ))}
                </div>
                <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 17, color: "#334155" }}>Test Plans {selectedProject ? `- ${selectedProject.name}` : ""}</div>
                  {!selectedProject && <div style={{ padding: 18, color: "#94a3b8", fontSize: 15 }}>Select a project to view plans.</div>}
                  {selectedProject && selectedProjectPlans.length === 0 && <div style={{ padding: 18, color: "#94a3b8", fontSize: 15 }}>No test plans yet.</div>}
                  {selectedProjectPlans.map(tp => (
                    <div key={tp.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f8fafc", padding: "8px 10px", background: String(selectedTestPlanId) === String(tp.id) ? "#eff6ff" : "#fff" }}>
                      <button onClick={() => { setSelectedTestPlanId(String(tp.id)); setNewTC(p => ({ ...p, testScopeId: "" })); setActiveTab("testcases"); }}
                        style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", padding: "6px 4px", cursor: "pointer", fontWeight: 700, fontSize: 16, color: String(selectedTestPlanId) === String(tp.id) ? "#1d4ed8" : "#334155" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{tp.name}</span>
                          {(() => {
                            const count = defects.filter(d => d.testPlanId === tp.id).length;
                            return count > 0 ? (
                              <span
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: "2px 8px",
                                  minWidth: 24,
                                  textAlign: "center",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Bug size={12} />
                                {count}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {(() => {
                          const tm = getTimelineMeta(tp.startDate, tp.endDate);
                          const badge = timelineBadgeStyle(tm.status);
                          return (
                            <div style={{ marginTop: 4 }}>
                              <div>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  fontSize: 13,
                                  fontWeight: 800,
                                  letterSpacing: "0.01em",
                                  whiteSpace: "nowrap",
                                  background: badge.bg,
                                  color: badge.text,
                                  border: `1px solid ${badge.border}`
                                }}>
                                  📅 {formatTimeline(tp.startDate, tp.endDate)}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
                                  <div style={{ width: `${tm.progress}%`, height: "100%", background: tm.color, borderRadius: 99, transition: "width 0.25s ease" }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: tm.color, minWidth: 76, textAlign: "right" }}>{tm.status} {tm.progress}%</span>
                              </div>
                            </div>
                          );
                        })()}
                      </button>
                      {canManageProjects && (
                        <button
                          onClick={() => openManageScopes(tp)}
                          style={{ ...btnS, padding: "5px 10px", fontSize: 13 }}
                          title="Manage testing scopes"
                        >
                          <Target size={16} />
                        </button>
                      )}
                      {canManageProjects && <button
                        onClick={() => {
                          setEditingPlanId(tp.id);
                          setEditPlanName(tp.name || "");
                          setEditPlanStartDate(toInputDate(tp.startDate));
                          setEditPlanEndDate(toInputDate(tp.endDate));
                          setShowEditPlan(true);
                        }}
                        style={{ ...btnS, padding: "5px 11px", fontSize: 13 }}
                      >
                        Edit
                      </button>}
                      {canDelete && <button
                        onClick={() => {
                          if (window.confirm(`Delete test plan "${tp.name}"?`)) {
                            deleteTestPlan(tp.id);
                          }
                        }}
                        style={{ ...btnD, padding: "5px 11px", fontSize: 13 }}
                      >
                        Delete
                      </button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
          TAB: TEST CASES
      ══════════════════════════════════ */}

          {activeTab === "testcases" && (
            <div style={{ padding: "20px 2.5%" }}>
              {/* toolbar */}
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                <input
                  ref={importTestCaseInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) {
                      await handleImportTestCases(file);
                    }
                  }}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={16}
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                      }}
                    />

                    <input
                      placeholder="Search ID or name..."
                      value={tcSearch}
                      onChange={e => setTcSearch(e.target.value)}
                      style={{
                        ...inp,
                        paddingLeft: 36,
                        width: 230,
                      }}
                    />
                  </div>
                  <select value={tcCatFilter} onChange={e => setTcCatFilter(e.target.value)} style={{ ...inp, width: 220 }}>
                    <option value="All">All Categories</option>
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={tcPriFilter} onChange={e => setTcPriFilter(e.target.value)} style={{ ...inp, width: 150 }}>
                    <option value="All">All Priorities</option>
                    {TEST_CASE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select
                    value={selectedProjectId}
                    onChange={e => {
                      const pid = e.target.value;
                      setSelectedProjectId(pid);
                      const p = projects.find(x => String(x.id) === String(pid));
                      const fp = (p?.testPlans || [])[0];
                      setSelectedTestPlanId(fp ? String(fp.id) : "");
                      setNewTC(prev => ({ ...prev, testScopeId: "" }));
                    }}
                    style={{ ...inp, width: 190 }}
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select
                    value={selectedTestPlanId}
                    onChange={e => {
                      setSelectedTestPlanId(e.target.value);
                      setNewTC(prev => ({ ...prev, testScopeId: "" }));
                    }}
                    style={{ ...inp, width: 450 }}
                  >
                    <option value="">Select Test Plan</option>
                    {selectedProjectPlans.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                  </select>

                  <button
                    onClick={() => {
                      setTcSearch("");
                      setTcCatFilter("All");
                      setTcPriFilter("All");
                      setSelectedProjectId("");
                      setSelectedTestPlanId("");
                    }}
                    style={{ background: "transparent", border: "none", color: "#4f46e5", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                  >
                    Reset
                  </button>
                  {filteredTC.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedTcIds.length === filteredTC.length) {
                          setSelectedTcIds([]);
                        } else {
                          setSelectedTcIds(filteredTC.map(tc => tc.id));
                        }
                      }}
                      style={{ background: "transparent", border: "none", color: "#4f46e5", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                    >
                      {selectedTcIds.length === filteredTC.length ? "Clear Selection" : "Select All"}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
                    {canWrite && <button onClick={() => setShowAddTC(true)} style={btnP}>+ Add Test Case</button>}
                    {selectedTcIds.length > 0 && canDelete && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 700 }}>{selectedTcIds.length} selected</span>
                        <button onClick={() => { if (window.confirm(`Delete ${selectedTcIds.length} test case(s)?`)) deleteTestCases(selectedTcIds); }}
                          style={{ background: "#fff1f2", color: "#be123c", border: "1.5px solid #fecdd3", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                          🗑 Delete Selected
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }} onClick={e => e.stopPropagation()}>
                    <button onClick={exportTestCases} style={{ ...btnS, padding: "9px 14px", fontSize: 14 }} disabled={sortedFilteredTC.length === 0}>Export Excel</button>
                    {canWrite && (
                      <>
                        <button
                          onClick={() => setShowImportMenu(v => !v)}
                          style={{ ...btnS, padding: "9px 14px", fontSize: 14, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                        >
                          <span>Import</span>
                          <span style={{ fontSize: 12 }}>▾</span>
                        </button>
                        {showImportMenu && (
                          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 190, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 12px 28px rgba(15,23,42,0.15)", zIndex: 20, padding: 8 }}>
                            <button
                              onClick={() => {
                                setShowImportMenu(false);
                                downloadTestCaseImportTemplate();
                              }}
                              style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: "#334155", fontSize: 14, fontWeight: 600 }}
                            >
                              Download Template
                            </button>
                            <button
                              onClick={() => {
                                setShowImportMenu(false);
                                importTestCaseInputRef.current?.click();
                              }}
                              style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "10px 12px", cursor: importingTestCases ? "not-allowed" : "pointer", color: importingTestCases ? "#94a3b8" : "#334155", fontSize: 14, fontWeight: 600 }}
                              disabled={importingTestCases}
                              title="Upload an Excel file with columns like Name, Test Plan, Description, Steps, Expected Result, Priority, Category, Remarks, and optional Test Scope"
                            >
                              {importingTestCases ? "Importing..." : "Import Excel"}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Required: <strong>Name</strong> and <strong>Test Plan</strong>. Optional columns: Description, Steps, Expected Result, Priority, Category, Remarks, Test Scope.
              </div>

              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#e2ebf3", borderBottom: "2px solid #f1f5f9" }}>
                      <th style={{ padding: "12px 16px", width: 40 }}>
                        <input type="checkbox"
                          checked={selectedTcIds.length === filteredTC.length && filteredTC.length > 0}
                          onChange={e => setSelectedTcIds(e.target.checked ? filteredTC.map(tc => tc.id) : [])}
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#6366f1" }}
                        />
                      </th>
                      {[{ label: "Actions", col: "" }, { label: "ID", col: "tcNumber" }, { label: "Project", col: "" }, { label: "Test Plan", col: "" }, { label: "Test Name", col: "name" }, { label: "Category", col: "category" }, { label: "Coverage", col: "" }, { label: "Priority", col: "priority" }].map(({ label, col }) => (
                        <th key={label} onClick={col ? () => { if (tcSortCol === col) setTcSortDir(d => d === "asc" ? "desc" : "asc"); else { setTcSortCol(col); setTcSortDir("asc"); } } : undefined}
                          style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: col ? "pointer" : "default", userSelect: "none", background: col && tcSortCol === col ? "#d4dff0" : undefined }}>
                          {label}{col && tcSortCol === col ? (tcSortDir === "asc" ? " ▲" : " ▼") : col ? " ⇅" : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredTC.length === 0 && <tr><td colSpan={9} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No test cases found</td></tr>}
                    {sortedFilteredTC.map((tc, i) => {
                      const isSelected = selectedTcIds.includes(tc.id);
                      const planMeta = tc.testPlanId ? testPlanMetaById[tc.testPlanId] : null;
                      const coveredRuns = runs.filter(run =>
                        (run.entries || []).some(
                          e => e.testCaseId === tc.id
                        )
                      );
                      return (
                        <tr key={tc.id}
                          onContextMenu={e => { if (canWrite) { e.preventDefault(); setContextMenu({ type: "tc", item: tc, x: e.clientX, y: e.clientY }); } }}
                          style={{ borderBottom: "1px solid #f8fafc", background: isSelected ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f0f4ff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa"; }}>
                          <td style={{ padding: "13px 16px" }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => setSelectedTcIds(p => e.target.checked ? [...p, tc.id] : p.filter(x => x !== tc.id))}
                              style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#6366f1" }}
                            />
                          </td>
                          <td style={{ padding: "13px 16px", width: 180, minWidth: 180 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                              <button onClick={() => setViewTC(tc)} style={{ ...btnS, padding: "5px 12px", fontSize: 14 }}>View</button>
                              {canWrite && <button
                                onClick={() => setEditTC({
                                  ...tc,
                                  expected: tc.expectedResult,
                                  testScopeId: tc.testScopeId ? String(tc.testScopeId) : ""
                                })}
                                style={{ ...btnP, padding: "5px 12px", fontSize: 14 }}
                              >
                                Edit
                              </button>}
                              {canDelete && <button
                                onClick={() => {
                                  if (window.confirm(`Delete ${tc.tcNumber}?`)) deleteTestCases([tc.id]);
                                }}
                                style={xBtn}
                                title="Delete"
                              >
                                ✕
                              </button>}
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewTC(tc)}>
                            <span style={{ fontWeight: 800, color: "#6366f1", fontSize: 14, fontFamily: "monospace", background: "#eff6ff", padding: "2px 7px", borderRadius: 5 }}>{tc.tcNumber}</span>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewTC(tc)}>
                            <span style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>{planMeta?.projectName || "-"}</span>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewTC(tc)}>
                            <span style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>{planMeta?.testPlanName || "-"}</span>
                          </td>
                          <td style={{ padding: "13px 16px", maxWidth: 340 }} onClick={() => setViewTC(tc)}>
                            <div style={{ fontWeight: 700, color: "#1e293b", lineHeight: 1.4 }}>{tc.name}</div>
                            {tc.testScopeId && testScopeNameById[tc.testScopeId] && (
                              <div style={{ marginTop: 5 }}>
                                <span style={{ fontSize: 12, color: "#4338ca", background: "#eef2ff", border: "1px solid #c7d2fe", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                                  Scope: {testScopeNameById[tc.testScopeId]}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewTC(tc)}>
                            <span style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>{tc.category || "-"}</span>
                          </td>
                          <td
                            style={{ padding: "13px 16px", whiteSpace: "nowrap" }}
                            onClick={() => setViewTC(tc)}
                          >
                            {coveredRuns.length > 0 ? (
                              <span
                                style={{
                                  background: "#f0fdf4",
                                  color: "#15803d",
                                  padding: "4px 10px",
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                {coveredRuns.length} Run{coveredRuns.length > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: "#fff1f2",
                                  color: "#be123c",
                                  padding: "4px 10px",
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                Not Covered
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewTC(tc)}><PriBadge label={tc.priority} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
          TAB: TEST RUNS
      ══════════════════════════════════ */}
          {activeTab === "runs" && (
            <div style={{ padding: "20px 2.5%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                  <Search
                    size={16}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  />

                  <input
                    value={runSearch}
                    onChange={e => setRunSearch(e.target.value)}
                    placeholder="Search runs..."
                    style={{
                      flex: 1,
                      width: "100%",
                      background: "#f8fafc",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "8px 12px 8px 38px",
                      fontSize: 14,
                      color: "#0f172a",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", position: "relative" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>Date</span>
                  <button
                    onClick={toggleRunDateFilterPanel}
                    title="Filter by date"
                    style={{ border: "1px solid #cbd5e1", background: runDateFilterPanel || runDateRule !== "Any" ? "#eff6ff" : "#fff", color: runDateFilterPanel || runDateRule !== "Any" ? "#1d4ed8" : "#64748b", borderRadius: 6, width: 26, height: 26, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    ⏷
                  </button>
                  {runDateRule !== "Any" && runDateValue && (
                    <button onClick={() => { setRunDateRule("Any"); setRunDateValue(""); }}
                      style={{ border: "1px solid #fca5a5", background: "#fff1f2", color: "#dc2626", borderRadius: 6, width: 22, height: 22, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontWeight: 700 }}>✕</button>
                  )}
                </div>
                <div style={{ flex: "0 0 auto", display: "flex", gap: 10, alignItems: "center" }}>
                  {sortedRuns.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedRunIds.length === filteredRuns.length) {
                          setSelectedRunIds([]);
                        } else {
                          setSelectedRunIds(filteredRuns.map(r => r.id));
                        }
                      }}
                      style={{ ...btnS, padding: "8px 14px", fontSize: 14 }}
                    >
                      {selectedRunIds.length === filteredRuns.length ? "Clear Selection" : "Select All"}
                    </button>
                  )}
                  {selectedRunIds.length > 0 && canDelete && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete ${selectedRunIds.length} test run(s)?`)) {
                          deleteRuns(selectedRunIds);
                        }
                      }}
                      style={{ ...btnD, padding: "8px 14px", fontSize: 14 }}
                    >
                      🗑 Delete Selected
                    </button>
                  )}
                  <button onClick={exportRuns} style={{ ...btnS, padding: "8px 14px", fontSize: 14 }} disabled={filteredRuns.length === 0}>Export Excel</button>
                  {canWrite && <button onClick={() => setShowAddRun(true)} style={btnP}>+ New Test Run</button>}
                </div>
              </div>
              {sortedRuns.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#cbd5e1" }}>No test runs yet. Create your first one!</div>}
              {sortedRuns.length > 0 && filteredRuns.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#cbd5e1" }}>No runs match current filters.</div>}
              <div style={{ display: "grid", gap: 14 }}>
                {filteredRuns.map(run => {
                  const st = runStats(run);
                  const byStatusPriority = runStatusPriorityStats(run);
                  const pct = st.total > 0 ? Math.round((st.pass / st.total) * 100) : 0;
                  const isRunSelected = selectedRunIds.includes(run.id);
                  const showRunCheckbox = hoveredRunId === run.id || isRunSelected;
                  return (
                    <div key={run.id} style={{ background: "#f0f4f9", border: "1.5px solid #f1f5f9", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", cursor: "pointer", transition: "box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.1)"; setHoveredRunId(run.id); }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.05)"; setHoveredRunId(null); }}
                      onClick={() => setViewRun(run)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span
                              onClick={e => e.stopPropagation()}
                              style={{ width: 18, display: "inline-flex", justifyContent: "center", opacity: showRunCheckbox ? 1 : 0, transition: "opacity 0.15s" }}
                            >
                              <input
                                type="checkbox"
                                checked={isRunSelected}
                                onChange={e => setSelectedRunIds(p => e.target.checked ? [...p, run.id] : p.filter(x => x !== run.id))}
                                style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#6366f1" }}
                              />
                            </span>
                            <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 5 }}>{run.runNumber}</span>
                            <span style={{ fontSize: 14, color: "#94a3b8" }}>{run.createdAt?.slice(0, 10)}</span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{run.name}</div>
                          <div style={{ fontSize: 14, color: "#64748b", marginTop: 3 }}>👤 {run.tester}</div>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          {canWrite && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setEditRun({
                                  id: run.id,
                                  name: run.name,
                                  tester: run.tester,
                                  selectedTesters: (run.tester || "").split(",").map(t => t.trim()).filter(Boolean),
                                });
                                setEditRunTesterSearch("");
                              }}
                              style={{ ...btnS, padding: "5px 12px", fontSize: 13 }}
                            >
                              Edit
                            </button>
                          )}
                          <StatChip label="Total" value={st.total} color="#6366f1" bg="#eff6ff" />
                          <StatChip label="Passed" value={st.pass} color="#15803d" bg="#f0fdf4" />
                          <StatChip label="Failed" value={st.fail} color="#be123c" bg="#fff1f2" />
                          <StatChip label="Not Run" value={st.notRun} color="#64748b" bg="#f8fafc" />
                        </div>
                      </div>
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {Object.keys(EXEC_STATUS).map(status => {
                            const s = byStatusPriority[status];
                            if (!s || s.total === 0) return null;
                            return (
                              <span key={status} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, padding: "3px 9px", fontSize: 11, color: "#475569", fontWeight: 700 }}>
                                {status}: H{s.High} M{s.Medium} L{s.Low}
                              </span>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", marginBottom: 5 }}>
                          <span>Progress</span><span style={{ fontWeight: 700, color: pct === 100 ? "#15803d" : "#64748b" }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#22c55e" : "linear-gradient(90deg,#6366f1,#06b6d4)", borderRadius: 99, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
          TAB: DEFECT LOG
      ══════════════════════════════════ */}
          {activeTab === "defects" && (
            <div style={{ padding: "20px 2.5%" }}>
              <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ position: "relative", width: 320 }}>
                    <Search
                      size={16}
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        pointerEvents: "none",
                      }}
                    />

                    <input
                      placeholder="Search defect / run / TC / assignee..."
                      value={defSearch}
                      onChange={e => setDefSearch(e.target.value)}
                      style={{
                        ...inp,
                        width: "100%",
                        paddingLeft: 38,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <select value={defStatusFilter} onChange={e => setDefStatusFilter(e.target.value)} style={{ ...inp, width: 180 }}>
                    <option>All</option>
                    {Object.keys(DEFECT_STATUS).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select value={defPriFilter} onChange={e => setDefPriFilter(e.target.value)} style={{ ...inp, width: 150 }}>
                    <option>All</option>
                    {Object.keys(PRIORITY_META).map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select value={defMarketFilter} onChange={e => setDefMarketFilter(e.target.value)} style={{ ...inp, width: 120 }}>
                    <option>All</option>
                    {Array.from(new Set(defects.map(d => d.market).filter(Boolean))).sort().map(m => <option key={m}>{m}</option>)}
                  </select>
                  <select value={defPlanFilter} onChange={e => setDefPlanFilter(e.target.value)} style={{ ...inp, width: 450 }}>
                    <option value="All">All Test Plans</option>
                    {projects.flatMap(p => (p.testPlans || []).map(tp => (
                      <option key={tp.id} value={String(tp.id)}>{p.name} — {tp.name}</option>
                    )))}
                  </select>

                  <button
                    onClick={() => {
                      setDefSearch("");
                      setDefStatusFilter("All");
                      setDefPriFilter("All");
                      setDefMarketFilter("All");
                      setDefPlanFilter("All");
                      setDefOpenRule("Any");
                      setDefOpenDate("");
                      setDefCloseRule("Any");
                      setDefCloseDate("");
                    }}
                    style={{ background: "transparent", border: "none", color: "#4f46e5", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                  >
                    Reset
                  </button>
                  {filteredDefects.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedDefectIds.length === filteredDefects.length) {
                          setSelectedDefectIds([]);
                        } else {
                          setSelectedDefectIds(filteredDefects.map(def => def.id));
                        }
                      }}
                      style={{ background: "transparent", border: "none", color: "#4f46e5", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                    >
                      {selectedDefectIds.length === filteredDefects.length ? "Clear Selection" : "Select All"}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
                    {canWrite && <button onClick={createStandaloneDefect} style={btnP}>+ Add Defect</button>}
                    {selectedDefectIds.length > 0 && canDelete && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 700 }}>{selectedDefectIds.length} selected</span>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete ${selectedDefectIds.length} defect(s)?`)) {
                              deleteDefects(selectedDefectIds);
                            }
                          }}
                          style={{ ...btnD, padding: "9px 14px", fontSize: 14 }}
                        >
                          🗑 Delete Selected
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={exportDefects} style={{ ...btnS, padding: "9px 14px", fontSize: 14 }} disabled={sortedFilteredDefects.length === 0}>Export Excel</button>
                  </div>
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflowX: "auto", overflowY: "visible" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#e2ebf3", borderBottom: "2px solid #f1f5f9" }}>
                      <th style={{ padding: "12px 16px", width: 40 }}>
                        <input
                          type="checkbox"
                          checked={filteredDefects.length > 0 && selectedDefectIds.length === filteredDefects.length}
                          onChange={e => setSelectedDefectIds(e.target.checked ? filteredDefects.map(def => def.id) : [])}
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#6366f1" }}
                        />
                      </th>
                      {[{ label: "Actions", col: "" }, { label: "ID", col: "defectNumber" }, { label: "Market", col: "market" }, { label: "Actual Result", col: "actualResult" }, { label: "Priority", col: "priority" }, { label: "Raised By", col: "raisedBy" }, { label: "Assigned To", col: "assignedTo" }, { label: "Status", col: "status" }].map(({ label, col }) => (
                        <th key={label} onClick={col ? () => { if (defSortCol === col) setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol(col); setDefSortDir("asc"); } } : undefined}
                          style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: col ? "pointer" : "default", userSelect: "none", background: col && defSortCol === col ? "#d4dff0" : undefined }}>
                          {label}{col && defSortCol === col ? (defSortDir === "asc" ? " ▲" : " ▼") : col ? " ⇅" : ""}
                        </th>
                      ))}
                      <th
                        onClick={() => { if (defSortCol === "openDateTime") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("openDateTime"); setDefSortDir("asc"); } }}
                        style={{ padding: "8px 12px", textAlign: "left", color: "#1f252e", whiteSpace: "nowrap", position: "relative", zIndex: 5, cursor: "pointer", userSelect: "none", background: defSortCol === "openDateTime" ? "#d4dff0" : undefined }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Open Datetime{defSortCol === "openDateTime" ? (defSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
                          <button
                            onClick={e => toggleDefDateFilterPanel(e, "open")}
                            title="Filter open datetime"
                            style={{ border: "1px solid #cbd5e1", background: defDateFilterPanel?.type === "open" ? "#eff6ff" : "#fff", color: defDateFilterPanel?.type === "open" ? "#1d4ed8" : "#64748b", borderRadius: 6, width: 22, height: 22, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                          >
                            ⌕
                          </button>
                        </div>
                      </th>
                      <th
                        onClick={() => { if (defSortCol === "closeDateTime") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("closeDateTime"); setDefSortDir("asc"); } }}
                        style={{ padding: "8px 12px", textAlign: "left", color: "#1f252e", whiteSpace: "nowrap", position: "relative", zIndex: 5, cursor: "pointer", userSelect: "none", background: defSortCol === "closeDateTime" ? "#d4dff0" : undefined }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>Close Datetime{defSortCol === "closeDateTime" ? (defSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
                          <button
                            onClick={e => toggleDefDateFilterPanel(e, "close")}
                            title="Filter close datetime"
                            style={{ border: "1px solid #cbd5e1", background: defDateFilterPanel?.type === "close" ? "#eff6ff" : "#fff", color: defDateFilterPanel?.type === "close" ? "#1d4ed8" : "#64748b", borderRadius: 6, width: 22, height: 22, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                          >
                            ⌕
                          </button>
                        </div>
                      </th>
                      <th
                        onClick={() => { if (defSortCol === "aged") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("aged"); setDefSortDir("asc"); } }}
                        style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: defSortCol === "aged" ? "#d4dff0" : undefined }}
                      >
                        Aged{defSortCol === "aged" ? (defSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {defects.length === 0 && <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No defects logged</td></tr>}
                    {defects.length > 0 && filteredDefects.length === 0 && <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No defects match current filters</td></tr>}
                    {sortedFilteredDefects.map((def, i) => {
                      const aged = agedDays(def.dateRaised);
                      const isSelected = selectedDefectIds.includes(def.id);
                      return (
                        <tr key={def.id}
                          onContextMenu={e => { if (canWrite) { e.preventDefault(); setContextMenu({ type: "defect", item: def, x: e.clientX, y: e.clientY }); } }}
                          style={{ borderBottom: "1px solid #f8fafc", background: isSelected ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f0f4ff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa"; }}>
                          <td style={{ padding: "13px 16px" }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => setSelectedDefectIds(p => e.target.checked ? [...p, def.id] : p.filter(x => x !== def.id))}
                              style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#6366f1" }}
                            />
                          </td>
                          <td style={{ padding: "13px 16px", width: 220, minWidth: 220 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                              <button onClick={() => setViewDef(def)} style={{ ...btnS, padding: "5px 12px", fontSize: 14 }}>View</button>
                              {canWrite && <button
                                onClick={() => setEditDef({
                                  ...def,
                                  dateRaised: def.dateRaised ? String(def.dateRaised).slice(0, 10) : "",
                                  targetFixDate: def.targetFixDate ? String(def.targetFixDate).slice(0, 10) : "",
                                  linkedRunId: runs.find(r => r.runNumber === def.runNumber)?.id || "",
                                  linkedTestCaseId: allTestCases.find(t => t.tcNumber === def.tcNumber)?.id || "",
                                })}
                                style={{ ...btnP, padding: "5px 12px", fontSize: 14 }}
                              >
                                Edit
                              </button>}
                              {canDelete && <button
                                onClick={() => {
                                  if (window.confirm(`Delete ${def.defectNumber}?`)) {
                                    deleteDefects([def.id]);
                                  }
                                }}
                                style={xBtn}
                                title="Delete"
                              >
                                ✕
                              </button>}
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewDef(def)}>
                            <span style={{ fontWeight: 800, color: "#ef4444", fontSize: 14, fontFamily: "monospace", background: "#fff1f2", padding: "2px 7px", borderRadius: 5, display: "inline-block", whiteSpace: "nowrap" }}>{def.defectNumber}</span>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewDef(def)}>
                            <span style={{ fontSize: 14, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>{def.market}</span>
                          </td>
                          <td style={{ padding: "13px 16px", maxWidth: 240 }} onClick={() => setViewDef(def)}>
                            <div style={{ color: "#1e293b", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {def.actualResult}
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewDef(def)}>
                            <PriBadge label={def.priority} /></td>
                          <td style={{ padding: "13px 16px", color: "#64748b", fontSize: 14 }} onClick={() => setViewDef(def)}>
                            {def.raisedBy || "—"}</td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                            <select
                              value={def.assignedTo || ""}
                              onChange={e => updateDefAssignedTo(def, e.target.value)}
                              disabled={!canAssignDefect}
                              style={{ ...inp, minWidth: 170, fontSize: 13, padding: "6px 8px", color: "#334155" }}
                            >
                              <option value="">Unassigned</option>
                              {def.assignedTo && !assignableUserDisplayNames.includes(def.assignedTo) && (
                                <option value={def.assignedTo}>{def.assignedTo} (current)</option>
                              )}
                              {assignableUserDisplayNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                            <select value={def.status} onChange={e => updateDefStatus(def.id, e.target.value)} onClick={e => e.stopPropagation()} disabled={!canUpdateDefectStatus}
                              style={{ background: DEFECT_STATUS[def.status]?.bg, color: DEFECT_STATUS[def.status]?.text, border: `1.5px solid ${DEFECT_STATUS[def.status]?.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 14, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                              {Object.keys(DEFECT_STATUS).map(s => <option key={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "13px 16px", color: "#64748b", fontSize: 13 }} onClick={() => setViewDef(def)}>
                            {def.openDateTime ? new Date(def.openDateTime).toLocaleString() : "-"}
                          </td>
                          <td style={{ padding: "13px 16px", color: "#64748b", fontSize: 13 }} onClick={() => setViewDef(def)}>
                            {def.closeDateTime ? new Date(def.closeDateTime).toLocaleString() : "-"}
                          </td>
                          <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewDef(def)}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: aged > 7 ? "#ef4444" : aged > 3 ? "#f97316" : "#22c55e" }}>{aged}d</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
          TAB: DASHBOARD
      ══════════════════════════════════ */}
          {activeTab === "dashboard" && (() => {
            const DonutChart = ({ segments, size = 130, strokeWidth = 18, label, subLabel }) => {
              const r = (size - strokeWidth) / 2;
              const C = 2 * Math.PI * r;
              const cx = size / 2, cy = size / 2;
              const total = segments.reduce((s, g) => s + g.value, 0);
              let acc = 0;
              return (
                <svg width={size} height={size} style={{ display: "block" }}>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
                  {total === 0
                    ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
                    : segments.filter(s => s.value > 0).map((seg, i) => {
                      const dash = (seg.value / total) * C;
                      const rot = -90 + (acc / total) * 360;
                      acc += seg.value;
                      return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${C - dash}`} transform={`rotate(${rot} ${cx} ${cy})`} />;
                    })}
                  {label != null && (
                    <text x={cx} y={subLabel ? cy + 1 : cy + 8} textAnchor="middle" style={{ fontSize: size < 100 ? 14 : 20, fontWeight: 800, fill: "#0f172a" }}>{label}</text>
                  )}
                  {subLabel && <text x={cx} y={cy + (size < 100 ? 14 : 20)} textAnchor="middle" style={{ fontSize: 10, fill: "#94a3b8" }}>{subLabel}</text>}
                </svg>
              );
            };
            const BarChart = ({ data, height = 170 }) => {
              if (!data || data.length === 0) return null;
              const barW = 22, gapW = 10;
              const totalW = data.length * (barW + gapW) - gapW;
              const chartH = height;
              const maxVal = Math.max(...data.map(d => d.passed + d.failed + d.blocked), 1);
              const ticks = [1, 0.75, 0.5, 0.25, 0].map(f => Math.round(maxVal * f));
              return (
                <div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {/* Y-axis labels */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: chartH, flexShrink: 0 }}>
                      {ticks.map((v, i) => (
                        <span key={i} style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1, textAlign: "right", minWidth: 20 }}>{v}</span>
                      ))}
                    </div>
                    <div style={{ flex: 1, position: "relative" }}>
                      <svg width="100%" height={chartH} viewBox={`0 0 ${totalW} ${chartH}`} preserveAspectRatio="none">
                        {[0.25, 0.5, 0.75, 1].map(f => (
                          <line key={f} x1={0} y1={chartH * (1 - f)} x2={totalW} y2={chartH * (1 - f)} stroke="#f1f5f9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                        ))}
                        {data.map((d, i) => {
                          const x = i * (barW + gapW);
                          const pH = (d.passed / maxVal) * chartH;
                          const fH = (d.failed / maxVal) * chartH;
                          const bH = (d.blocked / maxVal) * chartH;
                          return (
                            <g key={i}>
                              {pH > 0 && <rect x={x} y={chartH - pH - fH - bH} width={barW} height={pH} fill="#22c55e" rx={2} />}
                              {fH > 0 && <rect x={x} y={chartH - fH - bH} width={barW} height={fH} fill="#f43f5e" />}
                              {bH > 0 && <rect x={x} y={chartH - bH} width={barW} height={bH} fill="#f97316" />}
                              {pH === 0 && fH === 0 && bH === 0 && <rect x={x} y={chartH - 2} width={barW} height={2} fill="#e2e8f0" rx={2} />}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, paddingLeft: 28 }}>
                    {data.map((d, i) => (
                      <span key={i} style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                    ))}
                  </div>
                </div>
              );
            };
            const LineChart = ({ data, height = 170 }) => {
              if (!data || data.length < 2) return null;
              const chartW = 600, chartH = height;
              const maxVal = Math.max(...data.flatMap(d => [d.newCount, d.closedCount]), 1);
              const px = i => (i / (data.length - 1)) * chartW;
              const py = v => chartH - (v / maxVal) * chartH;
              const newPts = data.map((d, i) => `${px(i)},${py(d.newCount)}`).join(" ");
              const clPts = data.map((d, i) => `${px(i)},${py(d.closedCount)}`).join(" ");
              const ticks = [1, 0.75, 0.5, 0.25, 0].map(f => Math.round(maxVal * f));
              return (
                <div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {/* Y-axis labels */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: chartH, flexShrink: 0 }}>
                      {ticks.map((v, i) => (
                        <span key={i} style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1, textAlign: "right", minWidth: 20 }}>{v}</span>
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <svg width="100%" height={chartH} viewBox={`0 -5 ${chartW} ${chartH + 5}`} preserveAspectRatio="none">
                        {[0.25, 0.5, 0.75, 1].map(f => (
                          <line key={f} x1={0} y1={chartH * (1 - f)} x2={chartW} y2={chartH * (1 - f)} stroke="#f1f5f9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                        ))}
                        <polyline points={newPts} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        <polyline points={clPts} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        {data.map((d, i) => (
                          <g key={i}>
                            <circle cx={px(i)} cy={py(d.newCount)} r={4} fill="#3b82f6" vectorEffect="non-scaling-stroke" />
                            <circle cx={px(i)} cy={py(d.closedCount)} r={3.5} fill="#94a3b8" vectorEffect="non-scaling-stroke" />
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, paddingLeft: 28 }}>
                    {data.map((d, i) => (
                      <span key={i} style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                    ))}
                  </div>
                </div>
              );
            };
            const { tcCount, entryCount, passedTotal, failedTotal, defTotal, openDefs, passRate, availableRuns,
              execByStatus, defByStatus, defByPriority, perPlanStats, trendDays, defectTrendDays } = dashboardStats;
            const blockedTotal = execByStatus["Blocked"] || 0;
            const execSegs = [
              { value: passedTotal, color: "#22c55e" },
              { value: failedTotal, color: "#f43f5e" },
              { value: blockedTotal, color: "#f97316" },
              { value: Math.max(0, entryCount - passedTotal - failedTotal - blockedTotal), color: "#e2e8f0" },
            ];
            return (
              <div ref={dashboardRef} style={{ background: "#fff", minHeight: "calc(100vh - 60px)", padding: "24px 28px 40px" }}>
                {/* Filters row */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={dashProjectId} onChange={e => { setDashProjectId(e.target.value); setDashPlanId(""); setDashRunId(""); }}
                      style={{ ...inp, width: "auto", minWidth: 160, fontSize: 13 }}>
                      <option value="">All Projects</option>
                      {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </select>
                    <select value={dashPlanId} onChange={e => { setDashPlanId(e.target.value); setDashRunId(""); }}
                      style={{ ...inp, width: "auto", minWidth: 160, fontSize: 13 }}>
                      <option value="">All Test Plans</option>
                      {(projects.find(p => String(p.id) === dashProjectId)?.testPlans || []).map(tp => (
                        <option key={tp.id} value={String(tp.id)}>{tp.name}</option>
                      ))}
                    </select>
                    <select value={dashRunId} onChange={e => setDashRunId(e.target.value)}
                      style={{ ...inp, width: "auto", minWidth: 180, fontSize: 13 }}>
                      <option value="">All Test Runs</option>
                      {availableRuns.map(r => (
                        <option key={r.id} value={String(r.id)}>{r.name}</option>
                      ))}
                    </select>
                    <button onClick={() => { if (!dashboardRef.current) return; html2canvas(dashboardRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(canvas => { const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = "uat-dashboard.png"; a.click(); }); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer", whiteSpace: "nowrap" }}>Export Report</button>
                  </div>
                </div>
                {/* Top 5 summary cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5,1fr)",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      icon: <Files size={24} strokeWidth={2.2} />,
                      iconBg: "rgba(99,102,241,0.10)",

                      iconColor: "#6366F1",
                      label: "Total Test Cases",
                      value: tcCount,
                      sub: "Linked to active plans",
                      color: "#6366F1",
                    },

                    {
                      icon: <CheckCircle2 size={24} strokeWidth={2.2} />,
                      iconBg: "rgba(34,197,94,0.10)",
                      iconColor: "#22C55E",
                      label: "Passed",
                      value: passedTotal,
                      sub: `of ${entryCount.toLocaleString()} executed`,
                      color: "#16A34A",
                    },

                    {
                      icon: <XCircle size={24} strokeWidth={2.2} />,
                      iconBg: "rgba(239,68,68,0.10)",
                      iconColor: "#EF4444",
                      label: "Failed",
                      value: failedTotal,
                      sub: `of ${entryCount.toLocaleString()} executed`,
                      color: "#DC2626",
                    },

                    {
                      icon: <Ban size={24} strokeWidth={2.2} />,
                      iconBg: "rgba(245,158,11,0.10)",
                      iconColor: "#F59E0B",
                      label: "Blocked",
                      value: blockedTotal,
                      sub: `of ${entryCount.toLocaleString()} executed`,
                      color: "#EA580C",
                    },
                  ].map(
                    ({
                      icon,
                      iconBg,
                      iconColor,
                      label,
                      value,
                      sub,
                      color,
                    }) => (
                      <div
                        key={label}
                        style={{
                          background: "rgba(255,255,255,0.75)",

                          backdropFilter: "blur(14px)",

                          border: "1px solid rgba(255,255,255,0.65)",

                          borderRadius: 20,

                          padding: "20px",

                          boxShadow:
                            "0 10px 30px rgba(15,23,42,0.05)",

                          display: "flex",
                          alignItems: "center",
                          gap: 16,

                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            width: 56,
                            height: 56,

                            borderRadius: 18,

                            background: iconBg,

                            border: `1px solid ${iconColor}20`,

                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",

                            color: iconColor,

                            flexShrink: 0,
                          }}
                        >
                          {icon}
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              color,
                              fontWeight: 700,
                              marginBottom: 6,
                            }}
                          >
                            {label}
                          </div>

                          <div
                            style={{
                              fontSize: 30,
                              fontWeight: 800,
                              color: "#0F172A",
                              lineHeight: 1,
                            }}
                          >
                            {value.toLocaleString()}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: "#94A3B8",
                              marginTop: 6,
                            }}
                          >
                            {sub}
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {/* Progress Card */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.75)",

                      backdropFilter: "blur(14px)",

                      border: "1px solid rgba(255,255,255,0.65)",

                      borderRadius: 20,

                      padding: "20px",

                      boxShadow:
                        "0 10px 30px rgba(15,23,42,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,

                          borderRadius: 18,

                          background:
                            "rgba(99,102,241,0.10)",

                          border:
                            "1px solid rgba(99,102,241,0.18)",

                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",

                          color: "#6366F1",

                          flexShrink: 0,

                          transform: "translateY(10px)",
                        }}
                      >
                        <Activity size={24} strokeWidth={2.2} />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6366F1",
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          Execution Progress
                        </div>

                        <div
                          style={{
                            fontSize: 30,
                            fontWeight: 800,
                            color: "#0F172A",
                            lineHeight: 1,
                          }}
                        >
                          {passRate}%
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#94A3B8",
                            marginTop: 6,
                          }}
                        >
                          {passedTotal.toLocaleString()} passed /{" "}
                          {tcCount.toLocaleString()} total
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginLeft: 72,

                        height: 10,

                        background: "#EEF2FF",

                        borderRadius: 999,

                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${passRate}%`,
                          height: "100%",

                          background:
                            "linear-gradient(90deg,#6366F1,#8B5CF6)",

                          borderRadius: 999,

                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Middle two columns */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                  <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 30 }}>Test Execution Breakdown</div>
                    {Object.entries(execByStatus).map(([status, count]) => {
                      const meta = EXEC_STATUS[status];
                      const pct = entryCount > 0 ? Math.round((count / entryCount) * 100) : 0;
                      return (
                        <div key={status} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, width: 88, flexShrink: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta?.dot || "#94a3b8", display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{status}</span>
                          </div>
                          <div style={{ flex: 1, height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: meta?.dot || "#94a3b8", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", width: 28, textAlign: "right", flexShrink: 0 }}>{count}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8", width: 32, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 16 }}>
                      <DonutChart size={100} strokeWidth={16} label={`${passRate}%`} segments={execSegs} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>Overall Execution Progress</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{passedTotal.toLocaleString()} / {tcCount.toLocaleString()} Test Cases Executed</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 34 }}>Defect Status Breakdown</div>
                    <div style={{ display: "flex", gap: 36, alignItems: "flex-start", marginBottom: 18 }}>
                      <div style={{ flexShrink: 0 }}>
                        <DonutChart size={165} strokeWidth={35} label={defTotal} subLabel="Total"
                          segments={Object.entries(defByStatus).map(([s, c]) => ({ value: c, color: DEFECT_STATUS[s]?.dot || "#94a3b8" }))}
                        />
                      </div>
                      <div style={{ flex: 1, paddingLeft: 8 }}>
                        {Object.entries(defByStatus).map(([status, count]) => {
                          const meta = DEFECT_STATUS[status];
                          const pct = defTotal > 0 ? Math.round((count / defTotal) * 100) : 0;
                          return (
                            <div key={status} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta?.dot || "#94a3b8", flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: "#64748b", width: 92, flexShrink: 0 }}>{status}</span>
                              <div style={{ flex: 1, minWidth: 0, height: 5, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: meta?.dot || "#94a3b8", borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", width: 18, textAlign: "right", flexShrink: 0 }}>{count}</span>
                              <span style={{ fontSize: 12, color: "#94a3b8", width: 30, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ borderTop: "1.5px solid #f1f5f9", paddingTop: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 12 }}>⚠ Defect Priority</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                        {Object.entries(PRIORITY_META).map(([pri, meta]) => {
                          const count = defByPriority[pri] || 0;
                          return (
                            <div key={pri} style={{ background: meta.bg + "18", border: `1.5px solid ${meta.bg}44`, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: meta.bg, marginBottom: 4, textTransform: "uppercase" }}>{pri}</div>
                              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{count}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Trends */}
                <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 18 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 20 }}>📈 Trends (Last 7 Days)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Daily Test Execution Trend</div>
                      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                        {[["Passed", "#22c55e"], ["Failed", "#f43f5e"], ["Blocked", "#f97316"]].map(([l, c]) => (
                          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                          </span>
                        ))}
                      </div>
                      <BarChart data={trendDays} height={170} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Defect Trend</div>
                      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                        {[["New", "#3b82f6"], ["Closed", "#94a3b8"]].map(([l, c]) => (
                          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                          </span>
                        ))}
                      </div>
                      <LineChart data={defectTrendDays} height={170} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 14 }}>Defects by Priority</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, paddingTop: 50 }}>
                        <div style={{ flexShrink: 0 }}>
                          <DonutChart size={130} strokeWidth={20} label={defTotal} subLabel="Total"
                            segments={Object.entries(PRIORITY_META).map(([pri, meta]) => ({ value: defByPriority[pri] || 0, color: meta.bg }))}
                          />
                        </div>
                        <div>
                          {Object.entries(PRIORITY_META).map(([pri, meta]) => {
                            const count = defByPriority[pri] || 0;
                            const pct = defTotal > 0 ? Math.round((count / defTotal) * 100) : 0;
                            return (
                              <div key={pri} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13 }}>
                                <span style={{ width: 9, height: 9, borderRadius: "50%", background: meta.bg, flexShrink: 0 }} />
                                <span style={{ color: "#64748b", width: 90 }}>{pri}</span>
                                <span style={{ fontWeight: 700, color: "#334155", minWidth: 20, textAlign: "right" }}>{count}</span>
                                <span style={{ color: "#94a3b8", minWidth: 38, textAlign: "right" }}>{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-plan summary table */}
                {!dashPlanId && perPlanStats.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ padding: "16px 24px", borderBottom: "1.5px solid #f1f5f9", fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Test Plan Summary</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            {["Project", "Test Plan", "Test Cases", "Executions", "Passed", "Failed", "Total Defects", "Open Defects"].map(h => (
                              <th key={h} style={{ padding: "10px 16px", textAlign: h === "Project" || h === "Test Plan" ? "left" : "center", fontWeight: 700, color: "#64748b", textTransform: "uppercase", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {perPlanStats.map(({ tp, projectName, tcCount: ptc, defCount, openDefs: pOpen, passed, failed, totalEntries }) => (
                            <tr key={tp.id} style={{ borderTop: "1px solid #f8fafc" }}>
                              <td style={{ padding: "11px 16px", color: "#64748b" }}>{projectName}</td>
                              <td style={{ padding: "11px 16px", fontWeight: 700, color: "#334155" }}>{tp.name}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center", fontWeight: 700, color: "#6366f1" }}>{ptc}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center", color: "#64748b" }}>{totalEntries}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center", fontWeight: 700, color: "#22c55e" }}>{passed}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center", fontWeight: 700, color: failed > 0 ? "#ef4444" : "#94a3b8" }}>{failed}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center", fontWeight: 700, color: defCount > 0 ? "#f97316" : "#94a3b8" }}>{defCount}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center" }}>
                                {pOpen > 0
                                  ? <span style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 999, padding: "3px 12px", fontWeight: 700, fontSize: 12 }}>{pOpen}</span>
                                  : <span style={{ color: "#22c55e", fontWeight: 700 }}>0</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            );
          })()}

          {/* ── MODAL: VIEW TC ── */}
          {viewTC && (
            <Modal onClose={() => setViewTC(null)} zIndex={1300} onPaste={canWrite ? e => onTestCasePasteUpload(e, viewTC.id) : undefined}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 10px", borderRadius: 6, border: "1px solid #c7d2fe" }}>{viewTC.tcNumber}</span>
                  <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{viewTC.name}</div>
                </div>
                <button onClick={() => setViewTC(null)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
                <PriBadge label={viewTC.priority} />
                <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{viewTC.category.split("(")[0].trim()}</span>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                {viewTC.description && <DetailBlock label="Description" value={viewTC.description} />}
                <DetailBlock label="Test Steps" value={viewTC.steps} pre />
                <DetailBlock label="Expected Result" value={viewTC.expectedResult} accent />
                {viewTC.testScopeId && testScopeNameById[viewTC.testScopeId] && (
                  <DetailBlock label="Testing Scope" value={testScopeNameById[viewTC.testScopeId]} />
                )}
                {viewTC.remarks && <DetailBlock label="Remarks" value={viewTC.remarks} />}
              </div>
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1.5px solid #f1f5f9" }}>
                <div style={{ ...lbl, marginBottom: 10 }}>Attachments</div>
                {canWrite && <div
                  style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
                >
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                    Paste screenshot with Ctrl+V or attach file(s)
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    onChange={e => {
                      uploadTestCaseFiles(viewTC.id, e.target.files);
                      e.target.value = "";
                    }}
                    style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                  />
                </div>}
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {(testCaseAttachments[viewTC.id] || []).length === 0 && (
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments yet.</div>
                  )}

                  {(testCaseAttachments[viewTC.id] || []).map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                      <button
                        type="button"
                        onClick={() => openAttachment(a.url, a.fileName)}
                        style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, textDecoration: "none", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                        title="Open attachment"
                      >
                        {a.fileName}
                      </button>
                      <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                      <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                      <button onClick={() => deleteTestCaseAttachment(viewTC.id, a.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  ))}

                  {uploadingTestCaseId === viewTC.id && (
                    <div style={{ color: "#64748b", fontSize: 12 }}>Uploading...</div>
                  )}
                </div>
              </div>
            </Modal>
          )}

          {/* ── MODAL: RUN DETAIL ── */}
          {viewRun && (
            <Modal onClose={() => setViewRun(null)} wide>
              {(() => {
                const sortedRunEntries = sortRunEntriesByTestCaseId(viewRun.entries);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 5 }}>{viewRun.runNumber}</span>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{viewRun.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>👤 {viewRun.tester} · {viewRun.createdAt?.slice(0, 10)}</div>
                      </div>
                      <button onClick={() => setViewRun(null)} style={xBtn}>✕</button>
                    </div>

                    {(() => {
                      const st = runStats(viewRun); const byStatusPriority = runStatusPriorityStats(viewRun); const pct = st.total > 0 ? Math.round((st.pass / st.total) * 100) : 0; return (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                          <StatChip label="Total" value={st.total} color="#6366f1" bg="#eff6ff" />
                          <StatChip label="Passed" value={st.pass} color="#15803d" bg="#f0fdf4" />
                          <StatChip label="Failed" value={st.fail} color="#be123c" bg="#fff1f2" />
                          <StatChip label="Not Run" value={st.notRun} color="#64748b" bg="#f8fafc" />
                          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 120, height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#22c55e" : "linear-gradient(90deg,#6366f1,#06b6d4)", borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? "#15803d" : "#64748b" }}>{pct}%</span>
                          </div>
                          <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {Object.keys(EXEC_STATUS).map(status => {
                              const s = byStatusPriority[status];
                              if (!s || s.total === 0) return null;
                              return (
                                <span key={status} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, padding: "4px 10px", fontSize: 12, color: "#475569", fontWeight: 700 }}>
                                  {status}: High {s.High} | Medium {s.Medium} | Low {s.Low}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {canWrite && <AddTcToRunRow testCases={allTestCases} run={viewRun} onAdd={tcId => addTcToRun(viewRun.id, tcId)} />}

                    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                      {sortedRunEntries.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#cbd5e1" }}>No test cases in this run yet.</div>}
                      {sortedRunEntries.map(entry => {
                        const tc = allTestCaseById[entry.testCaseId];
                        const ec = EXEC_STATUS[entry.execStatus] || EXEC_STATUS["Not Run"];
                        const entryDefects = entry.defects || [];
                        return (
                          <div key={entry.id} style={{ border: `1.5px solid ${ec.border}`, borderRadius: 12, padding: "14px 16px", background: ec.bg, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#6366f1", background: "#fff", padding: "1px 7px", borderRadius: 5, border: "1px solid #c7d2fe", flexShrink: 0 }}>{tc?.tcNumber}</span>
                                  <PriBadge label={tc?.priority || "Medium"} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 15, lineHeight: 1.4 }}>{tc?.name || entry.testCaseId}</div>
                                  <button
                                    type="button"
                                    title={tc ? "Click to view test case details" : "Test case details unavailable"}
                                    onClick={() => {
                                      if (!tc) return;
                                      setViewTC(tc);
                                    }}
                                    disabled={!tc}
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: "50%",
                                      border: "1px solid #cbd5e1",
                                      background: tc ? "#fff" : "#f1f5f9",
                                      color: tc ? "#475569" : "#94a3b8",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      lineHeight: 1,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: tc ? "pointer" : "not-allowed",
                                      padding: 0,
                                      flexShrink: 0
                                    }}
                                  >
                                    i
                                  </button>
                                </div>
                                <div style={{ marginTop: 10 }}>
                                  {[...(entry.comments || [])]
                                    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                                    .map(c => (
                                      <div
                                        key={c.id}
                                        onClick={() => {
                                          if (!canComment) return;
                                          const key = `run-${entry.testCaseId}`;
                                          const current = commentDrafts[entry.testCaseId] || "";
                                          replyToComment(
                                            key,
                                            current,
                                            next => setCommentDrafts(p => ({ ...p, [entry.testCaseId]: next })),
                                            c.tester
                                          );
                                        }}
                                        style={{
                                          background: "#fff",
                                          border: "1px solid #e2e8f0",
                                          borderRadius: 8,
                                          padding: "8px 12px",
                                          marginBottom: 8,
                                          cursor: canComment ? "pointer" : "default"
                                        }}
                                      >
                                        <div style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          marginBottom: 4
                                        }}>
                                          <span style={{
                                            fontWeight: 700,
                                            color: "#475569",
                                            fontSize: 12
                                          }}>
                                            {c.tester}
                                          </span>

                                          <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8
                                          }}>
                                            <span style={{
                                              fontSize: 11,
                                              color: "#94a3b8"
                                            }}>
                                              {new Date(c.createdAt).toLocaleString()}
                                            </span>

                                            {canDelete && (
                                              <button
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  deleteComment(
                                                    viewRun.id,
                                                    entry.testCaseId,
                                                    c.id
                                                  );
                                                }}
                                                style={{
                                                  border: "none",
                                                  background: "none",
                                                  color: "#ef4444",
                                                  cursor: "pointer"
                                                }}
                                              >
                                                ✕
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        <div style={{
                                          fontSize: 13,
                                          color: "#334155"
                                        }}>
                                          {c.message}
                                        </div>
                                      </div>
                                    ))}

                                  <div style={{
                                    display: "flex",
                                    gap: 8
                                  }}>
                                    <input
                                      placeholder="Add comment... (use @Display Name to tag)"
                                      value={commentDrafts[entry.testCaseId] || ""}
                                      ref={node => registerMentionInputRef(`run-${entry.testCaseId}`, node)}
                                      onChange={e => {
                                        const value = e.target.value;
                                        handleMentionInputChange(
                                          "run",
                                          `run-${entry.testCaseId}`,
                                          value,
                                          next => setCommentDrafts(p => ({ ...p, [entry.testCaseId]: next }))
                                        );
                                      }}
                                      onKeyDown={e => handleMentionKeyDown(
                                        e,
                                        "run",
                                        `run-${entry.testCaseId}`,
                                        commentDrafts[entry.testCaseId] || "",
                                        next => setCommentDrafts(p => ({ ...p, [entry.testCaseId]: next }))
                                      )}
                                      style={{
                                        ...inp,
                                        fontSize: 12,
                                        flex: 1
                                      }}
                                    />

                                    {canComment && (
                                      <button
                                        onClick={() =>
                                          addComment(
                                            viewRun.id,
                                            entry.testCaseId
                                          )
                                        }
                                        style={btnP}
                                      >
                                        Add
                                      </button>
                                    )}
                                  </div>
                                  {mentionPicker?.type === "run" && mentionPicker?.key === `run-${entry.testCaseId}` && (
                                    <div style={{ marginTop: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                      {mentionPicker.list.map((u, idx) => (
                                        <button
                                          key={`run-mention-${entry.testCaseId}-${u.id}`}
                                          type="button"
                                          onMouseDown={e => e.preventDefault()}
                                          onClick={() => {
                                            const current = commentDrafts[entry.testCaseId] || "";
                                            selectMention(
                                              "run",
                                              `run-${entry.testCaseId}`,
                                              current,
                                              next => setCommentDrafts(p => ({ ...p, [entry.testCaseId]: next })),
                                              u.displayName
                                            );
                                          }}
                                          style={{ width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid #f1f5f9", background: mentionPicker.activeIndex === idx ? "#eff6ff" : "#fff", color: "#0f172a", padding: "7px 10px", fontSize: 12, cursor: "pointer" }}
                                        >
                                          {u.displayName}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <select value={entry.execStatus || "Not Run"} onChange={e => updateExecStatus(viewRun.id, entry.testCaseId, e.target.value)} disabled={!canWrite}
                                    style={{ background: ec.bg, color: ec.text, border: `1.5px solid ${ec.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none" }}>
                                    {Object.keys(EXEC_STATUS).map(s => <option key={s}>{s}</option>)}
                                  </select>
                                  {canDelete && (
                                    <button onClick={() => removeTcFromRun(viewRun.id, entry.testCaseId)} title="Remove from run"
                                      style={{ background: "#f1f5f9", border: "none", color: "#94a3b8", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                                  )}
                                </div>
                                {entry.statusChangedAt && (
                                  <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", lineHeight: 1.3 }}>
                                    <div>Changed: {new Date(entry.statusChangedAt).toLocaleDateString()} {new Date(entry.statusChangedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    {entry.statusChangedBy && <div>by {entry.statusChangedBy}</div>}
                                  </div>
                                )}
                                {canWrite &&
                                  (entry.execStatus === "Fail" || entry.execStatus === "Failed") &&
                                  entryDefects.length === 0 && (
                                    <button
                                      onClick={() => createDefect(viewRun.id, entry.testCaseId)}
                                      style={{
                                        ...btnD,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                      }}
                                    >
                                      <Bug size={14} />
                                      Create Defect
                                    </button>
                                  )}
                                {entryDefects.map(d => (
                                  <span key={d.id} style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", background: "#fff1f2", border: "1px solid #fecdd3", padding: "3px 10px", borderRadius: 20, cursor: "pointer" }}
                                    onClick={() => setViewDef(d)}>
                                    🔗 {d.defectNumber}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </Modal>
          )}

          {/* ── MODAL: DEFECT DETAIL ── */}
          {viewDef && (
            <Modal onClose={() => setViewDef(null)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>Defect Details</div>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                    {viewDef.defectNumber || `#${viewDef.id}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyDefectLink(viewDef.id)}
                    style={{ ...btnS, padding: "4px 10px", fontSize: 12, lineHeight: 1.2 }}
                    title="Copy shareable defect link"
                  >
                    Copy Link
                  </button>
                </div>
                <button onClick={() => setViewDef(null)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Market</label>
                    <input
                      value={viewDef.market || ""}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={lbl}>Run</label>
                    <input
                      value={viewDef.runNumber || "Standalone"}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  {viewDef.tcNumber && (
                    <div>
                      <label style={lbl}>Test Case</label>
                      <input
                        value={viewDef.tcNumber}
                        style={{ ...inp, background: "#f8fafc" }}
                        readOnly
                      />
                    </div>
                  )}
                  {viewDef.testPlanId && (
                    <div>
                      <label style={lbl}>Test Plan</label>
                      <input
                        value={testPlanMetaById[viewDef.testPlanId]
                          ? `${testPlanMetaById[viewDef.testPlanId].projectName} — ${testPlanMetaById[viewDef.testPlanId].testPlanName}`
                          : `Plan #${viewDef.testPlanId}`}
                        style={{ ...inp, background: "#f8fafc" }}
                        readOnly
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={lbl}>Issue Type</label>
                  <input
                    value={viewDef.issueType || ""}
                    style={{ ...inp, background: "#f8fafc" }}
                    readOnly
                  />
                </div>

                <div>
                  <label style={lbl}>Description</label>
                  <textarea
                    value={viewDef.description || ""}
                    readOnly
                    style={{ ...inp, minHeight: 80, resize: "vertical", background: "#f8fafc" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Expected Result</label>
                  <textarea
                    value={viewDef.expectedResult || ""}
                    readOnly
                    style={{ ...inp, minHeight: 70, resize: "vertical", background: "#f8fafc" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Actual Result</label>
                  <textarea
                    value={viewDef.actualResult || ""}
                    readOnly
                    style={{ ...inp, minHeight: 70, resize: "vertical", background: "#f8fafc" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Priority</label>
                    <input
                      value={viewDef.priority || ""}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={lbl}>Raised By</label>
                    <input
                      value={viewDef.raisedBy || ""}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={lbl}>Assigned To</label>
                    <input
                      value={viewDef.assignedTo || "Unassigned"}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={lbl}>Target Fix Date</label>
                    <input
                      type="date"
                      value={viewDef.targetFixDate ? String(viewDef.targetFixDate).slice(0, 10) : ""}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Remarks</label>
                  <textarea
                    value={viewDef.remarks || ""}
                    readOnly
                    style={{ ...inp, minHeight: 60, resize: "vertical", background: "#f8fafc" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Attachments</label>
                  <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                    {(defectAttachments[viewDef.id] || []).length === 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments.</div>
                    )}
                    {(defectAttachments[viewDef.id] || []).map(a => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                        <button
                          type="button"
                          onClick={() => openAttachment(a.url, a.fileName)}
                          style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                          title="Open attachment"
                        >
                          {a.fileName}
                        </button>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={lbl}>Comments</label>
                  <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                    {(viewDef.comments || []).length === 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>No comments yet.</div>
                    )}
                    {(viewDef.comments || []).map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (!canComment) return;
                          const key = `defect-${viewDef.id}`;
                          const current = defectCommentDrafts[viewDef.id] || "";
                          replyToComment(
                            key,
                            current,
                            next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next })),
                            c.tester
                          );
                        }}
                        style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: canComment ? "pointer" : "default" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: "#475569", fontSize: 12 }}>{c.tester}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(c.createdAt).toLocaleString()}</span>
                            {canDelete && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  deleteDefectComment(viewDef.id, c.id);
                                }}
                                style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}
                              >✕</button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "#334155" }}>{c.message}</div>
                      </div>
                    ))}
                    {canComment && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            placeholder="Add a comment... (use @Display Name to tag)"
                            value={defectCommentDrafts[viewDef.id] || ""}
                            ref={node => registerMentionInputRef(`defect-${viewDef.id}`, node)}
                            onChange={e => {
                              const value = e.target.value;
                              handleMentionInputChange(
                                "defect",
                                `defect-${viewDef.id}`,
                                value,
                                next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next }))
                              );
                            }}
                            onKeyDown={e => {
                              handleMentionKeyDown(
                                e,
                                "defect",
                                `defect-${viewDef.id}`,
                                defectCommentDrafts[viewDef.id] || "",
                                next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next }))
                              );
                              if (e.key === "Enter" && !e.shiftKey && !(mentionPicker?.type === "defect" && mentionPicker?.key === `defect-${viewDef.id}` && mentionPicker?.list?.length)) {
                                e.preventDefault();
                                addDefectComment(viewDef.id);
                              }
                            }}
                            style={{ ...inp, fontSize: 13, flex: 1 }}
                          />
                          <button
                            onClick={() => addDefectComment(viewDef.id)}
                            disabled={!defectCommentDrafts[viewDef.id]?.trim()}
                            style={{ ...btnP, opacity: defectCommentDrafts[viewDef.id]?.trim() ? 1 : 0.5 }}
                          >Add</button>
                        </div>
                        {mentionPicker?.type === "defect" && mentionPicker?.key === `defect-${viewDef.id}` && (
                          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                            {mentionPicker.list.map((u, idx) => (
                              <button
                                key={`defect-mention-${viewDef.id}-${u.id}`}
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                  const current = defectCommentDrafts[viewDef.id] || "";
                                  selectMention(
                                    "defect",
                                    `defect-${viewDef.id}`,
                                    current,
                                    next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next })),
                                    u.displayName
                                  );
                                }}
                                style={{ width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid #f1f5f9", background: mentionPicker.activeIndex === idx ? "#eff6ff" : "#fff", color: "#0f172a", padding: "7px 10px", fontSize: 12, cursor: "pointer" }}
                              >
                                {u.displayName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => setViewDef(null)} style={btnS}>Close</button>
              </div>
            </Modal>
          )}

          {/* ── MODAL: EDIT DEFECT ── */}
          {editDef && (
            <Modal onClose={() => setEditDef(null)} onPaste={e => onDefectPasteUpload(e, editDef.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Defect</div>
                <button onClick={() => setEditDef(null)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Market</label>
                    <select
                      value={editDef.market || "SG"}
                      onChange={e => setEditDef(p => ({ ...p, market: e.target.value }))}
                      style={inp}
                    >
                      {["SG", "HK", "MY", "KR", "US", "ID", "TW"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Run</label>
                    <select
                      value={editDef.linkedRunId || ""}
                      onChange={e => setEditDef(p => ({ ...p, linkedRunId: e.target.value || "" }))}
                      style={inp}
                    >
                      <option value="">Standalone defect</option>
                      {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                    </select>
                  </div>
                  {editDef.linkedRunId && (
                    <div>
                      <label style={lbl}>Test Case</label>
                      <select
                        value={editDef.linkedTestCaseId || ""}
                        onChange={e => setEditDef(p => ({ ...p, linkedTestCaseId: e.target.value || "" }))}
                        style={inp}
                      >
                        <option value="">No specific test case (run-level defect)</option>
                        {(() => {
                          const run = runs.find(r => String(r.id) === String(editDef.linkedRunId));
                          const options = (run?.entries || [])
                            .map(en => allTestCaseById[en.testCaseId])
                            .filter(Boolean);
                          return options.map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>);
                        })()}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label style={lbl}>Issue Type</label>
                  <select
                    value={editDef.issueType || "Functional Issue"}
                    onChange={e => setEditDef(p => ({ ...p, issueType: e.target.value }))}
                    style={inp}
                  >
                    {["Functional Issue", "UI Issue", "Performance Issue", "Data Issue", "Other"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label style={lbl}>Description</label>
                  <textarea
                    value={editDef.description || ""}
                    onChange={e => setEditDef(p => ({ ...p, description: e.target.value }))}
                    style={{ ...inp, minHeight: 80, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Expected Result</label>
                  <textarea
                    value={editDef.expectedResult || ""}
                    onChange={e => setEditDef(p => ({ ...p, expectedResult: e.target.value }))}
                    style={{ ...inp, minHeight: 70, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Actual Result</label>
                  <textarea
                    value={editDef.actualResult || ""}
                    onChange={e => setEditDef(p => ({ ...p, actualResult: e.target.value }))}
                    style={{ ...inp, minHeight: 70, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Priority</label>
                    <select
                      value={editDef.priority} onChange={e => setEditDef(p => ({ ...p, priority: e.target.value }))}
                      style={inp}
                    >
                      {Object.keys(PRIORITY_META).map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Raised By</label>
                    <input
                      value={editDef.raisedBy || ""}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={lbl}>Assigned To</label>
                    <select
                      value={editDef.assignedTo || ""}
                      onChange={e => setEditDef(p => ({ ...p, assignedTo: e.target.value }))}
                      style={inp}
                    >
                      <option value="">Unassigned</option>
                      {assignableUserDisplayNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Target Fix Date</label>
                    <input
                      type="date"
                      value={editDef.targetFixDate ? String(editDef.targetFixDate).slice(0, 10) : ""}
                      onChange={e => setEditDef(p => ({ ...p, targetFixDate: e.target.value }))}
                      style={inp}
                    />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Remarks</label>
                  <textarea
                    value={editDef.remarks || ""}
                    onChange={e => setEditDef(p => ({ ...p, remarks: e.target.value }))}
                    style={{ ...inp, minHeight: 60, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Attachments</label>

                  {/* Existing uploaded attachments */}
                  <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                    {(defectAttachments[editDef.id] || []).map(a => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                        <button
                          type="button"
                          onClick={() => openAttachment(a.url, a.fileName)}
                          style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                          title="Open attachment"
                        >
                          {a.fileName}
                        </button>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                        {canDelete && (
                          <button onClick={() => deleteDefectAttachment(editDef.id, a.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      Paste screenshot with Ctrl+V or attach file(s)
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={e => {
                        queueNewDefectFiles(e.target.files);
                        e.target.value = "";
                      }}
                      style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {newDefAttachments.length === 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>No new attachments queued.</div>
                    )}

                    {newDefAttachments.map((f, i) => (
                      <div key={`${f.name}-${f.size}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                        <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>Will upload after saving</span>
                        <button onClick={() => removeQueuedNewDefectFile(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => { setEditDef(null); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
                <button onClick={saveDefectEdits} style={{ ...btnP, opacity: !editDef?.description ? 0.5 : 1 }} disabled={!editDef?.description}>Save Changes</button>
              </div>
            </Modal>
          )}

          {/* ── MODAL: ADD TC ── */}
          {showAddTC && (
            <Modal onClose={() => setShowAddTC(false)} onPaste={onNewTestCasePasteUpload}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Add Test Case</div>
                <button onClick={() => setShowAddTC(false)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div><label style={lbl}>Test Name *</label><input value={newTC.name} onChange={e => setNewTC(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="[Market] - [Module] - [Feature] - [Expected]" /></div>
                <div><label style={lbl}>Description</label><textarea value={newTC.description} onChange={e => setNewTC(p => ({ ...p, description: e.target.value }))} style={{ ...inp, minHeight: 70, resize: "vertical" }} /></div>
                <div><label style={lbl}>Test Steps</label><textarea value={newTC.steps} onChange={e => setNewTC(p => ({ ...p, steps: e.target.value }))} style={{ ...inp, minHeight: 90, resize: "vertical" }} placeholder="Step 1: …&#10;Step 2: …" /></div>
                <div><label style={lbl}>Expected Result</label><textarea value={newTC.expected} onChange={e => setNewTC(p => ({ ...p, expected: e.target.value }))} style={{ ...inp, minHeight: 70, resize: "vertical" }} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={lbl}>Priority</label>
                    <select value={newTC.priority} onChange={e => setNewTC(p => ({ ...p, priority: e.target.value }))} style={inp}>
                      {TEST_CASE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Category</label>
                    <select value={newTC.category} onChange={e => setNewTC(p => ({ ...p, category: e.target.value }))} style={inp}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={lbl}>Testing Scope</label>
                  <select value={newTC.testScopeId} onChange={e => setNewTC(p => ({ ...p, testScopeId: e.target.value }))} style={inp}>
                    <option value="">No scope</option>
                    {(testScopesByPlanId[selectedTestPlanId] || []).map(scope => (
                      <option key={scope.id} value={scope.id}>{scope.name}</option>
                    ))}
                  </select>
                </div>
                <div><label style={lbl}>Remarks</label><input value={newTC.remarks} onChange={e => setNewTC(p => ({ ...p, remarks: e.target.value }))} style={inp} /></div>
                <div style={{ marginTop: 2 }}>
                  <label style={lbl}>Attachments</label>
                  <div
                    style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      Paste screenshot with Ctrl+V or attach file(s)
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={e => {
                        queueNewTestCaseFiles(e.target.files);
                        e.target.value = "";
                      }}
                      style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {newTCAttachments.length === 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments selected yet.</div>
                    )}

                    {newTCAttachments.map((f, i) => (
                      <div key={`${f.name}-${f.size}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                        <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>Will upload after test case is created</span>
                        <button onClick={() => removeQueuedNewTestCaseFile(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddTC(false)} style={btnS}>Cancel</button>
                <button onClick={addTC} style={{ ...btnP, opacity: (!newTC.name || !selectedTestPlanId) ? 0.5 : 1 }} disabled={!newTC.name || !selectedTestPlanId}>Add Test Case</button>
              </div>
            </Modal>
          )}

          {showAddProject && canManageProjects && (
            <Modal onClose={() => setShowAddProject(false)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Add Project</div>
                <button onClick={() => setShowAddProject(false)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={lbl}>Project Name *</label>
                  <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} style={inp} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Start Date *</label>
                    <input type="date" value={newProjectStartDate} onChange={e => setNewProjectStartDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>End Date *</label>
                    <input type="date" value={newProjectEndDate} onChange={e => setNewProjectEndDate(e.target.value)} style={inp} />
                  </div>
                </div>
                {!isValidDateRange(newProjectStartDate, newProjectEndDate) && (newProjectStartDate || newProjectEndDate) && (
                  <div style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>Project start date must be on or before end date.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddProject(false)} style={btnS}>Cancel</button>
                <button onClick={addProject} style={{ ...btnP, opacity: (!newProjectName.trim() || !isValidDateRange(newProjectStartDate, newProjectEndDate)) ? 0.5 : 1 }} disabled={!newProjectName.trim() || !isValidDateRange(newProjectStartDate, newProjectEndDate)}>Create Project</button>
              </div>
            </Modal>
          )}

          {showAddPlan && canManageProjects && (
            <Modal onClose={() => setShowAddPlan(false)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Add Test Plan</div>
                <button onClick={() => setShowAddPlan(false)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={lbl}>Project</label>
                  <input value={selectedProject?.name || "No project selected"} style={{ ...inp, background: "#f8fafc" }} readOnly />
                </div>
                <div>
                  <label style={lbl}>Project Timeline</label>
                  <input value={formatTimeline(selectedProject?.startDate, selectedProject?.endDate)} style={{ ...inp, background: "#f8fafc" }} readOnly />
                </div>
                <div>
                  <label style={lbl}>Test Plan Name *</label>
                  <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} style={inp} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Start Date *</label>
                    <input
                      type="date"
                      value={newPlanStartDate}
                      onChange={e => setNewPlanStartDate(e.target.value)}
                      min={toInputDate(selectedProject?.startDate)}
                      max={toInputDate(selectedProject?.endDate) || undefined}
                      style={inp}
                    />
                  </div>
                  <div>
                    <label style={lbl}>End Date *</label>
                    <input
                      type="date"
                      value={newPlanEndDate}
                      onChange={e => setNewPlanEndDate(e.target.value)}
                      min={toInputDate(selectedProject?.startDate)}
                      max={toInputDate(selectedProject?.endDate) || undefined}
                      style={inp}
                    />
                  </div>
                </div>
                {!isValidDateRange(newPlanStartDate, newPlanEndDate) && (newPlanStartDate || newPlanEndDate) && (
                  <div style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>Test plan start date must be on or before end date.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddPlan(false)} style={btnS}>Cancel</button>
                <button onClick={addTestPlan} style={{ ...btnP, opacity: (!newPlanName.trim() || !selectedProjectId || !isValidDateRange(newPlanStartDate, newPlanEndDate)) ? 0.5 : 1 }} disabled={!newPlanName.trim() || !selectedProjectId || !isValidDateRange(newPlanStartDate, newPlanEndDate)}>Create Test Plan</button>
              </div>
            </Modal>
          )}

          {showManageScopes && managingTestPlan && canManageProjects && (
            <Modal onClose={() => { setShowManageScopes(false); setManagingTestPlan(null); }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Testing Scopes - {managingTestPlan.name}</div>
                <button onClick={() => { setShowManageScopes(false); setManagingTestPlan(null); }} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <input
                  value={newScopeName}
                  onChange={e => setNewScopeName(e.target.value)}
                  style={inp}
                  placeholder="Add a scope name"
                />
                <button
                  onClick={addTestingScope}
                  style={{ ...btnP, opacity: newScopeName.trim() ? 1 : 0.5 }}
                  disabled={!newScopeName.trim()}
                >
                  + Add
                </button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(testScopesByPlanId[managingTestPlan.id] || []).length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 14, padding: "8px 0" }}>No testing scopes yet.</div>
                )}
                {(testScopesByPlanId[managingTestPlan.id] || []).map(scope => (
                  <div key={scope.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ color: "#334155", fontWeight: 700 }}>{scope.name}</span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete testing scope "${scope.name}"?`)) deleteTestingScope(scope.id);
                      }}
                      style={btnD}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </Modal>
          )}

          {showEditProject && canManageProjects && (
            <Modal onClose={() => setShowEditProject(false)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Project</div>
                <button onClick={() => setShowEditProject(false)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={lbl}>Project Name *</label>
                  <input value={editProjectName} onChange={e => setEditProjectName(e.target.value)} style={inp} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Start Date *</label>
                    <input type="date" value={editProjectStartDate} onChange={e => setEditProjectStartDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>End Date *</label>
                    <input type="date" value={editProjectEndDate} onChange={e => setEditProjectEndDate(e.target.value)} style={inp} />
                  </div>
                </div>
                {!isValidDateRange(editProjectStartDate, editProjectEndDate) && (editProjectStartDate || editProjectEndDate) && (
                  <div style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>Project start date must be on or before end date.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                <button onClick={() => setShowEditProject(false)} style={btnS}>Cancel</button>
                <button onClick={updateProjectName} style={{ ...btnP, opacity: (!editProjectName.trim() || !isValidDateRange(editProjectStartDate, editProjectEndDate)) ? 0.5 : 1 }} disabled={!editProjectName.trim() || !isValidDateRange(editProjectStartDate, editProjectEndDate)}>Save Changes</button>
              </div>
            </Modal>
          )}

          {showEditPlan && canManageProjects && (
            <Modal onClose={() => setShowEditPlan(false)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Test Plan</div>
                <button onClick={() => setShowEditPlan(false)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={lbl}>Test Plan Name *</label>
                  <input value={editPlanName} onChange={e => setEditPlanName(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Project Timeline</label>
                  <input value={formatTimeline(selectedProject?.startDate, selectedProject?.endDate)} style={{ ...inp, background: "#f8fafc" }} readOnly />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Start Date *</label>
                    <input
                      type="date"
                      value={editPlanStartDate}
                      onChange={e => setEditPlanStartDate(e.target.value)}
                      min={toInputDate(selectedProject?.startDate)}
                      max={toInputDate(selectedProject?.endDate) || undefined}
                      style={inp}
                    />
                  </div>
                  <div>
                    <label style={lbl}>End Date *</label>
                    <input
                      type="date"
                      value={editPlanEndDate}
                      onChange={e => setEditPlanEndDate(e.target.value)}
                      min={toInputDate(selectedProject?.startDate)}
                      max={toInputDate(selectedProject?.endDate) || undefined}
                      style={inp}
                    />
                  </div>
                </div>
                {!isValidDateRange(editPlanStartDate, editPlanEndDate) && (editPlanStartDate || editPlanEndDate) && (
                  <div style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>Test plan start date must be on or before end date.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                <button onClick={() => setShowEditPlan(false)} style={btnS}>Cancel</button>
                <button onClick={updateTestPlanName} style={{ ...btnP, opacity: (!editPlanName.trim() || !isValidDateRange(editPlanStartDate, editPlanEndDate)) ? 0.5 : 1 }} disabled={!editPlanName.trim() || !isValidDateRange(editPlanStartDate, editPlanEndDate)}>Save Changes</button>
              </div>
            </Modal>
          )}

          {/* ── MODAL: Edit TC ── */}
          {editTC && (
            <Modal onClose={() => setEditTC(null)} onPaste={e => onTestCasePasteUpload(e, editTC.id)}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 22
              }}>
                <div style={{
                  fontSize: 17,
                  fontWeight: 800
                }}>
                  Edit Test Case
                </div>

                <button
                  onClick={() => setEditTC(null)}
                  style={xBtn}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "grid", gap: 14 }}>

                <div>
                  <label style={lbl}>Test Name *</label>

                  <input
                    value={editTC.name}
                    onChange={e =>
                      setEditTC(p => ({
                        ...p,
                        name: e.target.value
                      }))
                    }
                    style={inp}
                  />
                </div>

                <div>
                  <label style={lbl}>Description</label>

                  <textarea
                    value={editTC.description}
                    onChange={e =>
                      setEditTC(p => ({
                        ...p,
                        description: e.target.value
                      }))
                    }
                    style={{
                      ...inp,
                      minHeight: 70,
                      resize: "vertical"
                    }}
                  />
                </div>

                <div>
                  <label style={lbl}>Test Steps</label>

                  <textarea
                    value={editTC.steps}
                    onChange={e =>
                      setEditTC(p => ({
                        ...p,
                        steps: e.target.value
                      }))
                    }
                    style={{
                      ...inp,
                      minHeight: 90,
                      resize: "vertical"
                    }}
                  />
                </div>

                <div>
                  <label style={lbl}>Expected Result</label>

                  <textarea
                    value={editTC.expected}
                    onChange={e =>
                      setEditTC(p => ({
                        ...p,
                        expected: e.target.value
                      }))
                    }
                    style={{ ...inp, minHeight: 70, resize: "vertical" }}
                  />
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12
                }}>

                  <div>
                    <label style={lbl}>Priority</label>

                    <select
                      value={editTC.priority}
                      onChange={e =>
                        setEditTC(p => ({
                          ...p,
                          priority: e.target.value
                        }))
                      }
                      style={inp}
                    >
                      {TEST_CASE_PRIORITIES.map(p =>
                        <option key={p}>{p}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={lbl}>Category</label>

                    <select
                      value={editTC.category}
                      onChange={e =>
                        setEditTC(p => ({
                          ...p,
                          category: e.target.value
                        }))
                      }
                      style={inp}
                    >
                      {categories.map(c =>
                        <option key={c}>{c}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={lbl}>Remarks</label>

                  <input
                    value={editTC.remarks}
                    onChange={e =>
                      setEditTC(p => ({
                        ...p,
                        remarks: e.target.value
                      }))
                    }
                    style={inp}
                  />
                </div>

                <div>
                  <label style={lbl}>Testing Scope</label>
                  <select
                    value={editTC.testScopeId || ""}
                    onChange={e =>
                      setEditTC(p => ({
                        ...p,
                        testScopeId: e.target.value
                      }))
                    }
                    style={inp}
                  >
                    <option value="">No scope</option>
                    {(testScopesByPlanId[editTC.testPlanId] || []).map(scope => (
                      <option key={scope.id} value={scope.id}>{scope.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 2 }}>
                  <label style={lbl}>Attachments</label>
                  <div
                    style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      Paste screenshot with Ctrl+V or attach file(s)
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={e => {
                        uploadTestCaseFiles(editTC.id, e.target.files);
                        e.target.value = "";
                      }}
                      style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {(testCaseAttachments[editTC.id] || []).length === 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments yet.</div>
                    )}

                    {(testCaseAttachments[editTC.id] || []).map(a => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                        <button
                          type="button"
                          onClick={() => openAttachment(a.url, a.fileName)}
                          style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, textDecoration: "none", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                          title="Open attachment"
                        >
                          {a.fileName}
                        </button>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                        <button onClick={() => deleteTestCaseAttachment(editTC.id, a.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    ))}

                    {uploadingTestCaseId === editTC.id && (
                      <div style={{ color: "#64748b", fontSize: 12 }}>Uploading...</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{
                display: "flex",
                gap: 10,
                marginTop: 22,
                justifyContent: "flex-end"
              }}>
                <button
                  onClick={() => setEditTC(null)}
                  style={btnS}
                >
                  Cancel
                </button>

                <button
                  onClick={updateTC}
                  style={btnP}
                >
                  Save Changes
                </button>
              </div>
            </Modal>
          )}

          {/* ── MODAL: EDIT RUN ── */}
          {editRun && (
            <Modal onClose={() => { setEditRun(null); setEditRunTesterSearch(""); }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Test Run</div>
                <button onClick={() => { setEditRun(null); setEditRunTesterSearch(""); }} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={lbl}>Run Name *</label>
                  <input value={editRun.name} onChange={e => setEditRun(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="e.g. UAT 6.1 - SG Regression - Round 1" />
                </div>
                <div>
                  <label style={lbl}>Testers</label>
                  <input
                    value={editRunTesterSearch}
                    onChange={e => setEditRunTesterSearch(e.target.value)}
                    style={inp}
                    placeholder="Search testers..."
                  />
                  <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, marginTop: 6, maxHeight: 180, overflowY: "auto", background: "#fff" }}>
                    {(() => {
                      const allTesters = Array.from(new Set([
                        ...(mentionUsers || []).map(u => ({ id: u.id, displayName: u.displayName })),
                        ...(users || []).map(u => ({ id: u.id, displayName: u.displayName })),
                      ].filter(u => u.displayName).reduce((map, u) => { map.set(u.displayName, u); return map; }, new Map()).values()))
                        .sort((a, b) => a.displayName.localeCompare(b.displayName));
                      const filtered = editRunTesterSearch
                        ? allTesters.filter(u => u.displayName.toLowerCase().includes(editRunTesterSearch.toLowerCase()))
                        : allTesters;
                      if (filtered.length === 0) return (
                        <div style={{ padding: "12px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No testers found</div>
                      );
                      return filtered.map(u => (
                        <button
                          key={u.id || u.displayName}
                          onClick={() => {
                            const selected = editRun.selectedTesters.includes(u.displayName);
                            setEditRun(p => ({
                              ...p,
                              selectedTesters: selected
                                ? p.selectedTesters.filter(t => t !== u.displayName)
                                : [...p.selectedTesters, u.displayName]
                            }));
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: "none",
                            borderBottom: "1px solid #f1f5f9",
                            background: editRun.selectedTesters.includes(u.displayName) ? "#eff6ff" : "#fff",
                            color: "#0f172a",
                            padding: "9px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                          }}
                        >
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${editRun.selectedTesters.includes(u.displayName) ? "#6366f1" : "#e2e8f0"}`, background: editRun.selectedTesters.includes(u.displayName) ? "#6366f1" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {editRun.selectedTesters.includes(u.displayName) && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
                          </div>
                          {u.displayName}
                        </button>
                      ));
                    })()}
                  </div>
                  {editRun.selectedTesters.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {editRun.selectedTesters.map(t => (
                        <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "#eff6ff", border: "1px solid #c7d2fe", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>
                          {t}
                          <button onClick={() => setEditRun(p => ({ ...p, selectedTesters: p.selectedTesters.filter(x => x !== t) }))} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setEditRun(null); setEditRunTesterSearch(""); }} style={btnS}>Cancel</button>
                <button onClick={saveRunEdits} style={{ ...btnP, opacity: !editRun.name ? 0.5 : 1 }} disabled={!editRun.name}>
                  Save Changes
                </button>
              </div>
            </Modal>
          )}

          {/* ── MODAL: NEW RUN ── */}
          {showAddRun && (
            <Modal onClose={() => { setShowAddRun(false); setTesterSearch(""); }} wide>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>New Test Run</div>
                <button onClick={() => { setShowAddRun(false); setTesterSearch(""); }} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
                <div><label style={lbl}>Run Name *</label><input value={newRun.name} onChange={e => setNewRun(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="e.g. UAT 6.1 - SG Regression - Round 1" /></div>
                <div style={{ position: "relative" }}>
                  <label style={lbl}>Testers (Optional)</label>
                  <input
                    value={testerSearch}
                    onChange={e => setTesterSearch(e.target.value)}
                    style={inp}
                    placeholder="Search testers..."
                  />
                  <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, marginTop: 6, maxHeight: 180, overflowY: "auto", background: "#fff" }}>
                    {(() => {
                      const allTesters = Array.from(new Set([
                        ...(mentionUsers || []).map(u => ({ id: u.id, displayName: u.displayName })),
                        ...(users || []).map(u => ({ id: u.id, displayName: u.displayName })),
                      ].filter(u => u.displayName).reduce((map, u) => { map.set(u.displayName, u); return map; }, new Map()).values()))
                        .sort((a, b) => a.displayName.localeCompare(b.displayName));
                      const filtered = testerSearch
                        ? allTesters.filter(u => u.displayName.toLowerCase().includes(testerSearch.toLowerCase()))
                        : allTesters;
                      if (filtered.length === 0) return (
                        <div style={{ padding: "12px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No testers found</div>
                      );
                      return filtered.map(u => (
                        <button
                          key={u.id || u.displayName}
                          onClick={() => {
                            const selected = newRun.selectedTesters.includes(u.displayName);
                            setNewRun(p => ({
                              ...p,
                              selectedTesters: selected
                                ? p.selectedTesters.filter(t => t !== u.displayName)
                                : [...p.selectedTesters, u.displayName]
                            }));
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: "none",
                            borderBottom: "1px solid #f1f5f9",
                            background: newRun.selectedTesters.includes(u.displayName) ? "#eff6ff" : "#fff",
                            color: "#0f172a",
                            padding: "9px 12px",
                            fontSize: 13,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                          }}
                        >
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${newRun.selectedTesters.includes(u.displayName) ? "#6366f1" : "#e2e8f0"}`, background: newRun.selectedTesters.includes(u.displayName) ? "#6366f1" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {newRun.selectedTesters.includes(u.displayName) && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
                          </div>
                          {u.displayName}
                        </button>
                      ));
                    })()}
                  </div>
                  {newRun.selectedTesters.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {newRun.selectedTesters.map(t => (
                        <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "#eff6ff", border: "1px solid #c7d2fe", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>
                          {t}
                          <button onClick={() => setNewRun(p => ({ ...p, selectedTesters: p.selectedTesters.filter(x => x !== t) }))} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ ...lbl, marginBottom: 10 }}>Select Test Cases</div>
              <input
                value={newRun.tcSearch || ""}
                onChange={e => setNewRun(p => ({ ...p, tcSearch: e.target.value }))}
                style={{ ...inp, marginBottom: 8 }}
                placeholder="Search test cases..."
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={(() => {
                      const filtered = testCases.filter(tc => {
                        const q = (newRun.tcSearch || "").toLowerCase();
                        return (
                          tc.tcNumber.toLowerCase().includes(q) ||
                          tc.name.toLowerCase().includes(q)
                        );
                      });
                      return filtered.length > 0 && filtered.every(tc => newRun.selectedTcIds.includes(tc.id));
                    })()}
                    indeterminate={(() => {
                      const filtered = testCases.filter(tc => {
                        const q = (newRun.tcSearch || "").toLowerCase();
                        return (
                          tc.tcNumber.toLowerCase().includes(q) ||
                          tc.name.toLowerCase().includes(q)
                        );
                      });
                      const checkedCount = filtered.filter(tc => newRun.selectedTcIds.includes(tc.id)).length;
                      return checkedCount > 0 && checkedCount < filtered.length;
                    })()}
                    onChange={e => {
                      const filtered = testCases.filter(tc => {
                        const q = (newRun.tcSearch || "").toLowerCase();
                        return (
                          tc.tcNumber.toLowerCase().includes(q) ||
                          tc.name.toLowerCase().includes(q)
                        );
                      });
                      if (e.target.checked) {
                        setNewRun(p => ({
                          ...p,
                          selectedTcIds: Array.from(new Set([...p.selectedTcIds, ...filtered.map(tc => tc.id)])),
                        }));
                      } else {
                        setNewRun(p => ({
                          ...p,
                          selectedTcIds: p.selectedTcIds.filter(id => !filtered.some(tc => tc.id === id)),
                        }));
                      }
                    }}
                    style={{ marginRight: 6 }}
                  />
                  Select All
                </label>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{newRun.selectedTcIds.length} selected</span>
              </div>
              <div style={{ border: "1.5px solid #f1f5f9", borderRadius: 10, overflow: "hidden", maxHeight: 340, overflowY: "auto" }}>
                {testCases
                  .filter(tc => {
                    const q = (newRun.tcSearch || "").toLowerCase();
                    return (
                      tc.tcNumber.toLowerCase().includes(q) ||
                      tc.name.toLowerCase().includes(q)
                    );
                  })
                  .map((tc, i) => {
                    const checked = newRun.selectedTcIds.includes(tc.id);
                    return (
                      <div key={tc.id} onClick={() => setNewRun(p => ({ ...p, selectedTcIds: checked ? p.selectedTcIds.filter(x => x !== tc.id) : [...p.selectedTcIds, tc.id] }))}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: checked ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "#6366f1" : "#e2e8f0"}`, background: checked ? "#6366f1" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                        </div>
                        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#6366f1", background: "#fff", padding: "1px 6px", borderRadius: 4, border: "1px solid #c7d2fe", flexShrink: 0 }}>{tc.tcNumber}</span>
                        <span style={{ fontSize: 15, color: "#1e293b", fontWeight: 500 }}>{tc.name}</span>
                        <span style={{ marginLeft: "auto", flexShrink: 0 }}><PriBadge label={tc.priority} /></span>
                      </div>
                    );
                  })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddRun(false); setTesterSearch(""); }} style={btnS}>Cancel</button>
                <button onClick={addRun} style={{ ...btnP, opacity: (!newRun.name || newRun.selectedTcIds.length === 0) ? 0.5 : 1 }}
                  disabled={!newRun.name || newRun.selectedTcIds.length === 0}>
                  Create Run
                </button>
              </div>
            </Modal>
          )}

          {/* ── MODAL: CREATE DEFECT ── */}
          {showAddDef && (
            <Modal onClose={() => { setShowAddDef(null); setNewDefAttachments([]); }} onPaste={onNewDefectPasteUpload}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Create Defect</div>
                <button onClick={() => { setShowAddDef(null); setNewDefAttachments([]); }} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Market</label>
                    <select
                      value={newDef.market || "SG"}
                      onChange={e => setNewDef(p => ({ ...p, market: e.target.value }))}
                      style={inp}
                    >
                      {["SG", "HK", "MY", "KR", "US", "ID", "TW"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Run</label>
                    <select
                      value={showAddDef.runId || ""}
                      onChange={e => setShowAddDef(p => ({ ...p, runId: e.target.value || null }))}
                      style={inp}
                    >
                      <option value="">Standalone defect</option>
                      {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                    </select>
                  </div>
                  {showAddDef.runId && (
                    <div>
                      <label style={lbl}>Test Case</label>
                      <select
                        value={showAddDef.tcId || ""}
                        onChange={e => setShowAddDef(p => ({ ...p, tcId: e.target.value || null }))}
                        style={inp}
                      >
                        <option value="">No specific test case (run-level defect)</option>
                        {(() => {
                          const run = runs.find(r => String(r.id) === String(showAddDef.runId));
                          const options = (run?.entries || [])
                            .map(en => allTestCaseById[en.testCaseId])
                            .filter(Boolean);
                          return options.map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>);
                        })()}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label style={lbl}>Issue Type</label>
                  <select
                    value={newDef.issueType || "Functional Issue"}
                    onChange={e => setNewDef(p => ({ ...p, issueType: e.target.value }))}
                    style={inp}
                  >
                    {["Functional Issue", "UI Issue", "Performance Issue", "Data Issue", "Other"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label style={lbl}>Description *</label>
                  <textarea
                    value={newDef.description || ""}
                    onChange={e => setNewDef(p => ({ ...p, description: e.target.value }))}
                    style={{ ...inp, minHeight: 80, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Expected Result</label>
                  <textarea
                    value={newDef.expected || ""}
                    onChange={e => setNewDef(p => ({ ...p, expected: e.target.value }))}
                    style={{ ...inp, minHeight: 70, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Actual Result</label>
                  <textarea
                    value={newDef.actual || ""}
                    onChange={e => setNewDef(p => ({ ...p, actual: e.target.value }))}
                    style={{ ...inp, minHeight: 70, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Priority</label>
                    <select
                      value={newDef.priority} onChange={e => setNewDef(p => ({ ...p, priority: e.target.value }))}
                      style={inp}
                    >
                      {Object.keys(PRIORITY_META).map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Raised By</label>
                    <input
                      value={getCurrentUserDisplayName()}
                      style={{ ...inp, background: "#f8fafc" }}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={lbl}>Assigned To</label>
                    <select
                      value={newDef.assignedTo || ""}
                      onChange={e => setNewDef(p => ({ ...p, assignedTo: e.target.value }))}
                      style={inp}
                    >
                      <option value="">Unassigned</option>
                      {assignableUserDisplayNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Target Fix Date</label>
                    <input
                      type="date"
                      value={newDef.targetFix || ""}
                      onChange={e => setNewDef(p => ({ ...p, targetFix: e.target.value }))}
                      style={inp}
                    />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Remarks</label>
                  <textarea
                    value={newDef.remarks || ""}
                    onChange={e => setNewDef(p => ({ ...p, remarks: e.target.value }))}
                    style={{ ...inp, minHeight: 60, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={lbl}>Attachments</label>
                  <div
                    style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      Paste screenshot with Ctrl+V or attach file(s)
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={e => {
                        queueNewDefectFiles(e.target.files);
                        e.target.value = "";
                      }}
                      style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {newDefAttachments.length === 0 && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments selected yet.</div>
                    )}

                    {newDefAttachments.map((f, i) => (
                      <div key={`${f.name}-${f.size}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                        <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>Will upload after defect is created</span>
                        <button onClick={() => removeQueuedNewDefectFile(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddDef(null); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
                <button onClick={submitDefect} style={{ ...btnP, opacity: !newDef.description ? 0.5 : 1 }} disabled={!newDef.description}>Log Defect</button>
              </div>
            </Modal>
          )}
          {showCategorySettings && isAdmin && (
            <Modal onClose={() => { setShowCategorySettings(false); setNewCategoryName(""); }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Configure Categories</div>
                <button onClick={() => { setShowCategorySettings(false); setNewCategoryName(""); }} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
                {[...categories].sort((a, b) => a.localeCompare(b)).map((cat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ flex: 1, fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{cat}</span>
                    <button
                      onClick={() => {
                        const updated = categories.filter(c => c !== cat);
                        setCategories(updated);
                        localStorage.setItem("uat_categories", JSON.stringify(updated));
                      }}
                      style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                      title="Remove category"
                    >✕</button>
                  </div>
                ))}
                {categories.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 12 }}>No categories defined.</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newCategoryName.trim()) {
                      const updated = [...categories, newCategoryName.trim()].sort((a, b) => a.localeCompare(b));
                      setCategories(updated);
                      localStorage.setItem("uat_categories", JSON.stringify(updated));
                      setNewCategoryName("");
                    }
                  }}
                  placeholder="New category name…"
                  style={{ ...inp, flex: 1 }}
                />
                <button
                  onClick={() => {
                    if (!newCategoryName.trim()) return;
                    const updated = [...categories, newCategoryName.trim()].sort((a, b) => a.localeCompare(b));
                    setCategories(updated);
                    localStorage.setItem("uat_categories", JSON.stringify(updated));
                    setNewCategoryName("");
                  }}
                  disabled={!newCategoryName.trim()}
                  style={{ ...btnP, opacity: !newCategoryName.trim() ? 0.5 : 1 }}
                >Add</button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                <button onClick={() => { setShowCategorySettings(false); setNewCategoryName(""); }} style={btnS}>Close</button>
              </div>
            </Modal>
          )}
          {showAddUser && (
            <Modal onClose={() => setShowAddUser(false)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Create User</div>
                <button onClick={() => setShowAddUser(false)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div><label style={lbl}>Username *</label><input type="email" value={newUserName} onChange={e => setNewUserName(e.target.value)} style={inp} placeholder="name@company.com" /></div>
                <div><label style={lbl}>Display Name *</label><input value={newUserDisplayName} onChange={e => setNewUserDisplayName(e.target.value)} style={inp} /></div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                  Initial password will be auto-generated by system and sent in the email draft.
                </div>
                <div><label style={lbl}>Role *</label>
                  <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={inp}>
                    {["Admin", "Test Lead", "Tester", "Developer", "Viewer"].map(role => <option key={role}>{role}</option>)}
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontWeight: 700 }}>
                  <input type="checkbox" checked={newUserActive} onChange={e => setNewUserActive(e.target.checked)} /> Active
                </label>
                {newUserName && !isValidEmail(newUserName) && (
                  <div style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>Username must be a valid email address.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddUser(false)} style={btnS}>Cancel</button>
                <button onClick={createUserAccount} style={{ ...btnP, opacity: (!newUserName.trim() || !newUserDisplayName.trim() || !isValidEmail(newUserName)) ? 0.5 : 1 }} disabled={!newUserName.trim() || !newUserDisplayName.trim() || !isValidEmail(newUserName)}>Create User</button>
              </div>
            </Modal>
          )}
          {editUser && (
            <Modal onClose={() => setEditUser(null)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Edit User</div>
                <button onClick={() => setEditUser(null)} style={xBtn}>✕</button>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                <div><label style={lbl}>Username *</label><input type="email" value={editUser.username || ""} onChange={e => setEditUser(p => ({ ...p, username: e.target.value }))} style={inp} placeholder="name@company.com" /></div>
                <div><label style={lbl}>Display Name *</label><input value={editUser.displayName || ""} onChange={e => setEditUser(p => ({ ...p, displayName: e.target.value }))} style={inp} /></div>
                <div><label style={lbl}>New Password</label><input type="password" value={editUser.password || ""} onChange={e => setEditUser(p => ({ ...p, password: e.target.value }))} style={inp} placeholder="Leave blank to keep current password" /></div>
                <div><label style={lbl}>Role *</label>
                  <select value={editUser.role || "Viewer"} onChange={e => setEditUser(p => ({ ...p, role: e.target.value }))} style={inp}>
                    {["Admin", "Test Lead", "Tester", "Developer", "Viewer"].map(role => <option key={role}>{role}</option>)}
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontWeight: 700 }}>
                  <input type="checkbox" checked={!!editUser.isActive} onChange={e => setEditUser(p => ({ ...p, isActive: e.target.checked }))} /> Active
                </label>
                {editUser.username && !isValidEmail(editUser.username) && (
                  <div style={{ color: "#be123c", fontSize: 12, fontWeight: 700 }}>Username must be a valid email address.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button onClick={() => setEditUser(null)} style={btnS}>Cancel</button>
                <button onClick={saveUserAccount} style={{ ...btnP, opacity: (!(editUser.username || "").trim() || !(editUser.displayName || "").trim() || !isValidEmail(editUser.username || "")) ? 0.5 : 1 }} disabled={!(editUser.username || "").trim() || !(editUser.displayName || "").trim() || !isValidEmail(editUser.username || "")}>Save Changes</button>
              </div>
            </Modal>
          )}
          {runDateFilterPanel && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: "fixed",
                top: runDateFilterPanel.top,
                left: runDateFilterPanel.left,
                zIndex: 2500,
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 10,
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                padding: 10,
                width: 190
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <select
                  value={runDateRule}
                  onChange={e => setRunDateRule(e.target.value)}
                  style={{ ...inp, width: "100%", fontSize: 12, padding: "6px 8px" }}
                >
                  {["Any", "Before", "After", "On"].map(rule => <option key={rule}>{rule}</option>)}
                </select>
                <input
                  type="date"
                  value={runDateValue}
                  onChange={e => setRunDateValue(e.target.value)}
                  style={{ ...inp, width: "100%", fontSize: 12, padding: "6px 8px" }}
                />
              </div>
            </div>
          )}
          {defDateFilterPanel && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: "fixed",
                top: defDateFilterPanel.top,
                left: defDateFilterPanel.left,
                zIndex: 2500,
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 10,
                boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                padding: 10,
                width: 190
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <select
                  value={defDateFilterPanel.type === "open" ? defOpenRule : defCloseRule}
                  onChange={e => {
                    if (defDateFilterPanel.type === "open") setDefOpenRule(e.target.value);
                    else setDefCloseRule(e.target.value);
                  }}
                  style={{ ...inp, width: "100%", fontSize: 12, padding: "6px 8px" }}
                >
                  {["Any", "Before", "After", "On"].map(rule => <option key={rule}>{rule}</option>)}
                </select>
                <input
                  type="date"
                  value={defDateFilterPanel.type === "open" ? defOpenDate : defCloseDate}
                  onChange={e => {
                    if (defDateFilterPanel.type === "open") setDefOpenDate(e.target.value);
                    else setDefCloseDate(e.target.value);
                  }}
                  style={{ ...inp, width: "100%", fontSize: 12, padding: "6px 8px" }}
                />
              </div>
            </div>
          )}
        </div>{/* end content */}
      </div>{/* end body flex */}
      {contextMenu && (
        <div ref={ctxMenuRef} onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: contextMenu.y, left: contextMenu.x,
            background: "#fff", border: "1.5px solid #f1f5f9", borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 2000,
            minWidth: 180, overflow: "hidden",
          }}>
          {/* header */}
          <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid #f8fafc" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {contextMenu.type === "tc" ? "Test Case" : "Defect"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>
              {contextMenu.type === "tc"
                ? contextMenu.item.tcNumber
                : contextMenu.item.defectNumber}
            </div>
          </div>
          {/* actions */}
          <div style={{ padding: "4px 0" }}>
            <button
              onClick={() => contextMenu.type === "tc"
                ? duplicateTC(contextMenu.item)
                : duplicateDefect(contextMenu.item)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "9px 14px", background: "none",
                border: "none", cursor: "pointer", fontSize: 13, color: "#1e293b",
                fontWeight: 500, textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f4ff"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <span style={{ fontSize: 15 }}>⧉</span> Duplicate
            </button>
            {canDelete && <button
              onClick={() => {
                if (contextMenu.type === "tc") {
                  if (window.confirm("Delete this test case?")) deleteTestCases([contextMenu.item.id]);
                } else {
                  if (window.confirm(`Delete ${contextMenu.item.defectNumber}?`)) deleteDefects([contextMenu.item.id]);
                }
                setContextMenu(null);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "9px 14px", background: "none",
                border: "none", cursor: "pointer", fontSize: 13, color: "#be123c",
                fontWeight: 500, textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#fff1f2"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <span style={{ fontSize: 15 }}>🗑</span> Delete
            </button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────── */
function StatChip({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 64 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</span>
    </div>
  );
}

function AddTcToRunRow({ testCases, run, onAdd }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const existing = (run.entries || []).map(e => e.testCaseId);
  const available = testCases.filter(tc => !existing.includes(tc.id));
  const filtered = searchTerm.trim()
    ? available.filter(tc =>
      tc.tcNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tc.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : available;

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(tc) {
    onAdd(tc.id);
    setSearchTerm("");
    setOpen(false);
  }

  if (available.length === 0) return <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>All test cases added to this run.</div>;

  return (
    <div ref={wrapRef} style={{ position: "relative", background: "#f8fafc", border: "1.5px dashed #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>+ Add TC:</span>
        <input
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search and select a test case…"
          style={{ flex: 1, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 7, padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)",
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 200,
          maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map(tc => (
            <div
              key={tc.id}
              onMouseDown={() => handleSelect(tc)}
              style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid #f1f5f9", color: "#0f172a" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f4ff"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <span style={{ fontWeight: 700, color: "#6366f1", marginRight: 6 }}>{tc.tcNumber}</span>
              {tc.name.slice(0, 70)}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && searchTerm.trim() && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)",
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8,
          padding: "10px 14px", fontSize: 12, color: "#94a3b8", zIndex: 200,
        }}>
          No matching test cases.
        </div>
      )}
    </div>
  );
}
