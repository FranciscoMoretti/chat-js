/* oxlint-disable sort-imports -- Preserve runtime import evaluation order and pinned Oxfmt type/binding grouping; native alphabetical ordering conflicts with that grouping. */
import { expect, test } from "vitest";

import {
  getProjectColorName,
  getProjectIconName,
  PROJECT_COLOR_NAMES,
  PROJECT_ICONS,
} from "./project-icons";
/* oxlint-enable sort-imports */

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
