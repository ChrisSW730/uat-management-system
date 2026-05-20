const BASE = "http://localhost:5176/api";
const rawFetch = window.fetch.bind(window);

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem("uatAuth") || "null");
  } catch {
    return null;
  }
}

async function authFetch(resource, options = {}) {
  const url = typeof resource === "string" ? resource : resource.url;
  if (url?.includes("/api/auth/login")) {
    return rawFetch(resource, options);
  }

  const auth = readAuth();
  if (auth?.token) {
    const headers = new Headers(options.headers || (resource instanceof Request ? resource.headers : undefined) || {});
    headers.set("Authorization", `Bearer ${auth.token}`);
    if (auth.user?.username) {
      headers.set("X-User-Name", auth.user.username);
    }
    options = { ...options, headers };
  }

  return rawFetch(resource, options);
}

window.fetch = authFetch;

export const api = {
  login: async (username, password) => {
    const response = await rawFetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to login");
    }

    return await response.json();
  },

  getAdminContacts: async () => {
    const response = await rawFetch(`${BASE}/auth/admin-contact`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to load admin contacts");
    }
    return await response.json();
  },

  getUsers: () => fetch(`${BASE}/users`).then(r => r.json()),
  createUser: (data) => fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
  updateUser: (id, data) => fetch(`${BASE}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
  deleteUser: (id) => fetch(`${BASE}/users/${id}`, {
    method: "DELETE"
  }),

  // Projects and Test Plans
  getProjects: () => fetch(`${BASE}/projects`).then(r => r.json()),
  async createProject(data) {
    const response = await fetch(`${BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to create project");
    }

    return await response.json();
  },
  async updateProject(id, data) {
    const response = await fetch(`${BASE}/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to update project");
    }

    return await response.json();
  },
  deleteProject: (id) => fetch(`${BASE}/projects/${id}`, {
    method: "DELETE"
  }),
  async createTestPlan(projectId, data) {
    const response = await fetch(`${BASE}/projects/${projectId}/testplans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to create test plan");
    }

    return await response.json();
  },
  async updateTestPlan(id, data) {
    const response = await fetch(`${BASE}/projects/testplans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to update test plan");
    }

    return await response.json();
  },
  deleteTestPlan: (id) => fetch(`${BASE}/projects/testplans/${id}`, {
    method: "DELETE"
  }),
  getTestPlanScopes: (testPlanId) => fetch(`${BASE}/projects/testplans/${testPlanId}/scopes`).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
  createTestPlanScope: (testPlanId, name) => fetch(`${BASE}/projects/testplans/${testPlanId}/scopes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
  deleteTestPlanScope: (testPlanId, scopeId) => fetch(`${BASE}/projects/testplans/${testPlanId}/scopes/${scopeId}`, {
    method: "DELETE"
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
  }),

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
  addRunEntryComment: (runId, testCaseId, message) => fetch(`${BASE}/testruns/${runId}/entries/${testCaseId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
  deleteRunEntryComment: (runId, testCaseId, commentId) => fetch(`${BASE}/testruns/${runId}/entries/${testCaseId}/comments/${commentId}`, {
    method: "DELETE"
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
  }),

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
  addDefectComment: (id, message) => fetch(`${BASE}/defects/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
  deleteDefectComment: (id, commentId) => fetch(`${BASE}/defects/${id}/comments/${commentId}`, {
    method: "DELETE"
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
  }),

  // User password management
  sendInitialPasswordEmail: (userId, email, initialPassword, createdBy) => fetch(`${BASE}/users/${userId}/send-initial-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, initialPassword, createdBy })
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),

  changeUserPassword: (userId, oldPassword, newPassword) => fetch(`${BASE}/users/${userId}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPassword, newPassword })
  }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }),
};