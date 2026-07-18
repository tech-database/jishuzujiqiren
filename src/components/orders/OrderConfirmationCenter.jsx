import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Database, PackageCheck, Send, TriangleAlert } from "lucide-react";
import { GlassButton, GlassCard, StatusBadge } from "../design-system";
import { PageTransition } from "../motion";
import MaterialCodeInput from "../assignment/MaterialCodeInput";
import MaterialCodeList from "../assignment/MaterialCodeList";
import { buildMaterialCodeSummary, removeMaterialCodeAtIndex } from "../../utils/materialCodeUtils";
import { sanitizeAssignmentError } from "../../utils/assignmentResultUtils";

export default function OrderConfirmationCenter({ configReady, targetTable, setTargetTable, TableSelector }) {
  const [materialCodes, setMaterialCodes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const summary = useMemo(() => buildMaterialCodeSummary(materialCodes), [materialCodes]);
  const tableLabel = targetTable === "paint" ? "油漆" : "胶板";
  const busy = submitting;
  const completed = state?.ok === true;
  const flowSteps = [
    { label: "输入料号", icon: ClipboardCheck, done: summary.canSubmit, active: !summary.canSubmit },
    { label: "选择数据表", icon: Database, done: Boolean(targetTable), active: summary.canSubmit && !targetTable },
    { label: "确认下单", icon: Send, done: completed, active: summary.canSubmit && !completed },
    { label: "查看结果", icon: CheckCircle2, done: completed, active: completed },
  ];

  const updateMaterialCodes = (value) => {
    setMaterialCodes(value);
    setError("");
    setState(null);
  };

  const clear = () => {
    setMaterialCodes("");
    setError("");
    setState(null);
  };

  const submit = async () => {
    if (!summary.canSubmit) {
      setError("请输入至少一个需要确认下单的料号");
      return;
    }
    setSubmitting(true);
    setError("");
    setState(null);
    try {
      const response = await fetch("/api/confirm-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialCodes: summary.uniqueCodes, tableKey: targetTable }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "下单确认失败");
      setState({ ok: true, data });
    } catch (requestError) {
      setState({ ok: false, text: sanitizeAssignmentError(requestError) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition className="assignment-center order-confirmation-center">
      <nav className="assignment-flow-strip" aria-label="下单确认步骤">
        {flowSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <span className={step.done ? "done" : step.active ? "active" : ""} key={step.label}>
              <i>{step.done ? <CheckCircle2 size={16} /> : <Icon size={16} />}</i>
              <small>STEP {index + 1}</small>
              <strong>{step.label}</strong>
            </span>
          );
        })}
      </nav>

      {state?.ok && (
        <GlassCard className="assignment-result-panel" as="section">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div role="status" aria-live="polite">
            <h2>下单确认完成</h2>
            <p>
              匹配 {state.data.matchedCount} 条记录，更新 {state.data.count} 条；
              {state.data.alreadyConfirmedCount > 0
                ? `另有 ${state.data.alreadyConfirmedCount} 条原本已是“是”。`
                : "所有命中记录均已更新为“是”。"}
              {state.data.missing?.length > 0 && ` 未找到：${state.data.missing.join("、")}。`}
            </p>
            <div className="assignment-result-codes">
              {(state.data.materialCodes || []).map((code) => <code key={code}>{code}</code>)}
            </div>
          </div>
        </GlassCard>
      )}

      {state?.ok === false && (
        <GlassCard className="assignment-error-panel" as="section">
          <TriangleAlert size={22} aria-hidden="true" />
          <div role="alert">
            <h2>下单确认失败</h2>
            <p>{state.text}</p>
          </div>
          <GlassButton type="button" variant="secondary" onClick={submit} disabled={busy || !configReady}>
            重新提交
          </GlassButton>
        </GlassCard>
      )}

      <section className="assignment-layout">
        <div className="assignment-form-column">
          <section className="assignment-form-panel">
            <MaterialCodeInput
              value={materialCodes}
              summary={summary}
              disabled={busy}
              error={error}
              onChange={updateMaterialCodes}
              onClear={() => updateMaterialCodes("")}
            />

            <section className="assignment-field-card order-table-field">
              <div className="assignment-step-heading">
                <span>2</span>
                <div>
                  <h2>选择数据表</h2>
                  <p>系统将在所选表中按料号匹配，并把“是否下单”更新为“是”</p>
                </div>
              </div>
              <TableSelector value={targetTable} onChange={(value) => { setTargetTable(value); setState(null); }} />
            </section>

            <div className="assignment-action-bar order-action-bar">
              <div>
                <strong>提交前请核对料号和目标表</strong>
                <span>重复料号只提交一次；已经确认的记录不会重复写入</span>
              </div>
              <div>
                <GlassButton type="button" variant="secondary" onClick={clear} disabled={busy || !summary.hasCodes}>
                  清空
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={submit}
                  disabled={!configReady || busy || !summary.canSubmit}
                >
                  <PackageCheck size={17} />
                  {submitting ? "确认中…" : "确认下单"}
                </GlassButton>
              </div>
            </div>
          </section>
        </div>

        <GlassCard className="assignment-summary-panel order-summary-panel" as="aside">
          <header>
            <div>
              <h2>本次确认</h2>
              <p>仅更新“是否下单”，不会修改绘图状态、人员或时间字段</p>
            </div>
            <StatusBadge tone={summary.canSubmit ? "neutral" : "warning"}>
              {summary.canSubmit ? "待确认" : "等待料号"}
            </StatusBadge>
          </header>
          <div className="assignment-summary-metrics">
            <span><small>目标表</small><strong className="order-table-name">{tableLabel}</strong></span>
            <span><small>唯一料号</small><strong>{summary.uniqueCount}</strong></span>
            <span><small>目标值</small><strong className="order-target-value">是</strong></span>
          </div>
          <MaterialCodeList
            items={summary.items}
            onRemove={(index) => updateMaterialCodes(removeMaterialCodeAtIndex(materialCodes, index))}
          />
          <div className="assignment-submit-state">
            <PackageCheck size={15} />
            <span>提交后将匹配 {summary.uniqueCount} 个唯一料号</span>
          </div>
        </GlassCard>
      </section>
    </PageTransition>
  );
}
