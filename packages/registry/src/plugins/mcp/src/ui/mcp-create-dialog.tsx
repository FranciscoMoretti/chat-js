"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { MCP_NAME_MAX_LENGTH } from "@/lib/ai/mcp-name-id";
import { config } from "@/lib/config";
import { useTRPC } from "@/trpc/react";

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
    .check(z.url({ error: "Please enter a valid URL" })),
});

type McpConnectorFormValues = z.infer<typeof mcpConnectorFormSchema>;

type ReadonlyFormEvent = Readonly<{
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented: boolean;
  eventPhase: number;
  isTrusted: boolean;
  timeStamp: number;
  type: string;
  nativeEvent: object;
  target: unknown;
  currentTarget: unknown;
  preventDefault: () => void;
  persist: () => void;
  stopPropagation: () => void;
  isDefaultPrevented: () => boolean;
  isPropagationStopped: () => boolean;
}>;

export const McpCreateDialog = ({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.JSX.Element => {
  const [, startEventAction] = React.useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.mcp.list.queryKey();
  const { appName } = config;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (open) {
      setAdvancedOpen(false);
    }
  }

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
  }, [open, form]);

  const { mutate: createConnector, isPending } = useMutation(
    trpc.mcp.create.mutationOptions({
      onError: (err: { readonly message: string }): void => {
        toast.error(err.message || "Failed to add connector");
      },
      onSuccess: (): void => {
        void queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const handleSubmit = (values: Readonly<McpConnectorFormValues>): void => {
    const trimmed: McpConnectorFormValues = {
      ...values,
      name: values.name.trim(),
      oauthClientId:
        (values.oauthClientId?.trim() ?? "") === ""
          ? undefined
          : values.oauthClientId,
      oauthClientSecret:
        (values.oauthClientSecret?.trim() ?? "") === ""
          ? undefined
          : values.oauthClientSecret,
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

        <FieldGroup>
          <form
            className="flex flex-col gap-4"

            onSubmit={(event: ReadonlyFormEvent) => {
              startEventAction(async () => {
                try {
                  await form.handleSubmit(handleSubmit)(event);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to add connector"
                  );
                }
              });
            }}
          >
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>

                  <Input
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    {...field}
                    maxLength={MCP_NAME_MAX_LENGTH}
                    placeholder="Name"
                  />

                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="url"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>URL</FieldLabel>

                  <Input
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    {...field}
                    placeholder="Remote MCP server URL"
                    type="url"
                  />

                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Collapsible onOpenChange={setAdvancedOpen} open={advancedOpen}>
              <CollapsibleTrigger
                render={
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
                }
              />
              <CollapsibleContent className="space-y-4 pt-2">
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        Transport Type
                      </FieldLabel>

                      <Select
                        items={{
                          http: "HTTP (Streamable)",
                          sse: "SSE (Server-Sent Events)",
                        }}
                        onValueChange={(value): void => {
                          if (value !== null) {
                            field.onChange(value);
                          }
                        }}
                        value={field.value}
                      >
                        <SelectTrigger
                          id={field.name}
                          aria-invalid={fieldState.invalid}
                          onBlur={() => {
                            field.onBlur();
                          }}
                          ref={field.ref}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="http">
                              HTTP (Streamable)
                            </SelectItem>
                            <SelectItem value="sse">
                              SSE (Server-Sent Events)
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>

                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="oauthClientId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        OAuth Client ID (optional)
                      </FieldLabel>

                      <Input
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        {...field}
                        placeholder="Enter client ID"
                      />

                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="oauthClientSecret"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>
                        OAuth Client Secret (optional)
                      </FieldLabel>

                      <Input
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        {...field}
                        placeholder="Enter client secret"
                        type="password"
                      />

                      <FieldError errors={[fieldState.error]} />
                    </Field>
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
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
};
