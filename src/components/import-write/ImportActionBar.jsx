import { RefreshCw, UploadCloud } from "lucide-react";
import { GlassButton } from "../design-system";

export default function ImportActionBar({ disabled, uploading, files, onReselect, onSubmit }) {
  const fileLabel = files.length === 0 ? "尚未选择文件" : files.length === 1 ? files[0].name : `${files.length} 个文件已准备`;
  return (
    <section className="import-action-bar" aria-label="导入操作">
      <div><small>当前文件</small><strong title={fileLabel}>{fileLabel}</strong></div>
      <div>
        <GlassButton type="button" variant="secondary" onClick={onReselect} disabled={uploading}>
          <RefreshCw size={16} />重新选择
        </GlassButton>
        <GlassButton type="button" variant="primary" onClick={onSubmit} disabled={disabled}>
          <UploadCloud size={16} />{uploading ? "正在导入" : "开始导入"}
        </GlassButton>
      </div>
    </section>
  );
}
