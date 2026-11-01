import { expect, test } from "bun:test";
import path from "node:path";
import { z } from "zod";

const root = path.resolve(import.meta.dir, "..");
const taskGraphSchema = z.object({
  tasks: z.array(
    z.object({
      command: z.string(),
      dependencies: z.array(z.string()),
      taskId: z.string(),
    })
  ),
});

test("Playwright builds its libraries without building the app beside next dev", () => {
  // Include every workspace, as CI does. Packages without an e2e script can
  // still pull dependency builds into Turbo's task graph.
  const result = Bun.spawnSync(
    [
      path.join(root, "node_modules/.bin/turbo"),
      "run",
      "test:e2e",
      "--dry=json",
    ],
    {
      cwd: root,
      env: { ...process.env, TURBO_DAEMON: "false" },
      timeout: 10_000,
    }
  );

  expect(result.exitCode).toBe(0);
  const { tasks } = taskGraphSchema.parse(JSON.parse(result.stdout.toString()));
  expect(tasks.map((task) => task.taskId)).not.toContain("@chatjs/chat#build");
  const e2eTasks = tasks.filter(
    (task) =>
      task.taskId.endsWith("#test:e2e") && task.command !== "<NONEXISTENT>"
  );
  expect(e2eTasks.map((task) => task.taskId)).toEqual([
    "@chatjs/chat#test:e2e",
  ]);
  expect(e2eTasks[0]?.dependencies).toContain("@chat-js/gateways#build");
  expect(e2eTasks[0]?.dependencies).toContain("@chat-js/sandboxes#build");
}, 15_000);
