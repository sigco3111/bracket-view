/**
 * <bracket-view> — Interactive single-elimination tournament bracket
 *
 * Usage:
 *   <script type="module" src="./bracket-view.js"></script>
 *   <bracket-view teams="A,B,C,D,E,F,G,H" title="Quarter Finals"></bracket-view>
 *
 * Or programmatically:
 *   const b = document.querySelector('bracket-view');
 *   b.setData({ title: 'World Cup', rounds: [...] });
 *   b.randomFill();
 *
 * Inspired by Google Search's tournament card UX:
 *   - Click a team row → marks that team as winner; auto-propagates to next round slot
 *   - Click a match body → focuses that match (others dim); click again to unfocus
 *   - Connectors light up as winners are decided
 *   - Smooth transforms, mobile-friendly horizontal scroll
 *
 * Zero dependencies. Zero build step.
 */

class BracketView extends HTMLElement {
  static get observedAttributes() {
    return ['teams', 'title'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = null;
    this._focusedMatch = null; // { round, match }
    this._originalTeams = [];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setData(data) {
    this._data = data;
    this._originalTeams = this._data.rounds[0].flatMap(m => [m.a?.name, m.b?.name]).filter(t => t && t !== 'TBD' && t !== 'BYE');
    this._focusedMatch = null;
    this._render();
  }

  getState() {
    return JSON.parse(JSON.stringify(this._data));
  }

  reset() {
    if (this._originalTeams.length) {
      this.setData(this._generateFromTeams(this._originalTeams, this._data?.title));
    }
  }

  randomFill() {
    if (!this._data) return;
    const rounds = this._data.rounds;
    for (let r = 0; r < rounds.length - 1; r++) {
      for (let m = 0; m < rounds[r].length; m++) {
        const match = rounds[r][m];
        if (!match.a?.isBye && !match.b?.isBye) {
          match.winner = Math.random() < 0.5 ? 'a' : 'b';
          this._propagateWinner(r, m);
        }
      }
    }
    const final = rounds[rounds.length - 1][0];
    if (!final.a?.isBye && !final.b?.isBye) {
      final.winner = Math.random() < 0.5 ? 'a' : 'b';
    }
    this._render();
    this.dispatchEvent(new CustomEvent('bracket-complete', { bubbles: true, composed: true }));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    const teamsAttr = this.getAttribute('teams');
    if (teamsAttr) {
      this._originalTeams = teamsAttr.split(',').map(t => t.trim()).filter(Boolean);
      this._data = this._generateFromTeams(this._originalTeams, this.getAttribute('title'));
    }
    this._render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'teams' && newVal) {
      this._originalTeams = newVal.split(',').map(t => t.trim()).filter(Boolean);
      this._data = this._generateFromTeams(this._originalTeams, this.getAttribute('title'));
      this._render();
    } else if (name === 'title' && this._data) {
      this._data.title = newVal;
      this._render();
    }
  }

  // ── Data generation ────────────────────────────────────────────────────────

  _generateFromTeams(teams, title) {
    // Pad up to next power of 2 with BYEs
    let size = 1;
    while (size < teams.length) size *= 2;
    const padded = [...teams];
    while (padded.length < size) padded.push('BYE');

    const mkTeam = name => ({ name, isBye: name === 'BYE', isTbd: name === 'TBD' });

    const rounds = [];
    let prev = padded.map(mkTeam);

    while (prev.length > 1) {
      const matches = [];
      let idCounter = rounds.reduce((a, r) => a + r.length, 0);
      for (let i = 0; i < prev.length; i += 2) {
        const a = prev[i], b = prev[i + 1];
        // Auto-advance bye
        let winner = null;
        if (a.isBye && !b.isBye) winner = 'b';
        else if (!a.isBye && b.isBye) winner = 'a';
        matches.push({ id: `M${++idCounter}`, a, b, winner });
      }
      rounds.push(matches);
      prev = matches.map(m => {
        if (m.winner === 'a') return m.a;
        if (m.winner === 'b') return m.b;
        return mkTeam('TBD');
      });
    }
    return { title: title || 'Tournament', rounds };
  }

  _propagateWinner(round, matchIdx) {
    if (round + 1 >= this._data.rounds.length) return;
    const nextMatch = this._data.rounds[round + 1][Math.floor(matchIdx / 2)];
    const winnerTeam = this._data.rounds[round][matchIdx].winner === 'a'
      ? this._data.rounds[round][matchIdx].a
      : this._data.rounds[round][matchIdx].b;
    if (matchIdx % 2 === 0) nextMatch.a = winnerTeam;
    else nextMatch.b = winnerTeam;
    nextMatch.winner = null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    if (!this._data) {
      this.shadowRoot.innerHTML = `<style>${this._css()}</style>`;
      return;
    }

    const { title, rounds } = this._data;
    const numRounds = rounds.length;
    const maxMatches = rounds[0].length;
    const isFocusing = !!this._focusedMatch;

    const ROUND_W = 220;
    const COL_GAP = 32;
    const PAD_X = 24;
    const PAD_Y = 32;
    const MATCH_H = 56;
    const MATCH_GAP = 24;

    const totalW = PAD_X * 2 + ROUND_W * numRounds + COL_GAP * (numRounds - 1);
    const totalH = PAD_Y * 2 + maxMatches * (MATCH_H + MATCH_GAP) - MATCH_GAP;
    // Add extra space for trophy on the right
    const TRophySpace = numRounds <= 1 ? 0 : 80;
    const viewW = totalW + TRophySpace;

    const roundXs = Array.from({ length: numRounds }, (_, r) => PAD_X + r * (ROUND_W + COL_GAP));
    const roundMatchCount = rounds.map(r => r.length);
    const roundStartYs = roundMatchCount.map(count => (totalH - (count * MATCH_H + (count - 1) * MATCH_GAP)) / 2);

    let svg = `<svg viewBox="0 0 ${viewW} ${totalH}" xmlns="http://www.w3.org/2000/svg" class="bracket-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${this._esc(title)}">`;

    // Connectors first (under cards)
    svg += `<g class="connectors">`;
    for (let r = 0; r < numRounds - 1; r++) {
      for (let m = 0; m < rounds[r].length; m++) {
        const match = rounds[r][m];
        const x1 = roundXs[r] + ROUND_W;
        const y1 = roundStartYs[r] + m * (MATCH_H + MATCH_GAP) + MATCH_H / 2;
        const nextMatchIdx = Math.floor(m / 2);
        const x2 = roundXs[r + 1];
        const y2 = roundStartYs[r + 1] + nextMatchIdx * (MATCH_H + MATCH_GAP) + MATCH_H / 2;
        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        const isActive = !!match.winner;
        svg += `<path class="connector ${isActive ? 'active' : ''}" d="${path}" />`;
      }
    }
    svg += `</g>`;

    // Round headers
    svg += `<g class="round-headers">`;
    const roundLabels = ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'];
    for (let r = 0; r < numRounds; r++) {
      const label = roundLabels[Math.max(0, 5 - numRounds) + r] || `R${r + 1}`;
      const xCenter = roundXs[r] + ROUND_W / 2;
      svg += `<text x="${xCenter}" y="14" class="round-label">${this._esc(label)}</text>`;
    }
    svg += `</g>`;

    // Match cards
    svg += `<g class="matches">`;
    for (let r = 0; r < numRounds; r++) {
      for (let m = 0; m < rounds[r].length; m++) {
        const match = rounds[r][m];
        const x = roundXs[r];
        const y = roundStartYs[r] + m * (MATCH_H + MATCH_GAP);
        const isFinal = r === numRounds - 1;
        const isFocused = isFocusing && this._focusedMatch.round === r && this._focusedMatch.match === m;
        const winnerA = match.winner === 'a';
        const winnerB = match.winner === 'b';

        svg += `<g class="match ${isFocused ? 'focus' : ''} ${isFinal ? 'final' : ''}" data-round="${r}" data-match="${m}" transform="translate(${x}, ${y})">`;
        svg += `<rect class="match-card" width="${ROUND_W}" height="${MATCH_H}" rx="10" />`;

        // Team A row
        svg += this._teamRow(0, ROUND_W, MATCH_H, winnerA, !!match.winner, match.a);
        // Separator
        svg += `<line class="separator" x1="0" y1="${MATCH_H / 2}" x2="${ROUND_W}" y2="${MATCH_H / 2}" />`;
        // Team B row
        svg += this._teamRow(MATCH_H / 2, ROUND_W, MATCH_H / 2, winnerB, !!match.winner, match.b);

        // Match index (subtle, top-right)
        svg += `<text x="${ROUND_W - 10}" y="12" class="match-id">${match.id}</text>`;

        svg += `</g>`;
      }
    }

    // Trophy / final marker
    if (numRounds > 1) {
      const finalMatch = rounds[numRounds - 1][0];
      const trophyX = roundXs[numRounds - 1] + ROUND_W + 16;
      const trophyY = roundStartYs[numRounds - 1] + MATCH_H / 2;
      const isChampionA = finalMatch.winner === 'a';
      const isChampionB = finalMatch.winner === 'b';
      const hasChampion = !!finalMatch.winner;
      svg += `<g class="trophy">
        <line class="trophy-stem" x1="${trophyX}" y1="${trophyY}" x2="${trophyX + 40}" y2="${trophyY}" ${hasChampion ? '' : 'style="display:none"'}/>
        <circle class="trophy-icon" cx="${trophyX + 56}" cy="${trophyY}" r="16" ${hasChampion ? '' : 'style="display:none"'}/>
        <text class="trophy-glyph" x="${trophyX + 56}" y="${trophyY + 5}" text-anchor="middle" ${hasChampion ? '' : 'style="display:none"'}>★</text>
        <text class="trophy-name" x="${trophyX + 56}" y="${trophyY + 32}" text-anchor="middle" ${hasChampion ? '' : 'style="display:none"'}>${this._esc((isChampionA ? finalMatch.a?.name : finalMatch.b?.name) || '')}</text>
      </g>`;
    }

    svg += `</g></svg>`;

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <div class="bv-root ${isFocusing ? 'has-focus' : ''}">
        ${title ? `<header class="bv-header"><h2 class="bv-title">${this._esc(title)}</h2></header>` : ''}
        <div class="bv-stage">${svg}</div>
        <footer class="bv-toolbar">
          <button class="bv-btn bv-btn-reset" type="button">↺ Reset</button>
          <button class="bv-btn bv-btn-random" type="button">⚄ Random</button>
          <button class="bv-btn bv-btn-clear" type="button" ${isFocusing ? '' : 'disabled'}>✕ Clear focus</button>
        </footer>
      </div>
    `;

    this._attachEvents();
  }

  _teamRow(yOffset, w, h, isWinner, hasDecision, team) {
    const name = team?.name || 'TBD';
    const isBye = team?.isBye;
    return `<g class="team ${isWinner ? 'winner' : ''} ${hasDecision && !isWinner ? 'loser' : ''} ${isBye ? 'bye' : ''}" data-team="${yOffset === 0 ? 'a' : 'b'}">
      <rect class="team-row" y="${yOffset}" width="${w}" height="${h}" />
      <text x="14" y="${yOffset + h / 2 + 4}" class="team-name">${this._esc(name)}</text>
      ${isWinner ? `<text x="${w - 14}" y="${yOffset + h / 2 + 4}" class="check" text-anchor="end">✓</text>` : ''}
      ${isBye ? `<text x="${w - 14}" y="${yOffset + h / 2 + 4}" class="bye-tag" text-anchor="end">bye</text>` : ''}
    </g>`;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  _attachEvents() {
    const root = this.shadowRoot;

    root.querySelectorAll('.match').forEach(matchEl => {
      const round = parseInt(matchEl.dataset.round, 10);
      const matchIdx = parseInt(matchEl.dataset.match, 10);

      // Match body click (the card surface outside team rows) = focus
      matchEl.addEventListener('click', (e) => {
        // If click came from a team row, let that handler run
        if (e.target.closest('.team')) return;
        // Separator line (and other non-interactive chrome) shouldn't filter clicks
        e.stopPropagation();
        if (this._focusedMatch && this._focusedMatch.round === round && this._focusedMatch.match === matchIdx) {
          this._focusedMatch = null;
        } else {
          this._focusedMatch = { round, match: matchIdx };
          this.dispatchEvent(new CustomEvent('match-focus', {
            detail: this._data.rounds[round][matchIdx],
            bubbles: true, composed: true
          }));
        }
        this._render();
      });

      // Each team row click = select winner
      matchEl.querySelectorAll('.team').forEach(teamEl => {
        teamEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const teamKey = teamEl.dataset.team;
          const match = this._data.rounds[round][matchIdx];
          const teamData = teamKey === 'a' ? match.a : match.b;

          // Ignore BYE rows
          if (teamData.isBye) return;

          // Toggle: clicking winning team again clears it
          if (match.winner === teamKey) {
            match.winner = null;
            // Don't bother cleaning downstream — user can hit Reset if confused
          } else {
            match.winner = teamKey;
            this._propagateWinner(round, matchIdx);
            this.dispatchEvent(new CustomEvent('match-decided', {
              detail: { round, match: matchIdx, winner: teamData.name },
              bubbles: true, composed: true
            }));
          }
          this._render();
        });
      });
    });

    const reset = root.querySelector('.bv-btn-reset');
    if (reset) reset.addEventListener('click', () => this.reset());

    const random = root.querySelector('.bv-btn-random');
    if (random) random.addEventListener('click', () => this.randomFill());

    const clear = root.querySelector('.bv-btn-clear');
    if (clear) clear.addEventListener('click', () => {
      this._focusedMatch = null;
      this._render();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  _css() {
    return `
      :host {
        --bv-bg: #0f1115;
        --bv-card: #1a1d24;
        --bv-card-hover: #252932;
        --bv-text: #e5e7eb;
        --bv-text-dim: #9ca3af;
        --bv-accent: #4f9eff;
        --bv-accent-glow: rgba(79, 158, 255, 0.35);
        --bv-winner: #22c55e;
        --bv-loser: #6b7280;
        --bv-line: #2a2f3a;
        --bv-trophy: #facc15;
        display: block;
        width: 100%;
        color: var(--bv-text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        background: var(--bv-bg);
        border-radius: 12px;
        padding: 16px;
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }
      *, *::before, *::after { box-sizing: border-box; }
      .bv-root { display: flex; flex-direction: column; gap: 12px; }
      .bv-header { padding: 0 4px; }
      .bv-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .bv-stage {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 24px 4px 8px;
        margin: 0 -4px;
        scrollbar-width: thin;
        scrollbar-color: var(--bv-line) transparent;
        scroll-behavior: smooth;
      }
      .bv-stage::-webkit-scrollbar { height: 6px; }
      .bv-stage::-webkit-scrollbar-thumb { background: var(--bv-line); border-radius: 3px; }
      .bracket-svg { display: block; min-width: 100%; height: auto; pointer-events: none; }
      .bracket-svg .matches,
      .bracket-svg .matches > * { pointer-events: all; }
      .round-label {
        fill: var(--bv-text-dim);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        text-anchor: middle;
      }
      .match { cursor: pointer; transition: transform .45s cubic-bezier(.4, 0, .2, 1), opacity .35s ease, filter .35s ease; pointer-events: visiblePainted; }
      .match > rect,
      .match > line,
      .match > text.match-id { pointer-events: none; }
      .match-card {
        fill: var(--bv-card);
        stroke: var(--bv-line);
        stroke-width: 1;
        transition: fill .25s, stroke .25s, stroke-width .25s;
      }
      .match:hover .match-card {
        fill: var(--bv-card-hover);
        stroke: var(--bv-accent);
      }
      .match.focus .match-card {
        fill: rgba(79, 158, 255, 0.12);
        stroke: var(--bv-accent);
        stroke-width: 2;
      }
      .match.focus { transform: scale(1.04); filter: drop-shadow(0 0 10px var(--bv-accent-glow)); }
      .bv-root.has-focus .match:not(.focus) { opacity: 0.28; }
      .team { cursor: pointer; transition: opacity .2s; }
      .team:hover .team-row { fill: rgba(79, 158, 255, 0.08); }
      .team-row { fill: transparent; transition: fill .2s; pointer-events: none; }
      .team { pointer-events: visiblePainted; }
      .team > text { pointer-events: none; }
      .team-name {
        fill: var(--bv-text);
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        dominant-baseline: middle;
      }
      .team.winner .team-name { fill: var(--bv-winner); font-weight: 600; }
      .team.loser .team-name { fill: var(--bv-loser); }
      .team.loser .team-name { text-decoration: line-through; }
      .team.bye .team-name { fill: var(--bv-text-dim); font-style: italic; }
      .check {
        fill: var(--bv-winner);
        font-size: 13px;
        font-weight: 700;
        pointer-events: none;
      }
      .bye-tag {
        fill: var(--bv-text-dim);
        font-size: 10px;
        font-weight: 500;
        pointer-events: none;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .separator { stroke: var(--bv-line); stroke-width: 1; }
      .match-id {
        fill: var(--bv-text-dim);
        font-size: 9px;
        font-weight: 500;
        pointer-events: none;
        opacity: 0.6;
      }
      .connector {
        fill: none;
        stroke: var(--bv-line);
        stroke-width: 1.5;
        transition: stroke .5s ease;
      }
      .connector.active { stroke: var(--bv-accent); }
      .trophy-icon {
        fill: rgba(250, 204, 21, 0.15);
        stroke: var(--bv-trophy);
        stroke-width: 1.5;
      }
      .trophy-stem { stroke: var(--bv-trophy); stroke-width: 1.5; stroke-dasharray: 2 2; }
      .trophy-glyph {
        fill: var(--bv-trophy);
        font-size: 18px;
        font-weight: 700;
        pointer-events: none;
      }
      .trophy-name {
        fill: var(--bv-trophy);
        font-size: 11px;
        font-weight: 600;
        pointer-events: none;
      }
      .bv-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 0 4px;
      }
      .bv-btn {
        background: var(--bv-card);
        color: var(--bv-text);
        border: 1px solid var(--bv-line);
        padding: 7px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: background .2s, border-color .2s, opacity .2s;
      }
      .bv-btn:hover:not(:disabled) {
        background: var(--bv-card-hover);
        border-color: var(--bv-accent);
      }
      .bv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .bv-btn:active:not(:disabled) { transform: translateY(1px); }
      @media (max-width: 600px) {
        :host { padding: 12px; border-radius: 10px; }
        .bv-stage { scroll-snap-type: x proximity; padding: 16px 4px 8px; }
        .bv-title { font-size: 14px; }
        .bv-btn { padding: 6px 10px; font-size: 11px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .match, .match-card, .team-row, .connector { transition: none !important; }
        .match.focus { transform: none; }
      }
    `;
  }
}

customElements.define('bracket-view', BracketView);

export default BracketView;
