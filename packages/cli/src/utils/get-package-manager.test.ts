import { describe, expect, it } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture inspects project files using native filesystem APIs.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";

import { inferPackageManager } from "./get-package-manager";

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
describe("inferPackageManager", () => {
  it("falls back to the launcher package manager when no lockfile is present", () => {
    const cwd = path.join(tmpdir(), `chat-js-pm-${crypto.randomUUID()}`);
    const originalUserAgent = process.env.npm_config_user_agent;

    mkdirSync(cwd, { recursive: true });
    process.env.npm_config_user_agent = "bun/1.3.1 node/v22.14.0 darwin arm64";

    try {
      expect(inferPackageManager(cwd)).toBe("bun");
    } finally {
      if (originalUserAgent === undefined) {
        delete process.env.npm_config_user_agent;
      } else {
        process.env.npm_config_user_agent = originalUserAgent;
      }
      rmSync(cwd, { force: true, recursive: true });
    }
  });

  it("prefers project lockfiles over the launcher user agent", () => {
    const cwd = path.join(tmpdir(), `chat-js-pm-${crypto.randomUUID()}`);
    const originalUserAgent = process.env.npm_config_user_agent;

    mkdirSync(cwd, { recursive: true });
    writeFileSync(path.join(cwd, "pnpm-lock.yaml"), "");
    process.env.npm_config_user_agent = "npx/10.9.0 node/v22.14.0 darwin arm64";

    try {
      expect(inferPackageManager(cwd)).toBe("pnpm");
    } finally {
      if (originalUserAgent === undefined) {
        delete process.env.npm_config_user_agent;
      } else {
        process.env.npm_config_user_agent = originalUserAgent;
      }
      rmSync(cwd, { force: true, recursive: true });
    }
  });
});
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable node/no-sync */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
for (const manifest of ["{", "", "null", '{"packageManager":42}']) {
  it(`uses a lockfile when the manifest is unusable: ${manifest}`, () => {
    const cwd = path.join(tmpdir(), `chat-js-pm-${crypto.randomUUID()}`);
    mkdirSync(cwd, { recursive: true });
    try {
      writeFileSync(path.join(cwd, "package.json"), manifest);
      writeFileSync(path.join(cwd, "pnpm-lock.yaml"), "");
      expect(inferPackageManager(cwd)).toBe("pnpm");
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  });
}
/* oxlint-enable node/no-sync */
