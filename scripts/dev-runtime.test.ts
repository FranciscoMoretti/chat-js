import { describe, expect, it } from "bun:test";
import { resolveDevRuntime } from "./dev-runtime";

describe("resolveDevRuntime", () => {
  it("assigns slot 6 to port 3060", () => {
    expect(resolveDevRuntime("6")).toEqual({
      origin: "http://localhost:3060",
      port: 3060,
      slot: 6,
    });
  });

  it("defaults to slot 0", () => {
    expect(resolveDevRuntime()).toEqual({
      origin: "http://localhost:3000",
      port: 3000,
      slot: 0,
    });
  });

  it.each(["", "abc", "-1", "1.5", "6254"])(
    "rejects invalid slot %p",
    (rawSlot) => {
      expect(() => resolveDevRuntime(rawSlot)).toThrow("CHATJS_DEV_SLOT");
    }
  );
});
