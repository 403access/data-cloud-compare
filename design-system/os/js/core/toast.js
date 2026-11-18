/* Aether OS — toasts
   One host, at most three visible messages, and a short exit animation. */

/* ------------------------------------------------------------- toasts */

const toastHost = document.querySelector("[data-toast-host]");

export function toast(message, kind = "default") {
  if (!toastHost) return;
  while (toastHost.children.length >= 3) toastHost.firstElementChild?.remove();
  const node = document.createElement("div");
  node.className = "ds-toast";
  if (kind === "warn") node.dataset.kind = "warn";
  node.innerHTML = '<span class="ds-dot"></span><span></span>';
  node.lastElementChild.textContent = message;
  toastHost.appendChild(node);
  window.setTimeout(() => {
    node.classList.add("is-leaving");
    window.setTimeout(() => node.remove(), 240);
  }, 2800);
}
