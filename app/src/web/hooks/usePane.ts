/**
 * State and actions for one virtualised pane.
 *
 * This mirrors the legacy imperative Pane class: history, listings, debounced
 * search, status filters, sorting and per-pane selection.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SEARCH_MIN,
} from "../lib/config";
import type { SortDir, SortKey, Side, SizeMode } from "../lib/types";
import { getJSON } from "../lib/api";
import { entryType, parentOf, sizeSortValue } from "../lib/format";
import { statusLabel } from "../lib/status";
import type {
  Crumb,
  Entry,
  ListResponse,
  ProviderInfo,
  SearchResponse,
  Stats,
} from "../lib/types";

const EMPTY_STATS: Stats = { files: 0, dirs: 0, items: 0, bytes: 0 };

export interface PaneState {
  path: string;
  history: string[];
  hIndex: number;
  entries: Entry[];
  results: Entry[];
  crumbs: Crumb[];
  selected: string | null;
  sort: SortKey;
  dir: SortDir;
  query: string;
  searchText: string;
  scope: "all" | "folder";
  statusFilters: Set<string>;
  searchMode: boolean;
  truncated: boolean;
  exists: boolean;
  stats: Stats;
  loading: boolean;
  scrollResetKey: number;
}

export interface PaneApi extends PaneState {
  side: Side;
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

export function usePane(side: Side, ctx: PaneContext): PaneApi {
  const [state, setState] = useState<PaneState>({
    path: "",
    history: [""],
    hIndex: 0,
    entries: [],
    results: [],
    crumbs: [],
    selected: null,
    sort: "name",
    dir: "asc",
    query: "",
    searchText: "",
    scope: "all",
    statusFilters: new Set(),
    searchMode: false,
    truncated: false,
    exists: true,
    stats: EMPTY_STATS,
    loading: false,
    scrollResetKey: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const reqSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const currentEntries = useCallback((): Entry[] => {
    const current = stateRef.current;
    const base = current.searchMode ? current.results : current.entries;
    if (!current.statusFilters.size) return base;
    return base.filter((entry) => current.statusFilters.has(entry.status));
  }, []);

  const baseEntries = useCallback((): Entry[] => {
    const current = stateRef.current;
    return current.searchMode ? current.results : current.entries;
  }, []);

  const selectedEntry = useCallback((): Entry | null => {
    const selected = stateRef.current.selected;
    if (!selected) return null;
    return currentEntries().find((entry) => entry.path === selected) ?? null;
  }, [currentEntries]);

  const fetchList = useCallback(async (pathOverride?: string) => {
    const seq = ++reqSeq.current;
    const current = stateRef.current;
    const path = pathOverride ?? current.path;
    const { getProviderKey, isHidden, getSizeMode } = ctxRef.current;
    setState((prev) => ({ ...prev, loading: true }));
    const url =
      `/api/list?side=${side}` +
      `&provider=${encodeURIComponent(getProviderKey())}` +
      `&path=${encodeURIComponent(path)}` +
      `&sort=${current.sort}&dir=${current.dir}` +
      `&sizemode=${getSizeMode()}` +
      `&hidden=${isHidden() ? 1 : 0}`;
    try {
      const data = await getJSON<ListResponse>(url);
      if (seq !== reqSeq.current || !mounted.current) return null;
      setState((prev) => {
        const entries = data.entries || [];
        let selected = prev.selected;
        if (selected) {
          const visible = prev.statusFilters.size
            ? entries.some(
                (entry) =>
                  entry.path === selected && prev.statusFilters.has(entry.status),
              )
            : entries.some((entry) => entry.path === selected);
          if (!visible) selected = null;
        }
        return {
          ...prev,
          path,
          entries,
          stats: data.stats || EMPTY_STATS,
          exists: data.exists !== false,
          crumbs: data.crumbs || [],
          selected,
          scrollResetKey: prev.scrollResetKey + 1,
        };
      });
      return data;
    } catch (error) {
      if (seq === reqSeq.current && mounted.current) {
        setState((prev) => ({
          ...prev,
          entries: [],
          exists: false,
          selected: null,
          scrollResetKey: prev.scrollResetKey + 1,
        }));
        const message = error instanceof Error ? error.message : String(error);
        ctxRef.current.toast(message);
      }
      return null;
    } finally {
      if (seq === reqSeq.current && mounted.current) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, [side]);

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
      setState((prev) => ({
        ...prev,
        path,
        history,
        hIndex,
        selected: select,
        searchMode: false,
        query: "",
        searchText: "",
        results: [],
        truncated: false,
      }));
      return fetchList(path);
    },
    [fetchList],
  );

  const resetTo = useCallback(
    async (path: string): Promise<ListResponse | null> => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      ctxRef.current.closeDetail();
      const next: PaneState = {
        ...stateRef.current,
        path,
        history: [path],
        hIndex: 0,
        selected: null,
        searchMode: false,
        query: "",
        searchText: "",
        results: [],
        truncated: false,
      };
      stateRef.current = next;
      setState(next);
      return fetchList(path);
    },
    [fetchList],
  );

  const back = useCallback(() => {
    const current = stateRef.current;
    if (current.hIndex <= 0) return;
    const hIndex = current.hIndex - 1;
    stateRef.current = { ...current, hIndex };
    setState((prev) => ({ ...prev, hIndex }));
    void navigate(current.history[hIndex], { push: false });
  }, [navigate]);

  const forward = useCallback(() => {
    const current = stateRef.current;
    if (current.hIndex >= current.history.length - 1) return;
    const hIndex = current.hIndex + 1;
    stateRef.current = { ...current, hIndex };
    setState((prev) => ({ ...prev, hIndex }));
    void navigate(current.history[hIndex], { push: false });
  }, [navigate]);

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
  }, [navigate, side]);

  const runSearch = useCallback(async (q: string) => {
    const seq = ++reqSeq.current;
    const current = stateRef.current;
    const { getProviderKey, isHidden } = ctxRef.current;
    setState((prev) => ({
      ...prev,
      searchMode: true,
      query: q,
      selected: null,
      loading: true,
    }));
    const url =
      `/api/search?side=${side}` +
      `&provider=${encodeURIComponent(getProviderKey())}` +
      `&q=${encodeURIComponent(q)}` +
      `&scope=${current.scope}&path=${encodeURIComponent(current.path)}` +
      `&hidden=${isHidden() ? 1 : 0}`;
    try {
      const data = await getJSON<SearchResponse>(url);
      if (seq !== reqSeq.current || !mounted.current) return;
      const results = sortResults(
        data.entries || [],
        stateRef.current.sort,
        stateRef.current.dir,
        ctxRef.current.getSizeMode(),
      );
      setState((prev) => ({
        ...prev,
        results,
        truncated: Boolean(data.truncated),
        scrollResetKey: prev.scrollResetKey + 1,
      }));
    } catch (error) {
      if (seq === reqSeq.current) {
        const message = error instanceof Error ? error.message : String(error);
        ctxRef.current.toast(`Search failed: ${message}`);
      }
    } finally {
      if (seq === reqSeq.current && mounted.current) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, [side]);

  const exitSearch = useCallback(
    (reload: boolean) => {
      const wasSearching = stateRef.current.searchMode;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setState((prev) => ({
        ...prev,
        searchMode: false,
        query: "",
        results: [],
        truncated: false,
        searchText: "",
      }));
      if (reload && wasSearching) void fetchList();
    },
    [fetchList],
  );

  const onSearchInput = useCallback(
    (value: string) => {
      const q = value.trim();
      setState((prev) => ({ ...prev, searchText: value }));
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
    [exitSearch, runSearch],
  );

  const clearSearch = useCallback(() => {
    if (!stateRef.current.searchMode && !stateRef.current.searchText) return;
    exitSearch(false);
    void fetchList();
  }, [exitSearch, fetchList]);

  const setScope = useCallback(
    (scope: "all" | "folder") => {
      stateRef.current = { ...stateRef.current, scope };
      setState((prev) => ({ ...prev, scope }));
      const current = stateRef.current;
      if (current.searchMode && current.query) void runSearch(current.query);
    },
    [runSearch],
  );

  const refreshSizeDisplay = useCallback(() => {
    const current = stateRef.current;
    if (current.searchMode) {
      setState((prev) => ({
        ...prev,
        results: sortResults(
          [...prev.results],
          prev.sort,
          prev.dir,
          ctxRef.current.getSizeMode(),
        ),
      }));
    } else if (current.sort === "size") {
      void fetchList();
    }
  }, [fetchList]);

  const setSort = useCallback(
    (sort: SortKey, dir?: SortDir) => {
      const current = stateRef.current;
      const nextDir: SortDir =
        dir ?? (current.sort === sort ? (current.dir === "asc" ? "desc" : "asc") : "asc");
      stateRef.current = { ...current, sort, dir: nextDir };
      setState((prev) => {
        if (!prev.searchMode) return { ...prev, sort, dir: nextDir };
        return {
          ...prev,
          sort,
          dir: nextDir,
          results: sortResults(
            [...prev.results],
            sort,
            nextDir,
            ctxRef.current.getSizeMode(),
          ),
        };
      });
      if (!current.searchMode) void fetchList();
    },
    [fetchList],
  );

  const select = useCallback((path: string | null) => {
    setState((prev) => ({ ...prev, selected: path || null }));
  }, []);

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

  const toggleStatusFilter = useCallback((status: string) => {
    setState((prev) => {
      const next = new Set(prev.statusFilters);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      let selected = prev.selected;
      if (selected) {
        const entries = prev.searchMode ? prev.results : prev.entries;
        const visible = entries.some(
          (entry) => entry.path === selected && next.has(entry.status),
        );
        if (next.size && !visible) selected = null;
      }
      return { ...prev, statusFilters: next, selected };
    });
  }, []);

  const clearStatusFilters = useCallback(() => {
    setState((prev) => {
      if (!prev.statusFilters.size) return prev;
      return { ...prev, statusFilters: new Set(), selected: prev.selected };
    });
  }, []);

  return {
    ...state,
    side,
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
