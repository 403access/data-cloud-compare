/* Aether OS — Sound
   Volume, mute, output, and the now-playing line in the Sound tray. */

import { toast } from "../core/toast.js";
import { registerTray } from "../shell/popovers.js";
import {
  setTrackChangeHandler, togglePlay, trackArtist, trackTitle,
} from "./music.js";

setTrackChangeHandler(syncSoundUi);

/* --------------------------------------------------------------- sound */

export const soundState = {
  volume: 42,
  muted: false,
  output: "Harbour speakers",
};

const soundSliders = document.querySelectorAll("[data-sound-slider]");
const soundMuteButtons = document.querySelectorAll("[data-sound-mute]");
const soundPlayButton = document.querySelector("[data-sound-play]");

function syncSoundUi() {
  const toggle = document.querySelector('[data-tray-toggle="sound"]');
  const level = soundState.muted ? "Muted" : `${soundState.volume}%`;
  const title = `Sound · ${level}`;

  toggle?.setAttribute("title", title);
  toggle?.setAttribute("aria-label", `Sound, ${level}`);
  toggle?.querySelector("use")?.setAttribute("href", soundState.muted ? "#i-volume-off" : "#i-volume");

  soundSliders.forEach((slider) => {
    slider.value = String(soundState.muted ? 0 : soundState.volume);
  });
  document.querySelectorAll("[data-sound-value]").forEach((node) => (node.textContent = level));
  document.querySelectorAll("[data-sound-state]").forEach((node) => (node.textContent = soundState.output));
  document.querySelectorAll("[data-sound-output-label]").forEach((node) => {
    node.textContent = soundState.output;
  });
  soundMuteButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(soundState.muted));
    button.setAttribute("aria-label", soundState.muted ? "Unmute" : "Mute");
    button.querySelector("use")?.setAttribute("href", soundState.muted ? "#i-volume-off" : "#i-volume");
  });
  document.querySelectorAll("[data-sound-track]").forEach((node) => {
    node.textContent = trackTitle?.textContent || "Deep Current";
  });
  document.querySelectorAll("[data-sound-artist]").forEach((node) => {
    node.textContent = trackArtist?.textContent || "Tide Ensemble · 04:32";
  });
}

export function setSoundVolume(value) {
  soundState.volume = Math.max(0, Math.min(100, Number(value)));
  soundState.muted = soundState.volume === 0;
  syncSoundUi();
}

export function toggleMute() {
  soundState.muted = !soundState.muted;
  if (!soundState.muted && soundState.volume === 0) soundState.volume = 42;
  syncSoundUi();
  toast(soundState.muted ? "Sound muted" : `Sound · ${soundState.volume}%`);
}

export function setSoundOutput(output) {
  soundState.output = output || soundState.output;
  syncSoundUi();
}

soundSliders.forEach((slider) => {
  slider.addEventListener("input", () => setSoundVolume(slider.value));
});
soundMuteButtons.forEach((button) => button.addEventListener("click", toggleMute));
soundPlayButton?.addEventListener("click", () => togglePlay());

registerTray("sound", { open: syncSoundUi });
syncSoundUi();
