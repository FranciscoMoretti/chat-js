import { defineConfig } from "evalite/config";
import { createSqliteStorage } from "evalite/sqlite-storage";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  storage: () => createSqliteStorage("./evals/db/evalite.db"),
  setupFiles: ["./evals/setup.ts"],
  viteConfig: {
    plugins: [tsconfigPaths()],
  },
});
