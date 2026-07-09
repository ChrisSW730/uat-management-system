import {
  DEFECT_ISSUE_TYPES,
  DEFECT_SEVERITIES,
  DEFECT_SOURCES,
  DEFECT_STATUS,
  PRIORITY_META,
} from "../constants/index.js";

const CLICKUP_REQUEST_TIMEOUT_MS = 8000;

const BASE = import.meta.env.DEV
  ? ""
  : "/api";

function buildClickUpApiUrl(path) {
  return `/${path.replace(/^\/+/, "")}`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CLICKUP_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("TIMEOUT");
    }

    if (error instanceof TypeError) {
      throw new Error("NETWORK_ERROR");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const CLICKUP_FIELD_OPTIONS = [{ value: "", label: "(Not Mapped)" }];

export const PEEKQA_DEFECT_FIELDS = [
  { value: "Defect Title", label: "Defect Title" },
  { value: "Description", label: "Description" },
  { value: "Assigned To", label: "Assigned To" },
  { value: "Status", label: "Status" },
  { value: "Priority", label: "Priority" },
  { value: "Severity", label: "Severity" },
  { value: "Issue Type", label: "Issue Type" },
  { value: "Expected Result", label: "Expected Result" },
  { value: "Actual Result", label: "Actual Result" },
  { value: "Environment", label: "Environment" },
  { value: "Module", label: "Module" },
  { value: "Browser", label: "Browser" },
  { value: "Operating System", label: "Operating System" },
  { value: "Build Version", label: "Build Version" },
  { value: "Attachment", label: "Attachment" },
  { value: "Steps To Reproduce", label: "Steps To Reproduce" },
  { value: "Target Fix Date", label: "Target Fix Date" },
  { value: "Remarks", label: "Remarks" },
  { value: "Source", label: "Source" },
];

export const PEEKQA_DROPDOWN_FIELD_OPTIONS = {
  Status: Object.keys(DEFECT_STATUS),
  Priority: Object.keys(PRIORITY_META),
  Severity: [...DEFECT_SEVERITIES],
  "Issue Type": [...DEFECT_ISSUE_TYPES],
  Source: [...DEFECT_SOURCES],
};

const REQUIRED_CLICKUP_VALUE_MAPPINGS = {
  Severity: PEEKQA_DROPDOWN_FIELD_OPTIONS.Severity,
};

const REQUIRED_PEEKQA_FIELD_MAPPINGS = ["Expected Result", "Actual Result"];

export const CLICKUP_SYSTEM_FIELDS = [
  { id: "name", name: "Name", type: "system", required: true, isSystemField: true },
  { id: "description", name: "Description", type: "system", required: false, isSystemField: true },
  { id: "status", name: "Status", type: "system", required: false, isSystemField: true },
  { id: "priority", name: "Priority", type: "system", required: false, isSystemField: true },
  { id: "assignees", name: "Assignees", type: "system", required: false, isSystemField: true },
  { id: "due_date", name: "Due Date", type: "system", required: false, isSystemField: true },
  { id: "start_date", name: "Start Date", type: "system", required: false, isSystemField: true },
  { id: "tags", name: "Tags", type: "system", required: false, isSystemField: true },
];

export const DEFAULT_CLICKUP_STATUS_MAPPINGS = {
  New: "to_do",
  "In Progress": "in_progress",
  Fixed: "ready_for_test",
  Reopened: "in_review",
  Rejected: "done",
  "Change Request": "in_progress",
  Closed: "done",
};

export const DEFAULT_CLICKUP_PRIORITY_MAPPINGS = {
  Low: "low",
  Medium: "normal",
  High: "high",
  Critical: "urgent",
};

export const DEFAULT_CLICKUP_MAPPINGS = {
  status: "",
  priority: "",
  assignees: "",
  due_date: "",
  start_date: "",
  tags: "",
};

export const DEFAULT_CLICKUP_CONFIG = {
  token: "",
  enabled: false,
  validationStatus: "not-validated",
  hasStoredToken: false,
  workspace: null,
  space: null,
  list: null,
  customItem: null,
  mappings: { ...DEFAULT_CLICKUP_MAPPINGS },
  fieldMappings: [],
  statusMappings: { ...DEFAULT_CLICKUP_STATUS_MAPPINGS },
  priorityMappings: { ...DEFAULT_CLICKUP_PRIORITY_MAPPINGS },
  customFieldValueMappings: {},
  workspaces: [],
  spaces: [],
  lists: [],
  customItems: [],
  availableFields: [],
  availableStatuses: [],
  availablePriorities: [],
};

export function normalizeClickUpConfig(config = {}) {
  return {
    ...DEFAULT_CLICKUP_CONFIG,
    ...config,
    mappings: config?.mappings && typeof config.mappings === "object" ? { ...DEFAULT_CLICKUP_MAPPINGS, ...config.mappings } : { ...DEFAULT_CLICKUP_MAPPINGS },
    fieldMappings: Array.isArray(config?.fieldMappings) ? config.fieldMappings : [],
    statusMappings: config?.statusMappings && typeof config.statusMappings === "object" ? { ...DEFAULT_CLICKUP_STATUS_MAPPINGS, ...config.statusMappings } : { ...DEFAULT_CLICKUP_STATUS_MAPPINGS },
    priorityMappings: config?.priorityMappings && typeof config.priorityMappings === "object" ? { ...DEFAULT_CLICKUP_PRIORITY_MAPPINGS, ...config.priorityMappings } : { ...DEFAULT_CLICKUP_PRIORITY_MAPPINGS },
    customFieldValueMappings:
      config?.customFieldValueMappings && typeof config.customFieldValueMappings === "object"
        ? config.customFieldValueMappings
        : {},
    workspaces: Array.isArray(config?.workspaces) ? config.workspaces : [],
    spaces: Array.isArray(config?.spaces) ? config.spaces : [],
    lists: Array.isArray(config?.lists) ? config.lists : [],
    customItems: Array.isArray(config?.customItems) ? config.customItems : [],
    availableFields: Array.isArray(config?.availableFields) ? config.availableFields : [],
    availableStatuses: Array.isArray(config?.availableStatuses) ? config.availableStatuses : [],
    availablePriorities: Array.isArray(config?.availablePriorities) ? config.availablePriorities : [],
  };
}

export function buildClickUpFieldRows(availableFields = []) {
  const merged = new Map();

  CLICKUP_SYSTEM_FIELDS.forEach((field) => {
    merged.set(String(field.id), field);
  });

  (availableFields || []).forEach((field) => {
    if (!field?.id) return;

    const normalizedId = String(field.id);
    const normalizedOptions = Array.isArray(field.options)
      ? field.options
        .map((option) => {
          const value = String(option?.value || option?.id || "").trim();
          const label = String(option?.label || option?.name || option?.value || option?.id || "").trim();
          return value ? { value, label: label || value } : null;
        })
        .filter(Boolean)
      : [];

    const existing = merged.get(normalizedId);
    if (existing) {
      merged.set(normalizedId, {
        ...existing,
        type: field.type || existing.type || "custom",
        required: Boolean(field.required) || Boolean(existing.required),
        isSystemField: Boolean(field.isSystemField) || Boolean(existing.isSystemField),
        options: normalizedOptions.length > 0 ? normalizedOptions : (existing.options || []),
      });
      return;
    }

    if (!merged.has(normalizedId)) {
      merged.set(normalizedId, {
        id: normalizedId,
        name: field.name || normalizedId,
        type: field.type || "custom",
        required: Boolean(field.required),
        isSystemField: Boolean(field.isSystemField),
        options: normalizedOptions,
      });
    }
  });

  return Array.from(merged.values());
}

async function readErrorMessage(response) {
  const text = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return parsed?.clickUpMessage || parsed?.message || parsed?.detail || parsed?.error || text || getClickUpFriendlyErrorMessage(response.status);
}

export function canEnableClickUpIntegration(config = {}) {
  const hasToken = Boolean(String(config.token || "").trim()) || Boolean(config.hasStoredToken);
  return (
    hasToken
    && config.validationStatus === "valid"
    && Boolean(config.workspace?.id)
    && Boolean(config.space?.id)
  );
}

export function getClickUpMappingValidationErrors(config = {}) {
  const mappings = config?.mappings || {};
  const availableFields = buildClickUpFieldRows(config?.availableFields || []);
  const errors = [];
  const mappedPeekQaFields = new Set();

  const assignedByPeekQaField = new Map();
  availableFields.forEach((field) => {
    if (field.id === "assignees") {
      return;
    }

    const mappedField = String(mappings?.[field.id] || "").trim();
    if (!mappedField) return;

    mappedPeekQaFields.add(mappedField);

    if (!assignedByPeekQaField.has(mappedField)) {
      assignedByPeekQaField.set(mappedField, []);
    }

    assignedByPeekQaField.get(mappedField).push(field.name || field.id);
  });

  REQUIRED_PEEKQA_FIELD_MAPPINGS.forEach((requiredPeekQaField) => {
    if (!mappedPeekQaFields.has(requiredPeekQaField)) {
      errors.push(`PeekQA field "${requiredPeekQaField}" must be mapped to a ClickUp field.`);
    }
  });

  assignedByPeekQaField.forEach((clickUpFields, peekQaField) => {
    if (clickUpFields.length > 1) {
      errors.push(`PeekQA field \"${peekQaField}\" is mapped more than once (${clickUpFields.join(", ")}).`);
    }
  });

  availableFields.forEach((field) => {
    if (field.id === "assignees") {
      return;
    }

    const mappedPeekQaField = String(mappings?.[field.id] || "").trim();
    if (!mappedPeekQaField || !(mappedPeekQaField in REQUIRED_CLICKUP_VALUE_MAPPINGS)) {
      return;
    }

    const requiredValues = REQUIRED_CLICKUP_VALUE_MAPPINGS[mappedPeekQaField] || [];
    const valueMappings = config?.customFieldValueMappings?.[field.id] || {};
    requiredValues.forEach((peekQaValue) => {
      if (!String(valueMappings?.[peekQaValue] || "").trim()) {
        errors.push(`ClickUp field \"${field.name || field.id}\" mapped to PeekQA \"${mappedPeekQaField}\" must map value \"${peekQaValue}\".`);
      }
    });
  });

  return errors;
}

export function getClickUpFriendlyErrorMessage(statusOrError, fallback = "We could not verify your ClickUp connection.") {
  if (statusOrError === "NETWORK_ERROR") {
    return "We could not reach the PeekQA API. Please check your network connection and try again.";
  }

  if (statusOrError === "TIMEOUT") {
    return "The ClickUp request timed out. Please try again in a moment.";
  }

  if (statusOrError === 401 || statusOrError === "UNAUTHORIZED") {
    return "Your ClickUp API token is invalid or unauthorized. Please verify it and try again.";
  }

  if (statusOrError === 403 || statusOrError === "FORBIDDEN") {
    return "ClickUp rejected the request. Please verify that the token has permission to access your workspace.";
  }

  if (statusOrError === 404 || statusOrError === "NOT_FOUND") {
    return "ClickUp could not find the requested resource. Please verify your workspace and space selection.";
  }

  if (statusOrError === 429 || statusOrError === "RATE_LIMIT") {
    return "ClickUp is temporarily rate limiting requests. Please wait a moment and try again.";
  }

  if (statusOrError === 500 || statusOrError === "SERVER_ERROR") {
    return "ClickUp is currently unavailable. Please try again shortly.";
  }

  if (typeof statusOrError === "number" && statusOrError >= 400) {
    return fallback;
  }

  return fallback;
}

export async function getClickUpIntegrationConfig() {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/integration`), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function validateClickUpConnection(token) {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/validate`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function fetchClickUpWorkspaces(token) {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/workspaces`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { "X-ClickUp-Token": token } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function fetchClickUpSpaces(workspaceId, token) {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/workspaces/${encodeURIComponent(workspaceId)}/spaces`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { "X-ClickUp-Token": token } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function fetchClickUpSpaceMetadata(workspaceId, spaceId, token, listId = null) {
  const query = new URLSearchParams();
  if (listId) query.set("listId", listId);

  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/workspaces/${encodeURIComponent(workspaceId)}/spaces/${encodeURIComponent(spaceId)}/metadata${query.toString() ? `?${query.toString()}` : ""}`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { "X-ClickUp-Token": token } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function fetchClickUpLists(workspaceId, spaceId, token, folderId = null) {
  const query = new URLSearchParams();
  if (folderId) query.set("folderId", folderId);

  const response = await fetchWithTimeout(
    buildClickUpApiUrl(`${BASE}/clickup/workspaces/${encodeURIComponent(workspaceId)}/spaces/${encodeURIComponent(spaceId)}/lists${query.toString() ? `?${query.toString()}` : ""}`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { "X-ClickUp-Token": token } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function fetchClickUpCustomItems(workspaceId, token) {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/workspaces/${encodeURIComponent(workspaceId)}/custom-items`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { "X-ClickUp-Token": token } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function fetchClickUpListTasks(listId, token) {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/lists/${encodeURIComponent(listId)}/tasks`), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { "X-ClickUp-Token": token } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function syncDefectToClickUp(defectId, options = {}) {
  const payload = {
    parentTaskId: options?.parentTaskId || null,
    listId: options?.listId || null,
    customItemId: options?.customItemId || null,
  };

  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/defects/${encodeURIComponent(defectId)}/sync`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function unlinkDefectFromClickUp(defectId) {
  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/defects/${encodeURIComponent(defectId)}/unlink`), {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}

export async function saveClickUpIntegration(config) {
  const normalized = normalizeClickUpConfig(config);

  const fieldMappings = Array.isArray(normalized.fieldMappings) && normalized.fieldMappings.length > 0
    ? normalized.fieldMappings.map((field) => ({
      ...field,
      valueMappings: field.valueMappings || normalized.customFieldValueMappings?.[field.clickUpFieldId] || normalized.customFieldValueMappings?.[field.id] || {},
    }))
    : (Array.isArray(normalized.availableFields) ? normalized.availableFields : []).map((field) => ({
        clickUpFieldId: field.id,
        clickUpFieldName: field.name || field.id,
        clickUpFieldType: field.type || "custom",
        peekQaFieldName: normalized.mappings?.[field.id] || "",
        isRequired: Boolean(field.required),
        isSystemField: Boolean(field.isSystemField),
        valueMappings: normalized.customFieldValueMappings?.[field.id] || {},
      }));

  const response = await fetchWithTimeout(buildClickUpApiUrl(`${BASE}/clickup/integration`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      token: normalized.token,
      enabled: Boolean(normalized.enabled),
      validationStatus: normalized.validationStatus,
      workspace: normalized.workspace ? { id: normalized.workspace.id, name: normalized.workspace.name } : null,
      space: normalized.space ? { id: normalized.space.id, name: normalized.space.name } : null,
      list: normalized.list ? { id: normalized.list.id, name: normalized.list.name } : null,
      customItem: normalized.customItem ? { id: normalized.customItem.id, name: normalized.customItem.name } : null,
      mappings: normalized.mappings || {},
      fieldMappings,
      statusMappings: normalized.statusMappings || {},
      priorityMappings: normalized.priorityMappings || {},
      customFieldValueMappings: normalized.customFieldValueMappings || {},
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json();
}