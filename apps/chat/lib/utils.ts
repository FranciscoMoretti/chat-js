import type { FileUIPart, ModelMessage, TextPart } from "ai";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

import type { Document } from "@/lib/db/schema";
import { ChatSDKError, type ErrorCode } from "./ai/errors";
import type { Attachment, ChatMessage } from "./ai/types";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
	info: string;
	status: number;
}

export const fetchWithErrorHandlers = async (...[input, init]: Parameters<typeof fetch>): Promise<Response> => {
	try {
		const response = await fetch(input, init);

		if (!response.ok) {
			const { code, cause } = await response.json();
			throw new ChatSDKError(code as ErrorCode, cause);
		}

		return response;
	} catch (error: unknown) {
		if (typeof navigator !== "undefined" && !navigator.onLine) {
			throw new ChatSDKError("offline:chat");
		}

		throw error;
	}
};

function findLastArtifact(
	messages: Array<ChatMessage>,
): { messageIndex: number; toolCallId: string } | null {
	const allArtifacts: Array<{ messageIndex: number; toolCallId: string }> = [];

	messages.forEach((msg, messageIndex) => {
		msg.parts?.forEach((part) => {
			if (
				(part.type === "tool-createTextDocument" ||
					part.type === "tool-createCodeDocument" ||
					part.type === "tool-createSheetDocument" ||
					part.type === "tool-editTextDocument" ||
					part.type === "tool-editCodeDocument" ||
					part.type === "tool-editSheetDocument" ||
					part.type === "tool-deepResearch") &&
				part.state === "output-available"
			) {
				allArtifacts.push({
					messageIndex,
					toolCallId: part.toolCallId,
				});
			}
		});
	});

	return allArtifacts[allArtifacts.length - 1] || null;
}

const fetcher = async (url: string) => {
	const res = await fetch(url);

	if (!res.ok) {
		const error = new Error(
			"An error occurred while fetching the data.",
		) as ApplicationError;

		error.info = await res.json();
		error.status = res.status;

		throw error;
	}

	return res.json();
};

function getLocalStorage(key: string) {
	if (typeof window !== "undefined") {
		return JSON.parse(localStorage.getItem(key) || "[]");
	}
	return [];
}

export function generateUUID(): string {
	return uuidv7();
}

function getMostRecentUserMessage(messages: Array<ChatMessage>) {
	const userMessages = messages.filter((message) => message.role === "user");
	return userMessages.at(-1);
}

function getDocumentTimestampByIndex(
	documents: Array<Document>,
	index: number,
) {
	if (!documents) return new Date();
	if (index > documents.length) return new Date();

	return documents[index].createdAt;
}

function getTrailingMessageId({
	messages,
}: {
	messages: Array<ChatMessage>;
}): string | null {
	const trailingMessage = messages.at(-1);

	if (!trailingMessage) return null;

	return trailingMessage.id;
}

export function getLanguageFromFileName(fileName: string): string {
	const extension = fileName.split(".").pop()?.toLowerCase() || "";

	const extensionToLanguage: Record<string, string> = {
		// JavaScript/TypeScript
		js: "javascript",
		jsx: "jsx",
		ts: "typescript",
		tsx: "tsx",
		mjs: "javascript",
		cjs: "javascript",

		// Python
		py: "python",
		pyw: "python",
		pyi: "python",

		// Web
		html: "html",
		htm: "html",
		css: "css",
		scss: "css",
		sass: "css",
		less: "css",

		// Data formats
		json: "json",
		xml: "xml",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",

		// Shell
		sh: "shell",
		bash: "shell",
		zsh: "shell",
		fish: "shell",

		// Other languages
		sql: "sql",
		md: "markdown",
		mdx: "markdown",
		java: "java",
		c: "c",
		cpp: "cpp",
		cc: "cpp",
		cxx: "cpp",
		h: "c",
		hpp: "cpp",
		cs: "csharp",
		php: "php",
		rb: "ruby",
		go: "go",
		rs: "rust",
		swift: "swift",
		kt: "kotlin",
		r: "r",
		R: "r",
	};

	return extensionToLanguage[extension] || "python"; // Default to python
}

export function getAttachmentsFromMessage(message: ChatMessage): Attachment[] {
	return message.parts
		.filter<FileUIPart>((part) => part.type === "file")
		.map((part) => ({
			name: part.filename || "",
			url: part.url,
			contentType: part.mediaType,
		}));
}

export function getTextContentFromMessage(message: ChatMessage): string {
	return message.parts
		.filter<TextPart>((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
}

export function getTextContentFromModelMessage(message: ModelMessage): string {
	const content = message.content;

	if (typeof content === "string") {
		return content;
	}

	return content
		.map((part) => {
			if (part.type === "text") {
				return part.text;
			}
			return "";
		})
		.join("\n");
}
