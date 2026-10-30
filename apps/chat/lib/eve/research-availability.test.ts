import {
  ContextContainer,
  contextStorage,
} from "@eve-test/dist/src/context/container.js";
import {
  deserializeContext,
  serializeContext,
} from "@eve-test/dist/src/context/serialize.js";
import { generateText, tool, wrapLanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

import { researchAvailable } from "@/tools/chatjs/deep-research/availability";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { installedToolAvailabilityMiddleware } from "./tool-availability";
import { eveTurnAccount, eveTurnTool } from "./turn-tools";

const mocks = vi.hoisted(() => {
  const tools: { webSearch?: object } = { webSearch: {} };
  return {
    research: true,
    text: true,
    tools,
  };
});
vi.mock("@/chatjs/generated/installed-tools", () => ({
  installedDocumentKinds: {
    has: (kind: string): boolean => kind === "text" && mocks.text,
    get size() {
      if (mocks.text) {
        return 1;
      }
      return 0;
    },
  },
  installedToolNames: { has: (): boolean => mocks.research },
}));
vi.mock("../../chatjs/generated/providers", () => ({
  providers: mocks.tools,
}));
beforeEach(() => {
  mocks.tools.webSearch = {};
  mocks.research = true;
  mocks.text = true;
});
it.each([
  "automatic",
  "selected",
  "other-tool",
  "disabled",
  "no-documents",
  "no-text",
  "guest",
  "anonymous",
  "uninstalled",
])("offers research only when available: %s", async (scenario) => {
  await contextStorage.run(new ContextContainer(), async () => {
    if (scenario === "uninstalled") {
      delete mocks.tools.webSearch;
    }
    mocks.research = scenario !== "disabled";
    mocks.text = scenario !== "no-text" && scenario !== "no-documents";
    eveTurnTool.update(() => null);
    if (scenario === "other-tool") {
      eveTurnTool.update(() => "webSearch");
    }
    if (scenario === "selected") {
      eveTurnTool.update(() => "deepResearch");
    }
    eveTurnAccount.update(() => scenario !== "guest");
    const principal = {
      attributes: {
        ...(scenario === "selected" ? { selectedTool: "deepResearch" } : {}),
        ...(scenario === "other-tool" ? { selectedTool: "webSearch" } : {}),
      },
      authenticator:
        scenario === "guest" ? "chatjs-disposable-guest" : "chatjs-gateway",
      principalId: "owner",
      principalType: "user",
    };
    const { session } = testToolContext();
    const provider = new MockLanguageModelV3({
      doGenerate: vi.fn().mockRejectedValue(new Error("provider reached")),
    });
    const definition = tool({ inputSchema: z.object({}) });
    await expect(
      generateText({
        maxRetries: 0,
        model: wrapLanguageModel({
          middleware: installedToolAvailabilityMiddleware({
            ...session,
            auth: {
              current: principal,
              initiator: scenario === "anonymous" ? null : principal,
            },
          }),
          model: provider,
        }),
        prompt: "Research",
        tools: { deepResearch: definition, webSearch: definition },
      })
    ).rejects.toThrow("provider reached");
    const names = provider.doGenerateCalls[0].tools?.map(
      (entry: { readonly name: string }) => entry.name
    );
    expect(names).toEqual(
      ["automatic", "selected"].includes(scenario)
        ? ["deepResearch", "webSearch"]
        : ["webSearch"]
    );
  });
});

it("preserves the turn restriction when approval/reconnect auth omits selectedTool", async () => {
  const original = new ContextContainer();
  const saved = contextStorage.run(original, () => {
    eveTurnTool.update(() => "webSearch");
    return serializeContext(original);
  });
  const resumed = await deserializeContext(saved);
  contextStorage.run(resumed, () => {
    const { session } = testToolContext({
      session: {
        auth: {
          current: {
            attributes: {},
            authenticator: "chatjs-gateway",
            principalId: "owner",
            principalType: "user",
          },
          initiator: {
            attributes: {},
            authenticator: "chatjs-gateway",
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "root",
        turn: { id: "turn", sequence: 1 },
      },
    });
    expect(researchAvailable(session)).toBe(false);
  });
});
