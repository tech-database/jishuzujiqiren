import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";

export function AdminAccessGate({ open, targetLabel, loading, error, onSubmit, onCancel }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) setPassword("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="admin-access-backdrop" role="presentation">
      <section className="admin-access-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-access-title">
        <button className="admin-access-close" type="button" onClick={onCancel} aria-label="关闭管理员验证">
          <X size={18} />
        </button>
        <span className="admin-access-icon" aria-hidden="true"><LockKeyhole size={26} /></span>
        <div>
          <h2 id="admin-access-title">管理员验证</h2>
          <p>访问“{targetLabel}”需要管理员权限。</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!loading && password) onSubmit(password);
          }}
        >
          <label htmlFor="admin-access-password">管理员密码</label>
          <input
            id="admin-access-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            disabled={loading}
          />
          {error && <p className="admin-access-error" role="alert">{error}</p>}
          <button className="admin-access-submit" type="submit" disabled={loading || !password}>
            <ShieldCheck size={17} />
            {loading ? "正在验证" : "验证并进入"}
          </button>
        </form>
      </section>
    </div>
  );
}
