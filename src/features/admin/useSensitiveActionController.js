import { useState } from "react";

export function useSensitiveActionController() {
  const [sensitiveAction, setSensitiveAction] = useState(null);
  const [sensitiveActionSubmitting, setSensitiveActionSubmitting] = useState(false);
  const [sensitiveActionError, setSensitiveActionError] = useState("");

  function requestSensitiveAction(label, action) {
    setSensitiveActionError("");
    setSensitiveAction({ label, action });
  }

  async function submitSensitiveAction(password) {
    if (!sensitiveAction) return;
    setSensitiveActionSubmitting(true);
    setSensitiveActionError("");
    try {
      await sensitiveAction.action(password.trim());
      setSensitiveAction(null);
    } catch (error) {
      setSensitiveActionError(error.message || "管理员验证失败");
    } finally {
      setSensitiveActionSubmitting(false);
    }
  }

  function cancelSensitiveAction() {
    if (sensitiveActionSubmitting) return;
    setSensitiveAction(null);
    setSensitiveActionError("");
  }

  return {
    cancelSensitiveAction,
    requestSensitiveAction,
    sensitiveAction,
    sensitiveActionError,
    sensitiveActionSubmitting,
    submitSensitiveAction,
  };
}
