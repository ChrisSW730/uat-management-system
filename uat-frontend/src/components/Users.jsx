import { Search, X } from "lucide-react";

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
	} = props;

	return (
		<div style={{ padding: "20px 2.5%" }}>
			<div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
				<button onClick={openAddUser} style={btnP}>+ Add User</button>
				<div style={{ position: "relative" }}>
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
						placeholder="Search username, display name, role..."
						value={userSearch}
						onChange={e => setUserSearch(e.target.value)}
						style={{
							...inp,
							width: 300,
							paddingLeft: 38,
							paddingRight: 36,
						}}
					/>

					{userSearch && (
						<button
							onClick={() => setUserSearch("")}
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
				<select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} style={{ ...inp, width: 170 }}>
					<option value="All">All Roles</option>
					{["Admin", "Test Lead", "Tester", "Developer", "Viewer"].map(role => <option key={role}>{role}</option>)}
				</select>
				<select value={userActiveFilter} onChange={e => setUserActiveFilter(e.target.value)} style={{ ...inp, width: 140 }}>
					<option value="All">All Status</option>
					<option value="Active">Active</option>
					<option value="Inactive">Inactive</option>
				</select>
				<button
					onClick={() => {
						setUserSearch("");
						setUserRoleFilter("All");
						setUserActiveFilter("All");
						setUserSortCol("username");
						setUserSortDir("asc");
					}}
					style={btnS}
				>
					Clear
				</button>
			</div>
			<div style={{ marginBottom: 12, color: "#64748b", fontSize: 13, fontWeight: 700 }}>Showing {filteredSortedUsers.length} of {users.length} users</div>
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
									{label}{userSortCol === col ? (userSortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filteredSortedUsers.length === 0 && <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#cbd5e1" }}>No users found</td></tr>}
						{filteredSortedUsers.map((user, i) => {
							const resetCooldown = getPwCooldownRemaining(`reset-${user.id}`);
							return (
								<tr key={user.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
									<td style={{ padding: "13px 16px", width: 190, minWidth: 190 }}>
										<div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
											<button onClick={() => openEditUser({ ...user, password: "" })} style={{ ...btnS, padding: "5px 12px", fontSize: 14 }}>Edit</button>
											<button
												onClick={() => resetUserPassword(user)}
												disabled={resetCooldown > 0}
												title={resetCooldown > 0 ? `Wait ${resetCooldown}s before resetting again` : undefined}
												style={{ ...btnS, padding: "5px 10px", fontSize: 12, borderColor: "#c7d2fe", color: resetCooldown > 0 ? "#a5b4fc" : "#4338ca", opacity: resetCooldown > 0 ? 0.65 : 1, cursor: resetCooldown > 0 ? "not-allowed" : "pointer" }}
											>
												{resetCooldown > 0 ? `Reset (${resetCooldown}s)` : "Reset Password"}
											</button>
											<button onClick={() => { if (window.confirm(`Delete ${user.username}?`)) deleteUserAccount(user.id); }} style={xBtn}>✕</button>
										</div>
									</td>
									<td style={{ padding: "13px 16px", fontWeight: 800, color: "#6366f1" }}>{user.username}</td>
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
		</div>
	);
}
