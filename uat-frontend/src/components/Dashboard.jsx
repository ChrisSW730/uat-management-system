import {
    Files,
    CheckCircle2,
    XCircle,
    Ban,
    Activity
} from "lucide-react";
import {
    EXEC_STATUS,
    DEFECT_STATUS,
    PRIORITY_META
} from "../constants";
import html2canvas from "html2canvas";

export default function Dashboard({
    dashboardStats,
    projects,
    dashProjectId,
    setDashProjectId,
    dashPlanId,
    setDashPlanId,
    dashRunId,
    setDashRunId,
    dashboardRef,
    inp
}) {
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
    const buildNiceAxis = (maxValue, targetTickCount = 5) => {
        const safeMax = Math.max(Number(maxValue) || 0, 1);
        const rawStep = safeMax / Math.max(1, targetTickCount - 1);
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
        const normalized = rawStep / magnitude;
        const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
        const step = niceNormalized * magnitude;
        const maxScale = Math.ceil(safeMax / step) * step;

        const ticks = [];
        for (let v = 0; v <= maxScale + step / 2; v += step) {
            ticks.push(Number(v.toFixed(6)));
        }

        return {
            maxScale,
            ticks,
        };
    };

    const formatAxisTick = (value) => {
        if (Number.isInteger(value)) return String(value);
        if (Math.abs(value) < 1) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
        return value.toFixed(1).replace(/\.0$/, "");
    };

    const BarChart = ({ data, height = 170 }) => {
        if (!data || data.length === 0) return null;
        const barW = 22, gapW = 10;
        const totalW = data.length * (barW + gapW) - gapW;
        const chartH = height;
        const maxVal = Math.max(...data.map(d => d.passed + d.failed + d.blocked), 1);
        const { maxScale, ticks } = buildNiceAxis(maxVal);
        const yLabels = [...ticks].reverse();
        return (
            <div>
                <div style={{ display: "flex", gap: 4 }}>
                    {/* Y-axis labels */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: chartH, flexShrink: 0 }}>
                        {yLabels.map((v, i) => (
                            <span key={i} style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1, textAlign: "right", minWidth: 24 }}>{formatAxisTick(v)}</span>
                        ))}
                    </div>
                    <div style={{ flex: 1, position: "relative" }}>
                        <svg width="100%" height={chartH} viewBox={`0 0 ${totalW} ${chartH}`} preserveAspectRatio="none">
                            {ticks.slice(1).map(v => (
                                <line key={v} x1={0} y1={chartH - (v / maxScale) * chartH} x2={totalW} y2={chartH - (v / maxScale) * chartH} stroke="#f1f5f9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                            ))}
                            {data.map((d, i) => {
                                const x = i * (barW + gapW);
                                const pH = (d.passed / maxScale) * chartH;
                                const fH = (d.failed / maxScale) * chartH;
                                const bH = (d.blocked / maxScale) * chartH;
                                return (
                                    <g key={i}>
                                        <title>{`${d.label} • Passed: ${d.passed} • Failed: ${d.failed} • Blocked: ${d.blocked}`}</title>
                                        {pH > 0 && <rect x={x} y={chartH - pH - fH - bH} width={barW} height={pH} fill="#22c55e" rx={2} />}
                                        {fH > 0 && <rect x={x} y={chartH - fH - bH} width={barW} height={fH} fill="#f43f5e" />}
                                        {bH > 0 && <rect x={x} y={chartH - bH} width={barW} height={bH} fill="#f97316" />}
                                        {pH === 0 && fH === 0 && bH === 0 && <rect x={x} y={chartH - 2} width={barW} height={2} fill="#e2e8f0" rx={2} />}
                                        <rect x={x} y={0} width={barW} height={chartH} fill="transparent" />
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
        const { maxScale, ticks } = buildNiceAxis(maxVal);
        const yLabels = [...ticks].reverse();
        const px = i => (i / (data.length - 1)) * chartW;
        const py = v => chartH - (v / maxScale) * chartH;
        const newPts = data.map((d, i) => `${px(i)},${py(d.newCount)}`).join(" ");
        const clPts = data.map((d, i) => `${px(i)},${py(d.closedCount)}`).join(" ");
        return (
            <div>
                <div style={{ display: "flex", gap: 4 }}>
                    {/* Y-axis labels */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: chartH, flexShrink: 0 }}>
                        {yLabels.map((v, i) => (
                            <span key={i} style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1, textAlign: "right", minWidth: 24 }}>{formatAxisTick(v)}</span>
                        ))}
                    </div>
                    <div style={{ flex: 1 }}>
                        <svg width="100%" height={chartH} viewBox={`0 -5 ${chartW} ${chartH + 5}`} preserveAspectRatio="none">
                            {ticks.slice(1).map(v => (
                                <line key={v} x1={0} y1={chartH - (v / maxScale) * chartH} x2={chartW} y2={chartH - (v / maxScale) * chartH} stroke="#f1f5f9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                            ))}
                            <polyline points={newPts} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            <polyline points={clPts} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                            {data.map((d, i) => {
                                const x = px(i);
                                return (
                                    <g key={i}>
                                        <title>{`${d.label} • New: ${d.newCount} • Closed: ${d.closedCount}`}</title>
                                        <rect x={x - 8} y={0} width={16} height={chartH} fill="transparent" />
                                        <circle cx={x} cy={py(d.newCount)} r={4} fill="#3b82f6" vectorEffect="non-scaling-stroke" />
                                        <circle cx={x} cy={py(d.closedCount)} r={3.5} fill="#94a3b8" vectorEffect="non-scaling-stroke" />
                                        <circle cx={x} cy={py(d.newCount)} r={9} fill="transparent" />
                                        <circle cx={x} cy={py(d.closedCount)} r={9} fill="transparent" />
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
    const BurndownChart = ({ data, height = 170 }) => {
        if (!data || data.length === 0) return null;
        if (data.length === 1) {
            const value = data[0].remaining ?? 0;
            return <div style={{ fontSize: 12, color: "#64748b" }}>Remaining: {value}</div>;
        }

        const chartW = 600;
        const chartH = height;
        const maxVal = Math.max(...data.flatMap(d => [d.remaining, d.ideal]), 1);
        const { maxScale, ticks } = buildNiceAxis(maxVal);
        const yLabels = [...ticks].reverse();
        const px = i => (i / (data.length - 1)) * chartW;
        const py = v => chartH - (v / maxScale) * chartH;
        const remainingPts = data.map((d, i) => `${px(i)},${py(d.remaining)}`).join(" ");
        const idealPts = data.map((d, i) => `${px(i)},${py(d.ideal)}`).join(" ");

        return (
            <div>
                <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: chartH, flexShrink: 0 }}>
                        {yLabels.map((v, i) => (
                            <span key={i} style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1, textAlign: "right", minWidth: 24 }}>{formatAxisTick(v)}</span>
                        ))}
                    </div>
                    <div style={{ flex: 1 }}>
                        <svg width="100%" height={chartH} viewBox={`0 -5 ${chartW} ${chartH + 5}`} preserveAspectRatio="none">
                            {ticks.slice(1).map(v => (
                                <line key={v} x1={0} y1={chartH - (v / maxScale) * chartH} x2={chartW} y2={chartH - (v / maxScale) * chartH} stroke="#f1f5f9" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                            ))}
                            <polyline points={idealPts} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
                            <polyline points={remainingPts} fill="none" stroke="#6366f1" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            {data.map((d, i) => {
                                const x = px(i);
                                const y = py(d.remaining);
                                return (
                                    <g key={i}>
                                        <title>{`${d.label} • Remaining: ${d.remaining} • Ideal: ${d.ideal}`}</title>
                                        <circle cx={x} cy={y} r={3.5} fill="#6366f1" vectorEffect="non-scaling-stroke" />
                                        <circle cx={x} cy={y} r={10} fill="transparent" />
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
    const { tcCount, entryCount, passedTotal, failedTotal, defTotal, openDefs, passRate, availableRuns,
        execByStatus, defByStatus, defByPriority, perPlanStats, trendDays, defectTrendDays, tcBurndownDays, defectBurndownDays } = dashboardStats;
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

            <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 20 }}>📉 Burndown (Last 7 Days)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Remaining Test Cases</div>
                        <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                            {[["Remaining", "#6366f1"], ["Ideal", "#94a3b8"]].map(([l, c]) => (
                                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                                </span>
                            ))}
                        </div>
                        <BurndownChart data={tcBurndownDays} height={170} />
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Remaining Defects</div>
                        <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                            {[["Remaining", "#6366f1"], ["Ideal", "#94a3b8"]].map(([l, c]) => (
                                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                                </span>
                            ))}
                        </div>
                        <BurndownChart data={defectBurndownDays} height={170} />
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
}
