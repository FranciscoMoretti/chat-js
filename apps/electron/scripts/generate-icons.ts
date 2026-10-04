import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* oxlint-disable import/no-namespace -- the png2icons import: The library namespace is the existing primitive/type API; replacing it requires changing its consumers and type references. */
import * as png2icons from "png2icons";
/* oxlint-enable import/no-namespace */

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "icon.png");
const buildDir = path.join(root, "build");
const outputBase = path.join(buildDir, "icon");

/* oxlint-disable node/no-sync -- generate-icons.ts: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
mkdirSync(buildDir, { recursive: true });
/* oxlint-enable node/no-sync */

/* oxlint-disable node/no-sync -- sourcePng: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
const sourcePng = readFileSync(src);
/* oxlint-enable node/no-sync */
/* oxlint-disable eslint/no-magic-numbers -- icns: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const icns = png2icons.createICNS(sourcePng, png2icons.BICUBIC2, 0);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- ico: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const ico = png2icons.createICO(sourcePng, png2icons.BICUBIC2, 0, false, true);
/* oxlint-enable eslint/no-magic-numbers */

if (!icns) {
  throw new Error("Failed to generate build/icon.icns");
}

if (!ico) {
  throw new Error("Failed to generate build/icon.ico");
}

/* oxlint-disable node/no-sync -- generate-icons.ts: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
copyFileSync(src, `${outputBase}.png`);
/* oxlint-enable node/no-sync */
/* oxlint-disable node/no-sync -- generate-icons.ts: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
writeFileSync(`${outputBase}.icns`, icns);
/* oxlint-enable node/no-sync */
/* oxlint-disable node/no-sync -- generate-icons.ts: Forge/startup uses synchronous configuration and filesystem contracts before the desktop process is ready. */
writeFileSync(`${outputBase}.ico`, ico);
/* oxlint-enable node/no-sync */
png2icons.clearCache();

/* oxlint-disable eslint/no-console -- Generated build/icon.{png,icns,ico}: This command or desktop boundary reports startup, progress and failures to its operator. */
console.log("Generated build/icon.{png,icns,ico}");
/* oxlint-enable eslint/no-console */
