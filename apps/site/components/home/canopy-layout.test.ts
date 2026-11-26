import assert from "node:assert/strict";
import { test } from "node:test";
import { canopyLayout, visibleCanopyCells } from "./canopy-layout";

const screens = [
  { width: 320, height: 512, columns: 2 },
  { width: 390, height: 788, columns: 2 },
  { width: 768, height: 964, columns: 3 },
  { width: 1200, height: 640, columns: 5 },
  { width: 1920, height: 1020, columns: 8 },
  { width: 2560, height: 794, columns: 10 },
];

for (const size of screens) {
  void test(`Canopy gives its leading choices complete lower-row cells at ${size.width} × ${size.height}`, () => {
    const layout = canopyLayout(size, 96);
    const cells = visibleCanopyCells(size, layout, { column: 0, row: 0 });
    assert.equal(layout.columns, size.columns);
    const featured = cells.filter((cell) => cell.index < layout.columns);
    assert.equal(featured.length, layout.columns);
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
