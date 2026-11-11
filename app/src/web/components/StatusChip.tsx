/** Comparison status chip used by rows, panels and the legend. */

import type { Entry, ProviderInfo, Side } from "../lib/types";
import { statusLabel, statusTitle } from "../lib/status";

interface Props {
  entry: Pick<Entry, "status"> & Partial<Entry>;
  side: Side;
  provider: ProviderInfo;
  withTitle?: boolean;
}

export function StatusChip({ entry, side, provider, withTitle = false }: Props) {
  const label = statusLabel(entry, side, provider);
  const title = withTitle ? statusTitle(entry as Entry, provider) : "";
  return (
    <span className={`status-chip st-${entry.status || "unmatched"}`} title={title || undefined}>
      <span className="dot" />
      <span className="status-chip-label">{label}</span>
    </span>
  );
}
