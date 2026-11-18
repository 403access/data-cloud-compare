/* Aether OS — Devices
   Paired Bluetooth accessories, battery meters, and shared tray/app state. */

import { toast } from "../core/toast.js";
import { esc } from "../core/utils.js";
import { closeTrays, registerTray } from "../shell/popovers.js";
import { openWindow } from "../shell/windows.js";

/* ------------------------------------------------------------- devices */

const DEVICE_SEED = [
  { id: "tide-mouse", name: "Tide Mouse", kind: "Mouse", detail: "Bluetooth 5.3", icon: "i-mouse", battery: 61, connected: true },
  { id: "harbour-keyboard", name: "Harbour Keyboard", kind: "Keyboard", detail: "Bluetooth 5.3 · Low energy", icon: "i-keyboard", battery: 84, connected: true },
  { id: "drift-earbuds", name: "Drift Earbuds", kind: "Audio", detail: "Bluetooth 5.3", icon: "i-headphones", battery: 47, connected: false },
];

export const devicesState = {
  bluetooth: true,
  discoverable: false,
  devices: DEVICE_SEED.map((device) => ({ ...device })),
};

let focusedDevice = null;

const deviceBatteryTone = (level) => (level <= 20 ? "is-low" : level <= 50 ? "is-mid" : "is-good");
export const connectedDeviceCount = () => devicesState.devices.filter((device) => device.connected).length;

function deviceBatteryHtml(level, wide = false) {
  return `<span class="os-device-battery${wide ? " os-device-battery--wide" : ""}" aria-hidden="true"><i class="${deviceBatteryTone(level)}" style="width:${level}%"></i></span>`;
}

function deviceRowHtml(device) {
  return `<button type="button" class="os-device-row" data-device-open="${esc(device.id)}" aria-label="Open Devices for ${esc(device.name)}, ${device.battery}% battery">
    <span class="os-device-row__icon"><svg class="icon"><use href="#${device.icon}"/></svg></span>
    <span class="os-device-row__text"><b>${esc(device.name)}</b><small>${esc(device.kind)} · ${esc(device.detail)}</small></span>
    ${deviceBatteryHtml(device.battery)}
    <b class="os-device-row__value">${device.battery}%</b>
  </button>`;
}

function deviceCardHtml(device) {
  const active = devicesState.bluetooth && device.connected;
  const status = !devicesState.bluetooth ? "Bluetooth off" : device.connected ? "Connected" : "Paired";
  return `<div class="os-device-card${active ? "" : " is-off"}" data-device-card="${esc(device.id)}">
    <span class="os-device-card__icon"><svg class="icon"><use href="#${device.icon}"/></svg></span>
    <div class="os-device-card__body">
      <header><b>${esc(device.name)}</b><span class="os-device-card__tag${active ? " is-on" : ""}">${status}</span></header>
      <p>${esc(device.kind)} · ${esc(device.detail)}</p>
      <div class="os-device-card__battery"><span>Battery</span>${deviceBatteryHtml(device.battery, true)}<b>${device.battery}%</b></div>
    </div>
    <button class="ds-btn ds-btn--small ${active ? "ds-btn--ghost" : "ds-btn--primary"}" type="button" data-device-toggle="${esc(device.id)}"${devicesState.bluetooth ? "" : " disabled"}>${device.connected ? "Disconnect" : "Connect"}</button>
  </div>`;
}

function settingsDeviceRowHtml(device) {
  const active = devicesState.bluetooth && device.connected;
  const status = !devicesState.bluetooth ? "Bluetooth off" : device.connected ? "Connected" : "Paired";
  return `<div class="os-settings-device${active ? "" : " is-off"}">
    <span class="os-settings-device__icon"><svg class="icon"><use href="#${device.icon}"/></svg></span>
    <span class="os-settings-device__text"><b>${esc(device.name)}</b><small>${status} · ${device.battery}%</small></span>
    ${deviceBatteryHtml(device.battery)}
    <button class="ds-btn ds-btn--small ${active ? "ds-btn--ghost" : "ds-btn--primary"}" type="button" data-device-toggle="${esc(device.id)}"${devicesState.bluetooth ? "" : " disabled"}>${device.connected ? "Disconnect" : "Connect"}</button>
  </div>`;
}

function renderDeviceLists() {
  const connected = devicesState.devices.filter((device) => device.connected);
  const menuList = document.querySelector("[data-devices-connected-list]");
  if (menuList) {
    menuList.innerHTML = connected.length
      ? connected.map(deviceRowHtml).join("")
      : '<p class="os-tray__empty">No accessories connected.</p>';
  }
  document.querySelectorAll("[data-devices-list]").forEach((appList) => {
    appList.innerHTML = devicesState.devices.map(deviceCardHtml).join("");
  });
  document.querySelectorAll("[data-settings-devices-list]").forEach((list) => {
    list.innerHTML = devicesState.devices.map(settingsDeviceRowHtml).join("");
  });
}

function syncDevicesUi() {
  const count = connectedDeviceCount();
  const on = devicesState.bluetooth;
  const note = on ? `On · ${count} ${count === 1 ? "accessory" : "accessories"}` : "Off";
  const countLabel = on ? (count ? `${count} connected` : "No devices") : "Off";
  const toggle = document.querySelector('[data-tray-toggle="devices"]');
  const appBody = document.querySelector("[data-window=devices] .os-app-body");
  const scrollTop = appBody?.scrollTop || 0;

  toggle?.setAttribute("title", `Bluetooth · ${countLabel}`);
  toggle?.setAttribute("aria-label", `Bluetooth, ${countLabel}`);
  toggle?.querySelector("use")?.setAttribute("href", on ? "#i-bluetooth" : "#i-bluetooth-off");

  document.querySelectorAll("[data-device-bluetooth]").forEach((input) => {
    input.checked = on;
  });
  document.querySelectorAll("[data-device-discoverable]").forEach((input) => {
    input.checked = devicesState.discoverable;
    input.disabled = !on;
  });
  document.querySelectorAll("[data-devices-state]").forEach((node) => (node.textContent = countLabel));
  document.querySelectorAll("[data-devices-toggle-note]").forEach((node) => (node.textContent = note));
  document.querySelectorAll("[data-devices-count]").forEach((node) => (node.textContent = String(on ? count : 0)));
  document.querySelectorAll("[data-devices-connected-section]").forEach((node) => (node.hidden = !on));
  document.querySelectorAll("[data-devices-off]").forEach((node) => (node.hidden = on));
  document.querySelectorAll("[data-devices-app-badge]").forEach((node) => {
    node.classList.toggle("ds-badge--same", on && count > 0);
    node.classList.toggle("ds-badge--muted", !on || count === 0);
  });
  document.querySelectorAll("[data-devices-app-badge-text]").forEach((node) => (node.textContent = countLabel));
  document.querySelectorAll("[data-devices-hero-summary]").forEach((node) => {
    node.textContent = on ? `On · ${count} ${count === 1 ? "accessory" : "accessories"} connected` : "Bluetooth is off";
  });
  document.querySelectorAll("[data-devices-note]").forEach((node) => {
    node.textContent = on ? "Battery levels update from the accessory." : "Turn Bluetooth on to use paired accessories.";
  });

  renderDeviceLists();
  if (appBody) appBody.scrollTop = scrollTop;
}

function setBluetooth(value) {
  const on = Boolean(value);
  if (devicesState.bluetooth === on) return;
  devicesState.bluetooth = on;
  syncDevicesUi();
  toast(on ? `Bluetooth on · ${connectedDeviceCount()} connected` : "Bluetooth off");
}

function setDiscoverable(value) {
  devicesState.discoverable = Boolean(value);
  syncDevicesUi();
  toast(`Discoverable ${devicesState.discoverable ? "on" : "off"}`);
}

function toggleDevice(id) {
  if (!devicesState.bluetooth) {
    toast("Turn Bluetooth on first", "warn");
    return;
  }
  const device = devicesState.devices.find((item) => item.id === id);
  if (!device) return;
  device.connected = !device.connected;
  syncDevicesUi();
  toast(`${device.name} ${device.connected ? "connected" : "disconnected"}`);
}

function focusDeviceCard(id) {
  if (!id) return;
  const card = document.querySelector(`[data-device-card="${CSS.escape(id)}"]`);
  if (!card) return;
  card.scrollIntoView({ block: "nearest" });
  card.classList.add("is-highlight");
  window.setTimeout(() => card.classList.remove("is-highlight"), 1600);
}

export function openDevices(id) {
  focusedDevice = id || null;
  openWindow("devices");
  syncDevicesUi();
  focusDeviceCard(focusedDevice);
}

document.querySelectorAll("[data-device-bluetooth]").forEach((input) => {
  input.addEventListener("change", () => setBluetooth(input.checked));
});
document.querySelectorAll("[data-device-discoverable]").forEach((input) => {
  input.addEventListener("change", () => setDiscoverable(input.checked));
});

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-device-toggle]");
  if (toggle) {
    toggleDevice(toggle.dataset.deviceToggle);
    return;
  }
  const row = event.target.closest("[data-device-open]");
  if (!row) return;
  openDevices(row.dataset.deviceOpen);
  closeTrays();
});

registerTray("devices", { open: syncDevicesUi });
syncDevicesUi();
