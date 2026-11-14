/** Side panels: theme, columns, detail, source and analytics. */

import { ThemePanel } from "../panels/ThemePanel";
import { ColumnsPanel } from "../panels/ColumnsPanel";
import { DetailPanel } from "../panels/DetailPanel";
import { SourcePanel } from "../panels/SourcePanel";
import { AnalyticsPanel } from "../panels/AnalyticsPanel";
import { BASE } from "../lib/config";
import type { WaterSettings } from "../lib/water";
import type {
  Entry,
  Meta,
  ProviderInfo,
  Side,
  SidebarMode,
  SizeMode,
  ThemeMode,
} from "../lib/types";

interface Props {
  sidebarMode: SidebarMode;
  sourcePanelSide: Side;
  themePanelOpen: boolean;
  waterSettings: WaterSettings;
  themeMode: ThemeMode;
  columns: Set<string>;
  sizeMode: SizeMode;
  activeSide: Side;
  activeEntry: Entry | null;
  meta: Meta | null;
  provider: ProviderInfo;
  onCloseSidebar: () => void;
  onCloseThemePanel: () => void;
  onResetWater: () => void;
  onChangeWater: (patch: Partial<WaterSettings>) => void;
  onActivateWater: () => void;
  onToggleColumn: (id: string, visible: boolean) => void;
  onResetColumns: () => void;
  onSizeMode: (mode: SizeMode) => void;
  onOpenFolder: (entry: Entry) => void;
  onReveal: (entry: Entry, side: Side) => void;
}

export function ShellPanels({
  sidebarMode,
  sourcePanelSide,
  themePanelOpen,
  waterSettings,
  themeMode,
  columns,
  sizeMode,
  activeSide,
  activeEntry,
  meta,
  provider,
  onCloseSidebar,
  onCloseThemePanel,
  onResetWater,
  onChangeWater,
  onActivateWater,
  onToggleColumn,
  onResetColumns,
  onSizeMode,
  onOpenFolder,
  onReveal,
}: Props) {
  return (
    <>
      <ThemePanel
        open={themePanelOpen}
        settings={waterSettings}
        themeMode={themeMode}
        onClose={onCloseThemePanel}
        onReset={onResetWater}
        onChange={onChangeWater}
        onActivateWater={onActivateWater}
      />

      <ColumnsPanel
        open={sidebarMode === "columns"}
        columns={columns}
        sizeMode={sizeMode}
        onToggleColumn={onToggleColumn}
        onReset={onResetColumns}
        onSizeMode={onSizeMode}
        onClose={onCloseSidebar}
      />

      <DetailPanel
        open={sidebarMode === "detail"}
        side={activeSide}
        entry={activeEntry}
        provider={provider}
        onClose={onCloseSidebar}
        onOpenFolder={onOpenFolder}
        onReveal={onReveal}
      />

      <SourcePanel
        open={sidebarMode === "source"}
        side={sourcePanelSide}
        meta={meta}
        provider={provider}
        base={BASE}
        onClose={onCloseSidebar}
      />

      <AnalyticsPanel
        open={sidebarMode === "analytics"}
        meta={meta}
        provider={provider}
        onClose={onCloseSidebar}
      />
    </>
  );
}
