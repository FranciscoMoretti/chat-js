"use client";

import { zodResolver } from "@hookform/resolvers/zod";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
/* oxlint-enable sort-imports */
import { ChevronDown } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { useEffect, useState } from "react";
/* oxlint-enable sort-imports */
import { useForm } from "react-hook-form";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { toast } from "sonner";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
/* oxlint-enable sort-imports */
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
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
/* oxlint-enable sort-imports */
import { Spinner } from "@/components/ui/spinner";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MCP_NAME_MAX_LENGTH } from "@/lib/ai/mcp-name-id";
/* oxlint-enable sort-imports */
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
/* oxlint-disable react/jsx-no-literals -- McpCreateDialog renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/strict-void-return -- The receiving framework deliberately ignores this callback result and owns its completion/error handling. */
export const McpCreateDialog = ({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.JSX.Element => {
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
      <DialogContent
        // oxlint-disable-next-line react/forbid-component-props -- DialogContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle
            // oxlint-disable-next-line react/forbid-component-props -- DialogTitle accepts className in its styling contract; preserve this caller's layout and appearance.
            className="flex items-center gap-2"
          >
            Add custom connector
            <Badge
              // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
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
                  // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="text-muted-foreground hover:text-foreground h-auto p-0 hover:bg-transparent"
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronDown
                    // oxlint-disable-next-line react/forbid-component-props -- ChevronDown accepts className in its styling contract; preserve this caller's layout and appearance.
                    className={`mr-1.5 size-4 transition-transform ${advancedOpen ? "" : "-rotate-90"}`}
                  />
                  Advanced settings
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent
                // oxlint-disable-next-line react/forbid-component-props -- CollapsibleContent accepts className in its styling contract; preserve this caller's layout and appearance.
                className="space-y-4 pt-2"
              >
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-void-return */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-props-no-spreading */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
