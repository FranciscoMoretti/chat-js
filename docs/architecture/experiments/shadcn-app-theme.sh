#!/usr/bin/env bash
# Temporarily apply a second native theme to the actual app and exercise its routes.
# All edited app files are restored on exit. Run with no concurrent app edits/tests.
set -euo pipefail
CHATJS_REPO_ROOT="$(git rev-parse --show-toplevel)"
CHATJS_THEME_EVIDENCE="$(mktemp -d "${TMPDIR:-/tmp}/chatjs-app-theme.XXXXXX")"
export CHATJS_REPO_ROOT CHATJS_THEME_EVIDENCE
cd "$CHATJS_REPO_ROOT"
for file in app/globals.css app/layout.tsx components.json lib/utils.ts; do
  mkdir -p "$CHATJS_THEME_EVIDENCE/original/$(dirname "$file")"
  cp "apps/chat/$file" "$CHATJS_THEME_EVIDENCE/original/$file"
done
restore_theme() {
  for file in app/globals.css app/layout.tsx components.json lib/utils.ts; do
    cp "$CHATJS_THEME_EVIDENCE/original/$file" "apps/chat/$file"
  done
}
trap restore_theme EXIT
for component in button dialog dropdown-menu sheet; do
  cp "apps/chat/components/ui/$component.tsx" "$CHATJS_THEME_EVIDENCE/$component.tsx"
done
CHATJS_SHADCN="$(bun -e 'console.log(require.resolve("shadcn"))')"
CHATJS_SECOND_PRESET="$(bun -e 'import {encodePreset} from "shadcn/preset"; console.log(encodePreset({style:"rhea",baseColor:"neutral",theme:"rose",font:"geist",radius:"large",iconLibrary:"lucide"}))')"
bun "$CHATJS_SHADCN" preset resolve --cwd apps/chat --json > "$CHATJS_THEME_EVIDENCE/before.json"
bun "$CHATJS_SHADCN" apply "$CHATJS_SECOND_PRESET" --only theme --cwd apps/chat --yes > "$CHATJS_THEME_EVIDENCE/apply.log" 2>&1
bun "$CHATJS_SHADCN" preset resolve --cwd apps/chat --json > "$CHATJS_THEME_EVIDENCE/after.json"
bun -e '
import assert from "node:assert/strict";
const root = process.env.CHATJS_THEME_EVIDENCE;
const before = await Bun.file(`${root}/before.json`).json();
const after = await Bun.file(`${root}/after.json`).json();
assert.deepEqual(before.fallbacks, []);
assert.deepEqual(after.fallbacks, []);
assert.equal(after.values.font, before.values.font);
assert.equal(after.values.theme, "rose");
assert.equal(after.values.radius, "large");
for (const file of ["app/layout.tsx", "components.json", "lib/utils.ts"]) {
  assert.equal(await Bun.file(`apps/chat/${file}`).text(), await Bun.file(`${root}/original/${file}`).text());
}
for (const name of ["button", "dialog", "dropdown-menu", "sheet"]) {
  assert.equal(await Bun.file(`apps/chat/components/ui/${name}.tsx`).text(), await Bun.file(`${root}/${name}.tsx`).text());
}
'
bun --filter=@chat-js/chat-visual-tests run test:visual pages/home.browser.tsx -t 'signed-in composer options' > "$CHATJS_THEME_EVIDENCE/browser.log" 2>&1
cp packages/chat-visual-tests/pages/__screenshots__/home-upload-menu.png "$CHATJS_THEME_EVIDENCE/rose-upload-menu.png"
echo "Second native theme passed; evidence: $CHATJS_THEME_EVIDENCE"
