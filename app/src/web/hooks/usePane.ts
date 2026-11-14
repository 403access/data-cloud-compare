/**
 * State and actions for one virtualised pane.
 *
 * Local state covers history, selection, sorting and search input. Server
 * responses come from TanStack Query so listings and search results are cached
 * and deduplicated across panes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SEARCH_MIN } from "../lib/config";
import { listQuery, searchQuery } from "../lib/queries";
import type { SortDir, SortKey, Side, SizeMode } from "../lib/types";
import { entryType, parentOf, sizeSortValue } from "../lib/format";
import { statusLabel } from "../lib/status";
import type {
  Crumb,
  Entry,
  ListResponse,
  ProviderInfo,
  Stats,
} from "../lib/types";

const EMPTY_STATS: Stats = { files: 0, dirs: 0, items: 0, bytes: 0 };

export interface PaneState {
  path: string;
  history: string[];
  hIndex: number;
  selected: string | null;
  sort: SortKey;
  dir: SortDir;
  query: string;
  searchText: string;
  scope: "all" | "folder";
  statusFilters: Set<string>;
  searchMode: boolean;
  scrollResetKey: number;
}

export interface PaneApi extends PaneState {
  side: Side;
  entries: Entry[];
  results: Entry[];
  crumbs: Crumb[];
  truncated: boolean;
  exists: boolean;
  stats: Stats;
  loading: boolean;
  currentEntries: () => Entry[];
  baseEntries: () => Entry[];
  selectedEntry: () => Entry | null;
  navigate: (
    path: string,
    opts?: { push?: boolean; select?: string | null },
  ) => Promise<ListResponse | null>;
  fetchList: (path?: string) => Promise<ListResponse | null>;
  back: () => void;
  forward: () => void;
  up: () => void;
  mirror: () => Promise<void>;
  resetTo: (path: string) => Promise<ListResponse | null>;
  onSearchInput: (value: string) => void;
  clearSearch: () => void;
  runSearch: (query: string) => Promise<void>;
  setScope: (scope: "all" | "folder") => void;
  setSort: (sort: SortKey, dir?: SortDir) => void;
  refreshSizeDisplay: () => void;
  select: (path: string | null) => void;
  activate: (entry: Entry) => void;
  toggleStatusFilter: (status: string) => void;
  clearStatusFilters: () => void;
  statusFilterOptions: () => Array<{ value: string; label: string }>;
  activeStatusFilters: () => string[];
  statusFilterLabel: () => string;
}

export interface PaneContext {
  getProvider: () => ProviderInfo;
  getProviderKey: () => string;
  isHidden: () => boolean;
  getSizeMode: () => SizeMode;
  toast: (message: string) => void;
  setActive: (side: Side) => void;
  closeDetail: () => void;
  revealCounterpart: (entry: Entry, side: Side) => void;
  getOther: (side: Side) => PaneApi;
}

const STATUS_ORDER: Record<string, number> = {
  missing: 0,
  partial: 1,
  possible: 2,
  moved: 3,
  moved_match: 3,
  type_mismatch: 4,
  exact: 5,
  local_only: 6,
  unmatched: 7,
};

function sortResults(
  results: Entry[],
  sort: SortKey,
  dir: SortDir,
  sizeMode: SizeMode,
): Entry[] {
  let key: (entry: Entry) => number | string;
  if (sort === "size") key = (entry) => sizeSortValue(entry, sizeMode);
  else if (sort === "modified") key = (entry) => entry.modified || 0;
  else if (sort === "status") key = (entry) => STATUS_ORDER[entry.status] ?? 99;
  else if (sort === "type") key = (entry) => entryType(entry).toLocaleLowerCase();
  else key = (entry) => (entry.name || "").toLocaleLowerCase();
  const factor = dir === "desc" ? -1 : 1;
  results.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    const ak = key(a);
    const bk = key(b);
    if (ak < bk) return -1 * factor;
    if (ak > bk) return 1 * factor;
    return 0;
  });
  return results;
}

export function usePane(side: Side, ctx: PaneContext, booted: boolean): PaneApi {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PaneState>({
    path: "",
    history: [""],
    hIndex: 0,
    selected: null,
    sort: "name",
    dir: "asc",
    query: "",
    searchText: "",
    scope: "all",
    statusFilters: new Set(),
    searchMode: false,
    scrollResetKey: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const setPaneState = useCallback((updater: (prev: PaneState) => PaneState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const providerKey = ctx.getProviderKey();
  const hidden = ctx.isHidden();
  const sizeMode = ctx.getSizeMode();

  const listResult = useQuery({
    ...listQuery({
      side,
      providerKey,
      path: state.path,
      sort: state.sort,
      dir: state.dir,
      sizeMode,
      hidden,
    }),
    enabled: booted && !state.searchMode,
  });
  const searchResult = useQuery({
    ...searchQuery({
      side,
      providerKey,
      query: state.query,
      scope: state.scope,
      path: state.path,
      hidden,
    }),
    enabled: booted && state.searchMode && state.query.length >= SEARCH_MIN,
  });

  const listEntries = listResult.isError ? [] : listResult.data?.entries ?? [];
  const results = useMemo(
    () =>
      searchResult.data
        ? sortResults(
            [...searchResult.data.entries],
            state.sort,
            state.dir,
            sizeMode,
          )
        : [],
    [searchResult.data, state.sort, state.dir, sizeMode],
  );
  const crumbs = listResult.data?.crumbs || [];
  const stats = listResult.data?.stats || EMPTY_STATS;
  const truncated = state.searchMode
    ? (searchResult.data?.truncated ?? false)
    : false;
  const exists = listResult.isError ? false : listResult.data?.exists !== false;
  const loading = state.searchMode
    ? searchResult.isFetching
    : listResult.isFetching;

  // Reset the list scroll whenever a fresh listing or search result arrives.
  const listData = listResult.data;
  const searchData = searchResult.data;
  useEffect(() => {
    if (!listData && !searchData) return;
    setPaneState((prev) => ({
      ...prev,
      scrollResetKey: prev.scrollResetKey + 1,
    }));
  }, [listData, searchData, setPaneState]);

  // Drop the selection when it is no longer visible in the active result set.
  const listReady = listData !== undefined && !listResult.isPlaceholderData;
  const searchReady = searchData !== undefined && !searchResult.isPlaceholderData;
  const selectionReady = state.searchMode
    ? searchReady
    : listReady || listResult.isError;
  useEffect(() => {
    if (!selectionReady) return;
    setPaneState((prev) => {
      if (!prev.selected) return prev;
      const entries = prev.searchMode ? results : listEntries;
      const visible = entries.some(
        (entry) =>
          entry.path === prev.selected &&
          (!prev.statusFilters.size || prev.statusFilters.has(entry.status)),
      );
      return visible ? prev : { ...prev, selected: null };
    });
  }, [selectionReady, results, listEntries, state.searchMode, state.statusFilters, setPaneState]);

  useEffect(() => {
    if (!listResult.isError || !listResult.error) return;
    if (!mounted.current) return;
    const message =
      listResult.error instanceof Error
        ? listResult.error.message
        : String(listResult.error);
    ctxRef.current.toast(message);
  }, [listResult.isError, listResult.error]);

  useEffect(() => {
    if (!searchResult.isError || !searchResult.error) return;
    if (!mounted.current) return;
    const message =
      searchResult.error instanceof Error
        ? searchResult.error.message
        : String(searchResult.error);
    ctxRef.current.toast(`Search failed: ${message}`);
  }, [searchResult.isError, searchResult.error]);

  const currentEntries = useCallback((): Entry[] => {
    const current = stateRef.current;
    const base = current.searchMode ? results : listEntries;
    if (!current.statusFilters.size) return base;
    return base.filter((entry) => current.statusFilters.has(entry.status));
  }, [listEntries, results]);

  const baseEntries = useCallback((): Entry[] => {
    return stateRef.current.searchMode ? results : listEntries;
  }, [listEntries, results]);

  const selectedEntry = useCallback((): Entry | null => {
    const selected = stateRef.current.selected;
    if (!selected) return null;
    return currentEntries().find((entry) => entry.path === selected) ?? null;
  }, [currentEntries]);

  const fetchList = useCallback(
    async (pathOverride?: string): Promise<ListResponse | null> => {
      const current = stateRef.current;
      const path = pathOverride ?? current.path;
      const { getProviderKey, isHidden, getSizeMode } = ctxRef.current;
      try {
        return await queryClient.fetchQuery(
          listQuery({
            side,
            providerKey: getProviderKey(),
            path,
            sort: current.sort,
            dir: current.dir,
            sizeMode: getSizeMode(),
            hidden: isHidden(),
          }),
        );
      } catch {
        return null;
      }
    },
    [queryClient, side],
  );

  const navigate = useCallback(
    async (
      nextPath: string,
      opts: { push?: boolean; select?: string | null } = {},
    ): Promise<ListResponse | null> => {
      const { push = true, select = null } = opts;
      const path = nextPath || "";
      if (searchTimer.current) clearTimeout(searchTimer.current);
      ctxRef.current.closeDetail();
      const current = stateRef.current;
      let history = current.history;
      let hIndex = current.hIndex;
      if (push) {
        if (history[hIndex] !== path) {
          history = history.slice(0, hIndex + 1);
          history.push(path);
          hIndex = history.length - 1;
        }
      }
      setPaneState((prev) => ({
        ...prev,
        path,
        history,
        hIndex,
        selected: select,
        searchMode: false,
        query: "",
        searchText: "",
      }));
      return fetchList(path);
    },
    [fetchList, setPaneState],
  );

  const resetTo = useCallback(
    async (path: string): Promise<ListResponse | null> => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      ctxRef.current.closeDetail();
      setPaneState((prev) => ({
        ...prev,
        path,
        history: [path],
        hIndex: 0,
        selected: null,
        searchMode: false,
        query: "",
        searchText: "",
      }));
      return fetchList(path);
    },
    [fetchList, setPaneState],
  );

  const back = useCallback(() => {
    const current = stateRef.current;
    if (current.hIndex <= 0) return;
    const hIndex = current.hIndex - 1;
    setPaneState((prev) => ({ ...prev, hIndex }));
    void navigate(current.history[hIndex], { push: false });
  }, [navigate, setPaneState]);

  const forward = useCallback(() => {
    const current = stateRef.current;
    if (current.hIndex >= current.history.length - 1) return;
    const hIndex = current.hIndex + 1;
    setPaneState((prev) => ({ ...prev, hIndex }));
    void navigate(current.history[hIndex], { push: false });
  }, [navigate, setPaneState]);

  const up = useCallback(() => {
    const current = stateRef.current;
    if (!current.path) return;
    void navigate(parentOf(current.path));
  }, [navigate]);

  const mirror = useCallback(async () => {
    const current = stateRef.current;
    const other = ctxRef.current.getOther(side);
    const data = await other.navigate(current.path, { push: true });
    if (data && !data.exists) {
      ctxRef.current.toast(
        `“${current.path || "/"}” was not found on the ` +
          `${side === "local" ? ctxRef.current.getProvider().label : "local"} side.`,
      );
    }
  }, [side]);

  const runSearch = useCallback(
    async (q: string): Promise<void> => {
      const current = stateRef.current;
      setPaneState((prev) => ({
        ...prev,
        searchMode: true,
        query: q,
        selected: null,
      }));
      const { getProviderKey, isHidden } = ctxRef.current;
      try {
        await queryClient.fetchQuery(
          searchQuery({
            side,
            providerKey: getProviderKey(),
            query: q,
            scope: current.scope,
            path: current.path,
            hidden: isHidden(),
          }),
        );
      } catch {
        /* error surfaced by the query state */
      }
    },
    [queryClient, setPaneState, side],
  );

  const exitSearch = useCallback(
    (reload: boolean) => {
      const wasSearching = stateRef.current.searchMode;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setPaneState((prev) => ({
        ...prev,
        searchMode: false,
        query: "",
        searchText: "",
      }));
      if (reload && wasSearching) void fetchList();
    },
    [fetchList, setPaneState],
  );

  const onSearchInput = useCallback(
    (value: string) => {
      const q = value.trim();
      setPaneState((prev) => ({ ...prev, searchText: value }));
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!q) {
        if (stateRef.current.searchMode) {
          exitSearch(false);
          void fetchList();
        }
        return;
      }
      if (q.length < SEARCH_MIN) {
        if (stateRef.current.searchMode) {
          exitSearch(false);
          void fetchList();
        }
        return;
      }
      searchTimer.current = setTimeout(() => void runSearch(q), 260);
    },
    [exitSearch, fetchList, runSearch, setPaneState],
  );

  const clearSearch = useCallback(() => {
    if (!stateRef.current.searchMode && !stateRef.current.searchText) return;
    exitSearch(false);
    void fetchList();
  }, [exitSearch, fetchList]);

  const setScope = useCallback(
    (scope: "all" | "folder") => {
      setPaneState((prev) => ({ ...prev, scope }));
      const current = stateRef.current;
      if (current.searchMode && current.query) void runSearch(current.query);
    },
    [runSearch, setPaneState],
  );

  const refreshSizeDisplay = useCallback(() => {
    const current = stateRef.current;
    if (current.searchMode) return;
    if (current.sort === "size") void fetchList();
  }, [fetchList]);

  const setSort = useCallback(
    (sort: SortKey, dir?: SortDir) => {
      const current = stateRef.current;
      const nextDir: SortDir =
        dir ?? (current.sort === sort ? (current.dir === "asc" ? "desc" : "asc") : "asc");
      setPaneState((prev) => ({ ...prev, sort, dir: nextDir }));
    },
    [setPaneState],
  );

  const select = useCallback(
    (path: string | null) => {
      setPaneState((prev) => ({ ...prev, selected: path || null }));
    },
    [setPaneState],
  );

  const activate = useCallback(
    (entry: Entry) => {
      const current = stateRef.current;
      if (current.searchMode) {
        if (entry.is_dir) void navigate(entry.path);
        else void navigate(entry.parent, { select: entry.path });
        return;
      }
      if (entry.is_dir) void navigate(entry.path);
      else ctxRef.current.revealCounterpart(entry, side);
    },
    [navigate, side],
  );

  const statusFilterOptions = useCallback(() => {
    const order =
      side === "local"
        ? [
            "exact",
            "moved",
            "moved_match",
            "possible",
            "partial",
            "missing",
            "type_mismatch",
            "local_only",
            "unmatched",
          ]
        : ["exact", "moved", "possible", "partial", "missing"];
    const provider = ctxRef.current.getProvider();
    return order.map((status) => ({
      value: status,
      label: statusLabel({ status }, side, provider),
    }));
  }, [side]);

  const activeStatusFilters = useCallback(() => {
    const order = statusFilterOptions().map((option) => option.value);
    return order.filter((status) => stateRef.current.statusFilters.has(status));
  }, [statusFilterOptions]);

  const statusFilterLabel = useCallback(() => {
    const provider = ctxRef.current.getProvider();
    return activeStatusFilters()
      .map((status) => statusLabel({ status }, side, provider))
      .join(", ");
  }, [activeStatusFilters, side]);

  const toggleStatusFilter = useCallback(
    (status: string) => {
      setPaneState((prev) => {
        const next = new Set(prev.statusFilters);
        if (next.has(status)) next.delete(status);
        else next.add(status);
        return { ...prev, statusFilters: next };
      });
    },
    [setPaneState],
  );

  const clearStatusFilters = useCallback(() => {
    setPaneState((prev) => {
      if (!prev.statusFilters.size) return prev;
      return { ...prev, statusFilters: new Set() };
    });
  }, [setPaneState]);

  return {
    ...state,
    side,
    entries: listEntries,
    results,
    crumbs,
    truncated,
    exists,
    stats,
    loading,
    currentEntries,
    baseEntries,
    selectedEntry,
    navigate,
    fetchList,
    back,
    forward,
    up,
    mirror,
    resetTo,
    onSearchInput,
    clearSearch,
    runSearch,
    setScope,
    setSort,
    refreshSizeDisplay,
    select,
    activate,
    toggleStatusFilter,
    clearStatusFilters,
    statusFilterOptions,
    activeStatusFilters,
    statusFilterLabel,
  };
}
