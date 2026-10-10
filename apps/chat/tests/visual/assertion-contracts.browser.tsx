/* oxlint-disable react/jsx-no-literals -- This visual fixture uses fixed authored labels and content to verify visible contract states. */
/* oxlint-disable react/forbid-component-props -- The fixture controls SidebarProvider geometry to fit its capture; className is that primitive's supported prop. */
/* oxlint-disable oxc/no-rest-spread-properties -- The retired fixture preserves the original project own fields while overriding its saved metadata. */
/* oxlint-disable oxc/no-async-await -- Browser interactions and snapshots must settle in their authored order. */
/* oxlint-disable import/max-dependencies -- This browser contract capture composes the affected application components with their real styles and providers. */
/* oxlint-disable react/only-export-components -- Vitest browser fixtures are test entry points, not Fast Refresh modules. */
/* oxlint-disable react/jsx-props-no-spreading, react/jsx-max-depth, react-perf/jsx-no-new-function-as-prop -- Exercise React Hook Form's native render callback, mutable controller fields, and required nested provider structure. */
/* oxlint-disable eslint/max-statements, eslint/no-magic-numbers, no-undefined, unicorn/no-null, react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-jsx-as-prop -- The finite fixture matrix covers JSON, React nodes, absent output, and persisted metadata plus an ordered dialog interaction. */
/* oxlint-disable sort-imports -- Preserve runtime import evaluation order and pinned Oxfmt type/binding grouping; native alphabetical ordering conflicts with that grouping. */
import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import type { ControllerRenderProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { ToolOutput } from "@/components/ai-elements/tool";
import { SidebarProjectItem } from "@/components/sidebar-project-item";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";
import type { Project } from "@/lib/db/schema";
import { DiffView } from "@/tools/chatjs/text-documents/diffview";

import "./sandbox.css";
/* oxlint-enable sort-imports */

const noop = (): void => {
  /* Capture callbacks do not persist fixture state. */
};
const renameProject = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/use-projects", () => ({
  // oxlint-disable-next-line typescript/explicit-function-return-type -- Infer the hook mock from the typed Vitest mutation.
  useRenameProject: () => ({ isPending: false, mutateAsync: renameProject }),
}));
vi.mock("next/navigation", () => ({
  // oxlint-disable-next-line typescript/explicit-function-return-type -- The mocked router exposes only the callback consumed by this capture.
  useRouter: () => ({ push: noop }),
}));

const FixtureForm = ({
  invalid,
}: {
  readonly invalid: boolean;
}): React.JSX.Element => {
  const form = useForm({
    defaultValues: { name: "Project name" },
    // oxlint-disable-next-line no-ternary -- Keep the fixture error map as the original lazy branch; prefer-ternary rejects if/else replacement.
    errors: invalid
      ? { name: { message: "Name is required", type: "required" } }
      : {},
  });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({
          field,
        }: Readonly<{
          field: Readonly<ControllerRenderProps<{ name: string }, "name">>;
        }>) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormDescription>Project display name</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
};

// The inactive deletion dialog is outside this rename/fallback capture.
vi.mock(
  "@/components/delete-project-dialog",
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React's synchronous act overload is typed void but must be awaited to settle the render.
  await act((): void =>
    root.render(
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
            <SidebarProjectItem
              project={project}
              isActive
              setOpenMobile={noop}
            />
            <SidebarProjectItem
              project={removedProject}
              isActive={false}
              setOpenMobile={noop}
            />
          </SidebarMenu>
        </SidebarProvider>
        <DiffView oldContent="Original words" newContent="Revised words" />
      </>
    )
  );
  await expect.poll(() => container.textContent).toContain("Revised");
  expect(container.textContent).toContain("Name is required");
  expect(container.textContent).toContain("Custom element");
  expect(container.querySelector('[aria-invalid="true"]')).toBeTruthy();
  await takeSnapshot("assertion-contract-visible-states");
  await page.getByRole("button", { name: "More" }).nth(1).click();
  await page.getByText("Rename", { exact: true }).click();
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await takeSnapshot("retired-project-metadata-editor-fallback");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must settle cleanup before another capture runs.
  await act((): void => root.unmount());
  container.remove();
});
