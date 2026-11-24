import assert from "node:assert/strict";
import { test } from "node:test";
import { canopyLayout, visibleCanopyCells } from "./canopy-layout";

const screens = [
  { width: 320, height: 512 },
  { width: 390, height: 788 },
  { width: 768, height: 964 },
  { width: 1200, height: 640 },
  { width: 1920, height: 1020 },
];

for (const size of screens) {
  void test(`Canopy gives its leading choices complete lower-row cells at ${size.width} × ${size.height}`, () => {
    const layout = canopyLayout(size, 96);
    const cells = visibleCanopyCells(size, layout, { column: 0, row: 0 });
    const featured = cells.filter((cell) => cell.index < 4);
    assert.equal(featured.length, 4);
    for (const cell of featured) {
      assert.equal(cell.row, 0);
      assert.ok(cell.left >= 0 && cell.left + layout.side <= size.width);
      assert.ok(cell.top + layout.side <= size.height);
    }
  });
  void test(`Canopy preserves unique blocks under pan at ${size.width} × ${size.height}`, () => {
    const layout = canopyLayout(size, 96);
    for (const camera of [
      { column: 0.5, row: 0.5 },
      { column: -23.38, row: 97.25 },
      { column: 5402.8, row: -8796.91 },
    ]) {
      const cells = visibleCanopyCells(size, layout, camera);
      assert.equal(new Set(cells.map((cell) => cell.index)).size, cells.length);
      assert.ok(cells.every((cell) => cell.index < 96));
    }
  });
}
