# &lt;bracket-view&gt; v2

**A self-contained, zero-dependency interactive single-elimination tournament bracket Web Component.**

v2 reproduces the **paper-fold UX** of Google Search's tournament card:
- Each round pair (e.g. 32강 → 16강) is one "page" of a horizontally scrollable track
- **Click a tab** at the top → smooth-scroll to that page
- **Swipe / drag** the track → moves one page at a time via scroll-snap
- A round page always shows two columns: the current round + the next round
- Each match is a large card with date / status badge / (flag + name + score + previous-side ◀)
- Winners propagate forward automatically; the next round's slot light up
- Optional final column shows a trophy the moment a champion is determined

Zero dependencies. Zero build step. ~46KB single file.

## Live demo

https://sigco3111.github.io/bracket-view/

## Quick start

```html
<script type="module" src="./bracket-view.js"></script>

<bracket-view teams="A,B,C,D,E,F,G,H" title="Quarters"></bracket-view>
```

## Two modes

| Attribute        | Effect                                                     |
|------------------|------------------------------------------------------------|
| `layout="paper-fold"` (default) | Tab strip + swipe pages, two columns per page |
| `layout="flat"`                | Everything laid out left-to-right (v1 SVG mode)  |

Toggle at runtime: `el.setLayout('flat')` or `el.setLayout('paper-fold')`.

## Declarative API

```html
<!-- Simplest: just teams -->
<bracket-view teams="A,B,C,D,E,F,G,H"></bracket-view>

<!-- With a title (top of card) -->
<bracket-view teams="..." title="Esports Cup" layout="paper-fold"></bracket-view>
```

If `teams` is short, it is padded to the next power of two with `BYE`s, who auto-advance.

## Programmatic API

```js
import './bracket-view.js';

const bracket = document.querySelector('bracket-view');

bracket.setData({
  title: 'FIFA World Cup 2026',
  rounds: [
    [
      {
        id: 'M1',
        a: { name: '아르헨티나', flag: '🇦🇷' },
        b: { name: '호주', flag: '🇦🇺' },
        winner: 'a',
        status: 'fulltime',
        date: '7.10 (수) 오전 4:00',
        scores: { a: 2, b: 1 },
      },
      // …15 more Round-of-32 matches…
    ],
    // …Round-of-16 / QF / SF / Final…
  ]
});

bracket.randomFill();  // fill winners randomly — instant tourney simulator
bracket.reset();       // wipe all decisions back to round 1
bracket.getState();    // current snapshot
bracket.setLayout('flat');  // switch layouts at runtime
```

## Match data shape (paper-fold mode)

```js
{
  id: 'M1',
  a: { name: 'Argentina', flag: '🇦🇷', displayName: 'Argentina' },
  b: { name: 'Australia', flag: '🇦🇺', displayName: 'Australia' },
  winner: 'a',                  // 'a' | 'b' | null  — null = pending
  status: 'fulltime',           // 'scheduled' | 'live' | 'fulltime'
  date: '7.10 (수) 오전 4:00',
  kickoff: '오전 4:00',         // displayed when status === 'scheduled'
  scores: { a: 2, b: 1 },       // optional; shown when status !== 'scheduled'
  prev: { a: null, b: null },   // metadata: which previous-match fed which side
}
```

- **`flag`** can be an emoji (most reliable cross-platform) or an image URL — the team row tries to render it as text first.
- **`displayName`** is shown in the card. If absent, the code strips the flag from `name` and uses the remainder.
- **`status`** drives the badge style:
  - `scheduled` → 회색 "예정"
  - `live` → 빨간색 "진행 중"
  - `fulltime` → 청록색 "풀타임"
- **`winner`** auto-propagates to the next round's `a`/`b` slot when set by the user or via `randomFill()`.

## Events

| Event                | `event.detail`                                   |
|----------------------|--------------------------------------------------|
| `match-decided`      | `{ round, match, winner: string }`               |
| `match-focus`        | the match object that was focused                |
| `bracket-complete`   | `null` — fired after `randomFill()` finishes    |

```js
bracket.addEventListener('match-decided', (e) => {
  console.log(`R${e.detail.round + 1}, M${e.detail.match}: ${e.detail.winner} wins`);
});
```

## Interaction model

- **Click a team row inside a card** → marks that team as winner, propagates them into the next round.
- **Click an empty match card body** → focuses that card, dims all other cards, scales the focused one.
- **Click the focused card again** (or *Clear focus*) → unfocus.
- **Click a tab** → smooth-scrolls the track to that round page.
- **Swipe / drag** the track → moves one page to the left or right (uses scroll-snap).
- **↺ Reset** → wipe all decisions back to round 1.
- **⚄ Random** → instantly fills every match with a random winner (instant tournament simulator).
- **⤢ Flat** *(or* ⤡ Fold*)* → toggles between paper-fold and flat layout.

## Round labels

Korean tournament terms out of the box for 5-round tournaments:
- `32강`, `16강`, `8강`, `준결승`, `결승`

Other depths fall back to English: `Round of N`, `Quarterfinals`, `Semifinals`, `Final`.

Tabs show pairwise arcs:
```
32강 → 16강     16강 → 8강     8강 → 준결승     준결승 → 결승     결승
```

## Theming

```css
bracket-view {
  --bv-bg: #0f1115;        /* background           */
  --bv-card: #1a1d24;      /* match card fill      */
  --bv-card-hover: #252932;
  --bv-text: #e5e7eb;      /* team names           */
  --bv-text-dim: #9ca3af;
  --bv-accent: #4f9eff;    /* active tab underline */
  --bv-winner: #22c55e;    /* winner text          */
  --bv-loser: #6b7280;
  --bv-line: #2a2f3a;
  --bv-trophy: #facc15;
  --bv-danger: #ef4444;    /* live-state badge     */
}
```

Light theme:
```css
bracket-view {
  --bv-bg: #ffffff;
  --bv-card: #f8fafc;
  --bv-card-hover: #e0e7ff;
  --bv-text: #0f172a;
  --bv-text-dim: #64748b;
  --bv-accent: #2563eb;
  --bv-winner: #16a34a;
  --bv-line: #e2e8f0;
  --bv-trophy: #ca8a04;
  --bv-danger: #dc2626;
}
```

## Embedding

Because it is a custom element, it can be used like any HTML tag in any framework:

```jsx
// React
<bracket-view ref={ref} teams={csv} title="League" />
```

```vue
<!-- Vue -->
<bracket-view :teams="csv" title="League"></bracket-view>
```

## Try it locally

```bash
cd bracket-view
python3 -m http.server 8000
# → open http://localhost:8000
```

## What's new in v2 vs v1

| | v1 (flat) | v2 (paper-fold default) |
|---|---|---|
| Layout | One big horizontal SVG | Pages of pairs, scroll-snap |
| Navigation | Scroll the whole thing | Tabs **and** swipe |
| Card design | 56px tall, two text rows | 80px+ tall with date / status / flag / score |
| Winner propagation | ✓ | ✓ |
| Sticky tabs | ✗ | ✓ |
| Previous-side ◀ | ✗ | ✓ |
| Trophy column | SVG icon | Full block, in last page |

Both modes are kept — `layout="flat"` drops back to the v1 SVG mode for dense desktop views.

## License

MIT.
