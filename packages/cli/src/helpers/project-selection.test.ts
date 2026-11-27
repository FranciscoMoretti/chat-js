import { afterEach, expect, it, mock, spyOn } from "bun:test";
import * as clack from "@clack/prompts";
import * as registry from "#cli/registry/shadcn";
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
    items: ["@chatjs/team-bundle"],
  });
  expect(multi.mock.calls[0]?.[0].options).toMatchObject([
    { value: "@chatjs/team-bundle", label: "Team plugin" },
  ]);
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
