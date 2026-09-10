import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inferPackageManager } from "./get-package-manager";

describe("inferPackageManager", () => {
  it("falls back to the launcher package manager when no lockfile is present", () => {
    const cwd = join(tmpdir(), `chat-js-pm-${crypto.randomUUID()}`);
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
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("prefers project lockfiles over the launcher user agent", () => {
    const cwd = join(tmpdir(), `chat-js-pm-${crypto.randomUUID()}`);
    const originalUserAgent = process.env.npm_config_user_agent;

    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    process.env.npm_config_user_agent = "npx/10.9.0 node/v22.14.0 darwin arm64";

    try {
      expect(inferPackageManager(cwd)).toBe("pnpm");
    } finally {
      if (originalUserAgent === undefined) {
        delete process.env.npm_config_user_agent;
      } else {
        process.env.npm_config_user_agent = originalUserAgent;
      }
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

for (const manifest of ["{", "", "null", '{"packageManager":42}']) {
	it(`uses a lockfile when the manifest is unusable: ${manifest}`, () => {
		const cwd = join(tmpdir(), `chat-js-pm-${crypto.randomUUID()}`);
		mkdirSync(cwd, { recursive: true });
		try {
			writeFileSync(join(cwd, "package.json"), manifest);
			writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
			expect(inferPackageManager(cwd)).toBe("pnpm");
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
}
