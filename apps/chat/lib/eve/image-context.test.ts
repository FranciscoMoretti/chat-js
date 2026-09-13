import type { ModelMessage } from "ai";
import { expect, test } from "vitest";

import { eveImageContext } from "./image-context";

const url = "/api/files/content?key=abcdefghijklmnopqrstuvwx.png";
test("uses only the latest user attachments and generated images from this native branch", () => {
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "file",
          mediaType: "image/png",
          data: "data:image/png;base64,b2xk",
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "image-1",
          toolName: "generateImage",
          output: { type: "json", value: { imageUrl: url, prompt: "tree" } },
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "file",
          mediaType: "image/png",
          data: "data:image/png;base64,bmV3",
        },
        {
          type: "file",
          mediaType: "application/pdf",
          data: "data:application/pdf;base64,cGRm",
        },
      ],
    },
  ];
  expect(eveImageContext(messages)).toEqual({
    attachments: [
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,bmV3",
        filename: undefined,
      },
    ],
    lastGeneratedImage: { imageUrl: url, name: "generated-image-image-1.png" },
  });
  expect(eveImageContext([messages[0]])).toMatchObject({
    lastGeneratedImage: null,
  });
  expect(
    eveImageContext([...messages, { role: "user", content: "edit it" }])
      .attachments
  ).toEqual([]);
});
