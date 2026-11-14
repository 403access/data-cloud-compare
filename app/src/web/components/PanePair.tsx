/** The local and remote file panes, wired with the shell's shared props. */

import { Pane } from "./Pane";
import type { PaneApi } from "../hooks/usePane";
import type {
  Entry,
  ProviderInfo,
  Side,
  SidebarMode,
  SizeMode,
} from "../lib/types";

interface Props {
  localPane: PaneApi;
  remotePane: PaneApi;
  provider: ProviderInfo;
  active: Side;
  hidden: boolean;
  columns: Set<string>;
  sizeMode: SizeMode;
  filterMenu: Side | null;
  sidebarMode: SidebarMode;
  sourcePanelSide: Side;
  onActivate: (side: Side) => void;
  onFilterToggle: (side: Side) => void;
  onFilterClose: () => void;
  onOpenDetail: (side: Side, entry: Entry) => void;
  onOpenSource: (side: Side) => void;
  onOpenColumns: () => void;
}

export function PanePair({
  localPane,
  remotePane,
  provider,
  active,
  hidden,
  columns,
  sizeMode,
  filterMenu,
  sidebarMode,
  sourcePanelSide,
  onActivate,
  onFilterToggle,
  onFilterClose,
  onOpenDetail,
  onOpenSource,
  onOpenColumns,
}: Props) {
  const shared = {
    provider,
    hidden,
    columns,
    sizeMode,
    sidebarMode,
    sourcePanelSide,
    onActivate,
    onFilterToggle,
    onFilterClose,
    onOpenDetail,
    onOpenSource,
    onOpenColumns,
  };

  return (
    <>
      <Pane
        {...shared}
        pane={localPane}
        active={active === "local"}
        filterOpen={filterMenu === "local"}
      />
      <Pane
        {...shared}
        pane={remotePane}
        active={active === "remote"}
        filterOpen={filterMenu === "remote"}
      />
    </>
  );
}
