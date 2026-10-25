import { expect, test, vi } from "vitest";
import { z } from "zod";
import type * as InstalledShared from "@/composition/generated/installed-shared";

vi.mock("@/composition/generated/installed-shared", async (importOriginal) => {
  const original = await importOriginal<typeof InstalledShared>();
  const metadata = {
    id: "metadata",
    creationFields: { label: z.string().min(1) },
    historyFields: {},
  };
  return {
    ...original,
    installedCreationFields: {
      ...original.installedCreationFields,
      ...metadata.creationFields,
    },
    installedSharedPlugins: [...original.installedSharedPlugins, metadata],
  };
});
const { prepareSelectedCreation, moveRejectedContextCreation } =
  await import("./pending-create");

const storageFixture = () => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
};

test.each([["model"], ["one", "two"]])(
  "plugin input survives creation and replay without owning a scope: %j",
  (...models) => {
    const storage = storageFixture();
    const first = prepareSelectedCreation(
      storage,
      "owner",
      "Hello",
      models,
      undefined,
      undefined,
      { label: "original" }
    );
    expect(first).toMatchObject({ label: "original" });
    expect(
      prepareSelectedCreation(
        storage,
        "owner",
        "Changed",
        models,
        undefined,
        undefined,
        { label: "changed" }
      )
    ).toEqual(first);
  }
);

test("leaving a rejected project retains unrelated plugin input and validates it", () => {
  const storage = storageFixture();
  const projectId = crypto.randomUUID();
  const context = { key: `project:${projectId}`, label: "project" };
  expect(() =>
    prepareSelectedCreation(
      storage,
      "owner",
      "Hello",
      ["model"],
      { context },
      undefined,
      { projectId, label: "" }
    )
  ).toThrow();
  const original = prepareSelectedCreation(
    storage,
    "owner",
    "Hello",
    ["model"],
    { context },
    undefined,
    { projectId, label: "research" }
  );
  const recovered = moveRejectedContextCreation(
    storage,
    "owner",
    context,
    original.operationId
  );
  expect(recovered).toMatchObject({
    label: "research",
    message: original.message,
  });
  expect(recovered).not.toHaveProperty("projectId");
  expect(recovered.operationId).not.toBe(original.operationId);
});
