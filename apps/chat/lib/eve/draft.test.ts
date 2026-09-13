import { describe, expect, it } from "vitest";

import {
  attachmentDigest,
  draftAttachment,
  draftMessage,
  matchesDraft,
} from "./draft";
import { prepareCreation, readCreation } from "./pending-create";

describe("multipart draft recovery", () => {
  it("matches accepted bytes and rejects an attachment with the same name but different contents", async () => {
    const file = draftAttachment.parse({
      contentType: "image/png",
      digest: await attachmentDigest(new Uint8Array([1, 2]).buffer),
      name: "square.png",
      url: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
    });
    const received = [
      { text: "hello", type: "text" },
      {
        filename: file.name,
        mediaType: file.contentType,
        type: "file",
        url: "data:image/png;base64,AQI=",
      },
    ];
    expect(await matchesDraft(received, "hello", [file])).toBe(true);
    expect(
      await matchesDraft(received, "hello", [
        { ...file, digest: await attachmentDigest(new Uint8Array([3]).buffer) },
      ])
    ).toBe(false);
    expect(await matchesDraft(received, "other", [file])).toBe(false);
    expect(await matchesDraft("hello", "hello", [])).toBe(true);
    expect(
      await matchesDraft([{ text: "hello", type: "text" }], "hello", [])
    ).toBe(true);
  });
  it("retains file-only creation requests across reload and retry", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const message = draftMessage("", [
      {
        contentType: "image/png",
        digest: "abc",
        name: "square.png",
        url: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
      },
    ]);
    const original = prepareCreation(storage, "owner", message, "model");
    expect(readCreation(storage, "owner")).toEqual(original);
    expect(prepareCreation(storage, "owner", "edited", "other")).toEqual(
      original
    );
  });
});
