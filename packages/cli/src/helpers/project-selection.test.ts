import { afterEach, expect, it, mock, spyOn } from "bun:test";
import * as clack from "@clack/prompts";
import * as registry from "#cli/registry/shadcn";
import * as providerConfig from "#cli/utils/provider-config";
import * as storage from "./storage-provider";
import * as installed from "#cli/utils/installed-plugins";
import {
  parseAddFlags,
  parseCreateFlags,
  selectionCommand,
} from "./selection-options";
import { promptAddSelection, promptRemoveSelection } from "./project-selection";

afterEach(() => {
  mock.restore();
});

it("parses shared provider flags identically and leaves an existing app's providers alone by default", () => {
  const args = [
    "--storage-provider",
    " s3 ",
    "--storage-config",
    '{"bucket":"uploads"}',
  ];
  const parse = (name: "create" | "add") =>
    selectionCommand(name).parse(args, { from: "user" }).opts();
  expect(parseAddFlags(parse("add"))).toEqual(
    parseCreateFlags(parse("create"))
  );
  expect(parseAddFlags({})).toEqual({});
  expect(() => parseAddFlags({ storageConfig: "[]" })).toThrow(
    "--storage-config"
  );
  expect(
    selectionCommand("add").options.some((option) => option.long === "--auth")
  ).toBe(false);
});

it("uses the registry item address even when its name differs from its plugin ID", async () => {
  spyOn(registry, "listRegistryItems").mockResolvedValue([
    {
      name: "team-bundle",
      title: "Team plugin",
      type: "registry:item",
      meta: { chatjs: { kind: "plugin", contractVersion: 3, id: "team" } },
    },
  ]);
  spyOn(clack, "select").mockResolvedValueOnce("plugin");
  const multi = spyOn(clack, "multiselect").mockResolvedValueOnce([
    "@chatjs/team-bundle",
  ]);
  expect(await promptAddSelection("/unused", false)).toEqual({
    items: [],
    flags: { plugin: ["@chatjs/team-bundle"] },
  });
  expect(multi.mock.calls[0]?.[0].options).toMatchObject([
    { value: "@chatjs/team-bundle", label: "Team plugin" },
  ]);
});

it("round-trips structured settings when editing a catalog storage provider", async () => {
  const address = "@chatjs/team-store";
  const current = { connection: { pool: 3 }, flags: ["one"], label: "true" };
  const next = { ...current, connection: { pool: 4 } };
  spyOn(registry, "listRegistryItems").mockResolvedValue([
    {
      name: "team-store",
      type: "registry:item",
      meta: {
        chatjs: {
          kind: "storage",
          contractVersion: 1,
          id: "team",
          configKeys: Object.keys(current),
        },
      },
    },
  ]);
  spyOn(providerConfig, "readProviderId").mockResolvedValue("team");
  spyOn(storage, "readInstalledStorageOptions").mockResolvedValue(current);
  spyOn(clack, "select")
    .mockResolvedValueOnce("storageProvider")
    .mockResolvedValueOnce(address)
    .mockResolvedValueOnce("edit");
  const text = spyOn(clack, "text").mockResolvedValueOnce(JSON.stringify(next));
  expect(await promptAddSelection("/unused", false)).toEqual({
    items: [],
    flags: { storageProvider: address, storageConfig: next },
  });
  expect(text.mock.calls[0]?.[0].initialValue).toBe(JSON.stringify(current));
});

it("offers only locally installed plugin IDs for removal, including third-party plugins", async () => {
  const plugins = ["projects", "team"].map((id) => ({
    id,
    files: [],
    kind: "plugin" as const,
    contractVersion: 3 as const,
  }));
  spyOn(installed, "readInstalledPlugins").mockResolvedValue(plugins);
  const multi = spyOn(clack, "multiselect").mockResolvedValueOnce(["team"]);
  expect(await promptRemoveSelection("/unused")).toEqual(["team"]);
  expect(multi.mock.calls[0]?.[0].options.map(({ value }) => value)).toEqual([
    "projects",
    "team",
  ]);
});

it("accepts repeated plugin flags on create, add, and remove", () => {
  for (const command of ["create", "add", "remove"] as const) {
    const flags = selectionCommand(command)
      .parse(["--plugin", "projects", "--plugin", "sharing"], { from: "user" })
      .opts();
    expect(flags.plugin).toEqual(["projects", "sharing"]);
  }
});
