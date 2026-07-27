import assert from "node:assert/strict";
import test from "node:test";
import {
  commandDateRange,
  commandHelpText,
  commandTableKey,
  isTableCreateCommand,
  optionalCommandTableKey,
  requireCreateCommandTableKey,
} from "./bot-command-parser.js";

test("bot commands resolve explicit target tables", () => {
  assert.equal(commandTableKey("油漆状态检测"), "paint");
  assert.equal(commandTableKey("状态检测"), "board");
  assert.equal(optionalCommandTableKey("胶板查询未领取"), "board");
  assert.equal(optionalCommandTableKey("查询未领取"), undefined);
});

test("create commands require exactly one table", () => {
  assert.equal(isTableCreateCommand("胶板新增"), true);
  assert.equal(requireCreateCommandTableKey("油漆新增"), "paint");
  assert.throws(
    () => requireCreateCommandTableKey("新增"),
    /新增口令必须且只能指定一个目标表/,
  );
  assert.throws(
    () => requireCreateCommandTableKey("胶板油漆新增"),
    /新增口令必须且只能指定一个目标表/,
  );
});

test("status commands normalize one or two explicit dates", () => {
  assert.deepEqual(commandDateRange("状态检测 2026-7-2"), {
    startDate: "2026-07-02",
    endDate: "2026-07-02",
  });
  assert.deepEqual(commandDateRange("状态检测 2026-7-2 2026-07-09"), {
    startDate: "2026-07-02",
    endDate: "2026-07-09",
  });
});

test("help text documents every supported command family", () => {
  const help = commandHelpText();
  for (const phrase of ["胶板新增", "领图", "绘图完成", "下单确认", "查询未领取", "状态检测", "获取ID"]) {
    assert.match(help, new RegExp(phrase));
  }
});
