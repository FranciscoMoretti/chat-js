import { isNonEmptyString } from "@/lib/is-non-empty-string";

import {
  ContextContainer,
  contextStorage,
} from "@eve-test/dist/src/context/container.js";
import {
  deserializeContext,
  serializeContext,
} from "@eve-test/dist/src/context/serialize.js";
import { expect, it, vi } from "vitest";

import type {
  installedDocumentKinds,
  installedToolNames,
} from "@/integrations/tool-catalog";

import selectionHook from "../../agent/hooks/tool-selection";
import { frontendToolsSchema } from "../ai/types";
import { eveCreationContentHash } from "./creation-content-hash";
import {
  moveRejectedContextCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
import { selectedEveTools } from "./selected-tools";
import {
  eveInstalledToolEnabled,
  eveTurnTool,
  filterEveTools,
} from "./turn-tools";

const mocks = vi.hoisted(() => ({ kinds: new Set<string>() }));
vi.mock("@/integrations/tool-catalog", async (importOriginal) => {
  const actual = await importOriginal<{
    installedDocumentKinds: typeof installedDocumentKinds;
    installedToolNames: typeof installedToolNames;
  }>();
  for (const kind of actual.installedDocumentKinds) {
    mocks.kinds.add(kind);
  }
  return { ...actual, installedDocumentKinds: mocks.kinds };
});

const startTurn = async (selectedTool?: string, principalType = "user") =>
  await selectionHook.events?.["turn.started"]?.(
    {
      data: { sequence: 1, turnId: "turn_1" },
      meta: { at: "2026-09-12T12:00:00Z", id: "event_1" },
      type: "turn.started",
    },
    {
      agent: { name: "chatjs" },
      channel: {},
      cancel: (): never => {
        throw new Error("Unexpected cancellation");
      },
      getSandbox: () => {
        throw new Error("Unexpected sandbox access");
      },
      session: {
        auth: {
          current: {
            attributes: {
              ...(isNonEmptyString(selectedTool) ? { selectedTool } : {}),
              ...(principalType === "guest" ? { chatjsGuest: "true" } : {}),
            },
            authenticator: "chatjs-gateway",
            principalId: "owner",
            principalType: "user",
          },
          initiator: {
            attributes: { selectedTool: "webSearch" },
            authenticator:
              principalType === "guest"
                ? "chatjs-disposable-guest"
                : "chatjs-gateway",
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "session",
        turn: { id: "turn_1", sequence: 1 },
      },
    }
  );

it("limits every toolbox and resets a later automatic turn instead of inheriting the initiator's choice", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    await startTurn("webSearch");
    const tools = {
      confirm_note: {},
      deepResearch: {},
      server__echo: {},
      webSearch: {},
      wordCount: {},
    };
    const available = filterEveTools(tools);
    expect(Object.keys(available)).toEqual(["webSearch"]);
    expect(available.webSearch).toBe(tools.webSearch);
    expect(Object.keys(tools)).toEqual([
      "confirm_note",
      "deepResearch",
      "server__echo",
      "webSearch",
      "wordCount",
    ]);
    expect(eveTurnTool.get()).toBe("webSearch");
    await startTurn();
    const automatic = filterEveTools(tools);
    expect(automatic).toEqual(tools);
    expect(automatic).not.toBe(tools);
    expect(automatic.confirm_note).toBe(tools.confirm_note);
  });
});
it("includes document revision reads without leaking unrelated tools", () => {
  expect(selectedEveTools("createTextDocument")?.toSorted()).toEqual(
    [
      "createTextDocument",
      "createCodeDocument",
      "createSheetDocument",
      "editTextDocument",
      "editCodeDocument",
      "editSheetDocument",
      "readDocument",
    ].toSorted()
  );
  for (const tool of [
    "createCodeDocument",
    "createSheetDocument",
    "editTextDocument",
    "editCodeDocument",
    "editSheetDocument",
  ] as const) {
    expect(selectedEveTools(tool)).toEqual(
      selectedEveTools("createTextDocument")
    );
  }
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
  (...modelIds: Readonly<[string, string] | [string]>) => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string): void => {
        entries.delete(key);
      },
      setItem: (key: string, value: string): void => {
        entries.set(key, value);
      },
    };
    const projectId = crypto.randomUUID();
    const context = {
      key: `project:${projectId}`,
      label: "project",
    };
    const original = prepareSelectedCreation(
      storage,
      "owner",
      "hello",
      modelIds,
      { context },
      "webSearch",
      { projectId }
    );
    expect(readCreationRequest(storage, "owner", { context })).toEqual(
      original
    );
    expect(
      prepareSelectedCreation(
        storage,
        "owner",
        "changed",
        modelIds,
        { context },
        "deepResearch"
      )
    ).toEqual(original);
    const moved = moveRejectedContextCreation(
      storage,
      "owner",
      context,
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
  const resumed = await deserializeContext(saved);
  await contextStorage.run(resumed, async () => {
    expect(
      Object.keys(
        filterEveTools({
          createTextDocument: {},
          readDocument: {},
          wordCount: {},
        })
      )
    ).toEqual(["createTextDocument", "readDocument"]);
    await startTurn();
    expect(eveTurnTool.get()).toBeNull();
  });
});
it("guest automatic and explicit turns retain only configured anonymous tools", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    const tools = {
      confirm_note: {},
      deepResearch: {},
      server__echo: {},
      webSearch: {},
    };
    await startTurn(undefined, "guest");
    expect(Object.keys(filterEveTools(tools))).toEqual([]);
    await startTurn("deepResearch", "guest");
    expect(filterEveTools(tools)).toEqual({});
    await startTurn();
    expect(filterEveTools(tools)).toEqual(tools);
  });
});

it("withholds removed document writes while preserving installed revision reads", () => {
  const original = new Set(mocks.kinds);
  const installed = mocks.kinds;
  try {
    installed.clear();
    expect(eveInstalledToolEnabled("readDocument")).toBe(true);
    expect(eveInstalledToolEnabled("createTextDocument")).toBe(false);
    installed.add("text");
    expect(eveInstalledToolEnabled("readDocument")).toBe(true);
    expect(eveInstalledToolEnabled("createTextDocument")).toBe(true);
    expect(eveInstalledToolEnabled("createCodeDocument")).toBe(false);
  } finally {
    installed.clear();
    for (const kind of original) {
      installed.add(kind);
    }
  }
});
