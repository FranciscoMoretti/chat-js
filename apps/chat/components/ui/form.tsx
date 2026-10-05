"use client";

import type { Root as LabelPrimitiveRoot } from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */
import {
  createContext as reactCreateContext,
  useContext as useReactContext,
  useId as useReactId,
  useMemo as useReactMemo,
} from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
} from "react-hook-form";
/* oxlint-enable sort-imports */
import type {
  ControllerFieldState,
  ControllerProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = reactCreateContext<FormFieldContextValue>(
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: These contexts use empty defaults and require matching providers; changing defaults needs a coordinated provider/consumer invariant migration.
  {} as FormFieldContextValue
);
/* oxlint-disable typescript/prefer-readonly-parameter-types -- FormField: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }: ControllerProps<TFieldValues, TName>). */

/* oxlint-disable react/react-in-jsx-scope -- FormField uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>): ReactJSX.Element => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

interface FormItemContextValue {
  id: string;
}

const FormItemContext = reactCreateContext<FormItemContextValue>(
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: These contexts use empty defaults and require matching providers; changing defaults needs a coordinated provider/consumer invariant migration.
  {} as FormItemContextValue
);
type FormFieldState = ControllerFieldState & {
  formDescriptionId: string;
  formItemId: string;
  formMessageId: string;
  id: string;
  name: FormFieldContextValue["name"];
};

/* oxlint-disable typescript/strict-boolean-expressions -- useFormField:; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including fieldContext). */

const useFormField = (): FormFieldState => {
  const fieldContext = useReactContext(FormFieldContext);
  const itemContext = useReactContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    formDescriptionId: `${id}-form-item-description`,
    formItemId: `${id}-form-item`,
    formMessageId: `${id}-form-item-message`,
    id,
    name: fieldContext.name,
    ...fieldState,
  };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- FormItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormItem = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => {
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- FormLabel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormLabel = ({
  className,
  ...props
}: ReactComponentProps<typeof LabelPrimitiveRoot>): ReactJSX.Element => {
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormControl: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }: React.ComponentProps<typeof Slot>). */

/* oxlint-disable react/react-in-jsx-scope -- FormControl uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormControl = ({
  ...props
}: ReactComponentProps<typeof Slot>): ReactJSX.Element => {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      aria-describedby={
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">). */

/* oxlint-disable react/react-in-jsx-scope -- FormDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormDescription = ({
  className,
  ...props
}: ReactComponentProps<"p">): ReactJSX.Element => {
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- FormMessage: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including body); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/* oxlint-disable react/react-in-jsx-scope -- FormMessage uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const FormMessage = ({
  className,
  ...props
}: ReactComponentProps<"p">): ReactJSX.Element | null => {
  const { error, formMessageId } = useFormField();
  const body = error ? (error.message ?? "") : props.children;

  if (!body) {
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

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
