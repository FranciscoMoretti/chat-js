import { renderRoot, unmountRoot } from "./primitive-mount";
import { takeSnapshot } from "@uiverify/vitest";
import React, { act, useId } from "react";
import { createRoot } from "react-dom/client";
import { Controller, useForm } from "react-hook-form";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ToolOutput } from "@/components/part/tool-data";
import { SidebarProjectItem } from "@/plugins/projects/ui/sidebar-project-item";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";
import type { Project } from "@/plugins/projects/db/project-schema";
import { DiffView } from "@/tools/chatjs/text-documents/diffview";

import "./sandbox.css";

const noop = (): void => {
  /* Capture callbacks do not persist fixture state. */
};
const renameProject = vi.fn().mockResolvedValue({});
vi.mock("@/plugins/projects/use-projects", () => ({
  useRenameProject: () => ({ isPending: false, mutateAsync: renameProject }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: noop }),
}));

const FixtureForm = ({
  invalid,
}: {
  readonly invalid: boolean;
}): React.JSX.Element => {
  const form = useForm({
    defaultValues: { name: "Project name" },
    errors: invalid
      ? { name: { message: "Name is required", type: "required" } }
      : {},
  });
  const id = useId();
  return (
    <Controller
      control={form.control}
      name="name"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>Name</FieldLabel>
          <Input
            {...field}
            id={id}
            aria-invalid={fieldState.invalid}
            aria-describedby={`${id}-description ${id}-error`}
          />
          <FieldDescription id={`${id}-description`}>
            Project display name
          </FieldDescription>
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
};

// The inactive deletion dialog is outside this rename/fallback capture.
vi.mock(
  "@/plugins/projects/ui/delete-project-dialog",
  (): { DeleteProjectDialog: () => null } => ({
    DeleteProjectDialog: (): null => null,
  })
);

const project: Project = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  icon: "book",
  iconColor: "blue",
  id: "project",
  instructions: "",
  name: "Installed project",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  userId: "fixture",
};
const removedProject: Project = {
  ...project,
  icon: "removed",
  iconColor: "removed",
  id: "removed",
  name: "Retired project metadata",
};

test("form contexts, output narrowing, project fallback, and Lexical diff preserve their visible states", async (): Promise<void> => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;width:1000px;display:grid;grid-template-columns:1fr 1fr;gap:16px;background:white;color:black";
  document.body.append(container);
  const root = createRoot(container);

  await renderRoot(
    root,
    <>
      <FixtureForm invalid={false} />
      <FixtureForm invalid />
      <ToolOutput output={{ accepted: true }} errorText={undefined} />
      <ToolOutput output="" errorText={undefined} />
      <ToolOutput output={42} errorText={undefined} />
      <ToolOutput
        output={<strong>Custom element</strong>}
        errorText={undefined}
      />
      <ToolOutput output={null} errorText="Provider failure" />
      <ToolOutput output={7n} errorText={undefined} />
      <SidebarProvider className="min-h-0">
        <SidebarMenu>
          <SidebarProjectItem project={project} isActive setOpenMobile={noop} />
          <SidebarProjectItem
            project={removedProject}
            isActive={false}
            setOpenMobile={noop}
          />
        </SidebarMenu>
      </SidebarProvider>
      <DiffView oldContent="Original words" newContent="Revised words" />
    </>
  );
  await expect.poll(() => container.textContent).toContain("Revised");
  expect(container.textContent).toContain("Name is required");
  expect(container.textContent).toContain("Custom element");
  expect(container.querySelector('[aria-invalid="true"]')).toBeTruthy();
  expect(container.querySelectorAll("label")).toHaveLength(2);
  for (const label of container.querySelectorAll("label")) {
    expect(label.control?.getAttribute("name")).toBe("name");
    expect(label.control?.getAttribute("aria-describedby")).toContain(
      `${label.htmlFor}-description`
    );
  }
  await takeSnapshot("assertion-contract-visible-states");
  await act(async () => {
    await page.getByRole("button", { name: "More" }).nth(1).click();
  });
  await act(async () => {
    await page.getByText("Rename", { exact: true }).click();
  });
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await takeSnapshot("retired-project-metadata-editor-fallback");

  await unmountRoot(root);
  container.remove();
});
