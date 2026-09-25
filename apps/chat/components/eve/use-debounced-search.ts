"use client";

import { useEffect, useState } from "react";

export const useDebouncedSearch = (value: string) => {
  const normalized = value.trim();
  const [search, setSearch] = useState(normalized);
  useEffect(() => {
    const timeout = setTimeout(
      () => setSearch(normalized),
      normalized ? 250 : 0
    );
    return () => clearTimeout(timeout);
  }, [normalized]);
  return search;
};
