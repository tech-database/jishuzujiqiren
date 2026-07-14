import { GlassCard } from "./GlassCard.jsx";

export function PageHeader({ icon, title, description, actions, className = "" }) {
  return (
    <GlassCard as="header" className={`page-header ${className}`.trim()}>
      <div className="header-main">
        {icon && <div className="app-mark">{icon}</div>}
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {actions && <div className="header-status">{actions}</div>}
    </GlassCard>
  );
}
