function splitMaterialCodeTokens(value = "") {
  return String(value || "")
    .split(/[\s,，、。;；|/\\]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseMaterialCodes(value = "") {
  const tokens = splitMaterialCodeTokens(value);
  const seen = new Set();
  const duplicates = [];
  const items = tokens.map((code, index) => {
    const duplicate = seen.has(code);
    if (duplicate && !duplicates.includes(code)) duplicates.push(code);
    seen.add(code);
    return {
      code,
      index,
      duplicate,
      status: duplicate ? "duplicate" : "pending",
    };
  });
  const uniqueCodes = [...seen];

  return {
    rawCount: tokens.length,
    uniqueCount: uniqueCodes.length,
    duplicates,
    uniqueCodes,
    items,
  };
}

export function removeMaterialCodeAtIndex(value = "", removeIndex) {
  const tokens = splitMaterialCodeTokens(value);
  return tokens.filter((_, index) => index !== removeIndex).join("\n");
}

export function buildMaterialCodeSummary(value = "") {
  const parsed = parseMaterialCodes(value);
  return {
    ...parsed,
    hasCodes: parsed.uniqueCount > 0,
    canSubmit: parsed.uniqueCount > 0,
  };
}
