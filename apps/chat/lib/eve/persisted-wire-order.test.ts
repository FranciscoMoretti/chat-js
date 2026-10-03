/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { createConversationInput } from "./contracts";
import { eveMcpResult } from "./mcp-result";
import { eveResponseGroupInput } from "./response-group-input";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

// These wire bytes predate the Oxfmt/Oxlint migration. Reordering a schema
// changes a persisted admission hash and rejects a valid retry after restart.
const creationWire =
  '{"operationId":"11111111-1111-4111-8111-111111111111","modelId":"test/model","message":[{"type":"text","text":"hello"},{"type":"file","data":"/api/files/abcdefghijklmnopqrstuvwx.png","mediaType":"image/png","filename":"image.png"}],"fork":{"conversationId":"22222222-2222-4222-8222-222222222222","checkpointId":"33333333-3333-4333-8333-333333333333","beforeTurnId":"turn_1"}}';
const groupWire =
  '{"operationId":"11111111-1111-4111-8111-111111111111","modelIds":["test/one","test/two"],"message":"hello","fork":{"conversationId":"22222222-2222-4222-8222-222222222222","beforeMessageId":"seed_message_1"}}';

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): it("preserves persisted creation hashes including attachment and checkpoint order") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("preserves persisted creation hashes including attachment and checkpoint order", () => {
  expect(
    digest(
      JSON.stringify(createConversationInput.parse(JSON.parse(creationWire)))
    )
  ).toBe(digest(creationWire));
});
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): it("preserves persisted comparison hashes including imported-message boundaries") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("preserves persisted comparison hashes including imported-message boundaries", () => {
  expect(
    digest(JSON.stringify(eveResponseGroupInput.parse(JSON.parse(groupWire))))
  ).toBe(digest(groupWire));
});
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): it("preserves serialized MCP result envelopes in durable transcripts") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
it("preserves serialized MCP result envelopes in durable transcripts", () => {
  const wire =
    '{"kind":"chatjs.mcp-result","output":{"ok":true},"modelOutput":{"type":"content","value":[{"type":"text","text":"hello"},{"type":"file","mediaType":"image/png","filename":"a.png","data":{"type":"data","data":"aGk="}}]}}';
  expect(JSON.stringify(eveMcpResult.parse(JSON.parse(wire)))).toBe(wire);
});
/* oxlint-enable unicorn/max-nested-calls */
