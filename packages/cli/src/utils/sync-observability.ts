import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { observabilityItems } from "../../../registry/src/plugins/observability";
import { isJsonObject } from "../helpers/json-object";

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};
const isObservabilityManifest = (
  value: unknown
): value is { dependencies?: Record<string, unknown> | null } =>
  isJsonObject(value) &&
  (!Object.hasOwn(value, "dependencies") ||
    value.dependencies === null ||
    isJsonObject(value.dependencies));
const formattedManifest = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
// Creation only: reset demo selections. Sync/add never remove implementations.
const initializeObservability = async (cwd: string): Promise<void> => {
  await Promise.all(
    observabilityItems.map(
      async (item: Readonly<{ name: string }>): Promise<void> => {
        await rm(path.join(cwd, "chatjs/plugins", item.name), {
          force: true,
          recursive: true,
        });
      }
    )
  );
  const manifestPath = path.join(cwd, "package.json");
  if (!(await exists(manifestPath))) {
    return;
  }
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf-8"));
  if (!isObservabilityManifest(manifest)) {
    throw new TypeError(
      "Observability initialization needs a package JSON object with an optional dependency object."
    );
  }
  for (const dependency of [
    "@vercel/analytics",
    "@vercel/speed-insights",
    "@vercel/otel",
    "langfuse-vercel",
    "langfuse",
  ]) {
    Reflect.deleteProperty(manifest.dependencies ?? {}, dependency);
  }
  await writeFile(manifestPath, formattedManifest(manifest));
};
export { initializeObservability };
