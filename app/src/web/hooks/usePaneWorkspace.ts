/** Creates the two panes and wires their shared shell actions. */

import { useCallback, useEffect, useRef } from "react";
import { baseOf, parentOf } from "../lib/format";
import { counterpartTarget } from "../lib/status";
import { usePane, type PaneApi } from "./usePane";
import type { Entry, ProviderInfo, Side, SizeMode } from "../lib/types";

export interface PanesRef {
  current: { local?: PaneApi; remote?: PaneApi };
}

interface Options {
  panesRef: PanesRef;
  booted: boolean;
  getProvider: () => ProviderInfo;
  getProviderKey: () => string;
  isHidden: () => boolean;
  getSizeMode: () => SizeMode;
  toast: (message: string) => void;
  setActive: (side: Side) => void;
  closeDetail: () => void;
}

export function usePaneWorkspace({
  panesRef,
  booted,
  getProvider,
  getProviderKey,
  isHidden,
  getSizeMode,
  toast,
  setActive,
  closeDetail,
}: Options) {
  const revealRef = useRef<(entry: Entry, side: Side) => void>(() => {});

  const paneContext = {
    getProvider,
    getProviderKey,
    isHidden,
    getSizeMode,
    toast,
    setActive,
    closeDetail,
    revealCounterpart: (entry: Entry, side: Side) => revealRef.current(entry, side),
    getOther: (side: Side) =>
      (side === "local" ? panesRef.current.remote : panesRef.current.local)!,
  };

  const localPane = usePane("local", paneContext, booted);
  const remotePane = usePane("remote", paneContext, booted);
  panesRef.current = { local: localPane, remote: remotePane };

  // Boot: navigate both panes to the provider root once the catalogue is ready.
  const bootRan = useRef(false);
  useEffect(() => {
    if (!booted || bootRan.current) return;
    bootRan.current = true;
    void panesRef.current.local?.navigate("", { push: false });
    void panesRef.current.remote?.navigate("", { push: false });
  }, [booted, panesRef]);

  const revealCounterpart = useCallback(
    async (entry: Entry, side: Side) => {
      const target = counterpartTarget(entry, side);
      if (!target) {
        toast(
          side === "remote"
            ? "This item has no match on the local side."
            : `This item has no counterpart in ${getProvider().label}.`,
        );
        return;
      }
      const destination =
        side === "remote" ? panesRef.current.local : panesRef.current.remote;
      if (!destination) return;
      const parent = parentOf(target);
      const name = baseOf(target);
      const data = await destination.navigate(parent, { push: true, select: target });
      if (data && !data.exists) {
        toast(`Counterpart folder not found: ${parent || "/"}`);
        return;
      }
      setActive(destination.side);
      document.querySelector<HTMLElement>(`#pane-${destination.side} .vlist`)?.focus();
      if (name) destination.select(target);
    },
    [getProvider, panesRef, setActive, toast],
  );
  revealRef.current = revealCounterpart;

  const refreshPane = useCallback((pane: PaneApi) => {
    if (pane.searchMode && pane.query) void pane.runSearch(pane.query);
    else void pane.fetchList();
  }, []);

  const refreshAll = useCallback(() => {
    const { local, remote } = panesRef.current;
    if (local) refreshPane(local);
    if (remote) refreshPane(remote);
  }, [panesRef, refreshPane]);

  return { localPane, remotePane, revealCounterpart, refreshPane, refreshAll };
}
