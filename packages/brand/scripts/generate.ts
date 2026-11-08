import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { colors, foundations, mark, markSvg } from "../src/identity";
import { squareSvg, wavePaths } from "../src/square";
import wordmark from "../sources/wordmark.json";

const root = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(root, "../..");
const check = process.argv.includes("--check");
const outputs = new Map<string, Uint8Array>();
const encode = (value: string) => new TextEncoder().encode(value);
const asset = (name: string, value: string | Uint8Array) => {
  outputs.set(
    path.join(root, "assets", name),
    typeof value === "string" ? encode(value) : value
  );
};
const siteCopy = (name: string, value: Uint8Array) => {
  outputs.set(path.join(repo, "apps/site", name), value);
};
const svg = (width: number, height: number, content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;

const geist = await readFile(path.join(root, "sources/fonts/geist.woff2"));
const plex = await readFile(path.join(root, "sources/fonts/plex.ttf"));
const fonts = `<style>@font-face{font-family:Geist;src:url(data:font/woff2;base64,${geist.toString("base64")}) format('woff2');font-weight:100 900}@font-face{font-family:Plex;src:url(data:font/ttf;base64,${plex.toString("base64")}) format('truetype')}</style>`;

for (const [name, fill] of [
  ["light", colors.foreground],
  ["dark", colors.background],
  ["mono", "currentColor"],
]) {
  asset(`marks/chatjs-mark-${name}.svg`, markSvg(fill));
  const lockup = svg(
    206,
    44,
    `<g fill="${fill}"><g transform="translate(0 4) scale(1.2)"><path d="${mark.path}"/></g><path transform="translate(49 34) scale(${32 / wordmark.unitsPerEm})" d="${wordmark.path}"/></g>`
  );
  asset(`logos/chatjs-logo-${name}.svg`, lockup);
}

const icon = svg(
  512,
  512,
  `<rect width="512" height="512" rx="96" fill="${colors.background}"/><g transform="translate(96 96) scale(${320 / 30})" fill="${colors.foreground}"><path d="${mark.path}"/></g>`
);
asset("icons/chatjs-icon.svg", icon);
await Promise.all(
  [16, 32, 48, 180, 192, 512, 1024].map(async (size) => {
    asset(
      `icons/chatjs-icon-${size}.png`,
      await sharp(Buffer.from(icon)).resize(size, size).png().toBuffer()
    );
  })
);
// ICO supports PNG payloads; include native 16/32/48 sizes for browser chrome.
const iconSizes = [16, 32, 48];
const header = Buffer.alloc(6 + iconSizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(iconSizes.length, 4);
let offset = header.length;
const payloads = iconSizes.map((size, index) => {
  const data = outputs.get(
    path.join(root, `assets/icons/chatjs-icon-${size}.png`)
  );
  if (!data) {
    throw new Error(`Missing icon ${size}`);
  }
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(data.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += data.length;
  return data;
});
asset("icons/favicon.ico", Buffer.concat([header, ...payloads]));

const squares: string[] = [];
for (const [index, item] of foundations.entries()) {
  const square = squareSvg(item.name, item.meta, index, `fade-${item.id}`)
    .replace('aria-hidden="true"', `role="img" aria-label="${item.name}"`)
    .replace("<defs>", `<defs>${fonts}`)
    .replace(
      /<\/svg>$/u,
      `<rect x=".5" y=".5" width="159" height="159" fill="none" stroke="${colors.border}"/></svg>`
    );
  asset(`squares/${item.id}.svg`, square);
  const field = svg(
    160,
    160,
    `<rect width="160" height="160" fill="${colors.surface}"/><svg width="160" height="160" viewBox="0 0 108 108" fill="none" stroke="${colors.pattern}" stroke-width=".85" overflow="hidden">${wavePaths(index)}</svg>`
  );
  asset(`patterns/field-${index + 1}.svg`, field);
  squares.push(square);
}

const layout = [
  [0, 0],
  [176, 0],
  [352, 0],
  [0, 176],
  [0, 352],
  [176, 352],
  [352, 352],
];
const composition = svg(
  512,
  512,
  layout
    .map(
      ([x, y], index) =>
        `<g transform="translate(${x} ${y})">${squares[index].replace('viewBox="0 0 160 160"', 'width="160" height="160" viewBox="0 0 160 160"')}</g>`
    )
    .join("")
);
asset("compositions/building-blocks-c.svg", composition);

const lockup = outputs.get(
  path.join(root, "assets/logos/chatjs-logo-light.svg")
);
if (!lockup) {
  throw new Error("Missing logo");
}
const sheet = svg(
  1440,
  1060,
  `<rect width="1440" height="1060" fill="${colors.background}"/>
<g transform="translate(64 48)">${new TextDecoder().decode(lockup)}</g>
<g fill="${colors.muted}" font-family="Arial,sans-serif" font-size="12" letter-spacing="2"><text x="64" y="142">CARBON / BRAND ASSETS</text><text x="64" y="234">01  MARK &amp; ICON</text><text x="570" y="234">02  BUILDING BLOCKS</text><text x="64" y="914">03  ONE NEUTRAL PALETTE</text></g>
<path d="M64 174H1376" stroke="${colors.border}"/>
<g transform="translate(64 284) scale(6)" fill="${colors.foreground}"><path d="${mark.path}"/></g>
<g transform="translate(290 284)">${icon.replace('width="512" height="512"', 'width="180" height="180"')}</g>
<text x="64" y="530" fill="${colors.foreground}" font-family="Arial,sans-serif" font-size="30">The building blocks</text><text x="64" y="570" fill="${colors.muted}" font-family="Arial,sans-serif" font-size="30">for your AI app.</text>
<g transform="translate(570 272) scale(1.05)">${composition}</g>
${Object.entries(colors)
  .map(
    ([name, color], index) =>
      `<g transform="translate(${64 + index * 188} 950)"><rect width="172" height="44" fill="${color}" stroke="${colors.border}"/><text y="68" fill="${colors.muted}" font-family="Arial,sans-serif" font-size="12">${name} · ${color}</text></g>`
  )
  .join("")}`
);
asset("overview.svg", sheet);
asset("overview.png", await sharp(Buffer.from(sheet)).png().toBuffer());

const bundle = await Bun.build({
  entrypoints: [path.join(root, "src/browser.ts")],
  target: "browser",
  format: "iife",
  minify: true,
});
if (!bundle.success) {
  throw new Error(
    `Brand runtime failed: ${bundle.logs.map((log) => log.message).join("\n")}`
  );
}
const runtime = encode(
  `// Generated by packages/brand. Run bun brand:generate.\n${await bundle.outputs[0].text()}`
);
asset("runtime/brand.js", runtime);
siteCopy("public/home/hero/brand.js", runtime);
siteCopy("public/home/fonts/geist.woff2", geist);
siteCopy("public/home/fonts/plex.ttf", plex);

const productFiles = await readdir(path.join(root, "assets/product-blocks"));
await Promise.all(
  productFiles
    .filter((name) => name.endsWith(".svg"))
    .toSorted()
    .map(async (file) => {
      siteCopy(
        `public/home/blocks/${file}`,
        await readFile(path.join(root, "assets/product-blocks", file))
      );
    })
);
for (const [source, destination] of [
  ["marks/chatjs-mark-mono.svg", "public/logo.svg"],
  ["icons/chatjs-icon.svg", "app/icon.svg"],
  ["icons/chatjs-icon-180.png", "app/apple-icon.png"],
  ["icons/favicon.ico", "app/favicon.ico"],
]) {
  const data = outputs.get(path.join(root, "assets", source));
  if (!data) {
    throw new Error(`Missing export ${source}`);
  }
  siteCopy(destination, data);
}

const stale: string[] = [];
const mirroredBlocks = path.join(repo, "apps/site/public/home/blocks");
const publishedBlocks = await readdir(mirroredBlocks).catch(
  (error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
);
await Promise.all(
  publishedBlocks
    .filter((file) => file.endsWith(".svg") && !productFiles.includes(file))
    .map(async (file) => {
      const target = path.join(mirroredBlocks, file);
      if (check) {
        stale.push(path.relative(repo, target));
      } else {
        await rm(target);
      }
    })
);
await Promise.all(
  [...outputs].map(async ([file, data]) => {
    if (check) {
      const current = await readFile(file).catch(() => null);
      if (!current || !current.equals(Buffer.from(data))) {
        stale.push(path.relative(repo, file));
      }
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    }
  })
);
if (stale.length > 0) {
  throw new Error(
    `Stale brand assets. Run bun brand:generate:\n${stale.join("\n")}`
  );
}
console.log(
  `${check ? "Checked" : "Generated"} ${outputs.size} brand assets and website copies.`
);
