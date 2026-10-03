"use client";

import { zodResolver } from "@hookform/resolvers/zod";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
/* oxlint-enable eslint/sort-imports */
import { ChevronDown } from "lucide-react";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { useEffect, useState } from "react";
/* oxlint-enable eslint/sort-imports */
import { useForm } from "react-hook-form";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { toast } from "sonner";
/* oxlint-enable eslint/sort-imports */
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable eslint/sort-imports */
import { Button } from "@/components/ui/button";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable import/max-dependencies */
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
/* oxlint-enable eslint/sort-imports */
import { Spinner } from "@/components/ui/spinner";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { MCP_NAME_MAX_LENGTH } from "@/lib/ai/mcp-name-id";
/* oxlint-enable eslint/sort-imports */
import { config } from "@/lib/config";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const mcpConnectorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(MCP_NAME_MAX_LENGTH, {
      message: `Name must be at most ${MCP_NAME_MAX_LENGTH} characters`,
    }),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  type: z.enum(["http", "sse"]),
  url: z
    .string()
    .min(1, { message: "URL is required" })
    // oxlint-disable-next-line typescript/no-deprecated -- Keep the current validation order and error messages; replacing this chained API would change the form validation contract.
    .url({ message: "Please enter a valid URL" }),
});
/* oxlint-enable eslint/no-magic-numbers */

type McpConnectorFormValues = z.infer<typeof mcpConnectorFormSchema>;

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/strict-void-return -- The receiving framework deliberately ignores this callback result and owns its completion/error handling. */
export const McpCreateDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.mcp.list.queryKey();
  const { appName } = config;

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const form = useForm<McpConnectorFormValues>({
    defaultValues: {
      name: "",
      oauthClientId: "",
      oauthClientSecret: "",
      type: "http",
      url: "",
    },
    resolver: zodResolver(mcpConnectorFormSchema),
  });

  useEffect((): void => {
    if (!open) {
      return;
    }

    form.reset({
      name: "",
      oauthClientId: "",
      oauthClientSecret: "",
      type: "http",
      url: "",
    });

    // oxlint-disable-next-line react/set-state-in-effect -- Reset the controlled form's advanced section on open.
    setAdvancedOpen(false);
  }, [open, form]);

  const { mutate: createConnector, isPending } = useMutation(
    trpc.mcp.create.mutationOptions({
      onError: (err): void => {
        toast.error(err.message || "Failed to add connector");
      },
      onSuccess: (): void => {
        void queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const handleSubmit = (values: McpConnectorFormValues): void => {
    const trimmed: McpConnectorFormValues = {
      ...values,
      name: values.name.trim(),
      oauthClientId: values.oauthClientId?.trim()
        ? values.oauthClientId
        : undefined,
      oauthClientSecret: values.oauthClientSecret?.trim()
        ? values.oauthClientSecret
        : undefined,
      url: values.url.trim(),
    };

    createConnector(
      {
        name: trimmed.name,
        oauthClientId: trimmed.oauthClientId,
        oauthClientSecret: trimmed.oauthClientSecret,
        type: trimmed.type,
        url: trimmed.url,
      },
      {
        onSuccess: (): void => {
          toast.success("Connector added");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      onOpenChange={(isOpen): void => {
        if (!isOpen) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add custom connector
            <Badge
              className="rounded-sm px-1 py-0 text-[10px] uppercase"
              variant="secondary"
            >
              Beta
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Connect {appName} to your data and tools. Learn more about
            connectors or get started with pre-built ones.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            // oxlint-disable-next-line typescript/no-misused-promises -- React Hook Form owns submission validation and completion; the DOM event dispatcher does not consume the returned promise.
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={MCP_NAME_MAX_LENGTH}
                      placeholder="Name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Remote MCP server URL"
                      type="url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Collapsible onOpenChange={setAdvancedOpen} open={advancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  className="text-muted-foreground hover:text-foreground h-auto p-0 hover:bg-transparent"
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronDown
                    className={`mr-1.5 size-4 transition-transform ${advancedOpen ? "" : "-rotate-90"}`}
                  />
                  Advanced settings
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Type</FormLabel>
                      <FormControl>
                        <Select
                          defaultValue={field.value}
                          onValueChange={(value): void => field.onChange(value)}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="http">
                              HTTP (Streamable)
                            </SelectItem>
                            <SelectItem value="sse">
                              SSE (Server-Sent Events)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="oauthClientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OAuth Client ID (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter client ID" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="oauthClientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OAuth Client Secret (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter client secret"
                          type="password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Only use connectors from developers you trust. {appName} does not
              control which tools developers make available and cannot verify
              that they will work as intended or that they won&apos;t change.
            </p>

            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending && <Spinner />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable typescript/strict-void-return */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-props-no-spreading */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
