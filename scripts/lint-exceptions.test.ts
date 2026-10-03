import { expect, test } from "bun:test";

import {
  checkExceptions,
  parseBaseline,
  readExceptions,
  snapshotExceptions,
} from "./lint-exceptions";

const ZERO = 0;

test("only real comments count, including comments inside template expressions and JSX", () => {
  const source = [
    'const text = "// eslint-disable fake";',
    String.raw`const regex = /\/\/ eslint-disable fake/;`,
    "const template = `// oxlint-disable fake ${",
    "// eslint-disable-next-line actual -- Expression needs this rule exception.",
    "value}`;",
    "const jsx = <div>// eslint-disable fake{/* oxlint-disable-line jsx-rule -- JSX expression comment. */}</div>;",
    "/* oxlint-disable first, second --",
    " * The adapter requires both rules.",
    " */",
  ].join("\n");
  expect(
    readExceptions(source, "fixture.tsx").map((exception) => exception.rules)
  ).toEqual([["actual"], ["jsx-rule"], ["first", "second"]]);
});

test("file, rule and suppression scope cannot shift or increase", () => {
  const source =
    "// oxlint-disable-next-line rule -- Required by adapter.\nrun();";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(checkExceptions({ "a.ts": source }, baseline)).toEqual([]);
  expect(checkExceptions({ "b.ts": source }, baseline)).not.toEqual([]);
  expect(
    checkExceptions({ "a.ts": `${source}\n${source}` }, baseline)
  ).not.toEqual([]);
  expect(
    checkExceptions({ "a.ts": source.replace("next-line", "line") }, baseline)
  ).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": source.replace("rule --", "new-rule --") },
      baseline
    )
  ).not.toEqual([]);
  expect(checkExceptions({}, baseline)).toEqual([]);
});

test("legacy missing reasons have an explicit separate budget; new reasons are required", () => {
  const old = "/* eslint-disable-next-line legacy */";
  const { baseline } = snapshotExceptions({ "a.ts": old });
  expect(checkExceptions({ "a.ts": old }, baseline)).toEqual([]);
  expect(checkExceptions({ "b.ts": old }, baseline)).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": `${old}\n/* eslint-disable-next-line new */` },
      baseline
    )
  ).not.toEqual([]);
  const explained =
    "/* eslint-disable-next-line legacy -- Library contract. */";
  expect(
    checkExceptions(
      { "a.ts": old },
      snapshotExceptions({ "a.ts": explained }).baseline
    )
  ).not.toEqual([]);
  expect(checkExceptions({ "a.ts": explained }, baseline)).not.toEqual([]);
});

test("blanket disables are rejected even during baseline generation", () => {
  expect(
    snapshotExceptions({
      "a.ts": "// eslint-disable -- Reason\n/* oxlint-disable-next-line */",
    }).errors
  ).not.toEqual([]);
});

test("baseline corruption fails closed", () => {
  expect(() =>
    parseBaseline('{"version":1,"counts":{"x":-1},"missingReasons":{}}')
  ).toThrow();
  expect(() =>
    parseBaseline('{"version":2,"counts":{},"missingReasons":{}}')
  ).toThrow();
});

test("block scope and reason cannot change even when counts or token counts stay equal", () => {
  const source =
    "/* oxlint-disable rule -- Adapter contract. */\noldCall();\n/* oxlint-enable rule */\notherCall();";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions({ "a.ts": source.replace("oldCall", "newCall") }, baseline)
  ).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": source.replace("/* oxlint-enable rule */", "") },
      baseline
    )
  ).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": source.replace("Adapter contract.", "Another reason.") },
      baseline
    )
  ).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": source.replace("otherCall", "unrelatedCall") },
      baseline
    )
  ).toEqual([]);
  expect(
    checkExceptions(
      {
        "a.ts": source.replace(
          "/* oxlint-enable rule */",
          "/* oxlint-enable unrelated */"
        ),
      },
      baseline
    )
  ).not.toEqual([]);
});

test("astral characters before comments preserve parser offsets", () => {
  expect(
    readExceptions(
      'const emoji = "😀"; // oxlint-disable-line rule -- Unicode fixture.'
    )[ZERO]?.rules
  ).toEqual(["rule"]);
});

test("persisted snapshot round trips through fail-closed schema", () => {
  const { baseline } = snapshotExceptions({
    "a.ts": "/* oxlint-disable rule -- Contract. */\nrun();",
  });
  expect(parseBaseline(JSON.stringify(baseline))).toEqual(baseline);
});

test("line exceptions cannot move to another operation or silently change reason", () => {
  const source =
    "// oxlint-disable-next-line rule -- Adapter contract.\nfirst();\nsecond();";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  const relocated =
    "first();\n// oxlint-disable-next-line rule -- Adapter contract.\nsecond();";
  expect(checkExceptions({ "a.ts": relocated }, baseline)).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": source.replace("Adapter contract.", "Different operation.") },
      baseline
    )
  ).not.toEqual([]);
  const inline = "first(); // eslint-disable-line rule -- Inline contract.";
  expect(
    checkExceptions(
      { "a.ts": inline.replace("first", "second") },
      snapshotExceptions({ "a.ts": inline }).baseline
    )
  ).not.toEqual([]);
});

test("multiline disable-line scope includes the closing comment line", () => {
  const source = "/* eslint-disable-line rule --\n Contract. */ first();";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions({ "a.ts": source.replace("first", "second") }, baseline)
  ).not.toEqual([]);
});

test("EOF file metric exceptions still cover the entire file", () => {
  const source =
    "first();\n/* oxlint-disable eslint/max-lines -- Standalone policy audit. */";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions({ "a.ts": `second();\n${source}` }, baseline)
  ).not.toEqual([]);
});
