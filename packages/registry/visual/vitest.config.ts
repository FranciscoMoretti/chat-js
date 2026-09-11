import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const appRequire = createRequire(
	new URL("../../../apps/chat/package.json", import.meta.url),
);

export default defineConfig({
	optimizeDeps: {
		include: [
			"echarts",
			"next/dist/client/image-component",
			"react",
			"react-dom/client",
		],
	},
	define: { "process.env": "{}", IS_REACT_ACT_ENVIRONMENT: "true" },
	resolve: {
		alias: {
			echarts: appRequire.resolve("echarts"),
			"next/image": fileURLToPath(new URL("./next-image.ts", import.meta.url)),
			react: dirname(appRequire.resolve("react/package.json")),
			"@": fileURLToPath(new URL("../../../apps/chat", import.meta.url)),
		},
	},
	oxc: { jsx: { runtime: "automatic" } },
	css: {
		postcss: fileURLToPath(new URL("../../../apps/chat", import.meta.url)),
	},
	plugins: [uiverifyPlugin()],
	test: {
		include: ["visual/*.browser.test.tsx"],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: "chromium" }],
			viewport: { width: 1000, height: 900 },
		},
	},
});
