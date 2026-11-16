import { expect, test } from "bun:test";
import {
  encodeAppPreset,
  decodeAppPreset,
  readInstallationInput,
} from "../app-preset";
import { installationSelectionSchema } from "../installation";

test("complete agent configuration round trips Unicode, skills and public provider options", () => {
  const selection = installationSelectionSchema.parse({
    gateway: "vercel",
    tools: ["word-count", "@custom/tool"],
    storage: { source: "s3", options: { bucket: "team’s files" } },
    eve: ["@skills/vercel-labs/agent-skills/vercel-react-best-practices"],
    agent: {
      model: "provider/model",
      disabledDefaultTools: ["tool/bash"],
    },
  });
  expect(decodeAppPreset(encodeAppPreset(selection))).toEqual(selection);
  expect(readInstallationInput(JSON.stringify(selection))).toEqual(selection);
});

test("rejects an invalid default tool ID or an install in a disabled tool slot", () => {
  expect(() =>
    installationSelectionSchema.parse({
      agent: { disabledDefaultTools: ["tool/../../agent"] },
    })
  ).toThrow();
  expect(() =>
    installationSelectionSchema.parse({
      agent: { disabledDefaultTools: ["tool/bash"] },
      eve: ["tool/bash"],
    })
  ).toThrow("Remove the disable override before installing tool/bash.");
});

test("obsolete presets and invalid authored configuration fail instead of losing choices", () => {
  for (const input of ["a9p", "agent2_abc", "agent1_!", "agent1_e30="]) {
    expect(() => decodeAppPreset(input)).toThrow();
  }
  expect(() =>
    installationSelectionSchema.parse({ agent: { apiKey: "secret" } })
  ).toThrow();
  for (const field of ["instructions", "skills", "specialists"]) {
    expect(() =>
      installationSelectionSchema.parse({ agent: { [field]: [] } })
    ).toThrow();
  }
});
