/* Jump between a row and its counterpart in the other pane. */

import { counterpartTarget } from '../status.js';
import { panes, currentProvider } from '../store.js';
import { toast } from '../toast.js';
import { baseOf, parentOf } from '../util.js';

export async function revealCounterpart(entry, side) {
  const target = counterpartTarget(entry, side);
  if (!target) {
    toast(side === 'remote'
      ? 'This item has no match on the local side.'
      : `This item has no counterpart in ${currentProvider().label}.`);
    return;
  }
  const dest = side === 'remote' ? panes.local : panes.remote;
  const parent = parentOf(target);
  const name = baseOf(target);
  const data = await dest.navigate(parent, { push: true, select: target });
  if (data && !data.exists) {
    toast(`Counterpart folder not found: ${parent || '/'}`);
    return;
  }
  // Imported dynamically so the status bar can import this module without a
  // static cycle.
  const { setActive } = await import('../selection.js');
  setActive(dest.side);
  dest.list.focus();
  if (name) dest.select(target);
}
