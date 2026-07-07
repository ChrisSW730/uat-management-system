import { useState } from "react";
import { PRIORITY_META, DEFECT_SOURCES, DEFECT_SEVERITIES } from "../constants";
import Modal from "./ui/Modal";
import "../styles/Defects.css";

// ─── ClickUp placeholder API methods ────────────────────────────────────────
async function loadWorkspaces() {
  // TODO: replace with real ClickUp API call
  return [];
}
async function loadSpaces(_workspaceId) {
  // TODO: replace with real ClickUp API call
  return [];
}
async function loadFolders(_spaceId) {
  // TODO: replace with real ClickUp API call
  return [];
}
async function loadLists(_id, _byFolder = false) {
  // TODO: replace with real ClickUp API call
  // _id = folderId when _byFolder is true, otherwise spaceId
  return [];
}
async function loadTasks(_listId) {
  // TODO: replace with real ClickUp API call
  return [];
}
async function syncToClickUp({ defectId: _defectId, workspaceId: _w, spaceId: _s, folderId: _f, listId: _l, parentTaskId }) {
  // TODO: replace with real ClickUp API call
  // Internally determines Task vs Subtask: parentTaskId present → Subtask, else → Task
  return { taskId: null, parentTask: null, syncType: parentTaskId ? "Subtask" : "Task" };
}

// ─── ClickUpCard component ───────────────────────────────────────────────────
function ClickUpCard({ defectId, projectName, enabled = true }) {
  // ── DISABLED ─────────────────────────────────────────────────────────────
  if (!enabled) {
    return (
      <div className="collab-card collab-card--integration" style={{ opacity: 0.55, pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="collab-card-title" style={{ marginBottom: 0 }}>ClickUp</div>
          <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Disabled</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="integration-field-row">
            <span className="integration-field-label">Status</span>
            <span className="integration-status-badge">Not Linked</span>
          </div>
          <div className="integration-field-row">
            <span className="integration-field-label">Task</span>
            <span className="integration-field-value">None</span>
          </div>
        </div>
        <button type="button" className="integration-primary-btn" disabled style={{ marginTop: 14, opacity: 0.5, cursor: "not-allowed" }}>
          Sync to ClickUp
        </button>
      </div>
    );
 }
  const [phase, setPhase] = useState("idle"); // "idle" | "setup" | "linked"

  const [workspaces, setWorkspaces] = useState([]);
  const [spaces, setSpaces]         = useState([]);
  const [folders, setFolders]       = useState([]);
  const [lists, setLists]           = useState([]);
  const [tasks, setTasks]           = useState([]);

  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [selectedSpace,     setSelectedSpace]     = useState("");
  const [selectedFolder,    setSelectedFolder]    = useState("");
  const [selectedList,      setSelectedList]      = useState("");
  const [selectedTask,      setSelectedTask]      = useState("");

  const [hasFolders,          setHasFolders]          = useState(false);
  const [rememberDestination, setRememberDestination] = useState(true);
  const [loading, setLoading] = useState({
    workspaces: false, spaces: false, folders: false, lists: false, tasks: false, syncing: false,
  });
  const [errorMsg,   setErrorMsg]   = useState("");
  const [syncResult, setSyncResult] = useState(null);

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }));

  const handleOpenSetup = async () => {
    setPhase("setup");
    setLoad("workspaces", true);
    const ws = await loadWorkspaces();
    setWorkspaces(ws);
    setLoad("workspaces", false);
  };

  const handleSelectWorkspace = async (e) => {
    const id = e.target.value;
    setSelectedWorkspace(id);
    setSelectedSpace(""); setSelectedFolder(""); setSelectedList(""); setSelectedTask("");
    setSpaces([]); setFolders([]); setLists([]); setTasks([]);
    setHasFolders(false);
    if (!id) return;
    setLoad("spaces", true);
    const sp = await loadSpaces(id);
    setSpaces(sp);
    setLoad("spaces", false);
  };

  const handleSelectSpace = async (e) => {
    const id = e.target.value;
    setSelectedSpace(id);
    setSelectedFolder(""); setSelectedList(""); setSelectedTask("");
    setFolders([]); setLists([]); setTasks([]);
    setHasFolders(false);
    if (!id) return;
    setLoad("folders", true);
    const fo = await loadFolders(id);
    setLoad("folders", false);
    if (fo.length > 0) {
      setFolders(fo);
      setHasFolders(true);
    } else {
      setLoad("lists", true);
      const li = await loadLists(id, false);
      setLists(li);
      setLoad("lists", false);
    }
  };

  const handleSelectFolder = async (e) => {
    const id = e.target.value;
    setSelectedFolder(id);
    setSelectedList(""); setSelectedTask("");
    setLists([]); setTasks([]);
    if (!id) return;
    setLoad("lists", true);
    const li = await loadLists(id, true);
    setLists(li);
    setLoad("lists", false);
  };

  const handleSelectList = async (e) => {
    const id = e.target.value;
    setSelectedList(id);
    setSelectedTask("");
    setTasks([]);
    if (!id) return;
    setLoad("tasks", true);
    const ta = await loadTasks(id);
    setTasks(ta);
    setLoad("tasks", false);
  };

  const handleSync = async () => {
    setErrorMsg("");
    setLoad("syncing", true);
    try {
      const result = await syncToClickUp({
        defectId,
        workspaceId: selectedWorkspace,
        spaceId:     selectedSpace,
        folderId:    selectedFolder || null,
        listId:      selectedList,
        parentTaskId: selectedTask || null,
      });
      const wsName = workspaces.find(w => w.id === selectedWorkspace)?.name || selectedWorkspace;
      const spName = spaces.find(s => s.id === selectedSpace)?.name       || selectedSpace;
      const foName = folders.find(f => f.id === selectedFolder)?.name     || "";
      const liName = lists.find(l => l.id === selectedList)?.name         || selectedList;
      const taName = tasks.find(t => t.id === selectedTask)?.name         || "";
      setSyncResult({
        syncType:   result.syncType,
        taskId:     result.taskId || "CU-???",
        parentTask: taName || null,
        workspace:  wsName,
        space:      spName,
        folder:     foName,
        list:       liName,
        syncedAt:   new Date(),
      });
      setPhase("linked");
    } catch (err) {
      setErrorMsg(err?.message || "Sync failed. Please try again.");
    } finally {
      setLoad("syncing", false);
    }
  };

  const handleSyncNow = async () => {
    setErrorMsg("");
    setLoad("syncing", true);
    try {
      // TODO: call re-sync API with syncResult.taskId
      setSyncResult(r => r ? { ...r, syncedAt: new Date() } : r);
    } catch (err) {
      setErrorMsg(err?.message || "Sync failed. Please try again.");
    } finally {
      setLoad("syncing", false);
    }
  };

  const formatSyncTime = date => {
    if (!date) return "-";
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleString();
  };

  const isListEnabled = Boolean(selectedSpace && (!hasFolders || selectedFolder));
  const canSync       = Boolean(selectedWorkspace && selectedSpace && selectedList && !loading.syncing);

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="collab-card collab-card--integration">
        <div className="collab-card-title">ClickUp</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="integration-field-row">
            <span className="integration-field-label">Status</span>
            <span className="integration-status-badge">Not Linked</span>
          </div>
          <div className="integration-field-row">
            <span className="integration-field-label">Task</span>
            <span className="integration-field-value">None</span>
          </div>
        </div>
        <button type="button" className="integration-primary-btn" onClick={handleOpenSetup}>
          Sync to ClickUp
        </button>
      </div>
    );
  }

  // ── LINKED ────────────────────────────────────────────────────────────────
  if (phase === "linked" && syncResult) {
    return (
      <div className="collab-card collab-card--integration">
        <div className="collab-card-title">ClickUp</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="integration-field-row">
            <span className="integration-field-label">Status</span>
            <span className="clickup-linked-badge">&#x25CF; Linked</span>
          </div>
          <div className="integration-field-row">
            <span className="integration-field-label">Sync Type</span>
            <span className="integration-field-value">{syncResult.syncType}</span>
          </div>
          <div className="integration-field-row">
            <span className="integration-field-label">Task ID</span>
            <span className="integration-field-value clickup-task-id">{syncResult.taskId}</span>
          </div>
          {syncResult.parentTask && (
            <div className="integration-field-row">
              <span className="integration-field-label">Parent Task</span>
              <span className="integration-field-value clickup-truncate">{syncResult.parentTask}</span>
            </div>
          )}
          <div className="integration-field-row">
            <span className="integration-field-label">Workspace</span>
            <span className="integration-field-value clickup-truncate">{syncResult.workspace}</span>
          </div>
          <div className="integration-field-row">
            <span className="integration-field-label">Space</span>
            <span className="integration-field-value clickup-truncate">{syncResult.space}</span>
          </div>
          {syncResult.folder && (
            <div className="integration-field-row">
              <span className="integration-field-label">Folder</span>
              <span className="integration-field-value clickup-truncate">{syncResult.folder}</span>
            </div>
          )}
          <div className="integration-field-row">
            <span className="integration-field-label">List</span>
            <span className="integration-field-value clickup-truncate">{syncResult.list}</span>
          </div>
          <div className="integration-field-row">
            <span className="integration-field-label">Last Sync</span>
            <span className="integration-field-value">{formatSyncTime(syncResult.syncedAt)}</span>
          </div>
        </div>
        {errorMsg && <div className="clickup-error-msg">{errorMsg}</div>}
        <div className="clickup-btn-row">
          <button
            type="button"
            className="integration-secondary-btn clickup-btn-half"
            onClick={() => { /* TODO: open ClickUp task URL */ }}
          >
            Open in ClickUp
          </button>
          <button
            type="button"
            className="integration-primary-btn clickup-btn-half"
            onClick={handleSyncNow}
            disabled={loading.syncing}
          >
            {loading.syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </div>
    );
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────
  return (
    <div className="collab-card collab-card--integration clickup-setup-card">
      <div className="collab-card-title">ClickUp</div>

      {/* Workspace */}
      <div className="clickup-field-group">
        <label className="clickup-field-label">
          Workspace <span className="clickup-required">*</span>
        </label>
        <div className="clickup-select-wrap">
          <select
            value={selectedWorkspace}
            onChange={handleSelectWorkspace}
            disabled={loading.workspaces}
            className="clickup-select"
          >
            <option value="">{loading.workspaces ? "Loading…" : "Select Workspace"}</option>
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {loading.workspaces && <span className="clickup-spinner" />}
        </div>
      </div>

      {/* Space */}
      <div className="clickup-field-group">
        <label className="clickup-field-label">
          Space <span className="clickup-required">*</span>
        </label>
        <div className="clickup-select-wrap">
          <select
            value={selectedSpace}
            onChange={handleSelectSpace}
            disabled={!selectedWorkspace || loading.spaces}
            className="clickup-select"
          >
            <option value="">{loading.spaces ? "Loading…" : "Select Space"}</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {loading.spaces && <span className="clickup-spinner" />}
        </div>
      </div>

      {/* Folder — only shown when the selected Space contains folders */}
      {hasFolders && (
        <div className="clickup-field-group">
          <label className="clickup-field-label">Folder</label>
          <div className="clickup-select-wrap">
            <select
              value={selectedFolder}
              onChange={handleSelectFolder}
              disabled={loading.folders}
              className="clickup-select"
            >
              <option value="">{loading.folders ? "Loading…" : "Select Folder"}</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {loading.folders && <span className="clickup-spinner" />}
          </div>
        </div>
      )}

      {/* List */}
      <div className="clickup-field-group">
        <label className="clickup-field-label">
          List <span className="clickup-required">*</span>
        </label>
        <div className="clickup-select-wrap">
          <select
            value={selectedList}
            onChange={handleSelectList}
            disabled={!isListEnabled || loading.lists}
            className="clickup-select"
          >
            <option value="">{loading.lists ? "Loading…" : "Select List"}</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {loading.lists && <span className="clickup-spinner" />}
        </div>
      </div>

      {/* Parent Task */}
      <div className="clickup-field-group">
        <label className="clickup-field-label">
          Parent Task <span className="clickup-optional">(Optional)</span>
        </label>
        <div className="clickup-select-wrap">
          <select
            value={selectedTask}
            onChange={e => setSelectedTask(e.target.value)}
            disabled={!selectedList || loading.tasks}
            className="clickup-select"
          >
            <option value="">{loading.tasks ? "Loading…" : "None"}</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {loading.tasks && <span className="clickup-spinner" />}
        </div>
        <div className="clickup-field-hint">
          {selectedTask
            ? "Defect will be created as a Subtask."
            : "Defect will be created as a new Task."}
        </div>
      </div>

      {/* Remember destination */}
      <label className="clickup-remember-label">
        <input
          type="checkbox"
          checked={rememberDestination}
          onChange={e => setRememberDestination(e.target.checked)}
          className="clickup-remember-checkbox"
        />
        <span>
          Remember this ClickUp destination for <strong>{projectName || "this Project"}</strong>
        </span>
      </label>

      {errorMsg && <div className="clickup-error-msg">{errorMsg}</div>}

      <div className="clickup-btn-row">
        <button
          type="button"
          className="integration-secondary-btn clickup-btn-half"
          onClick={() => { setPhase("idle"); setErrorMsg(""); }}
          disabled={loading.syncing}
        >
          Cancel
        </button>
        <button
          type="button"
          className="integration-primary-btn clickup-btn-half"
          onClick={handleSync}
          disabled={!canSync}
        >
          {loading.syncing ? "Syncing…" : "Sync to ClickUp"}
        </button>
      </div>
    </div>
  );
}

export default function DefectModals({
  viewDef,
  setViewDef,
  copyDefectLink,
  btnS,
  xBtn,
  lbl,
  inp,
  projects,
  testPlanMetaById,
  defectAttachments,
  openAttachment,
  canComment,
  defectCommentDrafts,
  setDefectCommentDrafts,
  replyToComment,
  canDelete,
  deleteDefectComment,
  registerMentionInputRef,
  handleMentionInputChange,
  handleMentionKeyDown,
  mentionPicker,
  addDefectComment,
  selectMention,
  btnP,
  editDef,
  setEditDef,
  onDefectPasteUpload,
  runs,
  allTestCaseById,
  assignableUserDisplayNames,
  deleteDefectAttachment,
  queueNewDefectFiles,
  newDefAttachments,
  removeQueuedNewDefectFile,
  saveDefectEdits,
  showAddDef,
  setShowAddDef,
  setNewDefAttachments,
  onNewDefectPasteUpload,
  newDef,
  setNewDef,
  getCurrentUserDisplayName,
  submitDefect,
  clickUpEnabled = true,
}) {
  const marketOptions = ["All", "SG", "HK", "MY", "KR", "US", "ID", "TW"];
  const sourceOptions = DEFECT_SOURCES;
  const severityOptions = DEFECT_SEVERITIES;

  const getProjectName = projectId => {
    const project = (projects || []).find(p => String(p.id) === String(projectId));
    return project?.name || "-";
  };

  const formatBrowserDateTime = value => {
    if (!value) return "-";
    const raw = String(value).trim();
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
    const normalized = hasTimezone ? raw : `${raw}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString();
  };

  const getTestPlanLabel = testPlanId => {
    if (!testPlanId) return "-";
    const meta = testPlanMetaById[testPlanId];
    return meta ? `${meta.projectName} - ${meta.testPlanName}` : `Plan #${testPlanId}`;
  };

  const getRunLabel = defect => defect.runNumber || (defect.testRunId ? `Run #${defect.testRunId}` : "-");
  const getTestCaseLabel = defect => defect.tcNumber || (defect.testCaseId ? `TC #${defect.testCaseId}` : "-");

  const getRunTestCaseOptions = runId => {
    const run = runs.find(r => String(r.id) === String(runId));
    return (run?.entries || [])
      .map(en => allTestCaseById[en.testCaseId])
      .filter(Boolean);
  };

  return (
    <>
      {viewDef && (
        <Modal width={1200} onClose={() => setViewDef(null)}>
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
          <div className="defect-layout">

    <div className="defect-left">
            <div>
              <label style={lbl}>Defect Title</label>
              <input className="defect-textarea"
                value={viewDef.title || ""}
                readOnly
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Project</label>
                <input className="defect-textarea"
                  value={getProjectName(viewDef.projectId)}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Source</label>
                <input className="defect-textarea"
                  value={viewDef.source || "-"}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Severity</label>
                <input className="defect-textarea"
                  value={viewDef.severity || "-"}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Market</label>
                <input className="defect-textarea"
                  value={viewDef.market || ""}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Test Plan</label>
                <input className="defect-textarea"
                  value={getTestPlanLabel(viewDef.testPlanId)}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Test Run</label>
                <input className="defect-textarea"
                  value={getRunLabel(viewDef)}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Test Case</label>
                <input className="defect-textarea"
                  value={getTestCaseLabel(viewDef)}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Issue Type</label>
              <input className="defect-textarea"
                value={viewDef.issueType || ""}
                readOnly
              />
            </div>

            <div>
              <label style={lbl}>Description</label>
              <textarea className="defect-multitextarea"
                value={viewDef.description || ""}
                readOnly
              />
            </div>

            <div>
              <label style={lbl}>Expected Result</label>
              <textarea className="defect-multitextarea"
                value={viewDef.expectedResult || ""}
                readOnly
              />
            </div>

            <div>
              <label style={lbl}>Actual Result</label>
              <textarea className="defect-multitextarea"
                value={viewDef.actualResult || ""}
                readOnly
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Priority</label>
                <input className="defect-textarea"
                  value={viewDef.priority || ""}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Raised By</label>
                <input className="defect-textarea"
                  value={viewDef.raisedBy || ""}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <input className="defect-textarea"
                  value={viewDef.assignedTo || "Unassigned"}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Target Fix Date</label>
                <input className="defect-textarea"
                  type="date"
                  value={viewDef.targetFixDate ? String(viewDef.targetFixDate).slice(0, 10) : ""}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Remarks</label>
              <textarea className="defect-multitextarea"
                value={viewDef.remarks || ""}
                readOnly
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
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {formatBrowserDateTime(a.uploadedAt)}</span>
                  </div>
                ))}
              </div>
            </div>

            
          </div>
          <div className="defect-right">

            {/* Card 1: Comments */}
            <div className="collab-card collab-card--comments">
              <div className="collab-card-title">Comments</div>
              <div className="comment-list">
                {(viewDef.comments || []).length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No comments yet.</div>
                )}
                {[...(viewDef.comments || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => (
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
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: canComment ? "pointer" : "default", flexShrink: 0 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "#475569", fontSize: 12 }}>{c.tester}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatBrowserDateTime(c.createdAt)}</span>
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
              </div>
              {canComment && (
                <div className="comment-input-area">
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                </div>
              )}
            </div>

            {/* Card 2: ClickUp Integration */}
            <ClickUpCard
              defectId={viewDef.id}
              projectName={getProjectName(viewDef.projectId)}
              enabled={clickUpEnabled}
            />

            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => setViewDef(null)} style={btnS}>Close</button>
          </div>
        </Modal>
      )}

      {editDef && (
        <Modal width={1200} onClose={() => setEditDef(null)} onPaste={e => onDefectPasteUpload(e, editDef.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Defect</div>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                {editDef.defectNumber || `#${editDef.id}`}
              </span>
            </div>
            <button onClick={() => setEditDef(null)} style={xBtn}>✕</button>
          </div>
          <div className="defect-layout">
            <div className="defect-left">
              <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={lbl}>Defect Title</label>
              <input
                value={editDef.title || ""}
                onChange={e => setEditDef(p => ({ ...p, title: e.target.value }))}
                placeholder="Short summary of the defect"
                style={inp}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Project *</label>
                <select
                  value={editDef.projectId || ""}
                  onChange={e => {
                    const nextProjectId = e.target.value || "";
                    setEditDef(p => ({
                      ...p,
                      projectId: nextProjectId,
                      testPlanId: p.testPlanId && testPlanMetaById[p.testPlanId]?.projectId === Number(nextProjectId) ? p.testPlanId : null,
                    }));
                  }}
                  style={inp}
                >
                  <option value="">Select project</option>
                  {(projects || []).map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Source *</label>
                <select
                  value={editDef.source || "Exploratory Testing"}
                  onChange={e => setEditDef(p => ({ ...p, source: e.target.value }))}
                  style={inp}
                >
                  {sourceOptions.map(source => <option key={source}>{source}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Severity</label>
                <select
                  value={editDef.severity || "Medium"}
                  onChange={e => setEditDef(p => ({ ...p, severity: e.target.value }))}
                  style={inp}
                >
                  {severityOptions.map(severity => <option key={severity}>{severity}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Market</label>
                <select
                  value={editDef.market || "SG"}
                  onChange={e => setEditDef(p => ({ ...p, market: e.target.value }))}
                  style={inp}
                >
                  {marketOptions.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Test Plan (Optional)</label>
                <select
                  value={editDef.testPlanId ?? ""}
                  onChange={e => setEditDef(p => ({ ...p, testPlanId: e.target.value ? Number(e.target.value) : null }))}
                  style={inp}
                >
                  <option value="">Not linked to test plan</option>
                  {Object.entries(testPlanMetaById)
                    .filter(([, meta]) => !editDef.projectId || String(meta.projectId) === String(editDef.projectId))
                    .sort((a, b) => {
                      const aLabel = `${a[1].projectName} - ${a[1].testPlanName}`;
                      const bLabel = `${b[1].projectName} - ${b[1].testPlanName}`;
                      return aLabel.localeCompare(bLabel);
                    })
                    .map(([id, meta]) => (
                      <option key={id} value={id}>{meta.projectName} - {meta.testPlanName}</option>
                    ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Run</label>
                <select
                  value={editDef.linkedRunId || ""}
                  onChange={e => setEditDef(p => ({ ...p, linkedRunId: e.target.value || "", linkedTestCaseId: "" }))}
                  style={inp}
                >
                  <option value="">Standalone defect</option>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Test Case (Optional)</label>
                <select
                  value={editDef.linkedTestCaseId || ""}
                  onChange={e => {
                    const nextTcId = e.target.value || "";
                    const nextTc = nextTcId ? allTestCaseById[nextTcId] : null;
                    setEditDef(p => ({
                      ...p,
                      linkedTestCaseId: nextTcId,
                      testPlanId: nextTc?.testPlanId ?? (p.testPlanId ?? null),
                    }));
                  }}
                  style={inp}
                >
                  <option value="">No specific test case</option>
                  {getRunTestCaseOptions(editDef.linkedRunId).map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl}>Issue Type</label>
              <select
                value={editDef.issueType || "Functional"}
                onChange={e => setEditDef(p => ({ ...p, issueType: e.target.value }))}
                style={inp}
              >
                {["Functional", "UIUX", "Performance", "Test Data", "Environment", "Configuration", "Data Synchronization", "Compatibility", "Security", "Backend Script/Scheduler", "Enhancement", "Other"].map(t => <option key={t}>{t}</option>)}
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
                  value={editDef.priority}
                  onChange={e => setEditDef(p => ({ ...p, priority: e.target.value }))}
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
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {formatBrowserDateTime(a.uploadedAt)}</span>
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
            </div>
            <div className="defect-right">

              {/* Card 1: Comments */}
              <div className="collab-card collab-card--comments">
                <div className="collab-card-title">Comments</div>
                <div className="comment-list">
                  {(editDef.comments || []).length === 0 && (
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>No comments yet.</div>
                  )}
                  {[...(editDef.comments || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (!canComment) return;
                        const key = `edit-defect-${editDef.id}`;
                        const current = defectCommentDrafts[editDef.id] || "";
                        replyToComment(
                          key,
                          current,
                          next => setDefectCommentDrafts(p => ({ ...p, [editDef.id]: next })),
                          c.tester
                        );
                      }}
                      style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: canComment ? "pointer" : "default", flexShrink: 0 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: "#475569", fontSize: 12 }}>{c.tester}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatBrowserDateTime(c.createdAt)}</span>
                          {canDelete && (
                            <button
                              onClick={e => { e.stopPropagation(); deleteDefectComment(editDef.id, c.id); }}
                              style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}
                            >✕</button>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "#334155" }}>{c.message}</div>
                    </div>
                  ))}
                </div>
                {canComment && (
                  <div className="comment-input-area">
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          placeholder="Add a comment... (use @Display Name to tag)"
                          value={defectCommentDrafts[editDef.id] || ""}
                          ref={node => registerMentionInputRef(`edit-defect-${editDef.id}`, node)}
                          onPaste={e => {
                            const hasImage = Array.from(e.clipboardData?.items || []).some(item => item.type?.startsWith("image/"));
                            if (hasImage) e.preventDefault();
                          }}
                          onChange={e => {
                            const value = e.target.value;
                            handleMentionInputChange(
                              "defect",
                              `edit-defect-${editDef.id}`,
                              value,
                              next => setDefectCommentDrafts(p => ({ ...p, [editDef.id]: next }))
                            );
                          }}
                          onKeyDown={e => {
                            handleMentionKeyDown(
                              e,
                              "defect",
                              `edit-defect-${editDef.id}`,
                              defectCommentDrafts[editDef.id] || "",
                              next => setDefectCommentDrafts(p => ({ ...p, [editDef.id]: next }))
                            );
                            if (e.key === "Enter" && !e.shiftKey && !(mentionPicker?.type === "defect" && mentionPicker?.key === `edit-defect-${editDef.id}` && mentionPicker?.list?.length)) {
                              e.preventDefault();
                              addDefectComment(editDef.id);
                            }
                          }}
                          style={{ ...inp, fontSize: 13, flex: 1 }}
                        />
                        <button
                          onClick={() => addDefectComment(editDef.id)}
                          disabled={!defectCommentDrafts[editDef.id]?.trim()}
                          style={{ ...btnP, opacity: defectCommentDrafts[editDef.id]?.trim() ? 1 : 0.5 }}
                        >Add</button>
                      </div>
                      {mentionPicker?.type === "defect" && mentionPicker?.key === `edit-defect-${editDef.id}` && (
                        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                          {mentionPicker.list.map((u, idx) => (
                            <button
                              key={`edit-defect-mention-${editDef.id}-${u.id}`}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                const current = defectCommentDrafts[editDef.id] || "";
                                selectMention(
                                  "defect",
                                  `edit-defect-${editDef.id}`,
                                  current,
                                  next => setDefectCommentDrafts(p => ({ ...p, [editDef.id]: next })),
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
                )}
              </div>

              {/* Card 2: ClickUp Integration */}
              <ClickUpCard
                defectId={editDef.id}
                projectName={getProjectName(editDef.projectId)}
                enabled={clickUpEnabled}
              />

            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditDef(null); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
            <button
              onClick={saveDefectEdits}
              style={{ ...btnP, opacity: (!editDef?.description || !editDef?.projectId || !editDef?.source) ? 0.5 : 1 }}
              disabled={!editDef?.description || !editDef?.projectId || !editDef?.source}
            >
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {showAddDef && (
        <Modal onClose={() => { setShowAddDef(null); setNewDefAttachments([]); }} onPaste={onNewDefectPasteUpload}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Create Defect</div>
            <button onClick={() => { setShowAddDef(null); setNewDefAttachments([]); }} style={xBtn}>✕</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={lbl}>Defect Title</label>
              <input
                value={newDef.title || ""}
                onChange={e => setNewDef(p => ({ ...p, title: e.target.value }))}
                placeholder="Short summary of the defect"
                style={inp}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Project *</label>
                <select
                  value={showAddDef.projectId || ""}
                  onChange={e => {
                    const nextProjectId = e.target.value || "";
                    setShowAddDef(p => ({
                      ...p,
                      projectId: nextProjectId,
                      testPlanId: p.testPlanId && testPlanMetaById[p.testPlanId]?.projectId === Number(nextProjectId) ? p.testPlanId : "",
                    }));
                    setNewDef(p => ({ ...p, projectId: nextProjectId }));
                  }}
                  style={inp}
                >
                  <option value="">Select project</option>
                  {(projects || []).map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Source *</label>
                <select
                  value={newDef.source || "Exploratory Testing"}
                  onChange={e => setNewDef(p => ({ ...p, source: e.target.value }))}
                  style={inp}
                >
                  {sourceOptions.map(source => <option key={source}>{source}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Severity</label>
                <select
                  value={newDef.severity || "Medium"}
                  onChange={e => setNewDef(p => ({ ...p, severity: e.target.value }))}
                  style={inp}
                >
                  {severityOptions.map(severity => <option key={severity}>{severity}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Market</label>
                <select
                  value={newDef.market || "SG"}
                  onChange={e => setNewDef(p => ({ ...p, market: e.target.value }))}
                  style={inp}
                >
                  {marketOptions.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Test Plan (Optional)</label>
                <select
                  value={showAddDef.testPlanId || ""}
                  onChange={e => setShowAddDef(p => ({ ...p, testPlanId: e.target.value || "" }))}
                  style={inp}
                >
                  <option value="">Not linked to test plan</option>
                  {Object.entries(testPlanMetaById)
                    .filter(([, meta]) => !showAddDef.projectId || String(meta.projectId) === String(showAddDef.projectId))
                    .sort((a, b) => {
                      const aLabel = `${a[1].projectName} - ${a[1].testPlanName}`;
                      const bLabel = `${b[1].projectName} - ${b[1].testPlanName}`;
                      return aLabel.localeCompare(bLabel);
                    })
                    .map(([id, meta]) => (
                      <option key={id} value={id}>{meta.projectName} - {meta.testPlanName}</option>
                    ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Run</label>
                <select
                  value={showAddDef.runId || ""}
                  onChange={e => setShowAddDef(p => ({
                    ...p,
                    runId: e.target.value || null,
                    tcId: null,
                  }))}
                  style={inp}
                >
                  <option value="">Standalone defect</option>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Test Case (Optional)</label>
                <select
                  value={showAddDef.tcId || ""}
                  onChange={e => {
                    const nextTcId = e.target.value || null;
                    const nextTc = nextTcId ? allTestCaseById[nextTcId] : null;
                    setShowAddDef(p => ({
                      ...p,
                      tcId: nextTcId,
                      testPlanId: nextTc?.testPlanId ? String(nextTc.testPlanId) : p.testPlanId,
                    }));
                  }}
                  style={inp}
                >
                  <option value="">No specific test case</option>
                  {getRunTestCaseOptions(showAddDef.runId).map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl}>Issue Type</label>
              <select
                value={newDef.issueType || "Functional"}
                onChange={e => setNewDef(p => ({ ...p, issueType: e.target.value }))}
                style={inp}
              >
                {["Functional", "UIUX", "Performance", "Test Data", "Environment", "Configuration", "Data Synchronization", "Compatibility", "Security", "Backend Script/Scheduler", "Enhancement","Other"].map(t => <option key={t}>{t}</option>)}
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
                  value={newDef.priority}
                  onChange={e => setNewDef(p => ({ ...p, priority: e.target.value }))}
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
            <button
              onClick={submitDefect}
              style={{ ...btnP, opacity: (!newDef.description || !showAddDef.projectId || !newDef.source) ? 0.5 : 1 }}
              disabled={!newDef.description || !showAddDef.projectId || !newDef.source}
            >
              Log Defect
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}