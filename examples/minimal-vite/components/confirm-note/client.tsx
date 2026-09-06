import { noteOutput } from "../../lib/note-contract";
import { toolRenderer } from "../../lib/tool-renderer";
export const ConfirmNote = toolRenderer(noteOutput, () => import("./renderer"));
