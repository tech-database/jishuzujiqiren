import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/system/ErrorBoundary.jsx";
import { useAppSessionController } from "./features/admin/useAppSessionController.js";
import { useSensitiveActionController } from "./features/admin/useSensitiveActionController.js";
import { useConfigController } from "./features/config/useConfigController.js";
import { useDrawingController } from "./features/drawing/useDrawingController.js";
import { useImportController } from "./features/import-data/useImportController.js";
import { useMonitoringController } from "./features/monitoring/useMonitoringController.js";
import { useQuoteStatisticsController } from "./features/quote-statistics/useQuoteStatisticsController.js";
import { AppPages } from "./app/AppPages.jsx";
import { AppFrame } from "./app/AppFrame.jsx";
import { AdminDialogs } from "./app/AdminDialogs.jsx";
import "./styles.css";
import "./styles/cockpit.css";
import "./styles/saas-light.css";
import "./styles/analytics.css";
import "./styles/home-dashboard.css";
import "./styles/admin-access.css";

function App() {
  const [targetTable, setTargetTable] = useState("board");
  const sensitiveController = useSensitiveActionController();
  const configController = useConfigController({
    requestSensitiveAction: sensitiveController.requestSensitiveAction,
    targetTable,
  });
  const sessionController = useAppSessionController({
    onAuthenticated: async () => {
      configController.setAdminAccess(true);
      await configController.loadConfig({ adminAccess: true });
    },
    onLoggedOut: async () => {
      configController.setAdminAccess(false);
      configController.clearAdminConfig();
      await configController.loadConfig({ adminAccess: false });
    },
  });
  const configReady = configController.configReady;
  const importController = useImportController(targetTable);
  const drawingController = useDrawingController(targetTable);
  const quoteStatisticsController = useQuoteStatisticsController();
  const monitoringController = useMonitoringController({
    activeTab: sessionController.activeTab,
    configReady,
    resetVersion: configController.monitoringResetVersion,
    targetTable,
  });

  const controllers = {
    config: configController,
    drawing: drawingController,
    importData: importController,
    monitoring: monitoringController,
    quoteStatistics: quoteStatisticsController,
    shared: { setTargetTable, targetTable },
  };

  return (
    <>
      <AppFrame
        activeTab={sessionController.activeTab}
        adminAuthenticated={sessionController.adminAuthenticated}
        adminSessionLoading={sessionController.adminSessionLoading}
        bitableFieldCount={configController.bitableFields.length}
        configLoading={configController.configLoading}
        configReady={configReady}
        healthLoading={configController.healthLoading}
        healthStatus={configController.healthStatus}
        mobileNavigationOpen={sessionController.mobileNavigationOpen}
        onCloseMobileNavigation={sessionController.closeMobileNavigation}
        onLogout={sessionController.logoutAdminAccess}
        onNavigate={sessionController.navigateTab}
        onOpenMobileNavigation={sessionController.openMobileNavigation}
        onSidebarCollapseToggle={sessionController.toggleSidebar}
        ownerStats={monitoringController.ownerStats}
        sidebarCollapsed={sessionController.sidebarCollapsed}
        statusResult={monitoringController.aggregateStatusResult}
        uploadFiles={importController.uploadFiles}
        uploadState={importController.uploadState}
      >
        <AppPages
          activeTab={sessionController.activeTab}
          adminAuthenticated={sessionController.adminAuthenticated}
          controllers={controllers}
        />
      </AppFrame>
      <AdminDialogs
        adminAuthenticated={sessionController.adminAuthenticated}
        adminError={sessionController.adminError}
        adminSessionLoading={sessionController.adminSessionLoading}
        adminSubmitting={sessionController.adminSubmitting}
        adminTarget={sessionController.adminTarget}
        onAdminCancel={sessionController.cancelAdminAccess}
        onAdminSubmit={sessionController.submitAdminAccess}
        onSensitiveCancel={sensitiveController.cancelSensitiveAction}
        onSensitiveSubmit={sensitiveController.submitSensitiveAction}
        sensitiveAction={sensitiveController.sensitiveAction}
        sensitiveActionError={sensitiveController.sensitiveActionError}
        sensitiveActionSubmitting={sensitiveController.sensitiveActionSubmitting}
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
