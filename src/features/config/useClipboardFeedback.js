import { useEffect, useRef, useState } from "react";

export function useClipboardFeedback({ durationMs = 1200 } = {}) {
  const [copiedField, setCopiedField] = useState(null);
  const timerRef = useRef(null);

  async function copyConfigValue(key, value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopiedField(null), durationMs);
    } catch {
      setCopiedField(null);
    }
  }

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { copiedField, copyConfigValue };
}
