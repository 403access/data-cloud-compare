/** Provider catalogue bootstrapping and per-provider metadata. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FALLBACK_PROVIDER, readProviderKey } from "../lib/provider";
import { metaQuery, providersQuery } from "../lib/queries";
import type { Meta, ProviderCatalog, ProviderInfo } from "../lib/types";

export function useProviderCatalog(toast: (message: string) => void) {
  const [providerKey, setProviderKey] = useState(readProviderKey);
  const [booted, setBooted] = useState(false);
  const selectionRan = useRef(false);
  const errorReported = useRef(false);
  const providersResult = useQuery(providersQuery);
  const data = providersResult.data;

  const catalog = useMemo<ProviderCatalog>(() => {
    if (!data) {
      return {
        list: [FALLBACK_PROVIDER],
        byKey: { [FALLBACK_PROVIDER.key]: FALLBACK_PROVIDER },
      };
    }
    const list = data.providers || [];
    const byKey: Record<string, ProviderInfo> = {};
    for (const info of list) byKey[info.key] = info;
    return { list, byKey };
  }, [data]);

  const { byKey } = catalog;

  // Boot: choose the saved/available provider once the catalogue arrives.
  useEffect(() => {
    if (!data || selectionRan.current) return;
    selectionRan.current = true;
    let wanted = readProviderKey();
    if (!byKey[wanted]) wanted = data.default || "jottacloud";
    if (byKey[wanted] && !byKey[wanted].available) {
      const first = data.providers.find((info) => info.available);
      if (first) wanted = first.key;
    }
    setProviderKey(wanted);
    setBooted(true);
  }, [data, byKey]);

  useEffect(() => {
    if (!providersResult.isError || errorReported.current) return;
    errorReported.current = true;
    toast(
      `Could not load provider list: ${(providersResult.error as Error).message}`,
    );
    setBooted(true);
  }, [providersResult.isError, providersResult.error, toast]);

  const metaResult = useQuery({ ...metaQuery(providerKey), enabled: booted });
  const meta: Meta | null = metaResult.data ?? null;

  const provider = catalog.byKey[providerKey] || FALLBACK_PROVIDER;
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const providerKeyRef = useRef(providerKey);
  providerKeyRef.current = providerKey;

  const getProvider = useCallback(() => providerRef.current, []);
  const getProviderKey = useCallback(() => providerKeyRef.current, []);

  return {
    catalog,
    providerKey,
    setProviderKey,
    booted,
    provider,
    meta,
    providerKeyRef,
    getProvider,
    getProviderKey,
  };
}
