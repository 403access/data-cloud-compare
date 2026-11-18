/* Aether OS — Tide Radio
   Playback state and track metadata. Other modules subscribe to track changes
   instead of this module reaching into their UI. */

import { toast } from "../core/toast.js";
import { windowById } from "../shell/windows.js";

/* --------------------------------------------------------------- music */

const player = document.querySelector("[data-player]");
const playButton = document.querySelector('[data-cmd="toggle-play"]');
export const trackTitle = document.querySelector("[data-track-title]");
export const trackArtist = document.querySelector("[data-track-artist]");
const trackTime = document.querySelector("[data-track-time]");
const trackFill = document.querySelector("[data-track-fill]");
const equalizer = document.querySelector("[data-eq]");
export const playerWindow = windowById("music");
let playing = true;
let trackIndex = 0;
let onTrackChange = null;

export function setTrackChangeHandler(handler) {
  onTrackChange = handler;
}

const TRACKS = [
  { title: "Deep Current", artist: "Tide Ensemble", duration: "4:32", at: "1:43" },
  { title: "Glass Reef", artist: "Lagoon Lights", duration: "3:58", at: "0:00" },
  { title: "Caustic Drift", artist: "Ocean Floor", duration: "5:12", at: "0:00" },
];

function syncPlayState() {
  player?.classList.toggle("is-playing", playing);
  equalizer?.classList.toggle("is-paused", !playing);
  const controls = [playButton, document.querySelector("[data-sound-play]")];
  controls.forEach((button) => {
    if (!button) return;
    button.setAttribute("aria-pressed", String(playing));
    button.setAttribute("aria-label", playing ? "Pause" : "Play");
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", playing ? "#i-pause" : "#i-play");
  });
}

export function togglePlay() {
  playing = !playing;
  syncPlayState();
  toast(playing ? "Tide Radio playing" : "Tide Radio paused");
}

export function changeTrack(direction) {
  trackIndex = (trackIndex + direction + TRACKS.length) % TRACKS.length;
  const track = TRACKS[trackIndex];
  if (trackTitle) trackTitle.textContent = track.title;
  if (trackArtist) trackArtist.textContent = `${track.artist} · ${track.duration}`;
  if (trackTime) trackTime.textContent = `${track.at} / ${track.duration}`;
  if (trackFill) trackFill.style.width = "38%";
  playing = true;
  syncPlayState();
  onTrackChange?.();
  toast(`Tide Radio · ${track.title}`);
}

syncPlayState();
