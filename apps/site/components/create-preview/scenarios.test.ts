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
import { previewConversation, sceneMessages } from "./scenarios";
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
    [],
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

void test("duplicate replies keep separate continuations from an empty chat", () => {
  const first = {
    id: 0,
    text: "Compare",
    parentReplyId: null,
    modelIds: ["same", "same"],
    attachments: [],
  };
  const scene = {
    item: "preview",
    plugins: ["parallel-responses"],
    tools: new Set<string>(),
    submissions: [first],
  };
  const firstReply = previewConversation({ ...scene, selections: {} }).replyId;
  const secondSelected = { "preview-user-0": 1 };
  const secondReply = previewConversation({
    ...scene,
    selections: secondSelected,
  }).replyId;
  assert.notEqual(firstReply, secondReply);
  const submissions = [
    first,
    {
      ...first,
      id: 1,
      text: "Follow second",
      parentReplyId: secondReply,
      modelIds: ["same"],
    },
    {
      ...first,
      id: 2,
      text: "Follow first",
      parentReplyId: firstReply,
      modelIds: ["same"],
    },
  ];
  for (const [selections, id] of [
    [{}, 2],
    [secondSelected, 1],
  ] as const) {
    const { messages } = previewConversation({
      ...scene,
      selections,
      submissions,
    });
    assert.deepEqual(
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.id),
      ["preview-user-0", `preview-user-${id}`]
    );
  }
});
