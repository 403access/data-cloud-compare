/* Aether OS — Audio
   Output and input devices, PipeWire presets, the input-level meter, and the
   tray links that bring the menu bar Sound panel into the Audio app. */

import { toast } from "../core/toast.js";
import { esc } from "../core/utils.js";
import { closeWindow, openWindow } from "../shell/windows.js";
import { setSoundOutput } from "./sound.js";

/* --------------------------------------------------------------- audio */

const AUDIO_DEVICES = [
  {
    id: "harbour-speakers",
    direction: "output",
    name: "Harbour Speakers",
    setting: "Harbour Speakers",
    detail: "Analog · analog-stereo",
    icon: "i-volume",
  },
  {
    id: "usb-headset",
    direction: "output",
    name: "USB Headset",
    setting: "USB Headset",
    detail: "USB · analog-stereo",
    icon: "i-headphones",
  },
  {
    id: "airpods-pro",
    direction: "output",
    name: "AirPods Pro",
    setting: "AirPods Pro",
    detail: "Bluetooth · a2dp-sink · LDAC",
    icon: "i-headphones",
  },
  {
    id: "usb-microphone",
    direction: "input",
    name: "USB Microphone",
    setting: "USB Microphone",
    detail: "USB · mono-fallback",
    icon: "i-mic",
  },
  {
    id: "built-in-microphone",
    direction: "input",
    name: "Built-in Microphone",
    setting: "Built-in Microphone",
    detail: "Analog · analog-stereo",
    icon: "i-mic",
  },
];

export const AUDIO_PRESETS = [
  { id: "media", label: "Media", frames: 1024 },
  { id: "voice", label: "Voice", frames: 256 },
  { id: "monitor", label: "Monitor", frames: 128 },
];

export const audioState = {
  selected: "harbour-speakers",
  defaults: { output: "harbour-speakers", input: "usb-microphone" },
  preset: "media",
  locked: true,
};

const audioWindow = document.querySelector('[data-window="audio"]');
const audioMeter = document.querySelector("[data-audio-meter]");

/* Deterministic bar heights keep the meter lively without random layout
   shifts each time the window opens. */
const METER_HEIGHTS = [
  16, 28, 44, 66, 82, 64, 46, 32, 24, 38, 56, 74, 92, 78, 58, 40,
  26, 36, 54, 72, 88, 70, 50, 34, 22, 42, 60, 80, 94, 68, 48, 30,
];

export function audioDevice(id) {
  return AUDIO_DEVICES.find((device) => device.id === id) || null;
}

export function currentAudioOutput() {
  return audioDevice(audioState.defaults.output) || AUDIO_DEVICES[0];
}

export function currentAudioInput() {
  return audioDevice(audioState.defaults.input) || AUDIO_DEVICES[3];
}

export function currentAudioPreset() {
  return AUDIO_PRESETS.find((preset) => preset.id === audioState.preset) || AUDIO_PRESETS[0];
}

export function audioSummary() {
  const output = currentAudioOutput();
  const preset = currentAudioPreset();
  return `${output.name} · ${preset.label.toLowerCase()} · ${preset.frames} frames`;
}

const isDefault = (device) => audioState.defaults[device.direction] === device.id;

function deviceHtml(device) {
  const selected = audioState.selected === device.id;
  const fallback = isDefault(device);
  return `<button type="button" class="os-audio-device${selected ? " is-selected" : ""}${fallback ? " is-default" : ""}" data-audio-device="${esc(device.id)}" aria-pressed="${selected}" aria-label="${esc(device.name)}, ${esc(device.detail)}${fallback ? ", default" : ""}">
    <span class="os-audio-device__icon"><svg class="icon"><use href="#${device.icon}"/></svg></span>
    <span class="os-audio-device__text"><b>${esc(device.name)}</b><small>${esc(device.detail)}</small></span>
    <span class="os-audio-device__badge">default</span>
  </button>`;
}

function renderMeter() {
  if (!audioMeter || audioMeter.childElementCount) return;
  audioMeter.innerHTML = METER_HEIGHTS.map(
    (height, index) => `<i aria-hidden="true" style="--h:${height};--t:${(index * 37) % 420};--d:${(index * 53) % 760}"></i>`,
  ).join("");
}

function syncAudioUi() {
  const output = currentAudioOutput();
  const preset = currentAudioPreset();

  document.querySelectorAll("[data-audio-output]").forEach((list) => {
    list.innerHTML = AUDIO_DEVICES.filter((device) => device.direction === "output").map(deviceHtml).join("");
  });
  document.querySelectorAll("[data-audio-input]").forEach((list) => {
    list.innerHTML = AUDIO_DEVICES.filter((device) => device.direction === "input").map(deviceHtml).join("");
  });
  document.querySelectorAll("[data-audio-preset]").forEach((button) => {
    const active = button.dataset.audioPreset === preset.id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-audio-hero-output]").forEach((node) => {
    node.textContent = output.name;
  });
  document.querySelectorAll("[data-audio-tray-name]").forEach((node) => {
    node.textContent = output.name;
  });
  document.querySelectorAll("[data-audio-tray-detail]").forEach((node) => {
    node.textContent = output.detail;
  });
  document.querySelectorAll("[data-audio-mic-state]").forEach((node) => {
    node.classList.toggle("is-locked", audioState.locked);
  });
  const settingsOutput = document.querySelector("[data-settings-output]");
  if (settingsOutput) settingsOutput.value = output.setting;
}

function focusDevice(id) {
  const button = audioWindow?.querySelector(`[data-audio-device="${CSS.escape(id)}"]`);
  if (!button) return;
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest" });
}

function selectRelative(step) {
  const index = AUDIO_DEVICES.findIndex((device) => device.id === audioState.selected);
  const next = AUDIO_DEVICES[(index + step + AUDIO_DEVICES.length) % AUDIO_DEVICES.length];
  audioState.selected = next.id;
  syncAudioUi();
  focusDevice(next.id);
}

function activateDevice(id) {
  const device = audioDevice(id);
  if (!device) return;
  audioState.selected = id;

  if (isDefault(device)) {
    syncAudioUi();
    toast(`${device.name} · already default`);
    return;
  }

  audioState.defaults[device.direction] = id;
  if (device.direction === "output") {
    setSoundOutput(device.setting);
  }
  syncAudioUi();
  toast(`${device.name} · default ${device.direction}`);
}

function setAudioPreset(id) {
  const preset = AUDIO_PRESETS.find((item) => item.id === id);
  if (!preset || audioState.preset === preset.id) return;
  audioState.preset = preset.id;
  syncAudioUi();
  toast(`${preset.label} preset · ${preset.frames} frames`);
}

function cyclePreset() {
  const index = AUDIO_PRESETS.findIndex((preset) => preset.id === audioState.preset);
  const next = AUDIO_PRESETS[(index + 1) % AUDIO_PRESETS.length];
  setAudioPreset(next.id);
}

export function openAudio() {
  audioState.selected = audioState.defaults.output;
  openWindow("audio");
  syncAudioUi();
}

audioWindow?.addEventListener("click", (event) => {
  const device = event.target.closest("[data-audio-device]");
  if (device) {
    activateDevice(device.dataset.audioDevice);
    return;
  }
  const preset = event.target.closest("[data-audio-preset]");
  if (preset) {
    setAudioPreset(preset.dataset.audioPreset);
  }
});

audioWindow?.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, select, textarea, [contenteditable]")) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectRelative(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selectRelative(-1);
    return;
  }
  if (event.key === "Enter") {
    const deviceButton = event.target.closest("[data-audio-device]");
    if (event.target !== audioWindow && !deviceButton) return;
    event.preventDefault();
    activateDevice(deviceButton ? deviceButton.dataset.audioDevice : audioState.selected);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeWindow(audioWindow);
    return;
  }
  if (event.key.toLowerCase() === "p") {
    event.preventDefault();
    cyclePreset();
  }
});

/* Settings can change the output select; keep the app's default device and
   the tray row in step without coupling the two feature modules. */
document.addEventListener("sound-output-change", (event) => {
  const device = AUDIO_DEVICES.find(
    (item) => item.direction === "output" && item.setting === event.detail,
  );
  if (!device || audioState.defaults.output === device.id) return;
  audioState.defaults.output = device.id;
  audioState.selected = device.id;
  syncAudioUi();
});

renderMeter();
syncAudioUi();