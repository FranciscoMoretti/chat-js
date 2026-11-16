import assert from "node:assert/strict";
import { test } from "node:test";
import {
  researchInput,
  researchOutput,
} from "../../../chat/chatjs/tools/deep-research/schemas";
import {
  generateImageInput,
  generateImageResult,
} from "../../../chat/chatjs/tools/generate-image/schemas";
import {
  generateVideoInput,
  generateVideoResult,
} from "../../../chat/chatjs/tools/generate-video/schemas";
import {
  attachWorkspaceFileInput,
  attachWorkspaceFileResult,
} from "../../../chat/chatjs/tools/attach-workspace-file/schemas";
import { sceneMessages } from "./scenarios";
import { toolExamples } from "./tool-examples";

for (const [name, input, output] of [
  ["generateImage", generateImageInput, generateImageResult],
  ["generateVideo", generateVideoInput, generateVideoResult],
  [
    "attach_workspace_file",
    attachWorkspaceFileInput,
    attachWorkspaceFileResult,
  ],
  ["deepResearch", researchInput, researchOutput],
] as const) {
  void test(`${name} example satisfies the production renderer contract`, () => {
    const example = toolExamples[name];
    assert.ok(example);
    assert.ok(input.safeParse(example.input).success);
    assert.ok(output.safeParse(example.output).success);
  });
}

void test("selected media tools preview successful results", () => {
  const parts = sceneMessages(
    "preview-tools",
    false,
    new Set(["generateImage", "generateVideo"])
  )
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "tool");
  assert.equal(parts.length, 2);
  assert.deepEqual(
    parts.map((part) => part.state),
    ["completed", "completed"]
  );
});
