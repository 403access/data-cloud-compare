/* Aether OS — Network
   Wi-Fi and VPN state for the tray popover and the Network app. */

import { toast } from "../core/toast.js";
import { esc } from "../core/utils.js";
import { registerTray } from "../shell/popovers.js";

/* ------------------------------------------------------------- network */

export const NETWORKS = [
  { name: "Harbour 5G", band: "5 GHz", security: "WPA3", strength: 4, known: true },
  { name: "Sandbar 2.4", band: "2.4 GHz", security: "WPA2", strength: 3, known: true },
  { name: "Lighthouse", band: "5 GHz", security: "WPA2", strength: 2, known: true },
  { name: "Tidepool Guest", band: "5 GHz", security: "Open", strength: 2, known: false },
  { name: "Old Pier", band: "2.4 GHz", security: "WPA2", strength: 1, known: false },
];

export const networkState = {
  wifi: true,
  connected: "Harbour 5G",
  vpn: false,
};

/* Values shown in the Network app's Details section. */
export const NETWORK_DETAILS = {
  ip: "192.168.1.24",
  router: "192.168.1.1",
  dns: "1.1.1.1, 9.9.9.9",
  mac: "3C:22:FB:2A:91:0D",
};

const networkToggleNodes = document.querySelectorAll("[data-network-wifi]");
const networkVpnNodes = document.querySelectorAll("[data-network-vpn]");

const networkByName = (name) => NETWORKS.find((network) => network.name === name) || null;

function networkRowHtml(network) {
  const current = networkState.wifi && networkState.connected === network.name;
  const aside = current
    ? '<svg class="icon os-network-row__check"><use href="#i-check"/></svg>'
    : `<span class="os-network-row__known">${network.known ? "Known" : "Nearby"}</span>`;
  return `<button type="button" class="os-network-row${current ? " is-current" : ""}" data-network-connect="${esc(network.name)}" aria-pressed="${current}">
    <span class="os-signal" data-strength="${network.strength}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="os-network-row__text"><b>${esc(network.name)}</b><small>${network.band} · ${network.security}</small></span>
    ${aside}
  </button>`;
}

function syncNetworkUi() {
  const current = networkByName(networkState.connected);
  const wifiOn = networkState.wifi;
  const toggle = document.querySelector('[data-tray-toggle="network"]');
  const status = wifiOn ? (current ? `Connected to ${current.name}` : "Wi-Fi on") : "Wi-Fi off";

  toggle?.setAttribute("title", status);
  toggle?.setAttribute("aria-label", status);
  toggle?.querySelector("use")?.setAttribute("href", wifiOn ? "#i-wifi" : "#i-wifi-off");

  networkToggleNodes.forEach((input) => (input.checked = wifiOn));
  networkVpnNodes.forEach((input) => (input.checked = networkState.vpn));

  document.querySelectorAll("[data-network-state]").forEach((node) => {
    node.textContent = wifiOn ? "Connected" : "Off";
  });
  document.querySelectorAll("[data-network-toggle-label]").forEach((node) => {
    node.textContent = wifiOn && current ? current.name : "Wi-Fi";
  });
  document.querySelectorAll("[data-network-toggle-note]").forEach((node) => {
    node.textContent = wifiOn
      ? current
        ? `Wi-Fi is on · ${current.band}`
        : "Wi-Fi is on"
      : "Wi-Fi is off";
  });
  document.querySelectorAll("[data-network-connected-section]").forEach((node) => (node.hidden = !wifiOn || !current));
  document.querySelectorAll("[data-network-known-section]").forEach((node) => (node.hidden = !wifiOn));
  document.querySelectorAll("[data-network-off]").forEach((node) => (node.hidden = wifiOn));
  document.querySelectorAll("[data-network-app-off]").forEach((node) => (node.hidden = wifiOn));
  document.querySelectorAll("[data-network-vpn-label]").forEach((node) => {
    node.textContent = networkState.vpn ? "On" : "Off";
  });

  const currentHost = document.querySelector("[data-network-current]");
  if (currentHost) currentHost.innerHTML = wifiOn && current ? networkRowHtml(current) : "";

  const knownHost = document.querySelector("[data-network-known-list]");
  if (knownHost) {
    const known = NETWORKS.filter((network) => network.known && network.name !== (wifiOn ? networkState.connected : ""));
    knownHost.innerHTML = known.length
      ? known.map(networkRowHtml).join("")
      : '<p class="os-tray__empty">No other known networks.</p>';
  }

  const appList = document.querySelector("[data-network-app-list]");
  if (appList) appList.innerHTML = wifiOn ? NETWORKS.map(networkRowHtml).join("") : "";

  document.querySelectorAll("[data-network-app-title]").forEach((node) => {
    node.textContent = wifiOn && current ? current.name : "Wi-Fi off";
  });
  document.querySelectorAll("[data-network-app-summary]").forEach((node) => {
    node.textContent = wifiOn && current
      ? `Wi-Fi · ${current.band} · ${current.security}`
      : "Turn on Wi-Fi to discover nearby networks.";
  });
  document.querySelectorAll("[data-network-app-badge]").forEach((node) => {
    node.classList.toggle("ds-badge--same", wifiOn);
    node.classList.toggle("ds-badge--muted", !wifiOn);
  });
  document.querySelectorAll("[data-network-app-badge-text]").forEach((node) => {
    node.textContent = wifiOn ? "Connected" : "Off";
  });
  document.querySelectorAll("[data-network-band]").forEach((node) => (node.textContent = current?.band || "—"));
  document.querySelectorAll("[data-network-security]").forEach((node) => (node.textContent = current?.security || "—"));
}

function setWifi(value) {
  const on = Boolean(value);
  if (networkState.wifi === on) return;
  networkState.wifi = on;
  syncNetworkUi();
  toast(on ? `Wi-Fi on · ${networkState.connected}` : "Wi-Fi off");
}

function setVpn(value) {
  networkState.vpn = Boolean(value);
  syncNetworkUi();
  toast(`VPN ${networkState.vpn ? "on" : "off"}`);
}

function connectToNetwork(name) {
  const network = networkByName(name);
  if (!network) return;
  const changed = !networkState.wifi || networkState.connected !== name;
  networkState.wifi = true;
  networkState.connected = name;
  syncNetworkUi();
  toast(changed ? `Wi-Fi · connected to ${name}` : `${name} · already connected`);
}

networkToggleNodes.forEach((input) => input.addEventListener("change", () => setWifi(input.checked)));
networkVpnNodes.forEach((input) => input.addEventListener("change", () => setVpn(input.checked)));

document.addEventListener("click", (event) => {
  const row = event.target.closest("[data-network-connect]");
  if (row) connectToNetwork(row.dataset.networkConnect);
});

registerTray("network", { open: syncNetworkUi });
syncNetworkUi();
