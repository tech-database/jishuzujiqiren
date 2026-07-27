import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

export function CountUpNumber({ value = 0, suffix = "", decimals, className = "" }) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const precision = decimals ?? (Number.isInteger(numericValue) ? 0 : 1);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const displayValue = useTransform(motionValue, (latest) => {
    const formatted = new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(latest);
    return `${formatted}${suffix}`;
  });

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(numericValue);
      return undefined;
    }
    const controls = animate(motionValue, numericValue, {
      duration: 0.82,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [motionValue, numericValue, reduceMotion]);

  return (
    <motion.strong className={`home-count-up ${className}`.trim()}>
      {displayValue}
    </motion.strong>
  );
}
