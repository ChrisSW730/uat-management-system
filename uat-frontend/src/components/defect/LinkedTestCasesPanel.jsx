import React from "react";

export default function LinkedTestCasesPanel({
  linkedTestCases = [],
  readonly = false,
  showManageButton = true,
  onManage,
  onRemove,
}) {
  const cases = Array.isArray(linkedTestCases) ? linkedTestCases : [];

  const count = cases.length;

  return (
    <div className="linked-test-cases-inline">
      {count === 0 ? (
        <div className="linked-test-cases-inline-empty">
          No test cases linked yet.
        </div>
      ) : (
        <div className="linked-test-cases-chip-list">
          {cases.map((tc) => {
            const number =
              tc.testCaseNumber ??
              tc.tcNumber ??
              tc.tcId ??
              tc.id;

            const title =
              tc.title ??
              tc.name ??
              "Untitled Test Case";

            return (
              <span
                key={tc.id ?? number}
                className="linked-test-cases-chip"
                title={title}
              >
                <span>{number}</span>
                {!readonly && typeof onRemove === "function" && (
                  <button
                    type="button"
                    className="linked-test-cases-chip-remove"
                    aria-label={`Remove ${number}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemove(tc.id ?? number);
                    }}
                  >
                    ✕
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {showManageButton && (
        <button
          type="button"
          className="integration-secondary-btn linked-test-cases-manage-btn"
          disabled={readonly}
          onClick={onManage}
          style={
            readonly
              ? {
                  opacity: 0.5,
                  cursor: "not-allowed",
                }
              : undefined
          }
        >
          Link Test Case
        </button>
      )}
    </div>
  );
}