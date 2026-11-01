import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { selectUiSources, uiImplementations } from "../ui-implementations";

const root = path.resolve(import.meta.dir, "../../..");
test.each(["base", "radix"] as const)(
  "native %s selection preserves destinations and uses authored source verbatim",
  async (base) => {
    const sources = new Map(
      await Promise.all(
        uiImplementations.map(
          async (entry) =>
            [
              entry.target,
              await readFile(path.join(root, entry.source), "utf-8"),
            ] as const
        )
      )
    );
    const output = await selectUiSources(
      sources,
      base,
      async (entry) => await readFile(path.join(root, entry.radix), "utf-8")
    );
    expect([...output.keys()]).toEqual([...sources.keys()]);
    await Promise.all(
      uiImplementations.map(async (entry) => {
        expect(output.get(entry.target)).toBe(
          await readFile(
            path.join(root, base === "base" ? entry.source : entry.radix),
            "utf-8"
          )
        );
        expect(output.get(entry.target)).not.toContain(".radix");
      })
    );
  }
);

test.each(["base", "radix"] as const)(
  "incomplete native pairs fail before %s output is available",
  async (base) => {
    const [entry] = uiImplementations;
    const missing = await selectUiSources(
      new Map([[entry.target, "source"]]),
      base,
      async () => await Promise.reject(new Error("ENOENT"))
    ).catch(String);
    expect(missing).toContain(
      `Missing native Radix implementation for ${entry.target}`
    );
    const empty = await selectUiSources(
      new Map([[entry.target, "source"]]),
      base,
      async () => await Promise.resolve("")
    ).catch(String);
    expect(empty).toContain("Empty native implementation");
  }
);

test.each(["base", "radix"] as const)(
  "shared source is never translated for %s",
  async (base) => {
    const source =
      'import { Controller } from "react-hook-form"; export const Form = () => <Controller render={field} />;';
    const output = await selectUiSources(
      new Map([["components/form.tsx", source]]),
      base,
      async () =>
        await Promise.reject(new Error("Shared source must not load a variant"))
    );
    expect(output.get("components/form.tsx")).toBe(source);
  }
);
