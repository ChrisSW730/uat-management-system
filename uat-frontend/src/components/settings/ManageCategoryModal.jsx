import Modal from "../ui/Modal";

export default function ManageCategoryModal({
    onClose,
    categories,
    newCategoryName,
    setNewCategoryName,
    addCategory,
    deleteCategory,
    inp,
    btnP,
    btnS,
    xBtn,
}) {
    return (
        <Modal onClose={onClose}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Configure Test Case Categories</div>
                <button onClick={onClose} style={xBtn}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <input
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && newCategoryName.trim()) {
                            addCategory();
                        }
                    }}
                    placeholder="New category name…"
                    style={{ ...inp, flex: 1 }}
                />
                <button
                    onClick={addCategory}
                    disabled={!newCategoryName.trim()}
                    style={{ ...btnP, opacity: !newCategoryName.trim() ? 0.5 : 1 }}
                >Add</button>
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
                {[...categories].sort((a, b) => a.localeCompare(b)).map((cat, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                        <span style={{ flex: 1, fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{cat}</span>
                        <button
                            onClick={() => deleteCategory(cat)}
                            style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                            title="Remove category"
                        >✕</button>
                    </div>
                ))}
                {categories.length === 0 && (
                    <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 12 }}>No categories defined.</div>
                )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                <button onClick={onClose} style={btnS}>Close</button>
            </div>
        </Modal>
    );
}
