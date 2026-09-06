"use client";
import type { ComponentType } from "react";
import { ConfirmNote } from "./components/confirm-note/client";
export const renderers = { confirm_note: ConfirmNote };
export const components: Record<string, ComponentType> = {};
