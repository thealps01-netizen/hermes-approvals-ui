---
name: Approvals
description: The Hermes Desktop panel where the owner reads and decides memory and skill writes.
colors:
  ink: "var(--ui-text-primary)"
  ink-soft: "var(--ui-text-secondary)"
  ink-faint: "var(--ui-text-tertiary)"
  accent: "var(--ui-accent)"
  hairline: "var(--ui-stroke-tertiary)"
  rule: "var(--ui-stroke-secondary)"
  ground: "var(--ui-bg-chrome)"
  raised: "var(--ui-bg-elevated)"
  stop: "var(--ui-red)"
  go: "var(--ui-green)"
  caution: "var(--ui-orange)"
typography:
  title:
    fontSize: "22px"
    fontWeight: 600
  detail:
    fontSize: "15px"
    fontWeight: 600
  empty:
    fontSize: "14px"
    fontWeight: 600
  body:
    fontSize: "13px"
    fontWeight: 400
  label:
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  ctl: "6px"
  box: "8px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  base: "16px"
  lg: "24px"
components:
  card:
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "8px 12px"
  card-selected:
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
  empty-message:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
---

# Design System: Approvals

## Overview

**Creative North Star: "The Careful Editor's Desk"**

The panel is a desk where one person reads a proposed change and decides. The text of the change
has the lead role; lists, badges and buttons are the desk around it. The panel is a guest in the
Hermes Desktop app: it uses the app's UI kit and theme variables, so it changes with the owner's
theme and never brings its own palette or font.

The feel is warm with a little personality. Rows and labels stay quiet so the change text can be
read; an empty state may carry one small human touch, such as a friendly sentence or a small drawn
mark. It never reads as an admin table.

**Key Characteristics:**
- Reading first: the change text is the largest, calmest block on the page.
- One accent, used for the chosen item and the main action.
- Flat surfaces separated by hairlines; no drop shadows.
- Three tabs on top of the list column; a list on the left, the chosen item beside it.
- Empty is a normal, pleasant state.

## Colors

Every colour is a theme variable of the host app. The panel defines none.

### Primary
- **Accent** (`var(--ui-accent)`): the main action, and the edge of a card whose work is in progress.

### Neutral
- **Ink** (`var(--ui-text-primary)`): change text, titles.
- **Soft ink** (`var(--ui-text-secondary)`): labels, explanations, most supporting text.
- **Faint ink** (`var(--ui-text-tertiary)`): hints and timestamps.
- **Hairline** (`var(--ui-stroke-tertiary)`) and **Rule** (`var(--ui-stroke-secondary)`): the lines
  between rows and sections.
- **Ground** (`var(--ui-bg-chrome)`): opaque grounds, such as a sticky bar.
- **Raised** (`var(--ui-bg-elevated)`): the chosen card and menus.

### Status
- **Stop** (`var(--ui-red)`), **Go** (`var(--ui-green)`), **Caution** (`var(--ui-orange)`): a
  rule stopped the change, a saved change, a warning. Diff lines use the app's
  `--ui-diff-add-*` / `--ui-diff-remove-*` pairs.

### Named Rules
**The Guest Rule.** No hex value in the panel. A colour is a `--ui-*` variable or a `color-mix` of
one with `transparent`.

**The Opaque Ground Rule.** `--ui-bg-primary`, `-secondary`, `-tertiary` and `-card` are
translucent. Anything that must cover what scrolls under it uses `--ui-bg-chrome`.

## Typography

**Font:** the app's own (inherited). `var(--font-mono)` for change text that is code.

**Character:** small and even. Hierarchy comes from weight (600 for titles, 500 for labels) and from
ink strength, not from large size steps.

### Hierarchy
- **Title** (600, 22px): the page's name; one per tab at most.
- **Detail** (600, 15px): the name of the chosen change.
- **Empty** (600, 14px): the headline of an empty or error message.
- **Body** (400, 13px): explanations and the reviewer's text.
- **Label** (500, 12px, 0.02em): section labels, meta, badges.

### Named Rules
**The 12-13 Rule.** Almost all text is 12 or 13 px. A larger size marks exactly one thing on screen.

## Layout

Two columns inside a container query: a list 300 px wide (260 px in mid-width panes) and the chosen
item beside it. Under 760 px the columns stack and the decision bar moves to the bottom; under
560 px only the list shows until an item is opened. Spacing steps are 4, 8, 12, 16 and 24 px. Text
sits on a 16 px line.

## Elevation & Depth

Flat. Depth is carried by hairlines and by the raised ground of the chosen card. A card has a 4 px
coloured left edge, drawn as a layer under its face; the edge widens on hover and when chosen.

### Shadow Vocabulary
- **Status edge** (`--pa-lt-c`): green is safe to save, yellow needs attention, red is a problem or a
  deletion, the accent is work in progress, grey needs nothing from the owner. One meaning on every
  tab.
- **Chosen card:** the raised ground and a wider edge in its own status colour.

### Named Rules
**The No-Lift Rule.** Nothing floats. A drop shadow belongs to the app's menus, not to the panel.

## Shapes

Gently rounded: 8 px for cards, boxes and labelled buttons, 6 px for badges, a circle for dots. Borders are 1 px hairlines.

## Components

### Buttons
The app's `Button`, driven by `variant` and `size`. A labelled button is 28 px tall; the decision
bar is a tray of 32 px buttons. One primary action per decision bar; the others are `outline` or
`text`. Its internals should not be restyled; the 1.24.0 sheet still does so in places, see "Known
debt" in `Docs/approvals-left-tabs-redesign-2026-11-14.md`.

### Cards
- **Corner Style:** 8 px.
- **Background:** the pane surface at rest; `--ui-bg-elevated` when chosen. The status edge is always
  drawn.
- **Border:** hairline between cards.
- **Internal Padding:** 8 px by 12 px.
- A card is one button with one status `Badge`: ink text with a dot in the status colour.

### Navigation
Three tabs in one row on top of the list column. The current tab is a raised pill that slides to
the next one. Under 760 px the row spans the pane.

### Empty and error messages
An icon, a 14 px headline and one or two body sentences in soft ink, with at most one action. This
is the place for the panel's small human touch.

## Do's and Don'ts

### Do:
- **Do** give the change text the most room and the strongest ink.
- **Do** use the app's kit components (`Button`, `Badge`, `Tip`) through `variant` and `size`.
- **Do** keep every state readable at 420 px.
- **Do** make an empty tab say, in one friendly sentence, that nothing needs the owner now.

### Don't:
- **Don't** write a hex colour or set a font family.
- **Don't** add a drop shadow or a second accent.
- **Don't** draw tables with column headers; the owner called that look an admin table.
- **Don't** open on a screen full of buttons; the first screen has one main action.
