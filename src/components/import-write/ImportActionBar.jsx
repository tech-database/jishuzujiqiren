import { X, UploadCloud } from "lucide-react";
import { GlassButton } from "../design-system";

export default function ImportActionBar({ disabled, uploading, hasFiles, onClear, onSubmit }) {
  return (
    <section className="import-action-bar" aria-label="导入操作">
      <div>
        <strong>{hasFiles ? "文件已准备" : "尚未选择文件"}</strong>
        <span>{uploading ? "正在等待服务端返回处理结果" : "确认目标表后即可开始写入"}</span>
      </div>
      <div>
        <GlassButton type="button" variant="secondary" onClick={onClear} disabled={uploading || !hasFiles}>
          <X size={16} />
          清空文件
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={onSubmit} disabled={disabled}>
          <UploadCloud size={16} />
          {uploading ? "写入中" : "开始写入"}
        </GlassButton>
      </div>
    </section>
  );
}
