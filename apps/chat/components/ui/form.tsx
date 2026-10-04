"use client";

import type { Root as LabelPrimitiveRoot } from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
  createContext as reactCreateContext,
  useMemo as useReactMemo,
  useContext as useReactContext,
  useId as useReactId,
} from "react";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
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

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>): ReactJSX.Element => {
  const contextValue = useReactMemo(() => ({ name: props.name }), [props.name]);

  return (
    <FormFieldContext.Provider value={contextValue}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};
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
        {...props}
      />
    </FormItemContext.Provider>
  );
};
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const FormLabel = ({
  className,
  ...props
}: ReactComponentProps<typeof LabelPrimitiveRoot>): ReactJSX.Element => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      className={cn("data-[error=true]:text-destructive", className)}
      data-error={Boolean(error)}
      data-slot="form-label"
      htmlFor={formItemId}
      {...props}
    />
  );
};
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormControl: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }: React.ComponentProps<typeof Slot>). */

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
      {...props}
    />
  );
};
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FormDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">). */

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
      {...props}
    />
  );
};
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- FormMessage: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including body); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const FormMessage = ({
  className,
  ...props
}: ReactComponentProps<"p">): ReactJSX.Element | null => {
  const { error, formMessageId } = useFormField();
  const body = error ? (error?.message ?? "") : props.children;

  if (!body) {
    return null;
  }

  return (
    <p
      className={cn("text-destructive text-sm", className)}
      data-slot="form-message"
      id={formMessageId}
      {...props}
    >
      {body}
    </p>
  );
};
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
/* oxlint-enable react/only-export-components */
