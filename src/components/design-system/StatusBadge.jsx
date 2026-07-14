export function StatusBadge({ tone = "neutral", className = "", children, ...props }) {
  return (
    <span className={`status-badge ${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
