/** Provider catalogue defaults and the persisted provider choice. */

import { PROVIDER_STORAGE_KEY } from "./config";
import type { ProviderInfo } from "./types";

export const FALLBACK_PROVIDER: ProviderInfo = {
  key: "jottacloud",
  label: "Jottacloud",
  root_label: "Archive",
  subtitle: "archive.json snapshot · virtual read-only view",
  accent: "#5e5ce6",
  archive: "archive.json",
  available: true,
  reason: "",
};

export function readProviderKey(): string {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY) || "jottacloud";
  } catch {
    return "jottacloud";
  }
}

export function saveProviderKey(key: string): void {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
}
