/** Comparison status labels, ordering and counterpart resolution. */

import { fmtNum } from "./format";
import type { Entry, ProviderInfo, Side } from "./types";

export const STATUS_LABEL_REMOTE: Record<string, string> = {
  exact: "Same",
  moved: "Moved",
  possible: "Maybe",
  partial: "Partial",
  missing: "Missing",
};

export function localStatusLabel(status: string, provider: ProviderInfo): string {
  const label = provider.label || "remote";
  switch (status) {
    case "exact":
      return `In ${label}`;
    case "moved_match":
      return "Moved match";
    case "local_only":
      return "Local only";
    case "type_mismatch":
      return "Type differs";
    case "unmatched":
      return `Not in ${label}`;
    default:
      return STATUS_LABEL_REMOTE[status] || status || "—";
  }
}

export const CHIP_ORDER = [
  "missing",
  "partial",
  "possible",
  "moved",
  "type_mismatch",
  "moved_match",
  "local_only",
  "unmatched",
  "exact",
];

export const STATUS_FILTER_ORDER: Record<Side, string[]> = {
  remote: ["exact", "moved", "possible", "partial", "missing"],
  local: [
    "exact",
    "moved",
    "moved_match",
    "possible",
    "partial",
    "missing",
    "type_mismatch",
    "local_only",
    "unmatched",
  ],
};

export function statusLabel(
  entry: Pick<Entry, "status">,
  side: Side,
  provider: ProviderInfo,
): string {
  if (side === "remote") {
    return STATUS_LABEL_REMOTE[entry.status] || entry.status || "—";
  }
  return localStatusLabel(entry.status, provider);
}

export function statusTitle(entry: Entry, provider: ProviderInfo): string {
  const bits: string[] = [];
  if (entry.note) bits.push(`Report: ${entry.note}`);
  if (entry.agg && entry.agg.total) {
    const a = entry.agg;
    const parts = [
      `${fmtNum(a.exact)} same`,
      `${fmtNum(a.moved)} moved`,
      `${fmtNum(a.possible)} maybe`,
    ];
    if (a.partial) parts.push(`${fmtNum(a.partial)} partial`);
    parts.push(`${fmtNum(a.missing)} missing`);
    bits.push(`${provider.label}: ${fmtNum(a.total)} items: ${parts.join(", ")}`);
  } else if (entry.is_dir && entry.child_count != null) {
    bits.push(`${fmtNum(entry.child_count)} direct items`);
  }
  if (entry.is_dir && entry.folder_size != null) {
    bits.push(`${fmtNum(entry.folder_size)} bytes across all nested files`);
  }
  if (entry.found_at) bits.push(`Found at: ${entry.found_at}`);
  return bits.join(" · ");
}

export function counterpartTarget(entry: Entry | null, side: Side): string | null {
  if (!entry) return null;
  if (side === "remote") {
    if (entry.status === "missing") return null;
    if (entry.status === "moved" || entry.status === "possible") {
      return entry.found_at || null;
    }
    return entry.path;
  }
  if (entry.status === "local_only" || entry.status === "unmatched") return null;
  if (entry.status === "moved_match" || entry.status === "moved") {
    return entry.found_at || null;
  }
  if (entry.status === "type_mismatch") return entry.path;
  return entry.found_at || entry.path;
}
