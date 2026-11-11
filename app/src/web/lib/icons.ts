/* Row icons: one inline SVG per file kind. No external assets. */

import type { Entry } from "./types";

export const svg = (body: string, klass = "") =>
  `<svg class="${klass}" viewBox="0 0 16 16" fill="none" aria-hidden="true">${body}</svg>`;

const ICONS: Record<string, string> = {
  folder: svg(
    `<path d="M1.5 3.3a1 1 0 0 1 1-1h3.8l1.3 1.7h6.4a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.3Z" fill="currentColor"/>` +
      `<path d="M1.5 5.9h13" stroke="#fff" stroke-opacity=".22" stroke-width=".9"/>`,
    "row-icon-folder",
  ),
  file: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
      `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>`,
  ),
  image: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
      `<circle cx="5.8" cy="6.4" r="1.15" fill="currentColor"/>` +
      `<path d="m3.3 12.1 3.2-3.3 1.9 1.7 2.2-2.5 2.1 2.6" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
    "ic-image",
  ),
  video: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
      `<path d="M6.6 5.8 10.4 8l-3.8 2.2V5.8Z" fill="currentColor"/>`,
    "ic-video",
  ),
  audio: svg(
    `<path d="M6.2 11.9V4.8l5.2-1.4v6.7" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
      `<ellipse cx="4.9" cy="12.1" rx="1.7" ry="1.35" fill="currentColor"/>` +
      `<ellipse cx="10.1" cy="10.7" rx="1.7" ry="1.35" fill="currentColor"/>`,
    "ic-audio",
  ),
  archive: svg(
    `<rect x="2.2" y="3.1" width="11.6" height="9.8" rx="1.2" stroke="currentColor" stroke-width="1.15"/>` +
      `<path d="M2.5 5.8h11M6.1 5.8v3.4h3.8V5.8" stroke="currentColor" stroke-width="1.05"/>`,
    "ic-archive",
  ),
  code: svg(
    `<path d="m5.7 4.6-3.3 3.4 3.3 3.4M10.3 4.6l3.3 3.4-3.3 3.4M9.1 3.1 7 12.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
    "ic-code",
  ),
  pdf: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
      `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>` +
      `<text x="8" y="11.9" text-anchor="middle" font-size="4.4" font-weight="700" fill="currentColor">PDF</text>`,
    "ic-pdf",
  ),
  text: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
      `<path d="M9 1.9v2.9h2.9M5.8 7.1h4.4M5.8 9.1h4.4M5.8 11.1h3.1" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    "ic-text",
  ),
  sheet: svg(
    `<rect x="2.8" y="2.6" width="10.4" height="10.8" rx="1.1" stroke="currentColor" stroke-width="1.15"/>` +
      `<path d="M3 6.1h10M3 9.4h10M6.4 3v10.3M9.7 3v10.3" stroke="currentColor" stroke-width=".95" opacity=".8"/>`,
    "ic-sheet",
  ),
  doc: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
      `<path d="M9 1.9v2.9h2.9M5.8 7.2h4.4M5.8 9.2h4.4M5.8 11.2h2.7" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    "ic-text",
  ),
};

const EXT_KIND: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const add = (kind: string, exts: string[]) =>
    exts.forEach((ext) => {
      map[ext] = kind;
    });
  add("image", [
    "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp",
    "svg", "raw", "cr2", "cr3", "nef", "arw", "dng", "orf",
  ]);
  add("video", [
    "mp4", "mov", "mkv", "avi", "wmv", "flv", "webm", "m4v", "mpg", "mpeg",
    "ts", "m2ts", "vob",
  ]);
  add("audio", [
    "mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "aiff", "aif", "alac",
    "wma", "dsf",
  ]);
  add("archive", [
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz", "iso", "dmg", "pkg",
    "cab", "zst", "lz4",
  ]);
  add("code", [
    "js", "mjs", "cjs", "ts", "jsx", "tsx", "json", "html", "htm", "css",
    "scss", "sass", "less", "py", "rs", "go", "java", "c", "cc", "cpp", "h",
    "hpp", "rb", "php", "sh", "zsh", "bash", "yml", "yaml", "toml", "xml",
    "sql", "kt", "swift", "m", "mm", "pl", "lua", "vue", "svelte",
  ]);
  add("pdf", ["pdf"]);
  add("sheet", ["xls", "xlsx", "numbers", "ods", "csv", "tsv"]);
  add("doc", [
    "doc", "docx", "pages", "odt", "rtf", "ppt", "pptx", "key", "epub",
  ]);
  add("text", ["txt", "md", "markdown", "log", "nfo", "ini", "cfg", "conf"]);
  return map;
})();

export function entryIcon(entry: Entry): { className: string; body: string } {
  if (entry.is_dir) {
    return { className: "row-icon", body: ICONS.folder };
  }
  const name = entry.name || "";
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const kind = EXT_KIND[ext];
  const icon = (kind && ICONS[kind]) || ICONS.file;
  return { className: "row-icon file-icon", body: icon };
}

export function iconFor(entry: Entry): string {
  if (entry.is_dir) {
    return `<span class="row-icon">${ICONS.folder}</span>`;
  }
  const name = entry.name || "";
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const kind = EXT_KIND[ext];
  const icon = (kind && ICONS[kind]) || ICONS.file;
  return `<span class="row-icon file-icon">${icon}</span>`;
}

export const COMMAND_ICONS: Record<string, string> = {
  local: svg(
    `<rect x="2.2" y="4" width="11.6" height="3.4" rx="1" stroke="currentColor" stroke-width="1.2"/>` +
      `<rect x="2.2" y="8.4" width="11.6" height="4.4" rx="1.2" stroke="currentColor" stroke-width="1.2"/>` +
      `<circle cx="4.2" cy="5.7" r=".6" fill="currentColor"/>`,
  ),
  remote: svg(
    `<path d="M8 2.5a4.2 4.2 0 0 1 4.1 3.5 3 3 0 0 1-.6 5.9H4.5a3.1 3.1 0 0 1-.6-6.1A4.2 4.2 0 0 1 8 2.5Z" stroke="currentColor" stroke-width="1.25"/>`,
  ),
  search: svg(
    `<circle cx="7.1" cy="7.1" r="4.2" stroke="currentColor" stroke-width="1.35"/>` +
      `<path d="m10.3 10.3 3 3" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>`,
  ),
  home: svg(
    `<path d="M2.6 7.4 8 2.7l5.4 4.7v6H9.8V9.6H6.2v3.8H2.6v-6Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>`,
  ),
  back: svg(
    `<path d="m9.6 3.6-4.2 4.4 4.2 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  forward: svg(
    `<path d="m6.4 3.6 4.2 4.4-4.2 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  up: svg(
    `<path d="M8 13V3.6M3.9 7.7 8 3.6l4.1 4.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  mirror: svg(
    `<path d="M2.4 5.8h8.3M8.7 3.3l2.5 2.5-2.5 2.5M13.6 10.2H5.3m2 2.5-2.5-2.5 2.5-2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  reveal: svg(
    `<path d="M1.8 8s2.3-4.1 6.2-4.1S14.2 8 14.2 8s-2.3 4.1-6.2 4.1S1.8 8 1.8 8Z" stroke="currentColor" stroke-width="1.25"/>` +
      `<circle cx="8" cy="8" r="1.8" stroke="currentColor" stroke-width="1.2"/>`,
  ),
  hidden: svg(
    `<path d="M1.8 8s2.3-4.1 6.2-4.1S14.2 8 14.2 8s-2.3 4.1-6.2 4.1S1.8 8 1.8 8Z" stroke="currentColor" stroke-width="1.25"/>` +
      `<circle cx="8" cy="8" r="1.8" fill="currentColor" opacity=".7"/>`,
  ),
  columns: svg(
    `<rect x="2" y="2.7" width="12" height="10.6" rx="1.4" stroke="currentColor" stroke-width="1.25"/>` +
      `<path d="M5.8 2.9v10.2M9.6 2.9v10.2" stroke="currentColor" stroke-width="1.05"/>`,
  ),
  legend: svg(
    `<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>` +
      `<path d="M8 7.3v3.4M8 5.1v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
  sort: svg(
    `<path d="M3.7 3.1v9.4M2 10.8l1.7 1.7 1.7-1.7M8.2 4.1h5.3M9.3 7.1h4.2M10.6 10.1h2.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  filter: svg(
    `<path d="M2.4 3.2h11.2L9.3 8.3v4.2L6.8 14V8.3L2.4 3.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>`,
  ),
  theme: svg(
    `<circle cx="8" cy="8" r="2.7" stroke="currentColor" stroke-width="1.25"/>` +
      `<path d="M8 1.7v1.5M8 12.8v1.5M1.7 8h1.5M12.8 8h1.5M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  ),
  water: svg(
    `<path d="M8 2.1S3.9 6.4 3.9 9.3a4.1 4.1 0 0 0 8.2 0C12.1 6.4 8 2.1 8 2.1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M6.2 9.5a1.9 1.9 0 0 0 1.8 1.7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".65"/>`,
  ),
  provider: svg(
    `<path d="M8 2.5a4.2 4.2 0 0 1 4.1 3.5 3 3 0 0 1-.6 5.9H4.5a3.1 3.1 0 0 1-.6-6.1A4.2 4.2 0 0 1 8 2.5Z" stroke="currentColor" stroke-width="1.25"/>` +
      `<path d="M8 6.1v4.2M6.2 8.4 8 10.2l1.8-1.8" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  details: svg(
    `<rect x="2.3" y="2.7" width="11.4" height="10.6" rx="1.4" stroke="currentColor" stroke-width="1.25"/>` +
      `<path d="M8 5.3v3.2M8 10.6v.1" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>`,
  ),
  analytics: svg(
    `<path d="M2.8 13.4V8.2M6.4 13.4V4.1M10 13.4v-3.6M13.6 13.4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
      `<path d="M2 13.9h12.2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>`,
  ),
  reset: svg(
    `<path d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7M13.1 2.6v3.1H10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  settings: svg(
    `<circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.2"/>` +
      `<path d="M8 1.9v1.4M8 12.7v1.4M1.9 8h1.4M12.7 8h1.4M3.7 3.7l1 1M11.3 11.3l1 1M12.3 3.7l-1 1M4.7 11.3l-1 1" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/>`,
  ),
  check: svg(
    `<path d="m3.2 8.2 3.1 3.1 6.5-6.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
};

export function commandIcon(name: string): string {
  return COMMAND_ICONS[name] || COMMAND_ICONS.settings;
}
