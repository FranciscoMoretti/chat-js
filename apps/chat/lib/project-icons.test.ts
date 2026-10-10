import {
  PROJECT_COLOR_NAMES,
  PROJECT_ICONS,
  getProjectColorName,
  getProjectIconName,
} from "./project-icons";

import { expect, test } from "vitest";

test("saved project values preserve every installed option and fall back for removed options", (): void => {
  for (const icon of PROJECT_ICONS) {
    expect(getProjectIconName(icon)).toBe(icon);
  }
  for (const color of PROJECT_COLOR_NAMES) {
    expect(getProjectColorName(color)).toBe(color);
  }
  expect(getProjectIconName("removed-icon")).toBe("folder");
  expect(getProjectColorName("removed-color")).toBe("gray");
});
