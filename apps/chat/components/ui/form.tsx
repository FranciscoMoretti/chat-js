"use client";

import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
} from "react-hook-form";
import type {
  ControllerFieldState,
  ControllerProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import {
  createContext as reactCreateContext,
  useContext as useReactContext,
  useId as useReactId,
  useMemo as useReactMemo,
} from "react";
import { Label } from "@/components/ui/label";
import type { Root as LabelPrimitiveRoot } from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = reactCreateContext<FormFieldContextValue | undefined>(
  // oxlint-disable-next-line no-undefined -- React context needs a real absent-provider sentinel so useFormField can reject a missing provider.
  undefined
);

/* oxlint-disable react/react-in-jsx-scope -- FormField uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- FormField snapshots props before its repeated props.name reads and Controller forwarding; direct props changes getter counts/order.
    ...props
  }: ControllerProps<TFieldValues, TName>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const contextValue = useReactMemo(() => ({ name: props.name }), [props.name]);

  return (
    <FormFieldContext.Provider value={contextValue}>
      <Controller
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward FormField's Controller prop contract, preserving caller options, children and callbacks.
        {...props}
      />
    </FormFieldContext.Provider>
  );
};
/* oxlint-enable react/react-in-jsx-scope */

interface FormItemContextValue {
  id: string;
}

const FormItemContext = reactCreateContext<FormItemContextValue | undefined>(
  // oxlint-disable-next-line no-undefined -- React context needs a real absent-provider sentinel so useFormField can reject a missing provider.
  undefined
);
type FormFieldState = ControllerFieldState & {
  formDescriptionId: string;
  formItemId: string;
  formMessageId: string;
  id: string;
  name: FormFieldContextValue["name"];
};

const useFormField = (): FormFieldState => {
  const fieldContext = useReactContext(FormFieldContext);
  const itemContext = useReactContext(FormItemContext);
  const { getFieldState } = useFormContext();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Read optional field context before the missing-provider guard so the existing hook ordering stays unconditional.
  const formState = useFormState({ name: fieldContext?.name });

  if (!fieldContext || !itemContext) {
    throw new Error(
      "useFormField should be used within <FormField> and <FormItem>"
    );
  }
  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    formDescriptionId: `${id}-form-item-description`,
    formItemId: `${id}-form-item`,
    formMessageId: `${id}-form-item-message`,
    id,
    name: fieldContext.name,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve getFieldState's native five-field order after the ID/name fields; an explicit projection in that order fails pinned sort-keys, while sorting it changes this hook's enumerable key order.
    ...fieldState,
  };
};

/* oxlint-disable react/no-multi-comp -- FormItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- FormItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const id = useReactId();
  const contextValue = useReactMemo(() => ({ id }), [id]);

  return (
    <FormItemContext.Provider value={contextValue}>
      <div
        className={cn("grid gap-2", className)}
        data-slot="form-item"
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward FormItem's native div attributes, preserving caller events and accessibility props.
        {...props}
      />
    </FormItemContext.Provider>
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- FormLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- FormLabel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormLabel = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof LabelPrimitiveRoot>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      // oxlint-disable-next-line react/forbid-component-props -- Label accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("data-[error=true]:text-destructive", className)}
      data-error={Boolean(error)}
      data-slot="form-label"
      htmlFor={formItemId}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward FormLabel's Label prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- FormControl: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- FormControl uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormControl = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- FormControl snapshots props before useFormField and Slot forwarding; direct props changes hook/getter order.
    ...props
  }: ReactComponentProps<typeof Slot>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      aria-describedby={
        // oxlint-disable-next-line no-ternary -- Keep aria-describedby JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={Boolean(error)}
      data-slot="form-control"
      id={formItemId}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward FormControl's Slot prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- FormDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- FormDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormDescription = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"p">
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const { formDescriptionId } = useFormField();

  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="form-description"
      id={formDescriptionId}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward FormDescription's native p attributes, preserving caller events and accessibility props.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp, unicorn/no-null -- FormMessage shares the field context with this component family; null preserves its native empty-render contract. */

/* oxlint-disable react/react-in-jsx-scope -- FormMessage uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormMessage = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"p">
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element | null => {
  const { error, formMessageId } = useFormField();
  // oxlint-disable-next-line no-ternary -- Keep body as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const body = error ? (error.message ?? "") : props.children;
  const hasMessage = Boolean(body);

  if (!hasMessage) {
    return null;
  }

  return (
    <p
      className={cn("text-destructive text-sm", className)}
      data-slot="form-message"
      id={formMessageId}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward FormMessage's native p attributes, preserving caller events and accessibility props.
      {...props}
    >
      {body}
    </p>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, unicorn/no-null */

/* oxlint-disable react/only-export-components -- form.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
