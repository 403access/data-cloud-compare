/** One virtualised file-list pane (local index or remote snapshot). */

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { BASE, ROW_H } from "../lib/config";
import { COLUMN_DEFS, columnTemplate } from "../lib/columns";
import {
  baseOf,
  entryType,
  fmtBytes,
  fmtDate,
  fmtNum,
  plural,
  sizeDisplay,
} from "../lib/format";
import { entryIcon } from "../lib/icons";
import { CHIP_ORDER, statusLabel } from "../lib/status";
import type { Entry, ProviderInfo, Side, SizeMode } from "../lib/types";
import type { PaneApi } from "../hooks/usePane";
import { StatusChip } from "./StatusChip";
import { InfoIcon } from "./AppBar";

const LOCAL_PANE_ICON = `<svg viewBox="0 0 20 20" fill="none">
  <rect x="2.2" y="4" width="15.6" height="4.6" rx="1.4" fill="currentColor" opacity=".9"/>
  <rect x="2.2" y="9.2" width="15.6" height="6.8" rx="1.6" fill="currentColor" opacity=".55"/>
  <circle cx="5" cy="6.3" r=".85" fill="#fff" opacity=".85"/>
</svg>`;

const REMOTE_PANE_ICON = `<svg viewBox="0 0 20 20" fill="none">
  <path d="M10 2.2a5.7 5.7 0 0 1 5.6 4.7 3.9 3.9 0 0 1-.8 7.7H5.4a4.1 4.1 0 0 1-.7-8.1A5.7 5.7 0 0 1 10 2.2Z" fill="currentColor" opacity=".9"/>
  <path d="M10 12.4V8.2M7.9 10l2.1-2.1 2.1 2.1" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
</svg>`;

const SNAPSHOT_FLAG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <ellipse cx="8" cy="4.2" rx="5.1" ry="2.1" stroke="currentColor" stroke-width="1.2"/>
  <path d="M2.9 4.2v3.6c0 1.16 2.28 2.1 5.1 2.1s5.1-.94 5.1-2.1V4.2M2.9 7.8v3.6c0 1.16 2.28 2.1 5.1 2.1s5.1-.94 5.1-2.1V7.8" stroke="currentColor" stroke-width="1.2"/>
</svg>`;

const READONLY_FLAG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <rect x="3.4" y="7" width="9.2" height="6.2" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
  <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

const FILTER_ICON = (
  <svg className="filter-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.5 3.1h11L9.4 8.2v4.3L6.6 14V8.2L2.5 3.1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
  </svg>
);

interface Props {
  pane: PaneApi;
  provider: ProviderInfo;
  active: boolean;
  hidden: boolean;
  columns: Set<string>;
  sizeMode: SizeMode;
  filterOpen: boolean;
  sidebarMode: string | null;
  sourcePanelSide: Side;
  onActivate: (side: Side) => void;
  onFilterToggle: (side: Side) => void;
  onFilterClose: () => void;
  onOpenDetail: (side: Side, entry: Entry) => void;
  onOpenSource: (side: Side) => void;
  onOpenColumns: () => void;
}

export function Pane({
  pane,
  provider,
  active,
  columns,
  sizeMode,
  filterOpen,
  sidebarMode,
  sourcePanelSide,
  onActivate,
  onFilterToggle,
  onFilterClose,
  onOpenDetail,
  onOpenSource,
  onOpenColumns,
}: Props) {
  const side = pane.side;
  const isLocal = side === "local";
  const rootLabel = isLocal ? BASE : provider.root_label || "Archive";
  const entries = pane.currentEntries();
  const base = pane.baseEntries();
  const selected = pane.selected;
  const listRef = useRef<HTMLDivElement>(null);
  const crumbsRef = useRef<HTMLElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight || 400);
    });
    observer.observe(el);
    setViewportHeight(el.clientHeight || 400);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
    setScrollTop(0);
  }, [pane.scrollResetKey]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !selected) return;
    const index = entries.findIndex((entry) => entry.path === selected);
    if (index < 0) return;
    const top = el.scrollTop;
    const height = el.clientHeight || 400;
    if (index * ROW_H < top) {
      el.scrollTop = index * ROW_H;
      setScrollTop(el.scrollTop);
    } else if ((index + 1) * ROW_H > top + height) {
      el.scrollTop = (index + 1) * ROW_H - height + 2;
      setScrollTop(el.scrollTop);
    }
  }, [selected, entries]);

  useEffect(() => {
    const el = crumbsRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [pane.crumbs]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const end = Math.min(entries.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + 6);
  const windowEntries = entries.slice(start, end);

  let emptyText = "";
  if (!entries.length) {
    if (!pane.exists) {
      emptyText =
        `“${pane.path || "/"}” does not exist in ` +
        (isLocal ? "the local index." : `the ${provider.label} snapshot.`);
    } else if (pane.statusFilters.size && base.length) {
      emptyText = "No items match the selected status filters.";
    } else if (pane.searchMode) {
      emptyText = pane.truncated
        ? `Showing the first results for “${pane.query}”. Type more to narrow it down.`
        : `No matches for “${pane.query}”.`;
    } else {
      emptyText = "This folder is empty.";
    }
  }

  const counts = new Map<string, number>();
  for (const entry of base) {
    counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
  }
  const filterActive = pane.statusFilters.size > 0;
  const filterLabel = pane.statusFilterLabel();
  let summary: string;
  if (pane.searchMode) {
    summary = filterActive
      ? `${fmtNum(entries.length)} of ${fmtNum(base.length)} results · ${filterLabel}`
      : `${fmtNum(entries.length)}${pane.truncated ? "+" : ""} results` +
        (pane.truncated ? " · refine to narrow down" : "");
  } else if (filterActive) {
    summary =
      `Showing ${fmtNum(entries.length)} of ${fmtNum(base.length)} items · ` +
      filterLabel;
  } else {
    const stats = pane.stats;
    summary =
      `${fmtNum(stats.items)} items · ${plural(stats.dirs, "folder")} · ` +
      `${plural(stats.files, "file")} · ${fmtBytes(stats.bytes)}`;
  }

  const activeFilters = pane.activeStatusFilters();
  const filterButtonLabel =
    activeFilters.length === 0
      ? "Filter"
      : activeFilters.length === 1
        ? activeFilters[0]
        : `Filter · ${activeFilters.length}`;

  const style = {
    "--col-template": columnTemplate(columns),
    ...(isLocal ? {} : { "--remote-brand": provider.accent || "#5e5ce6" }),
  } as CSSProperties;

  function entryAt(path: string | undefined): Entry | undefined {
    if (!path) return undefined;
    return entries.find((entry) => entry.path === path);
  }

  function handleRowClick(event: React.MouseEvent<HTMLDivElement>) {
    const row = (event.target as HTMLElement).closest(".row") as HTMLElement | null;
    if (!row) return;
    onActivate(side);
    pane.select(row.dataset.path || null);
    listRef.current?.focus({ preventScroll: true });
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const row = (event.target as HTMLElement).closest(".row") as HTMLElement | null;
    if (!row) return;
    const entry = entryAt(row.dataset.path);
    if (entry) pane.activate(entry);
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    const row = (event.target as HTMLElement).closest(".row") as HTMLElement | null;
    event.preventDefault();
    if (!row) {
      onOpenColumns();
      return;
    }
    onActivate(side);
    pane.select(row.dataset.path || null);
    const entry = entryAt(row.dataset.path);
    if (entry) onOpenDetail(side, entry);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!entries.length) return;
    const index = entries.findIndex((entry) => entry.path === pane.selected);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      pane.select(entries[Math.min(entries.length - 1, index < 0 ? 0 : index + 1)].path);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      pane.select(entries[Math.max(0, index < 0 ? 0 : index - 1)].path);
    } else if (event.key === "Home") {
      event.preventDefault();
      pane.select(entries[0].path);
    } else if (event.key === "End") {
      event.preventDefault();
      pane.select(entries[entries.length - 1].path);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (index >= 0) pane.activate(entries[index]);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      pane.up();
    } else if (event.key === "Escape") {
      if (pane.searchMode || pane.searchText) pane.clearSearch();
      else pane.select(null);
    }
  }

  return (
    <section
      className={`pane${active ? " active" : ""}${!pane.exists ? " missing-path" : ""}`}
      id={isLocal ? "pane-local" : "pane-remote"}
      data-side={side}
      style={style}
      onPointerDown={() => onActivate(side)}
    >
      <div className="pane-head">
        <div className="pane-title">
          <span
            className={`pane-icon ${isLocal ? "local-icon" : "remote-icon"}`}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: isLocal ? LOCAL_PANE_ICON : REMOTE_PANE_ICON }}
          />
          <div className="pane-titles">
            <h2>
              {isLocal ? (
                <>
                  Local index <span className="root-path">{BASE}</span>
                </>
              ) : (
                <>
                  <span id="remote-provider-name">{provider.label}</span>
                  <span className="pane-sep">·</span>
                  <span className="root-path" id="remote-root-name">
                    {provider.root_label}
                  </span>
                </>
              )}
            </h2>
            <div className="source-flags" aria-label="Source type">
              <span
                className="source-flag"
                title="Read from a point-in-time snapshot"
                dangerouslySetInnerHTML={{ __html: `${SNAPSHOT_FLAG}Snapshot` }}
              />
              <span
                className="source-flag"
                title={isLocal ? "The explorer never writes to this source" : "This is a virtual, read-only view"}
                dangerouslySetInnerHTML={{ __html: `${READONLY_FLAG}Read-only` }}
              />
            </div>
          </div>
        </div>
        <div className="pane-head-actions">
          <button
            type="button"
            className="btn icon-btn source-info"
            data-role="source-info"
            data-side={side}
            title={isLocal ? "About the local index" : `About the ${provider.label} snapshot`}
            aria-label={isLocal ? "About the local index" : `About the ${provider.label} snapshot`}
            aria-haspopup="dialog"
            aria-controls="source-panel"
            aria-expanded={sidebarMode === "source" && sourcePanelSide === side}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSource(side);
            }}
          >
            <InfoIcon />
          </button>
        </div>
      </div>

      <div className="pane-toolbar">
        <div className="nav-buttons">
          <button className="btn icon-btn" data-act="back" title="Back" aria-label="Back" disabled={pane.hIndex <= 0} onClick={pane.back}>
            <svg viewBox="0 0 20 20" fill="none"><path d="m12.2 4.6-5 5.4 5 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="btn icon-btn" data-act="forward" title="Forward" aria-label="Forward" disabled={pane.hIndex >= pane.history.length - 1} onClick={pane.forward}>
            <svg viewBox="0 0 20 20" fill="none"><path d="m7.8 4.6 5 5.4-5 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="btn icon-btn" data-act="up" title="Up one folder" aria-label="Up one folder" disabled={!pane.path} onClick={pane.up}>
            <svg viewBox="0 0 20 20" fill="none"><path d="M10 16V4.8M4.9 9.6 10 4.5l5.1 5.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <nav className="breadcrumbs" data-role="crumbs" aria-label="Path" ref={crumbsRef}>
          {pane.crumbs.map((crumb, index) => (
            <Fragment key={`${crumb.path}-${index}`}>
              {index > 0 && <span className="crumb-sep">›</span>}
              <button
                className="crumb"
                title={crumb.path || rootLabel}
                onClick={() => void pane.navigate(crumb.path)}
              >
                {index === 0 ? rootLabel : crumb.name}
              </button>
            </Fragment>
          ))}
        </nav>
        <button className="btn subtle mirror-btn" data-act="mirror" title="Show the same path in the other pane" onClick={() => void pane.mirror()}>
          <span className="mirror-icon">⇄</span>
          <span className="mirror-text">Same path</span>
        </button>
      </div>

      <div className={`searchbar${pane.searchText.trim().length > 0 ? " searching" : ""}`}>
        <svg className="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.8" cy="8.8" r="5.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="m12.9 12.9 3.4 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          data-role="search"
          type="search"
          placeholder={isLocal ? "Search local index…" : `Search ${provider.label}…`}
          autoComplete="off"
          spellCheck={false}
          aria-label={isLocal ? "Search local index" : `Search ${provider.label}`}
          value={pane.searchText}
          onChange={(event) => pane.onSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              pane.clearSearch();
            } else if (event.key === "ArrowDown" || event.key === "Enter") {
              const current = pane.currentEntries();
              if (pane.searchMode && current.length) {
                event.preventDefault();
                pane.select(current[0].path);
                listRef.current?.focus();
              }
            }
          }}
        />
        <select
          data-role="scope"
          title="Search scope"
          aria-label="Search scope"
          value={pane.scope}
          onChange={(event) => pane.setScope(event.target.value as "all" | "folder")}
        >
          <option value="all">Everywhere</option>
          <option value="folder">This folder</option>
        </select>
        <div className="filter-wrap">
          <button
            className={`filter-btn${filterActive ? " active" : ""}${filterOpen ? " open" : ""}`}
            data-role="filter-toggle"
            type="button"
            aria-haspopup="true"
            aria-expanded={filterOpen}
            title={filterActive ? `Filtering by: ${activeFilters.join(", ")}` : "Filter by status"}
            onClick={(event) => {
              event.stopPropagation();
              const opening = !filterOpen;
              onFilterToggle(side);
              if (opening && event.detail === 0) {
                requestAnimationFrame(() => {
                  filterMenuRef.current?.querySelector<HTMLInputElement>("input")?.focus();
                });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filterOpen) {
                event.preventDefault();
                onFilterClose();
              }
            }}
          >
            {FILTER_ICON}
            <span data-role="filter-label">{filterButtonLabel}</span>
          </button>
          <div
            className="filter-menu"
            data-role="filter-menu"
            ref={filterMenuRef}
            hidden={!filterOpen}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onFilterClose();
              }
            }}
          >
            <div className="filter-menu-head">
              <span>Show only</span>
              <button type="button" className="filter-clear" onClick={pane.clearStatusFilters}>
                Clear all
              </button>
            </div>
            {pane.statusFilterOptions().map((option) => (
              <label className="filter-option" key={option.value}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={pane.statusFilters.has(option.value)}
                  onChange={() => pane.toggleStatusFilter(option.value)}
                />
                <span className={`filter-dot st-${option.value}`} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button
          className="btn icon-btn clear-search"
          data-role="clear"
          title="Clear search"
          hidden={pane.searchText.trim().length === 0}
          aria-label="Clear search"
          onClick={pane.clearSearch}
        >
          ×
        </button>
      </div>

      <div className="column-head" data-role="columns" onContextMenu={(event) => {
        event.preventDefault();
        onOpenColumns();
      }}>
        {COLUMN_DEFS.map((col) => (
          <button
            key={col.id}
            data-sort={col.id}
            hidden={!columns.has(col.id)}
            className={`${pane.sort === col.id ? "sorted" : ""}${pane.sort === col.id && pane.dir === "desc" ? " desc" : ""}`}
            onClick={() => pane.setSort(col.id as any)}
          >
            {col.label}
          </button>
        ))}
      </div>

      <div
        className="vlist"
        data-role="list"
        tabIndex={0}
        ref={listRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onFocus={() => onActivate(side)}
        onKeyDown={handleKeyDown}
        onClick={handleRowClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="vlist-spacer" data-role="spacer" style={{ height: entries.length * ROW_H }} />
        <div
          className="vlist-body"
          data-role="body"
          style={{ transform: `translateY(${start * ROW_H}px)` }}
        >
          {windowEntries.map((entry) => {
            const icon = entryIcon(entry);
            const size = sizeDisplay(entry, sizeMode);
            return (
              <div
                className={`row${pane.selected === entry.path ? " selected" : ""}`}
                data-path={entry.path}
                key={entry.path}
              >
                {COLUMN_DEFS.map((col) => {
                  if (!columns.has(col.id)) return null;
                  if (col.id === "name") {
                    return (
                      <div className="row-cell cell-name" key="name">
                        <span className={icon.className} dangerouslySetInnerHTML={{ __html: icon.body }} />
                        <span className="name-label" title={entry.path}>
                          {entry.name || baseOf(entry.path)}
                        </span>
                        {pane.searchMode && (
                          <span className="subpath" title={entry.parent || "/"}>
                            {entry.parent || "/"}
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (col.id === "type") {
                    return (
                      <div
                        className="row-cell cell-type"
                        key="type"
                        title={
                          !entry.is_dir && entry.size != null
                            ? `${entryType(entry)} file · ${fmtNum(entry.size)} bytes`
                            : undefined
                        }
                      >
                        {entryType(entry)}
                      </div>
                    );
                  }
                  if (col.id === "status") {
                    return (
                      <div className="row-cell cell-status" key="status">
                        <StatusChip entry={entry} side={side} provider={provider} withTitle />
                      </div>
                    );
                  }
                  if (col.id === "size") {
                    return (
                      <div className="row-cell cell-size" key="size" title={size.title || undefined}>
                        {size.text}
                      </div>
                    );
                  }
                  return (
                    <div className="row-cell cell-mod" key="modified">
                      {entry.modified ? fmtDate(entry.modified) : "—"}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="empty" data-role="empty" hidden={entries.length > 0}>
          {emptyText}
        </div>
        <div className="loading" data-role="loading" hidden={!pane.loading}>
          <span className="spinner" />
          Loading…
        </div>
      </div>

      <div className="pane-foot">
        <span data-role="summary">{summary}</span>
        <span className="mini-chips" data-role="chips">
          {CHIP_ORDER.map((status) => {
            const count = counts.get(status) || 0;
            if (!count || status === "exact") return null;
            const active = pane.statusFilters.has(status);
            return (
              <button
                key={status}
                type="button"
                className={`mini-chip st-${status}${active ? " active" : ""}`}
                title={
                  active
                    ? "Remove this status from the filter"
                    : `Add ${statusLabel({ status }, side, provider)} to the filter`
                }
                onClick={() => pane.toggleStatusFilter(status)}
              >
                <span className="dot" />
                <span>
                  {statusLabel({ status }, side, provider)} {fmtNum(count)}
                </span>
              </button>
            );
          })}
        </span>
      </div>
    </section>
  );
}

