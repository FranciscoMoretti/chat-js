import { spawnSync } from "node:child_process";
import path from "node:path";

import { env } from "../lib/env";

const roots = env.CHATJS_GUEST_ONLY ? ["guest"] : [".", "guest"];
for (const root of roots) {
  const result = spawnSync("bun", ["x", "eve", "build"], {
    cwd: path.resolve(process.cwd(), root),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`EVE build failed for ${root}`, { cause: result.error });
  }
}
