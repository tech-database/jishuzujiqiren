import assert from "node:assert/strict";
import test from "node:test";
import {
  isConfigDirty,
  isSensitiveConfigKey,
  maskSensitiveValue,
  validateConnectionConfig,
} from "./configFormUtils.js";

test("requires the first-time connection credentials", () => {
  assert.deepEqual(validateConnectionConfig({}), {
    appId: "App ID 不能为空。",
    bitableAppToken: "胶板 App Token 不能为空。",
    bitableTableId: "胶板 Table ID 不能为空。",
    appSecret: "首次配置需要填写 App Secret。",
  });
});

test("allows an empty app secret when the server already stores one", () => {
  assert.deepEqual(
    validateConnectionConfig({
      appId: "app-id",
      appSecretSet: true,
      bitableAppToken: "app-token",
      bitableTableId: "table-id",
    }),
    {},
  );
});

test("detects normalized config changes and sensitive keys", () => {
  const baseline = { appId: "app-id", replyEnabled: false };
  assert.equal(isConfigDirty({ appId: "app-id", replyEnabled: false }, baseline), false);
  assert.equal(isConfigDirty({ appId: "new-id", replyEnabled: false }, baseline), true);
  assert.equal(isSensitiveConfigKey("appSecret"), true);
  assert.equal(isSensitiveConfigKey("appId"), false);
});

test("masks secrets while preserving a short identification tail", () => {
  assert.equal(maskSensitiveValue("abcdefghijkl", 4), "••••••••ijkl");
  assert.equal(maskSensitiveValue("abc", 4), "••••");
  assert.equal(maskSensitiveValue(""), "");
});
