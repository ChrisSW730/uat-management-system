import Modal from "./ui/Modal";
import { PriBadge } from "./ui/Badge";
import DetailBlock from "./ui/DetailBlock";
import { TEST_CASE_PRIORITIES } from "../constants";

export default function TestCaseModals({
  viewTC,
  setViewTC,
  showAddTC,
  setShowAddTC,
  editTC,
  setEditTC,
  xBtn,
  lbl,
  inp,
  btnP,
  btnS,
  testScopeNameById,
  testCaseAttachments,
  canWrite,
  onTestCasePasteUpload,
  uploadTestCaseFiles,
  openAttachment,
  deleteTestCaseAttachment,
  uploadingTestCaseId,
  newTC,
  setNewTC,
  categories,
  testScopesByPlanId,
  selectedTestPlanId,
  queueNewTestCaseFiles,
  newTCAttachments,
  removeQueuedNewTestCaseFile,
  addTC,
  onNewTestCasePasteUpload,
  updateTC,
}) {
  return (
    <>
      {viewTC && (
        <Modal onClose={() => setViewTC(null)} zIndex={1300} onPaste={canWrite ? e => onTestCasePasteUpload(e, viewTC.id) : undefined}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 800, color: "#6366f1", background: "#eff6ff", padding: "2px 10px", borderRadius: 6, border: "1px solid #c7d2fe" }}>{viewTC.tcNumber}</span>
              <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{viewTC.name}</div>
            </div>
            <button onClick={() => setViewTC(null)} style={xBtn}>✕</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
            <PriBadge label={viewTC.priority} />
            <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{viewTC.category.split("(")[0].trim()}</span>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {viewTC.description && <DetailBlock label="Description" value={viewTC.description} />}
            <DetailBlock label="Test Steps" value={viewTC.steps} pre />
            <DetailBlock label="Expected Result" value={viewTC.expectedResult} accent />
            {viewTC.testScopeId && testScopeNameById?.[viewTC.testScopeId] && (
              <DetailBlock label="Testing Scope" value={testScopeNameById[viewTC.testScopeId]} />
            )}
            {viewTC.remarks && <DetailBlock label="Remarks" value={viewTC.remarks} />}
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1.5px solid #f1f5f9" }}>
            <div style={{ ...lbl, marginBottom: 10 }}>Attachments</div>
            {canWrite && (
              <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Paste screenshot with Ctrl+V or attach file(s)</div>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    uploadTestCaseFiles(viewTC.id, e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                />
              </div>
            )}
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {(testCaseAttachments[viewTC.id] || []).length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments yet.</div>
              )}
              {(testCaseAttachments[viewTC.id] || []).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                  <button
                    type="button"
                    onClick={() => openAttachment(a.url, a.fileName)}
                    style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, textDecoration: "none", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    title="Open attachment"
                  >
                    {a.fileName}
                  </button>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                  <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                  <button onClick={() => deleteTestCaseAttachment(viewTC.id, a.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              ))}
              {uploadingTestCaseId === viewTC.id && (
                <div style={{ color: "#64748b", fontSize: 12 }}>Uploading...</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showAddTC && (
        <Modal onClose={() => setShowAddTC(false)} onPaste={onNewTestCasePasteUpload}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Add Test Case</div>
            <button onClick={() => setShowAddTC(false)} style={xBtn}>✕</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={lbl}>Test Name *</label>
              <input value={newTC.name} onChange={e => setNewTC(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="[Market] - [Module] - [Feature] - [Expected]" />
            </div>
            <div>
              <label style={lbl}>Description</label>
              <textarea value={newTC.description} onChange={e => setNewTC(p => ({ ...p, description: e.target.value }))} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
            </div>
            <div>
              <label style={lbl}>Test Steps</label>
              <textarea value={newTC.steps} onChange={e => setNewTC(p => ({ ...p, steps: e.target.value }))} style={{ ...inp, minHeight: 90, resize: "vertical" }} placeholder="Step 1: …\nStep 2: …" />
            </div>
            <div>
              <label style={lbl}>Expected Result</label>
              <textarea value={newTC.expected} onChange={e => setNewTC(p => ({ ...p, expected: e.target.value }))} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Priority</label>
                <select value={newTC.priority} onChange={e => setNewTC(p => ({ ...p, priority: e.target.value }))} style={inp}>
                  {TEST_CASE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={newTC.category} onChange={e => setNewTC(p => ({ ...p, category: e.target.value }))} style={inp}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>Testing Scope</label>
              <select value={newTC.testScopeId} onChange={e => setNewTC(p => ({ ...p, testScopeId: e.target.value }))} style={inp}>
                <option value="">No scope</option>
                {(testScopesByPlanId[selectedTestPlanId] || []).map(scope => (
                  <option key={scope.id} value={scope.id}>{scope.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Remarks</label>
              <input value={newTC.remarks} onChange={e => setNewTC(p => ({ ...p, remarks: e.target.value }))} style={inp} />
            </div>
            <div style={{ marginTop: 2 }}>
              <label style={lbl}>Attachments</label>
              <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Paste screenshot with Ctrl+V or attach file(s)</div>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    queueNewTestCaseFiles(e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                />
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {newTCAttachments.length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments selected yet.</div>
                )}
                {newTCAttachments.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ color: "#1e293b", fontSize: 13, fontWeight: 700, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>Will upload after test case is created</span>
                    <button onClick={() => removeQueuedNewTestCaseFile(i)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => setShowAddTC(false)} style={btnS}>Cancel</button>
            <button onClick={addTC} style={{ ...btnP, opacity: (!newTC.name || !selectedTestPlanId) ? 0.5 : 1 }} disabled={!newTC.name || !selectedTestPlanId}>Add Test Case</button>
          </div>
        </Modal>
      )}

      {editTC && (
        <Modal onClose={() => setEditTC(null)} onPaste={e => onTestCasePasteUpload(e, editTC.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Edit Test Case</div>
            <button onClick={() => setEditTC(null)} style={xBtn}>✕</button>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={lbl}>Test Name *</label>
              <input value={editTC.name} onChange={e => setEditTC(p => ({ ...p, name: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Description</label>
              <textarea value={editTC.description} onChange={e => setEditTC(p => ({ ...p, description: e.target.value }))} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
            </div>
            <div>
              <label style={lbl}>Test Steps</label>
              <textarea value={editTC.steps} onChange={e => setEditTC(p => ({ ...p, steps: e.target.value }))} style={{ ...inp, minHeight: 90, resize: "vertical" }} />
            </div>
            <div>
              <label style={lbl}>Expected Result</label>
              <textarea value={editTC.expected} onChange={e => setEditTC(p => ({ ...p, expected: e.target.value }))} style={{ ...inp, minHeight: 70, resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Priority</label>
                <select value={editTC.priority} onChange={e => setEditTC(p => ({ ...p, priority: e.target.value }))} style={inp}>
                  {TEST_CASE_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={editTC.category} onChange={e => setEditTC(p => ({ ...p, category: e.target.value }))} style={inp}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>Remarks</label>
              <input value={editTC.remarks} onChange={e => setEditTC(p => ({ ...p, remarks: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Testing Scope</label>
              <select value={editTC.testScopeId || ""} onChange={e => setEditTC(p => ({ ...p, testScopeId: e.target.value }))} style={inp}>
                <option value="">No scope</option>
                {(testScopesByPlanId[editTC.testPlanId] || []).map(scope => (
                  <option key={scope.id} value={scope.id}>{scope.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 2 }}>
              <label style={lbl}>Attachments</label>
              <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Paste screenshot with Ctrl+V or attach file(s)</div>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    uploadTestCaseFiles(editTC.id, e.target.files);
                    e.target.value = "";
                  }}
                  style={{ ...inp, fontSize: 12, padding: "8px 10px" }}
                />
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {(testCaseAttachments[editTC.id] || []).length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>No attachments yet.</div>
                )}
                {(testCaseAttachments[editTC.id] || []).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px" }}>
                    <button
                      type="button"
                      onClick={() => openAttachment(a.url, a.fileName)}
                      style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700, textDecoration: "none", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      title="Open attachment"
                    >
                      {a.fileName}
                    </button>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{Math.max(1, Math.round((a.size || 0) / 1024))} KB</span>
                    <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>{a.uploadedBy} · {new Date(a.uploadedAt).toLocaleString()}</span>
                    <button onClick={() => deleteTestCaseAttachment(editTC.id, a.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
                {uploadingTestCaseId === editTC.id && (
                  <div style={{ color: "#64748b", fontSize: 12 }}>Uploading...</div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
            <button onClick={() => setEditTC(null)} style={btnS}>Cancel</button>
            <button onClick={updateTC} style={btnP}>Save Changes</button>
          </div>
        </Modal>
      )}
    </>
  );
}
