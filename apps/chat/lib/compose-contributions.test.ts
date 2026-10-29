import { expect, test } from "vitest";
import { composeContributions } from "./compose-contributions";

test("placement preserves custom overrides, hides entries and ignores absent plugin IDs", () => {
  expect(
    composeContributions(
      [
        { id: "projects", label: "Projects" },
        { id: "sharing", label: "Share" },
        { id: "feedback", label: "Feedback" },
      ],
      [
        { id: "projects", label: "My projects" },
        { id: "local", label: "Local" },
      ],
      {
        order: ["absent", "local", "projects", "projects"],
        hidden: ["sharing"],
      }
    )
  ).toEqual([
    { id: "local", label: "Local" },
    { id: "projects", label: "My projects" },
    { id: "feedback", label: "Feedback" },
  ]);
});
