import { useEffect, useState } from "react";
import { adminOnlyTabs, routePath, tabFromPath } from "../../app/routes.jsx";
import { getAdminSession, loginAdmin, logoutAdmin } from "./admin.api.js";

export function useAppSessionController({ onAuthenticated, onLoggedOut }) {
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = tabFromPath();
    return adminOnlyTabs.has(requestedTab) ? "home" : requestedTab;
  });
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminSessionLoading, setAdminSessionLoading] = useState(true);
  const [adminTarget, setAdminTarget] = useState(() => {
    const requestedTab = tabFromPath();
    return adminOnlyTabs.has(requestedTab) ? requestedTab : null;
  });
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  function navigateTab(tab, { replace = false, bypassAdmin = false } = {}) {
    const path = routePath(tab);
    if (adminOnlyTabs.has(tab) && !adminAuthenticated && !bypassAdmin) {
      window.history[replace ? "replaceState" : "pushState"]({ tab }, "", path);
      setAdminTarget(tab);
      setAdminError("");
      setMobileNavigationOpen(false);
      return;
    }
    window.history[replace ? "replaceState" : "pushState"]({ tab }, "", path);
    setActiveTab(tab);
    setAdminTarget(null);
    setMobileNavigationOpen(false);
  }

  async function submitAdminAccess(password) {
    setAdminSubmitting(true);
    setAdminError("");
    try {
      const result = await loginAdmin(password);
      if (!result.authenticated) throw new Error(result.error || "管理员验证失败");
      const target = adminTarget || "home";
      setAdminAuthenticated(true);
      setAdminTarget(null);
      navigateTab(target, { replace: true, bypassAdmin: true });
      await onAuthenticated?.();
    } catch (error) {
      setAdminError(error.message || "管理员验证失败");
    } finally {
      setAdminSubmitting(false);
    }
  }

  function cancelAdminAccess() {
    setAdminTarget(null);
    setAdminError("");
    navigateTab("home", { replace: true, bypassAdmin: true });
  }

  async function logoutAdminAccess() {
    try {
      await logoutAdmin();
    } finally {
      setAdminAuthenticated(false);
      setAdminTarget(null);
      setAdminError("");
      if (adminOnlyTabs.has(activeTab)) {
        navigateTab("home", { replace: true, bypassAdmin: true });
      }
      await onLoggedOut?.();
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function restoreAdminSession() {
      try {
        const result = await getAdminSession();
        if (cancelled) return;
        const authenticated = Boolean(result.authenticated);
        setAdminAuthenticated(authenticated);
        if (authenticated) {
          const requestedTab = adminTarget || tabFromPath();
          if (adminOnlyTabs.has(requestedTab)) {
            navigateTab(requestedTab, { replace: true, bypassAdmin: true });
          }
          await onAuthenticated?.();
        }
      } catch {
        if (!cancelled) setAdminAuthenticated(false);
      } finally {
        if (!cancelled) setAdminSessionLoading(false);
      }
    }
    restoreAdminSession();
    return () => { cancelled = true; };
    // Session restoration must run once; navigation callbacks are intentionally sampled at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/") navigateTab("home", { replace: true, bypassAdmin: true });
    const handlePopState = () => {
      const requestedTab = tabFromPath();
      if (adminOnlyTabs.has(requestedTab) && !adminAuthenticated) {
        setActiveTab("home");
        setAdminTarget(requestedTab);
        setAdminError("");
        return;
      }
      setActiveTab(requestedTab);
      setAdminTarget(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // Rebind only when authentication changes; navigateTab has no external subscription identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAuthenticated]);

  return {
    activeTab,
    adminAuthenticated,
    adminError,
    adminSessionLoading,
    adminSubmitting,
    adminTarget,
    cancelAdminAccess,
    closeMobileNavigation: () => setMobileNavigationOpen(false),
    logoutAdminAccess,
    mobileNavigationOpen,
    navigateTab,
    openMobileNavigation: () => setMobileNavigationOpen(true),
    sidebarCollapsed,
    submitAdminAccess,
    toggleSidebar: () => setSidebarCollapsed((current) => !current),
  };
}
