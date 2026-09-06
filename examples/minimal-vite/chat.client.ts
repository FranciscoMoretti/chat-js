"use client";
import type { ComponentType } from "react";
import { ConfirmNote as Renderer0 } from "./components/confirm-note/client";

export const renderers = { ["confirm_note"]: Renderer0 } satisfies Record<
	string,
	ComponentType<{ value: unknown }>
>;
export const components: Record<string, ComponentType> = {};
