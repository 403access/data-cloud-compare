/** JSON payloads describing providers, local sources and snapshots. */

import { statSync } from "node:fs";
import { BASE, LOCAL_DB } from "./paths";
import { cachePath, loadSummary } from "./cache";
import {
  DEFAULT_PROVIDER,
  type Provider,
  localOnlyCsv,
  publicProvider,
  reportJson,
} from "./providers";
import { PROVIDER_STATE, PROVIDERS } from "./state";

function providerSources(provider: Provider) {
  const sources: any[] = [];
  for (const [label, path] of [
    ["local_db", LOCAL_DB],
    ["archive", provider.archiveJson],
    ["report", reportJson(provider)],
    ["local_only", localOnlyCsv(provider)],
  ] as const) {
    try {
      const st = statSync(path);
      sources.push({
        label,
        path,
        mtime: st.mtimeMs / 1000,
        size: st.size,
      });
    } catch {
      sources.push({ label, path, missing: true });
    }
  }
  return sources;
}

function providerRecord(provider: Provider) {
  const state = PROVIDER_STATE.get(provider.key);
  const record: Record<string, any> = {
    ...publicProvider(provider),
    available: Boolean(state?.ready),
    reason: state?.reason ?? "",
    summary: loadSummary(provider),
    sources: providerSources(provider),
  };
  return record;
}

export function apiProviders() {
  return {
    default: DEFAULT_PROVIDER,
    providers: [...PROVIDERS.values()].map(providerRecord),
  };
}

export function apiMeta(provider: Provider) {
  return {
    provider: publicProvider(provider),
    summary: loadSummary(provider),
    sources: providerSources(provider),
    base: BASE,
    cache: cachePath(provider),
  };
}
