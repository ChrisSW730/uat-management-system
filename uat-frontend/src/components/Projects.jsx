import { Bug, Target } from "lucide-react";

export default function Projects(props) {
    const {
        canManageProjects,
        canDelete,

        projects,
        defects,

        selectedProjectId,
        setSelectedProjectId,

        selectedTestPlanId,
        setSelectedTestPlanId,

        selectedProject,
        selectedProjectPlans,

        btnP,
        btnS,
        btnD,

        setShowAddProject,
        setShowAddPlan,

        getTimelineMeta,
        timelineBadgeStyle,
        formatTimeline,

        setEditingProjectId,
        setEditProjectName,
        setEditProjectStartDate,
        setEditProjectEndDate,
        setShowEditProject,

        setEditingPlanId,
        setEditPlanName,
        setEditPlanStartDate,
        setEditPlanEndDate,
        setShowEditPlan,

        deleteProject,
        deleteTestPlan,

        toInputDate,

        setNewTC,
        setActiveTab,

        openManageScopes
    } = props;

    return (
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
                    {selectedProject && (selectedProjectPlans || []).length === 0 && <div style={{ padding: 18, color: "#94a3b8", fontSize: 15 }}>No test plans yet.</div>}
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
    );
}