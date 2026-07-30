import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  FileSearch,
  FilePlus2,
  FileSpreadsheet,
  LoaderCircle,
  ShoppingCart,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { GlassButton } from "../../components/design-system/index.js";
import FileDropZone from "../../components/import-write/FileDropZone.jsx";
import { PageTransition } from "../../components/motion/index.js";
import { formatFileSize } from "../../utils/importFileUtils.js";
import { createQuoteStatisticEntry } from "./quote-statistics.api.js";
import {
  QUOTE_BATCH_FILE_LIMIT,
  quoteOfficerOptions,
} from "./useQuoteStatisticsController.js";

const summaryColumns = ["类型", "报价日期", "类别", "报价员", "区域", "业务", "单价", "总价"];

const statusLabels = Object.freeze({
  pending: "等待读取",
  reading: "读取中",
  ready: "待写入",
  writing: "写入中",
  written: "已写入",
  preview_error: "读取失败",
  write_error: "写入失败",
});

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const initialManualEntry = {
  type: "报价",
  category: "胶板",
  quoteOfficer: "",
  date: localDate(),
  region: "",
  business: "",
  quantity: "",
  unitPrice: "",
};

export default function QuoteStatisticsPage({ controller, quoteTableReady }) {
  const c = controller;
  const [manualEntry, setManualEntry] = useState(initialManualEntry);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualFeedback, setManualFeedback] = useState(null);
  const selectedOfficer = quoteOfficerOptions.find((item) => item.name === c.quoteOfficer);
  const allWritten = c.previewRows.length > 0 && c.writtenCount === c.previewRows.length;
  const manualTotal = useMemo(() => {
    const quantity = Number(manualEntry.quantity);
    const unitPrice = Number(manualEntry.unitPrice);
    return Number.isFinite(quantity) && Number.isFinite(unitPrice)
      ? quantity * unitPrice
      : 0;
  }, [manualEntry.quantity, manualEntry.unitPrice]);

  function updateManualEntry(field, value) {
    setManualEntry((current) => ({ ...current, [field]: value }));
    setManualFeedback(null);
  }

  async function submitManualEntry(event) {
    event.preventDefault();
    setManualBusy(true);
    setManualFeedback(null);
    try {
      await createQuoteStatisticEntry(manualEntry);
      setManualFeedback({
        ok: true,
        text: `${manualEntry.type}数据已新增到报价数据统计表。`,
      });
      setManualEntry((current) => ({
        ...current,
        region: "",
        business: "",
        quantity: "",
        unitPrice: "",
      }));
    } catch (error) {
      setManualFeedback({ ok: false, text: error.message || "数据新增失败" });
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <PageTransition className="quote-statistics-page">
      <section className="quote-workspace">
        <div className="quote-main-column">
          <header className="quote-page-heading">
            <div className="quote-heading-icon"><BadgeDollarSign size={22} /></div>
            <div>
              <h1>报价统计</h1>
              <p>一次可上传最多 {QUOTE_BATCH_FILE_LIMIT} 份报价或下单清单，按数量与销售单价自动计算总价。</p>
            </div>
          </header>

          <section className="quote-officer-section" aria-labelledby="quote-officer-title">
            <div>
              <span className="quote-step-number">1</span>
              <div>
                <h2 id="quote-officer-title">选择报价员</h2>
                <p>本批清单共用同一报价员，类别自动匹配。</p>
              </div>
            </div>
            <label>
              <span>报价员</span>
              <select
                value={c.quoteOfficer}
                onChange={(event) => c.updateQuoteOfficer(event.target.value)}
                disabled={c.busy}
              >
                <option value="">请选择报价员</option>
                {quoteOfficerOptions.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="quote-category-value">
              <span>匹配类别</span>
              <strong>{selectedOfficer?.category || "选择报价员后自动显示"}</strong>
            </div>
            <label>
              <span>写入日期</span>
              <input
                type="date"
                value={c.quoteDate}
                onChange={(event) => c.updateQuoteDate(event.target.value)}
                disabled={c.busy}
                required
              />
            </label>
          </section>

          <section className="quote-upload-section" aria-labelledby="quote-upload-title">
            <div className="quote-upload-header">
              <div className="quote-section-title">
                <span className="quote-step-number">2</span>
                <div>
                  <h2 id="quote-upload-title">批量上传数据清单</h2>
                  <p>先选择本批清单类型，再上传文件；单次最多 {QUOTE_BATCH_FILE_LIMIT} 份。</p>
                </div>
              </div>
              <fieldset className="quote-upload-type">
                <legend>本批清单类型</legend>
                <button
                  className={c.uploadType === "报价" ? "active" : ""}
                  type="button"
                  aria-pressed={c.uploadType === "报价"}
                  onClick={() => c.updateUploadType("报价")}
                  disabled={c.busy}
                >
                  <BadgeDollarSign size={16} />
                  报价清单
                </button>
                <button
                  className={c.uploadType === "下单" ? "active" : ""}
                  type="button"
                  aria-pressed={c.uploadType === "下单"}
                  onClick={() => c.updateUploadType("下单")}
                  disabled={c.busy}
                >
                  <ShoppingCart size={16} />
                  下单清单
                </button>
              </fieldset>
            </div>
            <FileDropZone
              fileInputRef={c.fileInputRef}
              dragging={c.dragging}
              disabled={c.busy || c.files.length >= QUOTE_BATCH_FILE_LIMIT}
              multiple
              onDragStateChange={c.setDragging}
              onFilesSelected={c.selectFiles}
            />

            {c.files.length > 0 && (
              <section className="quote-file-queue" aria-label={`已选择 ${c.files.length} 份清单`}>
                <div className="quote-file-queue-heading">
                  <div>
                    <strong>清单列表 {c.files.length} 份</strong>
                    <span>
                      待读取 {c.unreadCount} 份 · 已读取 {c.readCount} 份 ·
                      还可添加 {QUOTE_BATCH_FILE_LIMIT - c.files.length} 份
                    </span>
                  </div>
                  <button type="button" onClick={c.clearFiles} disabled={c.busy}>
                    <Trash2 size={15} />
                    清空
                  </button>
                </div>
                <div className="quote-file-queue-list">
                  {c.fileQueue.map((item) => (
                    <div className="quote-file-queue-item" key={item.key}>
                      <FileSpreadsheet size={16} />
                      <span title={item.file.name}>{item.file.name}</span>
                      <small className={`quote-file-state ${item.tone}`}>{item.label}</small>
                      <small className="quote-file-size">{formatFileSize(item.file.size)}</small>
                      <button
                        type="button"
                        onClick={() => c.removeFile(item.file)}
                        disabled={c.busy}
                        aria-label={`移除 ${item.file.name}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="quote-analyze-action">
              <div>
                <strong>
                  {c.unreadCount > 0
                    ? `待统计 ${c.unreadCount} 份${c.uploadType}清单`
                    : c.previewRows.length > 0
                      ? "当前清单均已读取"
                      : "尚未选择清单"}
                </strong>
                <span>读取后将以“{c.uploadType}”类型写入报价数据统计表</span>
              </div>
              <GlassButton
                type="button"
                variant="primary"
                onClick={c.previewFiles}
                disabled={c.busy || c.unreadCount === 0 || !c.quoteOfficer}
              >
                {c.busy ? <LoaderCircle className="quote-spin" size={17} /> : <FileSearch size={17} />}
                读取{c.uploadType}清单并统计
              </GlassButton>
            </div>
          </section>

          <section className="quote-data-entry-card" aria-labelledby="quote-data-entry-title">
            <div className="quote-data-entry-heading">
              <span><FilePlus2 size={20} /></span>
              <div>
                <h2 id="quote-data-entry-title">数据新增</h2>
                <p>报价和下单数据统一写入报价数据统计表，总价按数量 × 单价计算。</p>
              </div>
            </div>
            <form className="quote-data-entry-form" onSubmit={submitManualEntry}>
              <fieldset className="quote-data-entry-type">
                <legend>数据类型</legend>
                <button
                  className={manualEntry.type === "报价" ? "active" : ""}
                  type="button"
                  aria-pressed={manualEntry.type === "报价"}
                  onClick={() => updateManualEntry("type", "报价")}
                >
                  <BadgeDollarSign size={17} />
                  报价数据新增
                </button>
                <button
                  className={manualEntry.type === "下单" ? "active" : ""}
                  type="button"
                  aria-pressed={manualEntry.type === "下单"}
                  onClick={() => updateManualEntry("type", "下单")}
                >
                  <ShoppingCart size={17} />
                  下单数据新增
                </button>
              </fieldset>

              <label>
                <span>类别</span>
                <select
                  value={manualEntry.category}
                  onChange={(event) => updateManualEntry("category", event.target.value)}
                  disabled={manualBusy}
                >
                  <option value="胶板">胶板</option>
                  <option value="油漆">油漆</option>
                  <option value="软体">软体</option>
                </select>
              </label>
              <label>
                <span>报价员</span>
                <select
                  value={manualEntry.quoteOfficer}
                  onChange={(event) => updateManualEntry("quoteOfficer", event.target.value)}
                  disabled={manualBusy}
                  required
                >
                  <option value="">请选择报价员</option>
                  {quoteOfficerOptions.map((item) => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>日期</span>
                <input
                  type="date"
                  value={manualEntry.date}
                  onChange={(event) => updateManualEntry("date", event.target.value)}
                  disabled={manualBusy}
                  required
                />
              </label>
              <label>
                <span>区域</span>
                <input
                  value={manualEntry.region}
                  onChange={(event) => updateManualEntry("region", event.target.value)}
                  disabled={manualBusy}
                  placeholder="请输入区域"
                  required
                />
              </label>
              <label>
                <span>业务</span>
                <input
                  value={manualEntry.business}
                  onChange={(event) => updateManualEntry("business", event.target.value)}
                  disabled={manualBusy}
                  placeholder="请输入业务"
                  required
                />
              </label>
              <label>
                <span>数量</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualEntry.quantity}
                  onChange={(event) => updateManualEntry("quantity", event.target.value)}
                  disabled={manualBusy}
                  placeholder="0"
                  required
                />
              </label>
              <label>
                <span>单价</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualEntry.unitPrice}
                  onChange={(event) => updateManualEntry("unitPrice", event.target.value)}
                  disabled={manualBusy}
                  placeholder="0.00"
                  required
                />
              </label>

              <div className="quote-data-entry-submit">
                <span>
                  计算总价
                  <strong>¥{formatAmount(manualTotal)}</strong>
                </span>
                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={manualBusy || !quoteTableReady}
                >
                  {manualBusy ? <LoaderCircle className="quote-spin" size={17} /> : <FilePlus2 size={17} />}
                  {manualBusy ? "正在新增" : `新增${manualEntry.type}数据`}
                </GlassButton>
              </div>
            </form>
            {manualFeedback && (
              <div
                className={`quote-data-entry-feedback ${manualFeedback.ok ? "success" : "error"}`}
                role="status"
              >
                {manualFeedback.ok && <CheckCircle2 size={16} />}
                <span>{manualFeedback.text}</span>
              </div>
            )}
          </section>
        </div>

        <aside className="quote-rules-panel">
          <div className="quote-rule-heading">
            <ShieldCheck size={19} />
            <h2>统计规则</h2>
          </div>
          <ul>
            <li><UserRound size={16} /><span>区域、业务从每份清单自动读取</span></li>
            <li><BadgeDollarSign size={16} /><span>单价为“销售单价”列合计</span></li>
            <li><BadgeDollarSign size={16} /><span>总价为每行“数量 × 销售单价”之和</span></li>
            <li><CalendarDays size={16} /><span>每份清单生成一条当日记录</span></li>
          </ul>
          <div className={`quote-table-state ${quoteTableReady ? "ready" : "pending"}`}>
            <span>{quoteTableReady ? "报价统计表已配置" : "等待填写报价统计表 ID"}</span>
            <small>未配置时仍可读取预览，但不能确认写入。</small>
          </div>
        </aside>
      </section>

      {c.feedback && (
        <div className={`quote-feedback ${c.feedback.ok === false ? "error" : c.feedback.ok ? "success" : "loading"}`} role="status">
          {c.feedback.ok
            ? <CheckCircle2 size={17} />
            : c.feedback.ok === null
              ? <LoaderCircle className="quote-spin" size={17} />
              : null}
          <span>{c.feedback.text}</span>
        </div>
      )}

      {c.previewRows.length > 0 && (
        <section className="quote-preview-panel" aria-labelledby="quote-preview-title">
          <div className="quote-preview-heading">
            <div>
              <span className="quote-step-number">3</span>
              <div>
                <h2 id="quote-preview-title">核对批量统计结果</h2>
                <p>
                  共 {c.previewRows.length} 份 · 待写入 {c.readyCount} 份 · 已写入 {c.writtenCount} 份
                </p>
              </div>
            </div>
            <GlassButton
              type="button"
              variant="primary"
              onClick={c.commitPreviews}
              disabled={c.busy || !quoteTableReady || c.readyCount === 0}
            >
              <CheckCircle2 size={17} />
              {allWritten ? "已全部写入" : `批量确认写入${c.readyCount > 0 ? `（${c.readyCount}）` : ""}`}
            </GlassButton>
          </div>
          <div className="quote-preview-table-wrap">
            <table className="quote-preview-table">
              <thead>
                <tr>
                  <th>清单</th>
                  {summaryColumns.map((column) => <th key={column}>{column}</th>)}
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {c.previewRows.map((row) => (
                  <tr key={row.key}>
                    <td className="file-name" title={row.fileName}>{row.fileName}</td>
                    {summaryColumns.map((column) => (
                      <td key={column} className={column === "单价" || column === "总价" ? "amount" : ""}>
                        {column === "单价" || column === "总价"
                          ? formatAmount(row[column])
                          : row[column] || "—"}
                      </td>
                    ))}
                    <td>
                      <span className={`quote-row-status ${row.status}`} title={row.error || ""}>
                        {statusLabels[row.status] || row.status}
                      </span>
                      {row.ignoredInvalidRowCount > 0 && (
                        <small
                          className="quote-row-warning"
                          title={(row.warnings || []).join("；")}
                        >
                          已忽略 {row.ignoredInvalidRowCount} 条异常数据
                        </small>
                      )}
                      {row.error && <small className="quote-row-error">{row.error}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </PageTransition>
  );
}
