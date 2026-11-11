/** The source-details sidebar for the local index or the remote snapshot. */

import { useEffect, useRef } from "react";
import { DATE, fmtBytes, fmtNum } from "../lib/format";
import { baseOf } from "../lib/format";
import type { Meta, ProviderInfo, Side, SourceInfo } from "../lib/types";
import { DetailFact, CloseIcon, useAnimatedPresence } from "./shared";

const LOCAL_HERO = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <rect x="2.2" y="4" width="15.6" height="4.6" rx="1.4" fill="currentColor" opacity=".9"/>
  <rect x="2.2" y="9.2" width="15.6" height="6.8" rx="1.6" fill="currentColor" opacity=".55"/>
  <circle cx="5" cy="6.3" r=".85" fill="#fff" opacity=".85"/>
</svg>`;

const REMOTE_HERO = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <path d="M10 2.2a5.7 5.7 0 0 1 5.6 4.7 3.9 3.9 0 0 1-.8 7.7H5.4a4.1 4.1 0 0 1-.7-8.1A5.7 5.7 0 0 1 10 2.2Z" fill="currentColor" opacity=".9"/>
  <path d="M10 12.4V8.2M7.9 10l2.1-2.1 2.1 2.1" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
</svg>`;

export function fmtSourceDate(source: SourceInfo | null | undefined): string {
  if (!source || source.missing || !source.mtime) return "unknown date";
  return DATE.format(new Date(source.mtime * 1000));
}

export function sourceFind(meta: Meta | null, label: string): SourceInfo | null {
  return (meta?.sources || []).find((source) => source.label === label) || null;
}

interface Props {
  open: boolean;
  side: Side;
  meta: Meta | null;
  provider: ProviderInfo;
  base: string;
  onClose: () => void;
}

export function SourcePanel({ open, side, meta, provider, base, onClose }: Props) {
  const presence = useAnimatedPresence(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (presence.shown) closeRef.current?.focus({ preventScroll: true });
  }, [presence.shown]);
  if (!presence.mounted) return null;

  const isLocal = side === "local";
  const actualProvider: ProviderInfo = (meta?.provider as ProviderInfo) || provider;
  const localSource = sourceFind(meta, "local_db");
  const archiveSource = sourceFind(meta, "archive");
  const summary = meta?.summary || {};
  const archive = summary.archive || {};

  const title = isLocal ? "Local index" : `${actualProvider.label} snapshot`;
  const subtitle = isLocal
    ? "Reference side for every comparison."
    : "Remote side of the comparison.";

  let body: React.ReactNode;
  if (!meta) {
    body = <p className="detail-note">Loading source details…</p>;
  } else {
    body = (
      <>
        <div className="detail-hero">
          <span
            className={`detail-icon source-hero-icon ${isLocal ? "local" : "remote"}`}
            dangerouslySetInnerHTML={{ __html: isLocal ? LOCAL_HERO : REMOTE_HERO }}
          />
          <div className="detail-hero-text">
            <h3>{isLocal ? "Local index" : `${actualProvider.label} snapshot`}</h3>
            <p className="detail-path">
              {isLocal
                ? localSource?.path || "file_indexer.db"
                : actualProvider.archive || ""}
            </p>
          </div>
        </div>

        <div className="detail-badges">
          <span className="detail-type">{isLocal ? "SQLite index" : "Remote listing"}</span>
          <span className="source-pill">Snapshot</span>
          <span className="source-pill">Read-only</span>
        </div>

        <div className="detail-facts">
          {isLocal ? (
            <>
              <DetailFact
                label="Source"
                value={localSource?.path ? baseOf(localSource.path) : "file_indexer.db"}
                mono
              />
              <DetailFact label="Root" value={base || "/mnt/tank"} mono />
              <DetailFact label="Index date" value={fmtSourceDate(localSource)} />
              <DetailFact label="Entries" value={fmtNum(summary.db_entries)} />
              {localSource && !localSource.missing ? (
                <DetailFact label="Database size" value={fmtBytes(localSource.size)} />
              ) : null}
            </>
          ) : (
            <>
              <DetailFact label="Provider" value={actualProvider.label} />
              <DetailFact label="Snapshot version" value={actualProvider.snapshot_version || "—"} mono />
              <DetailFact label="Snapshot date" value={fmtSourceDate(archiveSource)} />
              <DetailFact label="Archive file" value={actualProvider.archive || "—"} mono />
              <DetailFact label="Root" value={actualProvider.root_label || "—"} mono />
              <DetailFact label="Files" value={fmtNum(archive.files)} />
              <DetailFact label="Folders" value={fmtNum(archive.dirs)} />
              <DetailFact label="Size" value={fmtBytes(archive.bytes)} />
              {actualProvider.rclone_remote ? (
                <DetailFact label="Remote" value={actualProvider.rclone_remote} mono />
              ) : null}
              {summary.present_pct != null ? (
                <DetailFact label="Coverage" value={`${Number(summary.present_pct).toFixed(1)}%`} />
              ) : null}
            </>
          )}
        </div>

        <div className="source-compare">
          <span className="source-compare-side">
            local index <b>({fmtSourceDate(localSource)})</b>
          </span>
          <span className="source-compare-arrow">⇄</span>
          <span className="source-compare-side">
            {actualProvider.label.toLowerCase()} snapshot <b>({fmtSourceDate(archiveSource)})</b>
          </span>
        </div>

        <p className="detail-note">
          {isLocal
            ? "file_indexer.db snapshot · not a live mount"
            : actualProvider.subtitle || "snapshot · virtual read-only view"}
        </p>
      </>
    );
  }

  return (
    <aside
      className={`source-panel${presence.shown ? " is-open" : ""}`}
      id="source-panel"
      aria-labelledby="source-title"
      hidden={!presence.mounted}
    >
      <header className="source-panel-head">
        <div>
          <h2 id="source-title">{title}</h2>
          <p id="source-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="btn icon-btn" id="source-close" ref={closeRef} title="Close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="detail-body" id="source-body">
        {body}
      </div>
    </aside>
  );
}
