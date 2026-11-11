import assert from "node:assert/strict";
import { test } from "node:test";
import { pluginItems } from "../../../../packages/registry/src/plugins/catalog";
import { pluginDefinitionSchema } from "../../../../packages/registry/metadata";
import { livePreviewPlugins, pluginPreviewLabel } from "./preview-capabilities";

void test("every built-in signed-in chat UI plugin is registered in Create", () => {
  const visible = pluginItems.flatMap((item) => {
    const definition = pluginDefinitionSchema.parse(item.meta?.chatjs);
    const { client } = definition;
    return client &&
      (client.chat ||
        client.accountSummary ||
        client.uploads ||
        client.modelVisibility ||
        client.composerControls.length ||
        client.settingsItems.length)
      ? [definition.id]
      : [];
  });
  assert.deepEqual(livePreviewPlugins.toSorted(), visible.toSorted());
});

void test("non-chat experiences have accurate preview labels", () => {
  assert.equal(pluginPreviewLabel("guest-chat", false), "Preview as Guest");
  assert.equal(pluginPreviewLabel("desktop", true), "Desktop app only");
  assert.equal(pluginPreviewLabel("vercel-analytics", true), "No visible UI");
});
