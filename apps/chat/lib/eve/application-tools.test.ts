import { tool } from "ai";
import { beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import application from "../../agent/tools/application";

const settings = vi.hoisted(() => ({ enabled: false, approval: false }));
vi.mock("../config", () => ({
  config: { ai: { tools: { urlRetrieval: settings } } },
}));
vi.mock("../../tools/chatjs/tools", () => ({
  tools: {
    customEcho: tool({
      description: "Custom registered echo",
      inputSchema: z.object({ text: z.string() }),
      execute: ({ text }) => text,
      get needsApproval() {
        return settings.approval;
      },
    }),
    retrieveUrl: tool({
      inputSchema: z.object({ url: z.string() }),
      execute: ({ url }) => url,
    }),
  },
}));

async function resolveTools() {
  const resolve = application.events["step.started"];
  if (!resolve) {
    throw new Error("Missing application tool resolver.");
  }
  return await resolve(
    {},
    {
      session: { id: "test", auth: { current: null, initiator: null } },
      channel: {},
      messages: [],
    }
  );
}

beforeEach(() => {
  settings.enabled = false;
  settings.approval = false;
});

test("advertises custom registrations without hardcoding their names", async () => {
  const definitions = await resolveTools();
  expect(Object.keys(definitions)).toEqual(["customEcho"]);
  expect(definitions.customEcho.inputSchema).toMatchObject({
    type: "object",
    properties: { text: { type: "string" } },
  });
});

test("preserves the application's URL retrieval gate", async () => {
  settings.enabled = true;
  expect(Object.keys(await resolveTools())).toEqual([
    "customEcho",
    "retrieveUrl",
  ]);
});

test("rejects custom approval policies rather than bypassing them", async () => {
  settings.approval = true;
  await expect(resolveTools()).rejects.toThrow("explicit Eve policy adapter");
});

vi.mock("./turn-tools", () => ({ filterEveTools: <T>(tools: T) => tools }));
