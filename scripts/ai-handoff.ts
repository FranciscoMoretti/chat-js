import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const checkoutEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))
);
let stopHookActive = false;
const cursor = process.argv[3] === "cursor";

const git = (...args: string[]): Buffer => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: root,
    env: checkoutEnv,
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout;
};

const fingerprint = (): string => {
  const hash = createHash("sha256");
  hash.update(git("rev-parse", "HEAD"));
  hash.update(
    git("diff", "--no-ext-diff", "--no-textconv", "--binary", "HEAD", "--")
  );
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z")
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const file of untracked) {
    hash.update(file);
    hash.update("\0");
    const target = path.join(root, file);
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      hash.update(readlinkSync(target));
    } else if (stat.isFile()) {
      hash.update(readFileSync(target));
    }
    hash.update("\0");
  }
  return hash.digest("hex");
};

const output = (systemMessage?: string): void => {
  if (cursor) {
    if (systemMessage !== undefined) {
      process.stderr.write(`${systemMessage}\n`);
    }
    process.stdout.write(
      JSON.stringify(process.argv[2] === "start" ? { continue: true } : {})
    );
    return;
  }
  process.stdout.write(
    JSON.stringify(systemMessage === undefined ? {} : { systemMessage })
  );
};

const requestCorrection = (message: string): void => {
  if (cursor) {
    process.stdout.write(JSON.stringify({ followup_message: message }));
  } else {
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseInput = (input: unknown) => {
  if (!isRecord(input)) {
    throw new Error("Hook payload must be an object.");
  }
  stopHookActive =
    input.stop_hook_active === true ||
    (cursor && typeof input.loop_count === "number" && input.loop_count > 0);
  const sessionKey = cursor ? "conversation_id" : "session_id";
  const sessionId = input[sessionKey];
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error(`Hook payload is missing ${sessionKey}.`);
  }
  return {
    interrupted:
      cursor && (input.status === "aborted" || input.status === "error"),
    sessionId,
  };
};

const run = async (): Promise<void> => {
  const input: unknown = JSON.parse(await Bun.stdin.text());
  const { sessionId, interrupted } = parseInput(input);
  const session = createHash("sha256").update(sessionId).digest("hex");
  const directory = path.resolve(
    root,
    git("rev-parse", "--git-path", "agent-handoff").toString().trim()
  );
  const statePath = path.join(directory, session);
  const failurePath = `${statePath}.failed`;
  const activePath = `${statePath}.active`;
  if (process.argv[2] === "check" && interrupted) {
    rmSync(activePath, { force: true });
    output();
    return;
  }
  const current = fingerprint();
  if (process.argv[2] === "start") {
    mkdirSync(directory, { recursive: true });
    // Steering and question replies can submit another prompt before Stop.
    if (!existsSync(activePath) || !existsSync(statePath)) {
      writeFileSync(statePath, current);
    }
    writeFileSync(activePath, "");
    output();
    return;
  }
  if (!existsSync(statePath)) {
    throw new Error(
      "Handoff check skipped: no prompt-start snapshot; run bun lint and bun test:types before handing off code."
    );
  }
  if (readFileSync(statePath, "utf-8") === current) {
    rmSync(activePath, { force: true });
    if (
      existsSync(failurePath) &&
      readFileSync(failurePath, "utf-8") === current
    ) {
      output(
        "Handoff checks previously failed for this unchanged checkout. Report the remaining failures; no automatic retry was requested."
      );
    } else {
      output();
    }
    return;
  }
  const lint = Bun.spawnSync(["bun", "run", "lint"], {
    cwd: root,
    env: checkoutEnv,
    stdout: 2,
    stderr: "inherit",
  });
  const types = Bun.spawnSync(["bun", "run", "test:types"], {
    cwd: root,
    env: checkoutEnv,
    stdout: 2,
    stderr: "inherit",
  });
  // Cache the checked input, not any changes made concurrently by another agent.
  writeFileSync(statePath, current);
  if (lint.exitCode !== 0 || types.exitCode !== 0) {
    writeFileSync(failurePath, current);
    if (stopHookActive) {
      rmSync(activePath, { force: true });
      output(
        "Handoff checks still fail. Automatic continuation stopped; report the remaining failures to the user."
      );
    } else {
      const failed = [
        ...(lint.exitCode === 0 ? [] : ["bun lint"]),
        ...(types.exitCode === 0 ? [] : ["bun test:types"]),
      ];
      requestCorrection(
        `Handoff checks failed: ${failed.join(" and ")}. Run the failing commands, fix issues caused by your changes, and report unrelated failures without changing unrelated work.`
      );
    }
    return;
  }
  rmSync(failurePath, { force: true });
  rmSync(activePath, { force: true });
  output();
};

try {
  await run();
} catch (error) {
  const message = `Handoff check could not run: ${String(error)}`;
  if (process.argv[2] === "check" && !stopHookActive) {
    requestCorrection(message);
  } else {
    output(message);
  }
}
