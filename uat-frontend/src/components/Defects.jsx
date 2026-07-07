import { useState, useEffect } from "react";
import { Search, X, Download, RotateCcw, CheckCheck, Plus, Trash2 as Bin, ArrowUp, ArrowDown, ArrowUpDown, Funnel } from "lucide-react";
import { DEFECT_STATUS, PRIORITY_META } from "../constants";
import { PriBadge } from "./ui/Badge";
import "../styles/Projects.css";
import FilterDropdown from "./ui/FilterDropdown";
import Pagination from "./ui/Pagination";

export default function Defects({
  defSearch,
  setDefSearch,
  inp,
  defStatusFilter,
  setDefStatusFilter,
  defPriFilter,
  setDefPriFilter,
  defMarketFilter,
  setDefMarketFilter,
  defPlanFilter,
  setDefPlanFilter,
  defects,
  projects,
  setDefOpenRule,
  setDefOpenDate,
  setDefCloseRule,
  setDefCloseDate,
  filteredDefects,
  selectedDefectIds,
  setSelectedDefectIds,
  canWrite,
  createStandaloneDefect,
  canDelete,
  deleteDefects,
  btnP,
  btnD,
  btnS,
  exportDefects,
  sortedFilteredDefects,
  defSortCol,
  setDefSortCol,
  defSortDir,
  setDefSortDir,
  toggleDefDateFilterPanel,
  defDateFilterPanel,
  agedDays,
  setContextMenu,
  setViewDef,
  setEditDef,
  runs,
  allTestCases,
  xBtn,
  updateDefAssignedTo,
  canAssignDefect,
  assignableUserDisplayNames,
  updateDefStatus,
  canUpdateDefectStatus,
  updateDefPriority,
  canUpdateDefectPriority,
}) {
  const DEF_MARKET_FILTER_ANY = "__ANY_MARKET__";

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const pagedDefects = sortedFilteredDefects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    defSearch,
    defStatusFilter,
    defPriFilter,
    defMarketFilter,
    defPlanFilter,
    defSortCol,
    defSortDir
  ]);

  const renderSortIcon = col => {
    if (defSortCol === col) {
      return defSortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
    }
    return <ArrowUpDown size={13} />;
  };

  const formatBrowserDateTime = value => {
    if (!value) return "-";

    const raw = String(value).trim();
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
    const normalized = hasTimezone ? raw : `${raw}Z`;
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    return parsed.toLocaleString();
  };

  return (
    <div style={{ padding: "20px 2.5%" }}>
      <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Search defect / run / TC / assignee..."
              value={defSearch}
              onChange={e => setDefSearch(e.target.value)}

            />

            {defSearch && (
              <button
                onClick={() => setDefSearch("")}
                title="Clear search"
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  color: "#94a3b8",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={180}
              value={defStatusFilter}
              placeholder="All"
              options={[
                { value: "All", label: "All Status" },
                ...Object.keys(DEFECT_STATUS).map(s => ({
                  value: s,
                  label: s,
                })),
              ]}
              onChange={value => setDefStatusFilter(value)}
            />
          </div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={150}
              value={defPriFilter}
              placeholder="All"
              options={[
                { value: "All", label: "All Priority" },
                ...Object.keys(PRIORITY_META).map(p => ({
                  value: p,
                  label: p,
                })),
              ]}
              onChange={value => setDefPriFilter(value)}
            /></div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={120}
              value={defMarketFilter}
              placeholder="All"
              options={[
                { value: DEF_MARKET_FILTER_ANY, label: "Any Market" },
                ...Array.from(
                  new Set(
                    defects
                      .map(d => d.market)
                      .filter(Boolean)
                  )
                )
                  .sort()
                  .map(m => ({
                    value: m,
                    label: m,
                  })),
              ]}
              onChange={value => setDefMarketFilter(value)}
            /></div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={450}
              value={defPlanFilter}
              placeholder="All Test Plans"
              options={[
                {
                  value: "All",
                  label: "All Test Plans",
                },
                ...projects.flatMap(p =>
                  (p.testPlans || []).map(tp => ({
                    value: String(tp.id),
                    label: `${p.name} - ${tp.name}`,
                  }))
                ),
              ]}
              onChange={value => setDefPlanFilter(value)}
            /></div>

          <button
            onClick={() => {
              setDefSearch("");
              setDefStatusFilter("All");
              setDefPriFilter("All");
              setDefMarketFilter(DEF_MARKET_FILTER_ANY);
              setDefPlanFilter("All");
              setDefOpenRule("Any");
              setDefOpenDate("");
              setDefCloseRule("Any");
              setDefCloseDate("");
            }}
            className="reset-btn"
          >
            <RotateCcw size={15} />
            Reset
          </button>
          {filteredDefects.length > 0 && (
            <button
              onClick={() => {
                const pageIds = pagedDefects.map(def => def.id);

                const allSelected = pageIds.every(id =>
                  selectedDefectIds.includes(id)
                );

                if (allSelected) {
                  setSelectedDefectIds(prev =>
                    prev.filter(id => !pageIds.includes(id))
                  );
                } else {
                  setSelectedDefectIds(prev => [
                    ...new Set([
                      ...prev,
                      ...pageIds
                    ])
                  ]);
                }
              }}
              className="reset-btn"
            >
              <CheckCheck size={15} />
              {pagedDefects.every(def => selectedDefectIds.includes(def.id))
                ? "Clear Selection"
                : "Select All"}
              {selectedDefectIds.length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#eef2ff",
                    color: "#4f46e5",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {selectedDefectIds.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
            {selectedDefectIds.length > 0 && canDelete && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedDefectIds.length} defect(s)?`)) {
                      deleteDefects(selectedDefectIds);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#fff1f2",
                    color: "#be123c",
                    border: "1.5px solid #fecdd3",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all .15s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#ffe4e6";
                    e.currentTarget.style.borderColor = "#fb7185";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "#fff1f2";
                    e.currentTarget.style.borderColor = "#fecdd3";
                  }}
                >
                  <Bin size={16} /> Delete Selected
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canWrite && <button className="primary-btn" onClick={createStandaloneDefect}><Plus size={16} /> Add Defect</button>}
            <button className="secondary-btn" onClick={exportDefects} disabled={sortedFilteredDefects.length === 0}><Download size={16} /> Export</button>
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
                  checked={
                    pagedDefects.length > 0 &&
                    pagedDefects.every(def => selectedDefectIds.includes(def.id))
                  }
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedDefectIds(prev => [
                        ...new Set([
                          ...prev,
                          ...pagedDefects.map(def => def.id)
                        ])
                      ]);
                    } else {
                      setSelectedDefectIds(prev =>
                        prev.filter(id =>
                          !pagedDefects.some(def => def.id === id)
                        )
                      );
                    }
                  }}
                  style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#6366f1" }}
                />
              </th>
              {[{ label: "Actions", col: "" }, { label: "ID", col: "defectNumber" }, { label: "Market", col: "market" }, { label: "Defect Title", col: "title" }, { label: "Priority", col: "priority" }, { label: "Raised By", col: "raisedBy" }, { label: "Assigned To", col: "assignedTo" }, { label: "Status", col: "status" }].map(({ label, col }) => (
                <th key={label} onClick={col ? () => { if (defSortCol === col) setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol(col); setDefSortDir("asc"); } } : undefined}
                  style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: col ? "pointer" : "default", userSelect: "none", background: col && defSortCol === col ? "#d4dff0" : undefined }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {label}
                    {col ? renderSortIcon(col) : null}
                  </span>
                </th>
              ))}
              <th
                onClick={() => { if (defSortCol === "openDateTime") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("openDateTime"); setDefSortDir("asc"); } }}
                style={{ padding: "8px 12px", textAlign: "left", color: "#1f252e", whiteSpace: "nowrap", position: "relative", zIndex: 5, cursor: "pointer", userSelect: "none", background: defSortCol === "openDateTime" ? "#d4dff0" : undefined }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>
                    Open Datetime
                    {renderSortIcon("openDateTime")}
                  </span>
                  <button
                    onClick={e => toggleDefDateFilterPanel(e, "open")}
                    title="Filter open datetime"
                    style={{ border: "1px solid #cbd5e1", background: defDateFilterPanel?.type === "open" ? "#eff6ff" : "#fff", color: defDateFilterPanel?.type === "open" ? "#1d4ed8" : "#64748b", borderRadius: 6, width: 22, height: 22, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    <Funnel size={12} />
                  </button>
                </div>
              </th>
              <th
                onClick={() => { if (defSortCol === "closeDateTime") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("closeDateTime"); setDefSortDir("asc"); } }}
                style={{ padding: "8px 12px", textAlign: "left", color: "#1f252e", whiteSpace: "nowrap", position: "relative", zIndex: 5, cursor: "pointer", userSelect: "none", background: defSortCol === "closeDateTime" ? "#d4dff0" : undefined }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>
                    Close Datetime
                    {renderSortIcon("closeDateTime")}
                  </span>
                  <button
                    onClick={e => toggleDefDateFilterPanel(e, "close")}
                    title="Filter close datetime"
                    style={{ border: "1px solid #cbd5e1", background: defDateFilterPanel?.type === "close" ? "#eff6ff" : "#fff", color: defDateFilterPanel?.type === "close" ? "#1d4ed8" : "#64748b", borderRadius: 6, width: 22, height: 22, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    <Funnel size={12} />
                  </button>
                </div>
              </th>
              <th
                onClick={() => { if (defSortCol === "aged") setDefSortDir(d => d === "asc" ? "desc" : "asc"); else { setDefSortCol("aged"); setDefSortDir("asc"); } }}
                style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: defSortCol === "aged" ? "#d4dff0" : undefined }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Aged
                  {renderSortIcon("aged")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {defects.length === 0 && <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No defects logged</td></tr>}
            {defects.length > 0 && filteredDefects.length === 0 && <tr><td colSpan={11} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No defects match current filters</td></tr>}
            {pagedDefects.map((def, i) => {

              const rowIndex = (currentPage - 1) * pageSize + i;
              const aged = agedDays(def.dateRaised);
              const isSelected = selectedDefectIds.includes(def.id);
              return (
                <tr key={def.id}
                  onContextMenu={e => { if (canWrite) { e.preventDefault(); setContextMenu({ type: "defect", item: def, x: e.clientX, y: e.clientY }); } }}
                  style={{ borderBottom: "1px solid #f8fafc", background: isSelected ? "#eff6ff" : rowIndex % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f0f4ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#eff6ff" : rowIndex % 2 === 0 ? "#fff" : "#fafafa"; }}>
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
                      <button className="primary-action-btn" onClick={() => setViewDef(def)}>View</button>
                      {canWrite && <button className="secondary-action-btn"
                        onClick={() => setEditDef({
                          ...def,
                          dateRaised: def.dateRaised ? String(def.dateRaised).slice(0, 10) : "",
                          targetFixDate: def.targetFixDate ? String(def.targetFixDate).slice(0, 10) : "",
                          linkedRunId: def.testRunId
                            ? String(def.testRunId)
                            : (def.testRunEntry?.testRunId
                              ? String(def.testRunEntry.testRunId)
                              : (def.testRunEntryId
                                ? String(runs.find(r => (r.entries || []).some(en => String(en.id) === String(def.testRunEntryId)))?.id || "")
                                : String(runs.find(r => r.runNumber === def.runNumber)?.id || ""))),
                          linkedTestCaseId: def.testCaseId
                            ? String(def.testCaseId)
                            : (def.testRunEntry?.testCaseId
                              ? String(def.testRunEntry.testCaseId)
                              : (def.testRunEntryId
                                ? String(runs
                                  .flatMap(r => r.entries || [])
                                  .find(en => String(en.id) === String(def.testRunEntryId))?.testCaseId || "")
                                : String(allTestCases.find(t => t.tcNumber === def.tcNumber)?.id || ""))),
                          projectId: def.projectId ? String(def.projectId) : "",
                          source: def.source || "Exploratory Testing",
                          severity: def.severity || "Medium",
                        })}
                        
                      >
                        Edit
                      </button>}
                      {canDelete && <button className="third-action-btn"
                        onClick={() => {
                          if (window.confirm(`Delete ${def.defectNumber}?`)) {
                            deleteDefects([def.id]);
                          }
                        }}
                        title="Delete"
                      >
                        <Bin size={15} />
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
                      {def.title}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                    {canUpdateDefectPriority ? (
                      <select
                        value={def.priority || ""}
                        onChange={e => {
                          e.stopPropagation();
                          updateDefPriority(def.id, e.target.value);
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          ...inp,
                          minWidth: 120,
                          fontSize: 13,
                          padding: "6px 8px",

                          background: PRIORITY_META[def.priority]?.bg || inp.background,
                          color: PRIORITY_META[def.priority]?.text || inp.color,
                          border: `1.5px solid ${PRIORITY_META[def.priority]?.border || "#e2e8f0"
                            }`,
                          fontWeight: 700,
                        }}
                      >
                        {Object.keys(PRIORITY_META).map(priority => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div onClick={() => setViewDef(def)}><PriBadge label={def.priority} /></div>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px", color: "#64748b", fontSize: 14 }} onClick={() => setViewDef(def)}>
                    {def.raisedBy || "-"}</td>
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
                    {formatBrowserDateTime(def.openDateTime)}
                  </td>
                  <td style={{ padding: "13px 16px", color: "#64748b", fontSize: 13 }} onClick={() => setViewDef(def)}>
                    {formatBrowserDateTime(def.closeDateTime)}
                  </td>
                  <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }} onClick={() => setViewDef(def)}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: aged > 7 ? "#ef4444" : aged > 3 ? "#f97316" : "#22c55e" }}>{aged}d</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          totalItems={sortedFilteredDefects.length}
          currentPage={currentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          setPageSize={setPageSize}
        />
      </div>
    </div>
  );
}

