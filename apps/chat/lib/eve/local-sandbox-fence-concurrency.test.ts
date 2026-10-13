import { beforeEach, expect, test, vi } from "vitest";
import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";

const filesystem = vi.hoisted(() => ({
  mkdir: vi.fn<() => Promise<void>>(),
  readdir: vi.fn<() => Promise<string[]>>(),
  writeFile: vi.fn<() => Promise<void>>(),
}));

vi.mock("node:fs/promises", () => filesystem);

beforeEach(() => {
  vi.resetAllMocks();
  filesystem.mkdir.mockResolvedValue();
  filesystem.writeFile.mockResolvedValue();
  filesystem.readdir.mockResolvedValue([]);
});

test("waits for every marker before inspecting leases and deduplicates sessions", async () => {
  const slowMarker: PromiseWithResolvers<void> = Promise.withResolvers();
  filesystem.writeFile.mockReturnValueOnce(slowMarker.promise);

  const fence = fenceLocalEveSandboxMutations("/worker", [
    "first",
    "second",
    "first",
  ]);
  await vi.waitFor(() => {
    expect(filesystem.writeFile).toHaveBeenCalledTimes(2);
  });
  expect(filesystem.readdir).not.toHaveBeenCalled();
  slowMarker.resolve();
  await fence;
  expect(filesystem.mkdir).toHaveBeenCalledTimes(2);
  expect(filesystem.readdir).toHaveBeenCalledTimes(2);
});

test("each marker waits for its own directory without blocking sibling scopes", async () => {
  const directory: PromiseWithResolvers<void> = Promise.withResolvers();
  filesystem.mkdir.mockReturnValueOnce(directory.promise);
  const fence = fenceLocalEveSandboxMutations("/worker", ["first", "second"]);
  await vi.waitFor(() => {
    expect(filesystem.mkdir).toHaveBeenCalledTimes(2);
    expect(filesystem.writeFile).toHaveBeenCalledOnce();
  });
  expect(filesystem.readdir).not.toHaveBeenCalled();
  directory.resolve();
  await fence;
  expect(filesystem.writeFile).toHaveBeenCalledTimes(2);
});

test("bounds marker writes and lease reads to four and drains each batch", async () => {
  const markerGates = Array.from({ length: 4 }, () => {
    const gate: PromiseWithResolvers<void> = Promise.withResolvers();
    return gate;
  });
  const inspectionGates = Array.from({ length: 4 }, () =>
    Promise.withResolvers<string[]>()
  );
  let activeMarkers = 0;
  let activeInspections = 0;
  let maximumMarkers = 0;
  let maximumInspections = 0;
  filesystem.writeFile.mockImplementation(async () => {
    const index = filesystem.writeFile.mock.calls.length - 1;
    activeMarkers += 1;
    maximumMarkers = Math.max(maximumMarkers, activeMarkers);
    await markerGates.at(index)?.promise;
    activeMarkers -= 1;
  });
  filesystem.readdir.mockImplementation(async () => {
    const index = filesystem.readdir.mock.calls.length - 1;
    activeInspections += 1;
    maximumInspections = Math.max(maximumInspections, activeInspections);
    await inspectionGates.at(index)?.promise;
    activeInspections -= 1;
    return [];
  });
  const fence = fenceLocalEveSandboxMutations("/worker", [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
  ]);
  await vi.waitFor(() => {
    expect(activeMarkers).toBe(4);
  });
  for (const gate of markerGates.slice(0, 3)) {
    gate.resolve();
  }
  await vi.waitFor(() => {
    expect(activeMarkers).toBe(1);
  });
  expect(filesystem.writeFile).toHaveBeenCalledTimes(4);
  expect(filesystem.readdir).not.toHaveBeenCalled();
  markerGates.at(3)?.resolve();
  await vi.waitFor(() => {
    expect(activeInspections).toBe(4);
  });
  expect(filesystem.writeFile).toHaveBeenCalledTimes(6);
  for (const gate of inspectionGates.slice(0, 3)) {
    gate.resolve([]);
  }
  await vi.waitFor(() => {
    expect(activeInspections).toBe(1);
  });
  expect(filesystem.readdir).toHaveBeenCalledTimes(4);
  inspectionGates.at(3)?.resolve([]);
  await fence;
  expect(filesystem.readdir).toHaveBeenCalledTimes(6);
  expect(maximumMarkers).toBe(4);
  expect(maximumInspections).toBe(4);
  expect(activeMarkers + activeInspections).toBe(0);
});

test("drains failed marker attempts and reports the first family failure", async () => {
  const firstMarker: PromiseWithResolvers<void> = Promise.withResolvers();
  const firstError = new Error("first marker failed");
  filesystem.writeFile
    .mockReturnValueOnce(firstMarker.promise)
    .mockRejectedValueOnce(new Error("second marker failed"));
  let settled = false;
  const fence = fenceLocalEveSandboxMutations("/worker", [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
  ]);
  const rejection = expect(fence).rejects.toBe(firstError);
  const observed = fence.catch(() => {
    settled = true;
  });
  await vi.waitFor(() => {
    expect(filesystem.writeFile).toHaveBeenCalledTimes(4);
  });
  expect(settled).toBe(false);
  expect(filesystem.readdir).not.toHaveBeenCalled();
  firstMarker.reject(firstError);
  await rejection;
  await observed;
  expect(filesystem.mkdir).toHaveBeenCalledTimes(4);
  expect(filesystem.writeFile).toHaveBeenCalledTimes(4);
  expect(filesystem.readdir).not.toHaveBeenCalled();
});

test("drains lease inspections and selects failures in family order", async () => {
  const firstInspection = Promise.withResolvers<string[]>();
  filesystem.readdir
    .mockReturnValueOnce(firstInspection.promise)
    .mockRejectedValueOnce(new Error("second read failed"));
  let settled = false;
  const fence = fenceLocalEveSandboxMutations("/worker", [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
  ]);
  const rejection = expect(fence).rejects.toThrow("still pending");
  const observed = fence.catch(() => {
    settled = true;
  });
  await vi.waitFor(() => {
    expect(filesystem.readdir).toHaveBeenCalledTimes(4);
  });
  expect(settled).toBe(false);
  firstInspection.resolve(["operation.json"]);
  await rejection;
  await observed;
  expect(filesystem.readdir).toHaveBeenCalledTimes(4);
});
