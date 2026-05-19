const BASE = "http://localhost:5176/api";

export const api = {
  // Projects and Test Plans
  getProjects: () => fetch(`${BASE}/projects`).then(r => r.json()),
  createProject: (data) => fetch(`${BASE}/projects`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  createTestPlan: (projectId, data) => fetch(`${BASE}/projects/${projectId}/testplans`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  // Test Cases
  getTestCases: (testPlanId) => {
    const qp = testPlanId ? `?testPlanId=${testPlanId}` : "";
    return fetch(`${BASE}/testcases${qp}`).then(r => r.json());
  },
  createTestCase: (data) => fetch(`${BASE}/testcases`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteTestCase: (id) => fetch(`${BASE}/testcases/${id}`, {
  method: "DELETE"
  }),
	async updateTestCase(id, data) {
	  const response = await fetch(
    `${BASE}/testcases/${id}`,
		{
		  method: "PUT",
		  headers: {
			"Content-Type": "application/json"
		  },
		  body: JSON.stringify(data)
		}
	  );

	  if (!response.ok) {
		throw new Error("Failed to update test case");
	  }

	  return await response.json();
  },
  getTestCaseAttachments: (id) => fetch(`${BASE}/testcases/${id}/attachments`).then(r => r.json()),
  uploadTestCaseAttachments: (id, files, uploadedBy) => {
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    return fetch(`${BASE}/testcases/${id}/attachments`, {
      method: "POST",
      headers: {
        "X-User-Name": uploadedBy || "Unknown"
      },
      body: form,
    }).then(r => r.json());
  },
  deleteTestCaseAttachment: (id, attachmentId) => fetch(`${BASE}/testcases/${id}/attachments/${attachmentId}`, {
    method: "DELETE"
  }),

  // Test Runs
  getTestRuns: () => fetch(`${BASE}/testruns`).then(r => r.json()),
  createTestRun: (data) => fetch(`${BASE}/testruns`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  addEntryToRun: (runId, testCaseId) => fetch(`${BASE}/testruns/${runId}/entries`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testCaseId })
  }).then(r => r.json()),
  deleteTestRun: (runId) => fetch(`${BASE}/testruns/${runId}`, {
    method: "DELETE"
  }),
  removeEntryFromRun: (runId, testCaseId) => fetch(`${BASE}/testruns/${runId}/entries/${testCaseId}`, {
    method: "DELETE"
  }),
  updateEntry: (runId, testCaseId, data) => fetch(`${BASE}/testruns/${runId}/entries/${testCaseId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json()),

  // Defects
  getDefects: () => fetch(`${BASE}/defects`).then(r => r.json()),
  createDefect: (data) => fetch(`${BASE}/defects`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteDefect: (id) => fetch(`${BASE}/defects/${id}`, {
    method: "DELETE"
  }),
  async updateDefect(id, data, changedBy) {
    const response = await fetch(`${BASE}/defects/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Name": changedBy || "Unknown"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to update defect");
    }

    return await response.json();
  },
  updateDefectStatus: (id, status, changedBy) => fetch(`${BASE}/defects/${id}/status`, {
    method: "PATCH", headers: {
      "Content-Type": "application/json",
      "X-User-Name": changedBy || "Unknown"
    },
    body: JSON.stringify({ status })
  }).then(r => r.json()),
  getDefectAudits: (id) => fetch(`${BASE}/defects/${id}/audits`).then(r => r.json()),
  getDefectAttachments: (id) => fetch(`${BASE}/defects/${id}/attachments`).then(r => r.json()),
  uploadDefectAttachments: (id, files, uploadedBy) => {
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    return fetch(`${BASE}/defects/${id}/attachments`, {
      method: "POST",
      headers: {
        "X-User-Name": uploadedBy || "Unknown"
      },
      body: form,
    }).then(r => r.json());
  },
  deleteDefectAttachment: (id, attachmentId) => fetch(`${BASE}/defects/${id}/attachments/${attachmentId}`, {
    method: "DELETE"
  }),
};