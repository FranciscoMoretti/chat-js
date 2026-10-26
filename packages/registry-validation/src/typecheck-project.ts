import path from "node:path";
import ts from "typescript";
import { DependencyFiles } from "./dependency-files";
import { virtualProjectRoot } from "./project-files";
import { readVirtualDirectory } from "./typescript-files";

interface ProjectDiagnostic {
  readonly code: number;
  readonly file?: string;
  readonly line?: number;
  readonly character?: number;
  readonly message: string;
}

const diagnosticSignature = (
  diagnostic: Readonly<ts.Diagnostic>,
  root: string
): ProjectDiagnostic => {
  const position =
    diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : undefined;
  return {
    code: diagnostic.code,
    ...(diagnostic.file
      ? { file: path.posix.relative(root, diagnostic.file.fileName) }
      : {}),
    ...(position
      ? { line: position.line + 1, character: position.character + 1 }
      : {}),
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  };
};

const typecheckProject = (
  files: ReadonlyMap<string, Uint8Array>,
  fixtureDirectory: string | readonly string[]
): {
  diagnostics: ProjectDiagnostic[];
  rootFiles: string[];
  sourceFiles: number;
  dependencies: ReadonlyMap<string, string>;
} => {
  const root = virtualProjectRoot;
  for (const file of files.keys()) {
    if (
      file !== path.posix.normalize(file) ||
      path.posix.isAbsolute(file) ||
      file === ".." ||
      file.startsWith("../") ||
      file.split("/").includes("node_modules")
    ) {
      throw new Error(`Invalid generated source path: ${file}`);
    }
  }
  const text = new Map(
    [...files].map(([file, entry]) => [
      `${root}/${file}`,
      new TextDecoder().decode(entry),
    ])
  );
  const manifest = text.get(`${root}/package.json`);
  if (manifest === undefined) {
    throw new Error("Rendered project is missing package.json");
  }
  const dependencies = new DependencyFiles(manifest, fixtureDirectory, files);
  const directories = new Set([root]);
  for (const file of text.keys()) {
    let directory = path.posix.dirname(file);
    while (directory.startsWith(root)) {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  const readFile = (file: string): string | undefined =>
    text.get(file) ?? dependencies.readFile(file);
  const fileExists = (file: string): boolean =>
    text.has(file) || dependencies.fileExists(file);
  const readDirectory = readVirtualDirectory(text.keys(), root);
  const configPath = `${root}/tsconfig.json`;
  const config = ts.readConfigFile(configPath, readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config ?? {},
    { useCaseSensitiveFileNames: true, readDirectory, readFile, fileExists },
    root,
    undefined,
    configPath
  );
  const options = { ...parsed.options, noEmit: true, incremental: false };
  const host = ts.createCompilerHost(options);
  host.getCurrentDirectory = () => root;
  host.useCaseSensitiveFileNames = () => true;
  host.getCanonicalFileName = (file) => file;
  host.readFile = readFile;
  host.fileExists = fileExists;
  host.directoryExists = (directory) =>
    directories.has(directory) || dependencies.directoryExists(directory);
  host.getDirectories = (directory) => [
    ...new Set([
      ...[...directories]
        .filter((candidate) => path.posix.dirname(candidate) === directory)
        .map((candidate) => path.posix.basename(candidate)),
      ...dependencies.getDirectories(directory),
    ]),
  ];
  host.realpath = (file) => dependencies.realpath(file);
  host.readDirectory = readDirectory;
  host.getDefaultLibLocation = () =>
    path.posix.dirname(dependencies.compilerLibrary());
  host.getDefaultLibFileName = () =>
    dependencies
      .compilerLibrary()
      .replace("lib.d.ts", ts.getDefaultLibFileName(options));
  host.getSourceFile = (file, languageVersion) => {
    const source = readFile(file);
    return source === undefined
      ? undefined
      : ts.createSourceFile(file, source, languageVersion, true);
  };
  host.writeFile = () => {
    throw new Error("In-memory validation must not emit files.");
  };
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options,
    host,
    projectReferences: parsed.projectReferences,
  });
  const diagnostics = [
    ...(config.error ? [config.error] : []),
    ...parsed.errors,
    ...ts.getPreEmitDiagnostics(program),
  ].map((diagnostic) => diagnosticSignature(diagnostic, root));
  return {
    diagnostics,
    rootFiles: parsed.fileNames.map((file) => path.posix.relative(root, file)),
    sourceFiles: program.getSourceFiles().length,
    dependencies: dependencies.versions,
  };
};

export { typecheckProject };
