import { useRef, useState, useEffect } from "react";
import {
  Search,
  X,
  Plus, Download, Upload, Trash2 as Bin, RotateCcw, CheckCheck
} from "lucide-react";
import { TEST_CASE_PRIORITIES } from "../constants";
import { PriBadge } from "./ui/Badge";
import "../styles/Projects.css";
import FilterDropdown from "./ui/FilterDropdown";
import Pagination from "./ui/Pagination";


export default function TestCases(props) {

  const importTestCaseInputRef = useRef(null);

  const {
    tcSearch,
    setTcSearch,

    tcCatFilter,
    setTcCatFilter,

    tcPriFilter,
    setTcPriFilter,

    tcSortCol,
    setTcSortCol,
    tcSortDir,
    setTcSortDir,

    selectedProjectId,
    setSelectedProjectId,
    selectedTestPlanId,
    setSelectedTestPlanId,
    selectedProjectPlans,
    projects,

    filteredTC,
    selectedTcIds,
    setSelectedTcIds,

    sortedFilteredTC,

    runs,

    testPlanMetaById,
    testScopeNameById,

    categories,

    btnD,
    btnP,
    btnS,
    xBtn,

    inp,

    canDelete,
    canWrite,

    handleImportTestCases,
    setShowAddTC,
    deleteTestCases,
    exportTestCases,
    showImportMenu,
    setShowImportMenu,
    downloadTestCaseImportTemplate,
    importingTestCases,

    setViewTC,
    setEditTC,
    setContextMenu,
    setNewTC
  } = props;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const pagedTestCases = sortedFilteredTC.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    tcSearch,
    tcCatFilter,
    tcPriFilter,
    selectedProjectId,
    selectedTestPlanId,
    tcSortCol,
    tcSortDir
  ]);
  return (
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
          <div className="search-box">
            <Search size={18} />

            <input
              placeholder="Search ID or name..."
              value={tcSearch}
              onChange={e => setTcSearch(e.target.value)}

            />

            {tcSearch && (
              <button
                onClick={() => setTcSearch("")}
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
              width={220}
              value={tcCatFilter}
              onChange={value => setTcCatFilter(value)}
              placeholder="All Categories"
              options={[
                { value: "All", label: "All Categories" },
                ...categories.map(c => ({
                  value: c,
                  label: c,
                })),
              ]}
            />
          </div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={150}
              value={tcPriFilter}
              onChange={value => setTcPriFilter(value)}
              placeholder="All Priorities"
              options={[
                { value: "All", label: "All Priorities" },
                ...TEST_CASE_PRIORITIES.map(p => ({
                  value: p,
                  label: p,
                })),
              ]}
            />
          </div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={190}
              value={selectedProjectId}
              placeholder="Select Project"
              options={projects.map(p => ({
                value: String(p.id),
                label: p.name,
              }))}
              onChange={pid => {
                setSelectedProjectId(pid);

                const project = projects.find(
                  x => String(x.id) === String(pid)
                );

                const firstPlan = (project?.testPlans || [])[0];

                setSelectedTestPlanId(
                  firstPlan ? String(firstPlan.id) : ""
                );

                setNewTC(prev => ({
                  ...prev,
                  testScopeId: "",
                }));
              }}
            />
          </div>
          <div className="filter-wrapper">
            <FilterDropdown
              width={450}
              value={selectedTestPlanId}
              placeholder="Select Test Plan"
              options={selectedProjectPlans.map(tp => ({
                value: String(tp.id),
                label: tp.name,
              }))}
              onChange={value => {
                setSelectedTestPlanId(value);

                setNewTC(prev => ({
                  ...prev,
                  testScopeId: "",
                }));
              }}
            />
          </div>

          <button
            onClick={() => {
              setTcSearch("");
              setTcCatFilter("All");
              setTcPriFilter("All");
              setSelectedProjectId("");
              setSelectedTestPlanId("");
            }}
            className="reset-btn"
          >
            <RotateCcw size={15} />
            Reset
          </button>
          {filteredTC.length > 0 && (
            <button
              onClick={() => {
                const pageIds = pagedTestCases.map(tc => tc.id);

                const allSelected = pageIds.every(id =>
                  selectedTcIds.includes(id)
                );

                if (allSelected) {
                  // Unselect only current page
                  setSelectedTcIds(prev =>
                    prev.filter(id => !pageIds.includes(id))
                  );
                } else {
                  // Select only current page
                  setSelectedTcIds(prev => [
                    ...new Set([
                      ...prev,
                      ...pageIds
                    ])
                  ]);
                }
              }}
              className="reset-btn">
              <CheckCheck size={15} />
              {pagedTestCases.every(tc => selectedTcIds.includes(tc.id))
                ? "Clear Selection"
                : "Select All"}
              {selectedTcIds.length > 0 && (
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
                  {selectedTcIds.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
            {canWrite && <button onClick={() => setShowAddTC(true)} className="primary-btn"><Plus size={16} />Add Test Case</button>}
            {selectedTcIds.length > 0 && canDelete && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedTcIds.length} test case(s)?`)) {
                      deleteTestCases(selectedTcIds);
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }} onClick={e => e.stopPropagation()}>
            <button className="primary-btn" onClick={exportTestCases} disabled={sortedFilteredTC.length === 0}><Download size={16} />Export</button>
            {canWrite && (
              <>
                <button
                  className="secondary-btn"
                  onClick={() => setShowImportMenu(v => !v)}
                >
                  <Upload size={16} />
                  <span>Import</span>
                  <span style={{ fontSize: 12 }}>▾</span>
                </button>
                {showImportMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 190, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 12px 28px rgba(15,23,42,0.15)", zIndex: 20, padding: 8 }}>
                    <button
                      className="dropdown-menu-item"
                      onClick={() => {
                        setShowImportMenu(false);
                        downloadTestCaseImportTemplate();
                      }}

                    >
                      Download Template
                    </button>
                    <button
                      className="dropdown-menu-item"
                      onClick={() => {
                        setShowImportMenu(false);
                        importTestCaseInputRef.current?.click();
                      }}

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

      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#e2ebf3", borderBottom: "2px solid #f1f5f9" }}>
              <th style={{ padding: "12px 16px", width: 40 }}>
                <input type="checkbox"
                  checked={
                    pagedTestCases.length > 0 &&
                    pagedTestCases.every(tc => selectedTcIds.includes(tc.id))
                  }
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedTcIds(prev => [
                        ...new Set([
                          ...prev,
                          ...pagedTestCases.map(tc => tc.id)
                        ])
                      ]);
                    } else {
                      setSelectedTcIds(prev =>
                        prev.filter(id =>
                          !pagedTestCases.some(tc => tc.id === id)
                        )
                      );
                    }
                  }}
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
            {pagedTestCases.map((tc, i) => {
              const rowIndex = (currentPage - 1) * pageSize + i;
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
                  style={{ borderBottom: "1px solid #f8fafc", background: isSelected ? "#eff6ff" : rowIndex % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f0f4ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#eff6ff" : rowIndex % 2 === 0 ? "#fff" : "#fafafa"; }}>
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
        <Pagination
          totalItems={sortedFilteredTC.length}
          currentPage={currentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          setPageSize={setPageSize}
        />
      </div>
    </div>
  );
}