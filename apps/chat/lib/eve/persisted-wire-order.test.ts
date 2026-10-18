import { expect, it } from "vitest";
import { createConversationInput } from "./contracts";
import { createHash } from "node:crypto";
import { eveMcpResult } from "./mcp-result";
import { eveResponseGroupInput } from "./response-group-input";

// Reordering accepted command fields changes persisted admission hashes.
const creationWire =
  '{"operationId":"11111111-1111-4111-8111-111111111111","modelId":"test/model","message":[{"type":"text","text":"hello"},{"type":"file","data":"/api/files/abcdefghijklmnopqrstuvwx.png","mediaType":"image/png","filename":"image.png"}],"fork":{"conversationId":"22222222-2222-4222-8222-222222222222"}}';
const groupWire =
  '{"operationId":"11111111-1111-4111-8111-111111111111","modelIds":["test/one","test/two"],"message":"hello","fork":{"conversationId":"22222222-2222-4222-8222-222222222222"}}';

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

it("preserves persisted creation hashes including attachment order", () => {
  const parsed = createConversationInput.parse(JSON.parse(creationWire));
  const serialized = JSON.stringify(parsed);
  expect(digest(serialized)).toBe(digest(creationWire));
});

it("preserves persisted comparison hashes for current-conversation copies", () => {
  const parsed = eveResponseGroupInput.parse(JSON.parse(groupWire));
  const serialized = JSON.stringify(parsed);
  expect(digest(serialized)).toBe(digest(groupWire));
});

it("preserves serialized MCP result envelopes in durable transcripts", () => {
  const wire =
    '{"kind":"chatjs.mcp-result","output":{"ok":true},"modelOutput":{"type":"content","value":[{"type":"text","text":"hello"},{"type":"file","mediaType":"image/png","filename":"a.png","data":{"type":"data","data":"aGk="}}]}}';
  const parsed = eveMcpResult.parse(JSON.parse(wire));
  expect(JSON.stringify(parsed)).toBe(wire);
});
