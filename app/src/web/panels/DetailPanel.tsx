/** The per-item details sidebar. */

import { baseOf, entryType, fmtBytes, fmtDate, fmtNum } from "../lib/format";
import { iconFor } from "../lib/icons";
import { counterpartTarget } from "../lib/status";
import type { Entry, ProviderInfo, Side } from "../lib/types";
import { StatusChip } from "../components/StatusChip";
import { DetailFact, CloseIcon, useAnimatedPresence } from "./shared";

interface Props {
  open: boolean;
  side: Side;
  entry: Entry | null;
  provider: ProviderInfo;
  onClose: () => void;
  onOpenFolder: (entry: Entry) => void;
  onReveal: (entry: Entry, side: Side) => void;
}

export function DetailPanel({
  open,
  side,
  entry,
  provider,
  onClose,
  onOpenFolder,
  onReveal,
}: Props) {
  const presence = useAnimatedPresence(open);
  if (!presence.mounted) return null;

  let body: React.ReactNode = null;
  if (entry) {
    const name = entry.name || baseOf(entry.path);
    const target = counterpartTarget(entry, side);
    const notes: string[] = [];
    if (entry.note) notes.push(entry.note);
    if (entry.agg && entry.agg.total) {
      const a = entry.agg;
      const parts = [
        `${fmtNum(a.exact)} same`,
        `${fmtNum(a.moved)} moved`,
        `${fmtNum(a.possible)} maybe`,
      ];
      if (a.partial) parts.push(`${fmtNum(a.partial)} partial`);
      parts.push(`${fmtNum(a.missing)} missing`);
      notes.push(`${fmtNum(a.total)} items: ${parts.join(", ")}`);
    }

    body = (
      <>
        <div className="detail-hero">
          <span
            className="detail-icon"
            dangerouslySetInnerHTML={{ __html: iconFor(entry) }}
          />
          <div className="detail-hero-text">
            <h3 title={name}>{name}</h3>
            {entry.path && entry.path !== name && (
              <p className="detail-path" title={entry.path}>
                {entry.path}
              </p>
            )}
          </div>
        </div>

        <div className="detail-badges">
          <span className="detail-type">{entry.is_dir ? "Folder" : entryType(entry)}</span>
          <StatusChip entry={entry} side={side} provider={provider} withTitle />
        </div>

        <div className="detail-facts">
          {entry.is_dir ? (
            <>
              <DetailFact label="Folder size" value={entry.folder_size != null ? fmtBytes(entry.folder_size) : "—"} />
              <DetailFact label="Items" value={entry.child_count != null ? `${fmtNum(entry.child_count)} direct` : "—"} />
            </>
          ) : (
            <DetailFact label="Size" value={fmtBytes(entry.size)} />
          )}
          {entry.modified ? <DetailFact label="Modified" value={fmtDate(entry.modified)} /> : null}
          {entry.parent ? <DetailFact label="Folder" value={entry.parent} mono /> : null}
          {entry.found_at ? <DetailFact label="Found at" value={entry.found_at} mono /> : null}
          <DetailFact label="Source" value={side === "local" ? "Local index" : provider.label} />
        </div>

        {notes.length ? <p className="detail-note">{notes.join("\n")}</p> : null}

        <div className="detail-actions">
          {entry.is_dir ? (
            <button type="button" className="btn primary" onClick={() => onOpenFolder(entry)}>
              Open folder
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            disabled={!target}
            onClick={() => onReveal(entry, side)}
          >
            {side === "remote" ? "Show in local index" : `Show in ${provider.label}`}
          </button>
        </div>
      </>
    );
  }

  return (
    <aside
      className={`detail-panel${presence.shown ? " is-open" : ""}`}
      id="detail-panel"
      aria-labelledby="detail-title"
      hidden={!presence.mounted}
    >
      <header className="detail-panel-head">
        <div>
          <h2 id="detail-title">Details</h2>
          <p>Right-click a file or folder to inspect it.</p>
        </div>
        <button type="button" className="btn icon-btn" id="detail-close" title="Close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="detail-body" id="detail-body">
        {body}
      </div>
    </aside>
  );
}
