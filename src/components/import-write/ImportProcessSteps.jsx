import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

const steps = [
  { key: "select", label: "选择文件" },
  { key: "submit", label: "提交请求" },
  { key: "server", label: "服务端处理" },
  { key: "complete", label: "完成" },
];

function getStepState(stepKey, state, hasFiles) {
  if (state?.ok === false) {
    if (stepKey === state.phase || (state.phase === "server" && stepKey === "server")) return "error";
    if (stepKey === "select" && hasFiles) return "done";
    return "waiting";
  }
  if (state?.ok === true) return "done";
  if (state?.phase === "server") {
    if (stepKey === "select" || stepKey === "submit") return "done";
    if (stepKey === "server") return "active";
    return "waiting";
  }
  if (state?.phase === "submit") {
    if (stepKey === "select") return "done";
    if (stepKey === "submit") return "active";
    return "waiting";
  }
  if (stepKey === "select" && hasFiles) return "done";
  return "waiting";
}

const icons = {
  waiting: Circle,
  active: Loader2,
  done: CheckCircle2,
  error: XCircle,
};

export default function ImportProcessSteps({ state, hasFiles }) {
  return (
    <section className="import-process-steps" aria-label="导入处理流程">
      {steps.map((step) => {
        const stepState = getStepState(step.key, state, hasFiles);
        const Icon = icons[stepState];
        return (
          <div className={`import-process-step ${stepState}`} key={step.key}>
            <Icon size={18} aria-hidden="true" />
            <span>{step.label}</span>
          </div>
        );
      })}
    </section>
  );
}
