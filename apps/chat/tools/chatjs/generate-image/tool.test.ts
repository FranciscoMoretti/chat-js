import { describe, expect, it } from "vitest";
import { decodeBase64 } from "./tool";

describe("decodeBase64", () => {
  it("decodes bare base64", () => {
    expect(Array.from(decodeBase64("aGVsbG8="))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it("decodes base64 data URLs", () => {
    expect(Array.from(decodeBase64("data:image/png;base64,aGVsbG8="))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });
});
