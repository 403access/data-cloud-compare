/* Path helpers shared by panes, the status bar and the command bar. */

export function parentOf(path) {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

export function baseOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}
