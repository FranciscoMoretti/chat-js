import { createRoot } from "react-dom/client";

import {
  EveDeleteDialogView,
  type EveDeletionPhase,
} from "../components/eve/eve-delete-dialog";

const phases: EveDeletionPhase[] = [
  "confirm",
  "deleting",
  "pending",
  "unconfirmed",
  "checking",
  "unavailable",
  "not_started",
];
const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(
  phases.map((phase) => (
    <EveDeleteDialogView
      key={phase}
      onCheck={() => undefined}
      onClose={() => undefined}
      onDelete={() => undefined}
      phase={phase}
      title={`Example conversation — ${phase}`}
    />
  ))
);
