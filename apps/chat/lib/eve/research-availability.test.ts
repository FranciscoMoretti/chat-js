/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context" dependency within this package instead of introducing an alias or barrel API.
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
import { generateText, tool, wrapLanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

import { researchAvailable } from "@/tools/chatjs/deep-research/availability";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { installedToolAvailabilityMiddleware } from "./tool-availability";
import { eveTurnGuest, eveTurnTool } from "./turn-tools";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const mocks = vi.hoisted(() => {
  const tools: { webSearch?: object } = { webSearch: {} };
  return {
    research: true,
    text: true,
    tools,
  };
});
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: { AVAILABLE_TOOLS: ["webSearch"] },
}));
/* oxlint-disable no-magic-numbers, no-ternary, typescript/explicit-function-return-type --
 * no-magic-numbers (#517): vi.mock("@/tools/chatjs/installed-features") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): vi.mock("@/tools/chatjs/installed-features") derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/tools/chatjs/installed-features")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: {
    has: (kind: string): boolean => kind === "text" && mocks.text,
    get size() {
      return mocks.text ? 1 : 0;
    },
  },
  installedToolNames: { has: (): boolean => mocks.research },
}));
/* oxlint-enable no-magic-numbers, no-ternary, typescript/explicit-function-return-type */
vi.mock("../../tools/chatjs/providers", () => ({ providers: mocks.tools }));
beforeEach(() => {
  mocks.tools.webSearch = {};
  mocks.research = true;
  mocks.text = true;
});
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null --
 * max-lines-per-function (#510): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-ternary (#518): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text handles optional provider.doGenerateCalls[0].tools?.map((entry) => entry.name) without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text copies or separates ...(scenario === "guest" ? { chatjsGuest: "true" } : {}); ...(scenario === "selected" ? { selectedTool: "deepResearch" } : {}); ...(scenario === "other-tool" ? { selectedTool: "webSearch" } : {}); ...session while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text accepts entry; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): it.each([ "automatic", "selected", "other-tool", "disabled", "no-documents", "no-text preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
])("offers research only when available: %s", (scenario) =>
  contextStorage.run(new ContextContainer(), async () => {
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
    eveTurnGuest.update(() => scenario === "guest");
    const principal = {
      attributes: {
        ...(scenario === "guest" ? { chatjsGuest: "true" } : {}),
        ...(scenario === "selected" ? { selectedTool: "deepResearch" } : {}),
        ...(scenario === "other-tool" ? { selectedTool: "webSearch" } : {}),
      },
      authenticator: "test",
      principalId: "owner",
      principalType: "user",
    };
    const { session } = testToolContext();
    const provider = new MockLanguageModelV3({
      doGenerate: () => Promise.reject(new Error("provider reached")),
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
    const names = provider.doGenerateCalls[0].tools?.map((entry) => entry.name);
    expect(names).toEqual(
      ["automatic", "selected"].includes(scenario)
        ? ["deepResearch", "webSearch"]
        : ["webSearch"]
    );
  })
);
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("preserves the turn restriction when approval/reconnect auth omits selectedTool") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
            authenticator: "test",
            principalId: "owner",
            principalType: "user",
          },
          initiator: {
            attributes: {},
            authenticator: "test",
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
/* oxlint-enable oxc/no-async-await */
