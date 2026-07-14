import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyPartNumberButton({ value }) {
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
      className={`drawing-copy-button ${state}`}
      type="button"
      onClick={copy}
      disabled={!value}
      aria-label={state === "copied" ? "料号已复制" : "复制料号"}
    >
      {state === "copied" ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">{state === "copied" ? "已复制" : state === "error" ? "复制失败" : "复制"}</span>
    </button>
  );
}
