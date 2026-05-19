import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const EXEC_STATUS = {
  "Not Run":  { bg:"#f8fafc", text:"#64748b", border:"#e2e8f0", dot:"#cbd5e1" },
  Pass:       { bg:"#f0fdf4", text:"#15803d", border:"#bbf7d0", dot:"#22c55e" },
  Fail:       { bg:"#fff1f2", text:"#be123c", border:"#fecdd3", dot:"#f43f5e" },
  Blocked:    { bg:"#fff7ed", text:"#c2410c", border:"#fed7aa", dot:"#f97316" },
  Skip:       { bg:"#faf5ff", text:"#6d28d9", border:"#ddd6fe", dot:"#8b5cf6" },
  Deferred:   { bg:"#fefce8", text:"#a16207", border:"#fde68a", dot:"#eab308" },
};

const PRIORITY_META = {
  Showstopper:{ bg:"#ef4444", text:"#fff", shadow:"#ef444433" },
  High:       { bg:"#f97316", text:"#fff", shadow:"#f9731633" },
  Medium:     { bg:"#f59e0b", text:"#fff", shadow:"#f59e0b33" },
  Low:        { bg:"#22c55e", text:"#fff", shadow:"#22c55e33" },
};

const TEST_CASE_PRIORITIES = ["High", "Medium", "Low"];

const DEFECT_STATUS = {
  New:              { bg:"#eff6ff", text:"#1d4ed8", border:"#bfdbfe", dot:"#3b82f6" },
  "In Progress":    { bg:"#ecfdf5", text:"#065f46", border:"#6ee7b7", dot:"#10b981" },
  Fixed:            { bg:"#f0fdf4", text:"#15803d", border:"#bbf7d0", dot:"#22c55e" },
  Reopened:         { bg:"#fff1f2", text:"#be123c", border:"#fecdd3", dot:"#f43f5e" },
  Rejected:         { bg:"#fefce8", text:"#a16207", border:"#fde68a", dot:"#eab308" },
  "Change Request": { bg:"#faf5ff", text:"#6d28d9", border:"#ddd6fe", dot:"#8b5cf6" },
  Closed:           { bg:"#f8fafc", text:"#64748b", border:"#e2e8f0", dot:"#94a3b8" },
};

const CATEGORIES = [
  "User Authentication","User Management",
  "Payout & Clawback Creation (Charity Live Campaign)",
  "Payout & Clawback Creation (Commercial Live Campaign)",
  "Payout Approval","BMM","PAF","Data Insight",
];

/* ─────────────────────────────────────────
   SMALL UI COMPONENTS
───────────────────────────────────────── */
function Dot({ color }) {
  return <span style={{ width:7, height:7, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }} />;
}

function ExecBadge({ status }) {
  const c = EXEC_STATUS[status] || EXEC_STATUS["Not Run"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:c.bg, color:c.text, border:`1.5px solid ${c.border}`, padding:"3px 10px 3px 7px", borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
      <Dot color={c.dot}/>{status}
    </span>
  );
}

function PriBadge({ label }) {
  const m = PRIORITY_META[label] || { bg:"#e2e8f0", text:"#334155", shadow:"#0000001a" };
  return <span style={{ background:m.bg, color:m.text, padding:"3px 10px", borderRadius:6, fontSize:14, fontWeight:700, textTransform:"uppercase", boxShadow:`0 2px 8px ${m.shadow}`, whiteSpace:"nowrap" }}>{label}</span>;
}

function DefBadge({ status }) {
  const c = DEFECT_STATUS[status] || DEFECT_STATUS["New"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:c.bg, color:c.text, border:`1.5px solid ${c.border}`, padding:"3px 10px 3px 7px", borderRadius:20, fontSize:14, fontWeight:700, textTransform:"uppercase", whiteSpace:"nowrap" }}>
      <Dot color={c.dot}/>{status}
    </span>
  );
}

function Modal({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", backdropFilter:"blur(5px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:20, padding:32, width:"100%", maxWidth:wide?900:700, maxHeight:"93vh", overflowY:"auto", boxShadow:"0 32px 80px rgba(0,0,0,0.18)", border:"1px solid #f1f5f9" }}>
        {children}
      </div>
    </div>
  );
}

function DetailBlock({ label, value, pre, accent, danger }) {
  const bg = accent?"#eff6ff":danger?"#fff1f2":"#f8fafc";
  const bd = accent?"#bfdbfe":danger?"#fecdd3":"#f1f5f9";
  const cl = accent?"#1d4ed8":danger?"#be123c":"#334155";
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:700, color:"#94a3b8", letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
      {pre
        ? <pre style={{ background:"#f8fafc", border:"1.5px solid #f1f5f9", borderRadius:8, padding:"10px 14px", color:"#334155", fontSize:14, whiteSpace:"pre-wrap", margin:0, fontFamily:"ui-monospace,monospace", lineHeight:1.6 }}>{value}</pre>
        : <div style={{ background:bg, border:`1.5px solid ${bd}`, borderRadius:8, padding:"9px 13px", color:cl, fontSize:14, lineHeight:1.5, fontWeight:accent||danger?600:400 }}>{value}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────
   SHARED STYLES
───────────────────────────────────────── */
//const inp  = { background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:8, color:"#0f172a", padding:"9px 13px", width:"100%", fontSize:15, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
const vw = window.innerWidth;
const scale = vw < 1280 ? vw / 1280 : 1;
const inp  = { background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:8, color:"#0f172a", padding:"9px 13px", width:"100%", fontSize:15, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
const lbl  = { color:"#94a3b8", fontSize:14, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", display:"block", marginBottom:5 };
const btnP = { background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:15, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px #6366f144" };
const btnS = { background:"#fff", color:"#64748b", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"9px 20px", fontSize:15, fontWeight:600, cursor:"pointer" };
const btnD = { background:"#fff1f2", color:"#be123c", border:"1.5px solid #fecdd3", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer" };
const xBtn = { background:"#f1f5f9", border:"none", color:"#64748b", width:32, height:32, borderRadius:8, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

/* ─────────────────────────────────────────
   MAIN APP
───────────────────────────────────────── */
export default function App() {
  const [activeTab, setActiveTab]     = useState("testcases");
  const [projects, setProjects]       = useState([]);
  const [testCases, setTestCases]     = useState([]);
  const [allTestCases, setAllTestCases] = useState([]);
  const [runs, setRuns]               = useState([]);
  const [defects, setDefects]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTestPlanId, setSelectedTestPlanId] = useState("");

  // TC filters
  const [tcSearch, setTcSearch]       = useState("");
  const [tcCatFilter, setTcCatFilter] = useState("All");
  const [tcPriFilter, setTcPriFilter] = useState("All");
  const [defSearch, setDefSearch]     = useState("");
  const [defStatusFilter, setDefStatusFilter] = useState("All");
  const [defPriFilter, setDefPriFilter] = useState("All");
  const [defMarketFilter, setDefMarketFilter] = useState("All");
  const [defOpenRule, setDefOpenRule] = useState("Any");
  const [defOpenDate, setDefOpenDate] = useState("");
  const [defCloseRule, setDefCloseRule] = useState("Any");
  const [defCloseDate, setDefCloseDate] = useState("");
  const [defDateFilterPanel, setDefDateFilterPanel] = useState(null);
  const [runSearch, setRunSearch] = useState("");
  const [runDateRule, setRunDateRule] = useState("Any");
  const [runDateValue, setRunDateValue] = useState("");
  const [runDateFilterPanel, setRunDateFilterPanel] = useState(null);
  const [tcSortCol, setTcSortCol] = useState("");
  const [tcSortDir, setTcSortDir] = useState("asc");
  const [defSortCol, setDefSortCol] = useState("");
  const [defSortDir, setDefSortDir] = useState("asc");
  const [selectedTcIds, setSelectedTcIds] = useState([]);
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [selectedDefectIds, setSelectedDefectIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [hoveredRunId, setHoveredRunId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [defectCommentDrafts, setDefectCommentDrafts] = useState({});
  const [defectAttachments, setDefectAttachments] = useState({});
  const [uploadingDefectId, setUploadingDefectId] = useState(null);
  const [newDefAttachments, setNewDefAttachments] = useState([]);
  const [testCaseAttachments, setTestCaseAttachments] = useState({});
  const [uploadingTestCaseId, setUploadingTestCaseId] = useState(null);
  const [newTCAttachments, setNewTCAttachments] = useState([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
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
  const [viewTC,     setViewTC]    = useState(null);
  const [viewRun,    setViewRun]   = useState(null);
  const [viewDef,    setViewDef]   = useState(null);
  const [showAddTC,  setShowAddTC] = useState(false);
  const [showAddRun, setShowAddRun]= useState(false);
  const [showAddDef, setShowAddDef]= useState(null);
  const [editTC, setEditTC] = useState(null);
  const [editDef, setEditDef] = useState(null);

  const blankTC  = { name:"", description:"", steps:"", expected:"", priority:"Medium", category:"User Authentication", remarks:"" };
  const blankRun = { name:"", tester:"", selectedTcIds:[] };
  const defaultDefectTemplate = [
    "Marketing Company: ",
    "WE Date: ",
    "Impacted Area: ",
    "BA / Owner ID: ",
    "Sample Serial Number: ",
  ].join("\n");
  const blankDef = { market:"SG", description:defaultDefectTemplate, issueType:"Functional Issue", expected:"", actual:"", targetFix:"", raisedBy:"", priority:"Medium", assignedTo:"", remarks:"" };

  const [newTC,  setNewTC]  = useState(blankTC);
  const [newRun, setNewRun] = useState(blankRun);
  const [newDef, setNewDef] = useState(blankDef);

  function getCurrentUserName() {
    return localStorage.getItem("uatUserName") || "Chris";
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
      api.getProjects()
        .then(ps => {
          setProjects(ps || []);
          if ((ps || []).length > 0) {
            const p = ps[0];
            setSelectedProjectId(String(p.id));
            const firstPlan = (p.testPlans || [])[0];
            if (firstPlan) setSelectedTestPlanId(String(firstPlan.id));
          }
        })
        .catch(err => console.error("Project Error:", err));

	  api.getTestCases()
    .then(tcs => {
      setTestCases(tcs);
      setAllTestCases(tcs || []);
    })
		.catch(err => console.error("TC Error:", err));

	  api.getTestRuns()
		.then(setRuns)
		.catch(err => console.error("Run Error:", err));

	  api.getDefects()
		.then(setDefects)
		.catch(err => console.error("Defect Error:", err))
		.finally(() => setLoading(false));
	}, []);

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
        && matchesOpenRule
        && matchesCloseRule;
      }), [defects, defSearch, defStatusFilter, defPriFilter, defMarketFilter, defOpenRule, defOpenDate, defCloseRule, defCloseDate]);

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
    });
  }, [runs]);

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

  const sortedFilteredTC = useMemo(
    () => applySort(filteredTC, tcSortCol, tcSortDir),
    [filteredTC, tcSortCol, tcSortDir]
  );

  const sortedFilteredDefects = useMemo(
    () => applySort(filteredDefects, defSortCol, defSortDir),
    [filteredDefects, defSortCol, defSortDir]
  );

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
          const end   = new Date(`${runDateValue}T23:59:59`);
          if (runDateRule === "Before") matchesDate = src < start;
          else if (runDateRule === "After") matchesDate = src > end;
          else if (runDateRule === "On") matchesDate = src >= start && src <= end;
        }
      }
      return matchesSearch && matchesDate;
    });
  }, [sortedRuns, runSearch, runDateRule, runDateValue]);

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

  /* ── CRUD functions ── */
  async function addTC() {
    if (!selectedTestPlanId) {
      alert("Please select a test plan first.");
      return;
    }

    try {
      const tc = await api.createTestCase({
        testPlanId: Number(selectedTestPlanId),
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
    } catch(e) { alert("Failed to add test case: " + e.message); }
  }

  async function updateTC() {
	  try {
		const updated = await api.updateTestCase(editTC.id, {
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
      const run = await api.createTestRun({
        name: newRun.name,
        tester: newRun.tester,
        testCaseIds: newRun.selectedTcIds,
      });
      setRuns(p => [...p, run]);
      setNewRun(blankRun);
      setShowAddRun(false);
    } catch(e) { alert("Failed to create run: " + e.message); }
  }

  async function deleteRuns(ids) {
    try {
      await Promise.all(ids.map(id => api.deleteTestRun(id)));
      setRuns(p => p.filter(r => !ids.includes(r.id)));
      setViewRun(r => (r && ids.includes(r.id) ? null : r));
      setSelectedRunIds([]);
    } catch(e) { alert("Failed to delete run(s): " + e.message); }
  }

  async function deleteTestCases(ids) {
    try {
      await Promise.all(ids.map(id => api.deleteTestCase(id)));
      setTestCases(p => p.filter(tc => !ids.includes(tc.id)));
      setAllTestCases(p => p.filter(tc => !ids.includes(tc.id)));
      setSelectedTcIds([]);
    } catch(e) { alert("Failed to delete: " + e.message); }
  }

  async function deleteDefects(ids) {
    try {
      await Promise.all(ids.map(id => api.deleteDefect(id)));
      setDefects(p => p.filter(def => !ids.includes(def.id)));
      setSelectedDefectIds([]);
      setViewDef(d => (d && ids.includes(d.id) ? null : d));
    } catch(e) { alert("Failed to delete defect(s): " + e.message); }
  }
  
  async function duplicateTC(tc) {
	  try {
		const duped = await api.createTestCase({
      testPlanId: tc.testPlanId || (selectedTestPlanId ? Number(selectedTestPlanId) : null),
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
	  } catch(e) { alert("Failed to duplicate: " + e.message); }
	}

  async function addProject() {
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
    } catch (e) {
      alert("Failed to delete test plan: " + e.message);
    }
  }

	async function duplicateDefect(def) {
	  try {
		const run = runs.find(r => r.runNumber === def.runNumber);
		const tc  = testCases.find(t => t.tcNumber === def.tcNumber);
		if (!run || !tc) { alert("Cannot duplicate: linked run or TC not found."); return; }
		const duped = await api.createDefect({
		  testRunId:      run.id,
		  testCaseId:     tc.id,
		  market:         def.market,
		  description:    def.description + " (Copy)",
		  issueType:      def.issueType,
		  expectedResult: def.expectedResult,
		  actualResult:   def.actualResult,
		  priority:       def.priority,
		  raisedBy:       def.raisedBy,
		  assignedTo:     def.assignedTo,
		  targetFixDate:  def.targetFixDate || null,
		  remarks:        def.remarks,
		});
		setDefects(p => [...p, duped]);
		setContextMenu(null);
	  } catch(e) { alert("Failed to duplicate: " + e.message); }
	}
  
  async function addTcToRun(runId, tcId) {
    try {
      const updatedRun = await api.addEntryToRun(runId, tcId);
      setRuns(p => p.map(r => r.id === runId ? updatedRun : r));
      setViewRun(updatedRun);
    } catch(e) { alert("Failed to add TC: " + e.message); }
  }

  async function removeTcFromRun(runId, tcId) {
    try {
      await api.removeEntryFromRun(runId, tcId);
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r, entries: r.entries.filter(e => e.testCaseId !== tcId)
      }));
      setViewRun(r => ({ ...r, entries: r.entries.filter(e => e.testCaseId !== tcId) }));
    } catch(e) { alert("Failed to remove TC: " + e.message); }
  }

  async function updateExecStatus(runId, tcId, status) {
    try {
      const run = runs.find(r => r.id === runId);
      const entry = run?.entries.find(e => e.testCaseId === tcId);
      if (!entry) return;
      await api.updateEntry(runId, tcId, { execStatus: status, comment: entry.comment });
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r, entries: r.entries.map(e => e.testCaseId !== tcId ? e : { ...e, execStatus: status })
      }));
      setViewRun(r => ({ ...r, entries: r.entries.map(e => e.testCaseId !== tcId ? e : { ...e, execStatus: status }) }));
    } catch(e) { console.error("Failed to update status:", e); }
  }

  async function updateExecComment(runId, tcId, comment) {
    try {
      const run = runs.find(r => r.id === runId);
      const entry = run?.entries.find(e => e.testCaseId === tcId);
      if (!entry) return;
      await api.updateEntry(runId, tcId, { execStatus: entry.execStatus, comment });
      setRuns(p => p.map(r => r.id !== runId ? r : {
        ...r, entries: r.entries.map(e => e.testCaseId !== tcId ? e : { ...e, comment })
      }));
      setViewRun(r => ({ ...r, entries: r.entries.map(e => e.testCaseId !== tcId ? e : { ...e, comment }) }));
    } catch(e) { console.error("Failed to update comment:", e); }
  }

	async function addComment(runId, tcId) {

	  const message = commentDrafts[tcId];

	  if (!message?.trim()) return;

	  const tester = "Chris";

	  const newComment = {
		id: Date.now(),
		tester,
		message,
		createdAt: new Date().toISOString()
	  };

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
						  newComment
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
          ...e,
          comments: [
            ...(e.comments || []),
            newComment
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
	}
	
	function deleteComment(runId, tcId, commentId) {

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
          ...e,
          comments: (e.comments || []).filter(
            c => c.id !== commentId
          )
          }
      )
      }
    : r
    );
	}

  function createDefect(runId, tcId) {
    const tc = allTestCaseById[tcId];
    const run = runs.find(r => r.id === runId);
    setNewDef({ ...blankDef, raisedBy: run?.tester || "" });
    setNewDefAttachments([]);
    setShowAddDef({ runId, tcId, tcName: tc?.name || tcId });
  }

  function createStandaloneDefect() {
    setNewDef({ ...blankDef, issueType: "Functional Issue" });
    setNewDefAttachments([]);
    setShowAddDef({ runId: null, tcId: null, tcName: "No linked test case" });
  }

  async function submitDefect() {
    try {
      const { runId, tcId } = showAddDef;
      const defect = await api.createDefect({
        testRunId: runId,
        testCaseId: tcId,
        market: newDef.market,
        description: newDef.description,
        issueType: newDef.issueType,
        expectedResult: newDef.expected,
        actualResult: newDef.actual,
        priority: newDef.priority,
        raisedBy: newDef.raisedBy,
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
          ...r, entries: r.entries.map(e => e.testCaseId !== tcId ? e
            : { ...e, defects: [...(e.defects || []), defect] })
        }));
        setViewRun(r => r?.id !== runId ? r : ({
          ...r,
          entries: (r.entries || []).map(e => e.testCaseId !== tcId ? e
            : { ...e, defects: [...(e.defects || []), defect] })
        }));
      }
      setNewDef(blankDef);
      setNewDefAttachments([]);
      setShowAddDef(null);
    } catch(e) { alert("Failed to create defect: " + e.message); }
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
    try {
      const updated = await api.updateDefectStatus(id, v, getCurrentUserName());
      setDefects(p => p.map(d => d.id === id ? updated : d));
      setViewDef(d => d?.id === id ? updated : d);
    } catch(e) { console.error("Failed to update defect status:", e); }
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
        market: editDef.market,
        description: editDef.description,
        expectedResult: editDef.expectedResult,
        actualResult: editDef.actualResult,
        priority: editDef.priority,
        raisedBy: editDef.raisedBy,
        assignedTo: editDef.assignedTo,
        dateRaised: editDef.dateRaised,
        targetFixDate: editDef.targetFixDate || null,
        status: editDef.status,
      }, getCurrentUserName());

      setDefects(p => p.map(d => d.id === updated.id ? updated : d));
      setViewDef(updated);
      setEditDef(null);
    } catch (e) {
      alert("Failed to update defect: " + e.message);
    }
  }

  function addDefectComment(defectId) {
    const message = defectCommentDrafts[defectId];
    if (!message?.trim()) return;

    const newComment = {
      id: Date.now(),
      tester: "Chris",
      message,
      createdAt: new Date().toISOString(),
    };

    setDefects(p => p.map(d => d.id !== defectId
      ? d
      : { ...d, comments: [...(d.comments || []), newComment] }
    ));

    setViewDef(d => d?.id !== defectId
      ? d
      : { ...d, comments: [...(d.comments || []), newComment] }
    );

    setDefectCommentDrafts(p => ({
      ...p,
      [defectId]: "",
    }));
  }

  function deleteDefectComment(defectId, commentId) {
    setDefects(p => p.map(d => d.id !== defectId
      ? d
      : { ...d, comments: (d.comments || []).filter(c => c.id !== commentId) }
    ));

    setViewDef(d => d?.id !== defectId
      ? d
      : { ...d, comments: (d.comments || []).filter(c => c.id !== commentId) }
    );
  }

  async function uploadDefectFiles(defectId, files) {
    const selected = Array.from(files || []).filter(f => f && f.size > 0);
    if (selected.length === 0) return;

    try {
      setUploadingDefectId(defectId);
      const uploaded = await api.uploadDefectAttachments(defectId, selected, getCurrentUserName());
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
      total:  entries.length,
      pass:   entries.filter(e => e.execStatus === "Pass").length,
      fail:   entries.filter(e => e.execStatus === "Fail").length,
      notRun: entries.filter(e => e.execStatus === "Not Run").length,
    };
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

  const TABS = [["projects","🗂  Projects"],["testcases","📋  Test Cases"],["runs","▶  Test Runs"],["defects","🐛  Defect Log"]];

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontSize:16, color:"#64748b", fontFamily:"Inter,sans-serif" }}>
      Loading…
    </div>
  );

  return (
    //<div style={{ minHeight:"100vh", background:"#fff", fontFamily:"'Inter','Segoe UI',sans-serif", color:"#0f172a" }}>
	<div style={{ minHeight:"100vh", background:"#fff", fontFamily:"'Inter','Segoe UI',sans-serif", color:"#0f172a", width:"100%", overflowX:"hidden" }}>
	
      {/* ── Header ── */}
      <div style={{ background:"#fff", borderBottom:"1px solid #f1f5f9", padding:"0 52px", display:"flex", alignItems:"center", justifyContent:"space-between", height:180, boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:58, height:58, background:"linear-gradient(135deg,#6366f1,#4f46e5)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:40, boxShadow:"0 4px 12px #6366f155" }}>◈</div>
          <div>
            <div style={{ fontSize:35, fontWeight:700, color:"#0f172a" }}>Test Management System</div>
            <div style={{ padding:"0 1px", fontSize:18, color:"#94a3b8", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>User Acceptance Testing & Defect Tracking</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ padding:"0 52px", background:"#fff", display:"flex", gap:0, borderBottom:"2px solid #f1f5f9" }}>
        {TABS.map(([key,label])=>(
          <button key={key} onClick={()=>setActiveTab(key)}
            style={{ background:"none", border:"none", borderBottom:activeTab===key?"2px solid #6366f1":"2px solid transparent", color:activeTab===key?"#6366f1":"#94a3b8", padding:"14px 20px", fontSize:20, fontWeight:700, cursor:"pointer", marginBottom:-2, transition:"all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          TAB: PROJECTS
      ══════════════════════════════════ */}
      {activeTab==="projects" && (
        <div style={{ padding:"20px 2.5%" }}>
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            <button onClick={()=>setShowAddProject(true)} style={btnP}>+ Add Project</button>
            <button onClick={()=>setShowAddPlan(true)} style={{ ...btnS, opacity:!selectedProjectId?0.5:1 }} disabled={!selectedProjectId}>+ Add Test Plan</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"420px 1fr", gap:16 }}>
            <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #f1f5f9", overflow:"hidden" }}>
              <div style={{ padding:"12px 14px", borderBottom:"1px solid #f1f5f9", fontWeight:800, color:"#334155" }}>Projects</div>
              {(projects || []).length === 0 && <div style={{ padding:18, color:"#94a3b8" }}>No projects yet.</div>}
              {(projects || []).map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, borderBottom:"1px solid #f8fafc", padding:"8px 10px", background:String(selectedProjectId)===String(p.id)?"#eff6ff":"#fff" }}>
                  <button onClick={()=>{ setSelectedProjectId(String(p.id)); setSelectedTestPlanId(""); }}
                    style={{ flex:1, textAlign:"left", border:"none", background:"transparent", padding:"6px 4px", cursor:"pointer", fontWeight:700, color:String(selectedProjectId)===String(p.id)?"#1d4ed8":"#334155" }}>
                    <div>{p.name}</div>
                    {(() => {
                      const tm = getTimelineMeta(p.startDate, p.endDate);
                      const badge = timelineBadgeStyle(tm.status);
                      return (
                        <div style={{ marginTop:4 }}>
                          <div>
                            <span style={{
                              display:"inline-flex",
                              alignItems:"center",
                              gap:5,
                              padding:"3px 10px",
                              borderRadius:999,
                              fontSize:12,
                              fontWeight:800,
                              letterSpacing:"0.01em",
                              whiteSpace:"nowrap",
                              background:badge.bg,
                              color:badge.text,
                              border:`1px solid ${badge.border}`
                            }}>
                              📅 {formatTimeline(p.startDate, p.endDate)}
                            </span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                            <div style={{ flex:1, height:8, borderRadius:99, background:"#e2e8f0", overflow:"hidden" }}>
                              <div style={{ width:`${tm.progress}%`, height:"100%", background:tm.color, borderRadius:99, transition:"width 0.25s ease" }} />
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:tm.color, minWidth:70, textAlign:"right" }}>{tm.status} {tm.progress}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProjectId(p.id);
                      setEditProjectName(p.name || "");
                      setEditProjectStartDate(toInputDate(p.startDate));
                      setEditProjectEndDate(toInputDate(p.endDate));
                      setShowEditProject(true);
                    }}
                    style={{ ...btnS, padding:"4px 10px", fontSize:12 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete project "${p.name}" and all its test plans?`)) {
                        deleteProject(p.id);
                      }
                    }}
                    style={{ ...btnD, padding:"4px 10px", fontSize:12 }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #f1f5f9", overflow:"hidden" }}>
              <div style={{ padding:"12px 14px", borderBottom:"1px solid #f1f5f9", fontWeight:800, color:"#334155" }}>Test Plans {selectedProject ? `- ${selectedProject.name}` : ""}</div>
              {!selectedProject && <div style={{ padding:18, color:"#94a3b8" }}>Select a project to view plans.</div>}
              {selectedProject && selectedProjectPlans.length === 0 && <div style={{ padding:18, color:"#94a3b8" }}>No test plans yet.</div>}
              {selectedProjectPlans.map(tp => (
                <div key={tp.id} style={{ display:"flex", alignItems:"center", gap:8, borderBottom:"1px solid #f8fafc", padding:"8px 10px", background:String(selectedTestPlanId)===String(tp.id)?"#eff6ff":"#fff" }}>
                  <button onClick={()=>{ setSelectedTestPlanId(String(tp.id)); setActiveTab("testcases"); }}
                    style={{ flex:1, textAlign:"left", border:"none", background:"transparent", padding:"6px 4px", cursor:"pointer", fontWeight:700, color:String(selectedTestPlanId)===String(tp.id)?"#1d4ed8":"#334155" }}>
                    <div>{tp.name}</div>
                    {(() => {
                      const tm = getTimelineMeta(tp.startDate, tp.endDate);
                      const badge = timelineBadgeStyle(tm.status);
                      return (
                        <div style={{ marginTop:4 }}>
                          <div>
                            <span style={{
                              display:"inline-flex",
                              alignItems:"center",
                              gap:5,
                              padding:"3px 10px",
                              borderRadius:999,
                              fontSize:12,
                              fontWeight:800,
                              letterSpacing:"0.01em",
                              whiteSpace:"nowrap",
                              background:badge.bg,
                              color:badge.text,
                              border:`1px solid ${badge.border}`
                            }}>
                              📅 {formatTimeline(tp.startDate, tp.endDate)}
                            </span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                            <div style={{ flex:1, height:8, borderRadius:99, background:"#e2e8f0", overflow:"hidden" }}>
                              <div style={{ width:`${tm.progress}%`, height:"100%", background:tm.color, borderRadius:99, transition:"width 0.25s ease" }} />
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:tm.color, minWidth:70, textAlign:"right" }}>{tm.status} {tm.progress}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPlanId(tp.id);
                      setEditPlanName(tp.name || "");
                      setEditPlanStartDate(toInputDate(tp.startDate));
                      setEditPlanEndDate(toInputDate(tp.endDate));
                      setShowEditPlan(true);
                    }}
                    style={{ ...btnS, padding:"4px 10px", fontSize:12 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete test plan "${tp.name}"?`)) {
                        deleteTestPlan(tp.id);
                      }
                    }}
                    style={{ ...btnD, padding:"4px 10px", fontSize:12 }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          TAB: TEST CASES
      ══════════════════════════════════ */}
      
	  {activeTab==="testcases" && (
		  <div style={{ padding:"20px 2.5%" }}>
			{/* toolbar */}
			<div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
			  <div style={{ position:"relative" }}>
				<span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", fontSize:14 }}>🔍</span>
				<input placeholder="Search ID or name…" value={tcSearch} onChange={e=>setTcSearch(e.target.value)} style={{ ...inp, paddingLeft:32, width:230 }}/>
			  </div>
			  <select value={tcCatFilter} onChange={e=>setTcCatFilter(e.target.value)} style={{ ...inp, width:220 }}>
				<option value="All">All Categories</option>
				{CATEGORIES.map(c=><option key={c}>{c}</option>)}
			  </select>
			  <select value={tcPriFilter} onChange={e=>setTcPriFilter(e.target.value)} style={{ ...inp, width:150 }}>
				<option value="All">All Priorities</option>
        {TEST_CASE_PRIORITIES.map(p=><option key={p}>{p}</option>)}
			  </select>
        <select
          value={selectedProjectId}
          onChange={e => {
            const pid = e.target.value;
            setSelectedProjectId(pid);
            const p = projects.find(x => String(x.id) === String(pid));
            const fp = (p?.testPlans || [])[0];
            setSelectedTestPlanId(fp ? String(fp.id) : "");
          }}
          style={{ ...inp, width:190 }}
        >
          <option value="">Select Project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={selectedTestPlanId}
          onChange={e => setSelectedTestPlanId(e.target.value)}
          style={{ ...inp, width:210 }}
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
        style={{ ...btnS, padding:"9px 14px", fontSize:14 }}
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
          style={{ ...btnS, padding:"9px 14px", fontSize:14 }}
        >
          {selectedTcIds.length === filteredTC.length ? "Clear Selection" : "Select All"}
        </button>
        )}
			  <div style={{ flex:1 }}/>
			  {selectedTcIds.length > 0 && (
				<div style={{ display:"flex", alignItems:"center", gap:10 }}>
				  <span style={{ fontSize:14, color:"#64748b", fontWeight:700 }}>{selectedTcIds.length} selected</span>
				  <button onClick={()=>{ if(window.confirm(`Delete ${selectedTcIds.length} test case(s)?`)) deleteTestCases(selectedTcIds); }}
					style={{ background:"#fff1f2", color:"#be123c", border:"1.5px solid #fecdd3", borderRadius:8, padding:"8px 16px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
					🗑 Delete Selected
				  </button>
				</div>
			  )}
        <button onClick={exportTestCases} style={{ ...btnS, padding:"9px 14px", fontSize:14 }} disabled={sortedFilteredTC.length===0}>Export Excel</button>
			  <button onClick={()=>setShowAddTC(true)} style={btnP}>+ Add Test Case</button>
			</div>

			<div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #f1f5f9", boxShadow:"0 2px 12px rgba(0,0,0,0.05)", overflow:"hidden" }}>
			  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
				<thead>
				  <tr style={{ background:"#e2ebf3", borderBottom:"2px solid #f1f5f9" }}>
					<th style={{ padding:"12px 16px", width:40 }}>
					  <input type="checkbox"
						checked={selectedTcIds.length === filteredTC.length && filteredTC.length > 0}
						onChange={e => setSelectedTcIds(e.target.checked ? filteredTC.map(tc=>tc.id) : [])}
						style={{ width:15, height:15, cursor:"pointer", accentColor:"#6366f1" }}
					  />
					</th>
          {[{label:"Actions",col:""},{label:"ID",col:"tcNumber"},{label:"Project",col:""},{label:"Test Plan",col:""},{label:"Test Name",col:"name"},{label:"Category",col:"category"},{label:"Coverage",col:""},{label:"Priority",col:"priority"}].map(({label,col})=>(
                                          <th key={label} onClick={col ? ()=>{ if(tcSortCol===col) setTcSortDir(d=>d==="asc"?"desc":"asc"); else { setTcSortCol(col); setTcSortDir("asc"); } } : undefined}
                                            style={{ padding:"12px 16px", textAlign:"left", color:"#1f252e", fontSize:14, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", whiteSpace:"nowrap", cursor:col?"pointer":"default", userSelect:"none", background: col&&tcSortCol===col ? "#d4dff0" : undefined }}>
                                            {label}{col && tcSortCol===col ? (tcSortDir==="asc" ? " ▲" : " ▼") : col ? " ⇅" : ""}
                                          </th>
                                        ))}
				  </tr>
				</thead>
				<tbody>
          {sortedFilteredTC.length===0 && <tr><td colSpan={9} style={{ padding:48, textAlign:"center", color:"#cbd5e1" }}>No test cases found</td></tr>}
				  {sortedFilteredTC.map((tc,i)=>{
					const isSelected = selectedTcIds.includes(tc.id);
          const planMeta = tc.testPlanId ? testPlanMetaById[tc.testPlanId] : null;
					const coveredRuns = runs.filter(run =>
					  (run.entries || []).some(
						e => e.testCaseId === tc.id
					  )
					);
					return (
					  <tr key={tc.id} 
					  onContextMenu={e=>{ e.preventDefault(); setContextMenu({ type:"tc", item:tc, x:e.clientX, y:e.clientY }); }}
					  style={{ borderBottom:"1px solid #f8fafc", background:isSelected?"#eff6ff":i%2===0?"#fff":"#fafafa", cursor:"pointer" }}
						onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="#f0f4ff"; }}
						onMouseLeave={e=>{ e.currentTarget.style.background=isSelected?"#eff6ff":i%2===0?"#fff":"#fafafa"; }}>
						<td style={{ padding:"13px 16px" }} onClick={e=>e.stopPropagation()}>
						  <input type="checkbox"
							checked={isSelected}
							onChange={e => setSelectedTcIds(p => e.target.checked ? [...p, tc.id] : p.filter(x=>x!==tc.id))}
							style={{ width:15, height:15, cursor:"pointer", accentColor:"#6366f1" }}
						  />
						</td>
						<td style={{ padding:"13px 16px", width:180, minWidth:180 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", whiteSpace:"nowrap" }}>
                <button onClick={()=>setViewTC(tc)} style={{ ...btnS, padding:"5px 12px", fontSize:14 }}>View</button>
                <button
                onClick={() => setEditTC({
                  ...tc,
                  expected: tc.expectedResult
                })}
                style={{ ...btnP, padding:"5px 12px", fontSize:14 }}
                >
                Edit
                </button>
                <button
                onClick={() => {
                  if (window.confirm(`Delete ${tc.tcNumber}?`)) deleteTestCases([tc.id]);
                }}
                style={xBtn}
                title="Delete"
                >
                ✕
                </button>
              </div>
						</td>
						<td style={{ padding:"13px 16px" }} onClick={()=>setViewTC(tc)}>
						  <span style={{ fontWeight:800, color:"#6366f1", fontSize:14, fontFamily:"monospace", background:"#eff6ff", padding:"2px 7px", borderRadius:5 }}>{tc.tcNumber}</span>
						</td>
            <td style={{ padding:"13px 16px" }} onClick={()=>setViewTC(tc)}>
              <span style={{ fontSize:13, color:"#475569", fontWeight:700 }}>{planMeta?.projectName || "-"}</span>
            </td>
            <td style={{ padding:"13px 16px" }} onClick={()=>setViewTC(tc)}>
              <span style={{ fontSize:13, color:"#475569", fontWeight:700 }}>{planMeta?.testPlanName || "-"}</span>
            </td>
            <td style={{ padding:"13px 16px", maxWidth:340 }} onClick={()=>setViewTC(tc)}>
              <div style={{ fontWeight:700, color:"#1e293b", lineHeight:1.4 }}>{tc.name}</div>
            </td>
						<td style={{ padding:"13px 16px" }} onClick={()=>setViewTC(tc)}>
						  <span style={{ fontSize:14, color:"#64748b", background:"#f1f5f9", padding:"2px 8px", borderRadius:6, fontWeight:700 }}>{tc.category.split("(")[0].trim().slice(0,20)}</span>
						</td>
						<td
						  style={{ padding:"13px 16px" }}
						  onClick={()=>setViewTC(tc)}
						>
						  {coveredRuns.length > 0 ? (
							<span
							  style={{
								background:"#f0fdf4",
								color:"#15803d",
								padding:"4px 10px",
								borderRadius:20,
								fontSize:12,
								fontWeight:700
							  }}
							>
							  {coveredRuns.length} Run{coveredRuns.length > 1 ? "s" : ""}
							</span>
						  ) : (
							<span
							  style={{
								background:"#fff1f2",
								color:"#be123c",
								padding:"4px 10px",
								borderRadius:20,
								fontSize:12,
								fontWeight:700
							  }}
							>
							  Not Covered
							</span>
						  )}
						</td>
						<td style={{ padding:"13px 16px" }} onClick={()=>setViewTC(tc)}><PriBadge label={tc.priority}/></td>
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
      {activeTab==="runs" && (
        <div style={{ padding:"20px 2.5%" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <input
              value={runSearch}
              onChange={e => setRunSearch(e.target.value)}
              placeholder="Search runs…"
              style={{ flex:1, minWidth:180, background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:14, color:"#0f172a", outline:"none" }}
            />
            <div style={{ display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", position:"relative" }}>
              <span style={{ fontSize:13, fontWeight:700, color:"#64748b", letterSpacing:"0.05em", textTransform:"uppercase" }}>Date</span>
              <button
                onClick={toggleRunDateFilterPanel}
                title="Filter by date"
                style={{ border:"1px solid #cbd5e1", background: runDateFilterPanel || runDateRule !== "Any" ? "#eff6ff" : "#fff", color: runDateFilterPanel || runDateRule !== "Any" ? "#1d4ed8" : "#64748b", borderRadius:6, width:26, height:26, fontSize:13, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0 }}
              >⌕</button>
              {runDateRule !== "Any" && runDateValue && (
                <button onClick={() => { setRunDateRule("Any"); setRunDateValue(""); }}
                  style={{ border:"1px solid #fca5a5", background:"#fff1f2", color:"#dc2626", borderRadius:6, width:22, height:22, fontSize:11, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0, fontWeight:700 }}>✕</button>
              )}
            </div>
            <div style={{ flex:"0 0 auto", display:"flex", gap:10, alignItems:"center" }}>
            {sortedRuns.length > 0 && (
              <button
                onClick={() => {
                  if (selectedRunIds.length === filteredRuns.length) {
                    setSelectedRunIds([]);
                  } else {
                    setSelectedRunIds(filteredRuns.map(r => r.id));
                  }
                }}
                style={{ ...btnS, padding:"8px 14px", fontSize:14 }}
              >
                {selectedRunIds.length === filteredRuns.length ? "Clear Selection" : "Select All"}
              </button>
            )}
            {selectedRunIds.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete ${selectedRunIds.length} test run(s)?`)) {
                    deleteRuns(selectedRunIds);
                  }
                }}
                style={{ ...btnD, padding:"8px 14px", fontSize:14 }}
              >
                🗑 Delete Selected
              </button>
            )}
            <button onClick={exportRuns} style={{ ...btnS, padding:"8px 14px", fontSize:14 }} disabled={filteredRuns.length===0}>Export Excel</button>
            <button onClick={()=>setShowAddRun(true)} style={btnP}>+ New Test Run</button>
            </div>
          </div>
          {sortedRuns.length===0 && <div style={{ textAlign:"center", padding:60, color:"#cbd5e1" }}>No test runs yet. Create your first one!</div>}
          {sortedRuns.length>0 && filteredRuns.length===0 && <div style={{ textAlign:"center", padding:40, color:"#cbd5e1" }}>No runs match current filters.</div>}
          <div style={{ display:"grid", gap:14 }}>
            {filteredRuns.map(run=>{
              const st = runStats(run);
              const pct = st.total>0 ? Math.round((st.pass/st.total)*100) : 0;
              const isRunSelected = selectedRunIds.includes(run.id);
              const showRunCheckbox = hoveredRunId === run.id || isRunSelected;
              return (
                <div key={run.id} style={{ background:"#f0f4f9", border:"1.5px solid #f1f5f9", borderRadius:14, padding:"20px 24px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", cursor:"pointer", transition:"box-shadow 0.15s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 6px 24px rgba(99,102,241,0.1)"; setHoveredRunId(run.id); }}
                  onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.05)"; setHoveredRunId(null); }}
                  onClick={()=>setViewRun(run)}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span
                          onClick={e=>e.stopPropagation()}
                          style={{ width:18, display:"inline-flex", justifyContent:"center", opacity:showRunCheckbox ? 1 : 0, transition:"opacity 0.15s" }}
                        >
                          <input
                            type="checkbox"
                            checked={isRunSelected}
                            onChange={e => setSelectedRunIds(p => e.target.checked ? [...p, run.id] : p.filter(x=>x!==run.id))}
                            style={{ width:15, height:15, cursor:"pointer", accentColor:"#6366f1" }}
                          />
                        </span>
                        <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#6366f1", background:"#eff6ff", padding:"2px 8px", borderRadius:5 }}>{run.runNumber}</span>
                        <span style={{ fontSize:14, color:"#94a3b8" }}>{run.createdAt?.slice(0,10)}</span>
                      </div>
                      <div style={{ fontSize:20, fontWeight:700, color:"#0f172a" }}>{run.name}</div>
                      <div style={{ fontSize:14, color:"#64748b", marginTop:3 }}>👤 {run.tester}</div>
                    </div>
                    <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                      <StatChip label="Total"   value={st.total}  color="#6366f1" bg="#eff6ff"/>
                      <StatChip label="Pass"    value={st.pass}   color="#15803d" bg="#f0fdf4"/>
                      <StatChip label="Fail"    value={st.fail}   color="#be123c" bg="#fff1f2"/>
                      <StatChip label="Not Run" value={st.notRun} color="#64748b" bg="#f8fafc"/>
                    </div>
                  </div>
                  <div style={{ marginTop:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#94a3b8", marginBottom:5 }}>
                      <span>Progress</span><span style={{ fontWeight:700, color:pct===100?"#15803d":"#64748b" }}>{pct}%</span>
                    </div>
                    <div style={{ height:6, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:pct===100?"#22c55e":"linear-gradient(90deg,#6366f1,#06b6d4)", borderRadius:99, transition:"width 0.4s" }}/>
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
      {activeTab==="defects" && (
        <div style={{ padding:"20px 2.5%" }}>
          <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
            <input
              placeholder="Search defect / run / TC / assignee..."
              value={defSearch}
              onChange={e=>setDefSearch(e.target.value)}
              style={{ ...inp, width:320 }}
            />
            <select value={defStatusFilter} onChange={e=>setDefStatusFilter(e.target.value)} style={{ ...inp, width:180 }}>
              <option>All</option>
              {Object.keys(DEFECT_STATUS).map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={defPriFilter} onChange={e=>setDefPriFilter(e.target.value)} style={{ ...inp, width:150 }}>
              <option>All</option>
              {Object.keys(PRIORITY_META).map(p=><option key={p}>{p}</option>)}
            </select>
            <select value={defMarketFilter} onChange={e=>setDefMarketFilter(e.target.value)} style={{ ...inp, width:120 }}>
              <option>All</option>
              {Array.from(new Set(defects.map(d => d.market).filter(Boolean))).sort().map(m=><option key={m}>{m}</option>)}
            </select>
            <button
              onClick={() => {
                setDefSearch("");
                setDefStatusFilter("All");
                setDefPriFilter("All");
                setDefMarketFilter("All");
                setDefOpenRule("Any");
                setDefOpenDate("");
                setDefCloseRule("Any");
                setDefCloseDate("");
              }}
              style={{ ...btnS, padding:"9px 14px", fontSize:14 }}
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
                style={{ ...btnS, padding:"9px 14px", fontSize:14 }}
              >
                {selectedDefectIds.length === filteredDefects.length ? "Clear Selection" : "Select All"}
              </button>
            )}
            <div style={{ flex:1 }}/>
            {selectedDefectIds.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, color:"#64748b", fontWeight:700 }}>{selectedDefectIds.length} selected</span>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedDefectIds.length} defect(s)?`)) {
                      deleteDefects(selectedDefectIds);
                    }
                  }}
                  style={{ ...btnD, padding:"9px 14px", fontSize:14 }}
                >
                  🗑 Delete Selected
                </button>
              </div>
            )}
            <button onClick={exportDefects} style={{ ...btnS, padding:"9px 14px", fontSize:14 }} disabled={sortedFilteredDefects.length===0}>Export Excel</button>
            <button onClick={createStandaloneDefect} style={btnP}>+ Add Defect</button>
          </div>
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #f1f5f9", boxShadow:"0 2px 12px rgba(0,0,0,0.05)", overflowX:"auto", overflowY:"visible" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead>
                <tr style={{ background:"#e2ebf3", borderBottom:"2px solid #f1f5f9" }}>
                  <th style={{ padding:"12px 16px", width:40 }}>
                    <input
                      type="checkbox"
                      checked={filteredDefects.length > 0 && selectedDefectIds.length === filteredDefects.length}
                      onChange={e => setSelectedDefectIds(e.target.checked ? filteredDefects.map(def => def.id) : [])}
                      style={{ width:15, height:15, cursor:"pointer", accentColor:"#6366f1" }}
                    />
                  </th>
                  {[{label:"Actions",col:""},{label:"ID",col:"defectNumber"},{label:"Run",col:"runNumber"},{label:"TC",col:"tcNumber"},{label:"Market",col:"market"},{label:"Actual Result",col:"actualResult"},{label:"Priority",col:"priority"},{label:"Assigned",col:"assignedTo"},{label:"Status",col:"status"}].map(({label,col})=>(
                    <th key={label} onClick={col ? ()=>{ if(defSortCol===col) setDefSortDir(d=>d==="asc"?"desc":"asc"); else { setDefSortCol(col); setDefSortDir("asc"); } } : undefined}
                      style={{ padding:"12px 16px", textAlign:"left", color:"#1f252e", fontSize:14, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", whiteSpace:"nowrap", cursor:col?"pointer":"default", userSelect:"none", background: col&&defSortCol===col ? "#d4dff0" : undefined }}>
                      {label}{col && defSortCol===col ? (defSortDir==="asc" ? " ▲" : " ▼") : col ? " ⇅" : ""}
                    </th>
                  ))}
                  <th
                    onClick={() => { if(defSortCol === "openDateTime") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("openDateTime"); setDefSortDir("asc"); } }}
                    style={{ padding:"8px 12px", textAlign:"left", color:"#1f252e", whiteSpace:"nowrap", position:"relative", zIndex:5, cursor:"pointer", userSelect:"none", background:defSortCol === "openDateTime" ? "#d4dff0" : undefined }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase" }}>Open Datetime{defSortCol === "openDateTime" ? (defSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
                      <button
                        onClick={e => toggleDefDateFilterPanel(e, "open")}
                        title="Filter open datetime"
                        style={{ border:"1px solid #cbd5e1", background:defDateFilterPanel?.type === "open" ? "#eff6ff" : "#fff", color:defDateFilterPanel?.type === "open" ? "#1d4ed8" : "#64748b", borderRadius:6, width:22, height:22, fontSize:12, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0 }}
                      >
                        ⌕
                      </button>
                    </div>
                  </th>
                  <th
                    onClick={() => { if(defSortCol === "closeDateTime") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("closeDateTime"); setDefSortDir("asc"); } }}
                    style={{ padding:"8px 12px", textAlign:"left", color:"#1f252e", whiteSpace:"nowrap", position:"relative", zIndex:5, cursor:"pointer", userSelect:"none", background:defSortCol === "closeDateTime" ? "#d4dff0" : undefined }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase" }}>Close Datetime{defSortCol === "closeDateTime" ? (defSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
                      <button
                        onClick={e => toggleDefDateFilterPanel(e, "close")}
                        title="Filter close datetime"
                        style={{ border:"1px solid #cbd5e1", background:defDateFilterPanel?.type === "close" ? "#eff6ff" : "#fff", color:defDateFilterPanel?.type === "close" ? "#1d4ed8" : "#64748b", borderRadius:6, width:22, height:22, fontSize:12, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", padding:0 }}
                      >
                        ⌕
                      </button>
                    </div>
                  </th>
                  <th
                    onClick={() => { if(defSortCol === "aged") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("aged"); setDefSortDir("asc"); } }}
                    style={{ padding:"12px 16px", textAlign:"left", color:"#1f252e", fontSize:14, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", whiteSpace:"nowrap", cursor:"pointer", userSelect:"none", background:defSortCol === "aged" ? "#d4dff0" : undefined }}
                  >
                    Aged{defSortCol === "aged" ? (defSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {defects.length===0 && <tr><td colSpan={13} style={{ padding:48, textAlign:"center", color:"#cbd5e1" }}>No defects logged</td></tr>}
                {defects.length>0 && filteredDefects.length===0 && <tr><td colSpan={13} style={{ padding:48, textAlign:"center", color:"#cbd5e1" }}>No defects match current filters</td></tr>}
                {sortedFilteredDefects.map((def,i)=>{
                  const aged = agedDays(def.dateRaised);
                  const isSelected = selectedDefectIds.includes(def.id);
                  return (
                    <tr key={def.id} 
					onContextMenu={e=>{ e.preventDefault(); setContextMenu({ type:"defect", item:def, x:e.clientX, y:e.clientY }); }}
					style={{ borderBottom:"1px solid #f8fafc", background:isSelected?"#eff6ff":i%2===0?"#fff":"#fafafa", cursor:"pointer" }}
                      onMouseEnter={e=>{ if (!isSelected) e.currentTarget.style.background="#f0f4ff"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background=isSelected?"#eff6ff":i%2===0?"#fff":"#fafafa"; }}>
                      <td style={{ padding:"13px 16px" }} onClick={e=>e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => setSelectedDefectIds(p => e.target.checked ? [...p, def.id] : p.filter(x=>x!==def.id))}
                          style={{ width:15, height:15, cursor:"pointer", accentColor:"#6366f1" }}
                        />
                      </td>
                      <td style={{ padding:"13px 16px", width:220, minWidth:220 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center", whiteSpace:"nowrap" }}>
                          <button onClick={()=>setViewDef(def)} style={{ ...btnS, padding:"5px 12px", fontSize:14 }}>View</button>
                          <button
                            onClick={() => setEditDef({
                              ...def,
                              dateRaised: def.dateRaised ? String(def.dateRaised).slice(0, 10) : "",
                              targetFixDate: def.targetFixDate ? String(def.targetFixDate).slice(0, 10) : "",
                              linkedRunId: runs.find(r => r.runNumber === def.runNumber)?.id || "",
                              linkedTestCaseId: allTestCases.find(t => t.tcNumber === def.tcNumber)?.id || "",
                            })}
                            style={{ ...btnP, padding:"5px 12px", fontSize:14 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete ${def.defectNumber}?`)) {
                                deleteDefects([def.id]);
                              }
                            }}
                            style={xBtn}
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                      <td style={{ padding:"13px 16px" }} onClick={()=>setViewDef(def)}>
                        <span style={{ fontWeight:800, color:"#ef4444", fontSize:14, fontFamily:"monospace", background:"#fff1f2", padding:"2px 7px", borderRadius:5 }}>{def.defectNumber}</span>
                      </td>
                      <td style={{ padding:"13px 16px", color:"#6366f1", fontSize:14, fontFamily:"monospace", fontWeight:700 }} onClick={()=>setViewDef(def)}>{def.runNumber}</td>
                      <td style={{ padding:"13px 16px", color:"#6366f1", fontSize:14, fontFamily:"monospace", fontWeight:700 }} onClick={()=>setViewDef(def)}>{def.tcNumber}</td>
                      <td style={{ padding:"13px 16px" }} onClick={()=>setViewDef(def)}>
                        <span style={{ fontSize:14, background:"#f1f5f9", color:"#475569", padding:"2px 8px", borderRadius:6, fontWeight:700 }}>{def.market}</span>
                      </td>
                      <td style={{ padding:"13px 16px", maxWidth:240 }} onClick={()=>setViewDef(def)}>
                        <div style={{ color:"#1e293b", lineHeight:1.4, whiteSpace:"pre-wrap", wordBreak:"break-word", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                          {def.actualResult}
                        </div>
                      </td>
                      <td style={{ padding:"13px 16px" }} onClick={()=>setViewDef(def)}><PriBadge label={def.priority}/></td>
                      <td style={{ padding:"13px 16px", color:"#64748b", fontSize:14 }} onClick={()=>setViewDef(def)}>{def.assignedTo||"—"}</td>
                      <td style={{ padding:"13px 16px" }}>
                        <select value={def.status} onChange={e=>updateDefStatus(def.id,e.target.value)} onClick={e=>e.stopPropagation()}
                          style={{ background:DEFECT_STATUS[def.status]?.bg, color:DEFECT_STATUS[def.status]?.text, border:`1.5px solid ${DEFECT_STATUS[def.status]?.border}`, borderRadius:20, padding:"4px 10px", fontSize:14, fontWeight:700, cursor:"pointer", outline:"none" }}>
                          {Object.keys(DEFECT_STATUS).map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:"13px 16px", color:"#64748b", fontSize:13 }} onClick={()=>setViewDef(def)}>
                        {def.openDateTime ? new Date(def.openDateTime).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding:"13px 16px", color:"#64748b", fontSize:13 }} onClick={()=>setViewDef(def)}>
                        {def.closeDateTime ? new Date(def.closeDateTime).toLocaleString() : "-"}
                      </td>
                      <td style={{ padding:"13px 16px" }} onClick={()=>setViewDef(def)}>
                        <span style={{ fontWeight:700, fontSize:14, color:aged>7?"#ef4444":aged>3?"#f97316":"#22c55e" }}>{aged}d</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW TC ── */}
      {viewTC && (
        <Modal onClose={()=>setViewTC(null)}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:800, color:"#6366f1", background:"#eff6ff", padding:"2px 10px", borderRadius:6, border:"1px solid #c7d2fe" }}>{viewTC.tcNumber}</span>
              <div style={{ color:"#0f172a", fontSize:16, fontWeight:700, marginTop:8, lineHeight:1.4 }}>{viewTC.name}</div>
            </div>
            <button onClick={()=>setViewTC(null)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:22, flexWrap:"wrap" }}>
            <PriBadge label={viewTC.priority}/>
            <span style={{ background:"#f1f5f9", color:"#475569", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{viewTC.category.split("(")[0].trim()}</span>
          </div>
          <div style={{ display:"grid", gap:14 }}>
            {viewTC.description && <DetailBlock label="Description" value={viewTC.description}/>}
            <DetailBlock label="Test Steps" value={viewTC.steps} pre/>
            <DetailBlock label="Expected Result" value={viewTC.expectedResult} accent/>
            {viewTC.remarks && <DetailBlock label="Remarks" value={viewTC.remarks}/>}
          </div>
          <div style={{ marginTop:22, paddingTop:18, borderTop:"1.5px solid #f1f5f9" }}>
            <div style={{ ...lbl, marginBottom:10 }}>Attachments</div>
            <div
              onPaste={e => onTestCasePasteUpload(e, viewTC.id)}
              style={{ background:"#f8fafc", border:"1.5px dashed #cbd5e1", borderRadius:10, padding:"10px 12px" }}
            >
              <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
                Paste screenshot with Ctrl+V or attach file(s)
              </div>
              <input
                type="file"
                multiple
                onChange={e => {
                  uploadTestCaseFiles(viewTC.id, e.target.files);
                  e.target.value = "";
                }}
                style={{ ...inp, fontSize:12, padding:"8px 10px" }}
              />
            </div>

            <div style={{ display:"grid", gap:8, marginTop:10 }}>
              {(testCaseAttachments[viewTC.id] || []).length === 0 && (
                <div style={{ color:"#94a3b8", fontSize:13 }}>No attachments yet.</div>
              )}

              {(testCaseAttachments[viewTC.id] || []).map(a => (
                <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px" }}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ color:"#1d4ed8", fontSize:13, fontWeight:700, textDecoration:"none", maxWidth:360, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {a.fileName}
                  </a>
                  <span style={{ color:"#64748b", fontSize:12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                  <span style={{ color:"#94a3b8", fontSize:11, marginLeft:"auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                  <button onClick={() => deleteTestCaseAttachment(viewTC.id, a.id)} style={{ border:"none", background:"none", color:"#ef4444", cursor:"pointer", fontSize:14 }}>✕</button>
                </div>
              ))}

              {uploadingTestCaseId === viewTC.id && (
                <div style={{ color:"#64748b", fontSize:12 }}>Uploading...</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: RUN DETAIL ── */}
      {viewRun && (
        <Modal onClose={()=>setViewRun(null)} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:800, color:"#6366f1", background:"#eff6ff", padding:"2px 8px", borderRadius:5 }}>{viewRun.runNumber}</span>
              <div style={{ fontSize:17, fontWeight:800, color:"#0f172a", marginTop:6 }}>{viewRun.name}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>👤 {viewRun.tester} · {viewRun.createdAt?.slice(0,10)}</div>
            </div>
            <button onClick={()=>setViewRun(null)} style={xBtn}>✕</button>
          </div>

          {(()=>{ const st=runStats(viewRun); const pct=st.total>0?Math.round((st.pass/st.total)*100):0; return (
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
              <StatChip label="Total"   value={st.total}  color="#6366f1" bg="#eff6ff"/>
              <StatChip label="Pass"    value={st.pass}   color="#15803d" bg="#f0fdf4"/>
              <StatChip label="Fail"    value={st.fail}   color="#be123c" bg="#fff1f2"/>
              <StatChip label="Not Run" value={st.notRun} color="#64748b" bg="#f8fafc"/>
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:120, height:8, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:pct===100?"#22c55e":"linear-gradient(90deg,#6366f1,#06b6d4)", borderRadius:99 }}/>
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:pct===100?"#15803d":"#64748b" }}>{pct}%</span>
              </div>
            </div>
          );})()}

          <AddTcToRunRow testCases={allTestCases} run={viewRun} onAdd={tcId=>addTcToRun(viewRun.id, tcId)}/>

          <div style={{ display:"grid", gap:10, marginTop:16 }}>
            {(viewRun.entries||[]).length===0 && <div style={{ textAlign:"center", padding:32, color:"#cbd5e1" }}>No test cases in this run yet.</div>}
            {(viewRun.entries||[]).map(entry=>{
              const tc = allTestCaseById[entry.testCaseId];
              const ec = EXEC_STATUS[entry.execStatus] || EXEC_STATUS["Not Run"];
              const entryDefects = entry.defects || [];
              return (
                <div key={entry.id} style={{ border:`1.5px solid ${ec.border}`, borderRadius:12, padding:"14px 16px", background:ec.bg }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, flexWrap:"wrap" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:800, color:"#6366f1", background:"#fff", padding:"1px 7px", borderRadius:5, border:"1px solid #c7d2fe", flexShrink:0 }}>{tc?.tcNumber}</span>
                        <PriBadge label={tc?.priority||"Medium"}/>
                      </div>
                      <div style={{ fontWeight:600, color:"#1e293b", fontSize:15, lineHeight:1.4, marginBottom:6 }}>{tc?.name||entry.testCaseId}</div>
                      <div style={{ marginTop:10 }}>
					  {(entry.comments || []).map(c => (
						<div
						  key={c.id}
						  style={{
							background:"#fff",
							border:"1px solid #e2e8f0",
							borderRadius:8,
							padding:"8px 12px",
							marginBottom:8
						  }}
						>
						  <div style={{
							display:"flex",
							justifyContent:"space-between",
							marginBottom:4
						  }}>
							<span style={{
							  fontWeight:700,
							  color:"#475569",
							  fontSize:12
							}}>
							  {c.tester}
							</span>

							<div style={{
							  display:"flex",
							  alignItems:"center",
							  gap:8
							}}>
							  <span style={{
								fontSize:11,
								color:"#94a3b8"
							  }}>
								{new Date(c.createdAt).toLocaleString()}
							  </span>

							  <button
								onClick={() =>
								  deleteComment(
									viewRun.id,
									entry.testCaseId,
									c.id
								  )
								}
								style={{
								  border:"none",
								  background:"none",
								  color:"#ef4444",
								  cursor:"pointer"
								}}
							  >
								✕
							  </button>
							</div>
						  </div>

						  <div style={{
							fontSize:13,
							color:"#334155"
						  }}>
							{c.message}
						  </div>
						</div>
					  ))}

					  <div style={{
						display:"flex",
						gap:8
					  }}>
						<input
						  placeholder="Add comment..."
						  value={commentDrafts[entry.testCaseId] || ""}
						  onChange={e =>
							setCommentDrafts(p => ({
							  ...p,
							  [entry.testCaseId]: e.target.value
							}))
						  }
						  style={{
							...inp,
							fontSize:12,
							flex:1
						  }}
						/>

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
					  </div>
					</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <select value={entry.execStatus||"Not Run"} onChange={e=>updateExecStatus(viewRun.id, entry.testCaseId, e.target.value)}
                          style={{ background:ec.bg, color:ec.text, border:`1.5px solid ${ec.border}`, borderRadius:20, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer", outline:"none" }}>
                          {Object.keys(EXEC_STATUS).map(s=><option key={s}>{s}</option>)}
                        </select>
                        <button onClick={()=>removeTcFromRun(viewRun.id, entry.testCaseId)} title="Remove from run"
                          style={{ background:"#f1f5f9", border:"none", color:"#94a3b8", width:28, height:28, borderRadius:6, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                      </div>
                      {entry.execStatus==="Fail" && entryDefects.length===0 && (
                        <button onClick={()=>createDefect(viewRun.id, entry.testCaseId)} style={btnD}>🐛 Create Defect</button>
                      )}
                      {entryDefects.map(d=>(
                        <span key={d.id} style={{ fontSize:11, fontWeight:800, color:"#ef4444", background:"#fff1f2", border:"1px solid #fecdd3", padding:"3px 10px", borderRadius:20, cursor:"pointer" }}
                          onClick={()=>setViewDef(d)}>
                          🔗 {d.defectNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── MODAL: DEFECT DETAIL ── */}
      {viewDef && (
        <Modal onClose={()=>setViewDef(null)}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#ef4444", background:"#fff1f2", padding:"2px 10px", borderRadius:6, border:"1px solid #fecdd3" }}>{viewDef.defectNumber}</span>
              <div style={{ color:"#0f172a", fontSize:14, fontWeight:700, padding:"2px 5px", marginTop:8, borderRadius:6, border:"1px solid #fecdd3" }}>{viewDef.issueType}</div>
            </div>
            <button onClick={()=>setViewDef(null)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:22, flexWrap:"wrap" }}>
            <DefBadge status={viewDef.status}/>
            <PriBadge label={viewDef.priority}/>
            <span style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", padding:"3px 10px", borderRadius:20, fontSize:14, fontWeight:700 }}>Run: {viewDef.runNumber}</span>
            <span style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", padding:"3px 10px", borderRadius:20, fontSize:14, fontWeight:700 }}>TC: {viewDef.tcNumber}</span>
            <span style={{ background:"#f1f5f9", color:"#475569", padding:"3px 10px", borderRadius:20, fontSize:14, fontWeight:700 }}>🌏 {viewDef.market}</span>
            {(()=>{ const aged=agedDays(viewDef.dateRaised); return (
              <span style={{ background:aged>7?"#fff1f2":"#fefce8", color:aged>7?"#ef4444":"#a16207", border:`1px solid ${aged>7?"#fecdd3":"#fde68a"}`, padding:"3px 10px", borderRadius:20, fontSize:14, fontWeight:700 }}>⏱ {aged}d</span>
            );})()}
          </div>
          <div style={{ display:"grid", gap:14 }}>
            <DetailBlock label="Description" value={viewDef.description}/>
            <DetailBlock label="Expected Result" value={viewDef.expectedResult} accent/>
            <DetailBlock label="Actual Result"   value={viewDef.actualResult}   danger/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <DetailBlock label="Raised By"   value={viewDef.raisedBy}/>
              <DetailBlock label="Assigned To" value={viewDef.assignedTo||"—"}/>
              <DetailBlock label="Date Raised" value={viewDef.dateRaised?.slice(0,10)}/>
              <DetailBlock label="Target Fix"  value={viewDef.targetFixDate?.slice(0,10)||"—"}/>
            </div>
            {viewDef.remarks && <DetailBlock label="Remarks" value={viewDef.remarks}/>}
          </div>
          <div style={{ marginTop:16, display:"flex", justifyContent:"flex-end" }}>
            <button
              onClick={() => setEditDef({
                ...viewDef,
                dateRaised: viewDef.dateRaised?.slice(0, 10) || "",
                targetFixDate: viewDef.targetFixDate?.slice(0, 10) || "",
                linkedRunId: runs.find(r => r.runNumber === viewDef.runNumber)?.id || "",
                linkedTestCaseId: allTestCases.find(t => t.tcNumber === viewDef.tcNumber)?.id || "",
              })}
              style={{ ...btnP, padding:"8px 14px", fontSize:14 }}
            >
              Edit Defect
            </button>
          </div>
          <div style={{ marginTop:22, paddingTop:18, borderTop:"1.5px solid #f1f5f9" }}>
            <div style={{ ...lbl, marginBottom:10 }}>Attachments</div>
            <div
              onPaste={e => onDefectPasteUpload(e, viewDef.id)}
              style={{ background:"#f8fafc", border:"1.5px dashed #cbd5e1", borderRadius:10, padding:"10px 12px" }}
            >
              <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
                Paste screenshot with Ctrl+V or attach file(s)
              </div>
              <input
                type="file"
                multiple
                onChange={e => {
                  uploadDefectFiles(viewDef.id, e.target.files);
                  e.target.value = "";
                }}
                style={{ ...inp, fontSize:12, padding:"8px 10px" }}
              />
            </div>

            <div style={{ display:"grid", gap:8, marginTop:10 }}>
              {(defectAttachments[viewDef.id] || []).length === 0 && (
                <div style={{ color:"#94a3b8", fontSize:13 }}>No attachments yet.</div>
              )}

              {(defectAttachments[viewDef.id] || []).map(a => (
                <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px" }}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ color:"#1d4ed8", fontSize:13, fontWeight:700, textDecoration:"none", maxWidth:360, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {a.fileName}
                  </a>
                  <span style={{ color:"#64748b", fontSize:12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                  <span style={{ color:"#94a3b8", fontSize:11, marginLeft:"auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                  <button onClick={() => deleteDefectAttachment(viewDef.id, a.id)} style={{ border:"none", background:"none", color:"#ef4444", cursor:"pointer", fontSize:14 }}>✕</button>
                </div>
              ))}

              {uploadingDefectId === viewDef.id && (
                <div style={{ color:"#64748b", fontSize:12 }}>Uploading...</div>
              )}
            </div>
          </div>
          <div style={{ marginTop:22, paddingTop:18, borderTop:"1.5px solid #f1f5f9" }}>
            <div style={{ ...lbl, marginBottom:10 }}>Comments</div>
            <div style={{ display:"grid", gap:8 }}>
              {(viewDef.comments || []).length === 0 && (
                <div style={{ color:"#94a3b8", fontSize:13 }}>No comments yet.</div>
              )}

              {(viewDef.comments || []).map(c => (
                <div
                  key={c.id}
                  style={{
                    background:"#fff",
                    border:"1px solid #e2e8f0",
                    borderRadius:8,
                    padding:"8px 12px",
                  }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontWeight:700, color:"#475569", fontSize:12 }}>{c.tester}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11, color:"#94a3b8" }}>{new Date(c.createdAt).toLocaleString()}</span>
                      <button
                        onClick={() => deleteDefectComment(viewDef.id, c.id)}
                        style={{ border:"none", background:"none", color:"#ef4444", cursor:"pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:"#334155" }}>{c.message}</div>
                </div>
              ))}

              <div style={{ display:"flex", gap:8, marginTop:2 }}>
                <input
                  placeholder="Add comment..."
                  value={defectCommentDrafts[viewDef.id] || ""}
                  onChange={e => setDefectCommentDrafts(p => ({
                    ...p,
                    [viewDef.id]: e.target.value,
                  }))}
                  style={{ ...inp, fontSize:12, flex:1 }}
                />
                <button onClick={() => addDefectComment(viewDef.id)} style={btnP}>Add</button>
              </div>
            </div>
          </div>
          <div style={{ marginTop:22, paddingTop:18, borderTop:"1.5px solid #f1f5f9" }}>
            <div style={{ ...lbl, marginBottom:10 }}>Update Status</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(DEFECT_STATUS).map(([s,c])=>(
                <button key={s} onClick={()=>updateDefStatus(viewDef.id,s)}
                  style={{ background:viewDef.status===s?c.bg:"#f8fafc", color:viewDef.status===s?c.text:"#94a3b8", border:`1.5px solid ${viewDef.status===s?c.border:"#e2e8f0"}`, borderRadius:20, padding:"5px 13px", fontSize:14, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: EDIT DEFECT ── */}
      {editDef && (
        <Modal onClose={() => setEditDef(null)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:22 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Edit Defect</div>
            <button onClick={() => setEditDef(null)} style={xBtn}>✕</button>
          </div>

          <div style={{ display:"grid", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Market</label>
                <select
                  value={editDef.market || "SG"}
                  onChange={e => setEditDef(p => ({ ...p, market: e.target.value }))}
                  style={inp}
                >
                  {["SG","HK","MY","KR","US","ID","TW"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Run</label>
                <select
                  value={editDef.linkedRunId || ""}
                  onChange={e => {
                    const nextRunId = e.target.value;
                    setEditDef(p => {
                      const run = runs.find(r => String(r.id) === String(nextRunId));
                      const validTcIds = new Set((run?.entries || []).map(en => String(en.testCaseId)));
                      return {
                        ...p,
                        linkedRunId: nextRunId,
                        linkedTestCaseId: validTcIds.has(String(p.linkedTestCaseId || "")) ? p.linkedTestCaseId : "",
                      };
                    });
                  }}
                  style={inp}
                >
                  <option value="">Standalone (No linked run/test case)</option>
                  {sortedRuns.map(r => <option key={r.id} value={r.id}>{r.runNumber} - {r.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl}>Test Case</label>
              <select
                value={editDef.linkedTestCaseId || ""}
                onChange={e => setEditDef(p => ({ ...p, linkedTestCaseId: e.target.value }))}
                disabled={!editDef.linkedRunId}
                style={inp}
              >
                <option value="">{editDef.linkedRunId ? "No specific test case (run-level defect)" : "Select run first or choose standalone"}</option>
                {(() => {
                  const run = runs.find(r => String(r.id) === String(editDef.linkedRunId));
                  const options = (run?.entries || [])
                    .map(en => allTestCaseById[en.testCaseId])
                    .filter(Boolean);
                  return options.map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>);
                })()}
              </select>
            </div>

            <div>
              <label style={lbl}>Description</label>
              <textarea
                value={editDef.description || ""}
                onChange={e => setEditDef(p => ({ ...p, description: e.target.value }))}
                style={{ ...inp, minHeight:80, resize:"vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Expected Result</label>
              <textarea
                value={editDef.expectedResult || ""}
                onChange={e => setEditDef(p => ({ ...p, expectedResult: e.target.value }))}
                style={{ ...inp, minHeight:70, resize:"vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Actual Result</label>
              <textarea
                value={editDef.actualResult || ""}
                onChange={e => setEditDef(p => ({ ...p, actualResult: e.target.value }))}
                style={{ ...inp, minHeight:70, resize:"vertical" }}
              />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Raised By</label>
                <input
                  value={editDef.raisedBy || ""}
                  onChange={e => setEditDef(p => ({ ...p, raisedBy: e.target.value }))}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <input
                  value={editDef.assignedTo || ""}
                  onChange={e => setEditDef(p => ({ ...p, assignedTo: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Date Raised</label>
                <input
                  type="date"
                  value={editDef.dateRaised || ""}
                  onChange={e => setEditDef(p => ({ ...p, dateRaised: e.target.value }))}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Target Fix Date</label>
                <input
                  type="date"
                  value={editDef.targetFixDate || ""}
                  onChange={e => setEditDef(p => ({ ...p, targetFixDate: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Status</label>
              <select
                value={editDef.status || "New"}
                onChange={e => setEditDef(p => ({ ...p, status: e.target.value }))}
                style={inp}
              >
                {Object.keys(DEFECT_STATUS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}>Priority</label>
              <select
                value={editDef.priority || "Medium"}
                onChange={e => setEditDef(p => ({ ...p, priority: e.target.value }))}
                style={inp}
              >
                {Object.keys(PRIORITY_META).map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
            <button onClick={() => setEditDef(null)} style={btnS}>Cancel</button>
            <button onClick={saveDefectEdits} style={btnP}>Save Changes</button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: ADD TC ── */}
      {showAddTC && (
        <Modal onClose={()=>setShowAddTC(false)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:22 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Add Test Case</div>
            <button onClick={()=>setShowAddTC(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"grid", gap:14 }}>
            <div><label style={lbl}>Test Name *</label><input value={newTC.name} onChange={e=>setNewTC(p=>({...p,name:e.target.value}))} style={inp} placeholder="[Market] - [Module] - [Feature] - [Expected]"/></div>
            <div><label style={lbl}>Description</label><textarea value={newTC.description} onChange={e=>setNewTC(p=>({...p,description:e.target.value}))} style={{ ...inp,minHeight:70,resize:"vertical" }}/></div>
            <div><label style={lbl}>Test Steps</label><textarea value={newTC.steps} onChange={e=>setNewTC(p=>({...p,steps:e.target.value}))} style={{ ...inp,minHeight:90,resize:"vertical" }} placeholder="Step 1: …&#10;Step 2: …"/></div>
            <div><label style={lbl}>Expected Result</label><input value={newTC.expected} onChange={e=>setNewTC(p=>({...p,expected:e.target.value}))} style={inp}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={lbl}>Priority</label>
                <select value={newTC.priority} onChange={e=>setNewTC(p=>({...p,priority:e.target.value}))} style={inp}>
                  {TEST_CASE_PRIORITIES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Category</label>
                <select value={newTC.category} onChange={e=>setNewTC(p=>({...p,category:e.target.value}))} style={inp}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div><label style={lbl}>Remarks</label><input value={newTC.remarks} onChange={e=>setNewTC(p=>({...p,remarks:e.target.value}))} style={inp}/></div>
            <div style={{ marginTop:2 }}>
              <label style={lbl}>Attachments</label>
              <div
                onPaste={onNewTestCasePasteUpload}
                style={{ background:"#f8fafc", border:"1.5px dashed #cbd5e1", borderRadius:10, padding:"10px 12px" }}
              >
                <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
                  Paste screenshot with Ctrl+V or attach file(s)
                </div>
                <input
                  type="file"
                  multiple
                  onChange={e => {
                    queueNewTestCaseFiles(e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize:12, padding:"8px 10px" }}
                />
              </div>

              <div style={{ display:"grid", gap:8, marginTop:10 }}>
                {newTCAttachments.length === 0 && (
                  <div style={{ color:"#94a3b8", fontSize:13 }}>No attachments selected yet.</div>
                )}

                {newTCAttachments.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px" }}>
                    <span style={{ color:"#1e293b", fontSize:13, fontWeight:700, maxWidth:360, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                    <span style={{ color:"#64748b", fontSize:12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                    <span style={{ color:"#94a3b8", fontSize:11, marginLeft:"auto" }}>Will upload after test case is created</span>
                    <button onClick={() => removeQueuedNewTestCaseFile(i)} style={{ border:"none", background:"none", color:"#ef4444", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowAddTC(false)} style={btnS}>Cancel</button>
            <button onClick={addTC} style={{ ...btnP, opacity:(!newTC.name || !selectedTestPlanId)?0.5:1 }} disabled={!newTC.name || !selectedTestPlanId}>Add Test Case</button>
          </div>
        </Modal>
      )}

      {showAddProject && (
        <Modal onClose={()=>setShowAddProject(false)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Add Project</div>
            <button onClick={()=>setShowAddProject(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"grid", gap:12 }}>
            <div>
              <label style={lbl}>Project Name *</label>
              <input value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} style={inp} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Start Date *</label>
                <input type="date" value={newProjectStartDate} onChange={e=>setNewProjectStartDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>End Date *</label>
                <input type="date" value={newProjectEndDate} onChange={e=>setNewProjectEndDate(e.target.value)} style={inp} />
              </div>
            </div>
            {!isValidDateRange(newProjectStartDate, newProjectEndDate) && (newProjectStartDate || newProjectEndDate) && (
              <div style={{ color:"#be123c", fontSize:12, fontWeight:700 }}>Project start date must be on or before end date.</div>
            )}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:18, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowAddProject(false)} style={btnS}>Cancel</button>
            <button onClick={addProject} style={{ ...btnP, opacity:(!newProjectName.trim() || !isValidDateRange(newProjectStartDate, newProjectEndDate))?0.5:1 }} disabled={!newProjectName.trim() || !isValidDateRange(newProjectStartDate, newProjectEndDate)}>Create Project</button>
          </div>
        </Modal>
      )}

      {showAddPlan && (
        <Modal onClose={()=>setShowAddPlan(false)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Add Test Plan</div>
            <button onClick={()=>setShowAddPlan(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"grid", gap:12 }}>
            <div>
              <label style={lbl}>Project</label>
              <input value={selectedProject?.name || "No project selected"} style={{ ...inp, background:"#f8fafc" }} readOnly />
            </div>
            <div>
              <label style={lbl}>Project Timeline</label>
              <input value={formatTimeline(selectedProject?.startDate, selectedProject?.endDate)} style={{ ...inp, background:"#f8fafc" }} readOnly />
            </div>
            <div>
              <label style={lbl}>Test Plan Name *</label>
              <input value={newPlanName} onChange={e=>setNewPlanName(e.target.value)} style={inp} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Start Date *</label>
                <input
                  type="date"
                  value={newPlanStartDate}
                  onChange={e=>setNewPlanStartDate(e.target.value)}
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
                  onChange={e=>setNewPlanEndDate(e.target.value)}
                  min={toInputDate(selectedProject?.startDate)}
                  max={toInputDate(selectedProject?.endDate) || undefined}
                  style={inp}
                />
              </div>
            </div>
            {!isValidDateRange(newPlanStartDate, newPlanEndDate) && (newPlanStartDate || newPlanEndDate) && (
              <div style={{ color:"#be123c", fontSize:12, fontWeight:700 }}>Test plan start date must be on or before end date.</div>
            )}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:18, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowAddPlan(false)} style={btnS}>Cancel</button>
            <button onClick={addTestPlan} style={{ ...btnP, opacity:(!newPlanName.trim() || !selectedProjectId || !isValidDateRange(newPlanStartDate, newPlanEndDate))?0.5:1 }} disabled={!newPlanName.trim() || !selectedProjectId || !isValidDateRange(newPlanStartDate, newPlanEndDate)}>Create Test Plan</button>
          </div>
        </Modal>
      )}

      {showEditProject && (
        <Modal onClose={()=>setShowEditProject(false)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Edit Project</div>
            <button onClick={()=>setShowEditProject(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"grid", gap:12 }}>
            <div>
              <label style={lbl}>Project Name *</label>
              <input value={editProjectName} onChange={e=>setEditProjectName(e.target.value)} style={inp} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Start Date *</label>
                <input type="date" value={editProjectStartDate} onChange={e=>setEditProjectStartDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>End Date *</label>
                <input type="date" value={editProjectEndDate} onChange={e=>setEditProjectEndDate(e.target.value)} style={inp} />
              </div>
            </div>
            {!isValidDateRange(editProjectStartDate, editProjectEndDate) && (editProjectStartDate || editProjectEndDate) && (
              <div style={{ color:"#be123c", fontSize:12, fontWeight:700 }}>Project start date must be on or before end date.</div>
            )}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:18, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowEditProject(false)} style={btnS}>Cancel</button>
            <button onClick={updateProjectName} style={{ ...btnP, opacity:(!editProjectName.trim() || !isValidDateRange(editProjectStartDate, editProjectEndDate))?0.5:1 }} disabled={!editProjectName.trim() || !isValidDateRange(editProjectStartDate, editProjectEndDate)}>Save Changes</button>
          </div>
        </Modal>
      )}

      {showEditPlan && (
        <Modal onClose={()=>setShowEditPlan(false)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Edit Test Plan</div>
            <button onClick={()=>setShowEditPlan(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"grid", gap:12 }}>
            <div>
              <label style={lbl}>Test Plan Name *</label>
              <input value={editPlanName} onChange={e=>setEditPlanName(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Project Timeline</label>
              <input value={formatTimeline(selectedProject?.startDate, selectedProject?.endDate)} style={{ ...inp, background:"#f8fafc" }} readOnly />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>Start Date *</label>
                <input
                  type="date"
                  value={editPlanStartDate}
                  onChange={e=>setEditPlanStartDate(e.target.value)}
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
                  onChange={e=>setEditPlanEndDate(e.target.value)}
                  min={toInputDate(selectedProject?.startDate)}
                  max={toInputDate(selectedProject?.endDate) || undefined}
                  style={inp}
                />
              </div>
            </div>
            {!isValidDateRange(editPlanStartDate, editPlanEndDate) && (editPlanStartDate || editPlanEndDate) && (
              <div style={{ color:"#be123c", fontSize:12, fontWeight:700 }}>Test plan start date must be on or before end date.</div>
            )}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:18, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowEditPlan(false)} style={btnS}>Cancel</button>
            <button onClick={updateTestPlanName} style={{ ...btnP, opacity:(!editPlanName.trim() || !isValidDateRange(editPlanStartDate, editPlanEndDate))?0.5:1 }} disabled={!editPlanName.trim() || !isValidDateRange(editPlanStartDate, editPlanEndDate)}>Save Changes</button>
          </div>
        </Modal>
      )}
	  
	  {/* ── MODAL: Edit TC ── */}
	  {editTC && (
	  <Modal onClose={() => setEditTC(null)}>
		<div style={{
		  display:"flex",
		  justifyContent:"space-between",
		  marginBottom:22
		}}>
		  <div style={{
			fontSize:17,
			fontWeight:800
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

		<div style={{ display:"grid", gap:14 }}>

		  <div>
			<label style={lbl}>Test Name *</label>

			<input
			  value={editTC.name}
			  onChange={e =>
				setEditTC(p => ({
				  ...p,
				  name:e.target.value
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
				  description:e.target.value
				}))
			  }
			  style={{
				...inp,
				minHeight:70,
				resize:"vertical"
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
				  steps:e.target.value
				}))
			  }
			  style={{
				...inp,
				minHeight:90,
				resize:"vertical"
			  }}
			/>
		  </div>

		  <div>
			<label style={lbl}>Expected Result</label>

			<input
			  value={editTC.expected}
			  onChange={e =>
				setEditTC(p => ({
				  ...p,
				  expected:e.target.value
				}))
			  }
			  style={inp}
			/>
		  </div>

		  <div style={{
			display:"grid",
			gridTemplateColumns:"1fr 1fr",
			gap:12
		  }}>

			<div>
			  <label style={lbl}>Priority</label>

			  <select
				value={editTC.priority}
				onChange={e =>
				  setEditTC(p => ({
					...p,
					priority:e.target.value
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
					category:e.target.value
				  }))
				}
				style={inp}
			  >
				{CATEGORIES.map(c =>
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
				  remarks:e.target.value
				}))
			  }
			  style={inp}
			/>
		  </div>

      <div style={{ marginTop:2 }}>
      <label style={lbl}>Attachments</label>
      <div
        onPaste={e => onTestCasePasteUpload(e, editTC.id)}
        style={{ background:"#f8fafc", border:"1.5px dashed #cbd5e1", borderRadius:10, padding:"10px 12px" }}
      >
        <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
        Paste screenshot with Ctrl+V or attach file(s)
        </div>
        <input
        type="file"
        multiple
        onChange={e => {
          uploadTestCaseFiles(editTC.id, e.target.files);
          e.target.value = "";
        }}
        style={{ ...inp, fontSize:12, padding:"8px 10px" }}
        />
      </div>

      <div style={{ display:"grid", gap:8, marginTop:10 }}>
        {(testCaseAttachments[editTC.id] || []).length === 0 && (
        <div style={{ color:"#94a3b8", fontSize:13 }}>No attachments yet.</div>
        )}

        {(testCaseAttachments[editTC.id] || []).map(a => (
        <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px" }}>
          <a href={a.url} target="_blank" rel="noreferrer" style={{ color:"#1d4ed8", fontSize:13, fontWeight:700, textDecoration:"none", maxWidth:360, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {a.fileName}
          </a>
          <span style={{ color:"#64748b", fontSize:12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
          <span style={{ color:"#94a3b8", fontSize:11, marginLeft:"auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
          <button onClick={() => deleteTestCaseAttachment(editTC.id, a.id)} style={{ border:"none", background:"none", color:"#ef4444", cursor:"pointer", fontSize:14 }}>✕</button>
        </div>
        ))}

        {uploadingTestCaseId === editTC.id && (
        <div style={{ color:"#64748b", fontSize:12 }}>Uploading...</div>
        )}
      </div>
      </div>
		</div>

		<div style={{
		  display:"flex",
		  gap:10,
		  marginTop:22,
		  justifyContent:"flex-end"
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

      {/* ── MODAL: NEW RUN ── */}
      {showAddRun && (
        <Modal onClose={()=>setShowAddRun(false)} wide>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:22 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>New Test Run</div>
            <button onClick={()=>setShowAddRun(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display:"grid", gap:14, marginBottom:20 }}>
            <div><label style={lbl}>Run Name *</label><input value={newRun.name} onChange={e=>setNewRun(p=>({...p,name:e.target.value}))} style={inp} placeholder="e.g. UAT 6.1 - SG Regression - Round 1"/></div>
            <div><label style={lbl}>Tester *</label><input value={newRun.tester} onChange={e=>setNewRun(p=>({...p,tester:e.target.value}))} style={inp} placeholder="Your name"/></div>
          </div>
          <div style={{ ...lbl, marginBottom:10 }}>Select Test Cases</div>
          <div style={{ border:"1.5px solid #f1f5f9", borderRadius:10, overflow:"hidden", maxHeight:340, overflowY:"auto" }}>
            {testCases.map((tc,i)=>{
              const checked = newRun.selectedTcIds.includes(tc.id);
              return (
                <div key={tc.id} onClick={()=>setNewRun(p=>({ ...p, selectedTcIds: checked ? p.selectedTcIds.filter(x=>x!==tc.id) : [...p.selectedTcIds,tc.id] }))}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:checked?"#eff6ff":i%2===0?"#fff":"#fafafa", borderBottom:"1px solid #f1f5f9", cursor:"pointer" }}>
                  <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checked?"#6366f1":"#e2e8f0"}`, background:checked?"#6366f1":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {checked && <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:800, color:"#6366f1", background:"#fff", padding:"1px 6px", borderRadius:4, border:"1px solid #c7d2fe", flexShrink:0 }}>{tc.tcNumber}</span>
                  <span style={{ fontSize:15, color:"#1e293b", fontWeight:500 }}>{tc.name}</span>
                  <span style={{ marginLeft:"auto", flexShrink:0 }}><PriBadge label={tc.priority}/></span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:8 }}>{newRun.selectedTcIds.length} test case{newRun.selectedTcIds.length!==1?"s":""} selected</div>
          <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowAddRun(false)} style={btnS}>Cancel</button>
            <button onClick={addRun} style={{ ...btnP, opacity:(!newRun.name||!newRun.tester||newRun.selectedTcIds.length===0)?0.5:1 }}
              disabled={!newRun.name||!newRun.tester||newRun.selectedTcIds.length===0}>
              Create Run
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: CREATE DEFECT ── */}
      {showAddDef && (
        <Modal onClose={()=>setShowAddDef(null)}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Create Defect</div>
            <button onClick={()=>{ setShowAddDef(null); setNewDefAttachments([]); }} style={xBtn}>✕</button>
          </div>
          {showAddDef.runId && showAddDef.tcId
            ? <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <span style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{runs.find(r=>r.id===showAddDef.runId)?.runNumber}</span>
                <span style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{allTestCaseById[showAddDef.tcId]?.tcNumber}</span>
              </div>
            : <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <span style={{ background:"#fff7ed", color:"#c2410c", border:"1px solid #fdba74", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>Standalone Defect</span>
              </div>}
          <div style={{ background:"#f8fafc", border:"1px solid #f1f5f9", borderRadius:8, padding:"10px 13px", fontSize:12, color:"#64748b", marginBottom:18 }}>{showAddDef.tcName}</div>
          <div style={{ display:"grid", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={lbl}>Market</label>
                <select value={newDef.market} onChange={e=>setNewDef(p=>({...p,market:e.target.value}))} style={inp}>
                  {["SG","HK","MY","KR","US","ID","TW"].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Issue Type</label>
                <select value={newDef.issueType} onChange={e=>setNewDef(p=>({...p,issueType:e.target.value}))} style={inp}>
                  {["UI Issue","Functional Issue","Performance Issue","Compatibility Issue","Data Issue","Regression Issue"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div><label style={lbl}>Description *</label><textarea value={newDef.description} onChange={e=>setNewDef(p=>({...p,description:e.target.value}))} style={{ ...inp,minHeight:80,resize:"vertical" }} placeholder="Menu: … / Page: … / Issue: …"/></div>
            <div><label style={lbl}>Expected Result</label><input value={newDef.expected} onChange={e=>setNewDef(p=>({...p,expected:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Actual Result</label><input value={newDef.actual} onChange={e=>setNewDef(p=>({...p,actual:e.target.value}))} style={inp}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={lbl}>Priority</label>
                <select value={newDef.priority} onChange={e=>setNewDef(p=>({...p,priority:e.target.value}))} style={inp}>
                  {Object.keys(PRIORITY_META).map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Raised By</label><input value={newDef.raisedBy} onChange={e=>setNewDef(p=>({...p,raisedBy:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Assigned To</label><input value={newDef.assignedTo} onChange={e=>setNewDef(p=>({...p,assignedTo:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Target Fix Date</label><input type="date" value={newDef.targetFix} onChange={e=>setNewDef(p=>({...p,targetFix:e.target.value}))} style={inp}/></div>
            </div>
            <div><label style={lbl}>Remarks</label><input value={newDef.remarks} onChange={e=>setNewDef(p=>({...p,remarks:e.target.value}))} style={inp}/></div>
            <div style={{ marginTop:2 }}>
              <label style={lbl}>Attachments</label>
              <div
                onPaste={onNewDefectPasteUpload}
                style={{ background:"#f8fafc", border:"1.5px dashed #cbd5e1", borderRadius:10, padding:"10px 12px" }}
              >
                <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
                  Paste screenshot with Ctrl+V or attach file(s)
                </div>
                <input
                  type="file"
                  multiple
                  onChange={e => {
                    queueNewDefectFiles(e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize:12, padding:"8px 10px" }}
                />
              </div>

              <div style={{ display:"grid", gap:8, marginTop:10 }}>
                {newDefAttachments.length === 0 && (
                  <div style={{ color:"#94a3b8", fontSize:13 }}>No attachments selected yet.</div>
                )}

                {newDefAttachments.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px" }}>
                    <span style={{ color:"#1e293b", fontSize:13, fontWeight:700, maxWidth:360, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                    <span style={{ color:"#64748b", fontSize:12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                    <span style={{ color:"#94a3b8", fontSize:11, marginLeft:"auto" }}>Will upload after defect is logged</span>
                    <button onClick={() => removeQueuedNewDefectFile(i)} style={{ border:"none", background:"none", color:"#ef4444", cursor:"pointer", fontSize:14 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
            <button onClick={()=>{ setShowAddDef(null); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
            <button onClick={submitDefect} style={{ ...btnP, opacity:!newDef.description?0.5:1 }} disabled={!newDef.description}>Log Defect</button>
          </div>
        </Modal>
      )}
      {runDateFilterPanel && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:"fixed",
            top:runDateFilterPanel.top,
            left:runDateFilterPanel.left,
            zIndex:2500,
            background:"#fff",
            border:"1.5px solid #e2e8f0",
            borderRadius:10,
            boxShadow:"0 10px 30px rgba(0,0,0,0.12)",
            padding:10,
            width:190
          }}
        >
          <div style={{ display:"grid", gap:6 }}>
            <select
              value={runDateRule}
              onChange={e => setRunDateRule(e.target.value)}
              style={{ ...inp, width:"100%", fontSize:12, padding:"6px 8px" }}
            >
              {["Any","Before","After","On"].map(rule => <option key={rule}>{rule}</option>)}
            </select>
            <input
              type="date"
              value={runDateValue}
              onChange={e => setRunDateValue(e.target.value)}
              style={{ ...inp, width:"100%", fontSize:12, padding:"6px 8px" }}
            />
          </div>
        </div>
      )}
	  {defDateFilterPanel && (
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:"fixed",
          top:defDateFilterPanel.top,
          left:defDateFilterPanel.left,
          zIndex:2500,
          background:"#fff",
          border:"1.5px solid #e2e8f0",
          borderRadius:10,
          boxShadow:"0 10px 30px rgba(0,0,0,0.12)",
          padding:10,
          width:190
        }}
      >
        <div style={{ display:"grid", gap:6 }}>
          <select
            value={defDateFilterPanel.type === "open" ? defOpenRule : defCloseRule}
            onChange={e => {
              if (defDateFilterPanel.type === "open") setDefOpenRule(e.target.value);
              else setDefCloseRule(e.target.value);
            }}
            style={{ ...inp, width:"100%", fontSize:12, padding:"6px 8px" }}
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
            style={{ ...inp, width:"100%", fontSize:12, padding:"6px 8px" }}
          />
        </div>
      </div>
    )}
	  {contextMenu && (
  <div onClick={e=>e.stopPropagation()}
    style={{
      position:"fixed", top:contextMenu.y, left:contextMenu.x,
      background:"#fff", border:"1.5px solid #f1f5f9", borderRadius:10,
      boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:2000,
      minWidth:180, overflow:"hidden",
    }}>
    {/* header */}
    <div style={{ padding:"10px 14px 8px", borderBottom:"1px solid #f8fafc" }}>
      <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase" }}>
        {contextMenu.type === "tc" ? "Test Case" : "Defect"}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:"#1e293b", marginTop:2 }}>
        {contextMenu.type === "tc"
          ? contextMenu.item.tcNumber
          : contextMenu.item.defectNumber}
      </div>
    </div>
    {/* actions */}
    <div style={{ padding:"4px 0" }}>
      <button
        onClick={() => contextMenu.type === "tc"
          ? duplicateTC(contextMenu.item)
          : duplicateDefect(contextMenu.item)}
        style={{
          display:"flex", alignItems:"center", gap:10,
          width:"100%", padding:"9px 14px", background:"none",
          border:"none", cursor:"pointer", fontSize:13, color:"#1e293b",
          fontWeight:500, textAlign:"left",
        }}
        onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
        onMouseLeave={e=>e.currentTarget.style.background="none"}>
        <span style={{ fontSize:15 }}>⧉</span> Duplicate
      </button>
      <button
        onClick={() => {
          if (contextMenu.type === "tc") {
            if (window.confirm("Delete this test case?")) deleteTestCases([contextMenu.item.id]);
          } else {
            if (window.confirm(`Delete ${contextMenu.item.defectNumber}?`)) deleteDefects([contextMenu.item.id]);
          }
          setContextMenu(null);
        }}
        style={{
          display:"flex", alignItems:"center", gap:10,
          width:"100%", padding:"9px 14px", background:"none",
          border:"none", cursor:"pointer", fontSize:13, color:"#be123c",
          fontWeight:500, textAlign:"left",
        }}
        onMouseEnter={e=>e.currentTarget.style.background="#fff1f2"}
        onMouseLeave={e=>e.currentTarget.style.background="none"}>
        <span style={{ fontSize:15 }}>🗑</span> Delete
      </button>
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
    <div style={{ background:bg, borderRadius:8, padding:"6px 14px", display:"flex", flexDirection:"column", alignItems:"center", minWidth:64 }}>
      <span style={{ fontSize:10, fontWeight:700, color, letterSpacing:"0.07em", textTransform:"uppercase" }}>{label}</span>
      <span style={{ fontSize:20, fontWeight:900, color, lineHeight:1.2 }}>{value}</span>
    </div>
  );
}

function AddTcToRunRow({ testCases, run, onAdd }) {
  const [selected, setSelected] = useState("");
  const existing = (run.entries||[]).map(e => e.testCaseId);
  const available = testCases.filter(tc => !existing.includes(tc.id));
  if (available.length===0) return <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4 }}>All test cases added to this run.</div>;
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", background:"#f8fafc", border:"1.5px dashed #e2e8f0", borderRadius:10, padding:"10px 14px" }}>
      <span style={{ fontSize:12, color:"#94a3b8", fontWeight:600, whiteSpace:"nowrap" }}>+ Add TC:</span>
      <select value={selected} onChange={e=>setSelected(e.target.value)}
        style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:7, color:"#0f172a", padding:"6px 10px", fontSize:12, flex:1, outline:"none", fontFamily:"inherit" }}>
        <option value="">Select test case…</option>
        {available.map(tc=><option key={tc.id} value={tc.id}>{tc.tcNumber} — {tc.name.slice(0,50)}</option>)}
      </select>
      <button onClick={()=>{ if(selected){ onAdd(Number(selected)); setSelected(""); }}}
        style={{ background:"#6366f1", color:"#fff", border:"none", borderRadius:7, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", opacity:!selected?0.4:1 }}
        disabled={!selected}>Add</button>
    </div>
  );
}


