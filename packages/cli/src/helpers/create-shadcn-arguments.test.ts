import { expect, test } from "bun:test";
import { Command } from "commander";
import {
  assertCreateShadcnReady,
  createShadcnArguments,
} from "./create-shadcn-arguments";

const parseArguments = (args: readonly string[], nested = true) => {
  const command = new Command("create")
    .argument("[directory]")
    .argument("[shadcn-options...]")
    .option("--yes")
    .exitOverride();
  if (nested) {
    new Command().addCommand(command).parse(["create", ...args], {
      from: "user",
    });
  } else {
    command.parse([...args], { from: "user" });
  }
  return createShadcnArguments(command);
};

test.each([false, true])(
  "preserves the native argument vector without a theme parser (nested: %s)",
  (nested) => {
    const native = [
      "--preset",
      "a preset value",
      "--preset=another-value",
      "--base",
      "base",
      "--no-css-variables",
      "--css-variables",
      "--no-rtl",
      "--pointer",
      "--future-native-option",
    ];
    expect(
      parseArguments(["my-chat", "--yes", "--", ...native], nested)
    ).toEqual({ target: "my-chat", shadcnArgs: native });
    expect(parseArguments(["--yes", "--", ...native], nested)).toEqual({
      target: undefined,
      shadcnArgs: native,
    });
  }
);

test("normal create stays unchanged and extra operands need an explicit boundary", () => {
  expect(parseArguments(["my-chat", "--yes"])).toEqual({
    target: "my-chat",
    shadcnArgs: [],
  });
  expect(() => {
    assertCreateShadcnReady([]);
  }).not.toThrow();
  expect(() => {
    assertCreateShadcnReady([], "source");
  }).not.toThrow();
  expect(() => parseArguments(["my-chat", "extra"])).toThrow("one directory");
  expect(() => parseArguments(["my-chat", "--preset", "rhea"])).toThrow(
    "unknown option"
  );
});

test.each([
  "--cwd",
  "--cwd=elsewhere",
  "-celsewhere",
  "-ycelsewhere",
  "--name=elsewhere",
  "-nelsewhere",
  "--template=vite",
  "-tvite",
  "--monorepo",
  "--no-monorepo",
  "--force",
  "-f",
  "--reinstall",
  "--no-reinstall",
  "--defaults",
  "-d",
  "--help",
  "-h",
])("rejects native topology/lifecycle option %s", (option) => {
  expect(() => {
    assertCreateShadcnReady([option]);
  }).toThrow("ChatJS owns the target directory");
});

test("never interprets native preset codes as lifecycle switches", () => {
  expect(() => {
    assertCreateShadcnReady(["-pb27I2r8C"]);
  }).not.toThrow();
});

test("preserves from-git before considering native initialization", () => {
  expect(() => {
    assertCreateShadcnReady(["--preset", "rhea"], "source");
  }).toThrow("--from-git preserves");
});

test.each([
  { args: ["--base", "aria"] },
  { args: ["--base=aria"] },
  { args: ["-baria"] },
  { args: ["-ybaria"] },
])("rejects unsupported library before scaffolding: $args", ({ args }) => {
  expect(() => {
    assertCreateShadcnReady(args);
  }).toThrow("supports Base UI and Radix");
});
test("forwards native options without an allowlist", () => {
  expect(() => {
    assertCreateShadcnReady([
      "--base",
      "base",
      "--preset",
      "b27I2r8C",
      "--no-pointer",
      "--future-option",
    ]);
  }).not.toThrow();
});

test("library compatibility follows native last-option precedence", () => {
  expect(() => {
    assertCreateShadcnReady(["--base", "radix", "--base=base"]);
  }).not.toThrow();
  expect(() => {
    assertCreateShadcnReady(["--base", "base", "--base=aria"]);
  }).toThrow("supports Base UI and Radix");
});

test.each([
  { args: ["--base", "radix"] },
  { args: ["--base=radix"] },
  { args: ["-bradix"] },
  { args: ["-ybradix"] },
])("forwards native Radix selection %j", ({ args }) => {
  expect(() => {
    assertCreateShadcnReady(args);
  }).not.toThrow();
});
