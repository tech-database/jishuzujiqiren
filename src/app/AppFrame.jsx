import { Activity, Menu, ShieldCheck } from "lucide-react";
import { LightFallBackground } from "../components/design-system";
import { AppSidebar } from "./AppSidebar.jsx";
import { Pill, ProgressBar, RobotStatusWidget } from "../shared/components/AppStatusWidgets.jsx";

export function AppFrame({
  activeTab,
  adminAuthenticated,
  adminSessionLoading,
  bitableFieldCount,
  children,
  configLoading,
  configReady,
  healthLoading,
  healthStatus,
  mobileNavigationOpen,
  onCloseMobileNavigation,
  onLogout,
  onNavigate,
  onOpenMobileNavigation,
  onSidebarCollapseToggle,
  ownerStats,
  sidebarCollapsed,
  statusResult,
  uploadFiles,
  uploadState,
}) {
  return (
    <>
      <LightFallBackground />
      <div
        className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
          mobileNavigationOpen ? "mobile-nav-open" : ""
        } ${activeTab === "home" ? "home-active" : ""} ${
          activeTab === "quote-home" ? "quote-home-active" : ""
        }`}
      >
        <AppSidebar
          activeTab={activeTab}
          adminAuthenticated={adminAuthenticated}
          adminSessionLoading={adminSessionLoading}
          bitableFieldCount={bitableFieldCount}
          configReady={configReady}
          collapsed={sidebarCollapsed}
          onCollapseToggle={onSidebarCollapseToggle}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />

        <button
          className="mobile-navigation-backdrop"
          type="button"
          aria-label="关闭导航"
          onClick={onCloseMobileNavigation}
        />

        <div className="app-main">
          <main className="app-shell">
            <div className="global-status-row">
              <button
                className="mobile-menu-button"
                type="button"
                onClick={onOpenMobileNavigation}
                aria-label="打开导航"
              >
                <Menu size={20} />
              </button>
              <div className="header-status">
                <Pill tone={configReady ? "success" : "warning"} icon={ShieldCheck}>
                  {configReady ? "配置已加载" : "等待配置"}
                </Pill>
                <Pill tone={healthStatus?.ok ? "success" : "warning"} icon={Activity}>
                  {healthLoading && !healthStatus ? "正在检查飞书" : healthStatus?.label || "等待飞书检查"}
                </Pill>
              </div>
            </div>

            {activeTab === "status" && (
              <RobotStatusWidget
                activeTab={activeTab}
                configReady={configReady}
                healthStatus={healthStatus}
                statusResult={statusResult}
                ownerStats={ownerStats}
                uploadState={uploadState}
                uploadFiles={uploadFiles}
              />
            )}

            <ProgressBar active={configLoading} label="正在刷新配置" />
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
