# Discovered landing page design system

This is the implementation handoff for the public landing page at `/`. The
working product remains at `/discover`.

## Design read

Discovered is a safety-adjacent field-operations tool for search and rescue,
wildland fire, and hunting teams. The visual language is calm, high-contrast,
data-aware, and inspired by the supplied WHOOP guide without copying its logo,
metrics, or proprietary language.

- Design variance: 6/10. Split hero, offset stat groups, structured grids.
- Motion intensity: 5/10. Route drawing and live-state pulses explain the map.
- Visual density: 4/10. Generous section spacing with compact field data.

## Tokens

The page is dark by default and uses the existing `data-theme` attribute. The
first load respects `prefers-color-scheme`; the saved app theme remains the
source of truth after a user changes it.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| Background | `#080B0D` | `#F2F4F1` | Page canvas |
| Surface | `#101517` | `#FBFDFB` | Preview chrome |
| Copy | `#F0F2EE` | `#101716` | Primary text |
| Muted | `#91A09F` | `#53615F` | Supporting text |
| Accent | `#2DD4BF` | `#087F70` | CTA, route state, active data |
| Line | `rgba(232,237,242,.13)` | `rgba(8,11,13,.14)` | Structure |

WHOOP is a visual reference only. The landing page does not use WHOOP branding,
logos, proprietary scores, or health-related language.

## Typography

The source guide recommends Proxima Nova for headings and DINPro for numbers.
This project does not ship those fonts, so the fallback stack is deliberate:
Arial/Helvetica for copy and tabular numerals for field data. Headings are
uppercase or tightly tracked, with short lines and strong contrast. Avoid adding
gradient text, extra display fonts, or fake precision metrics.

## Components

- `Brand`: shared wordmark and icon treatment for navigation, CTA, and footer.
- `MissionMap`: an actual React preview with SVG data paths, live member markers,
  pause/play control, and an explicit traversed-corridor assumption.
- `LandingButton`: one primary intent, “Start a session”, always routes to
  `/discover`.
- `ThemeButton`: uses the app’s existing `fl.theme` storage and `data-theme`
  attribute.
- Benefit and use-case groups use borders and negative space rather than heavy
  card shadows. The sole visual accent is teal.

## Content safety

The page describes recorded movement, markers, notes, and playback. It must not
claim that Discovered finds people, proves an area was seen, replaces protocol,
or improves operational outcomes. Use “traversed corridor” only with the
assumption: “assumes each person observes X metres either side of their track.”
Avoid “searched”, “cleared”, “covered”, “complete”, and “swept” when describing
an area.

## Motion and accessibility

Route drawing shows movement accumulating on the map; live pulses show current
members. The map control pauses both. `prefers-reduced-motion` collapses the
animations, and all interactive controls retain visible focus and high contrast.
The layout collapses to one column below 640px and is designed to read at 390px.
