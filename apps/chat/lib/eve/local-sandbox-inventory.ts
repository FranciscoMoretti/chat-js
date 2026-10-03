/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { readdir, readFile } from "node:fs/promises";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";

import { z } from "zod";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): localEveSandboxOwnerSchema stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named localEveSandboxOwnerSchema API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): localEveSandboxOwnerSchema uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const localEveSandboxOwnerSchema = z.strictObject({
  backendName: z.literal("microsandbox"),
  sessionId: z.string().min(1),
  sessionKey: z.string().min(1),
  version: z.literal(1),
  writeAheadResources: z.literal(true).optional(),
});
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable id-length, import/group-exports, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): readLocalEveSandboxInventory uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): readLocalEveSandboxInventory stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readLocalEveSandboxInventory API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * init-declarations (#507): readLocalEveSandboxInventory assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): readLocalEveSandboxInventory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readLocalEveSandboxInventory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): readLocalEveSandboxInventory keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): readLocalEveSandboxInventory keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): readLocalEveSandboxInventory skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): readLocalEveSandboxInventory uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): readLocalEveSandboxInventory derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): readLocalEveSandboxInventory uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): readLocalEveSandboxInventory sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep readLocalEveSandboxInventory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readLocalEveSandboxInventory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readLocalEveSandboxInventory accepts sessionIds: string[]; entry; a; b; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Internal local inventory. The caller authorizes and retires the native family
 * before using its session IDs. Unattributed directories prevent proof of full
 * coverage. Only explicit owner records establish resource ownership.
 */
export const readLocalEveSandboxInventory = async (
  appRoot: string,
  sessionIds: string[]
) => {
  const cacheRoot = nodePath.join(appRoot, ".eve", "sandbox-cache");
  const backends = await readdir(cacheRoot, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  );
  // Default EVE backend selection can change between launches. A local inventory
  // must not silently ignore evidence from a different provider or follow links.
  const unsupported = backends.filter(
    (entry) => entry.name !== "microsandbox" || !entry.isDirectory()
  );
  if (unsupported.length > 0) {
    return {
      owned: [],
      unattributedDirectories: unsupported
        .map((entry) => nodePath.join(cacheRoot, entry.name))
        .toSorted(),
    };
  }
  const directory = nodePath.join(cacheRoot, "microsandbox", "sessions");
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  );
  const family = new Set(sessionIds);
  const owned: {
    sessionDirectory: string;
    sessionKey: string;
  }[] = [];
  const unattributedDirectories: string[] = [];
  for (const entry of entries.toSorted((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const sessionDirectory = nodePath.join(directory, entry.name);
    // Do not traverse symlinks or unexpected files in the provider cache.
    if (!entry.isDirectory()) {
      unattributedDirectories.push(sessionDirectory);
      continue;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    const raw = await readFile(
      nodePath.join(sessionDirectory, "owner.json"),
      "utf-8"
    ).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    });
    let parsed: unknown;
    try {
      parsed = raw === undefined ? undefined : JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    const owner = localEveSandboxOwnerSchema.safeParse(parsed);
    if (!owner.success || owner.data.sessionKey !== entry.name) {
      unattributedDirectories.push(sessionDirectory);
      continue;
    }
    if (family.has(owner.data.sessionId)) {
      owned.push({ sessionDirectory, sessionKey: owner.data.sessionKey });
    }
  }
  return { owned, unattributedDirectories };
};
/* oxlint-enable id-length, import/group-exports, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
