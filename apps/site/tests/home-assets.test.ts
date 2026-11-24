import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import path from "node:path";
import { canopyBlocks } from "../components/home/canopy-catalog";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));

void it("Canopy ships its Carbon contours and miniature block previews", () => {
  assert.ok(existsSync(path.join(publicRoot, "home/blocks/contours.webp")));
  const previews = canopyBlocks.flatMap(({ preview }) =>
    preview === undefined ? [] : [preview]
  );
  assert.ok(previews.length > 0);
  for (const preview of previews) {
    assert.ok(existsSync(path.join(publicRoot, preview)), `Missing ${preview}`);
  }
});

void it("Canopy's block icons are inline SVGs or files shipped by the site", () => {
  for (const block of canopyBlocks) {
    if (block.icon === undefined) {
      continue;
    }
    if (block.icon.startsWith("data:image/svg+xml")) {
      continue;
    }
    assert.ok(
      block.icon.startsWith("/") && !block.icon.startsWith("//"),
      `External icon for ${block.id}`
    );
    assert.ok(
      existsSync(path.join(publicRoot, block.icon)),
      `Missing icon for ${block.id}: ${block.icon}`
    );
  }
});
