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
    explorer.css         explorer shell, panes, rows, status bar
    inspector.css        details, source, and analytics sidebars
    settings.css         Water settings window
    terminal.css         terminal window
    music.css            Tide Radio window
    about.css            About window
    dock.css             dock
    overlays.css         command overlay and toasts
    layout.css           responsive and motion rules for the shell
    app-shell.css        in-window application chrome
    app-panes.css        app pane tables and status bar
    side-panel.css       app side panels
    settings-app.css     settings application
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
  js/
    main.js
    boot-theme.js
    core/
      state.js           option catalogs, preferences, mutable state
      data.js            explorer fixture data
      utils.js           escaping, formatting, motion queries
      toast.js           toast host
    shell/
      clock.js           time and date labels
      popovers.js        menu bar menus and tray panels
      windows.js         drag, resize, focus, dock state
      menu-bar-usage.js  CPU/RAM/storage meter preferences
      command-catalog.js command inventory and fuzzy file matching
      command-bar.js     command overlay and keyboard selection
      commands.js        data-cmd dispatcher
      shortcuts.js       global key map
    explorer/
      model.js           status, path, filter, sort, and counterpart selectors
      view.js            panes, status bar, side panels, selection actions
      interactions.js    explorer DOM event wiring
      verify.js          snapshot verification animation
    features/
      appearance.js      theme, tone, water settings, WaterSurface
    apps/
      calendar.js        calendar tray and Calendar app
      network.js         Wi-Fi and VPN state
      devices.js         Bluetooth accessories
      battery.js         charge and energy mode
      music.js           Tide Radio playback
      sound.js           volume, mute, now playing
      terminal.js        simulated shell
      task-processes.js  process catalog fixtures
      task-manager.js    process tree, charts, sampler
```

## Conventions

- **kebab-case filenames**, one feature per file. Folders describe platform
  layers, not file types.
- **Named exports only.** There are no default exports. Import exactly the
  symbols a module uses.
- **`core/` imports no shell, explorer, or app modules.** It owns saved
  preferences and shared state. `shell/` provides window, popover, clock, and
  command services. `explorer/` and `apps/` consume those services.
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