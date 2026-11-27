import { expect, test } from "bun:test";

import { collectEnvChecklist, formatEnvChecklist } from "./env-checklist";

const unselectedFeatures = {
  attachments: false,
  followupSuggestions: false,
  feedback: false,
  mcp: false,
  projects: false,
  parallelResponses: false,
} as const;

test("preserves auth insertion order and skips unused requirement-description getters", () => {
  const reads: string[] = [];
  const entries = collectEnvChecklist({
    auth: {
      get github(): boolean {
        reads.push("github");
        return true;
      },
      get google(): boolean {
        reads.push("google");
        return true;
      },
      get vercel(): boolean {
        reads.push("vercel");
        return true;
      },
    },
    coreFeatures: unselectedFeatures,
    gateway: "vercel",
    gatewayRequirements: [],
    installableToolEnvRequirements: [
      {
        get description(): string {
          throw new Error(
            "A single credential set does not need an alternative label."
          );
        },
        options: [["CUSTOM_TOKEN"]],
      },
    ],
  });
  expect(reads).toEqual(["github", "google", "vercel"]);
  const output = formatEnvChecklist(entries);
  const signIn = output.split("  Sign-in\n").at(1)?.split("\n\n").at(0);
  expect(signIn).toBe(
    [
      "    AUTH_GITHUB_ID",
      "    AUTH_GITHUB_SECRET",
      "    AUTH_GOOGLE_ID",
      "    AUTH_GOOGLE_SECRET",
      "    VERCEL_APP_CLIENT_ID",
      "    VERCEL_APP_CLIENT_SECRET",
    ].join("\n")
  );
  expect(output).toContain("  Selected plugins and tools\n    CUSTOM_TOKEN");
});
