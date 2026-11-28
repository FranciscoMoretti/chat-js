import { expect, it, spyOn } from "bun:test";
import * as clack from "@clack/prompts";
import * as registry from "#cli/registry/shadcn";
import { stdin } from "node:process";
import { createSelectionFromFlags, promptCreateMenu } from "./create-menu";
import { storageItems } from "../../../registry/src/storage/items";
import { registryResolution } from "#cli/registry/resolution-context";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";
import { ProviderRequirementError } from "#cli/utils/installation-requirements";

const project = { projectName: "review-app", targetDir: "/unused/review-app" };

it("routes a failed review to the existing File storage menu and validates again before confirmation", async () => {
  const select = spyOn(clack, "select")
    .mockResolvedValueOnce("review")
    .mockResolvedValueOnce("configure")
    .mockResolvedValueOnce("vercel-blob")
    .mockResolvedValueOnce("review")
    .mockResolvedValueOnce("create");
  let reviews = 0;
  try {
    const selection = await createSelectionFromFlags(project.targetDir, {
      attachments: true,
      storageProvider: "memory",
    });
    const blob = storageItems.find(
      (item) => item.name === "vercel-blob-storage"
    );
    if (!blob) {
      throw new Error("Test requires the Vercel Blob registry item.");
    }
    const result = await registryResolution.run(
      new Map([["@chatjs/vercel-blob-storage", blob]]),
      async () =>
        await promptCreateMenu(project, selection, [], async (draft) => {
          reviews += 1;
          if (draft.selection.storage?.source === "memory") {
            throw new ProviderRequirementError(
              "storage",
              "Attachment uploads need persistent storage."
            );
          }
          return await Promise.resolve(draft.selection.storage?.source);
        })
    );
    expect(select.mock.calls.map(([options]) => options.message)).toEqual([
      "Create review-app",
      "Complete setup before creating the app",
      "Where should the app store files?",
      "Create review-app",
      "Ready to create review-app?",
    ]);
    expect(result.setup).toBe("vercel-blob");
    expect(reviews).toBe(2);
  } finally {
    select.mockRestore();
  }
});

it("opens with the builder defaults and applies explicit plugin choices", async () => {
  expect(
    await createSelectionFromFlags(project.targetDir, {
      projects: false,
      mcp: true,
      electron: true,
    })
  ).toEqual({
    plugins: ["model-picker", "desktop", "mcp"],
    tools: [],
    gateway: "vercel",
    sandbox: "default",
    storage: { source: "vercel-blob", options: {} },
  });
});

it("selects one picker across registry addresses and can remove it in the menu", async () => {
  const initial = await createSelectionFromFlags(project.targetDir, {
    plugin: ["@chatjs/parallel-responses", "projects"],
  });
  expect(initial.plugins).toEqual(["@chatjs/parallel-responses", "projects"]);
  const list = spyOn(registry, "listRegistryItems").mockResolvedValue([]);
  const select = spyOn(clack, "select");
  for (const answer of [
    "plugins",
    "picker",
    "none",
    "back",
    "review",
    "create",
  ]) {
    select.mockResolvedValueOnce(answer);
  }
  try {
    const { setup } = await promptCreateMenu(
      project,
      initial,
      [],
      async ({ selection }) => await Promise.resolve(selection.plugins)
    );
    expect(setup).toEqual(["projects"]);
    expect(select.mock.calls[2]?.[0].initialValue).toBe("parallel");
    expect(
      createSelectionFromFlags(project.targetDir, {
        plugin: ["model-picker", "@chatjs/parallel-responses"],
      })
    ).rejects.toThrow("Choose one model picker");
  } finally {
    list.mockRestore();
    select.mockRestore();
  }
});

it("edits registry addresses consistently across plugin groups, platform choices and flags", async () => {
  const list = spyOn(registry, "listRegistryItems").mockResolvedValue([
    {
      name: "team-bundle",
      type: "registry:item",
      meta: { chatjs: { kind: "plugin", contractVersion: 3, id: "team" } },
    },
  ]);
  const select = spyOn(clack, "select");
  for (const answer of [
    "plugins",
    "Other plugins",
    "back",
    "setup",
    "platforms",
    "back",
    "review",
    "create",
  ]) {
    select.mockResolvedValueOnce(answer);
  }
  const multi = spyOn(clack, "multiselect")
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  try {
    const initial = await createSelectionFromFlags(project.targetDir, {
      plugin: ["team-bundle", "@chatjs/mcp", "@chatjs/desktop", "@acme/mcp"],
      mcp: false,
    });
    const { setup } = await promptCreateMenu(
      project,
      initial,
      [],
      async ({ selection }) => await Promise.resolve(selection)
    );
    expect(multi.mock.calls[0]?.[0].initialValues).toEqual([
      "@chatjs/team-bundle",
    ]);
    expect(multi.mock.calls[1]?.[0].initialValues).toEqual(["desktop"]);
    expect(setup.plugins).toEqual(["@acme/mcp", "model-picker"]);
  } finally {
    multi.mockRestore();
    select.mockRestore();
    list.mockRestore();
  }
});

it("passes an interactive appearance code to native shadcn and the recipe", async () => {
  const code = encodePreset(DEFAULT_PRESET_CONFIG);
  const select = spyOn(clack, "select")
    .mockResolvedValueOnce("appearance")
    .mockResolvedValueOnce("preset")
    .mockResolvedValueOnce("review")
    .mockResolvedValueOnce("create");
  const text = spyOn(clack, "text").mockResolvedValueOnce(code);
  try {
    const selection = await createSelectionFromFlags(project.targetDir, {});
    const result = await promptCreateMenu(
      project,
      selection,
      ["--base", "radix"],
      async () => await Promise.resolve("prepared")
    );
    expect(result.appearance).toEqual(["--base", "radix", "--preset", code]);
  } finally {
    text.mockRestore();
    select.mockRestore();
  }
});

it("returns from a preset code and registry address without changing the draft", async () => {
  const select = spyOn(clack, "select")
    .mockResolvedValueOnce("appearance")
    .mockResolvedValueOnce("preset")
    .mockResolvedValueOnce("back")
    .mockResolvedValueOnce("agent")
    .mockResolvedValueOnce("tool")
    .mockResolvedValueOnce("media")
    .mockResolvedValueOnce("video")
    .mockResolvedValueOnce("back")
    .mockResolvedValueOnce("back")
    .mockResolvedValueOnce("back")
    .mockResolvedValueOnce("review")
    .mockResolvedValueOnce("create");
  const text = spyOn(clack, "text").mockImplementation(async () => {
    stdin.emit("keypress", undefined, {
      name: "escape",
      sequence: "\u001B",
      meta: true,
    });
    return await Promise.resolve(clack.CANCEL_SYMBOL);
  });
  try {
    const selection = await createSelectionFromFlags(project.targetDir, {});
    const result = await promptCreateMenu(
      project,
      selection,
      [],
      async (draft) => await Promise.resolve(draft.selection.tools)
    );
    expect(text.mock.calls).toHaveLength(2);
    expect(text.mock.calls[0]?.[0].message).toContain(
      "Enter your shadcn preset code"
    );
    expect(text.mock.calls[1]?.[0].message).toContain(
      "Enter an external video generation tool registry address"
    );
    const menus = select.mock.calls.map(([options]) => options.message);
    expect(
      menus.filter((message) => message.startsWith("Which appearance preset"))
    ).toHaveLength(2);
    expect(
      menus.filter((message) => message.startsWith("Which media tool"))
    ).toHaveLength(2);
    expect(result.appearance).toEqual([]);
    expect(result.setup).toEqual([]);
  } finally {
    text.mockRestore();
    select.mockRestore();
  }
});

it("replays an interactive live EVE item and sign-in selection through the same flags", async () => {
  const { createCatalog } = await import("../../../registry/create-catalog");
  const { parseEveCatalog } = await import("../../../registry/eve-catalog");
  const { selectionCommand, parseCreateFlags } =
    await import("./selection-options");
  const id = "future-category/new-in-catalog";
  const load = spyOn(createCatalog.eveItem.choices, "load").mockResolvedValue(
    parseEveCatalog({ items: [{ name: id, title: "New service" }] })
  );
  const select = spyOn(clack, "select");
  for (const answer of [
    "agent",
    "other",
    "back",
    "setup",
    "auth",
    "back",
    "review",
    "create",
  ]) {
    select.mockResolvedValueOnce(answer);
  }
  const multi = spyOn(clack, "multiselect")
    .mockResolvedValueOnce([id])
    .mockResolvedValueOnce(["google"]);
  try {
    const initial = await createSelectionFromFlags(project.targetDir, {});
    const { setup } = await promptCreateMenu(
      project,
      initial,
      [],
      async ({ selection }) => await Promise.resolve(selection)
    );
    expect(multi.mock.calls[0]?.[0].options).toContainEqual({
      value: id,
      label: "New service",
      hint: "",
    });
    const command = selectionCommand("create").parse(
      ["--eve-item", id, "--auth", "google"],
      { from: "user" }
    );
    expect(
      await createSelectionFromFlags(
        project.targetDir,
        parseCreateFlags(command.opts())
      )
    ).toEqual(setup);
    expect(load).toHaveBeenCalledTimes(1);
  } finally {
    multi.mockRestore();
    select.mockRestore();
    load.mockRestore();
  }
});
