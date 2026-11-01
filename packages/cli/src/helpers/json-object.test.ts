import { expect, test } from "bun:test";

import {
  isJsonObject,
  parseJsonObject,
  requireJsonObject,
} from "./json-object";

test("object parsing keeps extension fields, explicit nulls, and original property order", () => {
  const source = '{"extension":{"nested":true},"optional":null,"name":"app"}';
  const object = parseJsonObject(source, "Template config");
  expect(JSON.stringify(object)).toBe(source);
  expect(requireJsonObject(object, "Template config")).toBe(object);
});

test("object parsing preserves syntax errors and rejects non-object documents", () => {
  expect(() => parseJsonObject("{", "Template config")).toThrow(SyntaxError);
  for (const source of ["null", "[]", '"value"', "true", "42"]) {
    expect(() => parseJsonObject(source, "Template config")).toThrow(TypeError);
    expect(() => parseJsonObject(source, "Template config")).toThrow(
      "Template config must be a JSON object."
    );
  }
});

test("nested map validation rejects missing values and arrays", () => {
  const object = parseJsonObject('{"dependencies":[]}', "Manifest");
  expect(isJsonObject(object.dependencies)).toBe(false);
  expect(() => requireJsonObject(object.dependencies, "Dependencies")).toThrow(
    TypeError
  );
  expect(() => requireJsonObject(object.missing, "Dependencies")).toThrow(
    TypeError
  );
});
