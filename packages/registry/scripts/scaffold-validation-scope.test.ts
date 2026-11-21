import { expect, test } from "bun:test";
import { scaffoldValidationPattern } from "./scaffold-validation-scope";

const emptyOpenAI =
  "openai: the manifest-derived empty installation typechecks";
const emptyVercel =
  "vercel: the manifest-derived empty installation typechecks";

test("only the root README can skip scaffold validation", () => {
  expect(scaffoldValidationPattern(["README.md"])).toBeNull();
  expect(scaffoldValidationPattern(["apps/chat/README.md"])).not.toBeNull();
  expect(
    scaffoldValidationPattern([
      "README.md",
      ".github/workflows/cli-scaffold.yml",
    ])
  ).not.toBeNull();
});

test("gateway and dependency changes, missing diffs, and empty diffs check all adapters", () => {
  for (const paths of [
    undefined,
    [],
    ["bun.lock"],
    ["packages/registry/package.json"],
    ["packages/registry/src/gateways/litellm/gateway.ts"],
    ["apps/chat/chatjs/core/gateway/runtime.ts"],
  ]) {
    const pattern = new RegExp(scaffoldValidationPattern(paths) ?? "^$", "u");
    expect(pattern.test(emptyOpenAI)).toBe(true);
    expect(pattern.test(emptyVercel)).toBe(true);
  }
});

test("changes to known items select their isolated cases plus the default and full preset", () => {
  const pattern = new RegExp(
    scaffoldValidationPattern([
      "packages/registry/src/plugins/projects/chatjs.json",
      "packages/registry/src/tools/generate-image/tool.ts",
    ]) ?? "^$",
    "u"
  );
  expect(pattern.test(emptyVercel)).toBe(true);
  expect(
    pattern.test("full feature preset: metadata-derived composition typechecks")
  ).toBe(true);
  expect(
    pattern.test("projects: catalog-derived plugin selection typechecks")
  ).toBe(true);
  expect(
    pattern.test("image generation installs and typechecks with viewer=false")
  ).toBe(true);
  expect(
    pattern.test("guest-chat: catalog-derived plugin selection typechecks")
  ).toBe(false);
  expect(pattern.test(emptyOpenAI)).toBe(false);
});
