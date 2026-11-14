/** TanStack Query definitions for the explorer API. */

import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getJSON } from "./api";
import type {
  ListResponse,
  Meta,
  ProviderInfo,
  SearchResponse,
  Side,
  SizeMode,
  SortDir,
  SortKey,
} from "./types";

export interface ProvidersResponse {
  default: string;
  providers: ProviderInfo[];
}

export interface ListQueryInput {
  side: Side;
  providerKey: string;
  path: string;
  sort: SortKey;
  dir: SortDir;
  sizeMode: SizeMode;
  hidden: boolean;
}

export interface SearchQueryInput {
  side: Side;
  providerKey: string;
  query: string;
  scope: "all" | "folder";
  path: string;
  hidden: boolean;
}

export const providersQuery = queryOptions({
  queryKey: ["providers"] as const,
  queryFn: () => getJSON<ProvidersResponse>("/api/providers"),
  staleTime: 60_000,
});

export function metaQuery(providerKey: string) {
  return queryOptions({
    queryKey: ["meta", providerKey] as const,
    queryFn: () => getJSON<Meta>(`/api/meta?provider=${encodeURIComponent(providerKey)}`),
    staleTime: 60_000,
  });
}

export function listQuery(input: ListQueryInput) {
  const url =
    `/api/list?side=${input.side}` +
    `&provider=${encodeURIComponent(input.providerKey)}` +
    `&path=${encodeURIComponent(input.path)}` +
    `&sort=${input.sort}&dir=${input.dir}` +
    `&sizemode=${input.sizeMode}` +
    `&hidden=${input.hidden ? 1 : 0}`;
  return queryOptions({
    queryKey: [
      "list",
      input.side,
      input.providerKey,
      input.path,
      input.sort,
      input.dir,
      input.sizeMode,
      input.hidden,
    ] as const,
    queryFn: () => getJSON<ListResponse>(url),
    placeholderData: keepPreviousData,
  });
}

export function searchQuery(input: SearchQueryInput) {
  const url =
    `/api/search?side=${input.side}` +
    `&provider=${encodeURIComponent(input.providerKey)}` +
    `&q=${encodeURIComponent(input.query)}` +
    `&scope=${input.scope}&path=${encodeURIComponent(input.path)}` +
    `&hidden=${input.hidden ? 1 : 0}`;
  return queryOptions({
    queryKey: [
      "search",
      input.side,
      input.providerKey,
      input.query,
      input.scope,
      input.path,
      input.hidden,
    ] as const,
    queryFn: () => getJSON<SearchResponse>(url),
    placeholderData: keepPreviousData,
  });
}
