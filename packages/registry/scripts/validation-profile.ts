import { cpus, platform, arch } from "node:os";
import ts from "typescript";
import { combinationCases } from "./installation-cases";
import {
  validationDependencyFixtures,
  prepareValidationCore,
  renderValidationProject,
} from "./validation-project";
import { typecheckProject } from "@chat-js/registry-validation";
import { demoInstallation } from "../installation";

const interaction = combinationCases.find((scenario) =>
  scenario.name.startsWith("shared ")
);
if (!interaction) {
  throw new Error("No shared contribution scenario to profile");
}
const cases = [
  {
    name: "minimal openai",
    selection: {
      gateway: "openai",
      storage: { source: "memory", options: {} },
      plugins: [],
      tools: [],
    },
  },
  interaction,
  { name: "full feature preset", selection: demoInstallation },
];
const started = performance.now();
const core = await prepareValidationCore();
const preparationMs = performance.now() - started;
const samples: {
  name: string;
  renderMs: number;
  checkMs: number;
  files: number;
  phases: Record<string, number>;
}[] = [];
for (let round = 0; round < 3; round += 1) {
  for (const scenario of [...cases.slice(round), ...cases.slice(0, round)]) {
    const before = performance.now();
    // oxlint-disable-next-line no-await-in-loop -- Profile serially so other scenarios do not distort timings.
    const project = await renderValidationProject(core, scenario.selection);
    const rendered = performance.now();
    const check = typecheckProject(project.files, validationDependencyFixtures);
    const checked = performance.now();
    if (check.diagnostics.length > 0) {
      throw new Error(JSON.stringify(check.diagnostics));
    }
    samples.push({
      name: scenario.name,
      renderMs: rendered - before,
      checkMs: checked - rendered,
      files: project.files.size,
      phases: project.timings,
    });
  }
}
const median = (values: readonly number[]): number =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const summaries = cases.map(({ name }) => {
  const selected = samples.filter((sample) => sample.name === name);
  const renderMs = median(selected.map((sample) => sample.renderMs));
  const checkMs = median(selected.map((sample) => sample.checkMs));
  return {
    name,
    renderMs,
    checkMs,
    renderingPercent: (100 * renderMs) / (renderMs + checkMs),
    phases: Object.fromEntries(
      Object.keys(selected[0].phases).map((phase) => [
        phase,
        median(selected.map((sample) => sample.phases[phase])),
      ])
    ),
  };
});
console.log(
  JSON.stringify(
    {
      environment: {
        bun: Bun.version,
        nodeCompatibility: process.version,
        typescript: ts.version,
        platform: platform(),
        arch: arch(),
        cpu: cpus()[0]?.model,
      },
      preparationMs,
      materialRenderingPercent: 20,
      summaries,
      samples,
    },
    null,
    2
  )
);
