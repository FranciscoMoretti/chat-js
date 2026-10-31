import { beforeEach, expect, it, vi } from "vitest";
import {
  documentAssistantActions,
  documentAssistantRequest,
} from "./document-assistant-actions";

const kinds = vi.hoisted(() => new Set(["diagram"]));
vi.mock("@/integrations/documents/ui", () => ({
  documents: {
    diagram: {
      assistantActions: () => [
        {
          instruction: "Improve the diagram.",
          label: "Improve",
          modelId: "diagram-model",
        },
      ],
    },
  },
}));
vi.mock("@/integrations/tools/catalog", () => ({
  installedDocumentKinds: kinds,
}));
beforeEach(() => {
  kinds.clear();
  kinds.add("diagram");
});

it("hides actions when their definition is absent and restores them on reinstall", () => {
  expect(documentAssistantActions("diagram")).toHaveLength(1);
  kinds.delete("diagram");
  expect(documentAssistantActions("diagram")).toEqual([]);
  expect(documentAssistantActions("unknown")).toEqual([]);
  kinds.add("diagram");
  expect(documentAssistantActions("diagram")).toHaveLength(1);
});
it("returns bundle actions without taking ownership of their policy", () => {
  const actions = documentAssistantActions("diagram");
  expect(
    documentAssistantRequest(actions[0], "document-id", "revision-id")
  ).toEqual({
    message:
      "Improve the diagram.\n\nTarget document: document-id. Selected revision: revision-id. Use readDocument to read this document, then use the document tools to apply the requested changes.",
    modelId: "diagram-model",
  });
  actions[0].label = "App label";
  expect(documentAssistantActions("diagram")[0].label).toBe("Improve");
});
