import ts from "typescript";

const COMMENT_DELIMITER_LENGTH = 2;
const JSON_INDENT_SPACES = 2;
const SUCCESS_EXIT_CODE = 0;
const REASON_SEPARATOR = "--";
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

// Preserve native compiler members while reading the recursive parent graph.
interface CompilerNodeReader extends Readonly<Omit<ts.Node, "parent">> {
  readonly parent: CompilerNodeReader;
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
  const visit = (node: CompilerNodeReader): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isRegularExpressionLiteral(node) ||
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail ||
      ts.isJsxText(node)
    ) {
      // oxlint-disable-next-line no-magic-numbers -- Advance exactly one UTF-16 code unit while preserving every original source offset.
      for (let index = node.getStart(tree); index < node.end; index += 1) {
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

interface SourceComment {
  readonly start: number;
  readonly end: number;
  readonly multiline: boolean;
}

// Discover real comment spans without interpreting their directive bodies.
const readComments = (source: string, filename: string): SourceComment[] => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    maskLiterals(source, filename)
  );
  const comments: SourceComment[] = [];
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
      comments.push({
        end,
        multiline: token === ts.SyntaxKind.MultiLineCommentTrivia,
        start,
      });
    }
  }
  return comments;
};

const readDirectives = (source: string, filename: string): CommentDirective[] =>
  readComments(source, filename).flatMap(({ start, end, multiline }) => {
    /* oxlint-disable no-magic-numbers -- Single-line comments have no closing-delimiter adjustment; subtract zero while preserving the end position. */
    const comment = source.slice(
      start + COMMENT_DELIMITER_LENGTH,
      // oxlint-disable-next-line no-ternary -- Keep - operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      end - (multiline ? COMMENT_DELIMITER_LENGTH : 0)
    );
    /* oxlint-enable no-magic-numbers */
    const match =
      /^\s*(?<engine>eslint|oxlint)-(?<kind>disable(?:-next-line|-line)?|enable)\b(?<body>[\s\S]*)$/u.exec(
        comment
      );
    if (!match) {
      return [];
    }
    if (!match.groups) {
      return [];
    }
    const { engine = "", kind = "", body = "" } = match.groups;
    /* oxlint-disable no-magic-numbers -- Directive positions use a zero-based prefix; indexOf returns -1 when the reason separator is absent. */
    const separator = body.indexOf(REASON_SEPARATOR);
    return [
      {
        end,
        engine,
        kind,
        line: source.slice(0, start).split("\n").length,
        reason:
          // oxlint-disable-next-line no-ternary -- Keep reason as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          separator === -1
            ? ""
            : body
                .slice(separator + REASON_SEPARATOR.length)
                .replaceAll(/^\s*\*\s?/gmu, "")
                .trim(),
        // oxlint-disable-next-line no-ternary -- Keep trim receiver as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        rules: (separator === -1 ? body : body.slice(0, separator))
          .trim()
          .split(/[\s,]+/u)
          .filter(Boolean),
        start,
      },
    ];
    /* oxlint-enable no-magic-numbers */
  });

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
    // oxlint-disable-next-line no-magic-numbers -- Advance exactly one UTF-16 code unit while preserving every original source offset.
    for (let index = directive.start; index < directive.end; index += 1) {
      if (characters[index] !== "\n" && characters[index] !== "\r") {
        characters[index] = " ";
      }
    }
  }
  return characters.join("");
};

// Compiler-owned nodes retain their identity; only source positions are collected.
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
  const visit = (node: CompilerNodeReader): void => {
    if (ts.isFunctionLike(node) && "body" in node && node.body) {
      const declaration =
        // oxlint-disable-next-line no-ternary -- Keep declaration as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  /* oxlint-disable no-magic-numbers -- Read the zero-based first candidate with at(0), which preserves the possibly absent result required by the guard. */
  const first = startingHere
    .toSorted((left, right) => left.start - right.start)
    .at(0);
  /* oxlint-enable no-magic-numbers */
  if (first) {
    return {
      end: Math.max(...startingHere.map((scope) => scope.end)),
      start: first.start,
    };
  }
  const [smallest] = scopes.toSorted(
    (left, right) => left.end - left.start - (right.end - right.start)
  );
  return smallest ?? target;
};

const lineScope = (
  source: string,
  directive: CommentDirective
): SourceScope => {
  /* oxlint-disable no-magic-numbers -- Source indices start at zero; add one to skip a newline, and indexOf returns -1 when no newline exists. */

  const start =
    // oxlint-disable-next-line no-ternary -- Keep start as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    directive.kind === "disable-next-line"
      ? source.indexOf("\n", directive.end) + 1
      : source.lastIndexOf("\n", directive.start) + 1;
  const finalLineStart =
    // oxlint-disable-next-line no-ternary -- Keep finalLineStart as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    directive.kind === "disable-next-line" ? start : directive.end;
  const newline = source.indexOf("\n", finalLineStart);
  return {
    // oxlint-disable-next-line no-ternary -- Keep end as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    end: newline === -1 ? source.length : newline,
    start:
      // oxlint-disable-next-line no-ternary -- Keep start as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      start === 0 && directive.kind === "disable-next-line"
        ? source.length
        : start,
  };

  /* oxlint-enable no-magic-numbers */
};

const normalizeScope = (value: string): string =>
  value.replaceAll(/\s+/gu, " ").trim();

const occurrenceIdentity = (
  cleanSource: string,
  scope: SourceScope,
  line: boolean
): number => {
  /* oxlint-disable no-magic-numbers -- Occurrence ordinals begin at zero; the prefix begins at index zero and splitting repeated text creates one extra initial segment. */

  const covered = cleanSource.slice(scope.start, scope.end).trim();
  if (!covered) {
    return 0;
  }
  const prefix = cleanSource.slice(0, scope.start);
  if (line && !covered.includes("\n")) {
    return prefix
      .split("\n")
      .filter((candidate) => candidate.trim() === covered).length;
  }
  // Compare repeated covered regions after removing directives and normalizing
  // whitespace; ordinary inserted lines do not change the occurrence ordinal.
  return normalizeScope(prefix).split(normalizeScope(covered)).length - 1;

  /* oxlint-enable no-magic-numbers */
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
            // oxlint-disable-next-line no-magic-numbers -- An enable directive with zero named rules closes every rule from the same engine.
            (candidate.rules.length === 0 || candidate.rules.includes(rule))
        );
        const physicalScope =
          // oxlint-disable-next-line no-ternary -- Keep physicalScope as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          directive.kind === "disable"
            ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading start from enable; preserve one receiver evaluation, skipped accesses and the existing source.length fallback.
              { end: enable?.start ?? source.length, start: directive.end }
            : lineScope(source, directive);
        let scope = physicalScope;
        if (FILE_METRICS.has(rule.replace(/^eslint\//u, ""))) {
          scope = { end: source.length, start: 0 };
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
              // oxlint-disable-next-line no-ternary -- Keep ArrayLiteralExpression as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    /* oxlint-disable no-magic-numbers -- An empty rule list has length zero; missing counters start at zero and each membership or missing reason adds one. */
    for (const exception of readExceptions(source, filename)) {
      if (exception.rules.length === 0) {
        errors.push(
          `${filename}:${exception.line}: blanket ${exception.directive} is forbidden`
        );
      }
      for (const rule of new Set(exception.rules)) {
        const key = JSON.stringify([filename, rule, exception.directive]);
        counts[key] = (counts[key] ?? 0) + 1;
        const fingerprint = exception.scopeFingerprints[rule];
        if (fingerprint) {
          (scopeFingerprints[key] ??= []).push(fingerprint);
        }
        if (!exception.reason) {
          missingReasons[key] = (missingReasons[key] ?? 0) + 1;
        }
      }
    }
    /* oxlint-enable no-magic-numbers */
  }
  return { baseline, errors };
};

// Compare scope fingerprints as a multiset, consuming each prior occurrence once.
const compareFingerprintBudget = (
  current: ExceptionBaseline,
  prior: ExceptionBaseline
): string[] => {
  const errors: string[] = [];
  /* oxlint-disable no-magic-numbers -- indexOf returns -1 for an unknown fingerprint; splice removes exactly one matched prior occurrence. */
  for (const [key, fingerprints] of Object.entries(current.scopeFingerprints)) {
    const remaining = [...(prior.scopeFingerprints[key] ?? [])];
    for (const fingerprint of fingerprints) {
      const index = remaining.indexOf(fingerprint);
      if (index === -1) {
        errors.push(
          `Exception scope or reason changed ${key}: ${fingerprint}; review and explicitly update baseline`
        );
      } else {
        remaining.splice(index, 1);
      }
    }
  }
  /* oxlint-enable no-magic-numbers */
  return errors;
};

const checkExceptions = (
  files: Readonly<Record<string, string>>,
  baseline: ExceptionBaseline
): string[] => {
  const { baseline: current, errors } = snapshotExceptions(files);
  /* oxlint-disable no-magic-numbers -- Absent prior budget counts mean zero; compare and report the same nonnegative default. */
  for (const [key, count] of Object.entries(current.counts)) {
    if (count > (baseline.counts[key] ?? 0)) {
      errors.push(
        `Exception count increased ${key}: ${baseline.counts[key] ?? 0} -> ${count}`
      );
    }
  }
  /* oxlint-enable no-magic-numbers */
  /* oxlint-disable no-magic-numbers -- Absent prior budget counts mean zero; compare and report the same nonnegative default. */
  for (const [key, count] of Object.entries(current.missingReasons)) {
    if (count > (baseline.missingReasons[key] ?? 0)) {
      errors.push(
        `Missing reason after -- ${key}: ${baseline.missingReasons[key] ?? 0} -> ${count}`
      );
    }
  }
  /* oxlint-enable no-magic-numbers */
  for (const error of compareFingerprintBudget(current, baseline)) {
    errors.push(error);
  }
  return errors;
};

const isCounts = (value: unknown): value is Record<string, number> => {
  if (typeof value !== "object" || !value || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (count) =>
      // oxlint-disable-next-line no-magic-numbers -- Persisted budget counters must be nonnegative integers; zero is valid.
      typeof count === "number" && Number.isSafeInteger(count) && count >= 0
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
  /* oxlint-disable no-magic-numbers -- Absent prior budget counts mean zero; compare and report the same nonnegative default. */
  for (const [key, count] of Object.entries(snapshot.baseline.counts)) {
    if (!allowNew && count > (prior.counts[key] ?? 0)) {
      errors.push(
        `Baseline exception count increased ${key}; review the new exception and use --write-baseline --allow-new`
      );
    }
  }
  /* oxlint-enable no-magic-numbers */
  /* oxlint-disable no-magic-numbers -- Absent prior budget counts mean zero; compare and report the same nonnegative default. */
  for (const [key, count] of Object.entries(snapshot.baseline.missingReasons)) {
    if (count > (prior.missingReasons[key] ?? 0)) {
      errors.push(
        `Baseline updates cannot introduce missing reasons ${key}; add a reason after --`
      );
    }
  }
  /* oxlint-enable no-magic-numbers */
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
  if (exitCode !== SUCCESS_EXIT_CODE) {
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
    // oxlint-disable-next-line no-magic-numbers -- Any positive number of accumulated violations prevents a successful audit or baseline write.
    if (snapshot.errors.length > 0) {
      throw new Error(snapshot.errors.join("\n"));
    }
    await Bun.write(
      baselinePath,
      // oxlint-disable-next-line unicorn/no-null -- Pass null as the no-op replacer while applying indentation without changing values.
      `${JSON.stringify(snapshot.baseline, null, JSON_INDENT_SPACES)}\n`
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
  // oxlint-disable-next-line no-magic-numbers -- Any positive number of accumulated violations prevents a successful audit or baseline write.
  if (errors.length > 0) {
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
