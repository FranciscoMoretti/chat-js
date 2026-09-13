import { describe, expect, it } from "vitest";

import { draftMessage } from "./draft";
import { prepareCreation, readCreation } from "./pending-create";

describe("multipart draft recovery", () => {
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
