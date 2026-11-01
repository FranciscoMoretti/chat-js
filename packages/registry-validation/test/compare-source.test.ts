import { expect, test } from "bun:test";
import { compareRegistrySource } from "../src/compare";
import type { FormatSource } from "../src/compare";

const input = {
  path: "settings.json",
  baseline: '{"label":"hello world"}',
  local: '{ "label": "hello world" }\n',
};
const formatJson: FormatSource = async ({ source }) =>
  await Promise.resolve(JSON.stringify(JSON.parse(source), null, 2));

test("exact matches skip hooks; formatting comparison preserves meaningful string whitespace", async () => {
  expect(
    await compareRegistrySource({
      ...input,
      local: input.baseline,
      formatSource: () => {
        throw new Error("must not run");
      },
    })
  ).toEqual({ status: "unchanged" });
  expect(await compareRegistrySource(input)).toEqual({
    status: "modified",
    formatting: "unavailable",
  });
  expect(
    await compareRegistrySource({ ...input, formatSource: formatJson })
  ).toEqual({ status: "formatting-only" });
  expect(
    await compareRegistrySource({
      ...input,
      local: '{"label":"helloworld"}',
      formatSource: formatJson,
    })
  ).toEqual({ status: "modified", formatting: "different" });
});

test("both sides receive the destination path; unsupported and broken hooks cannot imply equality", async () => {
  const paths: string[] = [];
  expect(
    await compareRegistrySource({
      ...input,
      formatSource: (value) => {
        paths.push(value.path);
        return value.source === input.baseline ? null : "formatted";
      },
    })
  ).toEqual({ status: "modified", formatting: "unsupported" });
  expect(paths).toEqual([input.path, input.path]);
  expect(
    await compareRegistrySource({
      ...input,
      formatSource: () => {
        throw new Error("parse failed");
      },
    })
  ).toEqual({ status: "modified", formatting: "failed" });
  expect(
    await compareRegistrySource({
      ...input,
      // @ts-expect-error A JavaScript consumer can return invalid values.
      formatSource: () => ({ invalid: true }),
    })
  ).toEqual({ status: "modified", formatting: "failed" });
});

test("a rejected hook waits for the other invocation to finish", async () => {
  const gate = Promise.withResolvers<string>();
  let finished = false;
  const comparison = compareRegistrySource({
    ...input,
    formatSource: async ({ source }) => {
      if (source === input.baseline) {
        throw new Error("failed");
      }
      return await gate.promise;
    },
  }).then((result) => {
    finished = true;
    return result;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(finished).toBe(false);
  gate.resolve("formatted");
  expect(await comparison).toEqual({
    status: "modified",
    formatting: "failed",
  });
});
