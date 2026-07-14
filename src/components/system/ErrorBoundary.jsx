import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { GlassButton, GlassCard } from "../design-system";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.error(error);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-shell">
        <GlassCard className="app-error-boundary" as="section">
          <AlertTriangle size={28} aria-hidden="true" />
          <div role="alert">
            <h1>页面渲染异常</h1>
            <p>当前视图未能正常渲染。业务数据和后端接口未被修改，可以重新加载页面恢复。</p>
          </div>
          <GlassButton type="button" variant="primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            重新加载
          </GlassButton>
        </GlassCard>
      </main>
    );
  }
}
