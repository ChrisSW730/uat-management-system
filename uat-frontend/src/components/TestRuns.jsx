import { Search, X } from "lucide-react";
import { EXEC_STATUS } from "../constants";

export default function TestRuns(props) {
	const {
		runSearch,
		setRunSearch,
		runDateRule,
		setRunDateRule,
		runDateValue,
		setRunDateValue,
		runDateFilterPanel,
		toggleRunDateFilterPanel,
		sortedRuns,
		filteredRuns,
		selectedRunIds,
		setSelectedRunIds,
		canDelete,
		canWrite,
		deleteRuns,
		exportRuns,
		setShowAddRun,
		runStats,
		runStatusPriorityStats,
		hoveredRunId,
		setHoveredRunId,
		setViewRun,
		setEditRun,
		setEditRunTesterSearch,
		btnS,
		btnD,
		btnP,
		projects,
		runProjectId,
		setRunProjectId,
		runPlanId,
		setRunPlanId,
		runProjectPlans,
		runFilteredTestCases,
	} = props;

	return (
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
							padding: "8px 36px 8px 38px",
							fontSize: 14,
							color: "#0f172a",
							outline: "none",
							boxSizing: "border-box",
						}}
					/>

					{runSearch && (
						<button
							onClick={() => setRunSearch("")}
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
				<div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", position: "relative" }}>
					<select
						value={runProjectId}
						onChange={e => { setRunProjectId(e.target.value); setRunPlanId(""); }}
						style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#0f172a", padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", maxWidth: 220, height: 38 }}
					>
						<option value="">All Projects</option>
						{projects.map(project => (
							<option key={project.id} value={project.id}>{project.name}</option>
						))}
					</select>
					<select
						value={runPlanId}
						onChange={e => setRunPlanId(e.target.value)}
						style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#0f172a", padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", maxWidth: 220, height: 38 }}
					>
						<option value="">All Test Plans</option>
						{runProjectPlans.map(plan => (
							<option key={plan.id} value={plan.id}>{plan.name}</option>
						))}
					</select>
					<span style={{ fontSize: 13, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>Date</span>
					<button
						onClick={toggleRunDateFilterPanel}
						title="Filter by date"
						style={{ border: "1px solid #cbd5e1", background: runDateFilterPanel || runDateRule !== "Any" ? "#eff6ff" : "#fff", color: runDateFilterPanel || runDateRule !== "Any" ? "#1d4ed8" : "#64748b", borderRadius: 6, width: 26, height: 26, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
					>
						⏷
					</button>
					{runDateRule !== "Any" && runDateValue && (
						<button
							onClick={() => {
								setRunDateRule("Any");
								setRunDateValue("");
							}}
							style={{ border: "1px solid #fca5a5", background: "#fff1f2", color: "#dc2626", borderRadius: 6, width: 22, height: 22, fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, fontWeight: 700 }}
						>
							✕
						</button>
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
						<div
							key={run.id}
							style={{ background: "#f0f4f9", border: "1.5px solid #f1f5f9", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", cursor: "pointer", transition: "box-shadow 0.15s" }}
							onMouseEnter={e => {
								e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.1)";
								setHoveredRunId(run.id);
							}}
							onMouseLeave={e => {
								e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.05)";
								setHoveredRunId(null);
							}}
							onClick={() => setViewRun(run)}
						>
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
	);
}

function StatChip({ label, value, color, bg }) {
	return (
		<div style={{ background: bg, borderRadius: 8, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 64 }}>
			<span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
			<span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</span>
		</div>
	);
}
