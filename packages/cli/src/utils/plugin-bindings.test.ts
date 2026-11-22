import { expect, test } from "bun:test";
import { pluginBindings } from "./plugin-bindings";

test("keeps readable names stable when an unrelated plugin is added", () => {
  const entries = [
    { id: "credits", preferred: "creditsClient" },
    { id: "projects", preferred: "projectsClient" },
  ];
  const reserved = ["installedChatPlugins"];
  expect(pluginBindings(entries, reserved).map(({ name }) => name)).toEqual([
    "creditsClient",
    "projectsClient",
  ]);
  expect(
    pluginBindings(
      [{ id: "alpha", preferred: "alphaClient" }, ...entries],
      reserved
    ).map(({ name }) => name)
  ).toEqual(["alphaClient", "creditsClient", "projectsClient"]);
});

test("aliases shared exports, generated names, and keywords safely", () => {
  expect(
    pluginBindings(
      [
        { id: "notes-a", preferred: "client" },
        { id: "notes-b", preferred: "client" },
        { id: "notes-c", preferred: "client_notes_a" },
        { id: "layout", preferred: "installedChatPlugins" },
        { id: "projects", preferred: "default" },
      ],
      ["installedChatPlugins"]
    ).map(({ name }) => name)
  ).toEqual([
    "client_notes_a_",
    "client_notes_b",
    "client_notes_a",
    "installedChatPlugins_layout",
    "default_projects",
  ]);
});
