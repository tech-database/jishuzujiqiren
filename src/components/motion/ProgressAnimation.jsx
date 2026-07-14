import { motion } from "framer-motion";

export function ProgressAnimation({ value = 0, label = "Progress", className = "" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className={`progress-ring ${className}`.trim()} aria-label={label}>
      <svg viewBox="0 0 108 108" role="img" aria-label={`${label} ${Math.round(safeValue)}%`}>
        <circle className="progress-ring-track" cx="54" cy="54" r={radius} />
        <motion.circle
          className="progress-ring-value"
          cx="54"
          cy="54"
          r={radius}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span>
        <strong>{Math.round(safeValue)}%</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}
