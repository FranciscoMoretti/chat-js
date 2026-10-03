/* oxlint-disable import/no-namespace, import/no-relative-parent-imports, sort-imports --
 * import/no-namespace (#528): The InstalledFeatures namespace is the consumed SDK/module interface; renaming all member references requires changing that import contract.
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/hooks/tool-selection"; "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import {
  ContextContainer,
  contextStorage,
} from "@eve-test/dist/src/context/container.js";
import {
  deserializeContext,
  serializeContext,
} from "@eve-test/dist/src/context/serialize.js";
import { expect, it, vi } from "vitest";

import type * as InstalledFeatures from "@/tools/chatjs/installed-features";

import selectionHook from "../../agent/hooks/tool-selection";
import { frontendToolsSchema } from "../ai/types";
import { eveCreationContentHash } from "./creation-content-hash";
import {
  moveRejectedProjectCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "./pending-create";
import { selectedEveTools } from "./selected-tools";
import {
  eveInstalledToolEnabled,
  eveTurnTool,
  filterEveTools,
} from "./turn-tools";
/* oxlint-enable import/no-namespace, import/no-relative-parent-imports, sort-imports */

const mocks = vi.hoisted(() => ({ kinds: new Set<string>() }));
/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): vi.mock("@/tools/chatjs/installed-features") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): vi.mock("@/tools/chatjs/installed-features") copies or separates ...actual while preserving existing object ownership; mutating source objects is not equivalent.
 */
vi.mock("@/tools/chatjs/installed-features", async (importOriginal) => {
  const actual = await importOriginal<typeof InstalledFeatures>();
  for (const kind of actual.installedDocumentKinds) {
    mocks.kinds.add(kind);
  }
  return { ...actual, installedDocumentKinds: mocks.kinds };
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: { AVAILABLE_TOOLS: ["webSearch"] },
}));

/* oxlint-disable no-ternary, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * no-ternary (#518): startTurn derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): startTurn handles optional selectionHook.events?.["turn.started"]?.( { data: { sequence: 1, turnId: "turn_1" },  without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): startTurn copies or separates ...(selectedTool ? { selectedTool } : {}); ...(principalType === "guest" ? { chatjsGuest: "true" } : {}) while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep startTurn's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): startTurn preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): startTurn intentionally keeps the existing falsy-value behavior of selectedTool; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const startTurn = (selectedTool?: string, principalType = "user") =>
  selectionHook.events?.["turn.started"]?.(
    {
      data: { sequence: 1, turnId: "turn_1" },
      meta: { at: "2026-09-12T12:00:00Z", id: "event_1" },
      type: "turn.started",
    },
    {
      agent: { name: "chatjs" },
      channel: {},
      getSandbox: () => {
        throw new Error("Unexpected sandbox access");
      },
      getSkill: () => {
        throw new Error("Unexpected skill access");
      },
      session: {
        auth: {
          current: {
            attributes: {
              ...(selectedTool ? { selectedTool } : {}),
              ...(principalType === "guest" ? { chatjsGuest: "true" } : {}),
            },
            authenticator: "gateway",
            principalId: "owner",
            principalType: "user",
          },
          initiator: {
            attributes: { selectedTool: "webSearch" },
            authenticator: "gateway",
            principalId: "owner",
            principalType: "user",
          },
        },
        id: "session",
        turn: { id: "turn_1", sequence: 1 },
      },
    }
  );
/* oxlint-enable no-ternary, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/promise-function-async, typescript/strict-boolean-expressions */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("limits every toolbox and resets a later automatic turn instead of inheriting the  sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
    expect(Object.keys(filterEveTools(tools))).toEqual(["webSearch"]);
    expect(eveTurnTool.get()).toBe("webSearch");
    await startTurn();
    expect(filterEveTools(tools)).toEqual(tools);
  });
});
/* oxlint-enable oxc/no-async-await */

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

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep it.each([["model-a"], ["model-a", "model-b"]])("retains exact selected tools through 's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): it.each([["model-a"], ["model-a", "model-b"]])("retains exact selected tools through  accepts ...modelIds; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): it.each([["model-a"], ["model-a", "model-b"]])("retains exact selected tools through  preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it.each([["model-a"], ["model-a", "model-b"]])(
  "retains exact selected tools through retry and rejected-project recovery: %j",
  (...modelIds) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("restores the selected capability from Eve serialized context before a resumed ste sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("restores the selected capability from Eve serialized context before a resumed step", async () => {
  const original = new ContextContainer();
  const saved = await contextStorage.run(original, async () => {
    await startTurn("createTextDocument");
    return serializeContext(original);
  });
  expect(saved["chatjs.turn-tool"]).toBe("createTextDocument");
  // oxlint-disable-next-line unicorn/prefer-structured-clone, typescript/no-unsafe-argument -- Exercise the JSON wire representation; structuredClone preserves values JSON drops. #594: This tool-selection fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const resumed = await deserializeContext(JSON.parse(JSON.stringify(saved)));
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable no-undefined, oxc/no-async-await --
 * no-undefined (#519): it("guest automatic and explicit turns retain only configured anonymous tools") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("guest automatic and explicit turns retain only configured anonymous tools") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("guest automatic and explicit turns retain only configured anonymous tools", async () => {
  await contextStorage.run(new ContextContainer(), async () => {
    const tools = {
      confirm_note: {},
      deepResearch: {},
      server__echo: {},
      webSearch: {},
    };
    await startTurn(undefined, "guest");
    expect(Object.keys(filterEveTools(tools))).toEqual(["webSearch"]);
    await startTurn("deepResearch", "guest");
    expect(filterEveTools(tools)).toEqual({});
    await startTurn();
    expect(filterEveTools(tools)).toEqual(tools);
  });
});
/* oxlint-enable no-undefined, oxc/no-async-await */

/* oxlint-disable max-statements --
 * max-statements (#512): it("withholds document operations when their implementations are not installed") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("withholds document operations when their implementations are not installed", () => {
  const original = new Set(mocks.kinds);
  const installed = mocks.kinds;
  try {
    installed.clear();
    expect(eveInstalledToolEnabled("readDocument")).toBe(false);
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
/* oxlint-enable max-statements */
