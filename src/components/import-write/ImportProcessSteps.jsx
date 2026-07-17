import {
  CheckCircle2,
  Circle,
  FileCheck2,
  FileSearch,
  GitCompareArrows,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const steps = [
  { key: "select", label: "选择文件", description: "等待选择", icon: FileCheck2 },
  { key: "parse", label: "文件解析", description: "读取表格结构", icon: FileSearch },
  { key: "mapping", label: "字段匹配", description: "使用当前映射", icon: GitCompareArrows },
  { key: "validation", label: "数据校验", description: "检查格式与内容", icon: ShieldCheck },
  { key: "server", label: "开始写入", description: "写入目标数据表", icon: Send },
  { key: "complete", label: "完成", description: "生成处理结果", icon: CheckCircle2 },
];

function getStepState(stepKey, state, hasFiles) {
  if (state?.ok === true) return "done";
  if (state?.ok === false) {
    const errorStep = state.phase === "select" ? "select" : state.phase === "validation" ? "validation" : "server";
    if (stepKey === errorStep) return "error";
  }
  if (!hasFiles) return stepKey === "select" ? "active" : "waiting";
  if (!state || state.phase === "select") {
    if (["select", "parse"].includes(stepKey)) return "done";
    return stepKey === "mapping" ? "active" : "waiting";
  }
  if (state.phase === "submit") {
    if (["select", "parse", "mapping"].includes(stepKey)) return "done";
    return stepKey === "validation" ? "active" : "waiting";
  }
  if (state.phase === "server") {
    if (["select", "parse", "mapping", "validation"].includes(stepKey)) return "done";
    return stepKey === "server" ? "active" : "waiting";
  }
  return "waiting";
}

export default function ImportProcessSteps({ state, hasFiles }) {
  return (
    <section className="import-process-steps" aria-label="导入处理流程">
      <header>
        <h2>导入流程</h2>
        <span>{state?.ok === true ? "已完成" : state?.ok === false ? "需要处理" : "准备中"}</span>
      </header>
      <div className="import-process-timeline">
        {steps.map((step, index) => {
          const stepState = getStepState(step.key, state, hasFiles);
          const StepIcon = step.icon;
          const StateIcon = stepState === "active" ? Loader2 : stepState === "error" ? XCircle : stepState === "done" ? CheckCircle2 : Circle;
          return (
            <div className={`import-process-step ${stepState}`} key={step.key}>
              <span className="import-step-index"><StateIcon size={16} aria-hidden="true" /></span>
              <span className="import-step-icon"><StepIcon size={17} aria-hidden="true" /></span>
              <span className="import-step-copy">
                <strong>{step.label}</strong>
                <small>{stepState === "done" ? "已完成" : stepState === "active" ? "当前步骤" : stepState === "error" ? "处理失败" : step.description}</small>
              </span>
              <span className="import-step-number">{String(index + 1).padStart(2, "0")}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
