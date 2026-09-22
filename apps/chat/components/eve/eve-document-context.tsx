"use client";
import { createContext, useContext } from "react";

export const EveDocumentContext = createContext<string | undefined>(undefined);
export const useDocumentConversation = () => useContext(EveDocumentContext);

export const EveDocumentReplayContext = createContext(false);
export const useDocumentReplaying = () => useContext(EveDocumentReplayContext);
