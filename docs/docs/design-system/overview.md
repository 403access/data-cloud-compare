---
slug: /design-system
title: Water design system
sidebar_label: Overview
sidebar_position: 1
description: The tokens, components, and motion rules behind the Data Cloud Compare water theme.
---

# Water design system

**Data Cloud Compare looks like deep water.** The explorer, the marketing site, and this
documentation share one small design system: deep-sea surfaces, a single cyan current,
semantic verdict colours, and slow liquid motion that can be switched off.

<p>
  <span className="doc-badge">Water theme</span>{' '}
  <span className="doc-badge">3 tones</span>{' '}
  <span className="doc-badge">Light + dark</span>{' '}
  <span className="doc-badge">Reduced-motion safe</span>
</p>

<a
  className="button button--primary button--md"
  href="../../design-system/"
>
  Open the live component gallery
</a>

## The water model

Water is a layering system, not a filter:

| Layer | Job | Implementation |
| --- | --- | --- |
| **Sea** | Establish depth and place | Fixed radial and linear gradients |
| **Currents** | Add ambient motion | Three SVG wave bands at different speeds |
| **Caustics** | Show light under water | Five low-alpha radial gradients on a canvas |
| **Glass** | Keep working surfaces legible | Translucent panels with backdrop blur |
| **Drops** | Acknowledge pointer and click | Throttled rings and one larger click ripple |

The rules:

1. Water is the default brand theme. Light is a "shallow water" variant.
2. Exactly one accent current means action or selection. Status colours are separate.
3. Ambient motion is slow (14–58s cycles). Interface motion is fast (160–340ms).
4. Every decorative effect can be disabled. `prefers-reduced-motion` does it automatically.
5. Colour never carries meaning alone: verdicts pair colour with a label and a dot.

## Tones

Set `data-water-tone` on the root element:

| Tone | Accent | Background | Feeling |
| --- | --- | --- | --- |
| `lagoon` | `#55F0E0` | `#06414C` | Bright, tropical, optimistic |
| `ocean` | `#38D6FF` | `#06232E` | Clear, focused, default |
| `deep` | `#48B7FF` | `#03121F` | Quiet, archival, late-night |

```html
<html
  data-water-tone="ocean"
  data-water-background="sea"
  data-water-effects="on"
  data-water-speed="flowing"
>
```

Switch `data-theme="light"` for the shallow-light variant. It keeps the same
structure and uses a deeper cyan for contrast.

## Tokens

The canonical file is [`design-system/tokens.css`](https://github.com/403access/data-cloud-compare/blob/main/design-system/tokens.css).
Everything is a custom property:

| Group | Tokens |
| --- | --- |
| Surfaces | `--ds-bg`, `--ds-bg-soft`, `--ds-surface`, `--ds-surface-2`, `--ds-glass`, `--ds-popover` |
| Text | `--ds-text`, `--ds-text-2`, `--ds-text-3`, `--ds-text-inverse` |
| Lines | `--ds-line`, `--ds-line-strong`, `--ds-hover`, `--ds-selection` |
| Accent | `--ds-accent`, `--ds-accent-strong`, `--ds-accent-soft`, `--ds-accent-rgb`, `--ds-glow` |
| Status | `--ds-green`, `--ds-blue`, `--ds-amber`, `--ds-orange`, `--ds-red`, `--ds-violet`, `--ds-gray`, `--ds-pink` (+ `-bg`) |
| Type | `--ds-font`, `--ds-font-mono`, `--ds-text-2xs` … `--ds-text-4xl` |
| Space | `--ds-space-1` (4px) … `--ds-space-13` (96px) |
| Radius | `--ds-radius-xs` (5px) … `--ds-radius-2xl` (26px), `--ds-radius-pill` |
| Elevation | `--ds-shadow-soft`, `--ds-shadow`, `--ds-shadow-pop` |
| Motion | `--ds-motion-fast`, `--ds-motion-base`, `--ds-motion-layout`, `--ds-ease-out` |

## Components

Import the tokens and primitives together:

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
```

The component layer is namespaced with `ds-` so it can coexist with Docusaurus or
the app's own stylesheet.

- **Actions:** `.ds-btn` with `--primary`, `--ghost`, `--quiet`, `--danger`, `--small`.
- **Verdicts:** `.ds-badge` with `--same`, `--moved`, `--possible`, `--partial`,
  `--missing`, `--local`, `--type`, `--muted`.
- **Surfaces:** `.ds-card` with `--quiet`, `--glass`, `--accent`.
- **Forms:** `.ds-field`, `.ds-input`, `.ds-select`, `.ds-switch`, `.ds-check`.
- **Navigation:** `.ds-segmented`, `.ds-breadcrumbs`, `.ds-search`.
- **Product patterns:** `.ds-pane`, `.ds-command`, `.ds-toast`, `.ds-stat`.
- **Water:** `.ds-sea`, `.ds-wave`, `.ds-ripple-pond`.

```html
<button class="ds-btn ds-btn--primary">Reveal counterpart</button>
<span class="ds-badge ds-badge--moved"><span class="ds-dot"></span>Moved</span>
```

## Motion and effects

The interactive layer lives in [`design-system/water.js`](https://github.com/403access/data-cloud-compare/blob/main/design-system/water.js):

```js
import { WaterSurface } from "./water.js";

const water = new WaterSurface(document.querySelector("#water-fx"), {
  tone: "ocean",
  speed: "flowing",
  intensity: "subtle",
  effects: true,
  drips: true,
  clickRipples: true,
  caustics: true,
});

water.setTone("lagoon");
water.setEnabled(false);
```

The module caps device pixel ratio at 1.5, limits live ripples to 90, pauses when the
tab is hidden, and does nothing under reduced motion.

## Accessibility contract

- Motion stops under `prefers-reduced-motion: reduce`.
- Decorative layers are `aria-hidden` and ignore pointer events.
- Focus uses a visible ring; it is never removed.
- Verdict pills pair colour with a label and a dot.
- Water controls expose `aria-pressed`.
- Interactive text meets contrast on surfaces in both themes.

## Where it lives

```text
design-system/
  tokens.css       canonical tokens and tones
  components.css   component primitives
  water.js         caustics, drips, ripples
  index.html       component showcase
  showcase.css     showcase-only layout
  showcase.js      showcase controls
```

The marketing site imports the palette directly. This documentation maps the same
values onto Docusaurus' `--ifm-*` variables in `src/css/custom.css`. The explorer
uses the original app stylesheet in `app/public/css/`, which is the source these
tokens were distilled from.
