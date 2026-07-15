import { useMemo, useState } from "react";
import { ClipboardCheck, Database } from "lucide-react";
import { PageHeader, StatusBadge } from "../design-system";
import { PageTransition } from "../motion";
import { buildMaterialCodeSummary } from "../../utils/materialCodeUtils";
import AssignmentActionBar from "./AssignmentActionBar";
import AssignmentErrorPanel from "./AssignmentErrorPanel";
import AssignmentResultPanel from "./AssignmentResultPanel";
import AssignmentSummary from "./AssignmentSummary";
import AssigneeSelector from "./AssigneeSelector";
import MaterialCodeInput from "./MaterialCodeInput";

export default function DrawingAssignmentCenter({
  claimForm,
  nameIdRows,
  claimState,
  claimQueryResult,
  claiming,
  completingDrawing,
  queryingClaims,
  configReady,
  updateClaimForm,
  removeMaterialCode,
  clearClaimForm,
  claimDrawing,
  completeDrawing,
  queryDrawingClaims,
}) {
  const [errors, setErrors] = useState({});
  const summary = useMemo(() => buildMaterialCodeSummary(claimForm.materialCodes), [claimForm.materialCodes]);
  const busy = claiming || completingDrawing || queryingClaims;

  const validateClaim = () => {
    const nextErrors = {};
    if (!summary.canSubmit) nextErrors.materialCodes = "请输入至少一个料号";
    if (!claimForm.senderName.trim()) nextErrors.senderName = "请选择或输入领取人";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitClaim = () => {
    if (validateClaim()) claimDrawing();
  };

  const submitComplete = () => {
    const nextErrors = {};
    if (!summary.canSubmit) nextErrors.materialCodes = "请输入至少一个料号";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) completeDrawing();
  };

  const updateMaterialCodes = (value) => {
    setErrors((current) => ({ ...current, materialCodes: "" }));
    updateClaimForm("materialCodes", value);
  };

  const updateAssignee = (value) => {
    setErrors((current) => ({ ...current, senderName: "" }));
    updateClaimForm("senderName", value);
  };

  const retryCurrentOperation = () => {
    if (claimState?.operation === "complete") {
      submitComplete();
      return;
    }
    if (claimState?.operation === "query") {
      queryDrawingClaims();
      return;
    }
    submitClaim();
  };

  return (
    <PageTransition className="assignment-center">
      <PageHeader
        icon={<ClipboardCheck size={24} />}
        title="领图登记中心"
        description="输入一个或多个料号，选择领取人，并通过现有接口提交领图登记或同步绘图完成状态。"
        actions={(
          <>
            <StatusBadge tone={configReady ? "success" : "warning"}>{configReady ? "配置已就绪" : "等待配置"}</StatusBadge>
            <StatusBadge tone={summary.uniqueCount > 0 ? "neutral" : "warning"}>
              {summary.uniqueCount > 0 ? `${summary.uniqueCount} 个料号` : "等待料号"}
            </StatusBadge>
          </>
        )}
      />

      <section className="assignment-layout">
        <div className="assignment-form-column">
          <section className="assignment-form-panel">
            <div className="assignment-section-head">
              <Database size={20} />
              <div>
                <h2>登记表单</h2>
                <p>重复料号会被标记，并沿用当前去重提交逻辑。</p>
              </div>
            </div>
            <MaterialCodeInput
              value={claimForm.materialCodes}
              summary={summary}
              disabled={busy}
              error={errors.materialCodes}
              onChange={updateMaterialCodes}
              onClear={() => updateMaterialCodes("")}
            />
            <AssigneeSelector
              value={claimForm.senderName}
              peopleRows={nameIdRows}
              disabled={busy}
              error={errors.senderName}
              onChange={updateAssignee}
            />
            <AssignmentActionBar
              claimDisabled={!configReady || busy || !summary.canSubmit || !claimForm.senderName.trim()}
              completeDisabled={!configReady || busy || !summary.canSubmit}
              queryDisabled={!configReady || busy}
              querying={queryingClaims}
              claiming={claiming}
              completing={completingDrawing}
              hasCodes={summary.hasCodes}
              onClear={clearClaimForm}
              onQuery={queryDrawingClaims}
              onComplete={submitComplete}
              onClaim={submitClaim}
            />
          </section>

          <AssignmentResultPanel state={claimState} />
          <AssignmentErrorPanel
            state={claimState}
            materialCount={summary.uniqueCount}
            assignee={claimForm.senderName}
            disabled={!configReady || busy}
            onRetry={retryCurrentOperation}
            onDismiss={() => updateClaimForm("dismissState", "")}
          />
        </div>

        <AssignmentSummary
          summary={summary}
          assignee={claimForm.senderName}
          submitting={busy}
          onRemoveCode={removeMaterialCode}
        />
      </section>

      {claimQueryResult && (
        <section className="assignment-query-panel" aria-label="未领取查询结果">
          <header>
            <h2>本次会话查询结果</h2>
            <StatusBadge tone={claimQueryResult.count > 0 ? "warning" : "success"}>
              {claimQueryResult.count > 0 ? `${claimQueryResult.count} 条未领取` : "全部已领取"}
            </StatusBadge>
          </header>
          {claimQueryResult.items?.length > 0 ? (
            <div className="assignment-query-list">
              {claimQueryResult.items.map((item) => (
                <article key={`${item.table}:${item.recordId}`}>
                  <code>{item.materialCode}</code>
                  <span>{item.message || "未被领取"}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>当前查询没有未领取图纸。</p>
          )}
        </section>
      )}
    </PageTransition>
  );
}
