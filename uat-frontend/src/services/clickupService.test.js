import test from "node:test";
import assert from "node:assert/strict";
import {
  canEnableClickUpIntegration,
  getClickUpFriendlyErrorMessage,
  getClickUpMappingValidationErrors,
} from "./clickupService.js";

test("requires validated token, workspace and space before enabling integration", () => {
  assert.equal(
    canEnableClickUpIntegration({
      token: "",
      hasStoredToken: true,
      validationStatus: "valid",
      workspace: { id: "workspace-1" },
      space: { id: "space-1" },
    }),
    true,
  );

  assert.equal(
    canEnableClickUpIntegration({
      token: "token",
      validationStatus: "valid",
      workspace: { id: "workspace-1" },
      space: { id: "space-1" },
    }),
    true,
  );

  assert.equal(
    canEnableClickUpIntegration({
      token: "token",
      validationStatus: "valid",
      workspace: { id: "workspace-1" },
      space: null,
    }),
    false,
  );
});

test("does not require list and custom item selection but requires Expected/Actual mappings", () => {
  const errors = getClickUpMappingValidationErrors({});
  assert.match(errors.join(" | "), /Expected Result/i);
  assert.match(errors.join(" | "), /Actual Result/i);
});

test("prevents mapping the same PeekQA field to multiple ClickUp fields", () => {
  const errors = getClickUpMappingValidationErrors({
    list: { id: "list-1" },
    customItem: { id: "3" },
    mappings: {
      custom_1: "Description",
      custom_2: "Description",
      status: "Status",
      priority: "Priority",
      assignees: "Assigned To",
      due_date: "Target Fix Date",
    },
    availableFields: [
      { id: "custom_1", name: "Custom Field 1" },
      { id: "custom_2", name: "Custom Field 2" },
    ],
  });

  assert.match(errors.join(" | "), /mapped more than once/i);
});

test("requires full ClickUp option mapping for Severity but allows partial Issue Type mapping", () => {
  const errors = getClickUpMappingValidationErrors({
    list: { id: "list-1" },
    customItem: { id: "3" },
    mappings: {
      severity_cf: "Severity",
      issue_type_cf: "Issue Type",
    },
    availableFields: [
      {
        id: "severity_cf",
        name: "Bug Severity",
      },
      {
        id: "issue_type_cf",
        name: "Issue Type",
      },
    ],
    customFieldValueMappings: {
      severity_cf: {
        Critical: "opt_critical",
      },
      issue_type_cf: {
        "Functional Issue": "opt_func",
      },
    },
  });

  assert.match(errors.join(" | "), /must map value/i);
  assert.match(errors.join(" | "), /Severity/i);
  assert.doesNotMatch(errors.join(" | "), /Issue Type/i);
});

test("maps common ClickUp errors to friendly messages", () => {
  assert.match(getClickUpFriendlyErrorMessage(401), /invalid|unauthorized/i);
  assert.match(getClickUpFriendlyErrorMessage(429), /rate/i);
  assert.match(getClickUpFriendlyErrorMessage("NETWORK_ERROR"), /reach/i);
});
