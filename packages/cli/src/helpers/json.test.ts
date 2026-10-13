import { expect, test } from "bun:test";

import { parseJsonObject } from "./json-object";
import { parsePackageJson } from "./package-manifest";

test("manifest parsing preserves extension fields and checks consumed maps", (): void => {
  const source =
    '{"custom":{"enabled":true},"dependencies":{"eve":"npm:@chat-js/eve"},"scripts":{"dev":"next dev"}}';
  const expected = {
    custom: { enabled: true },
    dependencies: { eve: "npm:@chat-js/eve" },
    scripts: { dev: "next dev" },
  };
  expect(parsePackageJson(source)).toEqual(expected);
  const legacy =
    '{"scripts":null,"dependencies":null,"devDependencies":null,"overrides":null,"extension":true}';
  expect(JSON.stringify(parsePackageJson(legacy))).toBe(legacy);
  for (const invalid of [
    "null",
    "[]",
    '"text"',
    '{"dependencies":{"eve":false}}',
    '{"scripts":[]}',
    '{"overrides":false}',
  ]) {
    expect(() => parsePackageJson(invalid)).toThrow(TypeError);
  }
  expect(() => parseJsonObject("{", "JSON fixture")).toThrow(SyntaxError);
});
