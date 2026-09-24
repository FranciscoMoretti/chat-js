import type { ModelMessage } from "ai";
import { expect, test } from "vitest";

import { eveImageContext } from "./image-context";

const url = "/api/files/content?key=abcdefghijklmnopqrstuvwx.png";
test("uses only the latest user attachments and generated images from this native branch", () => {
  const messages: ModelMessage[] = [
    {
      content: [
        {
          data: "data:image/png;base64,b2xk",
          mediaType: "image/png",
          type: "file",
        },
      ],
      role: "user",
    },
    {
      content: [
        {
          output: { type: "json", value: { imageUrl: url, prompt: "tree" } },
          toolCallId: "image-1",
          toolName: "generateImage",
          type: "tool-result",
        },
      ],
      role: "tool",
    },
    {
      content: [
        {
          data: "data:image/png;base64,bmV3",
          mediaType: "image/png",
          type: "file",
        },
        {
          data: "data:application/pdf;base64,cGRm",
          mediaType: "application/pdf",
          type: "file",
        },
      ],
      role: "user",
    },
  ];
  expect(eveImageContext(messages)).toEqual({
    attachments: [
      {
        filename: undefined,
        mediaType: "image/png",
        type: "file",
        url: "data:image/png;base64,bmV3",
      },
    ],
    lastGeneratedImage: { imageUrl: url, name: "generated-image-image-1.png" },
  });
  expect(eveImageContext([messages[0]])).toMatchObject({
    lastGeneratedImage: null,
  });
  expect(
    eveImageContext([...messages, { content: "edit it", role: "user" }])
      .attachments
  ).toEqual([]);
});
