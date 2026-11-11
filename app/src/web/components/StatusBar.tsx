/** Bottom status bar: current selection summary and counterpart action. */

import { fmtBytes, fmtDate, fmtNum, sizeDisplay } from "../lib/format";
import { counterpartTarget, statusLabel, statusTitle } from "../lib/status";
import type { Entry, ProviderInfo, Side, SizeMode } from "../lib/types";

interface Props {
  side: Side;
  entry: Entry | null;
  provider: ProviderInfo;
  sizeMode: SizeMode;
  onReveal: (entry: Entry, side: Side) => void;
}

export function StatusBar({ side, entry, provider, sizeMode, onReveal }: Props) {
  const target = counterpartTarget(entry, side);
  const revealLabel = side === "remote" ? "Show in local index" : `Show in ${provider.label}`;

  return (
    <footer className="statusbar">
      <div
        className="selection selection-enter"
        id="selection-info"
        key={entry ? entry.path : "empty"}
      >
        {!entry ? (
          <span className="muted">Select an item to see details.</span>
        ) : (
          <>
            <span className="sel-name" title={entry.path}>
              {entry.name || entry.path}
            </span>
            <span className="sel-meta">
              {(() => {
                const bits: string[] = [];
                if (entry.is_dir) {
                  bits.push("Folder");
                  const size = sizeDisplay(entry, sizeMode);
                  if (size.text && size.text !== "—") bits.push(size.text);
                  if (sizeMode === "bytes" && entry.child_count != null) {
                    bits.push(`${fmtNum(entry.child_count)} items`);
                  }
                } else {
                  bits.push("File");
                  bits.push(fmtBytes(entry.size));
                }
                if (entry.modified) bits.push(fmtDate(entry.modified));
                return bits.join(" · ");
              })()}
            </span>
            <span className={`status-chip st-${entry.status || "unmatched"}`} title={statusTitle(entry, provider) || undefined}>
              <span className="dot" />
              <span>{statusLabel(entry, side, provider)}</span>
            </span>
            {entry.found_at ? (
              <button
                className="sel-found"
                title={entry.found_at}
                onClick={() => onReveal(entry, side)}
              >
                Found at: {entry.found_at}
              </button>
            ) : null}
          </>
        )}
      </div>
      <button
        id="reveal-btn"
        className="btn primary"
        disabled={!target}
        onClick={() => {
          if (entry) onReveal(entry, side);
        }}
      >
        {entry ? revealLabel : "Reveal counterpart"}
      </button>
    </footer>
  );
}
