import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

const appRoot = path.resolve(import.meta.dirname, "../../../apps/chat");
const appDir = path.join(appRoot, "app");
const ROUTE_FILE =
  /^(?:page|layout|loading|error|not-found|global-error)\.tsx$/u;

// Route files that render nothing of their own, so there is nothing to capture.
const NOT_RENDERED = new Set([
  // The <html> shell; renderRoute mounts its body providers around every page.
  "layout.tsx",
  // Redirects to /chat/[id].
  "(chat)/project/[projectId]/chat/[chatId]/page.tsx",
]);

// A route file counts once the test renders the component it imports from it, not when it only imports it.
const renderedRouteFiles = (file: string) => {
  const source = readFileSync(file, "utf-8");
  return Array.from(
    source.matchAll(/^import (?<name>\w+) from "@\/app\/(?<route>[^"]+)";$/gmu),
    (match) => match.groups
  ).flatMap((groups) =>
    groups !== undefined &&
    new RegExp(String.raw`<${groups.name}[\s/>]`, "u").test(source)
      ? [`${groups.route}.tsx`]
      : []
  );
};

test("every route file is rendered by a visual test", () => {
  const visualTests = readdirSync(import.meta.dirname)
    .filter((file) => file.endsWith(".browser.tsx"))
    .map((file) => path.join(import.meta.dirname, file));
  const rendered = new Set(visualTests.flatMap(renderedRouteFiles));

  const untested = readdirSync(appDir, { encoding: "utf-8", recursive: true })
    .map((route) => route.split(path.sep).join("/"))
    .filter((route) => ROUTE_FILE.test(path.basename(route)))
    // Fixture pages for the Playwright screenshot tests, served only under PLAYWRIGHT.
    .filter((route) => !route.startsWith("(chat)/visual-fixtures/"))
    .filter((route) => !(NOT_RENDERED.has(route) || rendered.has(route)))
    .toSorted();

  expect(untested).toEqual([]);
});
