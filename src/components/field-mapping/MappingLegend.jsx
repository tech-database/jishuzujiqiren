import { AlertTriangle, Database, FileSpreadsheet, Link2 } from "lucide-react";

export function MappingLegend({ selectedDetail, orphanMappings = [] }) {
  return (
    <aside className="mapping-side-panel">
      <section className="mapping-legend-card">
        <h3>图例</h3>
        <div className="mapping-legend-row">
          <FileSpreadsheet size={16} />
          <span>Excel 字段节点</span>
        </div>
        <div className="mapping-legend-row">
          <Database size={16} />
          <span>飞书字段节点</span>
        </div>
        <div className="mapping-legend-row">
          <Link2 size={16} />
          <span>拖拽 Handle 创建映射</span>
        </div>
      </section>

      <section className="mapping-legend-card">
        <h3>当前选择</h3>
        {selectedDetail ? (
          <div className="mapping-selected-detail">
            <strong>{selectedDetail.title}</strong>
            <span>{selectedDetail.description}</span>
          </div>
        ) : (
          <p className="mapping-muted-text">选择节点或连接后查看详情。</p>
        )}
      </section>

      {orphanMappings.length > 0 && (
        <section className="mapping-legend-card warning">
          <h3>
            <AlertTriangle size={16} />
            未匹配旧映射
          </h3>
          {orphanMappings.map((item) => (
            <div className="mapping-orphan-row" key={`${item.excelField}:${item.feishuField}`}>
              <strong>{item.excelField}</strong>
              <span>{item.feishuField}</span>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
