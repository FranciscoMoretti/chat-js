import { BICUBIC2, clearCache, createICNS, createICO } from "png2icons";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const LOSSLESS_COLOR_COUNT = 0;

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "icon.png");
const buildDir = path.join(root, "build");
const outputBase = path.join(buildDir, "icon");

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
const generateIcons = async (): Promise<void> => {
  try {
    await mkdir(buildDir, { recursive: true });
    const { icns, ico } = await readIconFormats();

    await copyFile(src, `${outputBase}.png`);
    await writeFile(`${outputBase}.icns`, icns);
    await writeFile(`${outputBase}.ico`, ico);
    clearCache();

    console.log("Generated build/icon.{png,icns,ico}");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
};
void generateIcons();
