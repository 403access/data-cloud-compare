/** Switch the remote pane to a different provider and refresh both panes. */

import { useCallback } from "react";
import { saveProviderKey } from "../lib/provider";
import type { PanesRef } from "./usePaneWorkspace";
import type { ProviderCatalog } from "../lib/types";

interface Options {
  catalog: ProviderCatalog;
  providerKeyRef: { current: string };
  setProviderKey: (key: string) => void;
  panesRef: PanesRef;
  toast: (message: string) => void;
}

export function useProviderSwitch({
  catalog,
  providerKeyRef,
  setProviderKey,
  panesRef,
  toast,
}: Options) {
  return useCallback(
    async (key: string) => {
      if (key === providerKeyRef.current) return;
      const info = catalog.byKey[key];
      if (!info) return;
      if (!info.available) {
        toast(info.reason || `${info.label} is not available.`);
        return;
      }
      providerKeyRef.current = key;
      setProviderKey(key);
      saveProviderKey(key);
      const remote = panesRef.current.remote;
      if (!remote) return;
      const wanted = remote.path;
      const data = await remote.resetTo(wanted);
      if (data && !data.exists) await remote.resetTo("");
      const local = panesRef.current.local;
      if (local) {
        if (local.searchMode && local.query) await local.runSearch(local.query);
        else await local.fetchList();
      }
    },
    [catalog, panesRef, providerKeyRef, setProviderKey, toast],
  );
}
