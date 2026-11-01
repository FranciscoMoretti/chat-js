"use client";
import type { Ref } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TransportSelect = ({
  id,
  invalid,
  onBlur,
  onValueChange,
  ref,
  value,
}: {
  readonly id: string;
  readonly invalid: boolean;
  readonly onBlur: () => void;
  readonly onValueChange: (value: "http" | "sse") => void;
  readonly ref: Ref<HTMLButtonElement>;
  readonly value: "http" | "sse";
}) => (
  <Select
    onValueChange={(next: string) => {
      if (next === "http" || next === "sse") {
        onValueChange(next);
      }
    }}
    value={value}
  >
    <SelectTrigger id={id} aria-invalid={invalid} onBlur={onBlur} ref={ref}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectItem value="http">HTTP (Streamable)</SelectItem>
        <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);
