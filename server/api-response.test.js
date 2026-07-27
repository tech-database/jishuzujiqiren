import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, errorResponse, successResponse } from "./api-response.js";

test("success responses expose a stable envelope and legacy top-level fields", () => {
  assert.deepEqual(successResponse({ count: 2 }), {
    ok: true,
    code: "OK",
    message: "",
    data: { count: 2 },
    count: 2,
  });
});

test("error responses preserve typed codes, status and legacy error text", () => {
  const response = errorResponse(
    new ApiError("DRAWING_ALREADY_CLAIMED", "料号已被领取", {
      statusCode: 409,
      details: { materialCode: "A-001" },
    }),
    "DRAWING_CLAIM_FAILED",
  );
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    ok: false,
    code: "DRAWING_ALREADY_CLAIMED",
    message: "料号已被领取",
    error: "料号已被领取",
      details: { materialCode: "A-001" },
      data: null,
      materialCode: "A-001",
  });
});
