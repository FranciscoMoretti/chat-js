import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

const require = createRequire(resolve("package.json"));
// Resolve both peers from this workspace, including imports inside hoisted Remotion packages.
export const webpackOverride: WebpackOverrideFn = (config) => ({
	...config,
	resolve: {
		...config.resolve,
		alias: {
			...config.resolve?.alias,
			react: dirname(require.resolve("react/package.json")),
			"react-dom": dirname(require.resolve("react-dom/package.json")),
		},
	},
});
