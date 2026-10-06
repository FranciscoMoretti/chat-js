import { resolve } from "node:path";

import { plugin } from "bun";
const root = resolve("apps/chat/.eve");
const source = resolve(root, "lane-c-runtime/packages/eve/src");
const dist = resolve(root, "lane-c-stock-deps/node_modules/eve/dist/src");
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
export const patched = process.env.CORRELATION_PATCHED === "1";
plugin({
  name: "isolated-eve-correlation",
  setup(build) {
    build.onResolve({ filter: /^#/ }, ({ path }) => {
      const key = path.slice(1, -3);
      return {
        path: resolve(
          patched && changed.has(key) ? source : dist,
          key + (patched && changed.has(key) ? ".ts" : ".js")
        ),
      };
    });
  },
});
export const runtime = async (key) =>
  import(
    resolve(
      patched && changed.has(key) ? source : dist,
      key + (patched && changed.has(key) ? ".ts" : ".js")
    )
  );
