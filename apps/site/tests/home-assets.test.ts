import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { blocks } from "../components/home/blocks";

const site = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.resolve(site, "public");
const docsRoot = path.resolve(site, "../docs");

void describe("homepage assets are portable outside the design archive", () => {
  void it("the shared brand bundle works without module imports in both sandboxed frames", () => {
    const bundle = readFileSync(
      path.resolve(publicRoot, "home/hero/brand.js"),
      "utf-8"
    );
    const result: unknown = runInNewContext(`${bundle}
      JSON.stringify({
        mark: CarbonMotion.mark(),
        customMark: CarbonMotion.mark('"/><script>alert(1)</script>'),
        first: CarbonSquare.svg('MCP', 'Optional', 6),
        second: CarbonSquare.svg('MCP', 'Added', 6),
        escaped: CarbonSquare.svg('<test>', 'A & B', 0)
      });
    `);
    assert.equal(typeof result, "string");
    assert.match(String(result), /square-fade-1/u);
    assert.match(String(result), /square-fade-2/u);
    assert.match(String(result), /&lt;test&gt;/u);
    assert.match(String(result), /A &amp; B/u);
    assert.doesNotMatch(String(result), /NaN|undefined/u);
    assert.doesNotMatch(String(result), /<script>/u);
    assert.match(String(result), /&quot;/u);
  });
  void it("every block ships its artwork and resolves to documented capabilities", () => {
    assert.equal(new Set(blocks.map((block) => block.id)).size, blocks.length);
    for (const block of blocks) {
      if (block.command) {
        assert.match(block.command, /^npx chat-js@alpha (?:create|add) /u);
      }
      const svg = readFileSync(
        path.resolve(publicRoot, `home/blocks/${block.id}.svg`),
        "utf-8"
      );
      assert.ok(svg.includes('viewBox="0 0 320 320"'), block.id);
      assert.equal(
        /href="(?!data:|#)/u.test(svg),
        false,
        `${block.id} must embed its resources`
      );
      assert.ok(
        existsSync(path.resolve(docsRoot, `${block.path}.mdx`)),
        block.path
      );
    }
  });
  void it("both animation exports include their script, style, and font dependencies", () => {
    for (const page of ["home/hero/index.html", "home/source/index.html"]) {
      const file = path.resolve(publicRoot, page);
      const html = readFileSync(file, "utf-8");
      assert.doesNotMatch(html, /brand-archive|localhost|127\.0\.0\.1/u);
      const assets = [...html.matchAll(/(?:src|href)="(?<target>[^"#]+)"/gu)];
      assert.ok(assets.length > 0);
      for (const [, target] of assets) {
        assert.ok(existsSync(path.resolve(file, "..", target)), target);
      }
    }
  });
});
