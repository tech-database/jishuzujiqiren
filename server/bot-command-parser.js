import { recentShanghaiDateRange } from "./date-range.js";

function defaultStatusDateRange() {
  return recentShanghaiDateRange(7);
}

function parseCommandDates(content) {
  const dates = [...String(content || "").matchAll(/\b\d{4}-\d{1,2}-\d{1,2}\b/g)].map((match) => {
    const [year, month, day] = match[0].split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  });
  return dates;
}

export function commandDateRange(content) {
  const dates = parseCommandDates(content);
  if (dates.length === 0) return defaultStatusDateRange();
  if (dates.length === 1) return { startDate: dates[0], endDate: dates[0] };
  return { startDate: dates[0], endDate: dates[1] };
}

export function commandTableKey(content) {
  return String(content || "").includes("油漆") ? "paint" : "board";
}

export function optionalCommandTableKey(content) {
  const text = String(content || "");
  if (text.includes("油漆")) return "paint";
  if (text.includes("胶板")) return "board";
  return undefined;
}

export function createCommandTableKey(content) {
  const text = String(content || "");
  if (!text.includes("新增")) return undefined;
  const hasBoard = text.includes("胶板");
  const hasPaint = text.includes("油漆");
  if (hasBoard === hasPaint) return undefined;
  return hasPaint ? "paint" : "board";
}

export function requireCreateCommandTableKey(content) {
  const tableKey = createCommandTableKey(content);
  if (!tableKey) {
    throw new Error("新增口令必须且只能指定一个目标表，请发送“胶板新增”或“油漆新增”。");
  }
  return tableKey;
}

export function isTableCreateCommand(content) {
  return Boolean(createCommandTableKey(content));
}

export function commandHelpText() {
  return [
    "飞书机器人口令：",
    "1. @机器人 胶板新增 / @机器人 油漆新增：开始上传 Excel/CSV，上传完成后发送 @机器人 完成",
    "2. @机器人 料号 领图：自动在胶板/油漆表匹配料号，把发送人写入绘图人并改为绘图中",
    "3. @机器人 料号 绘图完成：自动在胶板/油漆表匹配料号，改为绘图完成并记录完成时间/用时（分钟数）",
    "4. @机器人 料号 下单确认：匹配料号并把“是否下单”更新为“是”；可加胶板或油漆指定表",
    "5. @机器人 查询未领取：分别统计胶板、油漆和合计；也可发送 胶板查询未领取 / 油漆查询未领取 单独查询",
    "6. @机器人 状态检测：按默认日期范围同步状态并返回数量",
    "7. @机器人 获取ID：回复发送人的飞书用户 ID",
    "日期范围仅用于状态检测：在口令后追加 2026-07-11 2026-07-13；不写则默认最近7天。",
  ].join("\n");
}

