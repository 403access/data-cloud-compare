# Aether OS concept

A desktop environment built from the Water design system tokens. The page is a
single static document with no build step: `index.html` loads one stylesheet
entry and one ES module entry.

## Entry points

| File | Role |
| --- | --- |
| `index.html` | Document shell: sprite, menu bar, windows, dock, tray markup |
| `os.css` | Stylesheet entry; imports every file in `css/` in cascade order |
| `js/boot-theme.js` | Classic pre-paint script that applies saved preferences |
| `js/main.js` | ES module entry; imports features, then starts the desktop |

## Structure

```text
os/
  index.html
  os.css                 stylesheet entry
  css/                   one file per surface or app
    foundation.css       font scale, root, sea, shell
    menubar.css          menu bar, menus, tray buttons
    desktop.css          desktop canvas and right-rail widgets
    windows.css          window chrome, tide ring, resize handles, titlebar, tabs
    file-explorer.css     single-pane Explorer shell, places, and rows
    compare.css          Data Cloud Compare shell, panes, rows, status bar
    inspector.css        details, source, and analytics sidebars
    terminal.css         terminal window
    music.css            Tide Radio window
    about.css            About window
    dock.css             dock
    overlays.css         command overlay and toasts
    layout.css           responsive and motion rules for the shell
    app-shell.css        in-window application chrome
    app-panes.css        app pane tables and status bar
    side-panel.css       app side panels
    settings-app.css     tabbed Settings window, sidebar, panes, and controls
    shortcuts.css        shortcuts window
    command-bar.css      command bar results
    appearance.css       non-water background overrides
    app-responsive.css   responsive and motion rules for in-window apps
    tray.css             tray popovers and calendar
    network.css          network popover rows
    system-apps.css      shared system-app panel layout
    devices.css          Devices app
    battery.css          Battery app
    sound.css            Sound tray
    task-manager.css     Task Manager
    calendar-app.css     Calendar app
    menu-meters.css      menu bar resource meters
    builder.css          App Studio GUI builder
    sidebar-resize.css   shared resizable app-sidebar handles
  js/
    main.js
    boot-theme.js
    core/
      state.js           option catalogs, preferences, mutable state
      data.js            comparison fixture data
      utils.js           escaping, formatting, motion queries
      toast.js           toast host
    shell/
      clock.js           time and date labels
      popovers.js        menu bar menus and tray panels
      windows.js         drag, resize, focus, dock state, split/overlap layout
      sidebar-resize.js  pointer and keyboard resizing for every app sidebar
      menu-bar-usage.js  CPU/RAM/storage meter preferences
      command-catalog.js command inventory and fuzzy file matching
      command-bar.js     command overlay and keyboard selection
      command-settings.js command palette source and condition settings
      commands.js        data-cmd dispatcher
      shortcuts.js       global key map
    compare/
      model.js           status, path, filter, sort, and counterpart selectors
      view.js            panes, status bar, side panels, selection actions
      interactions.js    comparison DOM event wiring
      verify.js          snapshot verification animation
    features/
      appearance.js      theme, tone, water settings, WaterSurface
    apps/
      explorer.js        single-pane file browser over the local index
      calendar.js        calendar tray and Calendar app
      network.js         Wi-Fi and VPN state
      devices.js         Bluetooth accessories
      battery.js         charge and energy mode
      music.js           Tide Radio playback
      sound.js           volume, mute, now playing
      settings.js        Settings tabs, search, saved preferences, panes
      terminal.js        simulated shell
      task-processes.js  process catalog fixtures
      task-manager.js    process tree, charts, sampler
      builder-projects.js App Studio project seeds and component palette
      builder-variables.js live system-variable catalog
      gui-builder.js     project rail, artboard, inspector, variable binding
```

## Command palette

The command bar (`⌘K`) merges fuzzy file matches with commands grouped as
Navigation, Search, View, Columns, Sort, Filters, Appearance, System, and
Provider. Settings owns the palette controls under **Search & Commands**:
commands on or off, local and remote file sources, how many characters trigger
file search, whether inactive navigation commands are hidden, and which command
groups appear. Preferences persist under `explorer-command-palette`; the gear in
the command bar footer, **Open command palette settings** in the palette, and
`⌘,` in the palette all jump to the tab.

## Settings

`Settings` is a two-column window: a searchable sidebar of topics and a scrolling
pane for the selected topic. The tabs are General, Appearance, Displays,
Desktop & Dock, Search & Commands, Accessibility, Network, Bluetooth, Sound,
Battery, Notifications, Privacy & Security, and Storage.

- Appearance wraps the Water controls, so theme, tone, speed, drips, glass, font
  size, and window layout keep using the same saved preferences as the rest of
  the desktop.
- Desktop & Dock controls the shared window layout and hides the right-rail
  shortcut grid and widget stack independently, so the desktop can run with
  neither.
- Network, Bluetooth, Sound, and Battery reuse the live state owned by their
  feature modules. Changes made in Settings are reflected in the tray, the
  standalone apps, and the command bar.
- The remaining controls persist in `explorer-os-settings-v1`; the selected tab
  persists in `explorer-os-settings-tab`.
- `⌘,`, the dock, desktop, and menu bar items open Settings. Tray shortcuts jump
  directly to Network, Bluetooth, or Battery, and the command palette's gear
  opens Search & Commands.

## App Studio

`App Studio` is the desktop's GUI builder. It opens with one editable project
for every application on the system — Explorer, Data Cloud Compare, Settings,
Network, Devices, Battery, Calendar, Task Manager, Terminal, Tide Radio,
Keyboard shortcuts, and About — and deliberately has no project for itself.
Projects store percentage-based component boxes on a 16:10 artboard, so the
same project renders at any window size.

- The left rail lists system projects and custom apps. **New app** creates a
  custom project from a blank canvas or an existing app, and the project
  inspector can rename, recolour, duplicate, or delete it.
- The centre is a drag-and-resize artboard. The palette adds app bars, panels,
  text, buttons, switches, fields, tabs, lists, meters, charts, gauges, art,
  month grids, detail tables, consoles, icons, and dividers. Undo, redo,
  duplicate, delete, and arrow-key nudging are available.
- The right side has an inspector for the selected component and a searchable
  **Variables** catalog. A component can bind to any variable, so the canvas
  follows live values from the rest of the desktop. Clicking a variable with
  nothing selected copies a `{{variable.id}}` template.
- `builder-variables.js` covers system identity, viewport and appearance,
  design tokens, resources, battery, network, devices, clock and calendar,
  the comparison model, Tide Radio and sound, the terminal, and the studio
  itself. Values refresh once per second while the builder is open.
- Projects are saved as `explorer-os-builder-v1` in `localStorage`; the footer
  resets them to the shipped system set.

## Conventions

- **kebab-case filenames**, one feature per file. Folders describe platform
  layers, not file types.
- **Named exports only.** There are no default exports. Import exactly the
  symbols a module uses.
- **`core/` imports no shell, compare, or app modules.** It owns saved
  preferences and shared state. `shell/` provides window, popover, clock, and
  command services. `compare/` and `apps/` consume those services.
  `command-catalog.js` and `commands.js` are the composition layer that may
  import from anywhere.
- **Mutate `state` properties; never replace the `state` object.** Modules hold
  live bindings to it.
- **One listener registration per responsibility.** Feature modules attach their
  own listeners when imported; `main.js` only orchestrates startup.
- **Pre-paint work stays in `boot-theme.js`.** It is a classic script, so it runs
  before the stylesheets and never waits for the module graph.
- **CSS is split at the original section boundaries.** `os.css` imports the
  files in the order the cascade needs. When adding a component, insert its new
  file at the matching position in that import list rather than appending it.

## Checking changes

Serve the repository root and open `/design-system/os/`. ES modules and CSS
`@import` both require HTTP; opening `index.html` through `file://` does not
work. `bun scripts/serve-dist.ts` serves the assembled site, and
`bun scripts/assemble-site.ts` copies this folder to `dist/design-system/os/`
without a build step.