import { Bot, ChevronLeft, LogIn, LogOut } from "lucide-react";
import { appRoutes } from "./routes.jsx";

export function AppSidebar({
  activeTab,
  adminAuthenticated,
  adminSessionLoading,
  bitableFieldCount,
  configReady,
  collapsed,
  onCollapseToggle,
  onLogout,
  onNavigate,
}) {
  const visibleRoutes = appRoutes.filter((route) => !route.adminOnly || adminAuthenticated);

  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true"><Bot size={30} /></span>
        <span className="sidebar-brand-copy">
          <strong>技术组机器人</strong>
          <small>自动化控制台</small>
        </span>
      </div>

      <nav className="tab-bar" aria-label="功能菜单">
        {visibleRoutes.map(({ id, title, icon: Icon, badge }) => (
          <button
            className={`tab-button ${activeTab === id ? "active" : ""}`}
            key={id}
            onClick={() => onNavigate(id)}
            title={title}
            type="button"
          >
            <Icon size={20} />
            <span className="tab-label">{title}</span>
            {badge === "fields" && bitableFieldCount > 0 && (
              <span className="tab-count">{bitableFieldCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-system-card" aria-label="机器人系统状态">
        <span className="sidebar-system-icon"><Bot size={17} /></span>
        <span className="sidebar-system-copy">
          <strong>{configReady ? "机器人已就绪" : "等待配置"}</strong>
          <small>控制台 v0.1.0</small>
        </span>
        <span className={`sidebar-system-dot ${configReady ? "online" : "standby"}`} />
      </div>

      {!adminSessionLoading && !adminAuthenticated && (
        <button
          className="admin-login-button"
          type="button"
          onClick={() => onNavigate("connection")}
          title="管理员登录"
        >
          <LogIn size={16} />
          <span>管理员登录</span>
        </button>
      )}

      {adminAuthenticated && (
        <button className="admin-logout-button" type="button" onClick={onLogout} title="退出管理模式">
          <LogOut size={16} />
          <span>退出管理模式</span>
        </button>
      )}

      <button
        className="sidebar-collapse-button"
        type="button"
        onClick={onCollapseToggle}
        aria-label={collapsed ? "展开菜单" : "收起菜单"}
        title={collapsed ? "展开菜单" : "收起菜单"}
      >
        <ChevronLeft size={18} />
        <span>{collapsed ? "展开菜单" : "收起菜单"}</span>
      </button>
    </aside>
  );
}
