const minimalGateway = "^vercel: the manifest-derived empty installation";
const allGateways = "the manifest-derived empty installation";
const fullPreset = "^full feature preset:";
const commitSha = /^[a-f0-9]{40}$/u;
const pluginPath = /^packages\/registry\/src\/plugins\/(?<id>[a-z0-9-]+)\//u;
const gatewayPath =
  /^(?:packages\/registry\/src\/gateways\/|apps\/chat\/chatjs\/core\/gateway\/|apps\/chat\/lib\/ai\/.*gateway)/u;
const toolCases: Readonly<Record<string, string>> = {
  "attach-workspace-file": "^attach-workspace-file installs",
  "deep-research": "^deep-research installs",
  "generate-image": "^image generation installs",
  "generate-video": "^video generation installs",
};

export const scaffoldValidationPattern = (
  paths: readonly string[] | undefined
): string | null => {
  if (
    paths !== undefined &&
    paths.length > 0 &&
    paths.every((path) => path === "README.md")
  ) {
    return null;
  }

  const checkAllGateways =
    paths === undefined ||
    paths.length === 0 ||
    paths.some(
      (path) =>
        gatewayPath.test(path) ||
        path === "bun.lock" ||
        path.endsWith("package.json")
    );
  const cases = new Set([
    checkAllGateways ? allGateways : minimalGateway,
    fullPreset,
  ]);
  for (const path of paths ?? []) {
    const plugin = pluginPath.exec(path)?.groups?.id;
    if (plugin !== undefined) {
      cases.add(`^${plugin}: catalog-derived plugin selection`);
    }
    for (const [tool, pattern] of Object.entries(toolCases)) {
      if (path.startsWith(`packages/registry/src/tools/${tool}/`)) {
        cases.add(pattern);
      }
    }
  }
  return [...cases].join("|");
};

const readChangedPaths = (
  base: string | undefined,
  head: string | undefined
): string[] | undefined => {
  if (
    base === undefined ||
    head === undefined ||
    !commitSha.test(base) ||
    !commitSha.test(head)
  ) {
    return undefined;
  }
  const diff = Bun.spawnSync([
    "git",
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    `${base}...${head}`,
    "--",
  ]);
  return diff.success
    ? diff.stdout.toString().split("\0").filter(Boolean)
    : undefined;
};

if (import.meta.main) {
  const paths = readChangedPaths(process.env.PR_BASE, process.env.PR_HEAD);
  const pattern = scaffoldValidationPattern(paths);
  console.log(`run=${pattern !== null}`);
  console.log(`cases=${pattern ?? ""}`);
  if (pattern === null) {
    console.error("Skipping scaffold validation for a root README-only diff.");
  }
}
