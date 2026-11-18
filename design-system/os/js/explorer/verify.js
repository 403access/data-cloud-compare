/* Aether OS — snapshot verification
   A purely visual progress animation for the Verify command. */

import { toast } from "../core/toast.js";
import { prefersReducedMotion } from "../core/utils.js";

/* ------------------------------------------------------------ verify */

let verified = false;

export function verifySnapshot() {
  if (verified) {
    toast("Snapshot already verified 4 minutes ago");
    return;
  }
  verified = true;
  const values = document.querySelectorAll("[data-verify-value]");
  const fills = document.querySelectorAll("[data-verify-fill]");
  const start = performance.now();
  const duration = prefersReducedMotion() ? 1 : 1500;
  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = 87.7 + 12.3 * eased;
    values.forEach((node) => (node.textContent = `${value.toFixed(1)}%`));
    fills.forEach((node) => (node.style.width = `${value}%`));
    if (progress < 1) requestAnimationFrame(step);
    else toast("Snapshot verified · 1,434,971 files");
  }
  requestAnimationFrame(step);
}
