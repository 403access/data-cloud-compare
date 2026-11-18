# Water design system

The design language of **Data Cloud Compare**, distilled from the explorer's water
theme. It is plain CSS custom properties plus one dependency-free ES module — no
framework, no build step, no image assets.

- **Live showcase:** `/design-system/` in the assembled site.
- **OS concept:** `/design-system/os/` — a desktop environment composed from the
  same tokens and components.
- **Tokens:** [`tokens.css`](tokens.css)
- **Components:** [`components.css`](components.css)
- **Water effects:** [`water.js`](water.js)

```bash
bun scripts/assemble-site.ts   # copies this folder to dist/design-system/
```

## The water model

| Layer | Role | Implementation |
| --- | --- | --- |
| **Sea** | Depth, tone, place | Fixed radial + linear gradients via `--ds-bg-grad` |
| **Currents** | Ambient motion | Three SVG wave bands, different speeds and directions |
| **Caustics** | Light under water | Five low-alpha radial gradients on a canvas |
| **Glass** | Working surfaces | Translucent panels with `backdrop-filter: blur(18px)` |
| **Tide** | Active edge | Wavy gradient rim on hovered or focused windows |
| **Drops** | Feedback | Throttled pointer rings and a larger click ripple |

Rules:

1. Water is the default brand theme. Light is a "shallow water" variant, not a
   separate identity.
2. There is exactly one accent current. Status colours are semantic and separate.
3. Ambient motion is slow (14–58s cycles). Interface motion is fast (160–340ms).
4. Every effect can be switched off. `prefers-reduced-motion` disables it
   automatically.
5. Colour never carries meaning alone. Status pills always have a label and dot.

## Tones

Set `data-water-tone` on `<html>`:

| Tone | Accent | Background | Use |
| --- | --- | --- | --- |
| `lagoon` | `#55F0E0` | `#06414C` | Bright, optimistic marketing moments |
| `ocean` | `#38D6FF` | `#06232E` | Default product theme |
| `deep` | `#48B7FF` | `#03121F` | Quiet, archival, late-night |

Also available:

```html
<html
  data-water-tone="ocean"
  data-water-background="sea"   <!-- still | sea -->
  data-water-effects="on"       <!-- on | off -->
  data-water-speed="flowing"    <!-- calm | flowing | rapid -->
  data-theme="light"            <!-- shallow light variant -->
>
```

## Tokens

All tokens are namespaced `--ds-*`:

- **Colour** — `--ds-bg`, `--ds-surface`, `--ds-glass`, `--ds-text`, `--ds-text-2`,
  `--ds-text-3`, `--ds-line`, `--ds-accent`, `--ds-accent-rgb`, `--ds-glow`.
- **Status** — `--ds-green`, `--ds-blue`, `--ds-amber`, `--ds-orange`, `--ds-red`,
  `--ds-violet`, `--ds-gray`, `--ds-pink`, each with a matching `-bg`.
- **Type** — `--ds-font`, `--ds-font-mono`, `--ds-text-2xs` through `--ds-text-4xl`.
- **Space** — `--ds-space-1` (4px) through `--ds-space-13` (96px).
- **Radius** — `--ds-radius-xs` (5px) through `--ds-radius-2xl` (26px),
  plus `--ds-radius-pill`.
- **Elevation** — `--ds-shadow-soft`, `--ds-shadow`, `--ds-shadow-pop`.
- **Motion** — `--ds-motion-fast`, `--ds-motion-base`, `--ds-motion-layout`,
  `--ds-ease-out`.
- **Layout** — `--ds-content` (1180px), `--ds-header-h` (62px), `--ds-focus-ring`.

## Components

Everything uses the `ds-` prefix so it can coexist with Docusaurus or the app
stylesheet.

| Component | Classes |
| --- | --- |
| Button | `.ds-btn` + `--primary`, `--ghost`, `--quiet`, `--danger`, `--small`, `--block`; `.ds-icon-btn` |
| Verdict badge | `.ds-badge` + `--same`, `--moved`, `--possible`, `--partial`, `--missing`, `--local`, `--type`, `--muted`, `--solid` |
| Chip / key | `.ds-chip`, `.ds-kbd` |
| Card | `.ds-card` + `--quiet`, `--glass`, `--accent`; `.ds-card__icon`, `.ds-card__eyebrow` |
| Callout | `.ds-callout` + `--warning`, `--danger` |
| Form | `.ds-field`, `.ds-label`, `.ds-hint`, `.ds-input`, `.ds-select`, `.ds-check` |
| Switch | `.ds-switch` + `__track` + `__thumb` |
| Segmented | `.ds-segmented`, `.ds-segment` |
| Breadcrumb | `.ds-breadcrumbs`, `.ds-crumb`, `.ds-crumb-sep` |
| Search | `.ds-search` |
| Scroll area | `.ds-scroll` |
| Pane | `.ds-pane` + `__head`, `__title`, `__icon`, `__titles`, `__toolbar`, `__columns`, `__rows`, `__row`, `__name`, `__size`, `__foot` |
| Command bar | `.ds-command` + `__input`, `__list`, `__group`, `__item`, `__foot` |
| Toast | `.ds-toast` |
| Stat | `.ds-stat` + `__value`, `__label` |
| Water | `.ds-sea`, `.ds-wave` + `--far`, `--mid`, `--near`; `.ds-ripple-pond` |

Example:

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">

<html data-water-tone="ocean" data-water-background="sea">
  <button class="ds-btn ds-btn--primary">Reveal counterpart</button>
  <span class="ds-badge ds-badge--moved"><span class="ds-dot"></span>Moved</span>
</html>
```

## Water surface

```js
import { WaterSurface } from "./water.js";

const water = new WaterSurface(document.querySelector("#water-fx"), {
  tone: "ocean",
  speed: "flowing",
  intensity: "subtle",
  effects: true,
  drips: true,
  clickRipples: true,
  caustics: true,
});

water.setTone("lagoon");
water.setEnabled(false);
```

Pass `scope` to confine pointer events to one element (used by the ripple pond).
The canvas must be positioned over the area it decorates. The module caps the
device pixel ratio at 1.5, limits itself to 90 live ripples, and stops rendering
when the tab is hidden.

## Accessibility

- Motion stops under `prefers-reduced-motion: reduce`.
- Decorative layers are `aria-hidden="true"` and `pointer-events: none`.
- Focus uses `--ds-focus-ring`; it is never removed.
- Status pills pair colour with a text label and a dot.
- The water controls in the showcase expose `aria-pressed`.
- Interactive text meets contrast on `--ds-surface` in both themes.

## Aether OS concept

[`os/`](os/index.html) is a desktop-environment concept: a glass menu bar, a
dock, draggable and resizable windows, and a command bar built around a
faithful reproduction of the real Data Cloud Compare application, plus a
single-pane Explorer.

- The Data Cloud Compare window follows `app/src/web`: app bar, two
  five-column panes, toolbar and breadcrumbs, search with scope and status
  filters, sortable columns, pane footers, selection status bar, and the
  columns, details, source, and analytics side panels.
- The Explorer window is one plain explorer UI instance: places sidebar,
  breadcrumbs, search, sortable columns, keyboard navigation, and a read-only
  local index.
- Settings is a searchable two-column window with tabs for General, Appearance,
  Displays, Desktop & Dock, Search & Commands, Accessibility, Network,
  Bluetooth, Sound, Battery, Notifications, Privacy & Security, and Storage.
  The Appearance tab mirrors the app's theme sidebar: effects, drips, click
  ripples, caustics, row motion, window waves, flow speed, drip energy,
  background, tone, glass surfaces, reset, and the paused/active status
  callout. Connection, device, sound, and battery tabs share live state with
  the tray and the standalone apps.
- Active and hovered windows, plus the command bar, carry a liquid tide line:
  a masked conic-gradient ring displaced by an animated SVG turbulence filter.
  The **Window waves** setting offers Off, Calm, Tide, and Surge, and the ring
  follows Flow speed. The border itself shifts from the neutral line to an
  accent tint on hover, a stronger accent and glow on focus, and the brightest
  rim when a focused window is also hovered. Ring animation stops under
  `prefers-reduced-motion`. The choice is saved as `explorer-os-window-wave`
  (mirrored in `explorer-water-settings`) and applies before paint.
- Every window can be resized from any outside edge or corner. The resize bands
  follow the inside of the border, preserve a 280 × 180 minimum, stay inside
  the desktop, and use the family's line-icon language for the bottom-right
  grip. Handles are hidden below 820px, where windows become full-width stacked
  panels.
- The command bar mirrors the app's command catalog and file search: Navigation,
  Search, View, Columns, Sort, Filters, Appearance, and Provider groups, `>`
  commands-only mode, fuzzy matching, and local/remote file results.
- Menu bar tray items open their own popovers: Wi-Fi (current network, known
  networks, signal strength, VPN), Bluetooth (connected mouse and keyboard,
  battery meters, Bluetooth switch), Battery (level, time, energy mode,
  low-power mode), Sound (volume, mute, output, now playing), and Calendar
  (month grid, event dots, day selection). One shared controller keeps a single
  panel open and closes it on outside click, `Esc`, a menu, or the command bar.
- Each popover opens a dedicated system app: **Network** (Wi-Fi/VPN switches,
  networks, connection details), **Devices** (Bluetooth and discoverable
  switches, paired accessories, battery levels, connect/disconnect),
  **Battery** (charge gauge, energy and charging controls, health, consumers),
  and **Calendar** (month navigation and a day agenda). All are also in the
  Window menu and command bar. Tray and app share in-session state, so joining
  a network, connecting an accessory, or changing an energy mode is reflected
  in both.
- The menu bar also carries three resource meters: CPU usage, RAM usage, and
  free storage in GB. They are computed from the Task Manager's process table,
  update with each sample, and open the Task Manager when clicked. Space is
  reclaimed progressively: the storage label drops below 1260px, the snapshot
  chip below 1180px, and the theme/gallery icons and clock date between 821 and
  1100px. The CPU and RAM labels and all three meters stay visible until phone
  width.
- **Task Manager** shows CPU, memory, and storage cards above a usage chart for
  CPU and memory with adjustable one-minute, five-minute, fifteen-minute, and
  one-hour time frames. It samples every six seconds (or on demand), updates
  rows and charts in place, and lets you select and end a process, which
  recalculates the totals and meters. Processes are grouped into expandable
  parent/child trees, carry a purpose category (Apps, Media, System, Sync,
  Indexing, Security), and can be filtered by those categories. Selecting a
  process opens a process-details sidebar with its PID, parent, category,
  status, usage, thread count, uptime, and a description; ending a group also
  ends its child processes. Its **Display** button opens the menu bar usage
  settings in the same right-hand sidebar instead of expanding the process
  stack: show in menu bar, border (off by default), captions, bars, values, and
  dividers (off by default). Border and dividers are independent finishes. Choices are saved as
  `explorer-os-resource-display`, apply before paint, and reset to the defaults
  from the same sidebar.
- **Devices** shows the paired Tide Mouse, Harbour Keyboard, and Drift Earbuds
  with colour-coded battery meters. Disconnecting an accessory removes it from
  the tray menu, and turning Bluetooth off disables the accessory controls
  while preserving the paired state for the next time it is enabled.
- **App Studio** is a GUI builder with an editable project for every
  application on the desktop except itself. New custom apps can start blank or
  copy an existing project. Components drag and resize on a 16:10 artboard,
  and any component can bind to a searchable catalog of live system variables
  covering appearance and design tokens, resources, battery, network,
  devices, calendar, the explorer model, media, the terminal, and the studio
  itself. Projects persist in `localStorage` and reset from the footer.
- **Terminal** is a working simulated shell, not a static transcript. Click the
  window and type: `help` lists what it knows (`tank compare [--provider
  jottacloud|gdrive]`, `ls`, `cat`, `open <app>`, `clear`, `whoami`, `pwd`,
  `date`, `echo`, `exit`), Enter runs it, and **Run again** replays the
  comparison. Output starts after the scripted opening transcript, and the
  caret stays in the prompt while you select or copy earlier lines. Nothing is
  executed: every command is answered locally in the page.
- Every scrollable window surface uses `.ds-scroll`: a 10px transparent track,
  a rounded `--ds-text-3` thumb, and an accent-tinted hover. Firefox gets the
  native thin scrollbar via an `@supports` fallback so it does not lose the
  token colours.
- Settings includes a **Font size** choice under Appearance and Accessibility. **Comfortable** is the
  default and matches the live explorer demo; **Compact** restores the tighter
  original concept type, and **Large** adds a step beyond it. The choice is
  saved as `explorer-os-font-size` (mirrored in `explorer-water-settings`),
  applies before paint, and scales both fixed OS text and the shared
  `--ds-text-*` tokens.
- One viewport-wide water canvas sits above the windows, menu bar, and dock
  (below the command bar and toasts) and listens on `window`, so caustics, cursor
  drips, and click ripples play across every surface, not just the desktop.
- Appearance preferences use the same storage keys as the app
  (`explorer-theme`, `explorer-water-settings`, `explorer-provider`) and also
  write `dcc-design-prefs` so the gallery follows the same tone and theme.
- Window chrome, the dock, and desktop widgets are local layout plus `--ds-*`
  tokens.
- Keyboard: `⌘K` / `Ctrl K` opens the command bar, `⌘F` focuses the explorer
  search, `⌘1` / `⌘2` focus a pane, `⌘,` opens water settings, and `Esc`
  closes tray panels, menus, and overlays.

## Files

```text
design-system/
  tokens.css       canonical tokens and tones
  components.css   component primitives
  water.js         caustics, drips, and ripples
  index.html       component showcase
  showcase.css     showcase-only layout
  showcase.js      showcase controls
  os/              Aether OS desktop concept
    index.html     desktop shell, windows, dock, command bar
    os.css         stylesheet entry; imports css/*.css in cascade order
    css/           one stylesheet per surface or app
    js/main.js     module entry; imports features and starts the desktop
    js/core/       shared state, fixture data, helpers, toasts
    js/shell/      windows, popovers, clock, command bar, shortcuts
    js/compare/    comparison model, view, interactions, verify
    js/features/   appearance and water settings
    js/apps/       explorer, calendar, network, devices, battery, music, sound, terminal, task manager
```

See [`os/README.md`](os/README.md) for the module map and naming conventions.
