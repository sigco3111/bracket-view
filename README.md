# bracket-view

> A self-contained, zero-dependency `<bracket-view>` Web Component for
> single-elimination tournament brackets. Inspired by the
> paper-fold UX of Google Search's tournament card.

[![Live demo](https://img.shields.io/badge/Live%20demo-sigco3111.github.io%2Fbracket--view-blue?logo=githubpages&logoColor=white)](https://sigco3111.github.io/bracket-view/)
[![MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![JS-only](https://img.shields.io/badge/dependencies-zero-yellow.svg)]()
[![ESM](https://img.shields.io/badge/script%20type-module-blueviolet.svg)]()
[![46KB](https://img.shields.io/badge/size-~46KB-orange.svg)]()

---

## ✨ What it does

```html
<script type="module" src="./bracket-view.js"></script>
<bracket-view teams="Brazil,Croatia,Argentina,Netherlands,France,Poland,England,Senegal"
              title="FIFA World Cup 2026"
              layout="paper-fold">
</bracket-view>
```

→ a self-contained card UI with **tabs**, **swipe / drag navigation**, **click-to-decide**,
and **automatic winner propagation** — no React, no Vue, no build step, no server.

---

## 📸 Screenshot

The first card on the demo page (`https://sigco3111.github.io/bracket-view/`)
shows our component rendering an 8-team world cup bracket with full Korean UI,
flag emojis, dates, status badges, and bracket-line connectors.

```
┌─ FIFA World Cup 2026 ────────────────────────────────────────┐
│ [16강] [8강] [4강] [결승]            ↺ 초기화 ⚄ 랜덤 ⤢ 펼치기 │
│ 16강 승자는 8강으로 진출                                     │
│                                                              │
│  ┌─Brazil vs Croatia─┐  1    ┌─Brazil vs Netherlands─┐ ←     │
│  │ 🇧🇷  Brazil     1  │   \ /  │ 🇧🇷  Brazil       1  │      │
│  │ 🇭🇷  Croatia   ─ 0  │    X   │ 🇳🇱  Netherlands  ─ 0 │      │
│  └────────────────────┘   / \  └────────────────────────┘     │
│                          /   \                                 │
│  …                                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick start (any framework)

```bash
npm i sigco3111/bracket-view
# or just download bracket-view.js (ES module, single file, no deps).
```

```html
<script type="module" src="./bracket-view.js"></script>

<bracket-view teams="A,B,C,D,E,F,G,H"
              title="Esports Cup"
              layout="paper-fold">
</bracket-view>
```

Works equally well in **React**, **Vue**, **Svelte**, or plain HTML —
it's a Custom Element. Byes auto-advance so non-power-of-two team counts work too.

---

## 🎯 Features

| Feature | Detail |
|---|---|
| **paper-fold layout** *(default)* | Tabs + swipe pages — one round pair per page |
| **flat layout** | One continuous horizontal SVG track |
| **branded tabs** | Active underline tracks current page; smooth-scroll on click |
| **swipe / drag** | Native scroll-snap, one round-page at a time |
| **focus mode** | Click empty card body → dims the others, scales the focused one |
| **winner propagation** | Click a team row → winner propagates to next-round slot |
| **bracket-line connectors** | Each converged pair gets an M-curve between `from` and `to` columns |
| **staggered preview cards** | Right column card centerline sits exactly between two `from` matches |
| **rich content fit** | Flag + name + score + ◀ + meta row (date, status badge) all inside 96 px |
| **random fill** | "⚄ 랜덤" — instant tournament simulator |
| **reset** | "↺ 초기화" — wipe all decisions back to round 1 |
| **KO-natural Korean round labels** | `32강 / 16강 / 8강 / 준결승 / 결승` (out of the box for 5-round depth) |
| **themeable** | Override any of 12 `--bv-*` CSS variables |
| **zero deps, zero build** | Single ES module ~46 KB, drop in via `<script type="module">` |

---

## 🎛 Programmatic API

```js
import './bracket-view.js';              // registers <bracket-view>

const b = document.querySelector('bracket-view');

// 1. declarative: pass a CSV of team names
b.setData(b._generateFromTeams(['Brazil', 'Croatia', '…8 names']));
// (or simpler: just setAttribute the `teams` attr and setData is implicit)

// 2. declarative: full control, with scores & status
b.setData({
  title: 'World Cup 2026',
  rounds: [
    [ { a: { name: 'Brazil', flag: '🇧🇷' }, b: { name: 'Croatia', flag: '🇭🇷' },
        winner: 'a', status: 'fulltime',
        date: '7.11 (금) 오전 4:00',
        scores: { a: 1, b: 0 } },
      /* …3 more Round-of-16 matches… */ ],
    /* …Round-of-8… */
    /* …Semifinals… */
    [ { /* Final */ } ],
    [ { /* 3rd place playoff */ } ],
  ],
});

// 3. utilities
b.randomFill();                  // instantly picks winners (tournament simulator)
b.reset();                       // back to round 1, no decisions
b.setLayout('flat');             // switch to the v1-style SVG layout
b.getState();                    // deep-cloned snapshot, JSON-friendly
```

### `setData` shape

| Field | Required | Notes |
|---|---|---|
| `title` | no | Header above the tab bar |
| `rounds` | **yes** | Array, each element is an array of `match` objects. Index 0 = first round (largest = most matches). |
| `match.id` | no | Stable id, useful when wiring events |
| `match.a` / `match.b` | **yes (unless a `prev`)** | `{ name, flag, displayName? }`. Use `null` and rely on winner propagation if TBD. |
| `match.winner` | no | `'a' \| 'b' \| null`. Sets the winner and propagates to next round. |
| `match.scores.{a,b}` | no | Numbers; shown when `status !== 'scheduled'`. |
| `match.status` | no | `'scheduled'` / `'live'` / `'fulltime'` / `'completed'`. Drives the badge styling. |
| `match.date` | no | Shown in the meta row (e.g. `'7.11 (금) 오전 4:00'`). |
| `match.kickoff` | no | Shown in place of score when `status === 'scheduled'`. |

---

## 🖱 Interactions

| Action | Effect |
|---|---|
| Click a team row inside a card | Marks that team as winner, propagates to next round |
| Click an empty match card body | Focuses that card, dims others, scales it up |
| Click the focused card (or *Clear focus*) | Un-focus |
| Click a tab | Smooth-scrolls the track to that round page |
| Swipe / drag the track | Moves one page to the left or right |
| **↺ 초기화** | Wipe all decisions back to round 1 |
| **⚄ 랜덤** | Instantly fill every match with a random winner |
| **⤢ 펼치기** ⤡ 접기 | Toggle between paper-fold and flat layout |

---

## 🇰🇷 Round labels

For 5-round tournaments, the tabs are labelled `32강 / 16강 / 8강 / 준결승 / 결승`. Other depths fall back to a calculated `${total - idx}강` form, or to English (`Quarterfinals`, `Semifinals`, `Final`) if that's what the data implies.

Tab captions include the natural-language connector:

```
16강 승자는 8강으로 진출
8강 승자는 4강으로 진출
4강 승자는 결승으로 진출
결승 — 우승자 결정
```

…with idiomatic Korean 받침-rule (을 vs. 를, 으로 vs. 로) handled.

---

## 🎨 Theming

Override any of 12 CSS variables at the host:

```css
bracket-view {
  --bv-bg:         #0f1115;  /* page background        */
  --bv-card:       #1a1d24;  /* card fill              */
  --bv-card-hover: #252932;
  --bv-text:       #e5e7eb;  /* team names             */
  --bv-text-dim:   #9ca3af;
  --bv-accent:     #4f9eff;  /* tab underline / focus  */
  --bv-winner:     #22c55e;
  --bv-loser:      #6b7280;
  --bv-line:       #2a2f3a;
  --bv-trophy:     #facc15;
  --bv-danger:     #ef4444;
}
```

Light theme preset:

```css
bracket-view {
  --bv-bg: #fff; --bv-card: #f8fafc; --bv-card-hover: #e0e7ff;
  --bv-text: #0f172a; --bv-text-dim: #64748b;
  --bv-accent: #2563eb; --bv-winner: #16a34a;
  --bv-line: #e2e8f0; --bv-trophy: #ca8a04; --bv-danger: #dc2626;
}
```

---

## 🌐 Showcase: 8 libraries side-by-side

The demo page (`https://sigco3111.github.io/bracket-view/`) is also a
**library comparator**. The same 8-team single-elimination bracket is
rendered using 8 different open-source projects, so you can compare
their visual patterns at a glance:

| # | Library | How it's rendered on the demo page |
|---|---|---|
| 1 | **sigco3111/bracket-view (our build)** | Live imported from `./bracket-view.js` |
| 2 | Drarig29/brackets-viewer.js | Reimplemented in plain JS |
| 3 | kamilwylegala/vue-tournament-bracket | Reimplemented in plain JS |
| 4 | teijo/jquery-bracket | Reimplemented in plain JS |
| 5 | moodysalem/react-tournament-bracket | Reimplemented in plain JS (SVG) |
| 6 | CSS-only baseline (Google Search style) | Pure CSS |
| 7 | @amirhossein-shk/tournament-bracket-js | Live import (UMD, currently fails — library bug) |
| 8 | Zettersten/gracket | Live import (WebComponent) |

Each card flips between **Korean / English** via a header toggle that persists
in `localStorage`.

---

## 🧪 Try it locally

```bash
git clone https://github.com/sigco3111/bracket-view
cd bracket-view
python3 -m http.server 8000
# open http://localhost:8000
```

Or any static-file server. No backend, no install step.

---

## 📦 Embedding in a framework

Because it's a Custom Element, it's framework-agnostic:

```jsx
// React
<bracket-view ref={ref} teams={csv} title="League" />

// Vue
<bracket-view :teams="csv" title="League" />

// Svelte
<bracket-view {teams} {title} />

// Solid / Angular / Lit / etc.
<bracket-view teams={csv} title="League" />
```

---

## 🛠 Versioned evolution

| Version | Added |
|---|---|
| v1 (flat)   | One horizontal SVG, swipe/scroll |
| v2          | paper-fold UX + tabs + tabs-track underline |
| v3          | Connector M-curves between round pairs |
| v4          | Sticky tabs + focus isolation + blur dim |
| v6          | Card text-overflow handling |
| v8          | Equal-width `from` / `preview` columns via `minmax(0, 1fr)` |
| v9          | Showcase page comparing 5 different libraries |
| v10         | Replaced bracketry (the user-disapproved one) with 5 better libraries |
| v11         | Added our own `<bracket-view>` card #1 in the showcase |
| v17         | Full Korean localization: tabs, page titles, button labels, status badges, page subtitles with 자연스러운 Korean 조사 |
| v18-v19     | Card content fit + responsive font sizing |
| v20         | Content-rich preview slots (`flag + name + score + ◀ arrow`) |
| v21         | Preview cards staggered to bracket intersection lines via `grid-template-rows` math |
| v22         | Page-wide Korean / English locale switcher in the showcase |

---

## 📄 License

MIT. Use it, fork it, ship it.

```text
Copyright (c) 2026 Hyelyn (sigco3111)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```
