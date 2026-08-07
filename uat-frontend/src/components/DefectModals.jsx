import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PRIORITY_META, DEFECT_ISSUE_TYPES, DEFECT_SOURCES, DEFECT_SEVERITIES, DEFECT_STATUS, normalizeDefectPriority } from "../constants";
import Modal from "./ui/Modal";
import { DefBadge } from "./ui/Badge";
import {
  fetchDefectClickUpLinks,
  fetchClickUpCustomItems,
  fetchClickUpLists,
  fetchClickUpListTasks,
  fetchClickUpSpaces,
  fetchClickUpWorkspaces,
  getClickUpIntegrationConfig,
  syncDefectToClickUp,
  unlinkDefectFromClickUp,
  unlinkDefectTaskLink,
} from "../services/clickupService";
import "../styles/Defects.css";
import LinkedTestCasesPanel from "./defect/LinkedTestCasesPanel";
import LinkedTestCasesModal from "./defect/LinkedTestCasesModal";

// ─── ClickUpCard component ───────────────────────────────────────────────────
function buildSyncResultFromDefect(defect, integrationConfig = null) {
  if (!defect?.clickUpTaskId) {
    return null;
  }

  return {
    syncType: "Linked Task",
    taskId: defect.clickUpTaskId || "",
    taskUrl: defect.clickUpTaskUrl || null,
    parentTask: defect.clickUpParentTaskName || null,
    workspace: integrationConfig?.workspace?.name || integrationConfig?.workspace?.id || "",
    space: integrationConfig?.space?.name || integrationConfig?.space?.id || "",
    list: defect.clickUpListName || "",
    customItem: defect.clickUpCustomItemName || "",
    syncedAt: defect.clickUpLinkedAt ? new Date(defect.clickUpLinkedAt) : new Date(),
  };
}

function getDefaultClickUpCustomItemId(customItems, configuredCustomItemId) {
  const resolvedCustomItems = Array.isArray(customItems) ? customItems : [];
  const bugItem = resolvedCustomItems.find((item) => String(item?.name || "").trim().toLowerCase() === "bug");
  if (bugItem?.id) {
    return String(bugItem.id);
  }

  if (configuredCustomItemId && resolvedCustomItems.some((item) => String(item.id) === String(configuredCustomItemId))) {
    return String(configuredCustomItemId);
  }

  return String(resolvedCustomItems[0]?.id || "");
}

function ClickUpCard({ defect, enabled = true, onLinkChange, settingsConfig = null, onDefectUpdate = null }) {
  const defectId = defect?.id;
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
  const [phase, setPhase] = useState(defect?.clickUpTaskId ? "linked" : "idle"); // "idle" | "setup" | "linked"
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState("");
  const [availableLists, setAvailableLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [availableCustomItems, setAvailableCustomItems] = useState([]);
  const [selectedCustomItemId, setSelectedCustomItemId] = useState("");
  const [selectedLinkedTaskIds, setSelectedLinkedTaskIds] = useState([]);
  const [linkedTaskDropdownOpen, setLinkedTaskDropdownOpen] = useState(false);
  const [integrationConfig, setIntegrationConfig] = useState(() => settingsConfig || null);
  const [loading, setLoading] = useState({
    config: false, lists: false, customItems: false, tasks: false, syncing: false, linkedTasks: false,
  });
  const [errorMsg,   setErrorMsg]   = useState("");
  const [syncResult, setSyncResult] = useState(() => buildSyncResultFromDefect(defect, integrationConfig));
  const [linkedExpanded, setLinkedExpanded] = useState(false);
  const lastAutoSyncKeyRef = useRef("");
  const lastLoadedTaskListIdRef = useRef("");
  const linkedTaskDropdownRef = useRef(null);

  useEffect(() => {
    if (!settingsConfig) {
      return;
    }

    setIntegrationConfig((current) => ({
      ...(current || {}),
      ...settingsConfig,
      workspace: settingsConfig.workspace ?? current?.workspace ?? null,
      space: settingsConfig.space ?? current?.space ?? null,
      list: settingsConfig.list ?? current?.list ?? null,
      customItem: settingsConfig.customItem ?? current?.customItem ?? null,
    }));
  }, [
    settingsConfig?.workspace?.id,
    settingsConfig?.workspace?.name,
    settingsConfig?.space?.id,
    settingsConfig?.space?.name,
    settingsConfig?.list?.id,
    settingsConfig?.list?.name,
    settingsConfig?.customItem?.id,
    settingsConfig?.customItem?.name,
  ]);

  useEffect(() => {
    if (defect?.clickUpTaskId) {
      setPhase("linked");
      setSyncResult(buildSyncResultFromDefect(defect, integrationConfig));
      setLinkedExpanded(false);
      setSelectedListId(defect.clickUpListId || "");
      setSelectedCustomItemId(defect.clickUpCustomItemId || "");
      setSelectedTask(defect.clickUpParentTaskId || "");
      return;
    }

    setPhase("idle");
    setSyncResult(null);
    setLinkedExpanded(false);
    setSelectedLinkedTaskIds([]);
    setLinkedTaskDropdownOpen(false);
  }, [
    defect?.id,
    defect?.clickUpTaskId,
    defect?.clickUpTaskUrl,
    defect?.clickUpListId,
    defect?.clickUpListName,
    defect?.clickUpParentTaskId,
    defect?.clickUpParentTaskName,
    defect?.clickUpCustomItemId,
    defect?.clickUpCustomItemName,
    defect?.clickUpLinkedAt,
    integrationConfig?.workspace?.name,
    integrationConfig?.workspace?.id,
    integrationConfig?.space?.name,
    integrationConfig?.space?.id,
  ]);

  useEffect(() => {
    setSelectedLinkedTaskIds([]);
    setLinkedTaskDropdownOpen(false);
  }, [defect?.id]);

  useEffect(() => {
    if (!linkedTaskDropdownOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!linkedTaskDropdownRef.current?.contains(event.target)) {
        setLinkedTaskDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [linkedTaskDropdownOpen]);

  useEffect(() => {
    if (!enabled || !defectId || !defect?.clickUpTaskId) {
      return undefined;
    }

    let cancelled = false;

    const loadLinkedTasks = async () => {
      setLoad("linkedTasks", true);
      try {
        const response = await fetchDefectClickUpLinks(defectId);
        if (!cancelled) {
          const linkedTaskIds = Array.isArray(response?.linkedTaskIds) ? response.linkedTaskIds.filter(Boolean) : [];
          setSelectedLinkedTaskIds(linkedTaskIds);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err?.message || "Unable to load linked ClickUp tasks.");
        }
      } finally {
        if (!cancelled) {
          setLoad("linkedTasks", false);
        }
      }
    };

    loadLinkedTasks();

    return () => {
      cancelled = true;
    };
  }, [enabled, defectId, defect?.clickUpTaskId, defect?.clickUpLinkedAt]);

  useEffect(() => {
    if (!defect?.clickUpTaskId || (integrationConfig?.workspace?.id && integrationConfig?.space?.id) || loading.config) {
      return;
    }

    let cancelled = false;

    const loadIntegrationConfig = async () => {
      setLoad("config", true);
      try {
        const cfg = await getClickUpIntegrationConfig();
        let nextCfg = {
          ...(settingsConfig || {}),
          ...(cfg || {}),
          workspace: cfg?.workspace ?? settingsConfig?.workspace ?? null,
          space: cfg?.space ?? settingsConfig?.space ?? null,
          list: cfg?.list ?? settingsConfig?.list ?? null,
          customItem: cfg?.customItem ?? settingsConfig?.customItem ?? null,
        };

        if (cfg?.workspace?.id && !cfg?.workspace?.name) {
          const workspaces = await fetchClickUpWorkspaces();
          const matchedWorkspace = Array.isArray(workspaces)
            ? workspaces.find((item) => String(item.id) === String(cfg.workspace.id))
            : null;

          if (matchedWorkspace) {
            nextCfg = {
              ...nextCfg,
              workspace: {
                id: cfg.workspace.id,
                name: matchedWorkspace.name || cfg.workspace.id,
              },
            };
          }
        }

        if (nextCfg?.workspace?.id && nextCfg?.space?.id && !nextCfg?.space?.name) {
          const spaces = await fetchClickUpSpaces(nextCfg.workspace.id);
          const matchedSpace = Array.isArray(spaces)
            ? spaces.find((item) => String(item.id) === String(nextCfg.space.id))
            : null;

          if (matchedSpace) {
            nextCfg = {
              ...nextCfg,
              space: {
                id: nextCfg.space.id,
                name: matchedSpace.name || nextCfg.space.id,
              },
            };
          }
        }

        if (!cancelled) {
          setIntegrationConfig(nextCfg);
        }
      } catch {
        // Keep the linked card usable even if config hydration fails.
      } finally {
        if (!cancelled) {
          setLoad("config", false);
        }
      }
    };

    loadIntegrationConfig();

    return () => {
      cancelled = true;
    };
  }, [defect?.clickUpTaskId, integrationConfig?.workspace?.id, integrationConfig?.space?.id, loading.config, settingsConfig?.workspace?.id, settingsConfig?.space?.id]);

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }));

  const syncAvailableTasks = async (listId) => {
    if (!listId) {
      setTasks([]);
      lastLoadedTaskListIdRef.current = "";
      return;
    }

    setLoad("tasks", true);
    try {
      const listTasks = await fetchClickUpListTasks(listId);
      setTasks(Array.isArray(listTasks) ? listTasks : []);
      lastLoadedTaskListIdRef.current = listId;
    } catch (err) {
      setErrorMsg(err?.message || "Unable to load ClickUp parent tasks.");
    } finally {
      setLoad("tasks", false);
    }
  };

  const toggleLinkedTaskSelection = (taskId) => {
    if (!taskId) {
      return;
    }

    const currentlySelected = selectedLinkedTaskIds.includes(taskId);
    if (currentlySelected && defect?.clickUpTaskId) {
      const previousSelection = [...selectedLinkedTaskIds];
      setSelectedLinkedTaskIds((current) => current.filter((item) => item !== taskId));
      setLoad("linkedTasks", true);
      setErrorMsg("");

      void (async () => {
        try {
          await unlinkDefectTaskLink(defectId, taskId);
        } catch (err) {
          setSelectedLinkedTaskIds(previousSelection);
          setErrorMsg(err?.message || "Unable to unlink the selected ClickUp task.");
        } finally {
          setLoad("linkedTasks", false);
        }
      })();
      return;
    }

    setSelectedLinkedTaskIds((current) => [...current, taskId]);
  };

  const selectedLinkedTaskNames = tasks
    .filter((task) => selectedLinkedTaskIds.includes(task.id))
    .map((task) => task.name)
    .filter(Boolean);

  const linkedTaskTriggerLabel = (() => {
    if (!selectedListId) {
      return "Select a list first";
    }

    if (loading.tasks) {
      return "Loading tasks...";
    }

    if (loading.linkedTasks) {
      return "Loading linked tasks...";
    }

    if (selectedLinkedTaskNames.length === 0) {
      if (selectedLinkedTaskIds.length > 0) {
        return `${selectedLinkedTaskIds.length} tasks selected`;
      }

      return tasks.length > 0 ? "Choose tasks to link" : "No tasks available";
    }

    if (selectedLinkedTaskNames.length === 1) {
      return selectedLinkedTaskNames[0];
    }

    return `${selectedLinkedTaskNames.length} tasks selected`;
  })();

  const renderLinkedTaskDropdown = () => (
    <div className="clickup-field-group">
      <label className="clickup-field-label">Link To Existing Task <span className="clickup-optional">(Optional)</span></label>
      <div className="clickup-multi-select" ref={linkedTaskDropdownRef}>
        <button
          type="button"
          className="clickup-multi-select-trigger"
          onClick={() => {
            if (!selectedListId || loading.tasks || loading.syncing) {
              return;
            }

            if (loading.linkedTasks) {
              return;
            }

            setLinkedTaskDropdownOpen((current) => !current);
          }}
          disabled={!selectedListId || loading.tasks || loading.syncing || loading.linkedTasks}
          aria-haspopup="listbox"
          aria-expanded={linkedTaskDropdownOpen}
        >
          <span className={`clickup-multi-select-label${selectedLinkedTaskNames.length === 0 ? " clickup-multi-select-label--placeholder" : ""}`}>
            {linkedTaskTriggerLabel}
          </span>
          <span className="clickup-multi-select-icon" aria-hidden="true">
            <ChevronDown size={14} />
          </span>
        </button>
        {linkedTaskDropdownOpen && (
          <div className="clickup-multi-select-menu" role="listbox" aria-multiselectable="true">
            {tasks.length === 0 ? (
              <div className="clickup-multi-select-empty">No tasks available in this list.</div>
            ) : (
              tasks.map((task) => {
                const checked = selectedLinkedTaskIds.includes(task.id);
                return (
                  <label key={task.id} className="clickup-multi-select-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLinkedTaskSelection(task.id)}
                      disabled={loading.linkedTasks}
                    />
                    <span className="clickup-multi-select-option-text">{task.name}</span>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>
      <div className="clickup-field-hint">Choose one or more tasks from the selected list.</div>
    </div>
  );

  const handleOpenSetup = async () => {
    setErrorMsg("");
    setPhase("setup");
    setLoad("config", true);
    setSelectedTask("");
    setTasks([]);
    setAvailableLists([]);
    setAvailableCustomItems([]);
    setSelectedListId("");
    setSelectedCustomItemId("");
    setSelectedLinkedTaskIds([]);
    setLinkedTaskDropdownOpen(false);
    lastLoadedTaskListIdRef.current = "";

    try {
      const serverCfg = await getClickUpIntegrationConfig();
      const cfg = {
        ...(settingsConfig || {}),
        ...(serverCfg || {}),
        workspace: serverCfg?.workspace ?? settingsConfig?.workspace ?? null,
        space: serverCfg?.space ?? settingsConfig?.space ?? null,
        list: serverCfg?.list ?? settingsConfig?.list ?? null,
        customItem: serverCfg?.customItem ?? settingsConfig?.customItem ?? null,
      };
      if (!cfg?.enabled || !cfg?.workspace?.id || !cfg?.space?.id) {
        throw new Error("ClickUp integration is not configured. Please select workspace and space in Settings.");
      }

      setIntegrationConfig(cfg);
      setPhase("setup");

      setLoad("lists", true);
      setLoad("customItems", true);
      const [lists, customItems] = await Promise.all([
        fetchClickUpLists(cfg.workspace.id, cfg.space.id),
        fetchClickUpCustomItems(cfg.workspace.id),
      ]);

      const resolvedLists = Array.isArray(lists) ? lists : [];
      const resolvedCustomItems = Array.isArray(customItems) ? customItems : [];
      setAvailableLists(resolvedLists);
      setAvailableCustomItems(resolvedCustomItems);

      const defaultListId = (cfg?.list?.id && resolvedLists.some((item) => String(item.id) === String(cfg.list.id)))
        ? String(cfg.list.id)
        : String(resolvedLists[0]?.id || "");
      const defaultCustomItemId = getDefaultClickUpCustomItemId(resolvedCustomItems, cfg?.customItem?.id);

      setSelectedListId(defaultListId);
      setSelectedCustomItemId(defaultCustomItemId);

      if (defaultListId) {
        await syncAvailableTasks(defaultListId);
      }
    } catch (err) {
      setErrorMsg(err?.message || "Unable to load ClickUp configuration.");
      setPhase("idle");
    } finally {
      setLoad("config", false);
      setLoad("lists", false);
      setLoad("customItems", false);
      setLoad("tasks", false);
    }
  };

  const handleListChange = async (listId) => {
    setSelectedListId(listId || "");
    setSelectedTask("");
    setSelectedLinkedTaskIds([]);
    setLinkedTaskDropdownOpen(false);
    setTasks([]);
    lastLoadedTaskListIdRef.current = "";
    if (!listId) return;

    await syncAvailableTasks(listId);
  };

  const handleSync = async () => {
    setErrorMsg("");
    setLoad("syncing", true);
    try {
      const result = await syncDefectToClickUp(defectId, {
        listId: selectedListId || null,
        customItemId: selectedCustomItemId || null,
        parentTaskId: selectedTask || null,
        linkedTaskIds: selectedLinkedTaskIds,
      });
      const taName = tasks.find(t => t.id === selectedTask)?.name || "";
      const nextLink = {
        clickUpTaskId: result.taskId || "",
        clickUpTaskUrl: result.taskUrl || "",
        clickUpListId: selectedListId || "",
        clickUpListName: result.listName || availableLists.find((item) => String(item.id) === String(selectedListId))?.name || integrationConfig?.list?.name || "",
        clickUpParentTaskId: selectedTask || "",
        clickUpParentTaskName: taName || "",
        clickUpCustomItemId: selectedCustomItemId || "",
        clickUpCustomItemName: availableCustomItems.find((item) => String(item.id) === String(selectedCustomItemId))?.name || integrationConfig?.customItem?.name || "",
        clickUpLinkedAt: new Date().toISOString(),
      };
      setSyncResult({
        syncType: result?.linkedExisting ? "Linked Existing Task" : (selectedTask ? "Subtask" : "Task"),
        taskId: nextLink.clickUpTaskId,
        taskUrl: nextLink.clickUpTaskUrl || null,
        parentTask: nextLink.clickUpParentTaskName || null,
        workspace: integrationConfig?.workspace?.name || integrationConfig?.workspace?.id || "",
        space: integrationConfig?.space?.name || integrationConfig?.space?.id || "",
        list: nextLink.clickUpListName,
        customItem: nextLink.clickUpCustomItemName,
        syncedAt: new Date(),
      });
      setLinkedExpanded(false);
      onLinkChange?.(nextLink);
      onDefectUpdate?.(defectId, {
        ...nextLink,
        ...(typeof result?.status === "string" ? { status: result.status } : {}),
        ...(typeof result?.assignedTo === "string" ? { assignedTo: result.assignedTo } : {}),
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
      const result = await syncDefectToClickUp(defectId, {
        listId: selectedListId || null,
        customItemId: selectedCustomItemId || null,
        parentTaskId: selectedTask || null,
        linkedTaskIds: selectedLinkedTaskIds,
      });
      const taName = tasks.find(t => t.id === selectedTask)?.name || defect?.clickUpParentTaskName || "";
      const nextLink = {
        clickUpTaskId: result.taskId || defect?.clickUpTaskId || "",
        clickUpTaskUrl: result.taskUrl || defect?.clickUpTaskUrl || "",
        clickUpListId: selectedListId || defect?.clickUpListId || "",
        clickUpListName: result.listName || availableLists.find((item) => String(item.id) === String(selectedListId))?.name || defect?.clickUpListName || "",
        clickUpParentTaskId: selectedTask || defect?.clickUpParentTaskId || "",
        clickUpParentTaskName: taName || "",
        clickUpCustomItemId: selectedCustomItemId || defect?.clickUpCustomItemId || "",
        clickUpCustomItemName: availableCustomItems.find((item) => String(item.id) === String(selectedCustomItemId))?.name || defect?.clickUpCustomItemName || "",
        clickUpLinkedAt: new Date().toISOString(),
      };
      setSyncResult(r => r ? {
        ...r,
        taskId: nextLink.clickUpTaskId,
        taskUrl: nextLink.clickUpTaskUrl || r.taskUrl,
        parentTask: nextLink.clickUpParentTaskName || r.parentTask,
        workspace: integrationConfig?.workspace?.name || integrationConfig?.workspace?.id || r.workspace || "",
        space: integrationConfig?.space?.name || integrationConfig?.space?.id || r.space || "",
        list: nextLink.clickUpListName || r.list,
        customItem: nextLink.clickUpCustomItemName || r.customItem,
        syncType: result?.linkedExisting ? "Linked Existing Task" : r.syncType,
        syncedAt: new Date(),
      } : r);
      onLinkChange?.(nextLink);
      onDefectUpdate?.(defectId, {
        ...nextLink,
        ...(typeof result?.status === "string" ? { status: result.status } : {}),
        ...(typeof result?.assignedTo === "string" ? { assignedTo: result.assignedTo } : {}),
      });
    } catch (err) {
      setErrorMsg(err?.message || "Sync failed. Please try again.");
    } finally {
      setLoad("syncing", false);
    }
  };

  const handleUnlink = async () => {
    setErrorMsg("");
    setLoad("syncing", true);
    try {
      const updatedDefect = await unlinkDefectFromClickUp(defectId);
      onLinkChange?.({
        clickUpTaskId: updatedDefect?.clickUpTaskId || "",
        clickUpTaskUrl: updatedDefect?.clickUpTaskUrl || "",
        clickUpListId: updatedDefect?.clickUpListId || "",
        clickUpListName: updatedDefect?.clickUpListName || "",
        clickUpParentTaskId: updatedDefect?.clickUpParentTaskId || "",
        clickUpParentTaskName: updatedDefect?.clickUpParentTaskName || "",
        clickUpCustomItemId: updatedDefect?.clickUpCustomItemId || "",
        clickUpCustomItemName: updatedDefect?.clickUpCustomItemName || "",
        clickUpLinkedAt: updatedDefect?.clickUpLinkedAt || null,
      });
      setSelectedTask("");
      setSelectedListId("");
      setSelectedCustomItemId("");
      setSyncResult(null);
      setPhase("idle");
    } catch (err) {
      setErrorMsg(err?.message || "Unlink failed. Please try again.");
    } finally {
      setLoad("syncing", false);
    }
  };

  useEffect(() => {
    if (!enabled || !defect?.clickUpTaskId || !defectId) {
      return;
    }

    const autoSyncKey = `${defectId}:${defect.clickUpTaskId}`;
    if (lastAutoSyncKeyRef.current === autoSyncKey) {
      return;
    }

    lastAutoSyncKeyRef.current = autoSyncKey;
    handleSyncNow();
  }, [enabled, defectId, defect?.clickUpTaskId]);

  useEffect(() => {
    if (!enabled || !selectedListId || loading.tasks || lastLoadedTaskListIdRef.current === selectedListId) {
      return;
    }

    void syncAvailableTasks(selectedListId);
  }, [enabled, selectedListId, loading.tasks]);

  const formatSyncTime = (value) => {
    if (!value) return "-";
    const source = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(source.getTime())) return "-";

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(source);
  };

  const canSync = Boolean(!loading.syncing && !loading.config && selectedListId && selectedCustomItemId);

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
        {errorMsg && <div className="clickup-error-msg">{errorMsg}</div>}
        <button type="button" className="integration-primary-btn" onClick={handleOpenSetup} disabled={loading.config}>
          {loading.config ? "Loading…" : "Sync to ClickUp"}
        </button>
      </div>
    );
  }

  // ── LINKED ────────────────────────────────────────────────────────────────
  if (phase === "linked" && syncResult) {
    return (
      <div className="collab-card collab-card--integration">
        <button
          type="button"
          className="clickup-collapse-toggle"
          onClick={() => setLinkedExpanded((current) => !current)}
          aria-expanded={linkedExpanded}
        >
          <div className="clickup-collapse-copy">
            <div className="collab-card-title clickup-collapse-title">
              ClickUp {!linkedExpanded && (
                <span className="clickup-linked-badge">&#x25CF; Linked</span>
              )}
            </div>
          </div>
          <span className="clickup-collapse-icon" aria-hidden="true">
            {linkedExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>
        {errorMsg && <div className="clickup-error-msg">{errorMsg}</div>}
        {linkedExpanded && (
          <>
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
              <div style={{ marginTop: 6 }}>
                {renderLinkedTaskDropdown()}
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
              {syncResult.customItem && (
                <div className="integration-field-row">
                  <span className="integration-field-label">Task Type</span>
                  <span className="integration-field-value clickup-truncate">{syncResult.customItem}</span>
                </div>
              )}
              <div className="integration-field-row">
                <span className="integration-field-label">Last Sync</span>
                <span className="integration-field-value">{formatSyncTime(syncResult.syncedAt)}</span>
              </div>
            </div>
            <div className="clickup-btn-row">
              <button
                type="button"
                className="integration-secondary-btn clickup-btn-half"
                onClick={handleUnlink}
                disabled={loading.syncing}
              >
                Unlink
              </button>
              <button
                type="button"
                className="integration-secondary-btn clickup-btn-half"
                onClick={() => {
                  if (syncResult.taskUrl) {
                    window.open(syncResult.taskUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                disabled={!syncResult.taskUrl}
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
          </>
        )}
      </div>
    );
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────
  return (
    <div className="collab-card collab-card--integration clickup-setup-card">
      <div className="collab-card-title">ClickUp</div>

      <div className="clickup-field-group">
        <label className="clickup-field-label">Workspace</label>
        <div className="integration-field-value clickup-truncate" style={{ marginTop: 6 }}>
          {integrationConfig?.workspace?.name || integrationConfig?.workspace?.id || "-"}
        </div>
      </div>

      <div className="clickup-field-group">
        <label className="clickup-field-label">Space</label>
        <div className="integration-field-value clickup-truncate" style={{ marginTop: 6 }}>
          {integrationConfig?.space?.name || integrationConfig?.space?.id || "-"}
        </div>
      </div>

      <div className="clickup-field-group">
        <label className="clickup-field-label">List</label>
        <div className="clickup-select-wrap">
          <select
            value={selectedListId}
            onChange={e => handleListChange(e.target.value)}
            disabled={loading.lists || loading.syncing}
            className="clickup-select"
          >
            <option value="">{loading.lists ? "Loading…" : "Select list"}</option>
            {availableLists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {loading.lists && <span className="clickup-spinner" />}
        </div>
      </div>

      <div className="clickup-field-group">
        <label className="clickup-field-label">Task Type</label>
        <div className="clickup-select-wrap">
          <select
            value={selectedCustomItemId}
            onChange={e => setSelectedCustomItemId(e.target.value)}
            disabled={loading.customItems || loading.syncing}
            className="clickup-select"
          >
            <option value="">{loading.customItems ? "Loading…" : "Select task type"}</option>
            {availableCustomItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {loading.customItems && <span className="clickup-spinner" />}
        </div>
      </div>

      <div className="clickup-field-group">
        <label className="clickup-field-label">
          Parent Task <span className="clickup-optional">(Optional)</span>
        </label>
        <div className="clickup-select-wrap">
          <select
            value={selectedTask}
            onChange={e => setSelectedTask(e.target.value)}
            disabled={!selectedListId || loading.tasks}
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
        <div className="clickup-field-hint">If a task with the same title already exists in the selected list, PeekQA links to it instead of creating a duplicate.</div>
      </div>

      {renderLinkedTaskDropdown()}

      {errorMsg && <div className="clickup-error-msg">{errorMsg}</div>}

      <div className="clickup-btn-row">
        <button
          type="button"
          className="integration-secondary-btn clickup-btn-half"
          onClick={() => { setPhase("idle"); setErrorMsg(""); }}
          disabled={loading.syncing || loading.config}
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
  clickUpConfig,
  clickUpEnabled = true,
  onClickUpLinkChange,
  onDefectUpdate,
  canAssignDefect = false,
  canUpdateDefectStatus = false,
  updateDefStatus,
  updateDefAssignedTo,
}) {
  const marketOptions = ["Any", "SG", "HK", "MY", "KR", "US", "ID", "TW"];
  const normalizeMarketDisplay = (market) => market === "All" ? "Any" : market;
  const sourceOptions = DEFECT_SOURCES;
  const severityOptions = DEFECT_SEVERITIES;
  const [testCaseSearch, setTestCaseSearch] = useState("");
  const [editLinkedOpen, setEditLinkedOpen] = useState(false);
  const [addLinkedOpen, setAddLinkedOpen] = useState(false);

  useEffect(() => {
    if (!editDef) return;

    const rawLinkedCases = Array.isArray(editDef?.linkedTestCases)
      ? editDef.linkedTestCases
      : (Array.isArray(editDef?.LinkedTestCases) ? editDef.LinkedTestCases : []);

    const hydratedIds = rawLinkedCases
      .map(tc => [tc?.id, tc?.Id, tc?.testCaseId, tc?.TestCaseId, tc?.testCase?.id, tc?.testCase?.Id, tc?.testCase?.testCaseId, tc?.testCase?.TestCaseId]
        .find(v => v !== undefined && v !== null && v !== ""))
      .map(id => String(id))
      .filter(Boolean);

    const nextIds = (Array.isArray(editDef?.linkedTestCaseIds) && editDef.linkedTestCaseIds.length > 0
      ? editDef.linkedTestCaseIds
      : hydratedIds)
      .map(id => String(id))
      .filter(Boolean);

    const currentIds = (editDef?.linkedTestCaseIds || [])
      .map(id => String(id))
      .filter(Boolean);

    if (nextIds.length > 0 && JSON.stringify(currentIds) !== JSON.stringify(nextIds)) {
      setEditDef((current) => current?.id === editDef.id ? { ...current, linkedTestCaseIds: nextIds, linkedTestCaseId: nextIds[0] || "" } : current);
    }
  }, [editDef?.id, editDef?.linkedTestCases, editDef?.LinkedTestCases, editDef?.linkedTestCaseIds, editDef?.linkedTestCaseId]);

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
  const getLinkedTestCaseDisplayItems = defectLike => {
    if (Array.isArray(defectLike?.linkedTestCaseIds)) {
      return defectLike.linkedTestCaseIds.map(id => {
        const tc = allTestCaseById[Number(id)];
        return {
          id: String(id),
          testCaseNumber: tc?.tcNumber ?? tc?.testCaseNumber ?? tc?.tcId ?? `TC #${id}`,
          title: tc?.name ?? tc?.title ?? tc?.testCase?.name ?? tc?.testCase?.title ?? "",
        };
      });
    }

    const rawCases = Array.isArray(defectLike?.linkedTestCases)
      ? defectLike.linkedTestCases
      : (Array.isArray(defectLike?.LinkedTestCases) ? defectLike.LinkedTestCases : []);

    if (rawCases.length > 0) {
      return rawCases.map(tc => ({
        id: [tc?.id, tc?.Id, tc?.testCaseId, tc?.TestCaseId, tc?.testCase?.id, tc?.testCase?.Id, tc?.testCase?.testCaseId, tc?.testCase?.TestCaseId].find(v => v !== undefined && v !== null && v !== ""),
        testCaseNumber: tc?.testCaseNumber ?? tc?.tcNumber ?? tc?.TcNumber ?? tc?.testCase?.tcNumber ?? tc?.testCase?.TcNumber ?? tc?.TestCaseNumber ?? "",
        title: tc?.title ?? tc?.Title ?? tc?.name ?? tc?.Name ?? tc?.testCase?.name ?? tc?.testCase?.Name ?? "",
      }));
    }

    if (defectLike?.linkedTestCaseId || defectLike?.testCaseId || defectLike?.tcId) {
      const id = defectLike?.linkedTestCaseId ?? defectLike?.testCaseId ?? defectLike?.tcId;
      return [{ id: String(id), testCaseNumber: defectLike?.tcNumber || defectLike?.testCaseNumber || "", title: defectLike?.title || "" }];
    }

    return [];
  };

  const getTestCaseLabel = defect => {
    const linkedCases = getLinkedTestCaseDisplayItems(defect);
    if (linkedCases.length > 0) {
      return linkedCases
        .map(tc => tc?.testCaseNumber ? `${tc.testCaseNumber}${tc?.title ? ` - ${tc.title}` : ""}` : tc?.title || (tc?.id ? `TC #${tc.id}` : ""))
        .join(", ");
    }
    return defect.tcNumber || (defect.testCaseId ? `TC #${defect.testCaseId}` : "-");
  };

  const getRunTestCaseOptions = runId => {
    const run = runs.find(r => String(r.id) === String(runId));
    return (run?.entries || [])
      .map(en => allTestCaseById[en.testCaseId])
      .filter(Boolean);
  };

  const getLinkedTestCaseIds = defectLike => {
    if (Array.isArray(defectLike?.linkedTestCaseIds)) {
      return defectLike.linkedTestCaseIds.map(id => String(id)).filter(Boolean);
    }
    const displayItems = getLinkedTestCaseDisplayItems(defectLike);
    if (displayItems.length > 0) {
      return displayItems.map(tc => String(tc?.id)).filter(Boolean);
    }
    if (defectLike?.linkedTestCaseId) {
      return [String(defectLike.linkedTestCaseId)].filter(Boolean);
    }
    if (defectLike?.tcId) {
      return [String(defectLike.tcId)].filter(Boolean);
    }
    return [];
  };

  const getFilteredRunTestCases = runId => {
    const term = (testCaseSearch || "").trim().toLowerCase();
    return getRunTestCaseOptions(runId).filter(tc => {
      if (!term) return true;
      const haystack = `${tc?.tcNumber || ""} ${tc?.name || ""}`.toLowerCase();
      return haystack.includes(term);
    });
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
                <label style={lbl}>Status</label>
                {canUpdateDefectStatus ? (
                  <select
                    value={viewDef.status || "New"}
                    onChange={e => updateDefStatus?.(viewDef.id, e.target.value)}
                    style={inp}
                  >
                    {Object.keys(DEFECT_STATUS).map(s => <option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <DefBadge status={viewDef.status} />
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Market</label>
                <input className="defect-textarea"
                  value={normalizeMarketDisplay(viewDef.market) || ""}
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
                <label style={lbl}>Linked Test Cases</label>
                {getLinkedTestCaseDisplayItems(viewDef).length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>No linked test cases.</div>
                ) : (
                  <div className="linked-test-cases-chip-list" style={{ marginTop: 6 }}>
                    {getLinkedTestCaseDisplayItems(viewDef).map((tc) => {
                      const number = tc.testCaseNumber ?? tc.tcNumber ?? tc.tcId ?? tc.id;
                      const title = tc.title ?? tc.name ?? "Untitled Test Case";
                      return (
                        <span
                          key={tc.id ?? number}
                          className="linked-test-cases-chip"
                          title={title}
                        >
                          <span>{number}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
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
                  value={normalizeDefectPriority(viewDef.priority) || "Medium"}
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
                {canAssignDefect ? (
                  <select
                    value={viewDef.assignedTo || ""}
                    onChange={e => updateDefAssignedTo?.(viewDef, e.target.value)}
                    style={inp}
                  >
                    <option value="">Unassigned</option>
                    {assignableUserDisplayNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                ) : (
                  <input className="defect-textarea"
                    value={viewDef.assignedTo || "Unassigned"}
                    readOnly
                  />
                )}
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
              defect={viewDef}
              enabled={clickUpEnabled}
              settingsConfig={clickUpConfig}
              onLinkChange={(patch) => onClickUpLinkChange?.(viewDef.id, patch)}
              onDefectUpdate={onDefectUpdate}
            />

            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => setViewDef(null)} style={btnS}>Close</button>
          </div>
        </Modal>
      )}

      {editDef && (
        <Modal width={1200} onClose={() => { setEditDef(null); setEditLinkedOpen(false); setTestCaseSearch(""); }} onPaste={e => onDefectPasteUpload(e, editDef.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Defect</div>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                {editDef.defectNumber || `#${editDef.id}`}
              </span>
            </div>
            <button onClick={() => { setEditDef(null); setEditLinkedOpen(false); setTestCaseSearch(""); }} style={xBtn}>✕</button>
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
                <label style={lbl}>Market</label>
                <select
                  value={normalizeMarketDisplay(editDef.market) || "Any"}
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
                  onChange={e => setEditDef(p => ({ ...p, linkedRunId: e.target.value || "", linkedTestCaseIds: [], linkedTestCaseId: "" }))}
                  style={inp}
                >
                  <option value="">Standalone defect</option>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Linked Test Cases</label>
                <div style={{ display: "grid", gap: 8 }}>
                  <LinkedTestCasesPanel
                    linkedTestCases={getLinkedTestCaseDisplayItems(editDef)}
                    onManage={() => setEditLinkedOpen(p => !p)}
                    onRemove={(idToRemove) => {
                      const nextIds = getLinkedTestCaseIds(editDef).filter(id => String(id) !== String(idToRemove));
                      setEditDef(p => ({
                        ...p,
                        linkedTestCaseIds: nextIds,
                        linkedTestCaseId: nextIds[0] || "",
                      }));
                    }}
                  />

                  {editLinkedOpen && (
                    <LinkedTestCasesModal
                      open={editLinkedOpen}
                      searchValue={testCaseSearch}
                      onSearchChange={setTestCaseSearch}
                      onClearSearch={() => setTestCaseSearch("")}
                      testCases={getFilteredRunTestCases(editDef.linkedRunId)}
                      selectedIds={getLinkedTestCaseIds(editDef)}
                      onToggle={(tc, checked) => {
                        const selectedIds = getLinkedTestCaseIds(editDef);
                        const nextIds = selectedIds.filter(id => id !== String(tc.id));
                        const nextValue = checked ? nextIds : [...selectedIds, String(tc.id)];
                        setEditDef(p => ({
                          ...p,
                          linkedTestCaseIds: nextValue,
                          linkedTestCaseId: nextValue[0] || "",
                          testPlanId: tc?.testPlanId ?? p.testPlanId,
                        }));
                      }}
                    />
                  )}

                </div>
              </div>

              <div>
                <label style={lbl}>Issue Type</label>
              <select
                value={editDef.issueType || "Functional"}
                onChange={e => setEditDef(p => ({ ...p, issueType: e.target.value }))}
                style={inp}
              >
                {DEFECT_ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
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
              <label style={lbl}>Expected Result *</label>
              <textarea
                value={editDef.expectedResult || ""}
                onChange={e => setEditDef(p => ({ ...p, expectedResult: e.target.value }))}
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Actual Result *</label>
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
                  value={normalizeDefectPriority(editDef.priority) || "Medium"}
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
                defect={editDef}
                enabled={clickUpEnabled}
                settingsConfig={clickUpConfig}
                onLinkChange={(patch) => onClickUpLinkChange?.(editDef.id, patch)}
                onDefectUpdate={onDefectUpdate}
              />

            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditDef(null); setEditLinkedOpen(false); setTestCaseSearch(""); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
            <button
              onClick={saveDefectEdits}
              style={{ ...btnP, opacity: (!editDef?.projectId || !editDef?.source || !editDef?.expectedResult?.trim() || !editDef?.actualResult?.trim()) ? 0.5 : 1 }}
              disabled={!editDef?.projectId || !editDef?.source || !editDef?.expectedResult?.trim() || !editDef?.actualResult?.trim()}
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
              <label style={lbl}>Defect Title *</label>
              <input
                value={newDef.title || ""}
                onChange={e => setNewDef(p => ({ ...p, title: e.target.value }))}
                placeholder="Short summary of the defect"
                required
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
                  value={normalizeMarketDisplay(newDef.market) || "Any"}
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
                    tcIds: [],
                  }))}
                  style={inp}
                >
                  <option value="">Standalone defect</option>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Linked Test Cases</label>
                <div style={{ display: "grid", gap: 8 }}>
                  <LinkedTestCasesPanel
                    linkedTestCases={Array.isArray(showAddDef.linkedTestCases) && showAddDef.linkedTestCases.length > 0
                      ? getLinkedTestCaseDisplayItems({ linkedTestCases: showAddDef.linkedTestCases })
                      : (Array.isArray(showAddDef.tcIds) ? showAddDef.tcIds.map(id => {
                        const tc = allTestCaseById[Number(id)];
                        return {
                          id: String(id),
                          testCaseNumber: tc?.tcNumber || `TC #${id}`,
                          title: tc?.name || "",
                        };
                      }) : [])}
                    onManage={() => setAddLinkedOpen(p => !p)}
                    onRemove={(idToRemove) => {
                      setShowAddDef(p => {
                        const nextIds = Array.isArray(p.tcIds)
                          ? p.tcIds.filter(id => String(id) !== String(idToRemove))
                          : [];

                        const nextLinkedCases = Array.isArray(p.linkedTestCases)
                          ? p.linkedTestCases.filter(tc => String(tc?.id ?? tc?.testCaseId ?? tc?.Id ?? tc?.TestCaseId) !== String(idToRemove))
                          : p.linkedTestCases;

                        return {
                          ...p,
                          tcIds: nextIds,
                          tcId: nextIds[0] || null,
                          linkedTestCases: nextLinkedCases,
                        };
                      });
                    }}
                  />

                  {addLinkedOpen && (
                    <LinkedTestCasesModal
                      open={addLinkedOpen}
                      searchValue={testCaseSearch}
                      onSearchChange={setTestCaseSearch}
                      onClearSearch={() => setTestCaseSearch("")}
                      testCases={getFilteredRunTestCases(showAddDef.runId)}
                      selectedIds={Array.isArray(showAddDef.tcIds) ? showAddDef.tcIds : []}
                      onToggle={(tc, checked) => {
                        const selectedIds = Array.isArray(showAddDef.tcIds) ? showAddDef.tcIds : [];
                        const nextIds = selectedIds.filter(id => id !== String(tc.id));
                        const nextValue = checked ? nextIds : [...selectedIds, String(tc.id)];
                        setShowAddDef(p => ({
                          ...p,
                          tcIds: nextValue,
                          tcId: nextValue[0] || null,
                          testPlanId: tc?.testPlanId ? String(tc.testPlanId) : p.testPlanId,
                        }));
                      }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label style={lbl}>Issue Type</label>
              <select
                value={newDef.issueType || "Functional"}
                onChange={e => setNewDef(p => ({ ...p, issueType: e.target.value }))}
                style={inp}
              >
                {DEFECT_ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
</div> 
            <div>
              <label style={lbl}>Description</label>
              <textarea
                value={newDef.description || ""}
                onChange={e => setNewDef(p => ({ ...p, description: e.target.value }))}
                style={{ ...inp, minHeight: 80, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Expected Result *</label>
              <textarea
                value={newDef.expected || ""}
                onChange={e => setNewDef(p => ({ ...p, expected: e.target.value }))}
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Actual Result *</label>
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
                  value={normalizeDefectPriority(newDef.priority) || "Medium"}
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
              style={{ ...btnP, opacity: (!showAddDef.projectId || !newDef.title?.trim() || !newDef.source || !newDef.expected?.trim() || !newDef.actual?.trim()) ? 0.5 : 1 }}
              disabled={!showAddDef.projectId || !newDef.title?.trim() || !newDef.source || !newDef.expected?.trim() || !newDef.actual?.trim()}
            >
              Log Defect
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}