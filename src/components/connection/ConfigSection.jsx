import { memo } from "react";
import { GlassCard } from "../design-system";

function ConfigSectionComponent({ icon: Icon, title, description, children }) {
  return (
    <GlassCard className="connection-config-section">
      <div className="connection-section-head">
        <span className="connection-section-icon">{Icon && <Icon size={21} />}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="connection-section-fields">{children}</div>
    </GlassCard>
  );
}

export const ConfigSection = memo(ConfigSectionComponent);
