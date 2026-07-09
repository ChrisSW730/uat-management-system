/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  buildClickUpFieldRows,
  canEnableClickUpIntegration,
  DEFAULT_CLICKUP_CONFIG,
  PEEKQA_DROPDOWN_FIELD_OPTIONS,
  fetchClickUpCustomItems,
  fetchClickUpLists,
  fetchClickUpSpaceMetadata,
  fetchClickUpSpaces,
  getClickUpFriendlyErrorMessage,
  getClickUpMappingValidationErrors,
  normalizeClickUpConfig,
  PEEKQA_DEFECT_FIELDS,
  saveClickUpIntegration,
  validateClickUpConnection,
} from "../../services/clickupService";
import { DEFECT_STATUS } from "../../constants";

const PEEKQA_STATUS_OPTIONS = Object.keys(DEFECT_STATUS);
const PEEKQA_PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];

function normalizeFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toOptionList(values = []) {
  return (values || [])
    .map((item) => ({
      value: String(item?.value || item?.id || item?.name || item?.label || "").trim(),
      label: String(item?.label || item?.name || item?.value || item?.id || "").trim(),
    }))
    .filter((item) => item.value);
}

function autoPopulateMatchingFieldMappings(availableFields = [], currentMappings = {}) {
  const nextMappings = { ...(currentMappings || {}) };
  const usedPeekQaFields = new Set(
    Object.values(nextMappings)
      .map((value) => normalizeFieldName(value))
      .filter(Boolean)
  );

  const peekQaFieldByName = new Map(
    PEEKQA_DEFECT_FIELDS.map((field) => [normalizeFieldName(field.value), field.value])
  );

  (availableFields || []).forEach((field) => {
    const fieldId = String(field?.id || "").trim();
    if (!fieldId || fieldId === "name" || fieldId === "description" || fieldId === "assignees") {
      return;
    }

    if (String(nextMappings[fieldId] || "").trim()) {
      return;
    }

    const matchedPeekQaField = peekQaFieldByName.get(normalizeFieldName(field?.name || ""));
    if (!matchedPeekQaField) {
      return;
    }

    const normalizedPeekQaField = normalizeFieldName(matchedPeekQaField);
    if (usedPeekQaFields.has(normalizedPeekQaField)) {
      return;
    }

    nextMappings[fieldId] = matchedPeekQaField;
    usedPeekQaFields.add(normalizedPeekQaField);
  });

  return nextMappings;
}

function autoPopulateSameNameStatusMappings(statusValues = [], currentMappings = {}) {
  const nextMappings = { ...(currentMappings || {}) };
  const statusOptions = toOptionList(statusValues);
  const clickUpByName = new Map();
  statusOptions.forEach((option) => {
    clickUpByName.set(normalizeFieldName(option.label || option.value), option.value);
    clickUpByName.set(normalizeFieldName(option.value), option.value);
  });

  const availableClickUpValues = new Set(statusOptions.map((option) => option.value));

  PEEKQA_STATUS_OPTIONS.forEach((peekQaStatus) => {
    const currentValue = String(nextMappings[peekQaStatus] || "").trim();
    if (currentValue && availableClickUpValues.has(currentValue)) {
      return;
    }

    const matchedClickUpValue = clickUpByName.get(normalizeFieldName(peekQaStatus));
    if (matchedClickUpValue) {
      nextMappings[peekQaStatus] = matchedClickUpValue;
    }
  });

  return nextMappings;
}

function autoPopulateSameNamePriorityMappings(priorityValues = [], currentMappings = {}) {
  const nextMappings = { ...(currentMappings || {}) };
  const priorityOptions = toOptionList(priorityValues);
  const clickUpByName = new Map();
  priorityOptions.forEach((option) => {
    clickUpByName.set(normalizeFieldName(option.label || option.value), option.value);
    clickUpByName.set(normalizeFieldName(option.value), option.value);
  });

  const availableClickUpValues = new Set(priorityOptions.map((option) => option.value));

  PEEKQA_PRIORITY_OPTIONS.forEach((peekQaPriority) => {
    const currentValue = String(nextMappings[peekQaPriority] || "").trim();
    if (currentValue && availableClickUpValues.has(currentValue)) {
      return;
    }

    const matchedClickUpValue = clickUpByName.get(normalizeFieldName(peekQaPriority));
    if (matchedClickUpValue) {
      nextMappings[peekQaPriority] = matchedClickUpValue;
    }
  });

  return nextMappings;
}

function autoPopulateDropdownValueMappings(availableFields = [], mappings = {}, currentValueMappings = {}) {
  const nextValueMappings = { ...(currentValueMappings || {}) };

  (availableFields || []).forEach((field) => {
    const fieldId = String(field?.id || "").trim();
    if (!fieldId) {
      return;
    }

    const fieldType = String(field?.type || "").toLowerCase();
    const isDropdownField = ["drop_down", "dropdown", "labels"].includes(fieldType);
    if (!isDropdownField) {
      return;
    }

    const mappedPeekQaField = String(mappings?.[fieldId] || "").trim();
    const peekQaOptions = PEEKQA_DROPDOWN_FIELD_OPTIONS[mappedPeekQaField] || [];
    if (!mappedPeekQaField || peekQaOptions.length === 0) {
      return;
    }

    const clickUpOptions = toOptionList(field.options || []);
    if (clickUpOptions.length === 0) {
      return;
    }

    const clickUpByName = new Map();
    clickUpOptions.forEach((option) => {
      clickUpByName.set(normalizeFieldName(option.label || option.value), option.value);
      clickUpByName.set(normalizeFieldName(option.value), option.value);
    });

    const existingMap = { ...(nextValueMappings[fieldId] || {}) };
    const availableClickUpValues = new Set(clickUpOptions.map((option) => option.value));

    peekQaOptions.forEach((peekQaOption) => {
      const currentMapped = String(existingMap[peekQaOption] || "").trim();
      if (currentMapped && availableClickUpValues.has(currentMapped)) {
        return;
      }

      const matchedClickUpValue = clickUpByName.get(normalizeFieldName(peekQaOption));
      if (matchedClickUpValue) {
        existingMap[peekQaOption] = matchedClickUpValue;
      }
    });

    nextValueMappings[fieldId] = existingMap;
  });

  return nextValueMappings;
}

export default function ClickUpIntegrationModal({ config, onClose, onSave }) {
  const [form, setForm] = useState(() => normalizeClickUpConfig(config || DEFAULT_CLICKUP_CONFIG));
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingCustomItems, setIsLoadingCustomItems] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const INVALID_TOKEN_MESSAGE = "Unable to connect ClickUp, please enter valid API Token";

  useEffect(() => {
    const normalized = normalizeClickUpConfig(config || DEFAULT_CLICKUP_CONFIG);
    setShowFieldMapping(false);
    setForm({
      ...normalized,
      mappings: {
        ...(normalized.mappings || {}),
        assignees: "",
      },
    });
  }, [config]);

  const canEnableToggle = useMemo(() => canEnableClickUpIntegration(form), [form]);
  const mappingErrors = useMemo(() => getClickUpMappingValidationErrors(form), [form]);
  const canSave = (!form.enabled || canEnableToggle) && mappingErrors.length === 0;
  const isConnected = form.validationStatus === "valid";
  const showWorkspaceSection = form.validationStatus === "valid";
  const showSpaceSection = showWorkspaceSection;
  const showMappingSection = showWorkspaceSection && Boolean(form.workspace?.id) && Boolean(form.space?.id) && showFieldMapping;
  const statusTone = form.validationStatus === "valid" ? "#16a34a" : form.validationStatus === "invalid" ? "#dc2626" : "#64748b";
  const statusLabel = form.validationStatus === "valid" ? "Connected" : form.validationStatus === "invalid" ? "Invalid API Token" : "Not Connected";
  const availableFieldRows = useMemo(() => buildClickUpFieldRows(form.availableFields), [form.availableFields]);

  const statusOptions = useMemo(() => {
    const options = (form.availableStatuses || [])
      .map((item) => ({ value: String(item?.value || item?.id || item?.name || item?.label || "").trim(), label: String(item?.label || item?.name || item?.value || item?.id || "").trim() }))
      .filter((item) => item.value);

    if (options.length > 0) {
      return options;
    }

    return [
      { value: "to_do", label: "To Do" },
      { value: "in_progress", label: "In Progress" },
      { value: "ready_for_test", label: "Ready for Test" },
      { value: "in_review", label: "In Review" },
      { value: "done", label: "Done" },
    ];
  }, [form.availableStatuses]);

  const priorityOptions = useMemo(() => {
    const options = (form.availablePriorities || [])
      .map((item) => ({ value: String(item?.value || item?.id || item?.name || item?.label || "").trim(), label: String(item?.label || item?.name || item?.value || item?.id || "").trim() }))
      .filter((item) => item.value);

    if (options.length > 0) {
      return options;
    }

    return [
      { value: "low", label: "Low" },
      { value: "normal", label: "Normal" },
      { value: "high", label: "High" },
      { value: "urgent", label: "Urgent" },
    ];
  }, [form.availablePriorities]);

  const updateForm = (patch) => setForm((current) => normalizeClickUpConfig({ ...current, ...patch }));

  const handleTokenChange = (value) => {
    updateForm({
      token: value,
      enabled: Boolean(form.enabled),
      validationStatus: "not-validated",
      hasStoredToken: false,
      workspace: null,
      space: null,
      list: null,
      customItem: null,
      workspaces: [],
      spaces: [],
      lists: [],
      customItems: [],
      availableFields: [],
      availableStatuses: [],
      availablePriorities: [],
      mappings: { ...DEFAULT_CLICKUP_CONFIG.mappings },
      statusMappings: { ...DEFAULT_CLICKUP_CONFIG.statusMappings },
      priorityMappings: { ...DEFAULT_CLICKUP_CONFIG.priorityMappings },
      customFieldValueMappings: {},
    });
    setErrorMessage("");
    if (form.enabled) {
      setValidationMessage("Please validate your ClickUp API Token.");
    } else {
      setValidationMessage("");
    }
  };

  const handleValidate = async () => {
    if (!form.enabled) {
      setErrorMessage("Turn on ClickUp Integration first.");
      return;
    }

    if (!form.token.trim()) {
      setErrorMessage(INVALID_TOKEN_MESSAGE);
      return;
    }

    setIsValidating(true);
    setErrorMessage("");
    setValidationMessage("");

    try {
      const validationResult = await validateClickUpConnection(form.token.trim());
      updateForm({
        validationStatus: validationResult.validationStatus || "valid",
        enabled: true,
        hasStoredToken: Boolean(validationResult.hasStoredToken),
        workspace: null,
        space: null,
        list: null,
        customItem: null,
        workspaces: validationResult.workspaces || [],
        spaces: [],
        lists: [],
        customItems: [],
        availableFields: [],
        availableStatuses: [],
        availablePriorities: [],
        customFieldValueMappings: {},
      });
      setValidationMessage("ClickUp connection verified. Toggle remains enabled. Select a workspace and space to continue.");
    } catch (error) {
      updateForm({
        enabled: false,
        validationStatus: "invalid",
        hasStoredToken: false,
        workspace: null,
        space: null,
        list: null,
        customItem: null,
        workspaces: [],
        spaces: [],
        lists: [],
        customItems: [],
        availableFields: [],
        availableStatuses: [],
        availablePriorities: [],
        customFieldValueMappings: {},
      });
      setErrorMessage(INVALID_TOKEN_MESSAGE);
      setValidationMessage("");
    } finally {
      setIsValidating(false);
      setIsLoadingWorkspaces(false);
    }
  };

  const handleWorkspaceChange = async (event) => {
    const workspaceId = event.target.value;
    const workspace = form.workspaces.find((item) => String(item.id) === String(workspaceId)) || null;

    updateForm({
      workspace,
      space: null,
      list: null,
      customItem: null,
      spaces: [],
      lists: [],
      customItems: [],
      availableFields: [],
      availableStatuses: [],
      availablePriorities: [],
      mappings: { ...DEFAULT_CLICKUP_CONFIG.mappings },
      statusMappings: { ...DEFAULT_CLICKUP_CONFIG.statusMappings },
      priorityMappings: { ...DEFAULT_CLICKUP_CONFIG.priorityMappings },
      customFieldValueMappings: {},
    });
    setErrorMessage("");

    if (!workspace?.id) return;

    setIsLoadingSpaces(true);
    setIsLoadingCustomItems(true);
    try {
      const [nextSpaces, nextCustomItems] = await Promise.all([
        fetchClickUpSpaces(workspace.id, form.token.trim()),
        fetchClickUpCustomItems(workspace.id, form.token.trim()),
      ]);
      updateForm({ spaces: nextSpaces, customItems: nextCustomItems });
    } catch (error) {
      setErrorMessage(error.message || getClickUpFriendlyErrorMessage(error.message || error, "We could not load ClickUp spaces."));
    } finally {
      setIsLoadingSpaces(false);
      setIsLoadingCustomItems(false);
    }
  };

  const handleSpaceChange = async (event) => {
    const spaceId = event.target.value;
    const space = form.spaces.find((item) => String(item.id) === String(spaceId)) || null;
    updateForm({
      space,
      list: null,
      lists: [],
      availableFields: [],
      availableStatuses: [],
      availablePriorities: [],
      mappings: { ...DEFAULT_CLICKUP_CONFIG.mappings },
      statusMappings: { ...DEFAULT_CLICKUP_CONFIG.statusMappings },
      priorityMappings: { ...DEFAULT_CLICKUP_CONFIG.priorityMappings },
      customFieldValueMappings: {},
    });
    setErrorMessage("");

    if (!space?.id || !form.workspace?.id) return;

    setIsLoadingLists(true);
    setIsLoadingMetadata(true);
    try {
      const [lists, metadata] = await Promise.all([
        fetchClickUpLists(form.workspace.id, space.id, form.token.trim()),
        fetchClickUpSpaceMetadata(form.workspace.id, space.id, form.token.trim(), null),
      ]);

      const nextAvailableFields = Array.isArray(metadata?.fields) ? metadata.fields : [];
      const nextAvailableStatuses = Array.isArray(metadata?.statuses) ? metadata.statuses : [];
      const nextAvailablePriorities = Array.isArray(metadata?.priorities) ? metadata.priorities : [];
      const nextMappings = autoPopulateMatchingFieldMappings(buildClickUpFieldRows(nextAvailableFields), form.mappings || {});

      updateForm({
        lists,
        availableFields: nextAvailableFields,
        availableStatuses: nextAvailableStatuses,
        availablePriorities: nextAvailablePriorities,
        mappings: nextMappings,
        statusMappings: autoPopulateSameNameStatusMappings(nextAvailableStatuses, form.statusMappings || {}),
        priorityMappings: autoPopulateSameNamePriorityMappings(nextAvailablePriorities, form.priorityMappings || {}),
        customFieldValueMappings: autoPopulateDropdownValueMappings(nextAvailableFields, nextMappings, form.customFieldValueMappings || {}),
      });
      setValidationMessage("ClickUp metadata loaded. You can map fields now.");
    } catch (error) {
      setErrorMessage(error.message || getClickUpFriendlyErrorMessage(error.message || error, "We could not load ClickUp space metadata."));
    } finally {
      setIsLoadingLists(false);
      setIsLoadingMetadata(false);
    }
  };

  const handleListChange = async (event) => {
    const listId = event.target.value;
    const list = form.lists.find((item) => String(item.id) === String(listId)) || null;

    updateForm({
      list,
      availableFields: [],
      availableStatuses: [],
      availablePriorities: [],
      mappings: { ...DEFAULT_CLICKUP_CONFIG.mappings },
      statusMappings: { ...DEFAULT_CLICKUP_CONFIG.statusMappings },
      priorityMappings: { ...DEFAULT_CLICKUP_CONFIG.priorityMappings },
      customFieldValueMappings: {},
    });

    if (!list?.id || !form.workspace?.id || !form.space?.id) return;

    setIsLoadingMetadata(true);
    try {
      const metadata = await fetchClickUpSpaceMetadata(form.workspace.id, form.space.id, form.token.trim(), list.id);

      const nextAvailableFields = Array.isArray(metadata?.fields) ? metadata.fields : [];
      const nextAvailableStatuses = Array.isArray(metadata?.statuses) ? metadata.statuses : [];
      const nextAvailablePriorities = Array.isArray(metadata?.priorities) ? metadata.priorities : [];
      const nextMappings = autoPopulateMatchingFieldMappings(buildClickUpFieldRows(nextAvailableFields), form.mappings || {});

      updateForm({
        availableFields: nextAvailableFields,
        availableStatuses: nextAvailableStatuses,
        availablePriorities: nextAvailablePriorities,
        mappings: nextMappings,
        statusMappings: autoPopulateSameNameStatusMappings(nextAvailableStatuses, form.statusMappings || {}),
        priorityMappings: autoPopulateSameNamePriorityMappings(nextAvailablePriorities, form.priorityMappings || {}),
        customFieldValueMappings: autoPopulateDropdownValueMappings(nextAvailableFields, nextMappings, form.customFieldValueMappings || {}),
      });
      setValidationMessage("ClickUp field metadata loaded. Complete the mapping configuration below.");
    } catch (error) {
      setErrorMessage(error.message || getClickUpFriendlyErrorMessage(error.message || error, "We could not load ClickUp field metadata."));
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleCustomItemChange = (event) => {
    const customItemId = event.target.value;
    const customItem = form.customItems.find((item) => String(item.id) === String(customItemId)) || null;
    updateForm({ customItem });
  };

  const handleFieldMappingChange = (fieldId, value) => {
    const nextMappings = {
      ...form.mappings,
      [fieldId]: value,
    };

    updateForm({
      mappings: nextMappings,
      customFieldValueMappings: autoPopulateDropdownValueMappings(form.availableFields || [], nextMappings, form.customFieldValueMappings || {}),
    });
    setErrorMessage("");
  };

  const handleOptionMappingFromClickUp = (fieldId, clickUpValue, peekQaValue) => {
    const currentMap = form.customFieldValueMappings?.[fieldId] || {};
    const nextMap = Object.fromEntries(
      Object.entries(currentMap).filter(([, mappedClickUpValue]) => mappedClickUpValue !== clickUpValue)
    );

    if (peekQaValue) {
      nextMap[peekQaValue] = clickUpValue;
    }

    updateForm({
      customFieldValueMappings: {
        ...(form.customFieldValueMappings || {}),
        [fieldId]: nextMap,
      },
    });
  };

  const handleStatusMappingFromClickUp = (clickUpStatusValue, peekQaStatus) => {
    const currentMappings = form.statusMappings || {};
    const nextMappings = Object.fromEntries(
      Object.entries(currentMappings).filter(([, mappedClickUpValue]) => mappedClickUpValue !== clickUpStatusValue)
    );

    if (peekQaStatus) {
      nextMappings[peekQaStatus] = clickUpStatusValue;
    }

    updateForm({ statusMappings: nextMappings });
  };

  const handlePriorityMappingFromClickUp = (clickUpPriorityValue, peekQaPriority) => {
    const currentMappings = form.priorityMappings || {};
    const nextMappings = Object.fromEntries(
      Object.entries(currentMappings).filter(([, mappedClickUpValue]) => mappedClickUpValue !== clickUpPriorityValue)
    );

    if (peekQaPriority) {
      nextMappings[peekQaPriority] = clickUpPriorityValue;
    }

    updateForm({ priorityMappings: nextMappings });
  };

  const handleToggle = (event) => {
    const nextEnabled = event.target.checked;
    updateForm({ enabled: nextEnabled });
    setErrorMessage("");
    if (!nextEnabled) {
      setShowFieldMapping(false);
    }
    if (nextEnabled) {
      setValidationMessage("Enter ClickUp API Token and click Link to ClickUp.");
    } else {
      setValidationMessage("");
    }
  };

  const handleUnlink = () => {
    if (!window.confirm("Unlink ClickUp integration? This will clear the current connection and mapping selections in this dialog.")) {
      return;
    }

    setShowFieldMapping(false);
    setErrorMessage("");
    setValidationMessage("");
    setForm(
      normalizeClickUpConfig({
        ...DEFAULT_CLICKUP_CONFIG,
        mappings: {
          ...DEFAULT_CLICKUP_CONFIG.mappings,
          assignees: "",
        },
      })
    );
  };

  const handleSave = async () => {
    if (!canSave) {
      setErrorMessage(mappingErrors.join(" ") || "Complete the required mapping configuration before saving.");
      return;
    }

    try {
      const normalized = normalizeClickUpConfig(form);
      const payload = await saveClickUpIntegration({
        ...normalized,
        mappings: {
          ...(normalized.mappings || {}),
          assignees: "",
        },
      });

      const persistedConfig = normalizeClickUpConfig({
        ...normalized,
        ...payload,
        token: normalized.token,
        hasStoredToken: true,
        workspaces: normalized.workspaces,
        spaces: normalized.spaces,
        lists: normalized.lists,
        customItems: normalized.customItems,
        availableFields: normalized.availableFields,
        availableStatuses: normalized.availableStatuses,
        availablePriorities: normalized.availablePriorities,
      });

      setForm(persistedConfig);
      setErrorMessage("");
      setValidationMessage("ClickUp settings saved successfully.");
      onSave?.(persistedConfig);
    } catch (error) {
      setErrorMessage(error.message || "We could not save the ClickUp settings.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Enable ClickUp Integration</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.5 }}>Validate your token first, then select a workspace and space before enabling the integration.</div>
        </div>
        <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer", flexShrink: 0, marginLeft: 16 }}>
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            onChange={handleToggle}
            style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
          />
          <span style={{ position: "absolute", inset: 0, background: form.enabled ? "#7c3aed" : "#cbd5e1", borderRadius: 24, transition: "background 0.2s" }} />
          <span style={{ position: "absolute", top: 3, left: form.enabled ? 23 : 3, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </label>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
          API Token
        </label>
        <input
          type="password"
          value={form.token}
          onChange={(event) => handleTokenChange(event.target.value)}
          placeholder="Paste your ClickUp API token"
          readOnly={isConnected}
          disabled={!form.enabled}
          style={{ width: "100%", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isConnected && (
              <button type="button" onClick={handleValidate} disabled={!form.enabled || isValidating} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 700, cursor: !form.enabled || isValidating ? "not-allowed" : "pointer", opacity: !form.enabled || isValidating ? 0.7 : 1 }}>
                {isValidating ? "Validating…" : "Link to ClickUp"}
              </button>
            )}
            {isConnected && (
              <>
                <button
                  type="button"
                  onClick={() => setShowFieldMapping((current) => !current)}
                  style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Field Mapping
                </button>
                <button
                  type="button"
                  onClick={handleUnlink}
                  style={{ background: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Unlink
                </button>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: statusTone, fontSize: 13, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusTone, display: "inline-block" }} />
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>

      {showWorkspaceSection && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
              Workspace
            </label>
            <select
              value={form.workspace?.id || ""}
              onChange={handleWorkspaceChange}
              disabled={isLoadingWorkspaces || isValidating}
              style={{ width: "100%", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
            >
              <option value="">Select a workspace</option>
              {form.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            {isLoadingWorkspaces && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Loading workspaces…</div>}
          </div>

          {showSpaceSection && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                Space
              </label>
              <select
                value={form.space?.id || ""}
                onChange={handleSpaceChange}
                disabled={!form.workspace?.id || isLoadingSpaces}
                style={{ width: "100%", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
              >
                <option value="">Select a space</option>
                {form.spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              {isLoadingSpaces && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Loading spaces…</div>}
            </div>
          )}

        </div>
      )}

      {showMappingSection && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Field Mapping</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Left side is ClickUp field, right side maps to a PeekQA field. Name and description are always mapped to PeekQA Defect Title and Description.</div>
          {mappingErrors.length > 0 && (
            <div style={{ marginBottom: 12, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              {mappingErrors.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </div>
          )}
          {isLoadingMetadata && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Loading ClickUp field metadata…</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>ClickUp Field</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>PeekQA Field</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {availableFieldRows.map((field) => {
              const mappedPeekQaField = form.mappings?.[field.id] || "";
              const isDropdownField = ["drop_down", "dropdown", "labels"].includes(String(field.type || "").toLowerCase());
              const peekQaOptions = PEEKQA_DROPDOWN_FIELD_OPTIONS[mappedPeekQaField] || [];
              const isAutoMappedField = field.id === "name" || field.id === "description";
              const isAutoResolvedAssigneeField = field.id === "assignees";
              const autoMappedValue = field.id === "name" ? "Defect Title" : field.id === "description" ? "Description" : "";

              return (
                <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{field.name}</div>
                      <div style={{ fontSize: 11, color: field.required ? "#ef4444" : "#64748b", marginTop: 2 }}>{field.required ? "Required" : field.isSystemField ? "System Field" : "Custom Field"}</div>
                    </div>
                    {isAutoMappedField ? (
                      <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#334155", fontWeight: 600 }}>
                        {autoMappedValue}
                      </div>
                    ) : isAutoResolvedAssigneeField ? (
                      <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#475569" }}>
                        Auto-resolved from PeekQA Assigned To display name via user email match
                      </div>
                    ) : (
                      <select
                        value={mappedPeekQaField}
                        onChange={(event) => handleFieldMappingChange(field.id, event.target.value)}
                        style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                      >
                        <option value="">(Not Mapped)</option>
                        {PEEKQA_DEFECT_FIELDS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {isDropdownField && mappedPeekQaField && !isAutoMappedField && !isAutoResolvedAssigneeField && peekQaOptions.length > 0 && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Dropdown Option Mapping (ClickUp option to PeekQA value)</div>
                      {(field.options || []).map((option) => {
                        const selectedPeekQaValue = peekQaOptions.find((peekQaValue) => form.customFieldValueMappings?.[field.id]?.[peekQaValue] === option.value) || "";

                        return (
                        <div key={`${field.id}-${option.value}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 12, color: "#334155" }}>{option.label}</div>
                          <select
                            value={selectedPeekQaValue}
                            onChange={(event) => handleOptionMappingFromClickUp(field.id, option.value, event.target.value)}
                            style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                          >
                            <option value="">(Optional)</option>
                            {peekQaOptions.map((peekQaValue) => (
                              <option key={peekQaValue} value={peekQaValue}>
                                {peekQaValue}
                              </option>
                            ))}
                          </select>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {field.id === "status" && String(mappedPeekQaField).trim().toLowerCase() === "status" && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Status Value Mapping (ClickUp status to PeekQA status)</div>
                      {statusOptions.map((clickUpStatus) => {
                        const selectedPeekQaStatus = PEEKQA_STATUS_OPTIONS.find((peekQaStatus) => form.statusMappings?.[peekQaStatus] === clickUpStatus.value) || "";

                        return (
                          <div key={`status-${clickUpStatus.value}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center" }}>
                            <div style={{ fontSize: 12, color: "#334155" }}>{clickUpStatus.label}</div>
                            <select
                              value={selectedPeekQaStatus}
                              onChange={(event) => handleStatusMappingFromClickUp(clickUpStatus.value, event.target.value)}
                              style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                            >
                              <option value="">(Optional)</option>
                              {PEEKQA_STATUS_OPTIONS.map((peekQaStatus) => (
                                <option key={peekQaStatus} value={peekQaStatus}>
                                  {peekQaStatus}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {field.id === "priority" && String(mappedPeekQaField).trim().toLowerCase() === "priority" && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>Priority Value Mapping (ClickUp priority to PeekQA priority)</div>
                      {priorityOptions.map((clickUpPriority) => {
                        const selectedPeekQaPriority = PEEKQA_PRIORITY_OPTIONS.find((peekQaPriority) => form.priorityMappings?.[peekQaPriority] === clickUpPriority.value) || "";

                        return (
                          <div key={`priority-${clickUpPriority.value}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center" }}>
                            <div style={{ fontSize: 12, color: "#334155" }}>{clickUpPriority.label}</div>
                            <select
                              value={selectedPeekQaPriority}
                              onChange={(event) => handlePriorityMappingFromClickUp(clickUpPriority.value, event.target.value)}
                              style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                            >
                              <option value="">(Optional)</option>
                              {PEEKQA_PRIORITY_OPTIONS.map((peekQaPriority) => (
                                <option key={peekQaPriority} value={peekQaPriority}>
                                  {peekQaPriority}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
          {errorMessage}
        </div>
      )}

      {validationMessage && !errorMessage && (
        <div style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
          {validationMessage}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" onClick={onClose} style={{ background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Close
        </button>
        <button type="button" onClick={handleSave} disabled={!canSave} style={{ background: canSave ? "#6366f1" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed" }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
