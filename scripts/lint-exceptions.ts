import ts from "typescript";

const ZERO = 0;
const ONE = 1;
const TWO = 2;
const BASELINE_VERSION = 1;

interface ExceptionBaseline {
  readonly version: typeof BASELINE_VERSION;
  readonly counts: Readonly<Record<string, number>>;
  readonly missingReasons: Readonly<Record<string, number>>;
  readonly scopeFingerprints: Readonly<Record<string, readonly string[]>>;
}

interface LintException {
  readonly directive: string;
  readonly line: number;
  readonly reason: string;
  readonly rules: readonly string[];
  readonly scopeFingerprints: Readonly<Record<string, string>>;
}

interface CommentDirective {
  readonly engine: string;
  readonly kind: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly reason: string;
  readonly rules: readonly string[];
}

// Parse literals before scanning comments so strings, regexes, templates and JSX
// text cannot become suppression directives. Offsets remain UTF-16 code units.
const maskLiterals = (source: string, filename: string): string => {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const masked = Array.from({ length: source.length }, (character, index) =>
    source.charAt(index)
  );
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Compiler Nodes are mutable library interfaces; this visitor only reads their positions and syntax kind.
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isRegularExpressionLiteral(node) ||
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail ||
      ts.isJsxText(node)
    ) {
      for (let index = node.getStart(tree); index < node.end; index += ONE) {
        if (masked[index] !== "\n" && masked[index] !== "\r") {
          masked[index] = " ";
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return masked.join("");
};

// oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- The lexical pass retains comment positions and directive parsing together so masked syntax and original source offsets cannot diverge.
const readDirectives = (
  source: string,
  filename: string
): CommentDirective[] => {
  const masked = maskLiterals(source, filename);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    masked
  );
  const directives: CommentDirective[] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const start = scanner.getTokenStart();
      const end = scanner.getTokenEnd();
      const comment = source.slice(
        start + TWO,
        end - (token === ts.SyntaxKind.MultiLineCommentTrivia ? TWO : ZERO)
      );
      const match =
        /^\s*(?<engine>eslint|oxlint)-(?<kind>disable(?:-next-line|-line)?|enable)\b(?<body>[\s\S]*)$/u.exec(
          comment
        );
      if (match?.groups) {
        const { engine = "", kind = "", body = "" } = match.groups;
        const separator = body.indexOf("--");
        directives.push({
          end,
          engine,
          kind,
          line: source.slice(ZERO, start).split("\n").length,
          reason:
            separator === -ONE
              ? ""
              : body
                  .slice(separator + TWO)
                  .replaceAll(/^\s*\*\s?/gmu, "")
                  .trim(),
          rules: (separator === -ONE ? body : body.slice(ZERO, separator))
            .trim()
            .split(/[\s,]+/u)
            .filter(Boolean),
          start,
        });
      }
    }
  }
  return directives;
};

interface SourceScope {
  readonly start: number;
  readonly end: number;
}

interface FunctionSourceScope extends SourceScope {
  readonly anchor: number;
}

const FILE_METRICS = new Set([
  "max-lines",
  "max-classes-per-file",
  "import/max-dependencies",
  "react/no-multi-comp",
]);
const FUNCTION_METRICS = new Set([
  "max-lines-per-function",
  "max-statements",
  "max-depth",
  "max-params",
  "complexity",
]);

const withoutDirectives = (
  source: string,
  directives: readonly CommentDirective[]
): string => {
  const characters = Array.from({ length: source.length }, (character, index) =>
    source.charAt(index)
  );
  for (const directive of directives) {
    for (let index = directive.start; index < directive.end; index += ONE) {
      if (characters[index] !== "\n" && characters[index] !== "\r") {
        characters[index] = " ";
      }
    }
  }
  return characters.join("");
};

// Compiler-owned mutable Nodes are read-only inputs; only source positions are collected.
const functionScope = (
  source: string,
  filename: string,
  target: SourceScope
): SourceScope => {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const scopes: FunctionSourceScope[] = [];
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Compiler Nodes expose mutable library interfaces; this traversal only reads syntax and positions.
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && "body" in node && node.body) {
      const declaration =
        ts.isVariableDeclaration(node.parent) &&
        ts.isVariableDeclarationList(node.parent.parent)
          ? node.parent.parent.parent
          : node;
      const start = declaration.getStart(tree);
      if (start < target.end && declaration.end > target.start) {
        scopes.push({
          anchor: node.getStart(tree),
          end: declaration.end,
          start,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const startingHere = scopes.filter(
    (scope) => scope.anchor >= target.start && scope.anchor < target.end
  );
  const first = startingHere
    .toSorted((left, right) => left.start - right.start)
    .at(ZERO);
  if (first) {
    return {
      end: Math.max(...startingHere.map((scope) => scope.end)),
      start: first.start,
    };
  }
  return (
    scopes.toSorted(
      (left, right) => left.end - left.start - (right.end - right.start)
    )[ZERO] ?? target
  );
};

const lineScope = (
  source: string,
  directive: CommentDirective
): SourceScope => {
  const start =
    directive.kind === "disable-next-line"
      ? source.indexOf("\n", directive.end) + ONE
      : source.lastIndexOf("\n", directive.start) + ONE;
  const finalLineStart =
    directive.kind === "disable-next-line" ? start : directive.end;
  const newline = source.indexOf("\n", finalLineStart);
  return {
    end: newline < ZERO ? source.length : newline,
    start:
      start === ZERO && directive.kind === "disable-next-line"
        ? source.length
        : start,
  };
};

const normalizeScope = (value: string): string =>
  value.replaceAll(/\s+/gu, " ").trim();

const occurrenceIdentity = (
  cleanSource: string,
  scope: SourceScope,
  line: boolean
): number => {
  const covered = cleanSource.slice(scope.start, scope.end).trim();
  if (!covered) {
    return ZERO;
  }
  const prefix = cleanSource.slice(ZERO, scope.start);
  if (line && !covered.includes("\n")) {
    return prefix
      .split("\n")
      .filter((candidate) => candidate.trim() === covered).length;
  }
  // Compare repeated covered regions after removing directives and normalizing
  // whitespace; ordinary inserted lines do not change the occurrence ordinal.
  return normalizeScope(prefix).split(normalizeScope(covered)).length - ONE;
};

// oxlint-disable-next-line eslint/max-lines-per-function -- Fingerprint each real directive with its reason, covered scope, repeated-source identity and closure boundary in one policy pass.
const readExceptions = (
  source: string,
  filename = "source.ts"
): LintException[] => {
  const directives = readDirectives(source, filename);
  const cleanSource = withoutDirectives(source, directives);
  return directives
    .filter((directive) => directive.kind !== "enable")
    .map((directive) => {
      const scopeFingerprints: Record<string, string> = {};
      for (const rule of directive.rules) {
        const enable = directives.find(
          (candidate) =>
            directive.kind === "disable" &&
            candidate.start > directive.start &&
            candidate.kind === "enable" &&
            candidate.engine === directive.engine &&
            (candidate.rules.length === ZERO || candidate.rules.includes(rule))
        );
        const physicalScope =
          directive.kind === "disable"
            ? { end: enable?.start ?? source.length, start: directive.end }
            : lineScope(source, directive);
        let scope = physicalScope;
        if (FILE_METRICS.has(rule.replace(/^eslint\//u, ""))) {
          scope = { end: source.length, start: ZERO };
        } else if (
          directive.kind !== "disable" &&
          FUNCTION_METRICS.has(rule.replace(/^eslint\//u, ""))
        ) {
          scope = functionScope(source, filename, physicalScope);
        }
        scopeFingerprints[rule] = new Bun.CryptoHasher("sha256")
          .update(
            JSON.stringify([
              directive.reason,
              source.slice(scope.start, scope.end),
              occurrenceIdentity(
                cleanSource,
                scope,
                directive.kind !== "disable" && scope === physicalScope
              ),
              directive.kind === "disable" ? Boolean(enable) : "line",
            ])
          )
          .digest("hex");
      }
      return {
        directive: `${directive.engine}-${directive.kind}`,
        line: directive.line,
        reason: directive.reason,
        rules: directive.rules,
        scopeFingerprints,
      };
    });
};

// oxlint-disable-next-line eslint/max-statements -- Build counts, missing-reason debt and block scope fingerprints in one pass over actual directives.
const snapshotExceptions = (
  files: Readonly<Record<string, string>>
): {
  baseline: ExceptionBaseline;
  errors: string[];
} => {
  const scopeFingerprints: Record<string, string[]> = {};
  const counts: Record<string, number> = {};
  const missingReasons: Record<string, number> = {};
  const baseline: ExceptionBaseline = {
    counts,
    missingReasons,
    scopeFingerprints,
    version: BASELINE_VERSION,
  };
  const errors: string[] = [];
  for (const [filename, source] of Object.entries(files).toSorted(
    ([left]: readonly [string, string], [right]: readonly [string, string]) =>
      left.localeCompare(right)
  )) {
    for (const exception of readExceptions(source, filename)) {
      if (exception.rules.length === ZERO) {
        errors.push(
          `${filename}:${exception.line}: blanket ${exception.directive} is forbidden`
        );
      }
      for (const rule of new Set(exception.rules)) {
        const key = JSON.stringify([filename, rule, exception.directive]);
        counts[key] = (counts[key] ?? ZERO) + ONE;
        const fingerprint = exception.scopeFingerprints[rule];
        if (fingerprint) {
          (scopeFingerprints[key] ??= []).push(fingerprint);
        }
        if (!exception.reason) {
          missingReasons[key] = (missingReasons[key] ?? ZERO) + ONE;
        }
      }
    }
  }
  return { baseline, errors };
};

// oxlint-disable-next-line eslint/max-statements -- Compare all three independent baseline budgets together and report every violation instead of failing at the first one.
const checkExceptions = (
  files: Readonly<Record<string, string>>,
  baseline: ExceptionBaseline
): string[] => {
  const snapshot = snapshotExceptions(files);
  const { errors } = snapshot;
  for (const [key, count] of Object.entries(snapshot.baseline.counts)) {
    if (count > (baseline.counts[key] ?? ZERO)) {
      errors.push(
        `Exception count increased ${key}: ${baseline.counts[key] ?? ZERO} -> ${count}`
      );
    }
  }
  for (const [key, count] of Object.entries(snapshot.baseline.missingReasons)) {
    if (count > (baseline.missingReasons[key] ?? ZERO)) {
      errors.push(
        `Missing reason after -- ${key}: ${baseline.missingReasons[key] ?? ZERO} -> ${count}`
      );
    }
  }
  for (const [key, fingerprints] of Object.entries(
    snapshot.baseline.scopeFingerprints
  )) {
    const remaining = [...(baseline.scopeFingerprints[key] ?? [])];
    for (const fingerprint of fingerprints) {
      const index = remaining.indexOf(fingerprint);
      if (index === -ONE) {
        errors.push(
          `Exception scope or reason changed ${key}: ${fingerprint}; review and explicitly update baseline`
        );
      } else {
        remaining.splice(index, ONE);
      }
    }
  }
  return errors;
};

const isCounts = (value: unknown): value is Record<string, number> => {
  if (typeof value !== "object" || !value || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (count) =>
      typeof count === "number" && Number.isSafeInteger(count) && count >= ZERO
  );
};

const isFingerprints = (value: unknown): value is Record<string, string[]> => {
  if (typeof value !== "object" || !value || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (fingerprints) =>
      Array.isArray(fingerprints) &&
      fingerprints.every(
        (fingerprint: unknown) =>
          typeof fingerprint === "string" && /^[a-f\d]+$/u.test(fingerprint)
      )
  );
};

const parseBaseline = (text: string): ExceptionBaseline => {
  const value: unknown = JSON.parse(text);
  if (
    typeof value !== "object" ||
    !value ||
    !("version" in value) ||
    value.version !== BASELINE_VERSION ||
    !("counts" in value) ||
    !isCounts(value.counts) ||
    !("missingReasons" in value) ||
    !isCounts(value.missingReasons) ||
    !("scopeFingerprints" in value) ||
    !isFingerprints(value.scopeFingerprints)
  ) {
    throw new Error(
      "Invalid lint exception baseline; expected version 1 and nonnegative integer counts"
    );
  }
  return {
    counts: value.counts,
    missingReasons: value.missingReasons,
    scopeFingerprints: value.scopeFingerprints,
    version: BASELINE_VERSION,
  };
};

const reviewBaselineUpdate = (
  files: Readonly<Record<string, string>>,
  prior: ExceptionBaseline,
  allowNew = false
): string[] => {
  const snapshot = snapshotExceptions(files);
  const { errors } = snapshot;
  for (const [key, count] of Object.entries(snapshot.baseline.counts)) {
    if (!allowNew && count > (prior.counts[key] ?? ZERO)) {
      errors.push(
        `Baseline exception count increased ${key}; review the new exception and use --write-baseline --allow-new`
      );
    }
  }
  for (const [key, count] of Object.entries(snapshot.baseline.missingReasons)) {
    if (count > (prior.missingReasons[key] ?? ZERO)) {
      errors.push(
        `Baseline updates cannot introduce missing reasons ${key}; add a reason after --`
      );
    }
  }
  return errors;
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve main's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- The CLI inventories files, validates errors and performs explicit baseline writes in their required execution order.
const main = async (): Promise<void> => {
  // Git includes standalone and checked-in generated sources; ignored output stays excluded.
  const result = Bun.spawn(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: `${import.meta.dir}/..` }
  );
  const [exitCode, inventory, stderr] = await Promise.all([
    result.exited,
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
  ]);
  if (exitCode !== ZERO) {
    throw new Error(stderr);
  }
  const filenames = [...new Set(inventory.split("\0"))]
    .filter((filename) => /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(filename))
    .toSorted();
  const files: Record<string, string> = {};
  /* oxlint-disable eslint/no-await-in-loop -- Sequential source reads bound open files and memory during the repository-wide audit. */
  for (const filename of filenames) {
    const file = Bun.file(`${import.meta.dir}/../${filename}`);
    if (await file.exists()) {
      files[filename] = await file.text();
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
  const baselinePath = `${import.meta.dir}/lint-exceptions-baseline.json`;
  if (Bun.argv.includes("--write-baseline")) {
    const snapshot = snapshotExceptions(files);
    const savedBaseline = Bun.file(baselinePath);
    if (await savedBaseline.exists()) {
      const prior = parseBaseline(await savedBaseline.text());
      snapshot.errors.push(
        ...reviewBaselineUpdate(files, prior, Bun.argv.includes("--allow-new"))
      );
    }
    if (snapshot.errors.length > ZERO) {
      throw new Error(snapshot.errors.join("\n"));
    }
    await Bun.write(
      baselinePath,
      // oxlint-disable-next-line unicorn/no-null -- JSON.stringify requires a null replacer to request indented output without replacing values.
      `${JSON.stringify(snapshot.baseline, null, TWO)}\n`
    );
    await Bun.write(
      Bun.stdout,
      `Wrote explicit exception baseline for ${filenames.length} source files; legacy missing reasons are recorded separately.\n`
    );
    return;
  }
  const errors = checkExceptions(
    files,
    parseBaseline(await Bun.file(baselinePath).text())
  );
  if (errors.length > ZERO) {
    throw new Error(errors.join("\n"));
  }
  await Bun.write(
    Bun.stdout,
    `Lint exception budget passed (${filenames.length} source files).\n`
  );
};
/* oxlint-enable oxc/no-async-await */
if (import.meta.main) {
  // oxlint-disable-next-line node/no-top-level-await -- This Bun command awaits the exception audit and optional baseline write before exiting.
  await main();
}

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (checkExceptions, parseBaseline, readExceptions, reviewBaselineUpdate, snapshotExceptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  checkExceptions,
  parseBaseline,
  readExceptions,
  reviewBaselineUpdate,
  snapshotExceptions,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ExceptionBaseline, LintException); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ExceptionBaseline, LintException };
/* oxlint-enable import/no-named-export */

/* oxlint-disable eslint/max-lines -- This file-level EOF diagnostic counts the standalone parser, persisted-budget validation and CLI policy together. */
