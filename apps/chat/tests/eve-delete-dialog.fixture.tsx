import { createRoot } from "react-dom/client";

import { EveDeleteDialogView } from "../components/eve/eve-delete-dialog";
import type { EveDeletionPhase } from "../components/eve/eve-delete-dialog";

const phases: EveDeletionPhase[] = [
  "confirm",
  "deleting",
  "pending",
  "unconfirmed",
  "checking",
  "unavailable",
  "not_started",
];
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(
  phases.map((phase) => (
    <EveDeleteDialogView
      key={phase}
      onCheck={() => {
        /* empty */
      }}
      onClose={() => {
        /* empty */
      }}
      onDelete={() => {
        /* empty */
      }}
      phase={phase}
      title={`Example conversation — ${phase}`}
    />
  ))
);
