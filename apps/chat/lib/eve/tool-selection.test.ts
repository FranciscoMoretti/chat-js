import { expect, it, vi } from "vitest";

import {
  ContextContainer,
  contextStorage,
} from "../../../../node_modules/eve/dist/src/context/container.js";
import {
  deserializeContext,
  serializeContext,
} from "../../../../node_modules/eve/dist/src/context/serialize.js";
import selectionHook from "../../agent/hooks/tool-selection";
import { frontendToolsSchema } from "../ai/types";
import { eveCreationContentHash } from "./creation-content-hash";
import {
  moveRejectedProjectCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
import { selectedEveTools } from "./selected-tools";
import { eveTurnTool, filterEveTools } from "./turn-tools";

vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: { AVAILABLE_TOOLS: ["webSearch"] },
}));

function startTurn(selectedTool?: string, principalType = "user") {
  return selectionHook.events?.["turn.started"]?.(
    {
      type: "turn.started",
      data: { sequence: 1, turnId: "turn_1" },
      meta: { at: "2026-09-12T12:00:00Z", id: "event_1" },
    },
    {
      agent: { name: "chatjs" },
      channel: {},
      session: {
        id: "session",
        turn: { id: "turn_1", sequence: 1 },
        auth: {
          current: {
            principalId: "owner",
            principalType: "user",
            authenticator: "gateway",
            attributes: {
              ...(selectedTool ? { selectedTool } : {}),
              ...(principalType === "guest" ? { chatjsGuest: "true" } : {}),
            },
          },
          initiator: {
            principalId: "owner",
            principalType: "user",
            authenticator: "gateway",
            attributes: { selectedTool: "webSearch" },
          },
        },
      },
      getSandbox: () => {
        throw new Error("Unexpected sandbox access");
      },
      getSkill: () => {
        throw new Error("Unexpected skill access");
      },
    }
  );
}

it("limits every toolbox and resets a later automatic turn instead of inheriting the initiator's choice", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    await startTurn("webSearch");
    const tools = {
      webSearch: {},
      deepResearch: {},
      server__echo: {},
      wordCount: {},
      confirm_note: {},
    };
    expect(Object.keys(filterEveTools(tools))).toEqual(["webSearch"]);
    expect(eveTurnTool.get()).toBe("webSearch");
    await startTurn();
    expect(filterEveTools(tools)).toEqual(tools);
  });
});

it("includes document revision reads without leaking unrelated tools", () => {
  expect(selectedEveTools("createTextDocument")).toEqual([
    "createTextDocument",
    "createCodeDocument",
    "createSheetDocument",
    "editTextDocument",
    "editCodeDocument",
    "editSheetDocument",
    "readDocument",
  ]);
  expect(selectedEveTools("generateVideo")).toEqual(["generateVideo"]);
});

it.each(frontendToolsSchema.options)(
  "never treats explicit %s as automatic",
  (selected) => {
    expect(selectedEveTools(selected)).toContain(selected);
    expect(selectedEveTools(selected)).not.toContain("server__echo");
  }
);

it("includes tool selection in creation identity while preserving existing automatic identities", () => {
  expect(eveCreationContentHash("hello")).toBeUndefined();
  const search = eveCreationContentHash("hello", "webSearch");
  expect(search).toBe(eveCreationContentHash("hello", "webSearch"));
  expect(search).not.toBe(eveCreationContentHash("hello", "deepResearch"));
  expect(search).not.toBe(eveCreationContentHash("changed", "webSearch"));
});

it.each([["model-a"], ["model-a", "model-b"]])(
  "retains exact selected tools through retry and rejected-project recovery: %j",
  (...modelIds) => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    };
    const projectId = crypto.randomUUID();
    const original = prepareSelectedCreation(
      storage,
      "owner",
      "hello",
      modelIds,
      { projectId },
      "webSearch"
    );
    expect(readCreationRequest(storage, "owner", { projectId })).toEqual(
      original
    );
    expect(
      prepareSelectedCreation(
        storage,
        "owner",
        "changed",
        modelIds,
        { projectId },
        "deepResearch"
      )
    ).toEqual(original);
    const moved = moveRejectedProjectCreation(
      storage,
      "owner",
      projectId,
      original.operationId
    );
    expect(moved.selectedTool).toBe("webSearch");
    expect(moved.operationId).not.toBe(original.operationId);
  }
);

it("restores the selected capability from Eve serialized context before a resumed step", async () => {
  const original = new ContextContainer();
  const saved = await contextStorage.run(original, async () => {
    await startTurn("createTextDocument");
    return serializeContext(original);
  });
  expect(saved["chatjs.turn-tool"]).toBe("createTextDocument");
  const resumed = await deserializeContext(JSON.parse(JSON.stringify(saved)));
  await contextStorage.run(resumed, async () => {
    expect(
      Object.keys(
        filterEveTools({
          readDocument: {},
          wordCount: {},
          createTextDocument: {},
        })
      )
    ).toEqual(["readDocument", "createTextDocument"]);
    await startTurn();
    expect(eveTurnTool.get()).toBeNull();
  });
});

it("guest automatic and explicit turns retain only configured anonymous tools", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    const tools = {
      webSearch: {},
      deepResearch: {},
      confirm_note: {},
      server__echo: {},
    };
    await startTurn(undefined, "guest");
    expect(Object.keys(filterEveTools(tools))).toEqual(["webSearch"]);
    await startTurn("deepResearch", "guest");
    expect(filterEveTools(tools)).toEqual({});
    await startTurn();
    expect(filterEveTools(tools)).toEqual(tools);
  });
});
