import { describe, expect, it } from "bun:test";

import { isWorktreeEnvConfig } from "./worktree-config";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { WorktreeEnvConfig } from "./worktree-runtime";
/* oxlint-enable sort-imports */
import { resolveWorktreeRuntime } from "./worktree-runtime";

const ZERO_OFFSET = 0;
const DEFAULT_SLOT = 0;
const FIRST_OFFSET = 1;
const SECOND_OFFSET = 2;
const TEST_SLOT = 6;
const PORT_RANGE_BASE = 3000;
const PORT_RANGE_STRIDE = 10;
const CHAT_PORT = 3060;
const ELECTRON_PORT = 3061;
const SITE_PORT = 3062;
const PRIVILEGED_PORT = 1023;

const config = {
  apps: {
    chat: {
      exports: { APP_URL: "{url}", PORT: "{port}" },
      offset: ZERO_OFFSET,
    },
    electron: {
      exports: { ELECTRON_APP_URL: "{apps.chat.url}" },
      offset: FIRST_OFFSET,
    },
    site: { exports: { PORT: "{port}" }, offset: SECOND_OFFSET },
  },
  range: { base: PORT_RANGE_BASE, stride: PORT_RANGE_STRIDE },
  slot: { default: DEFAULT_SLOT, env: "CHATJS_DEV_SLOT" },
  url: "http://localhost:{port}",
} satisfies WorktreeEnvConfig;

describe("resolveWorktreeRuntime", () => {
  it("assigns stable app offsets within slot 6", () => {
    expect(
      resolveWorktreeRuntime(config, { CHATJS_DEV_SLOT: String(TEST_SLOT) })
    ).toEqual({
      apps: {
        chat: {
          env: {
            APP_URL: `http://localhost:${CHAT_PORT}`,
            PORT: String(CHAT_PORT),
          },
          port: CHAT_PORT,
          url: `http://localhost:${CHAT_PORT}`,
        },
        electron: {
          env: {
            ELECTRON_APP_URL: `http://localhost:${CHAT_PORT}`,
          },
          port: ELECTRON_PORT,
          url: `http://localhost:${ELECTRON_PORT}`,
        },
        site: {
          env: { PORT: String(SITE_PORT) },
          port: SITE_PORT,
          url: `http://localhost:${SITE_PORT}`,
        },
      },
      slot: TEST_SLOT,
    });
  });

  it("uses the configured default slot", () => {
    expect(resolveWorktreeRuntime(config, {}).slot).toBe(DEFAULT_SLOT);
  });
});

describe("rejects malformed worktree runtime settings", () => {
  it.each(["", "abc", "-1", "1.5"])("rejects invalid slot %p", (slot) => {
    expect(() =>
      resolveWorktreeRuntime(config, { CHATJS_DEV_SLOT: slot })
    ).toThrow("CHATJS_DEV_SLOT");
  });

  it("rejects duplicate app offsets", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...config,
          apps: {
            chat: { offset: ZERO_OFFSET },
            site: { offset: ZERO_OFFSET },
          },
        },
        {}
      )
    ).toThrow(`offset ${ZERO_OFFSET}`);
  });

  it("requires at least one app", () => {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    expect(() => resolveWorktreeRuntime({ ...config, apps: {} }, {})).toThrow(
      "at least one app"
    );
  });

  it("requires a valid slot environment variable", () => {
    expect(() =>
      resolveWorktreeRuntime(
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing config.slot own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...config, slot: { ...config.slot, env: "not valid" } },
        {}
      )
    ).toThrow("slot.env");
  });
});

describe("validates app ports and template references", () => {
  it("rejects offsets outside the reserved range", () => {
    expect(() =>
      resolveWorktreeRuntime(
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...config, apps: { chat: { offset: PORT_RANGE_STRIDE } } },
        {}
      )
    ).toThrow("stride");
  });

  it("rejects privileged ports", () => {
    expect(() =>
      resolveWorktreeRuntime(
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing config.range own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...config, range: { ...config.range, base: PRIVILEGED_PORT } },
        {}
      )
    ).toThrow("1024-65535");
  });

  it("rejects unknown template variables", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...config,
          apps: {
            chat: {
              exports: { APP_URL: "{apps.missing.url}" },
              offset: ZERO_OFFSET,
            },
          },
        },
        {}
      )
    ).toThrow("apps.missing.url");
  });

  it("rejects cross-app references in the shared URL template", () => {
    expect(() =>
      resolveWorktreeRuntime(
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...config, url: "http://localhost:{apps.chat.port}" },
        {}
      )
    ).toThrow("url must not reference other apps");
  });
});

describe("worktree environment config shape", () => {
  it("accepts the documented runtime config structure", () => {
    expect(isWorktreeEnvConfig(config)).toBe(true);
  });

  it("rejects parsed JSON with an invalid runtime shape", () => {
    const invalidConfig: unknown = JSON.parse(
      '{"apps":{},"range":{"base":3000,"stride":10},"slot":null,"url":"x"}'
    );
    expect(isWorktreeEnvConfig(invalidConfig)).toBe(false);
  });
});
