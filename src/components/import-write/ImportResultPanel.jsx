import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "../design-system";
import { aggregateImportResults } from "../../utils/importResultUtils";

export default function ImportResultPanel({ state }) {
  if (!state?.ok) return null;
  const summary = aggregateImportResults(state.results || []);

  return (
    <GlassCard className="import-result-panel" as="section">
      <CheckCircle2 size={22} aria-hidden="true" />
      <div className="import-result-copy" role="status">
        <h2>写入完成</h2>
        <p>{state.text}</p>
        <div className="import-result-metrics">
          <span>
            <small>文件数</small>
            <strong>{summary.fileCount}</strong>
          </span>
          <span>
            <small>解析记录</small>
            <strong>{summary.parsedCount}</strong>
          </span>
          <span>
            <small>写入记录</small>
            <strong>{summary.resultCount}</strong>
          </span>
          <span>
            <small>警告</small>
            <strong>{summary.warnings.length}</strong>
          </span>
        </div>
        {summary.warnings.length > 0 && (
          <details className="import-warning-details">
            <summary>查看警告详情</summary>
            <ul>
              {summary.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </GlassCard>
  );
}
