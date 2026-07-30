import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileInput, Send, UserRoundCheck } from "lucide-react";
import { StatusBadge } from "../design-system";
import { PageTransition } from "../motion";
import { buildMaterialCodeSummary } from "../../utils/materialCodeUtils";
import AssignmentErrorPanel from "./AssignmentErrorPanel";
import AssignmentResultPanel from "./AssignmentResultPanel";
import AssignmentSummary from "./AssignmentSummary";
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
  claimDrawing,
  completeDrawing,
  queryDrawingClaims,
}) {
  const [errors, setErrors] = useState({});
  const summary = useMemo(() => buildMaterialCodeSummary(claimForm.materialCodes), [claimForm.materialCodes]);
  const busy = claiming || completingDrawing || queryingClaims;
  const queryTableLabel =
    claimQueryResult?.table === "paint"
      ? "油漆"
      : claimQueryResult?.table === "board"
        ? "胶板"
        : "任务";
  const flowSteps = [
    { label: "输入料号", icon: FileInput, done: summary.uniqueCount > 0, active: summary.uniqueCount === 0 },
    { label: "选择领取人", icon: UserRoundCheck, done: Boolean(claimForm.senderName.trim()), active: summary.uniqueCount > 0 && !claimForm.senderName.trim() },
    { label: "确认提交", icon: Send, done: claimState?.ok === true && claimState.operation === "claim", active: summary.uniqueCount > 0 && Boolean(claimForm.senderName.trim()) && claimState?.ok !== true },
    { label: "查看结果", icon: CheckCircle2, done: claimState?.ok === true, active: claimState?.ok === true },
  ];

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
      <nav className="assignment-flow-strip" aria-label="领图登记步骤">
        {flowSteps.map((step, index) => {
          const Icon = step.icon;
          return <span className={step.done ? "done" : step.active ? "active" : ""} key={step.label}><i>{step.done ? <CheckCircle2 size={16} /> : <Icon size={16} />}</i><small>STEP {index + 1}</small><strong>{step.label}</strong></span>;
        })}
      </nav>

      {claimState?.operation !== "query" && (
        <AssignmentResultPanel state={claimState} assignee={claimForm.senderName} materialCount={summary.uniqueCount} />
      )}
      {claimState?.operation !== "query" && (
        <AssignmentErrorPanel state={claimState} materialCount={summary.uniqueCount} assignee={claimForm.senderName} disabled={!configReady || busy} onRetry={retryCurrentOperation} onDismiss={() => updateClaimForm("dismissState", "")} />
      )}

      <section className="assignment-layout">
        <div className="assignment-form-column">
          <section className="assignment-form-panel">
            <MaterialCodeInput
              value={claimForm.materialCodes}
              summary={summary}
              disabled={busy}
              error={errors.materialCodes}
              onChange={updateMaterialCodes}
              onClear={() => updateMaterialCodes("")}
            />
          </section>
        </div>

        <AssignmentSummary
          summary={summary}
          assignee={claimForm.senderName}
          peopleRows={nameIdRows}
          assigneeError={errors.senderName}
          busy={busy}
          claiming={claiming}
          completing={completingDrawing}
          querying={queryingClaims}
          claimDisabled={!configReady || busy || !summary.canSubmit || !claimForm.senderName.trim()}
          completeDisabled={!configReady || busy || !summary.canSubmit}
          queryDisabled={!configReady || busy}
          onAssigneeChange={updateAssignee}
          onClaim={submitClaim}
          onComplete={submitComplete}
          onQueryBoard={() => queryDrawingClaims("board")}
          onQueryPaint={() => queryDrawingClaims("paint")}
        />
      </section>

      {claimQueryResult && (
        <section className="assignment-query-panel" aria-label="未领取查询结果">
          <header>
            <div className="assignment-step-heading compact"><span>4</span><div><h2>{queryTableLabel}未领取查询结果</h2><p>结果显示在当前操作区下方</p></div></div>
            <StatusBadge tone={claimQueryResult.count > 0 ? "warning" : "success"}>
              {claimQueryResult.count > 0 ? `${claimQueryResult.count} 条未领取` : "全部已领取"}
            </StatusBadge>
          </header>
          {claimQueryResult.items?.length > 0 ? (
            <div className="assignment-query-list">
              {claimQueryResult.items.map((item) => (
                <article key={`${item.table}:${item.recordId}`}>
                  <code>{item.materialCode}</code>
                  <dl>
                    <div><dt>状态</dt><dd><Clock3 size={13} />未领取</dd></div>
                    <div><dt>领取人</dt><dd>等待分配</dd></div>
                    <div><dt>来源</dt><dd>{item.table === "paint" ? "油漆" : "胶板"}</dd></div>
                  </dl>
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
