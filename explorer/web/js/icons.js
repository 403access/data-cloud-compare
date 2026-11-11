/* Row icons: one inline SVG per file kind. No external assets. */

export const svg = (body, klass = '') =>
  `<svg class="${klass}" viewBox="0 0 16 16" fill="none" aria-hidden="true">${body}</svg>`;

const ICONS = {
  folder: svg(
    `<path d="M1.5 3.3a1 1 0 0 1 1-1h3.8l1.3 1.7h6.4a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.3Z" fill="currentColor"/>` +
    `<path d="M1.5 5.9h13" stroke="#fff" stroke-opacity=".22" stroke-width=".9"/>`,
    'row-icon-folder'),
  file: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>`),
  image: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
    `<circle cx="5.8" cy="6.4" r="1.15" fill="currentColor"/>` +
    `<path d="m3.3 12.1 3.2-3.3 1.9 1.7 2.2-2.5 2.1 2.6" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
    'ic-image'),
  video: svg(
    `<rect x="2.1" y="3" width="11.8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M6.6 5.8 10.4 8l-3.8 2.2V5.8Z" fill="currentColor"/>`,
    'ic-video'),
  audio: svg(
    `<path d="M6.2 11.9V4.8l5.2-1.4v6.7" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<ellipse cx="4.9" cy="12.1" rx="1.7" ry="1.35" fill="currentColor"/>` +
    `<ellipse cx="10.1" cy="10.7" rx="1.7" ry="1.35" fill="currentColor"/>`,
    'ic-audio'),
  archive: svg(
    `<rect x="2.2" y="3.1" width="11.6" height="9.8" rx="1.2" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M2.5 5.8h11M6.1 5.8v3.4h3.8V5.8" stroke="currentColor" stroke-width="1.05"/>`,
    'ic-archive'),
  code: svg(
    `<path d="m5.7 4.6-3.3 3.4 3.3 3.4M10.3 4.6l3.3 3.4-3.3 3.4M9.1 3.1 7 12.9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
    'ic-code'),
  pdf: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/>` +
    `<text x="8" y="11.9" text-anchor="middle" font-size="4.4" font-weight="700" fill="currentColor">PDF</text>`,
    'ic-pdf'),
  text: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9M5.8 7.1h4.4M5.8 9.1h4.4M5.8 11.1h3.1" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    'ic-text'),
  sheet: svg(
    `<rect x="2.8" y="2.6" width="10.4" height="10.8" rx="1.1" stroke="currentColor" stroke-width="1.15"/>` +
    `<path d="M3 6.1h10M3 9.4h10M6.4 3v10.3M9.7 3v10.3" stroke="currentColor" stroke-width=".95" opacity=".8"/>`,
    'ic-sheet'),
  doc: svg(
    `<path d="M4.1 1.8h4.9l2.9 2.9v9.5H4.1z" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>` +
    `<path d="M9 1.9v2.9h2.9M5.8 7.2h4.4M5.8 9.2h4.4M5.8 11.2h2.7" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/>`,
    'ic-text'),
};

const EXT_KIND = (() => {
  const map = {};
  const add = (kind, exts) => exts.forEach(x => { map[x] = kind; });
  add('image', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'tif',
    'tiff', 'bmp', 'svg', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf']);
  add('video', ['mp4', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'webm', 'm4v',
    'mpg', 'mpeg', 'ts', 'm2ts', 'vob']);
  add('audio', ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'aiff',
    'aif', 'alac', 'wma', 'dsf']);
  add('archive', ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'iso', 'dmg', 'pkg', 'cab', 'zst', 'lz4']);
  add('code', ['js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'json', 'html', 'htm',
    'css', 'scss', 'sass', 'less', 'py', 'rs', 'go', 'java', 'c', 'cc', 'cpp',
    'h', 'hpp', 'rb', 'php', 'sh', 'zsh', 'bash', 'yml', 'yaml', 'toml',
    'xml', 'sql', 'kt', 'swift', 'm', 'mm', 'pl', 'lua', 'vue', 'svelte']);
  add('pdf', ['pdf']);
  add('sheet', ['xls', 'xlsx', 'numbers', 'ods', 'csv', 'tsv']);
  add('doc', ['doc', 'docx', 'pages', 'odt', 'rtf', 'ppt', 'pptx', 'key',
    'epub']);
  add('text', ['txt', 'md', 'markdown', 'log', 'nfo', 'ini', 'cfg', 'conf']);
  return map;
})();

export function iconFor(entry) {
  if (entry.is_dir) {
    return `<span class="row-icon">${ICONS.folder}</span>`;
  }
  const name = entry.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const kind = EXT_KIND[ext];
  const icon = kind && ICONS[kind] ? ICONS[kind] : ICONS.file;
  return `<span class="row-icon file-icon">${icon}</span>`;
}
