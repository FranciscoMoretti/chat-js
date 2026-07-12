import { describe, expect, it, vi } from "vitest";
import { withAbortSignal } from "./tool";

describe("withAbortSignal", () => {
  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const operation = vi.fn(() => Promise.resolve("unused"));

    await expect(withAbortSignal(operation, controller.signal)).rejects.toThrow(
      "cancelled"
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects when an in-flight operation is aborted", async () => {
    const controller = new AbortController();
    const operation = vi.fn(() => new Promise<never>(() => undefined));
    const result = withAbortSignal(operation, controller.signal);

    await Promise.resolve();
    expect(operation).toHaveBeenCalledOnce();

    controller.abort(new Error("cancelled in flight"));

    await expect(result).rejects.toThrow("cancelled in flight");
  });

  it("rejects stalled operations at the local deadline", async () => {
    await expect(
      withAbortSignal(() => new Promise(() => undefined), undefined, 1)
    ).rejects.toThrow("timed out after 1ms");
  });
});
