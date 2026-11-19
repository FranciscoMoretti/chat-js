import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { testHookContext } from "../../tests/helpers/eve-hook-context";

import {
  ContextContainer,
  contextStorage,
} from "@eve-test/dist/src/context/container.js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import selectionHook from "../../agent/hooks/tool-selection";
import { frontendToolsSchema } from "../ai/types";
import { eveCreationContentHash } from "./creation-content-hash";
import {
  moveRejectedContextCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
import { selectedEveTools } from "./selected-tools";
import { eveTurnTool, filterEveTools } from "./turn-tools";

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-only");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only");
});
afterEach(() => vi.unstubAllEnvs());

const startTurn = async (selectedTool?: string, principalType = "user") =>
  await selectionHook.events?.["turn.started"]?.(
    {
      data: {
        turnId: "turn_1",
        cause: { deliveryId: "delivery" },
        follows: null,
      },
      type: "turn.started",
    },
    {
      ...testHookContext(),
      agent: { name: "chatjs" },
      channel: { kind: "http", metadata: {} },
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
            attributes: { selectedTool: "generateImage" },
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
    await startTurn("generateImage");
    const tools = {
      confirm_note: {},
      deepResearch: {},
      server__echo: {},
      generateImage: {},
      attach_workspace_file: {},
    };
    const available = filterEveTools(tools);
    expect(Object.keys(available)).toEqual(["generateImage"]);
    expect(available.generateImage).toBe(tools.generateImage);
    expect(Object.keys(tools)).toEqual([
      "confirm_note",
      "deepResearch",
      "server__echo",
      "generateImage",
      "attach_workspace_file",
    ]);
    expect(eveTurnTool.get()).toBe("generateImage");
    await startTurn();
    const automatic = filterEveTools(tools);
    expect(automatic).toEqual(tools);
    expect(automatic).not.toBe(tools);
    expect(automatic.confirm_note).toBe(tools.confirm_note);
  });
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
  const image = eveCreationContentHash("hello", "generateImage");
  expect(image).toBe(eveCreationContentHash("hello", "generateImage"));
  expect(image).not.toBe(eveCreationContentHash("hello", "deepResearch"));
  expect(image).not.toBe(eveCreationContentHash("changed", "generateImage"));
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
      "generateImage",
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
    expect(moved.selectedTool).toBe("generateImage");
    expect(moved.operationId).not.toBe(original.operationId);
  }
);

it("guest automatic and explicit turns retain only configured anonymous tools", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    const tools = {
      confirm_note: {},
      deepResearch: {},
      server__echo: {},
      generateImage: {},
    };
    await startTurn(undefined, "guest");
    expect(Object.keys(filterEveTools(tools))).toEqual([]);
    await startTurn("deepResearch", "guest");
    expect(filterEveTools(tools)).toEqual({});
    await startTurn();
    expect(filterEveTools(tools)).toEqual(tools);
  });
});

it("rejects unconfigured image generation without disabling native research", async () => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  await contextStorage.run(new ContextContainer(), async () => {
    await expect(startTurn("generateImage")).rejects.toThrow(
      "BLOB_READ_WRITE_TOKEN"
    );
    await startTurn();
    expect(
      filterEveTools({ generateImage: {}, deepResearch: {}, server__echo: {} })
    ).toEqual({ deepResearch: {}, server__echo: {} });
  });
});

it("offers the configured workspace attachment tool alongside selected research", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    const tools = {
      deepResearch: {},
      attach_workspace_file: {},
      generateImage: {},
      import_file: {},
    };
    await startTurn("deepResearch");
    expect(filterEveTools(tools)).toEqual({
      deepResearch: tools.deepResearch,
      attach_workspace_file: tools.attach_workspace_file,
    });
    expect(filterEveTools({ deepResearch: tools.deepResearch })).toEqual({
      deepResearch: tools.deepResearch,
    });
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(filterEveTools(tools)).toEqual({ deepResearch: tools.deepResearch });
  });
});
