import { describe, expect, it } from "vitest";

import { draftMessage } from "./draft";
import { prepareCreation, readCreation } from "./pending-create";

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep describe("multipart draft recovery")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): describe("multipart draft recovery") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
describe("multipart draft recovery", () => {
  it("retains file-only creation requests across reload and retry", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string): void => {
        values.delete(key);
      },
      setItem: (key: string, value: string): void => {
        values.set(key, value);
      },
    };
    const message = draftMessage("", [
      {
        contentType: "image/png",
        digest: "abc",
        name: "square.png",
        url: "/api/files/abcdefghijklmnopqrstuvwx.png",
      },
    ]);
    const original = prepareCreation(storage, "owner", message, "model");
    expect(readCreation(storage, "owner")).toEqual(original);
    expect(prepareCreation(storage, "owner", "edited", "other")).toEqual(
      original
    );
  });
});
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */
