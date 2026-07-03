import { Search, X, Plus, RotateCcw, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import "../styles/Projects.css";
import FilterDropdown from "./ui/FilterDropdown";
import Pagination from "./ui/Pagination";

export default function UsersTab(props) {
	const {
		openAddUser,
		btnP,
		userSearch,
		setUserSearch,
		inp,
		userRoleFilter,
		setUserRoleFilter,
		userActiveFilter,
		setUserActiveFilter,
		setUserSortCol,
		setUserSortDir,
		btnS,
		filteredSortedUsers,
		users,
		toggleUserSort,
		userSortCol,
		userSortDir,
		getPwCooldownRemaining,
		openEditUser,
		resetUserPassword,
		deleteUserAccount,
		xBtn,
		toInputDate,
		currentPage,
		pageSize,
		currentUsers,
		totalPages,
		setCurrentPage,
	} = props;

	const renderSortIcon = col => {
		if (userSortCol === col) {
			return userSortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
		}
		return <ArrowUpDown size={13} />;
	};

	return (
		<div style={{ padding: "20px 2.5%" }}>
			<div className="projects-toolbar">

				<div className="toolbar-left">

					<div className="search-box">
						<Search size={18} />

						<input
							placeholder="Search username, display name, role..."
							value={userSearch}
							onChange={e => setUserSearch(e.target.value)}
						/>

						{userSearch && (
							<button
								onClick={() => setUserSearch("")}
								className="clear-search-btn"
							>
								<X size={14} />
							</button>
						)}
					</div>

					<div className="filter-wrapper">
						<FilterDropdown
							width={170}
							value={userRoleFilter}
							placeholder="All Roles"
							options={[
								{ value: "All", label: "All Roles" },
								...["Admin", "Test Lead", "Tester", "Developer", "Viewer"].map(role => ({
									value: role,
									label: role,
								})),
							]}
							onChange={setUserRoleFilter}
						/>
					</div>

					<div className="filter-wrapper">
						<FilterDropdown
							width={140}
							value={userActiveFilter}
							placeholder="All Status"
							options={[
								{ value: "All", label: "All Status" },
								{ value: "Active", label: "Active" },
								{ value: "Inactive", label: "Inactive" },
							]}
							onChange={setUserActiveFilter}
						/>
					</div>

					<button
						className="reset-btn"
						onClick={() => {
							setUserSearch("");
							setUserRoleFilter("All");
							setUserActiveFilter("All");
							setUserSortCol("username");
							setUserSortDir("asc");
						}}
					>
						<RotateCcw size={16} />
						Reset
					</button>

				</div>

				<div className="toolbar-right">
					<button className="primary-btn" onClick={openAddUser}>
						<Plus size={16} />
						Add User
					</button>
				</div>

			</div>
			<div
				style={{
					marginBottom: 12,
					color: "#64748b",
					fontSize: 13,
					fontWeight: 700,
				}}
			>
			</div>
			<div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
				<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
					<thead>
						<tr style={{ background: "#e2ebf3", borderBottom: "2px solid #f1f5f9" }}>
							<th style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Actions</th>
							{[
								{ label: "Username", col: "username" },
								{ label: "Display Name", col: "displayName" },
								{ label: "Role", col: "role" },
								{ label: "Active", col: "isActive" },
								{ label: "Created", col: "createdAt" },
							].map(({ label, col }) => (
								<th
									key={label}
									onClick={() => toggleUserSort(col)}
									style={{ padding: "12px 16px", textAlign: "left", color: "#1f252e", fontSize: 14, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: userSortCol === col ? "#d4dff0" : undefined }}>
									<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
										{label}
										{renderSortIcon(col)}
									</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filteredSortedUsers.length === 0 && <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No users found</td></tr>}
						{currentUsers.map((user, i) => {
							const resetCooldown = getPwCooldownRemaining(`reset-${user.id}`);
							return (
								<tr key={user.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
									<td style={{ padding: "13px 16px", width: 190, minWidth: 190 }}>
										<div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
											<button className="primary-action-btn" onClick={() => openEditUser({ ...user, password: "" })}>Edit</button>
											<button className="secondary-action-btn"
												onClick={() => resetUserPassword(user)}
												disabled={resetCooldown > 0}
												title={resetCooldown > 0 ? `Wait ${resetCooldown}s before resetting again` : undefined}
											>
												{resetCooldown > 0 ? `Reset (${resetCooldown}s)` : "Reset Password"}
											</button>
											<button className="third-action-btn" onClick={() => { if (window.confirm(`Delete ${user.username}?`)) deleteUserAccount(user.id); }}><Trash2 size={15} /></button>
										</div>
									</td>
									<td style={{ padding: "13px 16px", fontWeight: 700, color: "#6366f1" }}>{user.username}</td>
									<td style={{ padding: "13px 16px", color: "#1e293b", fontWeight: 600 }}>{user.displayName}</td>
									<td style={{ padding: "13px 16px" }}><span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>{user.role}</span></td>
									<td style={{ padding: "13px 16px" }}>{user.isActive ? "Yes" : "No"}</td>
									<td style={{ padding: "13px 16px", color: "#64748b" }}>{toInputDate(user.createdAt)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<Pagination
				currentPage={currentPage}
				totalPages={totalPages}
				pageSize={pageSize}
				totalItems={filteredSortedUsers.length}
				onPageChange={setCurrentPage}
			/>
		</div>
	);
}
