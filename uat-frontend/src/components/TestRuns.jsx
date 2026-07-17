import { Search, X, RotateCcw, CheckCheck, Filter, Download, Plus, Trash2 as Bin } from "lucide-react";
import { EXEC_STATUS } from "../constants";
import "../styles/Projects.css";
import FilterDropdown from "./ui/FilterDropdown";

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
		duplicateTestRun,
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
		contextMenu,
		setContextMenu,
	} = props;

	return (
		<div style={{ padding: "20px 2.5%" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
					<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
						<div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", position: "relative" }}>
						<div className="filter-wrapper">
							<FilterDropdown
								width={220}
								value={runProjectId}
								placeholder="All Projects"
								options={projects.map(project => ({
									value: String(project.id),
									label: project.name,
								}))}
								onChange={value => {
									setRunProjectId(value);
									setRunPlanId("");
								}}
							/>
						</div>
						<div className="filter-wrapper">
							<FilterDropdown
								width={220}
								value={runPlanId}
								placeholder="All Test Plans"
								options={runProjectPlans.map(plan => ({
									value: String(plan.id),
									label: plan.name,
								}))}
								onChange={value => {
									setRunPlanId(value);
								}}
							/>
						</div>
						<button
							onClick={toggleRunDateFilterPanel}
							title="Filter by date"
							style={{
								border: "1px solid #cbd5e1",
								background:
									runDateFilterPanel || runDateRule !== "Any"
										? "#eff6ff"
										: "#fff",
								color:
									runDateFilterPanel || runDateRule !== "Any"
										? "#1d4ed8"
										: "#64748b",
								borderRadius: 12,
								width: 130,
								height: 45,
								cursor: "pointer",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								fontSize: 14,
								fontWeight: 600,
								transition: "all .15s ease",
							}}
						>
							<Filter size={15} />
							Date Filter
						</button>
						</div>
						<button
							onClick={() => {
								setRunSearch("");
								setRunProjectId("");
								setRunPlanId("");
								setRunDateRule("Any");
								setRunDateValue("");
							}}
							className="reset-btn"
						>
							<RotateCcw size={15} />
							Reset
						</button>
						{sortedRuns.length > 0 && (
							<button
								onClick={() => {
									if (selectedRunIds.length === filteredRuns.length) {
										setSelectedRunIds([]);
									} else {
										setSelectedRunIds(filteredRuns.map(r => r.id));
									}
								}}
								className="reset-btn"
							>
								<CheckCheck size={15} />
								{selectedRunIds.length === filteredRuns.length ? "Clear Selection" : "Select All"}
								{selectedRunIds.length > 0 && (
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
										{selectedRunIds.length}
									</span>
								)}
							</button>
						)}
						{selectedRunIds.length > 0 && canDelete && (
							<button
								onClick={() => {
									if (window.confirm(`Delete ${selectedRunIds.length} test run(s)?`)) {
										deleteRuns(selectedRunIds);
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
						)}
					</div>
					<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
					{canWrite && <button className="primary-btn" onClick={() => setShowAddRun(true)}><Plus size={16} /> New Test Run</button>}
					<button className="secondary-btn" onClick={exportRuns} disabled={filteredRuns.length === 0}>
						<Download size={16} />Export
					</button>
				</div>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
					<div className="search-box">
						<Search size={18} />

						<input
							value={runSearch}
							onChange={e => setRunSearch(e.target.value)}
							placeholder="Search runs..."
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
				</div>
			</div>
			{sortedRuns.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#cbd5e1" }}>No test runs yet. Create your first one!</div>}
			{sortedRuns.length > 0 && filteredRuns.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#cbd5e1" }}>No runs match current filters.</div>}
			<div style={{ display: "grid", gap: 14 }}>
				{filteredRuns.map(run => {
					const st = runStats(run);
					const byStatusPriority = runStatusPriorityStats(run);
					const executed = st.pass + st.fail + st.blocked;
					const pct = st.total > 0 ? Math.round((executed / st.total) * 100) : 0;
					const isRunSelected = selectedRunIds.includes(run.id);
					const showRunCheckbox = hoveredRunId === run.id || isRunSelected;
					return (
						<div
							key={run.id}
							style={{ background: "#f0f4f9", border: "1.5px solid #f1f5f9", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", cursor: "pointer", transition: "box-shadow 0.15s" }}
							onMouseEnter={e => {
								e.currentTarget.style.boxShadow =
									"0 20px 40px rgba(99,102,241,.18)";
								e.currentTarget.style.transform =
									"translateY(-6px)";
								e.currentTarget.style.background =
									"#fff";

								setHoveredRunId(run.id);
							}}
							onMouseLeave={e => {
								e.currentTarget.style.boxShadow =
									"0 2px 10px rgba(0,0,0,.05)";
								e.currentTarget.style.transform =
									"translateY(0)";
								e.currentTarget.style.background =
									"#f0f4f9";

								setHoveredRunId(null);
							}}
							onClick={() => setViewRun(run)}
							onContextMenu={e => {
								e.preventDefault();

								setContextMenu({
									type: "run",
									item: run,
									x: e.clientX,
									y: e.clientY
								});
							}}
						>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
								<div>
									<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
										<span
											onClick={e => e.stopPropagation()}
											style={{
												width: 18,
												display: "inline-flex",
												justifyContent: "center",
												opacity: showRunCheckbox ? 1 : 0,
												transform:
													showRunCheckbox
														? "translateX(0)"
														: "translateX(-8px)",
												transition: "all .2s"
											}}
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
											style={{
												...btnS,
												padding: "5px 12px",
												fontSize: 13,

												opacity:
													hoveredRunId === run.id
														? 1
														: .65,

												transform:
													hoveredRunId === run.id
														? "translateX(0)"
														: "translateX(8px)",

												transition: "all .2s"
											}}
										>
											Edit
										</button>
									)}
									<StatChip label="Total" value={st.total} color="#6366f1" bg="#eff6ff" />
									<StatChip label="Passed" value={st.pass} color="#15803d" bg="#f0fdf4" />
									<StatChip label="Failed" value={st.fail} color="#be123c" bg="#fff1f2" />
									<StatChip label="Blocked" value={st.blocked} color="#f97316" bg="#fff2e9" />
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
									<span>Execution Progress</span><span style={{ fontWeight: 700, color: pct === 100 ? "#15803d" : "#64748b" }}>{pct}%</span>
								</div>
								<div
									style={{
										height:
											hoveredRunId === run.id
												? 8
												: 6,

										background: "#f1f5f9",
										borderRadius: 99,
										overflow: "hidden",
										transition: "all .2s"
									}}>
									<div
										style={{
											height: "100%",
											width: `${pct}%`,
											background:
												"linear-gradient(90deg,#6366f1,#3b82f6,#06b6d4,#22c55e)",

											borderRadius: 99,

											boxShadow:
												hoveredRunId === run.id
													? "0 0 14px rgba(99,102,241,.4)"
													: "none",

											transition: "all .25s"
										}} />
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
		<div
			style={{
				background: bg,
				borderRadius: 8,
				padding: "6px 14px",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				minWidth: 64,

				transition: "all .18s",

				cursor: "default"
			}}

			onMouseEnter={e => {
				e.currentTarget.style.transform = "translateY(-3px)";
				e.currentTarget.style.boxShadow = "0 8px 18px rgba(0,0,0,.08)";
			}}

			onMouseLeave={e => {
				e.currentTarget.style.transform = "translateY(0)";
				e.currentTarget.style.boxShadow = "none";
			}}
		>
			<span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
			<span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</span>
		</div>
	);
}
