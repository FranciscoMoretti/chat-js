import { tool } from "ai";
import { beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import application from "../../agent/tools/application";

const settings = vi.hoisted(() => ({ approval: false, enabled: false }));
vi.mock("../config", () => ({
  config: { ai: { tools: { urlRetrieval: settings } } },
}));
vi.mock("../../tools/chatjs/tools", () => ({
  tools: {
    customEcho: tool({
      description: "Custom registered echo",
      execute: ({ text }) => text,
      inputSchema: z.object({ text: z.string() }),
      get needsApproval() {
        return settings.approval;
      },
    }),
    retrieveUrl: tool({
      execute: ({ url }) => url,
      inputSchema: z.object({ url: z.string() }),
    }),
    webSearch: tool({
      execute: ({ query }) => query,
      inputSchema: z.object({ query: z.string() }),
    }),
  },
}));

const resolveTools = async () => {
  const resolve = application.events["step.started"];
  if (!resolve) {
    throw new Error("Missing application tool resolver.");
  }
  return await resolve(
    {},
    {
      channel: {},
      messages: [],
      session: { auth: { current: null, initiator: null }, id: "test" },
    }
  );
};

beforeEach(() => {
  settings.enabled = false;
  settings.approval = false;
});

test("advertises custom registrations without hardcoding their names", async () => {
  const definitions = await resolveTools();
  expect(Object.keys(definitions)).toEqual(["customEcho"]);
  expect(definitions.customEcho.inputSchema).toMatchObject({
    properties: { text: { type: "string" } },
    type: "object",
  });
});

test("preserves the application's URL retrieval gate", async () => {
  settings.enabled = true;
  expect(Object.keys(await resolveTools())).toEqual([
    "customEcho",
    "retrieveUrl",
  ]);
});

test("leaves platform slots to the platform registry", async () => {
  const definitions = await resolveTools();
  expect(definitions).not.toHaveProperty("webSearch");
});

test("rejects custom approval policies rather than bypassing them", async () => {
  settings.approval = true;
  await expect(resolveTools()).rejects.toThrow("explicit Eve policy adapter");
});

vi.mock("./turn-tools", () => ({ filterEveTools: <T>(tools: T) => tools }));
