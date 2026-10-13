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
  process.stdout.write(
    JSON.stringify(systemMessage === undefined ? {} : { systemMessage })
  );
};

const run = async (): Promise<void> => {
  const input: unknown = JSON.parse(await Bun.stdin.text());
  stopHookActive =
    typeof input === "object" &&
    input !== null &&
    "stop_hook_active" in input &&
    input.stop_hook_active === true;
  if (
    typeof input !== "object" ||
    input === null ||
    !("session_id" in input) ||
    typeof input.session_id !== "string" ||
    input.session_id.length === 0
  ) {
    output("Handoff check skipped: hook payload is missing session_id.");
    return;
  }
  const session = createHash("sha256").update(input.session_id).digest("hex");
  const directory = path.resolve(
    root,
    git("rev-parse", "--git-path", "agent-handoff").toString().trim()
  );
  const statePath = path.join(directory, session);
  const failurePath = `${statePath}.failed`;
  const activePath = `${statePath}.active`;
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
      process.exitCode = 2;
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
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  } else {
    output(message);
  }
}
