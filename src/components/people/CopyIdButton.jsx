import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyIdButton({ value }) {
  const [state, setState] = useState("idle");
  const resetTimerRef = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(resetTimerRef.current);
  }, []);

  const scheduleReset = (delay) => {
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setState("idle"), delay);
  };

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      scheduleReset(1400);
    } catch {
      setState("error");
      scheduleReset(1800);
    }
  };

  return (
    <button
      className={`people-copy-button ${state}`}
      type="button"
      onClick={copy}
      aria-label={state === "copied" ? "飞书用户 ID 已复制" : "复制飞书用户 ID"}
      disabled={!value}
    >
      {state === "copied" ? <Check size={15} /> : <Copy size={15} />}
      <span aria-live="polite">{state === "copied" ? "已复制" : state === "error" ? "复制失败" : "复制"}</span>
    </button>
  );
}
