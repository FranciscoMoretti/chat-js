"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

/* oxlint-disable import/no-namespace -- @radix-ui/react-label import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import type * as LabelPrimitive from "@radix-ui/react-label";
/* oxlint-enable import/no-namespace */
import { Slot } from "@radix-ui/react-slot";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
} from "react-hook-form";
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: These contexts use empty defaults and require matching providers; changing defaults needs a coordinated provider/consumer invariant migration.
  {} as FormFieldContextValue
);
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- FormField: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }: ControllerProps<TFieldValues, TName>). */

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  const contextValue = React.useMemo(
    () => ({ name: props.name }),
    [props.name]
  );

  return (
    <FormFieldContext.Provider value={contextValue}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>(
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: These contexts use empty defaults and require matching providers; changing defaults needs a coordinated provider/consumer invariant migration.
  {} as FormItemContextValue
);
/* oxlint-disable oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions -- useFormField: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including fieldContext). */

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
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
/* oxlint-enable oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- FormItem: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const FormItem = ({ className, ...props }: React.ComponentProps<"div">) => {
  const id = React.useId();
  const contextValue = React.useMemo(() => ({ id }), [id]);

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
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- FormLabel: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const FormLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) => {
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
/* oxlint-enable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-ternary, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- FormControl: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }: React.ComponentProps<typeof Slot>). */

const FormControl = ({ ...props }: React.ComponentProps<typeof Slot>) => {
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
/* oxlint-enable no-ternary, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- FormDescription: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">). */

const FormDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">) => {
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
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-ternary, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- FormMessage: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including error ? (error?.message ?? "") : props.children); oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including error?.message); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including body); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const FormMessage = ({ className, ...props }: React.ComponentProps<"p">) => {
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
/* oxlint-enable no-ternary, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/no-named-export, react/only-export-components -- form.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

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
/* oxlint-enable import/no-named-export, react/only-export-components */
