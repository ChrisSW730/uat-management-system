import { PRIORITY_META } from "../constants";
import Modal from "./ui/Modal";

export default function DefectModals({
  viewDef,
  setViewDef,
  copyDefectLink,
  btnS,
  xBtn,
  lbl,
  inp,
  testPlanMetaById,
  defectAttachments,
  openAttachment,
  canComment,
  defectCommentDrafts,
  setDefectCommentDrafts,
  replyToComment,
  canDelete,
  deleteDefectComment,
  registerMentionInputRef,
  handleMentionInputChange,
  handleMentionKeyDown,
  mentionPicker,
  addDefectComment,
  selectMention,
  btnP,
  editDef,
  setEditDef,
  onDefectPasteUpload,
  runs,
  allTestCaseById,
  assignableUserDisplayNames,
  deleteDefectAttachment,
  queueNewDefectFiles,
  newDefAttachments,
  removeQueuedNewDefectFile,
  saveDefectEdits,
  showAddDef,
  setShowAddDef,
  setNewDefAttachments,
  onNewDefectPasteUpload,
  newDef,
  setNewDef,
  getCurrentUserDisplayName,
  submitDefect,
}) {
  return (
    <>
      {viewDef && (
        <Modal onClose={() => setViewDef(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Defect Details</div>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                {viewDef.defectNumber || `#${viewDef.id}`}
              </span>
              <button
                type="button"
                onClick={() => copyDefectLink(viewDef.id)}
                style={{ ...btnS, padding: "4px 10px", fontSize: 12, lineHeight: 1.2 }}
                title="Copy shareable defect link"
              >
                Copy Link
              </button>
            </div>
            <button onClick={() => setViewDef(null)} style={xBtn}>✕</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Market</label>
                <input
                  value={viewDef.market || ""}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Run</label>
                <input
                  value={viewDef.runNumber || "Standalone"}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              {viewDef.tcNumber && (
                <div>
                  <label style={lbl}>Test Case</label>
                  <input
                    value={viewDef.tcNumber}
                    style={{ ...inp, background: "#f8fafc" }}
                    readOnly
                  />
                </div>
              )}
              {viewDef.testPlanId && (
                <div>
                  <label style={lbl}>Test Plan</label>
                  <input
                    value={testPlanMetaById[viewDef.testPlanId]
                      ? `${testPlanMetaById[viewDef.testPlanId].projectName} - ${testPlanMetaById[viewDef.testPlanId].testPlanName}`
                      : `Plan #${viewDef.testPlanId}`}
                    style={{ ...inp, background: "#f8fafc" }}
                    readOnly
                  />
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>Issue Type</label>
              <input
                value={viewDef.issueType || ""}
                style={{ ...inp, background: "#f8fafc" }}
                readOnly
              />
            </div>

            <div>
              <label style={lbl}>Description</label>
              <textarea
                value={viewDef.description || ""}
                readOnly
                style={{ ...inp, minHeight: 80, resize: "vertical", background: "#f8fafc" }}
              />
            </div>

            <div>
              <label style={lbl}>Expected Result</label>
              <textarea
                value={viewDef.expectedResult || ""}
                readOnly
                style={{ ...inp, minHeight: 70, resize: "vertical", background: "#f8fafc" }}
              />
            </div>

            <div>
              <label style={lbl}>Actual Result</label>
              <textarea
                value={viewDef.actualResult || ""}
                readOnly
                style={{ ...inp, minHeight: 70, resize: "vertical", background: "#f8fafc" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Priority</label>
                <input
                  value={viewDef.priority || ""}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Raised By</label>
                <input
                  value={viewDef.raisedBy || ""}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <input
                  value={viewDef.assignedTo || "Unassigned"}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Target Fix Date</label>
                <input
                  type="date"
                  value={viewDef.targetFixDate ? String(viewDef.targetFixDate).slice(0, 10) : ""}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Remarks</label>
              <textarea
                value={viewDef.remarks || ""}
                readOnly
                style={{ ...inp, minHeight: 60, resize: "vertical", background: "#f8fafc" }}
              />
            </div>

            <div>
              <label style={lbl}>Attachments</label>
              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                {(defectAttachments[viewDef.id] || []).length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments.</div>
                )}
                {(defectAttachments[viewDef.id] || []).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <button
                      type="button"
                      onClick={() => openAttachment(a.url, a.fileName)}
                      style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      title="Open attachment"
                    >
                      {a.fileName}
                    </button>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={lbl}>Comments</label>
              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                {(viewDef.comments || []).length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No comments yet.</div>
                )}
                {(viewDef.comments || []).map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (!canComment) return;
                      const key = `defect-${viewDef.id}`;
                      const current = defectCommentDrafts[viewDef.id] || "";
                      replyToComment(
                        key,
                        current,
                        next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next })),
                        c.tester
                      );
                    }}
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: canComment ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "#475569", fontSize: 12 }}>{c.tester}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(c.createdAt).toLocaleString()}</span>
                        {canDelete && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              deleteDefectComment(viewDef.id, c.id);
                            }}
                            style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}
                          >✕</button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#334155" }}>{c.message}</div>
                  </div>
                ))}
                {canComment && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        placeholder="Add a comment... (use @Display Name to tag)"
                        value={defectCommentDrafts[viewDef.id] || ""}
                        ref={node => registerMentionInputRef(`defect-${viewDef.id}`, node)}
                        onChange={e => {
                          const value = e.target.value;
                          handleMentionInputChange(
                            "defect",
                            `defect-${viewDef.id}`,
                            value,
                            next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next }))
                          );
                        }}
                        onKeyDown={e => {
                          handleMentionKeyDown(
                            e,
                            "defect",
                            `defect-${viewDef.id}`,
                            defectCommentDrafts[viewDef.id] || "",
                            next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next }))
                          );
                          if (e.key === "Enter" && !e.shiftKey && !(mentionPicker?.type === "defect" && mentionPicker?.key === `defect-${viewDef.id}` && mentionPicker?.list?.length)) {
                            e.preventDefault();
                            addDefectComment(viewDef.id);
                          }
                        }}
                        style={{ ...inp, fontSize: 13, flex: 1 }}
                      />
                      <button
                        onClick={() => addDefectComment(viewDef.id)}
                        disabled={!defectCommentDrafts[viewDef.id]?.trim()}
                        style={{ ...btnP, opacity: defectCommentDrafts[viewDef.id]?.trim() ? 1 : 0.5 }}
                      >Add</button>
                    </div>
                    {mentionPicker?.type === "defect" && mentionPicker?.key === `defect-${viewDef.id}` && (
                      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                        {mentionPicker.list.map((u, idx) => (
                          <button
                            key={`defect-mention-${viewDef.id}-${u.id}`}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              const current = defectCommentDrafts[viewDef.id] || "";
                              selectMention(
                                "defect",
                                `defect-${viewDef.id}`,
                                current,
                                next => setDefectCommentDrafts(p => ({ ...p, [viewDef.id]: next })),
                                u.displayName
                              );
                            }}
                            style={{ width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid #f1f5f9", background: mentionPicker.activeIndex === idx ? "#eff6ff" : "#fff", color: "#0f172a", padding: "7px 10px", fontSize: 12, cursor: "pointer" }}
                          >
                            {u.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => setViewDef(null)} style={btnS}>Close</button>
          </div>
        </Modal>
      )}

      {editDef && (
        <Modal onClose={() => setEditDef(null)} onPaste={e => onDefectPasteUpload(e, editDef.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Defect</div>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 8px", borderRadius: 6, border: "1px solid #c7d2fe" }}>
                {editDef.defectNumber || `#${editDef.id}`}
              </span>
            </div>
            <button onClick={() => setEditDef(null)} style={xBtn}>✕</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Market</label>
                <select
                  value={editDef.market || "SG"}
                  onChange={e => setEditDef(p => ({ ...p, market: e.target.value }))}
                  style={inp}
                >
                  {["SG", "HK", "MY", "KR", "US", "ID", "TW"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Run</label>
                <select
                  value={editDef.linkedRunId || ""}
                  onChange={e => setEditDef(p => ({ ...p, linkedRunId: e.target.value || "" }))}
                  style={inp}
                >
                  <option value="">Standalone defect</option>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                </select>
              </div>
              {editDef.linkedRunId && (
                <div>
                  <label style={lbl}>Test Case</label>
                  <select
                    value={editDef.linkedTestCaseId || ""}
                    onChange={e => {
                      const nextTcId = e.target.value || "";
                      const nextTc = nextTcId ? allTestCaseById[nextTcId] : null;
                      setEditDef(p => ({
                        ...p,
                        linkedTestCaseId: nextTcId,
                        testPlanId: nextTc?.testPlanId ?? (p.testPlanId ?? null),
                      }));
                    }}
                    style={inp}
                  >
                    <option value="">No specific test case (run-level defect)</option>
                    {(() => {
                      const run = runs.find(r => String(r.id) === String(editDef.linkedRunId));
                      const options = (run?.entries || [])
                        .map(en => allTestCaseById[en.testCaseId])
                        .filter(Boolean);
                      return options.map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>);
                    })()}
                  </select>
                </div>
              )}
              <div>
                <label style={lbl}>Test Plan (Optional)</label>
                <select
                  value={editDef.testPlanId ?? ""}
                  onChange={e => setEditDef(p => ({ ...p, testPlanId: e.target.value ? Number(e.target.value) : null }))}
                  style={inp}
                  disabled={!!editDef.linkedTestCaseId}
                >
                  <option value="">Not linked to test plan</option>
                  {Object.entries(testPlanMetaById)
                    .sort((a, b) => {
                      const aLabel = `${a[1].projectName} - ${a[1].testPlanName}`;
                      const bLabel = `${b[1].projectName} - ${b[1].testPlanName}`;
                      return aLabel.localeCompare(bLabel);
                    })
                    .map(([id, meta]) => (
                      <option key={id} value={id}>{meta.projectName} - {meta.testPlanName}</option>
                    ))}
                </select>
                {editDef.linkedTestCaseId && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    Test plan is auto-linked from the selected test case.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={lbl}>Issue Type</label>
              <select
                value={editDef.issueType || "Functional"}
                onChange={e => setEditDef(p => ({ ...p, issueType: e.target.value }))}
                style={inp}
              >
                {["Functional", "UIUX", "Performance", "Test Data", "Environment", "Data Synchronous", "Backend Script/Scheduler", "Other"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}>Description</label>
              <textarea
                value={editDef.description || ""}
                onChange={e => setEditDef(p => ({ ...p, description: e.target.value }))}
                style={{ ...inp, minHeight: 80, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Expected Result</label>
              <textarea
                value={editDef.expectedResult || ""}
                onChange={e => setEditDef(p => ({ ...p, expectedResult: e.target.value }))}
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Actual Result</label>
              <textarea
                value={editDef.actualResult || ""}
                onChange={e => setEditDef(p => ({ ...p, actualResult: e.target.value }))}
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Priority</label>
                <select
                  value={editDef.priority}
                  onChange={e => setEditDef(p => ({ ...p, priority: e.target.value }))}
                  style={inp}
                >
                  {Object.keys(PRIORITY_META).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Raised By</label>
                <input
                  value={editDef.raisedBy || ""}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <select
                  value={editDef.assignedTo || ""}
                  onChange={e => setEditDef(p => ({ ...p, assignedTo: e.target.value }))}
                  style={inp}
                >
                  <option value="">Unassigned</option>
                  {assignableUserDisplayNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Target Fix Date</label>
                <input
                  type="date"
                  value={editDef.targetFixDate ? String(editDef.targetFixDate).slice(0, 10) : ""}
                  onChange={e => setEditDef(p => ({ ...p, targetFixDate: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Remarks</label>
              <textarea
                value={editDef.remarks || ""}
                onChange={e => setEditDef(p => ({ ...p, remarks: e.target.value }))}
                style={{ ...inp, minHeight: 60, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Attachments</label>

              <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                {(defectAttachments[editDef.id] || []).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <button
                      type="button"
                      onClick={() => openAttachment(a.url, a.fileName)}
                      style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      title="Open attachment"
                    >
                      {a.fileName}
                    </button>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                    {canDelete && (
                      <button onClick={() => deleteDefectAttachment(editDef.id, a.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div
                style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                  Paste screenshot with Ctrl+V or attach file(s)
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    queueNewDefectFiles(e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                />
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {newDefAttachments.length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No new attachments queued.</div>
                )}

                {newDefAttachments.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>Will upload after saving</span>
                    <button onClick={() => removeQueuedNewDefectFile(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditDef(null); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
            <button onClick={saveDefectEdits} style={{ ...btnP, opacity: !editDef?.description ? 0.5 : 1 }} disabled={!editDef?.description}>Save Changes</button>
          </div>
        </Modal>
      )}

      {showAddDef && (
        <Modal onClose={() => { setShowAddDef(null); setNewDefAttachments([]); }} onPaste={onNewDefectPasteUpload}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Create Defect</div>
            <button onClick={() => { setShowAddDef(null); setNewDefAttachments([]); }} style={xBtn}>✕</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Market</label>
                <select
                  value={newDef.market || "SG"}
                  onChange={e => setNewDef(p => ({ ...p, market: e.target.value }))}
                  style={inp}
                >
                  {["SG", "HK", "MY", "KR", "US", "ID", "TW"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Run</label>
                <select
                  value={showAddDef.runId || ""}
                  onChange={e => setShowAddDef(p => ({
                    ...p,
                    runId: e.target.value || null,
                    tcId: null,
                    tcTestPlanId: null,
                  }))}
                  style={inp}
                >
                  <option value="">Standalone defect</option>
                  {runs.map(r => <option key={r.id} value={r.id}>{r.runNumber}</option>)}
                </select>
              </div>
              {showAddDef.runId && (
                <div>
                  <label style={lbl}>Test Case</label>
                  <select
                    value={showAddDef.tcId || ""}
                    onChange={e => {
                      const nextTcId = e.target.value || null;
                      const nextTc = nextTcId ? allTestCaseById[nextTcId] : null;
                      setShowAddDef(p => ({
                        ...p,
                        tcId: nextTcId,
                        tcTestPlanId: nextTc?.testPlanId ?? null,
                      }));
                    }}
                    style={inp}
                  >
                    <option value="">No specific test case (run-level defect)</option>
                    {(() => {
                      const run = runs.find(r => String(r.id) === String(showAddDef.runId));
                      const options = (run?.entries || [])
                        .map(en => allTestCaseById[en.testCaseId])
                        .filter(Boolean);
                      return options.map(tc => <option key={tc.id} value={tc.id}>{tc.tcNumber} - {tc.name}</option>);
                    })()}
                  </select>
                </div>
              )}
              <div>
                <label style={lbl}>Test Plan (Optional)</label>
                {showAddDef.tcTestPlanId ? (
                  <input
                    value={testPlanMetaById[showAddDef.tcTestPlanId]
                      ? `${testPlanMetaById[showAddDef.tcTestPlanId].projectName} - ${testPlanMetaById[showAddDef.tcTestPlanId].testPlanName}`
                      : `Plan #${showAddDef.tcTestPlanId}`}
                    style={{ ...inp, background: "#f8fafc" }}
                    readOnly
                  />
                ) : (
                  <select
                    value={showAddDef.manualTestPlanId || ""}
                    onChange={e => setShowAddDef(p => ({ ...p, manualTestPlanId: e.target.value || "" }))}
                    style={inp}
                  >
                    <option value="">Not linked to test plan</option>
                    {Object.entries(testPlanMetaById)
                      .sort((a, b) => {
                        const aLabel = `${a[1].projectName} - ${a[1].testPlanName}`;
                        const bLabel = `${b[1].projectName} - ${b[1].testPlanName}`;
                        return aLabel.localeCompare(bLabel);
                      })
                      .map(([id, meta]) => (
                        <option key={id} value={id}>{meta.projectName} - {meta.testPlanName}</option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label style={lbl}>Issue Type</label>
              <select
                value={newDef.issueType || "Functional"}
                onChange={e => setNewDef(p => ({ ...p, issueType: e.target.value }))}
                style={inp}
              >
                {["Functional", "UIUX", "Performance", "Test Data", "Environment", "Data Synchronous", "Backend Script/Scheduler", "Other"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}>Description *</label>
              <textarea
                value={newDef.description || ""}
                onChange={e => setNewDef(p => ({ ...p, description: e.target.value }))}
                style={{ ...inp, minHeight: 80, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Expected Result</label>
              <textarea
                value={newDef.expected || ""}
                onChange={e => setNewDef(p => ({ ...p, expected: e.target.value }))}
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Actual Result</label>
              <textarea
                value={newDef.actual || ""}
                onChange={e => setNewDef(p => ({ ...p, actual: e.target.value }))}
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Priority</label>
                <select
                  value={newDef.priority}
                  onChange={e => setNewDef(p => ({ ...p, priority: e.target.value }))}
                  style={inp}
                >
                  {Object.keys(PRIORITY_META).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Raised By</label>
                <input
                  value={getCurrentUserDisplayName()}
                  style={{ ...inp, background: "#f8fafc" }}
                  readOnly
                />
              </div>
              <div>
                <label style={lbl}>Assigned To</label>
                <select
                  value={newDef.assignedTo || ""}
                  onChange={e => setNewDef(p => ({ ...p, assignedTo: e.target.value }))}
                  style={inp}
                >
                  <option value="">Unassigned</option>
                  {assignableUserDisplayNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Target Fix Date</label>
                <input
                  type="date"
                  value={newDef.targetFix || ""}
                  onChange={e => setNewDef(p => ({ ...p, targetFix: e.target.value }))}
                  style={inp}
                />
              </div>
            </div>

            <div>
              <label style={lbl}>Remarks</label>
              <textarea
                value={newDef.remarks || ""}
                onChange={e => setNewDef(p => ({ ...p, remarks: e.target.value }))}
                style={{ ...inp, minHeight: 60, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={lbl}>Attachments</label>
              <div
                style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}
              >
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                  Paste screenshot with Ctrl+V or attach file(s)
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    queueNewDefectFiles(e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                />
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {newDefAttachments.length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments selected yet.</div>
                )}

                {newDefAttachments.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>Will upload after defect is created</span>
                    <button onClick={() => removeQueuedNewDefectFile(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowAddDef(null); setNewDefAttachments([]); }} style={btnS}>Cancel</button>
            <button onClick={submitDefect} style={{ ...btnP, opacity: !newDef.description ? 0.5 : 1 }} disabled={!newDef.description}>Log Defect</button>
          </div>
        </Modal>
      )}
    </>
  );
}