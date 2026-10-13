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
const patched = process.env.CORRELATION_PATCHED === "1";
plugin({
  name: "isolated-eve-correlation",
  setup(build) {
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
