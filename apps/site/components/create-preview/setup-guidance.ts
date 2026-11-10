// Presentation routing for the canonical installation resolver's messages.
// This does not validate selections or change the CLI installation contract.
export type SetupDestination =
  | "gateway"
  | "storage"
  | "sandbox"
  | "tools"
  | "plugins";
export type ConfigureSetup = (destination?: SetupDestination) => void;

export const setupAction = (issue: string) => {
  if (/sandbox/iu.test(issue)) {
    return { destination: "sandbox", label: "Choose a sandbox" } as const;
  }
  if (/storage|public configuration/iu.test(issue)) {
    return { destination: "storage", label: "Configure storage" } as const;
  }
  if (/gateway/iu.test(issue)) {
    return { destination: "gateway", label: "Choose a gateway" } as const;
  }
  if (/plugin/iu.test(issue)) {
    return { destination: "plugins", label: "Review plugins" } as const;
  }
  return { destination: "tools", label: "Review tools" } as const;
};

export const setupActions = (issues: readonly string[]) => [
  ...new Map(
    issues.map((issue) => {
      const action = setupAction(issue);
      return [action.destination, action];
    })
  ).values(),
];
