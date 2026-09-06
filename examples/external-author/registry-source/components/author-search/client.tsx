"use client";

import { searchOutput } from "../../lib/author-search-contract";
import { toolRenderer } from "../../lib/tool-renderer";

export const SearchResult = toolRenderer(
	searchOutput,
	() => import("./renderer"),
);
