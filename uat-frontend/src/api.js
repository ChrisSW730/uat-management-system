const BASE = "http://localhost:5176/api";

export const api = {
  // Test Cases
  getTestCases: () => fetch(`${BASE}/testcases`).then(r => r.json()),
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
  updateDefect: (id, data, changedBy) => fetch(`${BASE}/defects/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-User-Name": changedBy || "Unknown"
    },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateDefectStatus: (id, status, changedBy) => fetch(`${BASE}/defects/${id}/status`, {
    method: "PATCH", headers: {
      "Content-Type": "application/json",
      "X-User-Name": changedBy || "Unknown"
    },
    body: JSON.stringify({ status })
  }).then(r => r.json()),
  getDefectAudits: (id) => fetch(`${BASE}/defects/${id}/audits`).then(r => r.json()),
};