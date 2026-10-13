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
  // oxlint-disable-next-line unicorn/no-useless-undefined -- React requires a context default; undefined identifies a missing provider.
  undefined
);

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

interface FormItemContextValue {
  id: string;
}

const FormItemContext = reactCreateContext<FormItemContextValue | undefined>(
  // oxlint-disable-next-line unicorn/no-useless-undefined -- React requires a context default; undefined identifies a missing provider.
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
    ...fieldState,
  };
};

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

const FormMessage = ({
  className,
  ...props
}: ReactComponentProps<"p">): ReactJSX.Element | null => {
  const { error, formMessageId } = useFormField();
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
      {...props}
    >
      {body}
    </p>
  );
};

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
