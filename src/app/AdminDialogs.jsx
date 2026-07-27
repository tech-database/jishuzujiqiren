import { AdminAccessGate } from "../components/system/AdminAccessGate.jsx";
import { adminTabLabels } from "./routes.jsx";

export function AdminDialogs({
  adminAuthenticated,
  adminError,
  adminSessionLoading,
  adminSubmitting,
  adminTarget,
  onAdminCancel,
  onAdminSubmit,
  onSensitiveCancel,
  onSensitiveSubmit,
  sensitiveAction,
  sensitiveActionError,
  sensitiveActionSubmitting,
}) {
  return (
    <>
      <AdminAccessGate
        open={!adminSessionLoading && Boolean(adminTarget) && !adminAuthenticated}
        targetLabel={adminTabLabels[adminTarget] || "受限页面"}
        loading={adminSubmitting}
        error={adminError}
        onSubmit={onAdminSubmit}
        onCancel={onAdminCancel}
      />
      <AdminAccessGate
        open={Boolean(sensitiveAction)}
        targetLabel={sensitiveAction?.label || "敏感操作"}
        title="再次验证管理员密码"
        description={`执行“${sensitiveAction?.label || "该操作"}”前，请再次输入管理员密码。`}
        submitLabel="验证并继续"
        loading={sensitiveActionSubmitting}
        error={sensitiveActionError}
        onSubmit={onSensitiveSubmit}
        onCancel={onSensitiveCancel}
      />
    </>
  );
}
