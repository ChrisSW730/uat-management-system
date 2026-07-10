import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { api } from "./api";
import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  Play,
  Bug,
  Settings as SettingsIcon,
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
  X,
  Eye,
  EyeOff
} from "lucide-react";
import {
  EXEC_STATUS,
  DEFECT_ISSUE_TYPES,
  PRIORITY_META,
  TEST_CASE_PRIORITIES,
  DEFECT_STATUS,
  CATEGORIES
} from "./constants";
import {
  readStoredAuth,
  persistAuth,
  clearStoredAuth
} from "./utils/auth";
import {
  getXLSX,
  normalizeExcelHeader,
  formatExportDateTime,
  downloadWorkbook
} from "./utils/excel";
import {
  calculateIdealBurndown,
} from "./utils/burndown";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import DiamondMark from "./components/ui/DiamondMark";
import { PriBadge } from "./components/ui/Badge";
import DetailBlock from "./components/ui/DetailBlock";
import Modal from "./components/ui/Modal";
import Projects from "./components/Projects";
import TestCases from "./components/TestCases";
import TestRuns from "./components/TestRuns";
import Defects from "./components/Defects";
import DefectModals from "./components/DefectModals";
import TestCaseModals from "./components/TestCaseModals";
import UsersTab from "./components/Users";
import "./styles/Projects.css";
import FilterDropdown from "./components/ui/FilterDropdown";
import peekqaLogo from "../public/peekqa-logo.png";
import SettingsTab from "./components/Settings";
import ManageCategoryModal from "./components/settings/ManageCategoryModal";
import ClickUpIntegrationModal from "./components/settings/ClickUpIntegrationModal";
import { DEFAULT_CLICKUP_CONFIG, getClickUpIntegrationConfig, normalizeClickUpConfig, syncDefectToClickUp } from "./services/clickupService";
import "./styles/Settings.css";

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

function getInitialClickUpConfig() {
  return normalizeClickUpConfig(DEFAULT_CLICKUP_CONFIG);
}

const CLICKUP_CONFIG_CACHE_KEY_PREFIX = "peekqa_clickup_config_cache_v1";

function getClickUpConfigCacheKey(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;
  return `${CLICKUP_CONFIG_CACHE_KEY_PREFIX}_${normalizedUserId}`;
}

function readCachedClickUpConfig(userId) {
  try {
    const key = getClickUpConfigCacheKey(userId);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeClickUpConfig(parsed);
  } catch {
    return null;
  }
}

function persistCachedClickUpConfig(userId, config) {
  try {
    const key = getClickUpConfigCacheKey(userId);
    if (!key) return;
    const normalized = normalizeClickUpConfig(config || getInitialClickUpConfig());
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors to avoid blocking app behavior.
  }
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
  const DEF_MARKET_FILTER_ANY = "__ANY_MARKET__";

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
  const [defMarketFilter, setDefMarketFilter] = useState(DEF_MARKET_FILTER_ANY);
  const [defPlanFilter, setDefPlanFilter] = useState("All");
  const [defOpenRule, setDefOpenRule] = useState("Any");
  const [dashProjectId, setDashProjectId] = useState("");
  const [dashPlanId, setDashPlanId] = useState("");
  const [dashRunId, setDashRunId] = useState("");
  const [dashDateStart, setDashDateStart] = useState("");
  const [dashDateEnd, setDashDateEnd] = useState("");
  const [dashDatePreset, setDashDatePreset] = useState("last7");
  const [runProjectId, setRunProjectId] = useState("");
  const [runPlanId, setRunPlanId] = useState("");
  const [execStatusFilter, setExecStatusFilter] = useState("All");
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

  useEffect(() => {
    let isMounted = true;

    if (!authUser?.id) {
      setClickUpConfigHydratedUserId(null);
      setClickUpConfig(getInitialClickUpConfig());
      return () => {
        isMounted = false;
      };
    }

    setClickUpConfigHydratedUserId(null);

    getClickUpIntegrationConfig()
      .then((config) => {
        if (!isMounted) return;
        const cachedConfig = readCachedClickUpConfig(authUser?.id) || {};
        const nextConfig = {
          ...normalizeClickUpConfig(getInitialClickUpConfig()),
          ...cachedConfig,
          ...config,
          token: cachedConfig?.token || "",
          workspace: config?.workspace ?? cachedConfig?.workspace ?? null,
          space: config?.space ?? cachedConfig?.space ?? null,
          list: config?.list ?? cachedConfig?.list ?? null,
          customItem: config?.customItem ?? cachedConfig?.customItem ?? null,
          workspaces: Array.isArray(config?.workspaces) && config.workspaces.length > 0
            ? config.workspaces
            : (cachedConfig?.workspaces || []),
          spaces: Array.isArray(config?.spaces) && config.spaces.length > 0
            ? config.spaces
            : (cachedConfig?.spaces || []),
          lists: Array.isArray(config?.lists) && config.lists.length > 0
            ? config.lists
            : (cachedConfig?.lists || []),
          customItems: Array.isArray(config?.customItems) && config.customItems.length > 0
            ? config.customItems
            : (cachedConfig?.customItems || []),
          availableFields: Array.isArray(config?.availableFields) && config.availableFields.length > 0
            ? config.availableFields
            : (cachedConfig?.availableFields || []),
          availableStatuses: Array.isArray(config?.availableStatuses) && config.availableStatuses.length > 0
            ? config.availableStatuses
            : (cachedConfig?.availableStatuses || []),
          availablePriorities: Array.isArray(config?.availablePriorities) && config.availablePriorities.length > 0
            ? config.availablePriorities
            : (cachedConfig?.availablePriorities || []),
          mappings: {
            ...(cachedConfig?.mappings || {}),
            ...(config?.mappings || {}),
          },
          statusMappings: {
            ...(cachedConfig?.statusMappings || {}),
            ...(config?.statusMappings || {}),
          },
          priorityMappings: {
            ...(cachedConfig?.priorityMappings || {}),
            ...(config?.priorityMappings || {}),
          },
          customFieldValueMappings: {
            ...(cachedConfig?.customFieldValueMappings || {}),
            ...(config?.customFieldValueMappings || {}),
          },
        };
        setClickUpConfig(nextConfig);
        setClickUpConfigHydratedUserId(String(authUser.id));
      })
      .catch(() => {
        if (isMounted) {
          setClickUpConfig(readCachedClickUpConfig(authUser?.id) || getInitialClickUpConfig());
          setClickUpConfigHydratedUserId(String(authUser.id));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authUser?.id]);
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
  const [showClickUpSettings, setShowClickUpSettings] = useState(false);
  const [clickUpConfigHydratedUserId, setClickUpConfigHydratedUserId] = useState(null);
  const [clickUpConfig, setClickUpConfig] = useState(() => readCachedClickUpConfig(authUser?.id) || getInitialClickUpConfig());
  const clickUpEnabled = Boolean(clickUpConfig?.enabled);

  useEffect(() => {
    if (!authUser?.id) return;
    if (String(clickUpConfigHydratedUserId || "") !== String(authUser.id)) return;
    persistCachedClickUpConfig(authUser.id, clickUpConfig);
  }, [clickUpConfig, authUser?.id, clickUpConfigHydratedUserId]);

  const categoryStorageKey = "uat_categories";
  const readStoredCategories = () => {
    try {
      const stored = localStorage.getItem(categoryStorageKey);
      if (stored) return JSON.parse(stored);
    } catch { }
    return [];
  };
  const clearStoredCategories = () => {
    try {
      localStorage.removeItem(categoryStorageKey);
    } catch { }
  };
  const mergeCategories = (base, extra) => Array.from(new Set([...(base || []), ...(extra || [])])).sort((a, b) => a.localeCompare(b));
  const [categories, setCategories] = useState(() => {
    try {
      const stored = localStorage.getItem(categoryStorageKey);
      if (stored) return JSON.parse(stored);
    } catch { }
    return [];
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

  const blankTC = { name: "", description: "", steps: "", expected: "", priority: "Medium", category: categories[0] || "User Authentication", remarks: "", testScopeId: "" };
  const blankRun = { name: "", selectedTcIds: [], selectedTesters: [], testerSearch: "" };
  const defaultDefectTemplate = [
    "Marketing Company: ",
    "WE Date: ",
    "Impacted Area: ",
    "BA / Owner ID: ",
    "Sample Serial Number: ",
  ].join("\n");
  const blankDef = {
    projectId: "",
    market: "All",
    source: "Exploratory Testing",
    severity: "Medium",
    description: "",
    issueType: DEFECT_ISSUE_TYPES[0],
    title: "",
    expected: "",
    actual: "",
    targetFix: "",
    raisedBy: "",
    priority: "Medium",
    assignedTo: "",
    remarks: ""
  };

  const [newTC, setNewTC] = useState(blankTC);
  const [newRun, setNewRun] = useState(blankRun);
  const [newDef, setNewDef] = useState(blankDef);

  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const userPageSize = 10;

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const name = await api.createCategory(newCategoryName.trim());
      setCategories(prev => mergeCategories(prev, [name]));
      clearStoredCategories();
      setNewCategoryName("");
    } catch (err) {
      alert(err?.message || "Failed to create category");
    }
  };

  const deleteCategory = async (name) => {
    const localCategories = readStoredCategories();
    try {
      await api.deleteCategory(name);
    } catch (err) {
      if (localCategories.includes(name)) {
        // Fallback remove local categories while DB sync completes.
        const updatedLocal = localCategories.filter(c => c !== name);
        if (updatedLocal.length > 0) {
          try {
            localStorage.setItem(categoryStorageKey, JSON.stringify(updatedLocal));
          } catch { }
        } else {
          clearStoredCategories();
        }
      } else {
        alert(err?.message || "Failed to delete category");
        return;
      }
    }

    setCategories(prev => prev.filter(c => c !== name));
  };

  useEffect(() => {
    if (!categories.length) return;
    setNewTC(old => {
      if (!old.category || !categories.includes(old.category)) {
        return { ...old, category: categories[0] };
      }
      return old;
    });
  }, [categories]);

  useEffect(() => {
    setUserCurrentPage(1);
  }, [userSearch, userRoleFilter, userActiveFilter]);

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
  const canUpdateDefectPriority = canUpdateDefectStatus;
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
    const subject = "PeekQA: Access Request";
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
    const link = document.createElement("a");
    link.href = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
    link.click();
  }

  async function handleForgotPassword() {
    const subject = "PeekQA: Password Reset Request";
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
    const link = document.createElement("a");
    link.href = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedBody}`;
    link.click();
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

  function formatBrowserDateTime(value) {
    if (!value) return "-";

    const raw = String(value).trim();
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
    const normalized = hasTimezone ? raw : `${raw}Z`;
    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) return "-";

    const datePart = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${datePart} ${timePart}`;
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

    const oneDayMs = 24 * 60 * 60 * 1000;
    const total = Math.max(endMs - startMs + oneDayMs, 1);
    const elapsed = current - startMs + oneDayMs;
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
      api.getCategories().then(async cats => {
        const localCategories = readStoredCategories();
        if (cats && cats.length > 0) {
          if (localCategories.length > 0) {
            const merged = mergeCategories(cats, localCategories);
            const newNames = merged.filter(name => !cats.includes(name));
            await Promise.all(newNames.map(name => api.createCategory(name).catch(() => { })));
            setCategories(merged);
            clearStoredCategories();
          } else {
            setCategories(cats);
          }
        } else if (localCategories.length > 0) {
          setCategories(localCategories);
          if (authUser?.role === "Admin") {
            await Promise.all(localCategories.map(name => api.createCategory(name).catch(() => { })));
            clearStoredCategories();
          }
        } else {
          setCategories([]);
        }
      }).catch(err => console.error("Categories Error:", err)),
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
    if (!authUser) return;

    api.getTestCases(selectedTestPlanId || undefined)
      .then(setTestCases)
      .catch(err => console.error("TC Error:", err));
  }, [selectedTestPlanId, authUser]);

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
      && (defMarketFilter === DEF_MARKET_FILTER_ANY || def.market === defMarketFilter)
      && (defPlanFilter === "All" || String(def.testPlanId) === defPlanFilter)
      && matchesOpenRule
      && matchesCloseRule;
  }), [defects, defSearch, defStatusFilter, defPriFilter, defMarketFilter, defPlanFilter, defOpenRule, defOpenDate, defCloseRule, defCloseDate, DEF_MARKET_FILTER_ANY]);

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
    const assignedTcIds = new Set(filteredEntries.map(e => e.testCaseId));
    const runTcCount = assignedTcIds.size;
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
    // Dashboard trend range: custom date range when provided, otherwise last 7 days.
    const msPerDay = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const parsedStart = dashDateStart ? new Date(dashDateStart + "T12:00:00") : null;
    const parsedEnd = dashDateEnd ? new Date(dashDateEnd + "T12:00:00") : null;
    const hasStart = parsedStart && !Number.isNaN(parsedStart.getTime());
    const hasEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime());

    let rangeStart;
    let rangeEnd;
    if (hasStart && hasEnd) {
      if (parsedStart <= parsedEnd) {
        rangeStart = parsedStart;
        rangeEnd = parsedEnd;
      } else {
        rangeStart = parsedEnd;
        rangeEnd = parsedStart;
      }
    } else if (hasStart) {
      rangeStart = parsedStart;
      rangeEnd = today;
    } else if (hasEnd) {
      rangeEnd = parsedEnd;
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeStart.getDate() - 6);
    } else {
      rangeEnd = today;
      rangeStart = new Date(today);
      rangeStart.setDate(rangeStart.getDate() - 6);
    }

    const rangeDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / msPerDay) + 1);
    const last7 = Array.from({ length: rangeDays }, (_, i) => {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const trendDays = last7.map(dateStr => {
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const dayEntries = scopedRuns.flatMap(run =>
        (run.entries || []).filter(entry => {
          if (!tcIdSet.has(entry.testCaseId)) return false;

          const status = entry.execStatus;
          if (!["Passed", "Failed", "Blocked"].includes(status)) return false;

          const changedDate = (entry.statusChangedAt || "").slice(0, 10);
          const fallbackDate = (run.createdAt || "").slice(0, 10);
          // Prefer the actual status update date. Fallback keeps older records visible.
          const eventDate = changedDate || fallbackDate;
          return eventDate === dateStr;
        })
      );

      return {
        label,
        passed: dayEntries.filter(e => e.execStatus === "Passed").length,
        failed: dayEntries.filter(e => e.execStatus === "Failed").length,
        blocked: dayEntries.filter(e => e.execStatus === "Blocked").length,
      };
    });
    const defectTrendDays = last7.map(dateStr => {
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        label,
        newCount: filteredDefects.filter(d => (d.openDateTime || d.dateRaised || d.createdAt || "").slice(0, 10) === dateStr).length,
        closedCount: filteredDefects.filter(d => d.closeDateTime?.slice(0, 10) === dateStr).length,
      };
    });

    const eventEntries = scopedRuns.flatMap(run =>
      (run.entries || [])
        .filter(entry => tcIdSet.has(entry.testCaseId))
        .map(entry => ({
          testCaseId: entry.testCaseId,
          execStatus: entry.execStatus,
          eventDate: (entry.statusChangedAt || run.createdAt || "").slice(0, 10),
        }))
    );
    const executedStatuses = new Set(["Passed", "Invalid", "Skip", "Deferred"]);
    const eventEntriesByTc = eventEntries.reduce((map, entry) => {
      if (!map[entry.testCaseId]) map[entry.testCaseId] = [];
      map[entry.testCaseId].push(entry);
      return map;
    }, {});

    const burndownTcIds = Array.from(assignedTcIds);
    const tcBurnStart = burndownTcIds.length;
    const timelinePlans = dashPlanId
      ? allDashPlans.filter(p => p.id === Number(dashPlanId))
      : allDashPlans;
    const planStartDates = timelinePlans
      .map(p => p.startDate)
      .filter(Boolean)
      .map(d => new Date(d));
    const planEndDates = timelinePlans
      .map(p => p.endDate)
      .filter(Boolean)
      .map(d => new Date(d));
    const planStart = planStartDates.length > 0 ? new Date(Math.min(...planStartDates.map(d => d.getTime()))) : null;
    const planEnd = planEndDates.length > 0 ? new Date(Math.max(...planEndDates.map(d => d.getTime()))) : null;
    const tcIdealStartDate = planStart && planEnd && planEnd >= planStart ? planStart : rangeStart;
    const tcIdealEndDate = planStart && planEnd && planEnd >= planStart ? planEnd : rangeEnd;
    const tcBurndownDays = tcBurnStart === 0 ? [] : last7.map((dateStr) => {
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const completed = burndownTcIds.filter(tcId => {
        const events = eventEntriesByTc[tcId] || [];
        return events.some(event => event.eventDate && event.eventDate <= dateStr && executedStatuses.has(event.execStatus));
      }).length;
      const remaining = Math.max(0, tcBurnStart - completed);
      const ideal = calculateIdealBurndown(tcBurnStart, tcIdealStartDate, tcIdealEndDate, dateStr + "T12:00:00");
      return { label, remaining, ideal };
    });

    const defectOpenDates = filteredDefects
      .map(def => (def.openDateTime || def.dateRaised || def.createdAt || "").slice(0, 10))
      .filter(Boolean)
      .sort();
    const firstDefectDate = defectOpenDates.length > 0 ? defectOpenDates[0] : null;
    const defectTimelineStart = planStart && planEnd && planEnd >= planStart ? planStart : rangeStart;
    const defectTimelineEnd = planStart && planEnd && planEnd >= planStart ? planEnd : rangeEnd;
    const defectBurndownDays = last7.reduce((acc, dateStr, index) => {
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const scopeAtDate = filteredDefects.filter(def => {
        const opened = (def.openDateTime || def.dateRaised || def.createdAt || "").slice(0, 10);
        return !!opened && opened <= dateStr;
      }).length;
      const remaining = filteredDefects.filter(def => {
        const opened = (def.openDateTime || def.dateRaised || def.createdAt || "").slice(0, 10);
        if (!opened || opened > dateStr) return false;

        const isClosed = ["Closed", "Rejected"].includes(def.status);
        if (!isClosed) return true; // currently open/reopened — count as remaining
        const closed = (def.closeDateTime || "").slice(0, 10);
        if (closed && closed <= dateStr) return false; // was closed by this date
        return true; // closed but after this date
      }).length;
      let ideal;
      if (!firstDefectDate || dateStr < firstDefectDate || scopeAtDate === 0) {
        ideal = 0;
      } else {
        const current = new Date(dateStr + "T12:00:00");
        ideal = calculateIdealBurndown(scopeAtDate, defectTimelineStart, defectTimelineEnd, current);
      }

      if (index > 0) {
        const prev = acc[index - 1];
        const scopeIncrease = Math.max(0, scopeAtDate - prev.scopeAtDate);
        if (scopeIncrease > 0) {
          const minIdealAfterIncrease = prev.ideal + Math.max(0, scopeIncrease - 1);
          ideal = Math.max(ideal, minIdealAfterIncrease);
        }
      }

      acc.push({ label, remaining, ideal, scopeAtDate });
      return acc;
    }, []).map(({ label, remaining, ideal }) => ({ label, remaining, ideal }));

    const activeTcCount = runTcCount > 0 ? runTcCount : filteredTCs.length;
    return {
      allDashPlans, tcCount: activeTcCount, entryCount: filteredEntries.length,
      passedTotal, failedTotal,
      passRate: runTcCount > 0 ? Math.round((new Set(filteredEntries.filter(e => e.execStatus !== "Not Run").map(e => e.testCaseId)).size / runTcCount) * 100) : 0,
      defTotal: filteredDefects.length, openDefs,
      execByStatus, defByStatus, defByPriority, perPlanStats, trendDays, defectTrendDays, tcBurndownDays, defectBurndownDays, availableRuns,
    };
  }, [dashProjectId, dashPlanId, dashRunId, dashDateStart, dashDateEnd, projects, allTestCases, runs, defects]);

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

  const selectedRunProject = useMemo(
    () => projects.find(p => String(p.id) === String(runProjectId)) || null,
    [projects, runProjectId]
  );

  const runProjectPlans = useMemo(
    () => selectedRunProject ? (selectedRunProject.testPlans || []) : projects.flatMap(p => p.testPlans || []),
    [projects, selectedRunProject]
  );

  useEffect(() => {
    if (runPlanId && !runProjectPlans.some(tp => String(tp.id) === String(runPlanId))) {
      setRunPlanId("");
    }
  }, [runPlanId, runProjectPlans]);

  const filteredRunTestCases = useMemo(() => {
    let filtered = allTestCases || [];
    if (runProjectId) {
      const projectPlanIds = new Set((selectedRunProject?.testPlans || []).map(tp => tp.id));
      filtered = filtered.filter(tc => projectPlanIds.has(tc.testPlanId));
    }
    if (runPlanId) {
      filtered = filtered.filter(tc => String(tc.testPlanId) === String(runPlanId));
    }
    return filtered;
  }, [allTestCases, runProjectId, runPlanId, selectedRunProject]);

  const filteredRuns = useMemo(() => {
    const q = runSearch.trim().toLowerCase();
    const relevantTcIds = new Set((runProjectId || runPlanId) ? filteredRunTestCases.map(tc => tc.id) : []);
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

      const matchesProjectPlan = (runProjectId || runPlanId)
        ? (run.entries || []).some(e => relevantTcIds.has(e.testCaseId))
        : true;

      return matchesSearch && matchesDate && matchesProjectPlan;
    });
  }, [sortedRuns, runSearch, runDateRule, runDateValue, runProjectId, runPlanId, filteredRunTestCases]);

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

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredSortedUsers.length / userPageSize)
  );

  const currentUsers = filteredSortedUsers.slice(
    (userCurrentPage - 1) * userPageSize,
    userCurrentPage * userPageSize
  );

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
        map[tp.id] = { testPlanName: tp.name, projectName: p.name, projectId: p.id };
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

  const linkedTestCaseCountByScopeKey = useMemo(() => {
    const map = {};
    (allTestCases || []).forEach(tc => {
      if (tc?.testPlanId == null || tc?.testScopeId == null) return;
      const key = `${String(tc.testPlanId)}:${String(tc.testScopeId)}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [allTestCases]);

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
      const XLSX = await getXLSX();
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

  async function duplicateTestRun(run) {
    try {
      const duped = await api.duplicateTestRun(run.id);

      setRuns(p => [...p, duped]);
      setContextMenu(null);
    } catch (e) {
      alert("Failed to duplicate run: " + e.message);
    }
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
      const idSet = new Set(ids);
      setDefects(p => p.filter(def => !idSet.has(def.id)));
      setSelectedDefectIds([]);
      setViewDef(d => (d && idSet.has(d.id) ? null : d));
      setEditDef(d => (d && idSet.has(d.id) ? null : d));
      // Remove deleted defects from run entry caches so badges disappear immediately
      const pruneEntries = entries =>
        (entries || []).map(e => ({
          ...e,
          defects: (e.defects || []).filter(d => !idSet.has(d.id)),
        }));
      setRuns(p => p.map(r => ({ ...r, entries: pruneEntries(r.entries) })));
      setViewRun(r => r ? { ...r, entries: pruneEntries(r.entries) } : r);
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
      const subject = "PeekQA - Your Account Has Been Created";
      const body = [
        `Dear ${newUserDisplayName.trim()},`,
        "",
        "Welcome to PeekQA! Your account has been created.",
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
      const link = document.createElement("a");
      link.href = mailto;
      link.click();
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
      const authJson = sessionStorage.getItem("uatAuth") || localStorage.getItem("uatAuth");
      if (!authJson) {
        setPasswordChangeError("Unable to update stored login state. Please login again.");
        return;
      }

      const updatedAuth = JSON.parse(authJson);
      if (!updatedAuth?.user) {
        setPasswordChangeError("Unable to update stored login state. Please login again.");
        return;
      }

      updatedAuth.user.mustChangePassword = false;
      if (sessionStorage.getItem("uatAuth")) {
        sessionStorage.setItem("uatAuth", JSON.stringify(updatedAuth));
      } else {
        localStorage.setItem("uatAuth", JSON.stringify(updatedAuth));
      }

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

      const subject = "PeekQA - Your Password Has Been Reset";
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
      const link = document.createElement("a");
      link.href = mailto;
      link.click();
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
      const run = def.testRunId ? runs.find(r => String(r.id) === String(def.testRunId)) : null;
      const tc = def.testCaseId ? allTestCaseById[def.testCaseId] : null;
      const fallbackProjectId = def.testPlanId ? testPlanMetaById[def.testPlanId]?.projectId : null;
      const resolvedProjectId = def.projectId || fallbackProjectId || (selectedProjectId ? Number(selectedProjectId) : null);
      if (!resolvedProjectId) {
        alert("Cannot duplicate defect: project is missing.");
        return;
      }
      const duped = await api.createDefect({
        projectId: resolvedProjectId,
        testRunId: run?.id ?? null,
        testCaseId: tc?.id ?? null,
        testPlanId: def.testPlanId ?? null,
        source: def.source || "Exploratory Testing",
        severity: def.severity || "Medium",
        market: def.market,
        description: def.description + " (Copy)",
        issueType: def.issueType,
        title: def.title,
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
      setRuns(p => p.map(r => r.id === runId ? updatedRun : r));
      setViewRun(prev => (prev && prev.id === runId ? updatedRun : prev));
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
    const inferredTestPlanId = tc?.testPlanId ?? null;
    const inferredProjectId = inferredTestPlanId ? testPlanMetaById[inferredTestPlanId]?.projectId ?? null : null;
    setNewDef({
      ...blankDef,
      source: "Test Execution",
      projectId: inferredProjectId ? String(inferredProjectId) : "",
      raisedBy: getCurrentUserDisplayName()
    });
    setNewDefAttachments([]);
    setShowAddDef({
      runId,
      tcId,
      tcName: tc?.name || tcId,
      projectId: inferredProjectId ? String(inferredProjectId) : "",
      testPlanId: inferredTestPlanId ? String(inferredTestPlanId) : "",
    });
  }

  function createStandaloneDefect() {
    const defaultProjectId = selectedProjectId || (projects[0] ? String(projects[0].id) : "");
    const filteredPlanId = defPlanFilter !== "All" ? String(defPlanFilter) : "";
    const filteredPlanMeta = filteredPlanId ? testPlanMetaById[filteredPlanId] : null;
    const linkedPlanId =
      filteredPlanMeta && String(filteredPlanMeta.projectId) === String(defaultProjectId)
        ? filteredPlanId
        : "";

    setNewDef({
      ...blankDef,
      issueType: DEFECT_ISSUE_TYPES[0],
      market: defMarketFilter !== DEF_MARKET_FILTER_ANY ? defMarketFilter : blankDef.market,
      source: "Exploratory Testing",
      projectId: defaultProjectId,
      raisedBy: getCurrentUserDisplayName(),
    });
    setNewDefAttachments([]);
    setShowAddDef({
      runId: null,
      tcId: null,
      tcName: "No linked test case",
      projectId: defaultProjectId,
      testPlanId: linkedPlanId,
    });
  }

  async function submitDefect() {
    try {
      const { runId, tcId, projectId, testPlanId } = showAddDef;
      if (!projectId) {
        alert("Project is required.");
        return;
      }
      if (!newDef.source?.trim()) {
        alert("Source is required.");
        return;
      }
      if (!newDef.expected?.trim()) {
        alert("Expected Result is required.");
        return;
      }
      if (!newDef.actual?.trim()) {
        alert("Actual Result is required.");
        return;
      }

      const projectIdNumber = Number(projectId);
      const testPlanIdNumber = testPlanId ? Number(testPlanId) : null;
      if (testPlanIdNumber) {
        const planMeta = testPlanMetaById[String(testPlanIdNumber)];
        if (!planMeta || Number(planMeta.projectId) !== projectIdNumber) {
          alert("Selected test plan does not belong to the selected project.");
          return;
        }
      }

      const defect = await api.createDefect({
        projectId: projectIdNumber,
        testRunId: runId,
        testCaseId: tcId,
        testPlanId: testPlanIdNumber,
        source: newDef.source,
        severity: newDef.severity,
        market: newDef.market,
        description: newDef.description,
        issueType: newDef.issueType,
        title: newDef.title,
        expectedResult: newDef.expected,
        actualResult: newDef.actual,
        priority: newDef.priority,
        raisedBy: getCurrentUserDisplayName(),
        assignedTo: newDef.assignedTo,
        targetFixDate: newDef.targetFix || null,
        remarks: newDef.remarks,
      });

      if (newDefAttachments.length > 0) {
        const renamedNew = renameImageFiles(newDefAttachments, defect.id, 1);
        const uploaded = await api.uploadDefectAttachments(defect.id, renamedNew, getCurrentUserName());
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

      const linkedTaskId = updated?.clickUpTaskId || "";
      const shouldSyncClickUpDefect = Boolean(clickUpEnabled);
      if (shouldSyncClickUpDefect) {
        void (async () => {
          try {
            const syncPayload = {
              listId: updated.clickUpListId || null,
              customItemId: updated.clickUpCustomItemId || null,
              parentTaskId: updated.clickUpParentTaskId || null,
            };
            const syncResult = await syncDefectToClickUp(id, syncPayload);

            updateDefectClickUpLinkState(id, {
              clickUpTaskId: syncResult?.taskId || linkedTaskId,
              clickUpTaskUrl: syncResult?.taskUrl || updated?.clickUpTaskUrl || "",
              clickUpListId: updated?.clickUpListId || "",
              clickUpListName: syncResult?.listName || updated?.clickUpListName || "",
              clickUpParentTaskId: updated?.clickUpParentTaskId || "",
              clickUpParentTaskName: updated?.clickUpParentTaskName || "",
              clickUpCustomItemId: updated?.clickUpCustomItemId || "",
              clickUpCustomItemName: updated?.clickUpCustomItemName || "",
              clickUpLinkedAt: new Date().toISOString(),
            });

            if (syncResult?.status && syncResult.status !== updated.status) {
              updateDefectState(id, { status: syncResult.status });
            }
          } catch (syncError) {
            alert("Status saved but ClickUp sync failed: " + syncError.message);
          }
        })();
      }
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

  async function updateDefPriority(id, priority) {
    if (!canUpdateDefectPriority) return;
    try {
      const updated = await api.updateDefectPriority(id, priority);
      setDefects(p => p.map(d => d.id === id ? updated : d));
      setViewDef(d => d?.id === id ? updated : d);
      setEditDef(d => d?.id === id ? updated : d);
    } catch (e) {
      console.error("Failed to update defect priority:", e);
    }
  }

  function updateDefectClickUpLinkState(defectId, linkPatch) {
    const normalizedPatch = {
      clickUpTaskId: linkPatch?.clickUpTaskId || "",
      clickUpTaskUrl: linkPatch?.clickUpTaskUrl || "",
      clickUpListId: linkPatch?.clickUpListId || "",
      clickUpListName: linkPatch?.clickUpListName || "",
      clickUpParentTaskId: linkPatch?.clickUpParentTaskId || "",
      clickUpParentTaskName: linkPatch?.clickUpParentTaskName || "",
      clickUpCustomItemId: linkPatch?.clickUpCustomItemId || "",
      clickUpCustomItemName: linkPatch?.clickUpCustomItemName || "",
      clickUpLinkedAt: linkPatch?.clickUpLinkedAt || null,
    };

    setDefects((current) => current.map((defect) => defect.id === defectId ? { ...defect, ...normalizedPatch } : defect));
    setViewDef((current) => current?.id === defectId ? { ...current, ...normalizedPatch } : current);
    setEditDef((current) => current?.id === defectId ? { ...current, ...normalizedPatch } : current);
    setRuns((current) => current.map((run) => ({
      ...run,
      entries: (run.entries || []).map((entry) => ({
        ...entry,
        defects: (entry.defects || []).map((defect) => defect.id === defectId ? { ...defect, ...normalizedPatch } : defect),
      })),
    })));
    setViewRun((current) => current ? ({
      ...current,
      entries: (current.entries || []).map((entry) => ({
        ...entry,
        defects: (entry.defects || []).map((defect) => defect.id === defectId ? { ...defect, ...normalizedPatch } : defect),
      })),
    }) : current);
  }

  function updateDefectState(defectId, patch) {
    const normalizedPatch = patch || {};
    setDefects((current) => current.map((defect) => defect.id === defectId ? { ...defect, ...normalizedPatch } : defect));
    setViewDef((current) => current?.id === defectId ? { ...current, ...normalizedPatch } : current);
    setEditDef((current) => current?.id === defectId ? { ...current, ...normalizedPatch } : current);
    setRuns((current) => current.map((run) => ({
      ...run,
      entries: (run.entries || []).map((entry) => ({
        ...entry,
        defects: (entry.defects || []).map((defect) => defect.id === defectId ? { ...defect, ...normalizedPatch } : defect),
      })),
    })));
    setViewRun((current) => current ? ({
      ...current,
      entries: (current.entries || []).map((entry) => ({
        ...entry,
        defects: (entry.defects || []).map((defect) => defect.id === defectId ? { ...defect, ...normalizedPatch } : defect),
      })),
    }) : current);
  }

  async function saveDefectEdits() {
    if (!editDef) return;

    const runId = editDef.linkedRunId ? Number(editDef.linkedRunId) : null;
    const tcId = editDef.linkedTestCaseId ? Number(editDef.linkedTestCaseId) : null;
    const oldRunId = editDef.testRunId ? Number(editDef.testRunId) : null;
    const oldTcId = editDef.testCaseId ? Number(editDef.testCaseId) : null;

    if (!editDef.projectId) {
      alert("Project is required.");
      return;
    }

    if (!editDef.source?.trim()) {
      alert("Source is required.");
      return;
    }
    if (!editDef.expectedResult?.trim()) {
      alert("Expected Result is required.");
      return;
    }
    if (!editDef.actualResult?.trim()) {
      alert("Actual Result is required.");
      return;
    }

    try {
      const updated = await api.updateDefect(editDef.id, {
        projectId: Number(editDef.projectId),
        testRunId: runId,
        testCaseId: tcId,
        testPlanId: editDef.testPlanId ?? null,
        source: editDef.source,
        severity: editDef.severity,
        market: editDef.market,
        description: editDef.description,
        issueType: editDef.issueType,
        title: editDef.title,
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

      // Update viewRun if the defect is linked to a test case in it
      if (viewRun) {
        setViewRun(r => ({
          ...r,
          entries: (r.entries || []).map(e => {
            // Remove from old entry if test case link changed
            if (oldTcId && e.testCaseId === oldTcId && (tcId !== oldTcId || runId !== oldRunId)) {
              return {
                ...e,
                defects: (e.defects || []).filter(d => d.id !== updated.id),
              };
            }
            // Add to or update in new entry if test case link changed
            if (runId && r.id === runId && tcId && e.testCaseId === tcId) {
              const hasDefect = (e.defects || []).some(d => d.id === updated.id);
              return {
                ...e,
                defects: hasDefect
                  ? (e.defects || []).map(d => d.id === updated.id ? updated : d)
                  : [...(e.defects || []), updated],
              };
            }
            return e;
          }),
        }));
      }

      // Also update in the global runs list
      setRuns(p => p.map(r => {
        // If run ID didn't change and defect is linked to test case, update entries
        if (runId === oldRunId && runId && tcId) {
          return {
            ...r,
            entries: (r.entries || []).map(e => {
              // Remove from old entry if test case link changed
              if (oldTcId && e.testCaseId === oldTcId && tcId !== oldTcId) {
                return {
                  ...e,
                  defects: (e.defects || []).filter(d => d.id !== updated.id),
                };
              }
              // Update in new entry
              if (e.testCaseId === tcId) {
                return {
                  ...e,
                  defects: (e.defects || []).map(d => d.id === updated.id ? updated : d),
                };
              }
              return e;
            }),
          };
        }
        // If run ID changed, remove from old run and add to new run
        if (r.id === oldRunId && oldTcId && (!runId || r.id !== runId)) {
          return {
            ...r,
            entries: (r.entries || []).map(e =>
              e.testCaseId === oldTcId
                ? { ...e, defects: (e.defects || []).filter(d => d.id !== updated.id) }
                : e
            ),
          };
        }
        if (r.id === runId && runId && tcId) {
          return {
            ...r,
            entries: (r.entries || []).map(e => {
              if (e.testCaseId === tcId) {
                const hasDefect = (e.defects || []).some(d => d.id === updated.id);
                return {
                  ...e,
                  defects: hasDefect
                    ? (e.defects || []).map(d => d.id === updated.id ? updated : d)
                    : [...(e.defects || []), updated],
                };
              }
              return e;
            }),
          };
        }
        return r;
      }));

      if (newDefAttachments.length > 0) {
        try {
          const existingCount = (defectAttachments[updated.id] || []).length;
          const renamedQueued = renameImageFiles(newDefAttachments, updated.id, existingCount + 1);
          const uploaded = await api.uploadDefectAttachments(updated.id, renamedQueued, getCurrentUserName());
          setDefectAttachments(p => ({
            ...p,
            [updated.id]: [...(p[updated.id] || []), ...uploaded],
          }));
        } catch (uploadErr) {
          alert("Defect saved but attachment upload failed: " + uploadErr.message);
        }
        setNewDefAttachments([]);
      }

      const linkedTaskId = updated?.clickUpTaskId || editDef?.clickUpTaskId || "";
      const shouldSyncClickUpDefect = Boolean(clickUpEnabled);
      const syncPayload = {
        listId: updated?.clickUpListId || editDef?.clickUpListId || null,
        customItemId: updated?.clickUpCustomItemId || editDef?.clickUpCustomItemId || null,
        parentTaskId: updated?.clickUpParentTaskId || editDef?.clickUpParentTaskId || null,
      };

      setEditDef(null);

      if (shouldSyncClickUpDefect) {
        void (async () => {
          try {
            const syncResult = await syncDefectToClickUp(updated.id, syncPayload);

            updateDefectClickUpLinkState(updated.id, {
              clickUpTaskId: syncResult?.taskId || linkedTaskId,
              clickUpTaskUrl: syncResult?.taskUrl || updated?.clickUpTaskUrl || editDef?.clickUpTaskUrl || "",
              clickUpListId: updated?.clickUpListId || editDef?.clickUpListId || "",
              clickUpListName: syncResult?.listName || updated?.clickUpListName || editDef?.clickUpListName || "",
              clickUpParentTaskId: updated?.clickUpParentTaskId || editDef?.clickUpParentTaskId || "",
              clickUpParentTaskName: updated?.clickUpParentTaskName || editDef?.clickUpParentTaskName || "",
              clickUpCustomItemId: updated?.clickUpCustomItemId || editDef?.clickUpCustomItemId || "",
              clickUpCustomItemName: updated?.clickUpCustomItemName || editDef?.clickUpCustomItemName || "",
              clickUpLinkedAt: new Date().toISOString(),
            });
          } catch (syncError) {
            alert("Defect saved but ClickUp sync failed: " + syncError.message);
          }
        })();
      }
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

  function renameImageFiles(files, defectId, startIndex) {
    return files.map((f, i) => {
      if (!f.type?.startsWith("image/")) return f;
      const extFromName = f.name?.includes(".") ? f.name.split(".").pop() : null;
      const extFromType = f.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const ext = extFromName || extFromType;
      return new File([f], `image_${defectId}_${startIndex + i}.${ext}`, { type: f.type });
    });
  }

  async function uploadDefectFiles(defectId, files) {
    const selected = Array.from(files || []).filter(f => f && f.size > 0);
    if (selected.length === 0) return;

    try {
      setUploadingDefectId(defectId);
      const existingCount = (defectAttachments[defectId] || []).length;
      const renamed = renameImageFiles(selected, defectId, existingCount + 1);
      const uploaded = await api.uploadDefectAttachments(defectId, renamed, getCurrentUserName());
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
      blocked: entries.filter(e => e.execStatus === "Blocked").length,
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

  async function downloadTestCaseImportTemplate() {
    const XLSX = await getXLSX();
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
          "Test Scope": tc.testScopeId ? testScopeNameById[tc.testScopeId] || "" : "",
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
            "Test Scope": tc.testScopeId ? testScopeNameById[tc.testScopeId] || "" : "",
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
          "Test Scope": tc.testScopeId ? testScopeNameById[tc.testScopeId] || "" : "",
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
          "Test Scope": tc.testScopeId ? testScopeNameById[tc.testScopeId] || "" : "",
          File: attachment.fileName || "",
          Url: attachment.url || "",
          "Size (KB)": Math.max(1, Math.round((attachment.size || 0) / 1024)),
          "Uploaded By": attachment.uploadedBy || "",
          "Uploaded At": formatExportDateTime(attachment.uploadedAt),
        }));
      });

      await downloadWorkbook(`test-cases-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: "Test Cases", rows: summaryRows },
        { name: "Coverage", rows: coverageRows },
        { name: "Attachments", rows: attachmentRows },
      ]);
    } catch (error) {
      alert(`Failed to export test cases: ${error.message}`);
    }
  }

  async function exportRuns() {
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

    await downloadWorkbook(`test-runs-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Runs", rows: summaryRows },
      { name: "Run Entries", rows: entryRows },
      { name: "Comments", rows: commentRows },
    ]);
  }

  function openRunDetails(execStatus) {

    const run = runs.find(r => String(r.id) === String(dashRunId));

    if (!run) {
      alert("Selected Test Run not found.");
      return;
    }

    setExecStatusFilter(execStatus);

    setViewRun(run);

    setActiveTab("runs");
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
        "Defect Title": def.title || "",
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

      await downloadWorkbook(`defects-${new Date().toISOString().slice(0, 10)}.xlsx`, [
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

  const totalLinkedTestCases =
    (testScopesByPlanId[managingTestPlan?.id] || []).reduce(
      (total, scope) =>
        total +
        (linkedTestCaseCountByScopeKey[
          `${String(managingTestPlan?.id)}:${String(scope.id)}`
        ] || 0),
      0
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
            boxShadow: "0 0 40px rgba(99,102,241,.18), 0 10px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",

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
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img
                    src={peekqaLogo}
                    alt="PeekQA"
                    style={{
                      width: 54,
                      height: "auto",
                      objectFit: "contain",
                      flexShrink: 0,
                    }}
                  />

                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#fff",
                        lineHeight: 1.1,
                      }}
                    >
                      PeekQA
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,.65)",
                        fontWeight: 500,
                        marginTop: 2,
                      }}
                    >
                      Test Management
                    </div>
                  </div>
                </div>
                <button onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar"
                  style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8892a4", fontSize: 16, flexShrink: 0 }}>‹</button>
              </>
            )}
          </div>
          {/* Nav groups */}
          <div
            className="sidebar-menu"
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "8px 0",
            }}
          >
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
                    ["settings", <SettingsIcon size={18} />, "Settings"],
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
                      onClick={() => setActiveTab(key)}
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
                {({ dashboard: "Dashboard", testcases: "Test Cases", runs: "Test Runs", defects: "Defect Log", projects: "Projects", users: "Users", settings: "Settings" })[activeTab] || ""}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                {({ dashboard: "Overview of test execution and defects", testcases: "Manage and track all test cases", runs: "Execute and monitor test runs", defects: "Track and manage defects", projects: "Manage your test projects", users: "Manage user accounts and permissions", settings: "Manage system configuration and integrations" })[activeTab] || ""}
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
            <UsersTab
              openAddUser={openAddUser}
              btnP={btnP}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              inp={inp}
              userRoleFilter={userRoleFilter}
              setUserRoleFilter={setUserRoleFilter}
              userActiveFilter={userActiveFilter}
              setUserActiveFilter={setUserActiveFilter}
              setUserSortCol={setUserSortCol}
              setUserSortDir={setUserSortDir}
              btnS={btnS}
              filteredSortedUsers={filteredSortedUsers}
              users={users}
              toggleUserSort={toggleUserSort}
              userSortCol={userSortCol}
              userSortDir={userSortDir}
              getPwCooldownRemaining={getPwCooldownRemaining}
              openEditUser={openEditUser}
              resetUserPassword={resetUserPassword}
              deleteUserAccount={deleteUserAccount}
              xBtn={xBtn}
              toInputDate={toInputDate}
              currentPage={userCurrentPage}
              pageSize={userPageSize}
              currentUsers={currentUsers}
              totalPages={totalUserPages}
              setCurrentPage={setUserCurrentPage}
            />
          )}

          {/* ══════════════════════════════════
          TAB: PROJECTS
      ══════════════════════════════════ */}
          {activeTab === "projects" && (
            <Projects
              projects={projects}
              defects={defects}

              selectedProject={selectedProject}
              selectedProjectPlans={selectedProjectPlans}

              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}

              selectedTestPlanId={selectedTestPlanId}
              setSelectedTestPlanId={setSelectedTestPlanId}

              canManageProjects={canManageProjects}
              canDelete={canDelete}

              btnP={btnP}
              btnS={btnS}
              btnD={btnD}

              setShowAddProject={setShowAddProject}
              setShowAddPlan={setShowAddPlan}

              getTimelineMeta={getTimelineMeta}
              timelineBadgeStyle={timelineBadgeStyle}
              formatTimeline={formatTimeline}
              toInputDate={toInputDate}

              setEditingProjectId={setEditingProjectId}
              setEditProjectName={setEditProjectName}
              setEditProjectStartDate={setEditProjectStartDate}
              setEditProjectEndDate={setEditProjectEndDate}
              setShowEditProject={setShowEditProject}

              setEditingPlanId={setEditingPlanId}
              setEditPlanName={setEditPlanName}
              setEditPlanStartDate={setEditPlanStartDate}
              setEditPlanEndDate={setEditPlanEndDate}
              setShowEditPlan={setShowEditPlan}

              deleteProject={deleteProject}
              deleteTestPlan={deleteTestPlan}

              openManageScopes={openManageScopes}

              setNewTC={setNewTC}
              setActiveTab={setActiveTab}
            />
          )}

          {/* ══════════════════════════════════
          TAB: TEST CASES
      ══════════════════════════════════ */}

          {activeTab === "testcases" && (
            <TestCases
              tcSearch={tcSearch}
              setTcSearch={setTcSearch}

              tcCatFilter={tcCatFilter}
              setTcCatFilter={setTcCatFilter}

              tcPriFilter={tcPriFilter}
              setTcPriFilter={setTcPriFilter}

              tcSortCol={tcSortCol}
              setTcSortCol={setTcSortCol}
              tcSortDir={tcSortDir}
              setTcSortDir={setTcSortDir}

              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              selectedTestPlanId={selectedTestPlanId}
              setSelectedTestPlanId={setSelectedTestPlanId}
              selectedProjectPlans={selectedProjectPlans}
              projects={projects}

              filteredTC={filteredTC}
              selectedTcIds={selectedTcIds}
              setSelectedTcIds={setSelectedTcIds}

              sortedFilteredTC={sortedFilteredTC}

              runs={runs}

              testPlanMetaById={testPlanMetaById}
              testScopeNameById={testScopeNameById}

              setViewTC={setViewTC}
              setEditTC={setEditTC}
              setContextMenu={setContextMenu}
              setNewTC={setNewTC}

              categories={categories}

              canWrite={canWrite}
              canDelete={canDelete}

              btnP={btnP}
              btnS={btnS}
              btnD={btnD}
              xBtn={xBtn}
              inp={inp}

              handleImportTestCases={handleImportTestCases}
              setShowAddTC={setShowAddTC}
              deleteTestCases={deleteTestCases}
              exportTestCases={exportTestCases}
              showImportMenu={showImportMenu}
              setShowImportMenu={setShowImportMenu}
              downloadTestCaseImportTemplate={downloadTestCaseImportTemplate}
              importingTestCases={importingTestCases}

              toInputDate={toInputDate}

            />
          )}

          {/* ══════════════════════════════════
          TAB: TEST RUNS
      ══════════════════════════════════ */}
          {activeTab === "runs" && (
            <TestRuns
              runSearch={runSearch}
              setRunSearch={setRunSearch}
              runDateRule={runDateRule}
              setRunDateRule={setRunDateRule}
              runDateValue={runDateValue}
              setRunDateValue={setRunDateValue}
              runDateFilterPanel={runDateFilterPanel}
              toggleRunDateFilterPanel={toggleRunDateFilterPanel}
              sortedRuns={sortedRuns}
              filteredRuns={filteredRuns}
              selectedRunIds={selectedRunIds}
              setSelectedRunIds={setSelectedRunIds}
              canDelete={canDelete}
              canWrite={canWrite}
              deleteRuns={deleteRuns}
              exportRuns={exportRuns}
              duplicateTestRun={duplicateTestRun}
              setContextMenu={setContextMenu}
              setShowAddRun={setShowAddRun}
              runStats={runStats}
              runStatusPriorityStats={runStatusPriorityStats}
              hoveredRunId={hoveredRunId}
              setHoveredRunId={setHoveredRunId}
              setViewRun={setViewRun}
              setEditRun={setEditRun}
              setEditRunTesterSearch={setEditRunTesterSearch}
              btnS={btnS}
              btnD={btnD}
              btnP={btnP}
              projects={projects}
              runProjectId={runProjectId}
              setRunProjectId={setRunProjectId}
              runPlanId={runPlanId}
              setRunPlanId={setRunPlanId}
              runProjectPlans={runProjectPlans}
              runFilteredTestCases={filteredRunTestCases}
            />
          )}

          {/* ══════════════════════════════════
          TAB: DEFECT LOG
      ══════════════════════════════════ */}
          {activeTab === "defects" && (
            <Defects
              defSearch={defSearch}
              setDefSearch={setDefSearch}
              inp={inp}
              defStatusFilter={defStatusFilter}
              setDefStatusFilter={setDefStatusFilter}
              defPriFilter={defPriFilter}
              setDefPriFilter={setDefPriFilter}
              defMarketFilter={defMarketFilter}
              setDefMarketFilter={setDefMarketFilter}
              defPlanFilter={defPlanFilter}
              setDefPlanFilter={setDefPlanFilter}
              defects={defects}
              projects={projects}
              setDefOpenRule={setDefOpenRule}
              setDefOpenDate={setDefOpenDate}
              setDefCloseRule={setDefCloseRule}
              setDefCloseDate={setDefCloseDate}
              filteredDefects={filteredDefects}
              selectedDefectIds={selectedDefectIds}
              setSelectedDefectIds={setSelectedDefectIds}
              canWrite={canWrite}
              createStandaloneDefect={createStandaloneDefect}
              canDelete={canDelete}
              deleteDefects={deleteDefects}
              btnP={btnP}
              btnD={btnD}
              btnS={btnS}
              exportDefects={exportDefects}
              sortedFilteredDefects={sortedFilteredDefects}
              defSortCol={defSortCol}
              setDefSortCol={setDefSortCol}
              defSortDir={defSortDir}
              setDefSortDir={setDefSortDir}
              toggleDefDateFilterPanel={toggleDefDateFilterPanel}
              defDateFilterPanel={defDateFilterPanel}
              agedDays={agedDays}
              setContextMenu={setContextMenu}
              setViewDef={setViewDef}
              setEditDef={setEditDef}
              runs={runs}
              allTestCases={allTestCases}
              xBtn={xBtn}
              updateDefAssignedTo={updateDefAssignedTo}
              canAssignDefect={canAssignDefect}
              assignableUserDisplayNames={assignableUserDisplayNames}
              updateDefStatus={updateDefStatus}
              canUpdateDefectStatus={canUpdateDefectStatus}
              updateDefPriority={updateDefPriority}
              canUpdateDefectPriority={canUpdateDefectPriority}
            />
          )}

          {/* ══════════════════════════════════
          TAB: DASHBOARD
      ══════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <Dashboard
              dashboardStats={dashboardStats}
              projects={projects}
              dashProjectId={dashProjectId}
              setDashProjectId={setDashProjectId}
              dashPlanId={dashPlanId}
              setDashPlanId={setDashPlanId}
              dashRunId={dashRunId}
              setDashRunId={setDashRunId}
              dashDateStart={dashDateStart}
              setDashDateStart={setDashDateStart}
              dashDateEnd={dashDateEnd}
              setDashDateEnd={setDashDateEnd}
              dashDatePreset={dashDatePreset}
              setDashDatePreset={setDashDatePreset}
              dashboardRef={dashboardRef}
              inp={inp}
              openRunDetails={openRunDetails}
            />
          )}

          {/* ══════════════════════════════════
          TAB: SETTINGS
      ══════════════════════════════════ */}
          {activeTab === "settings" && (
            <SettingsTab
              categories={categories}
              onManageCategories={() => setShowCategorySettings(true)}
              onManageClickUp={() => setShowClickUpSettings(true)}
              clickUpEnabled={clickUpEnabled}
            />
          )}

          {/* ── MODAL: RUN DETAIL ── */}
          {viewRun && (
            <Modal onClose={() => setViewRun(null)} wide>
              {(() => {
                const filteredRunEntries = (viewRun.entries || []).filter(entry => {
                  const normalizedEntryStatus = normalizeExecStatus(entry.execStatus);
                  const normalizedFilter = normalizeExecStatus(execStatusFilter);

                  if (execStatusFilter === "All") return true;

                  if (normalizedFilter === "Passed") return normalizedEntryStatus === "Passed";
                  if (normalizedFilter === "Failed") return normalizedEntryStatus === "Failed";
                  if (normalizedFilter === "Blocked") return normalizedEntryStatus === "Blocked";

                  return normalizedEntryStatus === normalizedFilter;
                });

                const sortedRunEntries = sortRunEntriesByTestCaseId(filteredRunEntries);
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
                          <div onClick={() => setExecStatusFilter("All")} onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            e.currentTarget.style.boxShadow =
                              "0 15px 35px rgba(99,102,241,.25)";
                          }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform =
                                execStatusFilter === "All"
                                  ? "translateY(-3px)"
                                  : "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                execStatusFilter === "All"
                                  ? "0 10px 25px rgba(99,102,241,.18)"
                                  : "none";
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = "scale(.97)";
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            }} style={{
                              cursor: "pointer",
                              transition: "all .2s ease",
                              borderRadius: 12,
                              border:
                                execStatusFilter === "All"
                                  ? "2px solid #7a7ce9"
                                  : "2px solid transparent",
                              background:
                                execStatusFilter === "All"
                                  ? "#DCFCE7"
                                  : "transparent",
                            }}>
                            <StatChip label="Total" value={st.total} color="#6366f1" bg="#eff6ff" />
                          </div>
                          <div onClick={() => setExecStatusFilter("Passed")} onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            e.currentTarget.style.boxShadow =
                              "0 15px 35px rgba(99, 241, 111, 0.25)";
                          }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform =
                                execStatusFilter === "Passed"
                                  ? "translateY(-3px)"
                                  : "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                execStatusFilter === "Passed"
                                  ? "0 10px 25px rgba(99, 241, 111, 0.18)"
                                  : "none";
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = "scale(.97)";
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            }} style={{
                              cursor: "pointer",
                              transition: "all .2s ease",
                              borderRadius: 12,
                              border:
                                execStatusFilter === "Passed"
                                  ? "2px solid #22C55E"
                                  : "2px solid transparent",
                              background:
                                execStatusFilter === "Passed"
                                  ? "#DCFCE7"
                                  : "transparent",
                            }}>
                            <StatChip label="Passed" value={st.pass} color="#15803d" bg="#f0fdf4" />
                          </div>
                          <div onClick={() => setExecStatusFilter("Failed")} onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            e.currentTarget.style.boxShadow =
                              "0 15px 35px rgba(241, 99, 99, 0.25)";
                          }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform =
                                execStatusFilter === "Failed"
                                  ? "translateY(-3px)"
                                  : "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                execStatusFilter === "Failed"
                                  ? "0 10px 25px rgba(241, 99, 99, 0.18)"
                                  : "none";
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = "scale(.97)";
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            }} style={{
                              cursor: "pointer",
                              transition: "all .2s ease",
                              borderRadius: 12,
                              border:
                                execStatusFilter === "Failed"
                                  ? "2px solid #EF4444"
                                  : "2px solid transparent",
                              background:
                                execStatusFilter === "Failed"
                                  ? "#fee2e2"
                                  : "transparent",
                            }}>
                            <StatChip label="Failed" value={st.fail} color="#be123c" bg="#fff1f2" />
                          </div>
                          <div onClick={() => setExecStatusFilter("Blocked")} onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            e.currentTarget.style.boxShadow =
                              "0 15px 35px rgba(241, 196, 99, 0.25)";
                          }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform =
                                execStatusFilter === "Blocked"
                                  ? "translateY(-3px)"
                                  : "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                execStatusFilter === "Blocked"
                                  ? "0 10px 25px rgba(241, 196, 99, 0.18)"
                                  : "none";
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = "scale(.97)";
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            }} style={{
                              cursor: "pointer",
                              transition: "all .2s ease",
                              borderRadius: 12,
                              border:
                                execStatusFilter === "Blocked"
                                  ? "2px solid #f89c5a"
                                  : "2px solid transparent",
                              background:
                                execStatusFilter === "Blocked"
                                  ? "#fde3d0"
                                  : "transparent",
                            }}>
                            <StatChip label="Blocked" value={st.blocked} color="#f97316" bg="#fff2e9" />
                          </div>
                          <div onClick={() => setExecStatusFilter("Not Run")} onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            e.currentTarget.style.boxShadow =
                              "0 15px 35px rgba(109, 166, 252, 0.25)";
                          }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform =
                                execStatusFilter === "Not Run"
                                  ? "translateY(-3px)"
                                  : "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                execStatusFilter === "Not Run"
                                  ? "0 10px 25px rgba(109, 166, 252, 0.18)"
                                  : "none";
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = "scale(.97)";
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = "translateY(-6px) scale(1.04)";
                            }} style={{
                              cursor: "pointer",
                              transition: "all .2s ease",
                              borderRadius: 12,
                              border:
                                execStatusFilter === "Not Run"
                                  ? "2px solid #64748b"
                                  : "2px solid transparent",
                              background:
                                execStatusFilter === "Not Run"
                                  ? "#f8fafc"
                                  : "transparent",
                            }}>
                            <StatChip label="Not Run" value={st.notRun} color="#64748b" bg="#f8fafc" />
                          </div>

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

                    {canWrite && <AddTcToRunRow
                      testCases={allTestCases}
                      runs={runs}
                      run={viewRun}
                      onAdd={tcId => addTcToRun(viewRun.id, tcId)}
                      entryStatusFilter={execStatusFilter}
                      setEntryStatusFilter={setExecStatusFilter}
                    />}

                    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                      {sortedRunEntries.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#cbd5e1" }}>No test cases found with the selected status.</div>}
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
                                <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", lineHeight: 1.3 }}>
                                  <div>Changed: {formatBrowserDateTime(entry.statusChangedAt)}</div>
                                  {entry.statusChangedBy && <div>by {entry.statusChangedBy}</div>}
                                </div>
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

          <TestCaseModals
            viewTC={viewTC}
            setViewTC={setViewTC}
            showAddTC={showAddTC}
            setShowAddTC={setShowAddTC}
            editTC={editTC}
            setEditTC={setEditTC}
            xBtn={xBtn}
            lbl={lbl}
            inp={inp}
            btnP={btnP}
            btnS={btnS}
            testScopeNameById={testScopeNameById}
            testCaseAttachments={testCaseAttachments}
            canWrite={canWrite}
            onTestCasePasteUpload={onTestCasePasteUpload}
            uploadTestCaseFiles={uploadTestCaseFiles}
            openAttachment={openAttachment}
            deleteTestCaseAttachment={deleteTestCaseAttachment}
            uploadingTestCaseId={uploadingTestCaseId}
            newTC={newTC}
            setNewTC={setNewTC}
            categories={categories}
            testScopesByPlanId={testScopesByPlanId}
            selectedTestPlanId={selectedTestPlanId}
            queueNewTestCaseFiles={queueNewTestCaseFiles}
            newTCAttachments={newTCAttachments}
            removeQueuedNewTestCaseFile={removeQueuedNewTestCaseFile}
            addTC={addTC}
            onNewTestCasePasteUpload={onNewTestCasePasteUpload}
            updateTC={updateTC}
          />

          <DefectModals
            viewDef={viewDef}
            setViewDef={setViewDef}
            copyDefectLink={copyDefectLink}
            btnS={btnS}
            xBtn={xBtn}
            lbl={lbl}
            inp={inp}
            projects={projects}
            testPlanMetaById={testPlanMetaById}
            defectAttachments={defectAttachments}
            openAttachment={openAttachment}
            canComment={canComment}
            defectCommentDrafts={defectCommentDrafts}
            setDefectCommentDrafts={setDefectCommentDrafts}
            replyToComment={replyToComment}
            canDelete={canDelete}
            deleteDefectComment={deleteDefectComment}
            registerMentionInputRef={registerMentionInputRef}
            handleMentionInputChange={handleMentionInputChange}
            handleMentionKeyDown={handleMentionKeyDown}
            mentionPicker={mentionPicker}
            addDefectComment={addDefectComment}
            selectMention={selectMention}
            btnP={btnP}
            editDef={editDef}
            setEditDef={setEditDef}
            onDefectPasteUpload={onDefectPasteUpload}
            runs={runs}
            allTestCaseById={allTestCaseById}
            assignableUserDisplayNames={assignableUserDisplayNames}
            deleteDefectAttachment={deleteDefectAttachment}
            queueNewDefectFiles={queueNewDefectFiles}
            newDefAttachments={newDefAttachments}
            removeQueuedNewDefectFile={removeQueuedNewDefectFile}
            saveDefectEdits={saveDefectEdits}
            showAddDef={showAddDef}
            setShowAddDef={setShowAddDef}
            setNewDefAttachments={setNewDefAttachments}
            onNewDefectPasteUpload={onNewDefectPasteUpload}
            newDef={newDef}
            setNewDef={setNewDef}
            getCurrentUserDisplayName={getCurrentUserDisplayName}
            submitDefect={submitDefect}
            clickUpConfig={clickUpConfig}
            clickUpEnabled={clickUpEnabled}
            onClickUpLinkChange={updateDefectClickUpLinkState}
            onDefectUpdate={updateDefectState}
          />

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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: "#0f172a",
                      lineHeight: 1.35,
                      marginBottom: 8,
                    }}
                  >
                    Testing Scopes - {managingTestPlan.name}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 999,
                        background: "#EEF2FF",
                        color: "#4F46E5",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      🟣 {(testScopesByPlanId[managingTestPlan.id] || []).length} Scope
                      {(testScopesByPlanId[managingTestPlan.id] || []).length !== 1 ? "s" : ""}
                    </span>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 999,
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        color: "#475569",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      🔗 {totalLinkedTestCases} Linked Test Case
                      {totalLinkedTestCases !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowManageScopes(false);
                    setManagingTestPlan(null);
                  }}
                  style={xBtn}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input
    value={newScopeName}
    onChange={e => setNewScopeName(e.target.value)}
    onKeyDown={e => {
        if (e.key === "Enter" && newScopeName.trim()) {
            addTestingScope();
        }
    }}
    placeholder="Add a scope name"
    style={{ ...inp, flex: 1 }}
/>
                <button
    onClick={addTestingScope}
    disabled={!newScopeName.trim()}
    style={{
        ...btnP,
        opacity: newScopeName.trim() ? 1 : 0.5,
    }}
>
    Add
</button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(testScopesByPlanId[managingTestPlan.id] || []).length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 14, padding: "8px 0" }}>No testing scopes yet.</div>
                )}
                {(testScopesByPlanId[managingTestPlan.id] || []).map(scope => (
                  <div key={scope.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <span style={{ color: "#334155", fontWeight: 700 }}>{scope.name}</span>
                      <span style={{ color: "#64748b", fontSize: 12 }}>
                        {linkedTestCaseCountByScopeKey[`${String(managingTestPlan.id)}:${String(scope.id)}`] || 0} linked test {(linkedTestCaseCountByScopeKey[`${String(managingTestPlan.id)}:${String(scope.id)}`] || 0) === 1 ? "case" : "cases"}
                      </span>
                    </div>
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
              <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 20,
  }}
>
  <button
    onClick={() => {
      setShowManageScopes(false);
      setManagingTestPlan(null);
    }}
    style={btnS}
  >
    Close
  </button>
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
                      const filtered = filteredRunTestCases.filter(tc => {
                        const q = (newRun.tcSearch || "").toLowerCase();
                        return (
                          tc.tcNumber.toLowerCase().includes(q) ||
                          tc.name.toLowerCase().includes(q)
                        );
                      });
                      return filtered.length > 0 && filtered.every(tc => newRun.selectedTcIds.includes(tc.id));
                    })()}
                    indeterminate={(() => {
                      const filtered = filteredRunTestCases.filter(tc => {
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
                      const filtered = filteredRunTestCases.filter(tc => {
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
                {filteredRunTestCases
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

          {showClickUpSettings && (
            <Modal onClose={() => setShowClickUpSettings(false)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>ClickUp Integration</div>
                <button onClick={() => setShowClickUpSettings(false)} style={xBtn}>✕</button>
              </div>
              <ClickUpIntegrationModal
                config={clickUpConfig}
                onClose={() => setShowClickUpSettings(false)}
                onSave={(nextConfig) => {
                  setClickUpConfig((prev) => ({
                    ...getInitialClickUpConfig(),
                    ...prev,
                    ...nextConfig,
                    token: nextConfig?.token ?? prev?.token ?? "",
                    workspaces: Array.isArray(nextConfig?.workspaces) ? nextConfig.workspaces : (prev?.workspaces || []),
                    spaces: Array.isArray(nextConfig?.spaces) ? nextConfig.spaces : (prev?.spaces || []),
                    lists: Array.isArray(nextConfig?.lists) ? nextConfig.lists : (prev?.lists || []),
                    customItems: Array.isArray(nextConfig?.customItems) ? nextConfig.customItems : (prev?.customItems || []),
                    availableFields: Array.isArray(nextConfig?.availableFields) ? nextConfig.availableFields : (prev?.availableFields || []),
                    availableStatuses: Array.isArray(nextConfig?.availableStatuses) ? nextConfig.availableStatuses : (prev?.availableStatuses || []),
                    availablePriorities: Array.isArray(nextConfig?.availablePriorities) ? nextConfig.availablePriorities : (prev?.availablePriorities || []),
                    enabled: Boolean(nextConfig.enabled),
                  }));
                }}
              />
            </Modal>
          )}

          {showCategorySettings && isAdmin && (
            <ManageCategoryModal
              onClose={() => { setShowCategorySettings(false); setNewCategoryName(""); }}
              categories={categories}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              addCategory={addCategory}
              deleteCategory={deleteCategory}
              inp={inp}
              btnP={btnP}
              btnS={btnS}
              xBtn={xBtn}
            />
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
              {
                contextMenu.type === "tc"
                  ? "Test Case"
                  : contextMenu.type === "defect"
                    ? "Defect"
                    : "Test Run"
              }
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>
              {
                contextMenu.type === "tc"
                  ? contextMenu.item.tcNumber
                  : contextMenu.type === "defect"
                    ? contextMenu.item.defectNumber
                    : contextMenu.item.runNumber
              }
            </div>
          </div>
          {/* actions */}
          <div style={{ padding: "4px 0" }}>
            <button
              onClick={() => {
                if (contextMenu.type === "tc") {
                  duplicateTC(contextMenu.item);
                } else if (contextMenu.type === "defect") {
                  duplicateDefect(contextMenu.item);
                } else if (contextMenu.type === "run") {
                  duplicateTestRun(contextMenu.item);
                }

                setContextMenu(null);
              }}
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

                  if (window.confirm("Delete this test case?")) {
                    deleteTestCases([contextMenu.item.id]);
                  }

                } else if (contextMenu.type === "defect") {

                  if (window.confirm(`Delete ${contextMenu.item.defectNumber}?`)) {
                    deleteDefects([contextMenu.item.id]);
                  }

                } else if (contextMenu.type === "run") {

                  if (window.confirm(`Delete ${contextMenu.item.runNumber}?`)) {
                    deleteRuns([contextMenu.item.id]);
                  }

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
              <Trash2 size={16} /> Delete
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

function normalizeExecStatus(value) {
  if (value === null || value === undefined) return "Not Run";

  const normalized = String(value).trim().toLowerCase();
  const aliases = {
    pass: "Passed",
    passed: "Passed",
    fail: "Failed",
    failed: "Failed",
    blocked: "Blocked",
    deferred: "Deferred",
    skip: "Skip",
    invalid: "Invalid",
    "not run": "Not Run",
    "notrun": "Not Run",
    "n/a": "Not Run",
    "": "Not Run",
  };

  return aliases[normalized] || String(value).trim();
}

function AddTcToRunRow({ testCases, runs, run, onAdd, entryStatusFilter, setEntryStatusFilter }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const existing = (run.entries || []).map(e => e.testCaseId);
  const available = testCases.filter(tc => !existing.includes(tc.id));
  const filtered = available.filter(tc => {
    const matchSearch =
      !searchTerm.trim() ||
      tc.tcNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tc.name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchSearch;
  });

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
        <div
          ref={wrapRef}
          style={{
            flex: 1,
            position: "relative"
          }}
        >
          <input
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search and select a test case..."
            style={{
              width: "100%",
              background: "#fff",
              border: "1.5px solid #e2e8f0",
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 12,
              outline: "none",
              fontFamily: "inherit"
            }}
          />

          {open && filtered.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "calc(100% + 4px)",
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,.1)",
                zIndex: 9999,
                maxHeight: 220,
                overflowY: "auto"
              }}
            >
              {filtered.map(tc => (
                <div
                  key={tc.id}
                  onMouseDown={() => handleSelect(tc)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    borderBottom: "1px solid #f1f5f9"
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#6366f1",
                      marginRight: 6
                    }}
                  >
                    {tc.tcNumber}
                  </span>
                  {tc.name.slice(0, 70)}
                </div>
              ))}
            </div>
          )}

          {open && filtered.length === 0 && searchTerm.trim() && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "calc(100% + 4px)",
                background: "#fff",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
                zIndex: 9999
              }}
            >
              No matching test cases.
            </div>
          )}
        </div>
        <select
          value={entryStatusFilter || "All"}
          onChange={e => setEntryStatusFilter(e.target.value)}
          style={{
            width: 150,
            height: 30,
            padding: "8px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 7,
            color: "#94a3b8",
            fontSize: 12,
            background: "#fff",
            cursor: "pointer"
          }}
        >
          <option value="All">All Status</option>
          <option value="Passed">Passed</option>
          <option value="Failed">Failed</option>
          <option value="Blocked">Blocked</option>
          <option value="Deferred">Deferred</option>
          <option value="Skip">Skip</option>
          <option value="Invalid">Invalid</option>
          <option value="Not Run">Not Run</option>
        </select>
      </div>
    </div>
  );
}
