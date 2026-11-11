# Water design system

The design language of **Data Cloud Compare**, distilled from the explorer's water
theme. It is plain CSS custom properties plus one dependency-free ES module — no
framework, no build step, no image assets.

- **Live showcase:** `/design-system/` in the assembled site.
- **Tokens:** [`tokens.css`](tokens.css)
- **Components:** [`components.css`](components.css)
- **Water effects:** [`water.js`](water.js)

```bash
bun scripts/assemble-site.ts   # copies this folder to dist/design-system/
```

## The water model

| Layer | Role | Implementation |
| --- | --- | --- |
| **Sea** | Depth, tone, place | Fixed radial + linear gradients via `--ds-bg-grad` |
| **Currents** | Ambient motion | Three SVG wave bands, different speeds and directions |
| **Caustics** | Light under water | Five low-alpha radial gradients on a canvas |
| **Glass** | Working surfaces | Translucent panels with `backdrop-filter: blur(18px)` |
| **Drops** | Feedback | Throttled pointer rings and a larger click ripple |

Rules:

1. Water is the default brand theme. Light is a "shallow water" variant, not a
   separate identity.
2. There is exactly one accent current. Status colours are semantic and separate.
3. Ambient motion is slow (14–58s cycles). Interface motion is fast (160–340ms).
4. Every effect can be switched off. `prefers-reduced-motion` disables it
   automatically.
5. Colour never carries meaning alone. Status pills always have a label and dot.

## Tones

Set `data-water-tone` on `<html>`:

| Tone | Accent | Background | Use |
| --- | --- | --- | --- |
| `lagoon` | `#55F0E0` | `#06414C` | Bright, optimistic marketing moments |
| `ocean` | `#38D6FF` | `#06232E` | Default product theme |
| `deep` | `#48B7FF` | `#03121F` | Quiet, archival, late-night |

Also available:

```html
<html
  data-water-tone="ocean"
  data-water-background="sea"   <!-- still | sea -->
  data-water-effects="on"       <!-- on | off -->
  data-water-speed="flowing"    <!-- calm | flowing | rapid -->
  data-theme="light"            <!-- shallow light variant -->
>
```

## Tokens

All tokens are namespaced `--ds-*`:

- **Colour** — `--ds-bg`, `--ds-surface`, `--ds-glass`, `--ds-text`, `--ds-text-2`,
  `--ds-text-3`, `--ds-line`, `--ds-accent`, `--ds-accent-rgb`, `--ds-glow`.
- **Status** — `--ds-green`, `--ds-blue`, `--ds-amber`, `--ds-orange`, `--ds-red`,
  `--ds-violet`, `--ds-gray`, `--ds-pink`, each with a matching `-bg`.
- **Type** — `--ds-font`, `--ds-font-mono`, `--ds-text-2xs` through `--ds-text-4xl`.
- **Space** — `--ds-space-1` (4px) through `--ds-space-13` (96px).
- **Radius** — `--ds-radius-xs` (5px) through `--ds-radius-2xl` (26px),
  plus `--ds-radius-pill`.
- **Elevation** — `--ds-shadow-soft`, `--ds-shadow`, `--ds-shadow-pop`.
- **Motion** — `--ds-motion-fast`, `--ds-motion-base`, `--ds-motion-layout`,
  `--ds-ease-out`.
- **Layout** — `--ds-content` (1180px), `--ds-header-h` (62px), `--ds-focus-ring`.

## Components

Everything uses the `ds-` prefix so it can coexist with Docusaurus or the app
stylesheet.

| Component | Classes |
| --- | --- |
| Button | `.ds-btn` + `--primary`, `--ghost`, `--quiet`, `--danger`, `--small`, `--block`; `.ds-icon-btn` |
| Verdict badge | `.ds-badge` + `--same`, `--moved`, `--possible`, `--partial`, `--missing`, `--local`, `--type`, `--muted`, `--solid` |
| Chip / key | `.ds-chip`, `.ds-kbd` |
| Card | `.ds-card` + `--quiet`, `--glass`, `--accent`; `.ds-card__icon`, `.ds-card__eyebrow` |
| Callout | `.ds-callout` + `--warning`, `--danger` |
| Form | `.ds-field`, `.ds-label`, `.ds-hint`, `.ds-input`, `.ds-select`, `.ds-check` |
| Switch | `.ds-switch` + `__track` + `__thumb` |
| Segmented | `.ds-segmented`, `.ds-segment` |
| Breadcrumb | `.ds-breadcrumbs`, `.ds-crumb`, `.ds-crumb-sep` |
| Search | `.ds-search` |
| Pane | `.ds-pane` + `__head`, `__title`, `__icon`, `__titles`, `__toolbar`, `__columns`, `__rows`, `__row`, `__name`, `__size`, `__foot` |
| Command bar | `.ds-command` + `__input`, `__list`, `__group`, `__item`, `__foot` |
| Toast | `.ds-toast` |
| Stat | `.ds-stat` + `__value`, `__label` |
| Water | `.ds-sea`, `.ds-wave` + `--far`, `--mid`, `--near`; `.ds-ripple-pond` |

Example:

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">

<html data-water-tone="ocean" data-water-background="sea">
  <button class="ds-btn ds-btn--primary">Reveal counterpart</button>
  <span class="ds-badge ds-badge--moved"><span class="ds-dot"></span>Moved</span>
</html>
```

## Water surface

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

Pass `scope` to confine pointer events to one element (used by the ripple pond).
The canvas must be positioned over the area it decorates. The module caps the
device pixel ratio at 1.5, limits itself to 90 live ripples, and stops rendering
when the tab is hidden.

## Accessibility

- Motion stops under `prefers-reduced-motion: reduce`.
- Decorative layers are `aria-hidden="true"` and `pointer-events: none`.
- Focus uses `--ds-focus-ring`; it is never removed.
- Status pills pair colour with a text label and a dot.
- The water controls in the showcase expose `aria-pressed`.
- Interactive text meets contrast on `--ds-surface` in both themes.

## Files

```text
design-system/
  tokens.css       canonical tokens and tones
  components.css   component primitives
  water.js         caustics, drips, and ripples
  index.html       component showcase
  showcase.css     showcase-only layout
  showcase.js      showcase controls
```
