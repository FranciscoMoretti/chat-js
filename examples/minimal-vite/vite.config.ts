import { defineConfig } from "vite";
export default defineConfig({
	server: {
		port: Number(process.env.PORT),
		proxy: {
			"/api": { target: process.env.APP_GATEWAY_ORIGIN, changeOrigin: false },
		},
	},
	plugins: [
		{
			name: "browser-boundary-audit",
			generateBundle() {
				const modules = [...this.getModuleIds()].filter(
					(id) => !id.startsWith("\0"),
				);
				const forbidden = modules.filter(
					(id) =>
						id.startsWith(`${process.cwd()}/server/`) ||
						/(?:\/node_modules\/next\/|\/lib\/(?:identity|bindings|router|eve-server|confirm-effect)\.|\/chat\.server\.|\/agent\/)/.test(
							id,
						),
				);
				if (forbidden.length)
					this.error(
						`Server or Next code reached browser: ${forbidden.join(", ")}`,
					);
				this.emitFile({
					type: "asset",
					fileName: "browser-modules.json",
					source: JSON.stringify(
						modules.map((id) => id.replace(process.cwd(), "<app>")),
						null,
						2,
					),
				});
			},
		},
	],
});
