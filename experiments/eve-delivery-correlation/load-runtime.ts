// oxlint-disable-next-line import/no-nodejs-modules -- This isolated runtime proof owns disposable files, process controls and Node assertions.
import path from "node:path";

import { plugin } from "bun";
import { z } from "zod";

import type { RuntimeModules } from "./runtime-types";

const root = path.resolve("apps/chat/.eve");
const source = path.resolve(root, "lane-c-runtime/packages/eve/src");
const dist = path.resolve(root, "lane-c-stock-deps/node_modules/eve/dist/src");
const changed = new Set([
  "channel/session",
  "channel/adapter",
  "eve-channel/request",
  "eve-channel/index",
  "harness/messages",
  "harness/emission",
  "protocol/message",
  "internal/message-correlation",
]);
// oxlint-disable-next-line node/no-process-env -- Read only the isolated worker configuration; provider and application credentials are never forwarded.
const patched = process.env.CORRELATION_PATCHED === "1";
plugin({
  name: "isolated-eve-correlation",
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
  setup(build) {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback is typed by the released runtime SDK; it reads the supplied event without changing SDK assignability.
    build.onResolve({ filter: /^#/u }, ({ path: modulePath }) => {
      const key = modulePath.replace(/^#/u, "").replace(/\.js$/u, "");
      return {
        path: path.resolve(
          patched && changed.has(key) ? source : dist,
          key + (patched && changed.has(key) ? ".ts" : ".js")
        ),
      };
    });
  },
});
const moduleMembers: Readonly<Record<keyof RuntimeModules, readonly string[]>> =
  {
    "channel/adapter": ["defaultDeliverResult"],
    "channel/session": ["createSession"],
    "eve-channel/request": ["parseCreateBody", "parseSessionMessageBody"],
    "harness/emission": ["emitTurnPreamble"],
    "harness/messages": ["coalesceTurnInputs", "createTurnInputMessages"],
  };
const runtime = async <Key extends keyof RuntimeModules>(
  key: Key
): Promise<RuntimeModules[Key]> => {
  const loaded: unknown = await import(
    path.resolve(
      patched && changed.has(key) ? source : dist,
      key + (patched && changed.has(key) ? ".ts" : ".js")
    )
  );
  return z
    .custom<RuntimeModules[Key]>(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        moduleMembers[key].every(
          (name) => typeof Reflect.get(candidate, name) === "function"
        )
    )
    .parse(loaded);
};
export { runtime, patched };
