import React from "react";

export default function LinkedTestCasesModal({
	open,
	searchValue,
	onSearchChange,
	onClearSearch,
	testCases = [],
	selectedIds = [],
	onToggle,
	emptyText = "No test cases available for the selected run.",
}) {
	if (!open) return null;

	return (
		<>
			<div style={{ position: "relative" }}>
				<input
					value={searchValue}
					onChange={(e) => onSearchChange?.(e.target.value)}
					placeholder="Search test cases"
					style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#0f172a", padding: "9px 34px 9px 13px", width: "100%", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
				/>
				{searchValue && (
					<button
						type="button"
						onClick={onClearSearch}
						aria-label="Clear search"
						style={{
							position: "absolute",
							right: 8,
							top: "50%",
							transform: "translateY(-50%)",
							border: "none",
							background: "transparent",
							color: "#64748b",
							cursor: "pointer",
							fontSize: 16,
							lineHeight: 1,
							padding: 2,
						}}
					>
						✕
					</button>
				)}
			</div>

			<div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: 8 }}>
				{testCases.length === 0 ? (
					<div style={{ color: "#94a3b8", fontSize: 13 }}>{emptyText}</div>
				) : testCases.map(tc => {
					const checked = selectedIds.includes(String(tc.id));
					return (
						<label key={tc.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", padding: "4px 0", cursor: "pointer" }}>
							<input
								type="checkbox"
								checked={checked}
								onChange={() => onToggle?.(tc, checked)}
							/>
							<span>{tc.tcNumber} - {tc.name}</span>
						</label>
					);
				})}
			</div>
		</>
	);
}
