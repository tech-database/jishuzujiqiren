import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

export function AnimatedNumber({ value = 0, decimals = 0, suffix = "", className = "" }) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => `${latest.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    const controls = animate(motionValue, numericValue, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [motionValue, numericValue]);

  return <motion.strong className={`animated-number ${className}`.trim()}>{rounded}</motion.strong>;
}
