/** Provider catalogue bootstrapping and per-provider metadata. */

import { useEffect, useState } from "react";
import { getJSON } from "../lib/api";
import { FALLBACK_PROVIDER, readProviderKey } from "../lib/provider";
import type { Meta, ProviderCatalog, ProviderInfo } from "../lib/types";

export function useProviderCatalog(toast: (message: string) => void) {
  const [catalog, setCatalog] = useState<ProviderCatalog>({
    list: [FALLBACK_PROVIDER],
    byKey: { [FALLBACK_PROVIDER.key]: FALLBACK_PROVIDER },
  });
  const [providerKey, setProviderKey] = useState(readProviderKey);
  const [booted, setBooted] = useState(false);
  const [metaCache, setMetaCache] = useState<Record<string, Meta>>({});

  // Boot: load the provider catalogue, then choose the saved/available provider.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJSON<{ default: string; providers: ProviderInfo[] }>(
          "/api/providers",
        );
        if (cancelled) return;
        const byKey: Record<string, ProviderInfo> = {};
        for (const info of data.providers || []) byKey[info.key] = info;
        const list = data.providers || [];
        setCatalog({ list, byKey });
        let wanted = readProviderKey();
        if (!byKey[wanted]) wanted = data.default || "jottacloud";
        if (byKey[wanted] && !byKey[wanted].available) {
          const first = list.find((info) => info.available);
          if (first) wanted = first.key;
        }
        setProviderKey(wanted);
        setBooted(true);
      } catch (error) {
        if (cancelled) return;
        toast(`Could not load provider list: ${(error as Error).message}`);
        setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Load the provider metadata used by the source/analytics sidebars.
  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    getJSON<Meta>(`/api/meta?provider=${encodeURIComponent(providerKey)}`)
      .then((data) => {
        if (cancelled) return;
        setMetaCache((prev) => ({ ...prev, [providerKey]: data }));
      })
      .catch(() => {
        /* the sidebars keep their loading state */
      });
    return () => {
      cancelled = true;
    };
  }, [providerKey, booted]);

  const provider = catalog.byKey[providerKey] || FALLBACK_PROVIDER;
  const meta = metaCache[providerKey] || null;

  return { catalog, providerKey, setProviderKey, booted, provider, meta };
}
