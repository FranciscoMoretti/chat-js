import { defineConfig } from "evalite/config";
import { createSqliteStorage } from "evalite/sqlite-storage";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  setupFiles: ["./evals/setup.ts"],
  storage: () => createSqliteStorage("./evals/db/evalite.db"),
  viteConfig: {
    plugins: [tsconfigPaths()],
  },
});
