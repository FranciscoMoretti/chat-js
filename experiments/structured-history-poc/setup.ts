/** Link the separately built eve source; never publish or vendor it into this PoC. */
import { access, mkdir, realpath, symlink } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(
  import.meta.dirname,
  "../../../eve-structured-history-poc/packages/eve"
);
await access(path.join(source, "dist/src/shared/session-history.js"));
const modules = path.join(import.meta.dirname, "node_modules");
await mkdir(modules, { recursive: true });
const target = path.join(modules, "eve");
const existing = await realpath(target).catch(() => null);
if (existing === null) {
  await symlink(source, target, "dir");
} else if (existing !== (await realpath(source))) {
  throw new Error("Existing eve dependency points to a different checkout.");
}
console.log("Linked locally built eve:", source);
