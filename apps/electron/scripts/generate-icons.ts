import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as png2icons from "png2icons";

const root = resolve(__dirname, "..");
const src = join(root, "icon.png");
const buildDir = join(root, "build");
const outputBase = join(buildDir, "icon");

mkdirSync(buildDir, { recursive: true });

const sourcePng = readFileSync(src);
const icns = png2icons.createICNS(sourcePng, png2icons.BICUBIC2, 0);
const ico = png2icons.createICO(sourcePng, png2icons.BICUBIC2, 0, false, true);

if (!icns) {
  throw new Error("Failed to generate build/icon.icns");
}

if (!ico) {
  throw new Error("Failed to generate build/icon.ico");
}

copyFileSync(src, `${outputBase}.png`);
writeFileSync(`${outputBase}.icns`, icns);
writeFileSync(`${outputBase}.ico`, ico);
png2icons.clearCache();

console.log("Generated build/icon.{png,icns,ico}");
