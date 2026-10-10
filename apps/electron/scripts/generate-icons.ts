import { BICUBIC2, clearCache, createICNS, createICO } from "png2icons";
// oxlint-disable-next-line import/no-nodejs-modules -- The icon generator reads the source image and writes platform icon files on disk.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the icon generator's native module URL.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules -- The icon generator needs native filesystem path semantics.
import path from "node:path";

const LOSSLESS_COLOR_COUNT = 0;

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "icon.png");
const buildDir = path.join(root, "build");
const outputBase = path.join(buildDir, "icon");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readIconFormats's awaited sequencing and rejected-Promise behavior. */
const readIconFormats = async (): Promise<{
  icns: Buffer;
  ico: Buffer;
}> => {
  const sourcePng = await readFile(src);
  const icns = createICNS(sourcePng, BICUBIC2, LOSSLESS_COLOR_COUNT);
  const ico = createICO(sourcePng, BICUBIC2, LOSSLESS_COLOR_COUNT, false, true);

  if (!icns) {
    throw new Error("Failed to generate build/icon.icns");
  }

  if (!ico) {
    throw new Error("Failed to generate build/icon.ico");
  }

  return { icns, ico };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve generateIcons's awaited sequencing and rejected-Promise behavior. */
const generateIcons = async (): Promise<void> => {
  await mkdir(buildDir, { recursive: true });
  const { icns, ico } = await readIconFormats();

  await copyFile(src, `${outputBase}.png`);
  await writeFile(`${outputBase}.icns`, icns);
  await writeFile(`${outputBase}.ico`, ico);
  clearCache();

  /* oxlint-disable eslint/no-console -- Generated build/icon.{png,icns,ico}: This command or desktop boundary reports startup, progress and failures to its operator. */
  console.log("Generated build/icon.{png,icns,ico}");
  /* oxlint-enable eslint/no-console */
};
/* oxlint-enable oxc/no-async-await */
// oxlint-disable-next-line unicorn/prefer-top-level-await, promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Generated Node/tsx prebuilds run in CommonJS; handle rejection here because that transform cannot support top-level await.
generateIcons().catch((error: unknown): void => {
  // oxlint-disable-next-line no-console -- Report an icon-generation failure to the invoking package manager.
  console.error(error);
  process.exitCode = 1;
});
