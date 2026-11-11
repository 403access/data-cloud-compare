/** The water-theme settings sidebar. */

import type { ThemeMode } from "../lib/types";
import type { WaterSettings } from "../lib/water";
import { CloseIcon, useAnimatedPresence } from "./shared";

interface Props {
  open: boolean;
  settings: WaterSettings;
  themeMode: ThemeMode;
  onClose: () => void;
  onReset: () => void;
  onChange: (patch: Partial<WaterSettings>) => void;
  onActivateWater: () => void;
}

const TEXT = {
  effects: {
    title: "Water effects",
    hint: "Master switch for ripples and shimmer.",
  },
  drips: {
    title: "Drips follow the cursor",
    hint: "Small, soft rings trail your pointer.",
  },
  click: {
    title: "Ripples on click",
    hint: "Clicking sends one larger ring outward.",
  },
  caustics: {
    title: "Caustic shimmer",
    hint: "Slow light patterns drift behind the app.",
  },
  rowMotion: {
    title: "Animated row highlights",
    hint: "Hover and selection colours flow between states.",
  },
  glass: {
    title: "Glass surfaces",
    hint: "Frosted panes over the moving water.",
  },
};

function SwitchRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="theme-switch-row">
      <span className="theme-switch-text">
        <span className="theme-switch-title">{title}</span>
        <span className="theme-switch-hint">{hint}</span>
      </span>
      <span className="toggle">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track">
          <span className="toggle-thumb" />
        </span>
      </span>
    </label>
  );
}

export function ThemePanel({
  open,
  settings,
  themeMode,
  onClose,
  onReset,
  onChange,
  onActivateWater,
}: Props) {
  const presence = useAnimatedPresence(open);
  if (!presence.mounted) return null;

  const isWater = themeMode === "water";
  const paused = !isWater || !settings.effects;
  let status = "Water effects are active. Drips follow your cursor.";
  if (!isWater) status = "Water effects are paused while another theme is active.";
  else if (!settings.effects) status = "Water effects are off. The theme stays calm and still.";
  else if (!settings.drips) status = "Water effects are active. Cursor drips are off.";

  return (
    <aside
      className={`theme-panel${presence.shown ? " is-open" : ""}${paused ? " is-paused" : ""}`}
      id="theme-panel"
      aria-labelledby="theme-panel-title"
      hidden={!presence.mounted}
    >
      <header className="theme-panel-head">
        <div>
          <h2 id="theme-panel-title">Water settings</h2>
          <p>Shape the current and the calm.</p>
        </div>
        <button type="button" className="btn icon-btn" id="theme-panel-close" title="Close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="theme-panel-body">
        <div className="theme-status" id="theme-status">
          <span className="theme-status-dot" aria-hidden="true" />
          <p id="theme-status-text">{status}</p>
          <button
            type="button"
            className="theme-status-action"
            id="theme-activate"
            hidden={isWater}
            onClick={onActivateWater}
          >
            Use Water
          </button>
        </div>

        <section className="theme-group">
          <h3>Effects</h3>
          <SwitchRow
            title={TEXT.effects.title}
            hint={TEXT.effects.hint}
            checked={settings.effects}
            onChange={(value) => onChange({ effects: value })}
          />
          <SwitchRow
            title={TEXT.drips.title}
            hint={TEXT.drips.hint}
            checked={settings.drips}
            onChange={(value) => onChange({ drips: value })}
          />
          <SwitchRow
            title={TEXT.click.title}
            hint={TEXT.click.hint}
            checked={settings.clickRipples}
            onChange={(value) => onChange({ clickRipples: value })}
          />
          <SwitchRow
            title={TEXT.caustics.title}
            hint={TEXT.caustics.hint}
            checked={settings.caustics}
            onChange={(value) => onChange({ caustics: value })}
          />
          <SwitchRow
            title={TEXT.rowMotion.title}
            hint={TEXT.rowMotion.hint}
            checked={settings.rowMotion}
            onChange={(value) => onChange({ rowMotion: value })}
          />
        </section>

        <section className="theme-group">
          <h3>Current</h3>
          <label className="theme-select-row">
            <span className="theme-switch-text">
              <span className="theme-switch-title">Flow speed</span>
              <span className="theme-switch-hint">How quickly the water moves.</span>
            </span>
            <select
              id="water-speed"
              className="theme-select"
              value={settings.speed}
              onChange={(event) => onChange({ speed: event.target.value })}
            >
              <option value="calm">Calm</option>
              <option value="flowing">Flowing</option>
              <option value="rapid">Rapid</option>
            </select>
          </label>
          <label className="theme-select-row">
            <span className="theme-switch-text">
              <span className="theme-switch-title">Drip energy</span>
              <span className="theme-switch-hint">How lively cursor drips feel.</span>
            </span>
            <select
              id="water-intensity"
              className="theme-select"
              value={settings.intensity}
              onChange={(event) => onChange({ intensity: event.target.value })}
            >
              <option value="subtle">Subtle</option>
              <option value="balanced">Balanced</option>
              <option value="lively">Lively</option>
            </select>
          </label>
        </section>

        <section className="theme-group">
          <h3>Look</h3>
          <label className="theme-select-row">
            <span className="theme-switch-text">
              <span className="theme-switch-title">Water tone</span>
              <span className="theme-switch-hint">Choose the palette of the sea.</span>
            </span>
            <select
              id="water-tone"
              className="theme-select"
              value={settings.tone}
              onChange={(event) => onChange({ tone: event.target.value })}
            >
              <option value="lagoon">Lagoon</option>
              <option value="ocean">Ocean</option>
              <option value="deep">Deep</option>
            </select>
          </label>
          <SwitchRow
            title={TEXT.glass.title}
            hint={TEXT.glass.hint}
            checked={settings.glass}
            onChange={(value) => onChange({ glass: value })}
          />
        </section>
      </div>
      <footer className="theme-panel-foot">
        <button type="button" className="btn ghost" id="theme-reset" onClick={onReset}>
          Reset water settings
        </button>
        <p>Saved on this device. The Water theme is available from the theme menu in the header.</p>
      </footer>
    </aside>
  );
}
