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
      url: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
      name: "square.png",
      contentType: "image/png",
      digest: await attachmentDigest(new Uint8Array([1, 2]).buffer),
    });
    const received = [
      { type: "text", text: "hello" },
      {
        type: "file",
        filename: file.name,
        mediaType: file.contentType,
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
      await matchesDraft([{ type: "text", text: "hello" }], "hello", [])
    ).toBe(true);
  });
  it("retains file-only creation requests across reload and retry", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const message = draftMessage("", [
      {
        url: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
        name: "square.png",
        contentType: "image/png",
        digest: "abc",
      },
    ]);
    const original = prepareCreation(storage, "owner", message, "model");
    expect(readCreation(storage, "owner")).toEqual(original);
    expect(prepareCreation(storage, "owner", "edited", "other")).toEqual(
      original
    );
  });
});
