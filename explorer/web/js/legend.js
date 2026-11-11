/* The status legend popover in the app bar. */

import { currentProvider } from './store.js';

function legendEntries() {
  const label = currentProvider().label;
  return [
    ['lt', `${label} side`],
    ['st-exact', 'Same', 'This path exists in the local index at the same path.'],
    ['st-moved', 'Moved', 'Found in the local index under a different path (same name and size).'],
    ['st-possible', 'Maybe', 'A file with the same name exists locally, but the size differs.'],
    ['st-partial', 'Partial', 'Folder has a mix of present and missing children.'],
    ['st-missing', 'Missing', 'No matching path, name or size was found in the local index.'],
    ['lt', 'Local side'],
    ['st-exact', `In ${label}`, `This local item exists at the same path in ${label}.`],
    ['st-moved_match', 'Moved match', `This local item is the match for a moved ${label} item.`],
    ['st-local_only', 'Local only', `Present in the index but not found anywhere in ${label}.`],
    ['st-unmatched', `Not in ${label}`, `No same-path counterpart in ${label}; it may still have matched another item.`],
    ['st-type_mismatch', 'Type differs', 'A file/folder with the same name exists on the other side.'],
  ];
}

export function buildLegend() {
  const legend = document.getElementById('legend');
  const rows = legendEntries().map(([cls, title, desc]) => {
    if (cls === 'lt') {
      const h = document.createElement('h4');
      h.textContent = title;
      return h;
    }
    const row = document.createElement('div');
    row.className = 'legend-row';
    const chip = document.createElement('span');
    chip.className = `status-chip ${cls}`;
    chip.innerHTML = '<span class="dot"></span>';
    const text = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = title;
    text.append(b);
    if (desc) text.append(document.createTextNode(` — ${desc}`));
    row.append(chip, text);
    return row;
  });
  legend.replaceChildren(...rows);
}
