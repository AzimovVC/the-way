# Streaky Design System

Streaky is a habit tracker built like a game. You don't manage a checklist — you walk a path. Each habit is a bead on a winding trail, each day you keep it the streak grows, and the app spends its visual budget on making that number feel worth protecting.

The system is **dark-first**. The shell is a desaturated blue-black; all the colour in the product belongs to progress — marigold for what you owe today, teal for what you've kept, coral for what you dropped, cobalt for how far along you are.

## Provenance and honest limits

This design system was authored from scratch for this project. It has **no external source** — no codebase, no Figma file, no brand guidelines.

The request arrived with four screenshots of the Duolingo mobile app as a style reference. Duolingo's mascot, wordmark, illustration library and screen designs are protected brand assets and were **not** reproduced, traced or reconstructed. What carried over is the generic interaction genre those screenshots belong to — a gamified learning app: a vertical node path, persistent metric counters, timed quests, glyph-only bottom navigation, chunky press-down controls. Every colour, typeface, component, name, and piece of copy in Streaky is original to this system.

Consequences worth knowing:

- **No logo.** Streaky has no drawn mark. The brand renders as a type-set wordmark (`guidelines/brand-wordmark.card.html`). Do not invent one.
- **No illustration.** Nothing in `assets/` is artwork. Every image area in the system is an `ArtSlot` — a labelled placeholder saying what belongs there. Commission or supply real art; do not substitute hand-drawn SVG.
- **Fonts are substitutes.** Fredoka and Figtree are Google Fonts, loaded from the Google CDN rather than shipped as local binaries. If Streaky ever licenses real type, replace `tokens/fonts.css`.
- **Icons are substituted.** Lucide, via CDN. See ICONOGRAPHY.

---

## CONTENT FUNDAMENTALS

**Voice: a steady friend, not a coach.** Streaky never shouts and never scolds. It states what happened and what's next.

- **Person.** Second person for anything the user does ("Check in", "Your streak stays intact"). First person only when the app is the one acting, and then it's plural and quiet ("We'll retry"). Never "I".
- **Casing.** Sentence case everywhere — buttons, headings, labels, dialog titles. The **only** uppercase in the system is the eyebrow/kicker (`SECTION 1 · WEEK 3`, `WEEKEND QUEST`) and button labels, which are set in caps with 0.04em tracking as a type treatment, not as emphasis.
- **Length.** Buttons: one or two words ("Check in", "Use rest day", "Add habit"). Headings: under 40 characters. Body: one or two sentences, then stop.
- **Punctuation.** Periods on full sentences, including single-sentence blurbs. No exclamation marks except in a reward moment, and at most one per screen. No em dashes in UI copy. No ellipses.
- **Numbers.** Digits always, never spelled out. Thin space as the thousands separator (`1 240`), never a comma. Durations abbreviate in caps (`1D`, `6H`, `20M`) and never show seconds.
- **Emoji: never.** Not in UI, not in notifications, not in marketing. State is carried by a glyph and a colour.

**Tone by moment**

| Moment | Rule | Example |
| --- | --- | --- |
| Prompt | Name the action, no motivation | "Check in" |
| Success | Report the number, let it land | "12 days. Your best run yet." |
| Missed day | Neutral, no blame, offer the recovery | "Yesterday's open. Use a rest day to keep the streak." |
| Empty | Lower the bar | "Start with one. One is plenty." |
| Error | Say what failed and what we'll do | "Couldn't sync. We'll retry." |
| Advice | Short, concrete, slightly contrarian | "Start smaller than feels useful. You can always raise it." |

**Never write:** "Amazing work!!", "You've got this 💪", "Oops!", "Don't break the chain!", "Just 3 more to go!!!", streak-guilt of any kind ("you're about to lose everything").

---

## VISUAL FOUNDATIONS

### Colour

A dark neutral shell with saturated, flat accents. No gradients anywhere — not in backgrounds, not in buttons, not in charts. Flat fills only.

- **Shell:** `--ink-950` (sunken wells) → `--ink-900` (app) → `--ink-800` (card) → `--ink-700` (raised) → `--ink-600` (tracks). Slightly blue-cast, never pure grey, never pure black.
- **Marigold `#FFC93D`** is the commit colour: the primary button, today's bead, the checked weekday. Text on marigold is always near-black `#2A1F02`, never white.
- **Teal `#2ED3B7`** means kept — completed habits, on switches, finished bars.
- **Coral `#F2547D`** means urgent or dropped — missed days, destructive actions.
- **Cobalt `#3D8BFF`** is neutral progress: quest bars, counts, focus rings.
- **Violet `#9B6BFF`** is social and rest: friends, rest days, the Quests header.
- **Rust `#FF6B45`** is the streak flame and nothing else.
- **Metric colours are fixed.** Flame is rust, gems are cobalt, XP is marigold, rest is violet — in every context, forever. Swapping them breaks recognition.
- Maximum two coloured background blocks per screen (a chapter banner and a header, say). Everything else is ink.
- Light theme exists (`[data-theme="light"]`) but is a courtesy, not the design target.

### Type

Two families, strictly divided.

- **Fredoka** — display. Every heading, every button label, **every numeral in the product**. Rounded terminals, wide apertures; it's what makes the system feel soft rather than severe. Weights 600/700.
- **Figtree** — UI and body. Labels, copy, captions, meta lines. Weights 500/700.
- **JetBrains Mono** appears only in this design system's own specimen cards to print token names. It is not a product font.
- Numerals are always tabular (`.sk-num`) so counters don't jitter as they tick.
- Scale runs 11 → 52px on roughly a 1.2 ratio. Body is 17px — larger than a typical web default, because the app is read at arm's length with one hand.
- Tracking: `-0.02em` on display sizes 32px and up; `0.09em` on eyebrows; `0.04em` on button caps. Body is untracked.

### Space and layout

- 4px base, exposed as `--s-1`…`--s-13` (2 → 80px). `--s-5` (12) for stacks, `--s-6` (16) for screen padding, `--s-9` (32) between sections.
- The app is a single 440px column (`--w-app-max`) — it does not have a responsive desktop layout.
- **Fixed chrome:** the metric top bar (56px) and the tab bar (72px) are always present on tab-level screens and always absent on pushed screens (habit detail, new habit), which carry a back affordance instead. Sheets and toasts are positioned against the tab bar, not the viewport.
- Tap targets never below 44px. Path beads are 76px.
- The path is drawn by alternating horizontal offsets (−58 / 0 / +58 / 0) with a 24px vertical gap. There is no drawn connector line — the rhythm of the offsets is the path.

### Depth: the plinth

Streaky has exactly one depth idea, and it replaces shadows almost everywhere.

**Interactive surfaces sit on a solid offset shadow** — `0 4px 0` in a darker shade of the element's own colour. On press, the shadow collapses to zero and the element translates down by the same amount, so the thing visibly compresses under the finger. Buttons, path beads, checkboxes, switches knobs, tappable cards.

- Depth by size: 3px (small), 4px (default), 6–8px (large buttons, path beads).
- **Disabled drops the plinth entirely** and goes to 45% opacity. Never a grey plinth.
- The inverse is the **inset well** — `inset 0 2px 0 rgba(0,0,0,.28)` on progress tracks, text fields and unfilled day dots, so empty things read as recessed and filled things read as raised.
- Blurred shadows are reserved for genuinely floating layers: bottom sheets, toasts, tooltips (`--shadow-md` / `--shadow-lg`). Nothing inline gets a blur.
- Solid fills also get a 3px inset white highlight at the top (`inset 0 3px 0 rgba(255,255,255,.28)`) on progress bars 18px and taller — a single-step gloss, not a gradient.

### Borders, radii, cards

- Hairline `1px solid var(--border-subtle)` on resting cards; `2px` on outline variants and focus rings.
- Radii are generous: 8 small, 12 fields, 16 buttons, 20 cards, 28 sheets, full for beads/chips/dots. Nothing in the system is square-cornered.
- **A card is:** `--surface-card` fill, 1px subtle border, 20px radius, 20px padding, no shadow. It gains a 4px plinth **only if it is tappable**. Nested cards step card → raised; never three levels.
- No coloured left-border accent cards. No glass panels.

### Motion

Short, springy, and only where something changed state.

- `--dur-fast` 140ms for presses; `--dur-base` 220ms for toggles; `--dur-slow` 360ms for bars and rings filling; `--dur-celebrate` 620ms for rewards.
- `--ease-out` for most things; `--ease-bounce` (overshoot 1.56) reserved for reward and toggle-knob motion; `--ease-snap` for the tab indicator.
- Bars and rings **animate their fill** on change — the number arriving matters more than the number.
- No parallax, no scroll-driven animation, no looping idle animation, no confetti.
- `prefers-reduced-motion` zeroes every duration via the token, so components need no extra handling.

### States

- **Hover** barely exists (this is a touch product). Where a pointer is present: no colour change on plinth elements, a 1px lift at most; ghost buttons brighten.
- **Press** is the whole interaction language: plinth collapse + 4px translate on plinth elements; `scale(0.97)` on icon buttons and other flat targets.
- **Focus** is a 2px cobalt inset ring on fields, and `--shadow-glow-focus` (3px cobalt halo) on anything else. Never removed.
- **Selected** is a colour fill plus a plinth (chips, weekday toggles) or a 2px inset ring in the accent (tabs, icon toggles).
- **Disabled** is 45% opacity, plinth removed, cursor not-allowed.
- **Locked** is its own state, not disabled: `--ink-600` fill, padlock glyph, muted label, no plinth collapse.

### Imagery and transparency

- Imagery, when it exists, should be flat vector illustration with thick outlines and a warm palette, on a solid colour field — no photography, no grain, no drop shadows on art. Until real art exists, use `ArtSlot`.
- Transparency is rare and functional: `rgba` only for overlay scrims (`--surface-overlay`, 72% ink), the inset gloss highlight, and text on coloured banners. **No frosted-glass panels, no translucent cards.** A 3px backdrop blur appears on the modal scrim alone.
- Charts are flat bars and conic rings in metric colours, no axes, no gridlines, minimal labels.

---

## ICONOGRAPHY

**Set: [Lucide](https://lucide.dev) (CDN, `lucide-static@0.544.0`). This is a substitution — flagged.** Streaky's visual language wants a slightly heavier, more filled glyph set to match the chunky type and plinth depth; Lucide's 2px monoline is the closest freely-licensable match in stroke weight and corner rounding. If you have budget for a custom set, that's the first thing to commission.

**How icons are rendered.** Never as inline SVG, and never as an `<img>`. The `Icon` component paints the glyph as a **CSS mask over `currentColor`**, so a single asset tints to any token:

```jsx
<Icon name="flame" size={22} color="var(--metric-streak)" />
```

**Sizes:** 12 (badge), 16 (inline with text), 20 (default, list rows), 22–24 (top bar, tiles), 28 (tab bar), 30–34 (metric chips, rewards). Nothing above 34 — larger than that is illustration, not iconography, and belongs in an `ArtSlot`.

**Fixed glyph vocabulary** — these mappings are part of the product's language and should not drift:

| Meaning | Glyph |
| --- | --- |
| Streak | `flame` |
| Currency | `gem` |
| XP | `zap` |
| Rest day | `moon` |
| Kept / complete | `check` |
| Missed | `x` |
| Not yet available | `lock` |
| Today / home | `house` |
| Quests | `target` |
| Stats | `chart-column` |
| Friends | `users` |
| More | `ellipsis` |
| Reward | `gift`, `package` |
| Habit categories | `droplet`, `dumbbell`, `book-open`, `pen-line`, `brain`, `apple`, `footprints`, `activity` |

**No emoji, ever** — not as icons, not in copy, not in notifications. **No Unicode symbols as icons** either; the one Unicode character in regular use is the middle dot `·` as a separator in meta lines ("Every day · 8:00"). Habit category glyphs come from the same Lucide set as the UI glyphs, so nothing in the app looks imported.

---

## Index

**Root**
- `styles.css` — the single entry point consumers link. `@import` lines only.
- `readme.md` — this file.
- `SKILL.md` — Agent Skills front matter, for use in Claude Code.
- `thumbnail.html` — homepage tile.

**`tokens/`** — `fonts.css` · `colors.css` · `typography.css` · `spacing.css` · `radius.css` · `elevation.css` · `motion.css` · `base.css`

**`components/`** — 25 primitives in six groups. Each has `.jsx`, `.d.ts` and `.prompt.md`; each directory has one card HTML.

| Group | Components |
| --- | --- |
| `core/` | Icon, Button, IconButton, Card, Badge, Chip, Divider |
| `progress/` | ProgressBar, MetricChip, StreakCounter, HabitRing, StatTile |
| `habits/` | HabitNode, HabitRow, QuestCard, UnitBanner, ArtSlot |
| `forms/` | Input, Checkbox, Switch, SegmentedControl, DayPicker |
| `navigation/` | TabBar, TopBar, ScreenHeader |
| `feedback/` | Toast, Dialog, EmptyState, Tooltip |

**`ui_kits/streaky-app/`** — click-through recreation of the mobile app (7 screens). See its README.

**`guidelines/`** — 20 specimen cards across Colors, Type, Spacing and Brand.

**`templates/habit-app/`** — `HabitApp.dc.html`, the starting template consuming projects copy: metric top bar, chapter banner, habit path, tab bar. `ds-base.js` alongside it points at this design system; a consuming project changes one line in that file.

### Intentional additions

No external source defined a component inventory, so the set is authored. Beyond the standard primitives, these exist because the product genre requires them: **Icon** (mask-tinting wrapper for the glyph set), **ArtSlot** (honest placeholder, since no artwork ships), **HabitNode** / **HabitRow** / **QuestCard** / **UnitBanner** / **StreakCounter** / **HabitRing** / **MetricChip** / **StatTile** / **DayPicker** (the habit-tracking and gamification vocabulary the app is built from).
