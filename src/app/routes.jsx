import React from "react";
import {
  Activity,
  BadgeDollarSign,
  CircleDollarSign,
  ChartNoAxesCombined,
  Database,
  FileUp,
  House,
  Images,
  MessageSquareText,
  PackageCheck,
  Settings2,
  UsersRound,
} from "lucide-react";

export const MappingStudio = React.lazy(() => import("../features/field-mapping/MappingPage.jsx"));
export const MonitoringCenter = React.lazy(() => import("../features/monitoring/MonitoringPage.jsx"));
export const ConnectionManagementCenter = React.lazy(
  () => import("../features/config/ConfigPage.jsx"),
);
export const CommandCenter = React.lazy(() => import("../features/commands/CommandsPage.jsx"));
export const PeopleMappingCenter = React.lazy(() => import("../features/people/PeoplePage.jsx"));
export const DrawingOperationsCenter = React.lazy(
  () => import("../features/drawing/DrawingOperationsPage.jsx"),
);
export const DataImportCenter = React.lazy(() => import("../features/import-data/ImportPage.jsx"));
export const DrawingAssignmentCenter = React.lazy(
  () => import("../features/drawing/DrawingAssignmentPage.jsx"),
);
export const OrderConfirmationCenter = React.lazy(
  () => import("../features/orders/OrderConfirmationPage.jsx"),
);
export const DataAnalyticsCenter = React.lazy(
  () => import("../features/analytics/AnalyticsPage.jsx"),
);
export const HomeDashboard = React.lazy(() => import("../features/home/HomePage.jsx"));
export const QuoteStatisticsCenter = React.lazy(
  () => import("../features/quote-statistics/QuoteStatisticsPage.jsx"),
);
export const QuoteDashboard = React.lazy(
  () => import("../features/quote-dashboard/QuoteDashboardPage.jsx"),
);

export const appRoutes = [
  { id: "quote-home", path: "/quote-home", title: "报价首页", icon: CircleDollarSign },
  { id: "home", path: "/home", title: "绘图首页", icon: House },
  { id: "connection", path: "/connection", title: "连接配置", icon: Settings2, adminOnly: true },
  { id: "mapping", path: "/mapping", title: "字段映射", icon: Database, badge: "fields" },
  { id: "commands", path: "/commands", title: "飞书口令", icon: MessageSquareText },
  { id: "people", path: "/people", title: "人员映射", icon: UsersRound, adminOnly: true },
  { id: "status", path: "/status", title: "绘图状态检测", icon: Activity },
  { id: "owners", path: "/owners", title: "绘图人动态", icon: UsersRound },
  { id: "analytics", path: "/analytics", title: "绘图数据看板", icon: ChartNoAxesCombined },
  { id: "quotes", path: "/quotes", title: "报价统计", icon: BadgeDollarSign },
  { id: "upload", path: "/upload", title: "绘图新增", icon: FileUp },
  { id: "drawing", path: "/drawing", title: "领图", icon: Images },
  { id: "orders", path: "/orders", title: "下单确认", icon: PackageCheck },
];

export const routesById = Object.fromEntries(appRoutes.map((route) => [route.id, route]));
export const adminOnlyTabs = new Set(appRoutes.filter((route) => route.adminOnly).map((route) => route.id));
export const adminTabLabels = Object.fromEntries(
  appRoutes.filter((route) => route.adminOnly).map((route) => [route.id, route.title]),
);

export function routePath(tab) {
  return routesById[tab]?.path || routesById.home.path;
}

export function tabFromPath(pathname = window.location.pathname) {
  return appRoutes.find((route) => route.path === pathname)?.id || "home";
}
