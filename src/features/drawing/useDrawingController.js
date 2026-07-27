import { useState } from "react";
import { sanitizeAssignmentError } from "../../utils/assignmentResultUtils.js";
import {
  parseMaterialCodes as parseMaterialCodeSummary,
  removeMaterialCodeAtIndex,
} from "../../utils/materialCodeUtils.js";
import {
  claimDrawing as claimDrawingApi,
  completeDrawing as completeDrawingApi,
  queryUnclaimedDrawings,
} from "./drawing.api.js";

export function useDrawingController(targetTable) {
  const [claimForm, setClaimForm] = useState({ materialCodes: "", senderName: "" });
  const [claiming, setClaiming] = useState(false);
  const [completingDrawing, setCompletingDrawing] = useState(false);
  const [queryingClaims, setQueryingClaims] = useState(false);
  const [claimState, setClaimState] = useState(null);
  const [claimQueryResult, setClaimQueryResult] = useState(null);

  function updateClaimForm(key, value) {
    if (key === "dismissState") {
      setClaimState(null);
      return;
    }
    setClaimForm((current) => ({ ...current, [key]: value }));
    setClaimState(null);
    setClaimQueryResult(null);
  }

  function materialCodes() {
    return parseMaterialCodeSummary(claimForm.materialCodes).uniqueCodes;
  }

  function removeClaimMaterialCode(index) {
    updateClaimForm("materialCodes", removeMaterialCodeAtIndex(claimForm.materialCodes, index));
  }

  function clearClaimForm() {
    setClaimForm({ materialCodes: "", senderName: "" });
    setClaimState(null);
    setClaimQueryResult(null);
  }

  async function claimDrawing() {
    const codes = materialCodes();
    if (codes.length === 0) {
      setClaimState({ ok: false, operation: "claim", text: "请输入至少一个料号" });
      return;
    }
    setClaiming(true);
    setClaimState(null);
    try {
      const data = await claimDrawingApi({
        materialCodes: codes,
        senderName: claimForm.senderName.trim(),
        tableKey: targetTable,
      });
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        operation: "claim",
        text: `领图成功：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`,
        data,
      });
    } catch (error) {
      setClaimState({ ok: false, operation: "claim", text: sanitizeAssignmentError(error) });
    } finally {
      setClaiming(false);
    }
  }

  async function completeDrawing() {
    const codes = materialCodes();
    if (codes.length === 0) {
      setClaimState({ ok: false, operation: "complete", text: "请输入至少一个料号" });
      return;
    }
    setCompletingDrawing(true);
    setClaimState(null);
    try {
      const data = await completeDrawingApi({ materialCodes: codes, tableKey: targetTable });
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        operation: "complete",
        text: data.adminOverrideCount > 0
          ? `管理员已代为完成：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`
          : `绘图完成：${data.materialCodes.join("，")}，共更新 ${data.count} 条记录`,
        data,
      });
    } catch (error) {
      setClaimState({ ok: false, operation: "complete", text: sanitizeAssignmentError(error) });
    } finally {
      setCompletingDrawing(false);
    }
  }

  async function queryDrawingClaims() {
    setQueryingClaims(true);
    setClaimState(null);
    setClaimQueryResult(null);
    try {
      const data = await queryUnclaimedDrawings(targetTable);
      if (!data.ok) throw new Error(data.error);
      setClaimState({
        ok: true,
        operation: "query",
        text: data.count > 0 ? `查询完成：共 ${data.count} 条图纸未被领取` : "查询完成：没有未领取图纸",
        data,
      });
      setClaimQueryResult(data);
    } catch (error) {
      setClaimState({ ok: false, operation: "query", text: sanitizeAssignmentError(error) });
    } finally {
      setQueryingClaims(false);
    }
  }

  return {
    claimDrawing,
    claimForm,
    claiming,
    claimQueryResult,
    claimState,
    clearClaimForm,
    completeDrawing,
    completingDrawing,
    queryingClaims,
    queryDrawingClaims,
    removeClaimMaterialCode,
    updateClaimForm,
  };
}
