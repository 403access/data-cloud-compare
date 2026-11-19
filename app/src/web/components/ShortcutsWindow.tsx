/** Keyboard shortcut cheat sheet: review and rebind the current key map. */

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  SHORTCUT_GROUPS,
  SHORTCUT_DEFS,
  shortcutDef,
  shortcutLabel,
  shortcutsForGroup,
  conflictingShortcut,
  comboFromEvent,
  modifierPreview,
  type ShortcutBindings,
  type ShortcutGroupId,
  type ShortcutId,
} from "../lib/shortcuts";
import { CloseIcon } from "../panels/shared";
import { KeyboardIcon } from "./AppBar";

interface Props {
  open: boolean;
  shortcuts: ShortcutBindings;
  onClose: () => void;
  onChange: (id: ShortcutId, combos: string[]) => void;
  onReset: () => void;
}

function KeyParts({ parts }: { parts: string[] }) {
  return (
    <span className="shortcut-combo">
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          <kbd>{part}</kbd>
          {index < parts.length - 1 ? (
            <span className="shortcut-plus" aria-hidden="true">
              +
            </span>
          ) : null}
        </Fragment>
      ))}
    </span>
  );
}

function Combo({ combo }: { combo: string }) {
  return <KeyParts parts={combo.split("+")} />;
}

/** Compact multiple alternatives, folding a shared modifier prefix once. */
function ComboSet({ combos }: { combos: string[] }) {
  const split = combos.map((combo) => combo.split("+"));
  const prefixes = split.map((parts) => parts.slice(0, -1));
  const shared =
    prefixes.length > 1 &&
    prefixes[0].length > 0 &&
    prefixes.every((parts) => parts.join("+") === prefixes[0].join("+"))
      ? prefixes[0]
      : null;

  if (shared) {
    return (
      <span className="shortcut-combo">
        <KeyParts parts={shared} />
        {split.map((parts, index) => (
          <Fragment key={`${combos[index]}-${index}`}>
            <span className="shortcut-or" aria-hidden="true">
              /
            </span>
            <kbd>{parts[parts.length - 1]}</kbd>
          </Fragment>
        ))}
      </span>
    );
  }

  return (
    <span className="shortcut-combo">
      {combos.map((combo, index) => (
        <Fragment key={`${combo}-${index}`}>
          {index > 0 ? (
            <span className="shortcut-or" aria-hidden="true">
              /
            </span>
          ) : null}
          <Combo combo={combo} />
        </Fragment>
      ))}
    </span>
  );
}

export function ShortcutsWindow({ open, shortcuts, onClose, onChange, onReset }: Props) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  const [editing, setEditing] = useState<ShortcutId | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      setEditing(null);
      setPreview(null);
      setError("");
      const frame = requestAnimationFrame(() => {
        setShown(true);
        closeRef.current?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }

    setShown(false);
    const timer = setTimeout(() => {
      setMounted(false);
      const focused = document.activeElement as HTMLElement | null;
      if (!focused || focused === document.body || focused.closest("#shortcuts-overlay")) {
        lastFocus.current?.focus?.({ preventScroll: true });
      }
    }, 170);
    return () => clearTimeout(timer);
  }, [open]);

  const commit = useCallback(
    (id: ShortcutId, combos: string[]) => {
      const conflict = conflictingShortcut(shortcuts, id, combos);
      if (conflict) {
        setError(`${shortcutLabel(combos)} is already used by “${conflict.label}”.`);
        return;
      }
      onChange(id, combos);
      setEditing(null);
      setPreview(null);
      setError("");
    },
    [onChange, shortcuts],
  );

  // Capture the next chord while a binding is in edit mode. Capture-phase
  // listeners keep the document-level app shortcuts from firing underneath.
  useEffect(() => {
    if (!editing) {
      setPreview(null);
      return;
    }
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setEditing(null);
        setPreview(null);
        setError("");
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        commit(editing, []);
        return;
      }
      const combo = comboFromEvent(event);
      if (!combo) {
        setPreview(modifierPreview(event));
        return;
      }
      const existing = shortcuts[editing] ?? [];
      const next = existing.includes(combo) ? existing : [...existing, combo].slice(0, 4);
      commit(editing, next);
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [commit, editing, shortcuts]);

  function startEditing(id: ShortcutId) {
    setEditing(id);
    setPreview(null);
    setError("");
  }

  function handleReset() {
    setEditing(null);
    setPreview(null);
    setError("");
    onReset();
  }

  function handleWindowKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (editing) {
        setEditing(null);
        setPreview(null);
        setError("");
      } else {
        onClose();
      }
      return;
    }
    if (event.key !== "Tab" || editing) return;
    const focusables = [
      ...(overlayRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []),
    ];
    if (!focusables.length) return;
    event.preventDefault();
    const current = focusables.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? current <= 0
        ? focusables.length - 1
        : current - 1
      : (current + 1) % focusables.length;
    focusables[next].focus();
  }

  if (!mounted) return null;

  function renderRow(id: ShortcutId) {
    const def = shortcutDef(id);
    const combos = shortcuts[id] ?? [];

    if (def.pointer) {
      return (
        <div className="shortcut-row" key={def.id}>
          <span className="shortcut-action">{def.label}</span>
          <span
            className="shortcut-binding is-fixed"
            title="Pointer gesture · fixed bindings"
          >
            <ComboSet combos={def.defaults} />
          </span>
        </div>
      );
    }

    const isEditing = editing === def.id;
    return (
      <div className={`shortcut-row${isEditing ? " is-editing" : ""}`} key={def.id}>
        <span className="shortcut-action">{def.label}</span>
        <button
          type="button"
          className={`shortcut-binding${isEditing ? " is-editing" : ""}`}
          data-shortcut-id={def.id}
          title={`Add a binding for ${def.label}`}
          aria-label={`Add a binding for ${def.label}. Current: ${shortcutLabel(combos)}`}
          aria-pressed={isEditing}
          onClick={() => startEditing(def.id)}
        >
          {isEditing ? (
            <span className="shortcut-capture">
              {preview ? <Combo combo={preview} /> : <span>Press keys…</span>}
            </span>
          ) : combos.length ? (
            <ComboSet combos={combos} />
          ) : (
            <span className="shortcut-unbound">Unassigned</span>
          )}
        </button>
      </div>
    );
  }

  function renderGroup(groupId: ShortcutGroupId, showTitle: boolean) {
    const group = SHORTCUT_GROUPS.find((item) => item.id === groupId)!;
    return (
      <div className="shortcut-group" key={group.id}>
        {showTitle ? <h4>{group.label}</h4> : null}
        {shortcutsForGroup(groupId).map((def) => renderRow(def.id))}
      </div>
    );
  }

  const surfaceGroups = SHORTCUT_GROUPS.filter((group) => group.section === "surfaces");
  const overlayGroups = SHORTCUT_GROUPS.filter((group) => group.section === "overlays");
  const surfaceCount = SHORTCUT_DEFS.filter((def) => def.group !== "overlays").length;
  const overlayCount = SHORTCUT_DEFS.length - surfaceCount;

  return (
    <div
      className={`shortcuts-overlay${shown ? " is-open" : ""}`}
      id="shortcuts-overlay"
      hidden={!mounted}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="shortcuts-window"
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        aria-describedby="shortcuts-subtitle"
        onKeyDown={handleWindowKeyDown}
      >
        <header className="shortcuts-head">
          <span className="shortcuts-mark" aria-hidden="true">
            <KeyboardIcon />
          </span>
          <div className="shortcuts-head-text">
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <p id="shortcuts-subtitle">Ctrl + Alt for VNC · Super also works</p>
          </div>
          <span className="shortcuts-preset">
            <span className="shortcuts-preset-dot" aria-hidden="true" />
            Simple (default)
          </span>
          <button
            type="button"
            className="btn icon-btn shortcuts-close"
            ref={closeRef}
            title="Close"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="shortcuts-body">
          <section className="shortcuts-section" aria-labelledby="shortcuts-surfaces">
            <div className="shortcuts-section-head">
              <h3 id="shortcuts-surfaces">Surfaces</h3>
              <span>{surfaceCount}</span>
            </div>
            <div className="shortcuts-groups">
              {surfaceGroups.map((group) => renderGroup(group.id, true))}
            </div>
          </section>

          <section className="shortcuts-section" aria-labelledby="shortcuts-overlays">
            <div className="shortcuts-section-head">
              <h3 id="shortcuts-overlays">Overlays</h3>
              <span>{overlayCount}</span>
            </div>
            <p className="shortcuts-section-hint">
              {shortcuts["close-overlay"].length ? (
                <ComboSet combos={shortcuts["close-overlay"]} />
              ) : (
                <span>Unassigned</span>
              )}{" "}
              close
              <span className="shortcuts-dot">·</span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate overlays
              <span className="shortcuts-dot">·</span>
              {shortcuts["activate-selection"].length ? (
                <ComboSet combos={shortcuts["activate-selection"]} />
              ) : (
                <span>Unassigned</span>
              )}{" "}
              activate
            </p>
            <div className="shortcuts-groups">
              {overlayGroups.map((group) => renderGroup(group.id, false))}
            </div>
          </section>
        </div>

        {error ? (
          <div className="shortcuts-alert" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="shortcuts-foot">
          <button type="button" className="btn ghost" id="shortcuts-reset" onClick={handleReset}>
            Reset to simple defaults
          </button>
          <p>
            Click a key to add a binding · <kbd>Esc</kbd> cancel · <kbd>⌫</kbd> clear
          </p>
        </footer>
      </div>
    </div>
  );
}
