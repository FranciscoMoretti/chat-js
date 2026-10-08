import { describe, expect, it } from "bun:test";

import type { WorktreeEnvConfig } from "./worktree-runtime";
import { isWorktreeEnvConfig } from "./worktree-config";
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
          apps: {
            chat: { offset: ZERO_OFFSET },
            site: { offset: ZERO_OFFSET },
          },
          range: config.range,
          slot: config.slot,
          url: config.url,
        },
        {}
      )
    ).toThrow(`offset ${ZERO_OFFSET}`);
  });

  it("requires at least one app", () => {
    expect(() =>
      resolveWorktreeRuntime(
        { apps: {}, range: config.range, slot: config.slot, url: config.url },
        {}
      )
    ).toThrow("at least one app");
  });

  it("requires a valid slot environment variable", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          apps: config.apps,
          range: config.range,
          slot: { default: config.slot.default, env: "not valid" },
          url: config.url,
        },
        {}
      )
    ).toThrow("slot.env");
  });
});

describe("validates app ports", () => {
  it("rejects offsets outside the reserved range", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          apps: { chat: { offset: PORT_RANGE_STRIDE } },
          range: config.range,
          slot: config.slot,
          url: config.url,
        },
        {}
      )
    ).toThrow("stride");
  });

  it("rejects privileged ports", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          apps: config.apps,
          range: { base: PRIVILEGED_PORT, stride: config.range.stride },
          slot: config.slot,
          url: config.url,
        },
        {}
      )
    ).toThrow("1024-65535");
  });
});

describe("validates template references", () => {
  it("rejects unknown template variables", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          apps: {
            chat: {
              exports: { APP_URL: "{apps.missing.url}" },
              offset: ZERO_OFFSET,
            },
          },
          range: config.range,
          slot: config.slot,
          url: config.url,
        },
        {}
      )
    ).toThrow("apps.missing.url");
  });

  it("rejects cross-app references in the shared URL template", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          apps: config.apps,
          range: config.range,
          slot: config.slot,
          url: "http://localhost:{apps.chat.port}",
        },
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
