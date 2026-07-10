import { describe, expect, it } from "bun:test";
import type { WorktreeEnvConfig } from "./worktree-runtime";
import { resolveWorktreeRuntime } from "./worktree-runtime";

const config = {
  slot: { default: 0, env: "CHATJS_DEV_SLOT" },
  range: { base: 3000, stride: 10 },
  url: "http://localhost:{port}",
  apps: {
    chat: {
      offset: 0,
      exports: { APP_URL: "{url}", PORT: "{port}" },
    },
    electron: {
      offset: 1,
      exports: { ELECTRON_APP_URL: "{apps.chat.url}" },
    },
    site: { offset: 2, exports: { PORT: "{port}" } },
  },
} satisfies WorktreeEnvConfig;

describe("resolveWorktreeRuntime", () => {
  it("assigns stable app offsets within slot 6", () => {
    expect(resolveWorktreeRuntime(config, { CHATJS_DEV_SLOT: "6" })).toEqual({
      apps: {
        chat: {
          env: {
            APP_URL: "http://localhost:3060",
            PORT: "3060",
          },
          port: 3060,
          url: "http://localhost:3060",
        },
        electron: {
          env: {
            ELECTRON_APP_URL: "http://localhost:3060",
          },
          port: 3061,
          url: "http://localhost:3061",
        },
        site: {
          env: { PORT: "3062" },
          port: 3062,
          url: "http://localhost:3062",
        },
      },
      slot: 6,
    });
  });

  it("uses the configured default slot", () => {
    expect(resolveWorktreeRuntime(config, {}).slot).toBe(0);
  });

  it.each(["", "abc", "-1", "1.5"])("rejects invalid slot %p", (slot) => {
    expect(() =>
      resolveWorktreeRuntime(config, { CHATJS_DEV_SLOT: slot })
    ).toThrow("CHATJS_DEV_SLOT");
  });

  it("rejects duplicate app offsets", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          ...config,
          apps: { chat: { offset: 0 }, site: { offset: 0 } },
        },
        {}
      )
    ).toThrow("offset 0");
  });

  it("requires at least one app", () => {
    expect(() => resolveWorktreeRuntime({ ...config, apps: {} }, {})).toThrow(
      "at least one app"
    );
  });

  it("requires a valid slot environment variable", () => {
    expect(() =>
      resolveWorktreeRuntime(
        { ...config, slot: { ...config.slot, env: "not valid" } },
        {}
      )
    ).toThrow("slot.env");
  });

  it("rejects offsets outside the reserved range", () => {
    expect(() =>
      resolveWorktreeRuntime({ ...config, apps: { chat: { offset: 10 } } }, {})
    ).toThrow("stride");
  });

  it("rejects privileged ports", () => {
    expect(() =>
      resolveWorktreeRuntime(
        { ...config, range: { ...config.range, base: 1023 } },
        {}
      )
    ).toThrow("1024-65535");
  });

  it("rejects unknown template variables", () => {
    expect(() =>
      resolveWorktreeRuntime(
        {
          ...config,
          apps: {
            chat: { offset: 0, exports: { APP_URL: "{apps.missing.url}" } },
          },
        },
        {}
      )
    ).toThrow("apps.missing.url");
  });

  it("rejects cross-app references in the shared URL template", () => {
    expect(() =>
      resolveWorktreeRuntime(
        { ...config, url: "http://localhost:{apps.chat.port}" },
        {}
      )
    ).toThrow("url must not reference other apps");
  });
});
