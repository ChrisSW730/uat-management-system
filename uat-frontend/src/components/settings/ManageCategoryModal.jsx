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
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    marginBottom: 18,
                }}
            >
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            fontSize: 17,
                            fontWeight: 800,
                            color: "#0f172a",
                            lineHeight: 1.35,
                            marginBottom: 8,
                        }}
                    >
                        Test Case Categories
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 12px",
                                borderRadius: 999,
                                background: "#EEF2FF",
                                color: "#4F46E5",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            🟣 {categories.length} Categor{categories.length === 1 ? "y" : "ies"}
                        </span>
                    </div>
                </div>

                <button onClick={onClose} style={xBtn}>
                    ✕
                </button>
            </div>

            {/* Add Category */}
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <input
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && newCategoryName.trim()) {
                            addCategory();
                        }
                    }}
                    placeholder="Add a category name"
                    style={{ ...inp, flex: 1 }}
                />

                <button
                    onClick={addCategory}
                    disabled={!newCategoryName.trim()}
                    style={{
                        ...btnP,
                        opacity: newCategoryName.trim() ? 1 : 0.5,
                    }}
                >
                    Add
                </button>
            </div>

            {/* Category List */}
            <div style={{ display: "grid", gap: 10 }}>
                {categories.length === 0 && (
                    <div
                        style={{
                            color: "#94a3b8",
                            fontSize: 14,
                            padding: "10px 0",
                        }}
                    >
                        No categories yet.
                    </div>
                )}

                {[...categories]
                    .sort((a, b) => a.localeCompare(b))
                    .map((cat, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                border: "1px solid #e2e8f0",
                                borderRadius: 10,
                                padding: "12px 14px",
                                background: "#fff",
                            }}
                        >
                            <span
                                style={{
                                    color: "#334155",
                                    fontWeight: 700,
                                    fontSize: 15,
                                }}
                            >
                                {cat}
                            </span>

                            <button
                                onClick={() => deleteCategory(cat)}
                                style={{
                                    border: "1px solid #fecaca",
                                    background: "#fff5f5",
                                    color: "#dc2626",
                                    borderRadius: 8,
                                    padding: "7px 14px",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 13,
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    ))}
            </div>

            {/* Footer */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 20,
                }}
            >
                <button onClick={onClose} style={btnS}>
                    Close
                </button>
            </div>
        </Modal>
    );
}