/* Aether OS — Task Manager process fixtures
   The static process catalog and capacity constants the sampler works from. */

export const MEMORY_TOTAL_GB = 16;
export const STORAGE_TOTAL_GB = 1024;
export const STORAGE_FREE_GB = 812;

export const TASK_CATEGORIES = {
  apps: { label: "Apps" },
  media: { label: "Media" },
  system: { label: "System" },
  sync: { label: "Sync" },
  indexing: { label: "Indexing" },
  security: { label: "Security" },
};

export const PROCESS_SEED = [
  {
    id: "compare", name: "Data Cloud Compare", icon: "i-sync", cpu: 4.2, memory: 1.1,
    status: "App", category: "apps", parent: null, pid: 412, threads: 12, uptime: "3d 4h", user: "tide",
    note: "Draws the two-pane comparison, status chips, and column views. Its helpers render counterparts and detail panels.",
  },
  {
    id: "compare-gpu", name: "Data Cloud Compare GPU", icon: "i-grid", cpu: 1.0, memory: 0.32,
    status: "App", category: "apps", parent: "compare", pid: 418, threads: 3, uptime: "3d 4h", user: "tide",
    note: "Hardware-accelerated drawing for the comparison panes and translucent glass surfaces.",
  },
  {
    id: "compare-helper", name: "Data Cloud Compare Helper", icon: "i-layers", cpu: 0.7, memory: 0.24,
    status: "App", category: "apps", parent: "compare", pid: 421, threads: 5, uptime: "3d 4h", user: "tide",
    note: "Background helper that reads folder listings and keeps the two comparison panes in step.",
  },
  {
    id: "explorer", name: "Explorer", icon: "i-folder-open", cpu: 0.6, memory: 0.22,
    status: "App", category: "apps", parent: null, pid: 414, threads: 4, uptime: "1d 6h", user: "tide",
    note: "Shows a single-pane file browser with places, breadcrumbs, and the local read-only index.",
  },
  {
    id: "quick-look", name: "Quick Look", icon: "i-file", cpu: 0.2, memory: 0.18,
    status: "App", category: "apps", parent: "explorer", pid: 427, threads: 2, uptime: "2d 1h", user: "tide",
    note: "Renders the preview panel for the selected file without opening it in another app.",
  },
  {
    id: "tide-radio", name: "Tide Radio", icon: "i-volume", cpu: 2.2, memory: 0.5,
    status: "App", category: "media", parent: null, pid: 512, threads: 8, uptime: "1d 2h", user: "tide",
    note: "Plays the ambient stream and draws the equalizer in the music window.",
  },
  {
    id: "audio-engine", name: "Audio Engine", icon: "i-activity", cpu: 1.0, memory: 0.22,
    status: "App", category: "media", parent: "tide-radio", pid: 517, threads: 6, uptime: "1d 2h", user: "tide",
    note: "Decodes audio buffers and mixes the stream for the Harbour speakers.",
  },
  {
    id: "terminal", name: "Terminal", icon: "i-terminal", cpu: 0.6, memory: 0.2,
    status: "App", category: "apps", parent: null, pid: 604, threads: 3, uptime: "6h 14m", user: "tide",
    note: "Hosts the shell window and runs local-only commands against the comparison index.",
  },
  {
    id: "zsh", name: "zsh", icon: "i-code", cpu: 0.1, memory: 0.05,
    status: "App", category: "apps", parent: "terminal", pid: 609, threads: 1, uptime: "6h 14m", user: "tide",
    note: "The interactive shell inside Terminal, waiting at the tank prompt.",
  },
  {
    id: "tank-compare", name: "tank compare", icon: "i-search", cpu: 0.4, memory: 0.1,
    status: "Background", category: "apps", parent: "terminal", pid: 617, threads: 2, uptime: "42m", user: "tide",
    note: "Read-only comparison job launched from the shell. It writes its report locally.",
  },
  {
    id: "window-server", name: "WindowServer", icon: "i-grid", cpu: 3.4, memory: 0.8,
    status: "System", category: "system", parent: null, pid: 120, threads: 20, uptime: "12d 3h", user: "root",
    note: "Composites every window, menu, and the dock. It also runs the window tide line.",
  },
  {
    id: "network", name: "Network", icon: "i-globe", cpu: 0.4, memory: 0.1,
    status: "System", category: "system", parent: null, pid: 168, threads: 9, uptime: "12d 3h", user: "root",
    note: "Maintains the Wi-Fi, VPN, and local network state shown in the menu bar.",
  },
  {
    id: "mdns-responder", name: "mDNSResponder", icon: "i-wifi", cpu: 0.1, memory: 0.03,
    status: "System", category: "system", parent: "network", pid: 171, threads: 2, uptime: "12d 3h", user: "root",
    note: "Discovers nearby devices and services such as the Tide Mouse and Harbour speakers.",
  },
  {
    id: "calendar", name: "Calendar", icon: "i-calendar", cpu: 0.3, memory: 0.15,
    status: "App", category: "apps", parent: null, pid: 703, threads: 4, uptime: "2d 7h", user: "tide",
    note: "Keeps the month grid and agenda in sync with local events.",
  },
  {
    id: "calendar-agent", name: "CalendarAgent", icon: "i-sync", cpu: 0.4, memory: 0.12,
    status: "Background", category: "sync", parent: "calendar", pid: 708, threads: 3, uptime: "2d 7h", user: "tide",
    note: "Refreshes calendars in the background and wakes Calendar when an event is due.",
  },
  {
    id: "task-manager", name: "Task Manager", icon: "i-activity", cpu: 0.7, memory: 0.12,
    status: "App", category: "apps", parent: null, pid: 812, threads: 6, uptime: "18m", user: "tide",
    note: "Samples process usage, keeps the history graphs, and renders this window.",
  },
  {
    id: "photos", name: "Photos", icon: "i-sparkle", cpu: 0.2, memory: 0.4,
    status: "App", category: "media", parent: null, pid: 741, threads: 5, uptime: "1d 8h", user: "tide",
    note: "Shows the media library and hands thumbnails to the Quick Look previewer.",
  },
  {
    id: "photo-analysis", name: "Photo Analysis", icon: "i-sparkle", cpu: 0.5, memory: 0.18,
    status: "Background", category: "media", parent: "photos", pid: 746, threads: 4, uptime: "1d 8h", user: "tide",
    note: "Indexes faces, places, and objects locally so the library can stay searchable.",
  },
  {
    id: "jottacloud-sync", name: "jottacloud-sync", icon: "i-cloud", cpu: 4.1, memory: 2.1,
    status: "Background", category: "sync", parent: null, pid: 1902, threads: 12, uptime: "9h 22m", user: "tide",
    note: "Read-only sync daemon for the Jottacloud Archive. Its workers upload reports and refresh the local index.",
  },
  {
    id: "jottacloud-upload", name: "jottacloud-upload", icon: "i-cloud", cpu: 2.0, memory: 0.4,
    status: "Background", category: "sync", parent: "jottacloud-sync", pid: 1907, threads: 4, uptime: "9h 22m", user: "tide",
    note: "Queues report uploads and verifies checksums. Nothing is written back to the remote archive.",
  },
  {
    id: "jottacloud-index", name: "jottacloud-index", icon: "i-database", cpu: 1.2, memory: 0.7,
    status: "Background", category: "indexing", parent: "jottacloud-sync", pid: 1911, threads: 5, uptime: "9h 22m", user: "tide",
    note: "Builds the searchable side of the archive snapshot used by the comparison panes.",
  },
  {
    id: "kernel-task", name: "kernel_task", icon: "i-layers", cpu: 3.2, memory: 1.5,
    status: "System", category: "system", parent: null, pid: 0, threads: 64, uptime: "12d 3h", user: "root",
    note: "The kernel's own task. It manages memory pressure, device drivers, and thermal limits.",
  },
  {
    id: "mds", name: "mds", icon: "i-database", cpu: 2.4, memory: 1.0,
    status: "System", category: "indexing", parent: null, pid: 245, threads: 11, uptime: "12d 3h", user: "root",
    note: "Spotlight metadata server. It tracks file changes and answers index queries.",
  },
  {
    id: "mds-stores", name: "mds_stores", icon: "i-database", cpu: 1.0, memory: 0.5,
    status: "System", category: "indexing", parent: "mds", pid: 249, threads: 6, uptime: "12d 3h", user: "root",
    note: "Writes metadata into the Spotlight stores while mds answers searches.",
  },
  {
    id: "indexer", name: "indexer", icon: "i-search", cpu: 1.6, memory: 1.1,
    status: "Background", category: "indexing", parent: null, pid: 884, threads: 7, uptime: "4h 02m", user: "tide",
    note: "Reads file_indexer.db and builds the comparison search index.",
  },
  {
    id: "indexer-worker", name: "indexer-worker", icon: "i-search", cpu: 0.9, memory: 0.6,
    status: "Background", category: "indexing", parent: "indexer", pid: 889, threads: 4, uptime: "4h 02m", user: "tide",
    note: "Worker process that tokenises batches of paths and hands them back to the indexer.",
  },
  {
    id: "backupd", name: "backupd", icon: "i-archive", cpu: 1.1, memory: 0.6,
    status: "Background", category: "sync", parent: null, pid: 735, threads: 8, uptime: "7h 45m", user: "root",
    note: "Schedules local snapshots and keeps the backup timeline healthy.",
  },
  {
    id: "backupd-helper", name: "backupd-helper", icon: "i-archive", cpu: 0.5, memory: 0.2,
    status: "Background", category: "sync", parent: "backupd", pid: 739, threads: 3, uptime: "7h 45m", user: "root",
    note: "Performs the incremental copy for the currently running backup window.",
  },
  {
    id: "authd", name: "authd", icon: "i-shield", cpu: 0.1, memory: 0.04,
    status: "System", category: "security", parent: null, pid: 154, threads: 3, uptime: "12d 3h", user: "root",
    note: "Handles local authentication prompts and keeps the login session trusted.",
  },
  {
    id: "firewall", name: "firewall", icon: "i-lock", cpu: 0.2, memory: 0.05,
    status: "System", category: "security", parent: null, pid: 143, threads: 4, uptime: "12d 3h", user: "root",
    note: "Applies the local packet filter rules and blocks unsolicited connections.",
  },
  {
    id: "packet-filter", name: "packet-filter", icon: "i-lock", cpu: 0.05, memory: 0.02,
    status: "System", category: "security", parent: "firewall", pid: 147, threads: 2, uptime: "12d 3h", user: "root",
    note: "The in-kernel helper that evaluates packets against the firewall rules.",
  },
];
