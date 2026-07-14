import { useEffect, useRef } from "react";

export function LightFallBackground() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const handlePointerMove = (event) => {
      const x = (event.clientX / window.innerWidth - 0.5).toFixed(3);
      const y = (event.clientY / window.innerHeight - 0.5).toFixed(3);
      root.style.setProperty("--parallax-x", x);
      root.style.setProperty("--parallax-y", y);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div className="lightfall-background" ref={rootRef} aria-hidden="true">
      <span className="lightfall-beam beam-one" />
      <span className="lightfall-beam beam-two" />
      <span className="lightfall-beam beam-three" />
      <span className="lightfall-glow glow-one" />
      <span className="lightfall-glow glow-two" />
    </div>
  );
}
