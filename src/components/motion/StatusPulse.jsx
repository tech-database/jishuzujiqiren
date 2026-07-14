export function StatusPulse({ tone = "standby", label, detail, className = "" }) {
  return (
    <span className={`live-status-indicator ${tone} ${className}`.trim()}>
      <span className="live-status-dot" />
      <span className="live-status-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </span>
  );
}
