import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prepareScaffoldUi } from "./scaffold-ui";
import { uiImplementations } from "../../../registry/ui-implementations";

const root = path.resolve(import.meta.dir, "../../../..");
const core = uiImplementations.filter((entry) =>
  entry.source.startsWith("apps/chat/")
);
const createFixture = async (base: "base" | "radix"): Promise<string> => {
  const cwd = await mkdtemp(path.join(tmpdir(), "native-selection-"));
  await Promise.all(
    ["app", "hooks", "providers", "lib"].map(async (directory) => {
      await mkdir(path.join(cwd, directory));
    })
  );
  await writeFile(
    path.join(cwd, "components.json"),
    JSON.stringify({
      style: `${base}-nova`,
      registries: { "@chatjs": "https://chatjs.dev/r/{name}.json" },
    })
  );
  await Promise.all(
    core
      .flatMap((entry) => [entry.source, entry.radix])
      .map(async (file) => {
        const destination = path.join(cwd, file.slice("apps/chat/".length));
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(
          destination,
          await readFile(path.join(root, file), "utf-8")
        );
      })
  );
  return cwd;
};

test.each(["base", "radix"] as const)(
  "fresh %s scaffold selects native files and removes alternatives",
  async (base) => {
    const cwd = await createFixture(base);
    try {
      await prepareScaffoldUi(cwd);
      await Promise.all(
        core.map(async (entry) => {
          expect(await readFile(path.join(cwd, entry.target), "utf-8")).toBe(
            await readFile(
              path.join(root, base === "base" ? entry.source : entry.radix),
              "utf-8"
            )
          );
          expect(
            await Bun.file(
              path.join(cwd, entry.radix.slice("apps/chat/".length))
            ).exists()
          ).toBe(false);
        })
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
);

test.each(["base", "radix"] as const)(
  "missing %s implementation leaves scaffold sources and config untouched",
  async (missing) => {
    const cwd = await createFixture("radix");
    try {
      const [entry] = core;
      const missingPath =
        missing === "base"
          ? entry.target
          : entry.radix.slice("apps/chat/".length);
      await rm(path.join(cwd, missingPath));
      const source =
        'import { Button } from "@/components/ui/button"; export const View = () => <Button render={<a href="/" />} />;';
      await writeFile(path.join(cwd, "components/sentinel.tsx"), source);
      const config = await readFile(path.join(cwd, "components.json"), "utf-8");
      const error = await prepareScaffoldUi(cwd).catch(String);
      expect(error).toContain(
        `Missing native ${missing === "base" ? "Base" : "Radix"} implementation`
      );
      expect(
        await readFile(path.join(cwd, "components/sentinel.tsx"), "utf-8")
      ).toBe(source);
      expect(await readFile(path.join(cwd, "components.json"), "utf-8")).toBe(
        config
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
);
