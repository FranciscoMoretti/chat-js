import type { ModelMessage } from "ai";
import { expect, test } from "vitest";

import { eveImageContext } from "./image-context";

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, unicorn/no-null --
 * max-lines-per-function (#510): test("uses only the latest user attachments and generated images from this native bra keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("uses only the latest user attachments and generated images from this native bra uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("uses only the latest user attachments and generated images from this native bra uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): test("uses only the latest user attachments and generated images from this native bra preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("uses only the latest user attachments and generated images from this native branch", () => {
  const url = "/api/files/abcdefghijklmnopqrstuvwx.png";
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
    lastGeneratedImage: {
      imageUrl: url,
      name: "generated-image-image-1.png",
    },
  });
  expect(eveImageContext([messages[0]])).toMatchObject({
    lastGeneratedImage: null,
  });
  expect(
    eveImageContext([...messages, { content: "edit it", role: "user" }])
      .attachments
  ).toEqual([]);
});
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, unicorn/no-null */
