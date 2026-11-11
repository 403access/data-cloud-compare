/** The analytics sidebar: snapshot totals, index coverage and breakdowns. */

import { useEffect, useRef } from "react";
import { fmtBytes, fmtNum } from "../lib/format";
import { baseOf } from "../lib/format";
import type { Meta, ProviderInfo } from "../lib/types";
import { DetailFact, useAnimatedPresence } from "./shared";
import { fmtSourceDate, sourceFind } from "./SourcePanel";

const ANALYTICS_HERO = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <path d="M3.2 17V9.4M8 17V4.2M12.8 17v-5.1M17.6 17V6.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M2.2 17h15.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

function AnalyticsStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`analytics-stat${tone ? ` ${tone}` : ""}`}>
      <span className="analytics-stat-label">{label}</span>
      <strong className="analytics-stat-value">{value}</strong>
    </div>
  );
}

function CoverageRow({ pct }: { pct: number }) {
  const tone = pct > 90 ? "good" : pct > 60 ? "ok" : "low";
  return (
    <div className="analytics-coverage">
      <span className="analytics-track">
        <span
          className={`analytics-fill ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
      <span className="analytics-pct">{pct.toFixed(1)}%</span>
    </div>
  );
}

function BreakdownRow({
  label,
  bucket,
  tone,
}: {
  label: string;
  bucket: { files: number; bytes: number };
  tone?: string;
}) {
  return (
    <div className="analytics-row">
      <span className="analytics-row-label">
        <span className={`dot ${tone || ""}`} />
        {label}
      </span>
      <span className="analytics-row-count">{fmtNum(bucket.files)} files</span>
      <span className="analytics-row-size">{fmtBytes(bucket.bytes)}</span>
    </div>
  );
}

interface Props {
  open: boolean;
  meta: Meta | null;
  provider: ProviderInfo;
  onClose: () => void;
}

export function AnalyticsPanel({ open, meta, provider, onClose }: Props) {
  const presence = useAnimatedPresence(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (presence.shown) closeRef.current?.focus({ preventScroll: true });
  }, [presence.shown]);
  if (!presence.mounted) return null;

  const actualProvider: ProviderInfo = (meta?.provider as ProviderInfo) || provider;
  const summary = meta?.summary || {};
  const archive = summary.archive || {};
  const buckets = summary.buckets || {};
  const localSource = sourceFind(meta, "local_db");
  const archiveSource = sourceFind(meta, "archive");
  const pct = summary.present_pct as number | null | undefined;

  const subtitle = `${actualProvider.label} snapshot totals and index coverage.`;

  let body: React.ReactNode;
  if (!meta) {
    body = <p className="detail-note">Loading analytics…</p>;
  } else {
    const bucketRows: Array<[string, any, string]> = [
      ["Same path", buckets.exact, "good"],
      ["Moved", buckets.moved, "ok"],
      ["Maybe", buckets.possible, "warn"],
      ["Missing", buckets.missing, "low"],
    ];
    body = (
      <>
        <div className="detail-hero">
          <span
            className="detail-icon analytics-hero-icon"
            dangerouslySetInnerHTML={{ __html: ANALYTICS_HERO }}
          />
          <div className="detail-hero-text">
            <h3>{actualProvider.label} analytics</h3>
            <p className="detail-path">{actualProvider.archive || ""}</p>
          </div>
        </div>

        <div className="analytics-stats">
          <AnalyticsStat label="Files" value={fmtNum(archive.files)} />
          <AnalyticsStat label="Folders" value={fmtNum(archive.dirs)} />
          <AnalyticsStat label="Total size" value={fmtBytes(archive.bytes)} />
          <AnalyticsStat
            label="Coverage"
            value={pct != null ? `${pct.toFixed(1)}%` : "—"}
            tone={pct == null ? "" : pct > 90 ? "good" : pct > 60 ? "ok" : "low"}
          />
        </div>

        {pct != null ? <CoverageRow pct={pct} /> : null}

        <h4 className="analytics-section-title">Snapshot</h4>
        <div className="detail-facts">
          <DetailFact label="Version" value={actualProvider.snapshot_version || "—"} mono />
          <DetailFact label="Date" value={fmtSourceDate(archiveSource)} />
          <DetailFact label="Root" value={actualProvider.root_label || "—"} mono />
          <DetailFact label="Archive file" value={actualProvider.archive || "—"} mono />
        </div>

        <h4 className="analytics-section-title">Local index</h4>
        <div className="detail-facts">
          <DetailFact label="Entries" value={fmtNum(summary.db_entries)} />
          <DetailFact label="Index date" value={fmtSourceDate(localSource)} />
          <DetailFact
            label="Source"
            value={localSource?.path ? baseOf(localSource.path) : "file_indexer.db"}
            mono
          />
          {localSource && !localSource.missing ? (
            <DetailFact label="Database size" value={fmtBytes(localSource.size)} />
          ) : null}
          {summary.local_only_count != null ? (
            <DetailFact label="Local-only entries" value={fmtNum(summary.local_only_count)} />
          ) : null}
        </div>

        {bucketRows.some(([, bucket]) => bucket && bucket.files != null) ? (
          <>
            <h4 className="analytics-section-title">Status breakdown</h4>
            <div className="analytics-breakdown">
              {bucketRows
                .filter(([, bucket]) => bucket && bucket.files != null)
                .map(([label, bucket, tone]) => (
                  <BreakdownRow key={label} label={label} bucket={bucket} tone={tone} />
                ))}
            </div>
          </>
        ) : null}

        <p className="detail-note">
          Computed from the snapshot and file_indexer.db · not a live mount
        </p>
      </>
    );
  }

  return (
    <aside
      className={`analytics-panel${presence.shown ? " is-open" : ""}`}
      id="analytics-panel"
      aria-labelledby="analytics-title"
      hidden={!presence.mounted}
    >
      <header className="analytics-panel-head">
        <div>
          <h2 id="analytics-title">Analytics</h2>
          <p id="analytics-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="btn icon-btn" id="analytics-close" ref={closeRef} title="Close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="detail-body" id="analytics-body">
        {body}
      </div>
    </aside>
  );
}
