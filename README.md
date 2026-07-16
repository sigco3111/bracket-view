# &lt;bracket-view&gt;

**A self-contained, zero-dependency, zero-build interactive single-elimination tournament bracket Web Component.**

Inspired by Google Search's elegant bracket visualization: smooth focus dimming, click-to-advance winners, lines that light up as decisions are made, and a clean trophy on the right of the final.

- Single file (`bracket-view.js`, ~20KB)
- No frameworks, no npm, no build step
- Pure ES module / Custom Element (works anywhere)
- Mobile-friendly horizontal scroll
- Accessible: keyboard-friendly, `prefers-reduced-motion` honored

## Quick start

```html
<script type="module" src="./bracket-view.js"></script>

<bracket-view teams="Apple,Banana,Cherry,Date" title="Fruit Bracket"></bracket-view>
```

## Usage

### Declarative (simplest)

Pass a comma-separated team list. Sizes are auto-padded to the next power of two with BYEs.

```html
<bracket-view
  teams="T1,GenG,HLE,DK,PSG,G2,FNC,MAD"
  title="Esports Cup"
></bracket-view>
```

### Programmatic (recommended for 32+ teams or dynamic data)

```js
import './bracket-view.js';

const bracket = document.querySelector('bracket-view');
bracket.setData({
  title: 'World Cup',
  rounds: [
    [
      { id: 'M1', a: { name: 'Brazil' }, b: { name: 'Argentina' }, winner: 'a' },
      // ...
    ],
    // ...
  ]
});
```

### Toolbar API

```js
bracket.randomFill();   // fill winners randomly — instant tourney simulator
bracket.reset();        // wipe all decisions
bracket.getState();     // { title, rounds } current snapshot
```

## Events

The component fires bubbling, composed events you can listen to from the outside:

| Event                | `event.detail`                                   |
|----------------------|--------------------------------------------------|
| `match-decided`      | `{ round, match, winner: string }`               |
| `match-focus`        | the match object that was focused                |
| `bracket-complete`   | `null` — fired after `randomFill()` finishes    |

```js
bracket.addEventListener('match-decided', (e) => {
  console.log(`R${e.detail.round + 1} ${e.detail.match}: ${e.detail.winner} wins`);
});
```

## Interaction model

- **Click a team row** → marks that team as winner, propagates them into the next round, lights up their connector line.
- **Click an empty match card surface** → focuses that match, dims all other matches, scales the focused one.
- **Click the focused match card again** (or *Clear focus* button) → unfocuses.
- **↺ Reset** → wipe all decisions back to round 1.
- **⚄ Random** → instantly fills every match with a random winner (good for "who would win" tournaments).
- **✕ Clear focus** → exits the dim/focus state.

## Data shape

```js
{
  title: 'World Cup',
  rounds: [
    // Round 1 (Round of 32)
    [
      { id: 'M1', a: { name: 'Brazil' },   b: { name: 'Argentina' }, winner: null },
      { id: 'M2', a: { name: 'France' },   b: { name: 'Spain' },    winner: 'a' },
      ...
    ],
    // Round 2 (Round of 16)
    [
      { id: 'M17', a: { name: 'Brazil' }, b: { name: 'France' }, winner: null },
      ...
    ],
    // ...semis, final
  ]
}
```

Each team's `.name` is required. `.isBye = true` auto-advances the other side; `.isTbd = true` renders as "TBD" until filled in.

## Theming

Customize via the host element's CSS custom properties:

```css
bracket-view {
  --bv-bg: #0f1115;        /* background           */
  --bv-card: #1a1d24;      /* match card fill      */
  --bv-card-hover: #252932;
  --bv-text: #e5e7eb;      /* team names           */
  --bv-text-dim: #9ca3af;
  --bv-accent: #4f9eff;    /* focus / connector    */
  --bv-winner: #22c55e;    /* winner text          */
  --bv-loser: #6b7280;
  --bv-line: #2a2f3a;
  --bv-trophy: #facc15;
}
```

Want a light theme? Wrap with your own selectors:

```html
<div class="light">
  <bracket-view teams="..."></bracket-view>
</div>

<style>
  .light bracket-view {
    --bv-bg: #ffffff;
    --bv-card: #f8fafc;
    --bv-card-hover: #e0e7ff;
    --bv-text: #0f172a;
    --bv-text-dim: #64748b;
    --bv-accent: #2563eb;
    --bv-winner: #16a34a;
    --bv-line: #e2e8f0;
    --bv-trophy: #ca8a04;
  }
</style>
```

## Embedding into React / Vue / etc.

Because it's a real Custom Element, you can use it like any HTML tag:

```jsx
// React
<bracket-view ref={ref} teams={csv} title="League" />
```

```js
// Vue
<bracket-view :teams="csv" title="League" />
```

## Try it locally

```bash
cd bracket-view
python3 -m http.server 8000
# → open http://localhost:8000
```

## License

MIT.
