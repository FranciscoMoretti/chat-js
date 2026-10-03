import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- The CLI integration fixture creates and removes its own isolated temporary Git repository.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The isolated CLI fixture uses the operating system temporary directory.
import { tmpdir } from "node:os";

import {
  checkExceptions,
  parseBaseline,
  readExceptions,
  reviewBaselineUpdate,
  snapshotExceptions,
} from "./lint-exceptions";

const ZERO = 0;
const CLI_PROCESS_TIMEOUT_MS = 5000;
const CLI_TEST_TIMEOUT_MS = 30_000;

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

test("identical repeated lines and blocks retain their occurrence identity", () => {
  const pairs = [
    [
      "// oxlint-disable-next-line rule -- Contract.\nrepeat();\nrepeat();",
      "repeat();\n// oxlint-disable-next-line rule -- Contract.\nrepeat();",
    ],
    [
      "repeat(); // oxlint-disable-line rule -- Contract.\nrepeat();",
      "repeat();\nrepeat(); // oxlint-disable-line rule -- Contract.",
    ],
    [
      "/* oxlint-disable rule -- Contract. */\nrepeat();\n/* oxlint-enable rule */\nrepeat();",
      "repeat();\n/* oxlint-disable rule -- Contract. */\nrepeat();\n/* oxlint-enable rule */",
    ],
  ] as const;
  for (const [original, relocated] of pairs) {
    const { baseline } = snapshotExceptions({ "a.ts": original });
    expect(checkExceptions({ "a.ts": relocated }, baseline)).not.toEqual([]);
    expect(
      checkExceptions(
        { "a.ts": `// Unrelated inserted line.\n${original}` },
        baseline
      )
    ).toEqual([]);
  }
});

test("removing an enable at EOF changes the bounded block contract", () => {
  const source =
    "/* oxlint-disable rule -- Contract. */\nrun();\n/* oxlint-enable rule */";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions(
      { "a.ts": source.replace("/* oxlint-enable rule */", "") },
      baseline
    )
  ).not.toEqual([]);
});

test("function metric scopes reject target growth but allow unrelated sibling edits", () => {
  for (const rule of [
    "max-lines-per-function",
    "max-statements",
    "complexity",
    "max-depth",
    "max-params",
  ]) {
    const source = `// oxlint-disable-next-line ${rule} -- Function contract.\nconst target = () => { return 1; };\nconst sibling = () => 2;`;
    const { baseline } = snapshotExceptions({ "a.ts": source });
    expect(
      checkExceptions(
        { "a.ts": source.replace("sibling = () => 2", "sibling = () => 3") },
        baseline
      )
    ).toEqual([]);
    expect(
      checkExceptions(
        { "a.ts": source.replace("return 1", "work(); return 1") },
        baseline
      )
    ).not.toEqual([]);
  }
});

test("function metric scope chooses the outer target before same-line nested functions", () => {
  const source =
    "// oxlint-disable-next-line complexity -- Function contract.\nconst outer = () => { const inner = () => 1; return 2; };";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions(
      { "a.ts": source.replace("return 2", "return 3") },
      baseline
    )
  ).not.toEqual([]);
});

test("file metrics cover the full file for line and block waivers", () => {
  for (const rule of [
    "max-lines",
    "max-classes-per-file",
    "import/max-dependencies",
    "react/no-multi-comp",
  ]) {
    const source = `first();\n// oxlint-disable-next-line ${rule} -- File contract.\nsecond();`;
    const { baseline } = snapshotExceptions({ "a.ts": source });
    expect(
      checkExceptions({ "a.ts": source.replace("first", "changed") }, baseline)
    ).not.toEqual([]);
  }
});

test("baseline updates distinguish reviewed scope changes from explicit budget growth", () => {
  const old = "// oxlint-disable-next-line rule -- Contract.\nfirst();";
  const { baseline } = snapshotExceptions({ "a.ts": old });
  expect(
    reviewBaselineUpdate({ "a.ts": old.replace("first", "second") }, baseline)
  ).toEqual([]);
  expect(
    reviewBaselineUpdate({ "a.ts": old, "b.ts": old }, baseline)
  ).not.toEqual([]);
  expect(
    reviewBaselineUpdate({ "a.ts": `${old}\n${old}` }, baseline)
  ).not.toEqual([]);
  expect(
    reviewBaselineUpdate({ "a.ts": old, "b.ts": old }, baseline, true)
  ).toEqual([]);
  expect(
    reviewBaselineUpdate(
      { "a.ts": old, "b.ts": "// oxlint-disable-next-line rule\nfirst();" },
      baseline,
      true
    )
  ).not.toEqual([]);
});

test("function metrics cover every declaration sharing the waived line", () => {
  const source =
    "// oxlint-disable-next-line complexity -- Function contract.\nconst one = () => 1; const two = () => 2;";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions(
      { "a.ts": source.replace("two = () => 2", "two = () => 3") },
      baseline
    )
  ).not.toEqual([]);
});

/* oxlint-disable eslint/max-statements, eslint/max-lines-per-function -- The isolated CLI scenario owns Git setup, baseline writes, failure/readback assertions and cleanup in one fixture lifetime. */
test(
  "CLI baseline growth requires explicit opt-in",
  async () => {
    const root = await mkdtemp(`${tmpdir()}/chatjs-lint-exceptions-`);
    try {
      await mkdir(`${root}/scripts`);
      const guard = await Bun.file(
        new URL("lint-exceptions.ts", import.meta.url)
      ).text();
      const parserURL = import.meta.resolve("typescript");
      const parserImport = JSON.stringify(parserURL);
      const scriptSource = guard.replace(
        'from "typescript"',
        `from ${parserImport}`
      );
      await Bun.write(`${root}/scripts/lint-exceptions.ts`, scriptSource);
      const initialized = Bun.spawn(["git", "init", "-q", root], {
        stderr: "ignore",
        stdout: "ignore",
      });
      expect(await initialized.exited).toBe(ZERO);
      const runGuard = async (
        args: readonly string[]
      ): Promise<{ readonly exitCode: number; readonly stderr: string }> => {
        const child = Bun.spawn(
          [process.execPath, `${root}/scripts/lint-exceptions.ts`, ...args],
          { cwd: root, stderr: "pipe", stdout: "pipe" }
        );
        const deadline = setTimeout((): void => {
          child.kill("SIGKILL");
        }, CLI_PROCESS_TIMEOUT_MS);
        try {
          const [exitCode, stderr] = await Promise.all([
            child.exited,
            new Response(child.stderr).text(),
            new Response(child.stdout).text(),
          ]);
          return { exitCode, stderr };
        } finally {
          clearTimeout(deadline);
        }
      };
      const bootstrap = await runGuard(["--write-baseline"]);
      expect(bootstrap.exitCode).toBe(ZERO);
      const baselinePath = `${root}/scripts/lint-exceptions-baseline.json`;
      const original = await Bun.file(baselinePath).text();
      await Bun.write(
        `${root}/fixture.ts`,
        "// oxlint-disable-next-line rule -- Reviewed fixture contract.\nrun();"
      );
      const rejected = await runGuard(["--write-baseline"]);
      expect(rejected.exitCode).not.toBe(ZERO);
      expect(rejected.stderr).toContain("--allow-new");
      expect(await Bun.file(baselinePath).text()).toBe(original);
      const accepted = await runGuard(["--write-baseline", "--allow-new"]);
      expect(accepted.exitCode).toBe(ZERO);
      const checked = await runGuard([]);
      expect(checked.exitCode).toBe(ZERO);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  },
  CLI_TEST_TIMEOUT_MS
);
/* oxlint-enable eslint/max-statements, eslint/max-lines-per-function */

test("multiline inline waivers distinguish identical repeated regions", () => {
  const guarded =
    "first(); /* oxlint-disable-line rule -- Contract.\n*/ second();";
  const plain = "first();\nsecond();";
  const original = `${guarded}\n${plain}`;
  const { baseline } = snapshotExceptions({ "a.ts": original });
  expect(
    checkExceptions({ "a.ts": `${plain}\n${guarded}` }, baseline)
  ).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": `// Unrelated inserted line.\n${original}` },
      baseline
    )
  ).toEqual([]);
});

test("continuation-line metrics include the enclosing initializer before nested functions", () => {
  const source =
    "const outer =\n// oxlint-disable-next-line complexity -- Function contract.\n  () => { const inner = () => 1; return 2; };\nconst sibling = () => 3;";
  const { baseline } = snapshotExceptions({ "a.ts": source });
  expect(
    checkExceptions(
      { "a.ts": source.replace("return 2", "return 4") },
      baseline
    )
  ).not.toEqual([]);
  expect(
    checkExceptions(
      { "a.ts": source.replace("sibling = () => 3", "sibling = () => 4") },
      baseline
    )
  ).toEqual([]);
});

/* oxlint-disable eslint/max-lines -- The guard regression suite keeps parser, scope identity and isolated CLI budget-update contracts together in one test module. */
