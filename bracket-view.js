/**
 * <bracket-view> — Interactive single-elimination tournament bracket (v2)
 *
 * MODES:
 *   - paper-fold (default): horizontal track of round-pages, each page shows
 *     a current round + next round pair (mimicking Google Search tournament
 *     card). Swipe or click tabs to move between pages.
 *   - flat (legacy v1):    everything laid out left-to-right, horizontal
 *                           scroll. Set via attribute `layout="flat"`.
 *
 * USAGE:
 *   <script type="module" src="./bracket-view.js"></script>
 *   <bracket-view teams="A,B,C,D,E,F,G,H" title="Quarters"></bracket-view>
 *
 *   const b = document.querySelector('bracket-view');
 *   b.setData({ title: 'World Cup', rounds: [...] });
 *   b.randomFill();
 *
 * Inspired by Google Search's tournament card UX:
 *   - Smooth focus on a match; other cards dim
 *   - Tab strip with active underline that tracks scroll
 *   - Swipe gestures move one round-page at a time
 *   - Large card per match with date, status badge, two rows (flag/name/score),
 *     and a ◀ arrow showing the previous-match winner side
 *
 * Zero dependencies. Zero build step.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Round labels in a 5-rounds-deep tournament (32 → 16 → 8 → 4 → 2 → 1).
const ROUND_NAMES_5 = ['32강', '16강', '8강', '준결승', '결승'];
// For other depths, generate a generic label. (Used rarely.)
function defaultRoundName(idx, total) {
  return `${total - idx}강`;
}

class BracketView extends HTMLElement {
  static get observedAttributes() {
    return ['teams', 'title', 'layout'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = null;
    this._originalTeams = [];
    this._layout = 'paper-fold'; // or "flat"
    this._focused = null; // { round, match }
    this._activePage = 0;
    this._unobserve = null; // IO disconnect function
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setData(data) {
    this._data = data;
    this._originalTeams = this._data.rounds[0].flatMap(m =>
      [m.a?.name, m.b?.name].filter(t => t && t !== 'TBD' && t !== 'BYE')
    );
    this._focused = null;
    this._activePage = 0;
    this._render();
    if (this._layout === 'paper-fold') {
      this._setupScrollSync();
    }
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
    if (this._layout === 'paper-fold') this._setupScrollSync();
    this.dispatchEvent(new CustomEvent('bracket-complete', { bubbles: true, composed: true }));
  }

  setLayout(mode) {
    if (this._layout === mode) return;
    if (this._unobserve) { this._unobserve(); this._unobserve = null; }
    this._layout = mode;
    this._render();
    if (this._layout === 'paper-fold') this._setupScrollSync();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  connectedCallback() {
    const layoutAttr = this.getAttribute('layout');
    if (layoutAttr === 'flat' || layoutAttr === 'paper-fold') {
      this._layout = layoutAttr;
    }

    const teamsAttr = this.getAttribute('teams');
    if (teamsAttr) {
      this._originalTeams = teamsAttr.split(',').map(t => t.trim()).filter(Boolean);
      this._data = this._generateFromTeams(this._originalTeams, this.getAttribute('title'));
    }
    this._render();
    if (this._layout === 'paper-fold') this._setupScrollSync();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'teams' && newVal) {
      this._originalTeams = newVal.split(',').map(t => t.trim()).filter(Boolean);
      this._data = this._generateFromTeams(this._originalTeams, this.getAttribute('title'));
      this._focused = null;
      this._activePage = 0;
      this._render();
      if (this._layout === 'paper-fold') this._setupScrollSync();
    } else if (name === 'title' && this._data) {
      this._data.title = newVal;
      this._render();
    } else if (name === 'layout') {
      if (newVal === 'flat' || newVal === 'paper-fold') {
        this.setLayout(newVal);
      }
    }
  }

  disconnectedCallback() {
    if (this._unobserve) { this._unobserve(); this._unobserve = null; }
  }

  // ── Data generation ────────────────────────────────────────────────────────

  _generateFromTeams(teams, title) {
    let size = 1;
    while (size < teams.length) size *= 2;
    const padded = [...teams];
    while (padded.length < size) padded.push('BYE');

    const mkTeam = name => {
      const isBye = name === 'BYE';
      const isTbd = name === 'TBD';
      // Try to detect a flag emoji at the start of a team's name.
      const flag = !isBye && !isTbd
        ? (name.codePointAt(0) > 0x1F000 ? String.fromCodePoint(name.codePointAt(0)) : null)
        : null;
      const displayName = flag ? name.slice(flag.length).trim() : name;
      return { name, displayName, flag, isBye, isTbd };
    };

    const rounds = [];
    let prev = padded.map(mkTeam);

    while (prev.length > 1) {
      const matches = [];
      let idCounter = rounds.reduce((a, r) => a + r.length, 0);
      for (let i = 0; i < prev.length; i += 2) {
        const a = prev[i], b = prev[i + 1];
        let winner = null;
        if (a.isBye && !b.isBye) winner = 'b';
        else if (!a.isBye && b.isBye) winner = 'a';
        matches.push({
          id: `M${++idCounter}`,
          a, b,
          winner,
          // sensible default status for newly generated matches
          status: 'scheduled',
          // Match id of the previous match on each side, so winner-aware UI
          // (e.g. ◀ arrow showing previous-match winner) can be derived.
          prev: {
            a: rounds.length > 0 ? rounds[rounds.length - 1]?.[i - 2 + (i % 2 === 0 ? 0 : -2)]?.id : null,
            b: rounds.length > 0 ? rounds[rounds.length - 1]?.[i + 1]?.id : null,
          },
        });
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
    const source = this._data.rounds[round][matchIdx];
    const winnerTeam = source.winner === 'a' ? source.a : source.b;
    if (matchIdx % 2 === 0) nextMatch.a = winnerTeam;
    else nextMatch.b = winnerTeam;
    nextMatch.winner = null;
    // Track which previous match contributed which side of this match
    nextMatch.prev = nextMatch.prev || { a: null, b: null };
    if (matchIdx % 2 === 0) nextMatch.prev.a = source.id;
    else nextMatch.prev.b = source.id;
  }

  // ── Round page helpers ─────────────────────────────────────────────────────

  /**
   * Each page = ONE round (the canonical Google-mode "tabs per round" UX).
   * Last page is the final + 3rd-place playoff.
   *
   *   Page 0 → R32   Page 1 → R16   Page 2 → R8   Page 3 → SF   Page 4 → Final
   */
  _buildPages(data) {
    if (!data) return [];
    const pages = [];
    for (let r = 0; r < data.rounds.length; r++) {
      pages.push({
        idx: r,
        round: r,
        // Optionally preview the next round for connector visuals.
        nextRound: r + 1 < data.rounds.length ? r + 1 : null,
        isFinal: r === data.rounds.length - 1,
      });
    }
    return pages;
  }

  _roundLabel(roundIdx, totalRounds) {
    // Korean tournament terms — roundIdx 0 is the FIRST round (largest bracket).
    // 2 rounds (2 teams):   0=결승
    // 3 rounds (4 teams):   0=4강, 1=결승
    // 4 rounds (8 teams):   0=8강, 1=4강, 2=결승
    // 5 rounds (16 teams):  0=16강, 1=8강, 2=4강, 3=결승  (matches ROUND_NAMES_5)
    // 6 rounds (32 teams):  0=32강, 1=16강, 2=8강, 3=4강, 4=결승
    const KO_LABELS = ['결승', '4강', '8강', '16강', '32강', '64강'];
    if (totalRounds >= 2 && totalRounds <= KO_LABELS.length) {
      const startIdx = KO_LABELS.length - (totalRounds - 1); // first round's label index
      const idx = startIdx - roundIdx;
      if (KO_LABELS[idx]) return KO_LABELS[idx];
    }
    // Edge case (rounds < 2 or > 6): fall back to English.
    const ENGLISH_LABELS = ['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Round of 64'];
    const startIdx = ENGLISH_LABELS.length - (totalRounds - 1);
    const idx = startIdx - roundIdx;
    return ENGLISH_LABELS[idx] || `Round ${roundIdx + 1}`;
  }

  // ── Render: paper-fold mode ────────────────────────────────────────────────

  _renderPaperFold() {
    const data = this._data;
    if (!data) return this._renderEmpty();
    const { title, rounds } = data;
    const pages = this._buildPages(data);
    const isFocusing = !!this._focused;

    // Page index → which page has the active page marker
    const activePage = this._activePage;

    let html = `<div class="bv-root paper-fold ${isFocusing ? 'has-focus' : ''}">
      ${title ? `<header class="bv-header"><h2 class="bv-title">${this._esc(title)}</h2></header>` : ''}
      <nav class="bv-tabs" role="tablist">`;

    pages.forEach((p, i) => {
      const label = this._roundLabel(p.round, rounds.length);
      html += `<button type="button" class="bv-tab ${i === activePage ? 'active' : ''}" data-page="${i}" role="tab" aria-selected="${i === activePage}">${this._esc(label)}</button>`;
    });

    html += `</nav><div class="bv-track" role="region" aria-label="Tournament rounds">`;

    pages.forEach((p, i) => {
      html += `<section class="bv-page ${i === activePage ? 'active' : ''}" data-page="${i}">
        <div class="bv-page-header">
          <span class="bv-page-title">${this._esc(this._roundLabel(p.round, rounds.length))}</span>`;
      if (p.nextRound !== null && !p.isFinal) {
        const nextLabel = this._roundLabel(p.nextRound, rounds.length);
        // 자연스러운 한국어 조사: 받침 있으면 "으로", 없으면 "로".
        // 라운드명 끝 글자의 종성 유무로 판단.
        const lastChar = nextLabel.charCodeAt(nextLabel.length - 1);
        const hasJongSung = lastChar >= 0xAC00 && lastChar <= 0xD7A3 && (lastChar - 0xAC00) % 28 > 0;
        const josa = hasJongSung ? '으로' : '로';
        html += `<span class="bv-page-sub">승자는 ${this._esc(nextLabel)}${josa} 진출</span>`;
      } else if (p.isFinal) {
        html += `<span class="bv-page-sub">우승자 결정</span>`;
      } else {
        html += `<span class="bv-page-sub">라운드 결승</span>`;
      }
      html += `</div><div class="bv-columns single-round">`;
      // Single round column on the left
      html += this._renderColumn(rounds, p.round, p.round, p.nextRound, 'from');
      // Right side: a compact "next round slots" preview column showing
      // partially assembled next-round matches as horizontal pipes, OR a
      // trophy block on the final page.
      if (p.isFinal) {
        html += this._renderTrophyColumn(rounds[rounds.length - 1][0]);
      } else {
        html += this._renderNextPreviewColumn(rounds, p.round, p.nextRound);
      }
      // Connector overlay inside .bv-columns grid area 'sv'
      if (!p.isFinal) {
        html += this._renderConnectors(rounds, p.round, p.nextRound);
      }
      html += `</div></section>`;
    });

    html += `</div>`;

    // 3rd-place playoff (rendered as a single overlay card pinned bottom)
    if (data.thirdPlace) {
      html += this._renderThirdPlace(data.thirdPlace);
    } else if (rounds.length >= 2) {
      // generate a placeholder disabled "3rd place playoff" suggestion
      html += `<div class="bv-third-row">
        <div class="bv-third-card" data-disabled="true">
          <div class="bv-third-label">3·4위 결정전</div>
          <div class="bv-third-teams">
            <span class="bv-third-team">준결승 패자</span>
            <span class="bv-third-vs">vs</span>
            <span class="bv-third-team">준결승 패자</span>
          </div>
        </div>
      </div>`;
    }

    // Footer toolbar
    html += `<footer class="bv-toolbar">
      <button class="bv-btn bv-btn-reset" type="button">↺ 초기화</button>
      <button class="bv-btn bv-btn-random" type="button">⚄ 랜덤</button>
      <button class="bv-btn bv-btn-clear" type="button" ${isFocusing ? '' : 'disabled'}>✕ 포커스 해제</button>
      <span class="bv-spacer"></span>
      <button class="bv-btn bv-btn-layout" type="button" title="레이아웃 전환">${this._layout === 'paper-fold' ? '⤢ 펼치기' : '⤡ 접기'}</button>
    </footer>`;

    html += `</div>`;
    this.shadowRoot.innerHTML = `<style>${this._css()}</style>${html}`;
    this._attachEvents();
  }

  _renderColumn(rounds, roundIdx, prevRoundIdx, nextRoundIdx, role) {
    const matches = rounds[roundIdx] || [];
    const roleClass = role === 'from' ? 'bv-col-from' : role === 'to' ? 'bv-col-to' : '';
    const colClass = `bv-col ${roleClass}`.trim();
    let html = `<div class="${colClass}">`;
    matches.forEach((match, m) => {
      html += this._renderMatchCard(match, roundIdx, m);
    });
    html += `</div>`;
    return html;
  }

  /**
   * Build the SVG overlay of connector lines between the "from" column and the
   * "to" column on the same paper-fold page. Each pair of consecutive "from"
   * matches converges to a single "to" match via a rectangular M-curve.
   *
   * Coordinate model (assumes CSS gives every card a fixed height and a
   * constant gap between cards in `.bv-col { flex; column; gap }`):
   *
   *   - The .bv-columns container is `position: relative`.
   *   - The .bv-col:first-child is the "from" column; .bv-col:nth-child(2) is
   *     the "to" column.
   *   - The SVG overlay sits absolutely inside .bv-columns with width=100% and
   *     a viewBox matched to the container's measured size after layout.
   *
   /**
    * Build the SVG overlay of connector lines between the "from" column and the
    * "to" column on the same paper-fold page. Each pair of consecutive "from"
    * matches converges to a single "to" match.
    *
    * Card metrics must match the .bv-card CSS rule exactly. CARD_H = 96px.
    * (16 meta + 28 row + 28 row + 8 gap + 16 padding).
    * SVG uses a 0..1 normalized viewBox with preserveAspectRatio=none so the
    * lines stretch with the column width.
    */
   _renderConnectors(rounds, fromIdx, toIdx) {
     const fromMatches = rounds[fromIdx] || [];
     const toMatches = rounds[toIdx] || [];
     if (fromMatches.length === 0 || toMatches.length === 0) return '';
     // LOCKED card metrics — must match .bv-card CSS rule below.
     const CARD_H = 96;
     const GAP = 10;
     const UNIT = CARD_H + GAP;
     const fromCount = fromMatches.length;
     const toCount = toMatches.length;
     const totalH = fromCount * UNIT;
     const fromY = (i) => Math.round(i * UNIT + UNIT / 2);
     const toY = (j) => Math.round((j + 0.5) * UNIT * (fromCount / toCount));

    // Use a concrete width matching the .bv-columns gap (12px). The wrapper
    // is positioned absolutely inside .bv-columns between the two columns,
    // so its left/right naturally align with the column borders.

    let paths = '';
    for (let i = 0; i < fromCount; i++) {
      const targetJ = Math.floor(i / 2);
      const match = fromMatches[i];
      const winnerA = match.winner === 'a';
      const winnerB = match.winner === 'b';
      const decided = !!match.winner;
      const y1 = fromY(i);
      const y2 = toY(targetJ);
      // Horizontal: enter at x=0, exit at x=W (we set W via parent CSS).
      // For a 12px-wide connector wrapper, a 6px straight horizontal segment
      // exits the card, drops/rises in the middle, and re-enters the next.
      const W = 12;
      const midX = W / 2;
      const d = `M 0 ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${W} ${y2}`;
      let activeCls = '';
      if (decided) {
        activeCls = ' active';
        // If this is the LOSER side of a decided pair, fade it (dashed).
        if (i % 2 === 0 && winnerB) activeCls += ' inactive-side';
        else if (i % 2 === 1 && winnerA) activeCls += ' inactive-side';
      }
      paths += `<path class="bv-connector${activeCls}" data-from-match="${match.id}" data-to-match="${toMatches[targetJ].id}" d="${d}" />`;
    }

    return `<svg class="bv-connectors" xmlns="${SVG_NS}" width="12" height="${totalH}" viewBox="0 0 12 ${totalH}" preserveAspectRatio="none">${paths}</svg>`;
  }

  _renderMatchCard(match, roundIdx, matchIdx) {
    const isFocused = this._focused && this._focused.round === roundIdx && this._focused.match === matchIdx;
    const a = match.a || { name: 'TBD', displayName: 'TBD', isTbd: true };
    const b = match.b || { name: 'TBD', displayName: 'TBD', isTbd: true };
    const aWin = match.winner === 'a';
    const bWin = match.winner === 'b';
    const decided = !!match.winner;
    const status = match.status || (decided ? 'fulltime' : 'scheduled');

    // Date / status badge (Korean defaults)
    const dateLabel = match.date || '';
    let statusLabel = '';
    if (status === 'scheduled') statusLabel = match.kickoff || '예정';
    else if (status === 'live') statusLabel = '진행 중';
    else if (status === 'fulltime' || status === 'completed') statusLabel = '풀타임';
    else if (status === 'postponed') statusLabel = '연기';

    const classes = ['bv-card'];
    if (isFocused) classes.push('focus');
    if (decided) classes.push('decided');
    if (a.isBye || b.isBye) classes.push('has-bye');

    return `<article class="${classes.join(' ')}" data-round="${roundIdx}" data-match="${matchIdx}" data-id="${this._esc(match.id)}" tabindex="0">
      <div class="bv-card-meta">
        <span class="bv-card-date">${this._esc(dateLabel)}</span>
        <span class="bv-card-status status-${status}">${this._esc(statusLabel)}</span>
      </div>
      <div class="bv-card-teams">
        <div class="bv-team ${aWin ? 'winner' : decided ? 'loser' : ''}" data-side="a">
          ${a.flag ? `<span class="bv-team-flag">${this._esc(a.flag)}</span>` : ''}
          <span class="bv-team-name">${this._esc(a.displayName || a.name)}</span>
          <span class="bv-team-score">${this._scoreCell(match, 'a')}</span>
          ${match.prev?.a ? `<span class="bv-team-from" title="${this._esc(match.prev.a)}로 부터">◀</span>` : ''}
        </div>
        <div class="bv-team ${bWin ? 'winner' : decided ? 'loser' : ''}" data-side="b">
          ${b.flag ? `<span class="bv-team-flag">${this._esc(b.flag)}</span>` : ''}
          <span class="bv-team-name">${this._esc(b.displayName || b.name)}</span>
          <span class="bv-team-score">${this._scoreCell(match, 'b')}</span>
          ${match.prev?.b ? `<span class="bv-team-from" title="${this._esc(match.prev.b)}로 부터">◀</span>` : ''}
        </div>
      </div>
    </article>`;
  }

  _scoreCell(match, side) {
    if (match.scores && match.scores[side] != null) {
      return `<span class="bv-score-num">${this._esc(String(match.scores[side]))}</span>`;
    }
    if (match.status === 'scheduled') return '';
    // mock empty score placeholder when status is unclear
    return `<span class="bv-score-num"></span>`;
  }

  /**
   * A compact "next round slots" preview column. Each preview card sits
   * vertically offset by half a "from-pair" so that its centerline aligns
   * with the gap between two consecutive from matches. This makes the
   * connector lines mathematically clean: each preview card receives two
   * convergent connectors (one from each of its two from-pair members).
   *
   * Specifically, the column is a CSS grid whose rows alternate spacer /
   * card / gap so that preview i starts at:
   *   top = i * 2 * UNIT + (UNIT - GAP) / 2
   * where UNIT = CARD_H + GAP = 96 + 10 = 106 px.
   * The first offset is (UNIT - GAP) / 2 = 48 px so preview 0 center sits
   * at UNIT/2 px from the top, halfway between from 0 and from 1.
   */
  _renderNextPreviewColumn(rounds, fromIdx, toIdx) {
    if (toIdx == null) return '';
    const fromMatches = rounds[fromIdx] || [];
    const toMatches = rounds[toIdx] || [];
    if (toMatches.length === 0) return '';
    const CARD_H = 96;
    const GAP = 10;
    const UNIT = CARD_H + GAP;       // 106
    // preview i (height CARD_H) center should land exactly between
    // from[2i] and from[2i+1]'s centerlines. from[2i] is at top+i*UNIT,
    // from[2i+1] is at top+(i*2+1)*UNIT. Their centerlines are at
    // (i*UNIT + CARD_H/2) and ((i*2+1)*UNIT + CARD_H/2). The midpoint is
    // (i*2 + 0.5) * UNIT + CARD_H/2 = i*2*UNIT + CARD_H/2 + UNIT/2
    // = i*2*UNIT + (CARD_H + UNIT) / 2. For preview top, subtract CARD_H/2:
    //   preview_top(i) = i*2*UNIT + UNIT/2
    const OFFSET = UNIT / 2;         // 53 px initial offset
    const STRIDE = 2 * UNIT;        // 212 px between preview starts
    const TRAILING = UNIT - OFFSET; // 53 px below the last preview

    const rowSizes = [];
    rowSizes.push(`${OFFSET}px`);   // 53 px initial offset
    toMatches.forEach((_next, i) => {
      rowSizes.push(`${CARD_H}px`); // 96 px preview card
      if (i < toMatches.length - 1) {
        rowSizes.push(`${STRIDE - CARD_H}px`); // 116 px spacer
      }
    });
    rowSizes.push(`${TRAILING}px`); // 53 px trailing spacer

    let html = `<div class="bv-col bv-col-next-preview" style="display: grid; grid-template-rows: ${rowSizes.join(' ')};">`;
    toMatches.forEach((next, j) => {
      const fromA = fromMatches[j * 2];
      const fromB = fromMatches[j * 2 + 1];
      const slotA = this._renderPreviewSlot(next.a, fromA, 'a', j * 2);
      const slotB = this._renderPreviewSlot(next.b, fromB, 'b', j * 2 + 1);
      html += `<article class="bv-card bv-card-preview" data-from-match="${fromA?.id || ''}" data-to-match="${next.id}">
        ${slotA}${slotB}
      </article>`;
    });
    html += '</div>';
    return html;
  }

  _renderPreviewSlot(team, fromMatch, side, fromIndex) {
    const isFilled = !!(team && !team.isTbd && !team.isBye);
    return `<div class="bv-slot ${isFilled ? 'filled' : 'empty'}" data-side="${side}" data-from-idx="${fromIndex}">
      <span class="bv-slot-label">${isFilled ? `${this._esc(team.displayName || team.name)}` : '다음 매치 승자'}</span>
    </div>`;
  }

  _renderTrophyColumn(finalMatch) {
    const a = finalMatch.a || {};
    const b = finalMatch.b || {};
    const champion = finalMatch.winner === 'a' ? a : finalMatch.winner === 'b' ? b : null;
    return `<div class="bv-col bv-col-trophy">
      ${champion ? `
        <div class="bv-trophy">
          <div class="bv-trophy-icon">🏆</div>
          <div class="bv-trophy-label">우승</div>
          <div class="bv-trophy-name">${this._esc(champion.displayName || champion.name)}</div>
        </div>` : `
        <div class="bv-trophy pending">
          <div class="bv-trophy-icon">🏆</div>
          <div class="bv-trophy-label">결승 대기</div>
        </div>`}
    </div>`;
  }

  _renderThirdPlace(thirdPlace) {
    return `<div class="bv-third-row">
      <div class="bv-third-card">
        <div class="bv-third-label">3·4위 결정전</div>
        <div class="bv-third-teams">
          <span class="bv-third-team">${this._esc(thirdPlace.a?.displayName || thirdPlace.a?.name || 'TBD')}</span>
          <span class="bv-third-vs">vs</span>
          <span class="bv-third-team">${this._esc(thirdPlace.b?.displayName || thirdPlace.b?.name || 'TBD')}</span>
        </div>
      </div>
    </div>`;
  }

  // ── Render: flat mode (v1) ────────────────────────────────────────────────

  _renderFlat() {
    const data = this._data;
    if (!data) return this._renderEmpty();
    const { title, rounds } = data;
    const numRounds = rounds.length;
    const maxMatches = rounds[0].length;
    const isFocusing = !!this._focused;

    const ROUND_W = 220, COL_GAP = 32, PAD_X = 24, PAD_Y = 32;
    const MATCH_H = 56, MATCH_GAP = 24;
    const totalW = PAD_X * 2 + ROUND_W * numRounds + COL_GAP * (numRounds - 1);
    const totalH = PAD_Y * 2 + maxMatches * (MATCH_H + MATCH_GAP) - MATCH_GAP;
    const TRophySpace = numRounds <= 1 ? 0 : 80;
    const viewW = totalW + TRophySpace;
    const roundXs = Array.from({ length: numRounds }, (_, r) => PAD_X + r * (ROUND_W + COL_GAP));
    const roundMatchCount = rounds.map(r => r.length);
    const roundStartYs = roundMatchCount.map(count => (totalH - (count * MATCH_H + (count - 1) * MATCH_GAP)) / 2);

    const roundLabels = ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'];
    let svg = `<svg viewBox="0 0 ${viewW} ${totalH}" xmlns="${SVG_NS}" class="bracket-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${this._esc(title)}">`;
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
        svg += `<path class="connector ${match.winner ? 'active' : ''}" d="${path}" />`;
      }
    }
    svg += `</g><g class="round-headers">`;
    for (let r = 0; r < numRounds; r++) {
      const label = roundLabels[Math.max(0, 5 - numRounds) + r] || `R${r + 1}`;
      svg += `<text x="${roundXs[r] + ROUND_W / 2}" y="14" class="round-label">${this._esc(label)}</text>`;
    }
    svg += `</g><g class="matches">`;
    for (let r = 0; r < numRounds; r++) {
      for (let m = 0; m < rounds[r].length; m++) {
        const match = rounds[r][m];
        const x = roundXs[r];
        const y = roundStartYs[r] + m * (MATCH_H + MATCH_GAP);
        const isFocused = isFocusing && this._focused.round === r && this._focused.match === m;
        const aWin = match.winner === 'a', bWin = match.winner === 'b';
        svg += `<g class="match ${isFocused ? 'focus' : ''}" data-round="${r}" data-match="${m}" transform="translate(${x}, ${y})">`;
        svg += `<rect class="match-card" width="${ROUND_W}" height="${MATCH_H}" rx="10" />`;
        svg += this._teamRowSVG(0, ROUND_W, MATCH_H / 2, aWin, !!match.winner, match.a, 'a');
        svg += `<line class="separator" x1="0" y1="${MATCH_H / 2}" x2="${ROUND_W}" y2="${MATCH_H / 2}" />`;
        svg += this._teamRowSVG(MATCH_H / 2, ROUND_W, MATCH_H / 2, bWin, !!match.winner, match.b, 'b');
        svg += `<text x="${ROUND_W - 10}" y="12" class="match-id">${this._esc(match.id)}</text>`;
        svg += `</g>`;
      }
    }
    if (numRounds > 1) {
      const finalMatch = rounds[numRounds - 1][0];
      const trophyX = roundXs[numRounds - 1] + ROUND_W + 16;
      const trophyY = roundStartYs[numRounds - 1] + MATCH_H / 2;
      const hasChampion = !!finalMatch.winner;
      const cName = finalMatch.winner === 'a' ? finalMatch.a?.name : finalMatch.winner === 'b' ? finalMatch.b?.name : '';
      svg += `<g class="trophy">
        <line class="trophy-stem" x1="${trophyX}" y1="${trophyY}" x2="${trophyX + 40}" y2="${trophyY}" ${hasChampion ? '' : 'style="display:none"'}/>
        <circle class="trophy-icon" cx="${trophyX + 56}" cy="${trophyY}" r="16" ${hasChampion ? '' : 'style="display:none"'}/>
        <text class="trophy-glyph" x="${trophyX + 56}" y="${trophyY + 5}" text-anchor="middle" ${hasChampion ? '' : 'style="display:none"'}>★</text>
        <text class="trophy-name" x="${trophyX + 56}" y="${trophyY + 32}" text-anchor="middle" ${hasChampion ? '' : 'style="display:none"'}>${this._esc(cName)}</text>
      </g>`;
    }
    svg += `</g></svg>`;

    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <div class="bv-root flat ${isFocusing ? 'has-focus' : ''}">
        ${title ? `<header class="bv-header"><h2 class="bv-title">${this._esc(title)}</h2></header>` : ''}
        <div class="bv-stage">${svg}</div>
        <footer class="bv-toolbar">
          <button class="bv-btn bv-btn-reset" type="button">↺ 초기화</button>
          <button class="bv-btn bv-btn-random" type="button">⚄ 랜덤</button>
          <button class="bv-btn bv-btn-clear" type="button" ${isFocusing ? '' : 'disabled'}>✕ 포커스 해제</button>
          <span class="bv-spacer"></span>
          <button class="bv-btn bv-btn-layout" type="button" title="레이아웃 전환">${this._layout === 'paper-fold' ? '⤢ 펼치기' : '⤡ 접기'}</button>
        </footer>
      </div>`;
    this._attachEvents();
  }

  _teamRowSVG(yOffset, w, h, isWinner, hasDecision, team, side) {
    const name = team?.displayName || team?.name || 'TBD';
    const isBye = team?.isBye;
    return `<g class="team ${isWinner ? 'winner' : ''} ${hasDecision && !isWinner ? 'loser' : ''} ${isBye ? 'bye' : ''}" data-team="${side}">
      <rect class="team-row" y="${yOffset}" width="${w}" height="${h}" />
      <text x="14" y="${yOffset + h / 2 + 4}" class="team-name">${this._esc(name)}</text>
      ${isWinner ? `<text x="${w - 14}" y="${yOffset + h / 2 + 4}" class="check" text-anchor="end">✓</text>` : ''}
      ${isBye ? `<text x="${w - 14}" y="${yOffset + h / 2 + 4}" class="bye-tag" text-anchor="end">bye</text>` : ''}
    </g>`;
  }

  _renderEmpty() {
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><div class="bv-root empty">팀이 없습니다.</div>`;
  }

  _render() {
    if (this._layout === 'flat') {
      this._renderFlat();
    } else {
      this._renderPaperFold();
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  _attachEvents() {
    const root = this.shadowRoot;

    // Match card click → decide OR focus on team row click
    root.querySelectorAll('.bv-card').forEach(cardEl => {
      const round = parseInt(cardEl.dataset.round, 10);
      const matchIdx = parseInt(cardEl.dataset.match, 10);

      // Team row click → mark winner
      cardEl.querySelectorAll('.bv-team').forEach(teamEl => {
        teamEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const side = teamEl.dataset.side;
          const match = this._data.rounds[round][matchIdx];
          const teamData = side === 'a' ? match.a : match.b;
          if (teamData?.isBye) return;
          if (match.winner === side) {
            match.winner = null;
          } else {
            match.winner = side;
            this._propagateWinner(round, matchIdx);
            this.dispatchEvent(new CustomEvent('match-decided', {
              detail: { round, match: matchIdx, winner: teamData?.name },
              bubbles: true, composed: true
            }));
          }
          this._render();
        });
      });

      // Card body click → focus
      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.bv-team')) return;
        if (this._focused && this._focused.round === round && this._focused.match === matchIdx) {
          this._focused = null;
        } else {
          this._focused = { round, match: matchIdx };
          this.dispatchEvent(new CustomEvent('match-focus', {
            detail: this._data.rounds[round][matchIdx],
            bubbles: true, composed: true
          }));
        }
        this._render();
      });
    });

    // Tab strip
    root.querySelectorAll('.bv-tab').forEach(tabEl => {
      tabEl.addEventListener('click', (e) => {
        e.preventDefault();
        const pageIdx = parseInt(tabEl.dataset.page, 10);
        this._jumpToPage(pageIdx);
      });
    });

    // Toolbar buttons
    const reset = root.querySelector('.bv-btn-reset');
    if (reset) reset.addEventListener('click', () => this.reset());
    const random = root.querySelector('.bv-btn-random');
    if (random) random.addEventListener('click', () => this.randomFill());
    const clear = root.querySelector('.bv-btn-clear');
    if (clear) clear.addEventListener('click', () => {
      this._focused = null;
      this._render();
    });
    const layout = root.querySelector('.bv-btn-layout');
    if (layout) layout.addEventListener('click', () => {
      this.setLayout(this._layout === 'paper-fold' ? 'flat' : 'paper-fold');
    });

    // Swipe gestures on the track (paper-fold only)
    if (this._layout === 'paper-fold') {
      this._setupSwipeGesture();
    }
  }

  // ── Scroll sync: IntersectionObserver tracks active page ───────────────────

  _setupScrollSync() {
    if (this._unobserve) { this._unobserve(); this._unobserve = null; }
    const root = this.shadowRoot;
    if (!root) return;
    const track = root.querySelector('.bv-track');
    if (!track) return;

    const pages = Array.from(root.querySelectorAll('.bv-page'));
    if (pages.length === 0) return;

    const onIntersect = (entries) => {
      // pick the entry with the highest intersection ratio
      let best = null;
      for (const ent of entries) {
        if (ent.isIntersecting) {
          if (!best || ent.intersectionRatio > best.intersectionRatio) best = ent;
        }
      }
      if (!best) return;
      const newPage = parseInt(best.target.dataset.page, 10);
      if (newPage === this._activePage) return;
      this._activePage = newPage;
      // Update tabs without triggering any scrollIntoView (would jump doc).
      root.querySelectorAll('.bv-tab').forEach((tab, i) => {
        const isActive = i === newPage;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
    };

    const io = new IntersectionObserver(onIntersect, {
      root: track,
      threshold: [0.4, 0.5, 0.6, 0.8],
    });
    pages.forEach(p => io.observe(p));
    this._unobserve = () => io.disconnect();
  }

  _jumpToPage(pageIdx) {
    const root = this.shadowRoot;
    if (!root) return;
    const track = root.querySelector('.bv-track');
    const page = root.querySelector(`.bv-page[data-page="${pageIdx}"]`);
    if (!track || !page) return;
    // Compute target scrollLeft for the page's left edge inside the track.
    // We deliberately do NOT call scrollIntoView on the page element — that
    // would risk scrolling the document around the bracket-view itself.
    const target = page.offsetLeft;
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left: target, top: 0, behavior: 'smooth' });
    } else {
      track.scrollLeft = target;
    }
    this._activePage = pageIdx;
    root.querySelectorAll('.bv-tab').forEach((tab, i) => {
      const isActive = i === pageIdx;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
  }

  // ── Swipe gesture (touchstart/touchend) ───────────────────────────────────

  _setupSwipeGesture() {
    const track = this.shadowRoot?.querySelector('.bv-track');
    if (!track) return;
    // Avoid duplicate listeners — clear first.
    if (this._swipeHandlers) {
      track.removeEventListener('touchstart', this._swipeHandlers.start);
      track.removeEventListener('touchend', this._swipeHandlers.end);
    }

    let startX = 0;
    let startY = 0;
    let startT = 0;
    const start = (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
    };
    const end = (e) => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dt = Date.now() - startT;
      // horizontal-dominant, fast + long enough → swipe
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 600) {
        const dir = dx < 0 ? 1 : -1;
        const total = this.shadowRoot.querySelectorAll('.bv-page').length;
        const next = Math.max(0, Math.min(total - 1, this._activePage + dir));
        if (next !== this._activePage) this._jumpToPage(next);
      }
    };
    track.addEventListener('touchstart', start, { passive: true });
    track.addEventListener('touchend', end);
    this._swipeHandlers = { start, end };
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
        --bv-danger: #ef4444;
        display: block;
        width: 100%;
        color: var(--bv-text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        background: var(--bv-bg);
        border-radius: 12px;
        padding: 12px;
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }
      *, *::before, *::after { box-sizing: border-box; }

      /* ═════════════ paper-fold mode ═════════════ */
      .bv-root.paper-fold { display: flex; flex-direction: column; gap: 12px; }
      .bv-tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        position: sticky;
        top: 0;
        background: var(--bv-bg);
        padding: 4px 0 12px;
        border-bottom: 1px solid var(--bv-line);
        z-index: 5;
      }
      .bv-tabs::-webkit-scrollbar { display: none; }
      .bv-tab {
        flex: 0 0 auto;
        padding: 8px 14px;
        background: transparent;
        color: var(--bv-text-dim);
        border: 0;
        border-bottom: 2px solid transparent;
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: color .2s, border-color .25s ease;
        white-space: nowrap;
      }
      .bv-tab:hover { color: var(--bv-text); }
      .bv-tab.active {
        color: var(--bv-accent);
        border-bottom-color: var(--bv-accent);
      }

      .bv-track {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x proximity;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        position: relative;
        /* Lock vertical position across pages — no vertical snap, no
           vertical jump when the user swipes between pages. */
        overscroll-behavior-y: none;
      }
      .bv-track::-webkit-scrollbar { display: none; }
      .bv-page {
        flex: 0 0 100%;
        scroll-snap-align: start;
        /* don't snap on the cross-axis (vertical) — this was previously
           implicitly snapping to top on every horizontal scroll, which the
           user found jarring. */
        scroll-snap-stop: normal;
        padding: 16px 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        /* Equal-height pages so vertical scroll never appears and never
           needs to align at the top of any specific page */
        align-self: stretch;
      }
      .bv-page-header {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 0 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--bv-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .bv-page-from, .bv-page-to { color: var(--bv-text); font-size: 14px; }
      .bv-page-arrow { color: var(--bv-text-dim); }
      .bv-page-sub { color: var(--bv-text-dim); font-size: 12px; text-transform: none; letter-spacing: 0; }

      .bv-columns {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
        grid-template-areas: 'from sv to';
        align-items: start;
      }
      /* Single-round pages: equal-width match columns. Preview column shows
         ghost slots but is sized identically to the from column so cards
         look consistent. minmax(0, 1fr) prevents the wider column from
         claiming more space due to its intrinsic min-content size. */
      .bv-columns.single-round {
        grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
      }
      .bv-col-from { grid-area: from; }
      .bv-col-to { grid-area: to; }
      .bv-col-next-preview { grid-area: to; }
      .bv-col-trophy { grid-area: to; }
      .bv-col-trophy-cell { grid-area: to; }
      .bv-connectors {
        grid-area: sv;
        width: 12px;
        height: auto;
        pointer-events: none;
        overflow: visible;
      }
      .bv-connector {
        stroke: var(--bv-line);
        stroke-width: 1.5;
        fill: none;
        opacity: 0.85;
        transition: stroke .5s ease, opacity .35s ease;
      }
      .bv-connector.active { stroke: var(--bv-accent); opacity: 1; }
      .bv-connector.inactive-side { stroke-dasharray: 3 3; opacity: 0.4; }
      .bv-root.has-focus .bv-connector { opacity: 0.25; }
      .bv-col {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        align-items: stretch;
        position: relative;
        z-index: 1;
      }
      .bv-col-trophy {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 240px;
      }

      /* Single rule — width and height locked so every left/right match card
       * renders identical inside any container. CARD_H = 96 = 8 padding-top
       * + 16 meta + 4 gap + 28 row + 28 row + 4 gap-to-padding + 8 padding-bottom.
       * The two team rows are an exact 1fr/1fr split. */
      .bv-card {
        background: var(--bv-card);
        border: 1px solid var(--bv-line);
        border-radius: 10px;
        padding: 0 10px;
        cursor: pointer;
        transition: background .25s, border-color .25s, transform .35s cubic-bezier(.4,0,.2,1), opacity .35s;
        position: relative;
        width: 100%;
        height: 96px;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: 18px 1fr;
        gap: 0;
      }
      .bv-card-preview {
        cursor: default;
        opacity: .85;
        height: 96px;
        padding: 0 10px;
        width: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: 1fr 1fr;
        gap: 2px;
        border-style: solid;
      }
      .bv-card-preview .bv-slot {
        flex: 1;
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr) 28px;
        align-items: center;
        gap: 6px;
        padding: 2px 4px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        background: rgba(255,255,255,.02);
        color: var(--bv-text-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        height: 28px;
        box-sizing: border-box;
        min-width: 0;
      }
      .bv-card-preview .bv-slot.filled {
        background: rgba(79,158,255,.08);
        color: var(--bv-accent);
        border-left: 3px solid var(--bv-accent);
      }
      .bv-card:hover { background: var(--bv-card-hover); border-color: rgba(79,158,255,.4); }
      .bv-card.focus {
        background: rgba(79,158,255,.12);
        border-color: var(--bv-accent);
        transform: scale(1.02);
      }
      .bv-root.has-focus .bv-card:not(.focus) { opacity: .28; }
      /* .bv-card is defined once at the top of this style block (width:100%;
       * height:92px; display:flex; column). The duplicate rule that used to
       * live here was removed — see top of the stylesheet. */
      .bv-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        height: 16px;
        line-height: 16px;
        font-size: 10px;
        color: var(--bv-text-dim);
        overflow: hidden;
        padding: 0;
      }
      .bv-card-date {
        font-size: 10px;
        color: var(--bv-text-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1 1 auto;
        min-width: 0;
      }
      .bv-card-status {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255,255,255,.04);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        white-space: nowrap;
        flex: 0 0 auto;
      }
      .status-fulltime { background: rgba(34,197,94,.18); color: var(--bv-winner); }
      .status-live { background: rgba(239,68,68,.18); color: var(--bv-danger); }
      .status-scheduled { background: rgba(255,255,255,.06); color: var(--bv-text-dim); }

      .bv-card-teams { display: grid; grid-template-rows: 1fr 1fr; gap: 2px; min-height: 0; overflow: hidden; }
      .bv-team {
        display: grid;
        grid-template-columns: 22px minmax(0, 1fr) 32px;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 0 4px;
        border-radius: 6px;
        transition: background .2s;
        min-width: 0;
        min-height: 0;
        height: 100%;
        max-height: 100%;
        overflow: hidden;
        box-sizing: border-box;
      }
      .bv-team:hover { background: rgba(79,158,255,.08); }
      .bv-team-flag {
        font-size: 16px;
        line-height: 1;
        width: 24px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 24px;
        overflow: hidden;
      }
      .bv-team-name {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        line-height: 1.2;
      }
      .bv-team-score {
        font-variant-numeric: tabular-nums;
        text-align: right;
        font-weight: 600;
        font-size: 13px;
        color: var(--bv-text);
        flex: 0 0 28px;
        line-height: 1;
      }
      .bv-team-from {
        color: var(--bv-accent);
        font-size: 11px;
        text-align: center;
        flex: 0 0 16px;
        width: 16px;
      }
      .bv-team.winner .bv-team-name { color: var(--bv-winner); font-weight: 700; }
      .bv-team.winner .bv-team-score { color: var(--bv-winner); }
      .bv-team.loser .bv-team-name { color: var(--bv-loser); text-decoration: line-through; }
      .bv-team-from { color: var(--bv-accent); font-size: 11px; }

      .bv-trophy {
        text-align: center;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        background: rgba(250,204,21,.06);
        border: 1px dashed var(--bv-trophy);
        border-radius: 12px;
      }
      .bv-trophy-icon { font-size: 36px; }
      .bv-trophy-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--bv-text-dim); }
      .bv-trophy-name { font-size: 16px; font-weight: 700; color: var(--bv-trophy); }

      .bv-third-row {
        margin-top: 8px;
        padding: 10px;
        background: rgba(255,255,255,.02);
        border-radius: 10px;
      }
      .bv-third-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 12px;
        border: 1px dashed var(--bv-line);
        border-radius: 8px;
        opacity: .8;
      }
      .bv-third-card[data-disabled="true"] { opacity: .45; }
      .bv-third-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--bv-text-dim); }
      .bv-third-teams { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .bv-third-vs { color: var(--bv-text-dim); font-size: 11px; }

      /* ═════════════ flat mode (v1) ═════════════ */
      .bv-root.flat { display: flex; flex-direction: column; gap: 12px; }
      .bv-stage {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 24px 4px 8px;
        margin: 0 -4px;
        scrollbar-width: thin;
        scrollbar-color: var(--bv-line) transparent;
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
        fill: rgba(79,158,255,.12);
        stroke: var(--bv-accent);
        stroke-width: 2;
      }
      .match.focus { transform: scale(1.04); filter: drop-shadow(0 0 10px var(--bv-accent-glow)); }
      .bv-root.has-focus .match:not(.focus) { opacity: 0.28; }
      .team { cursor: pointer; transition: opacity .2s; }
      .team:hover .team-row { fill: rgba(79, 158, 255, 0.08); }
      .team-row { fill: transparent; transition: fill .2s; pointer-events: none; }
      .team-name {
        fill: var(--bv-text);
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        dominant-baseline: middle;
      }
      .team.winner .team-name { fill: var(--bv-winner); font-weight: 600; }
      .team.loser .team-name { fill: var(--bv-loser); text-decoration: line-through; }
      .check { fill: var(--bv-winner); font-size: 13px; pointer-events: none; }
      .bye-tag { fill: var(--bv-text-dim); font-size: 10px; pointer-events: none; }
      .separator { stroke: var(--bv-line); stroke-width: 1; }
      .match-id { fill: var(--bv-text-dim); font-size: 9px; pointer-events: none; opacity: 0.6; }
      .connector { fill: none; stroke: var(--bv-line); stroke-width: 1.5; transition: stroke .5s ease; }
      .connector.active { stroke: var(--bv-accent); }
      .trophy-icon { fill: rgba(250, 204, 21, 0.15); stroke: var(--bv-trophy); stroke-width: 1.5; }
      .trophy-stem { stroke: var(--bv-trophy); stroke-width: 1.5; stroke-dasharray: 2 2; }
      .trophy-glyph { fill: var(--bv-trophy); font-size: 18px; pointer-events: none; }
      .trophy-name { fill: var(--bv-trophy); font-size: 11px; pointer-events: none; }

      /* ═════════════ shared ═════════════ */
      .bv-root { display: flex; flex-direction: column; gap: 12px; }
      .bv-header { padding: 4px; }
      .bv-title { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
      .bv-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px 4px 4px;
        border-top: 1px solid var(--bv-line);
        align-items: center;
      }
      .bv-spacer { flex: 1; }
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
      .bv-btn:hover:not(:disabled) { background: var(--bv-card-hover); border-color: var(--bv-accent); }
      .bv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .bv-btn:active:not(:disabled) { transform: translateY(1px); }

      .bv-root.empty { padding: 24px; text-align: center; color: var(--bv-text-dim); }

      @media (max-width: 600px) {
        :host { padding: 8px; border-radius: 10px; }
        .bv-title { font-size: 14px; }
        .bv-page { padding: 12px 4px; }
        .bv-columns { gap: 10px; }
        .bv-team { grid-template-columns: 20px minmax(0, 1fr) 24px; gap: 4px; }
        .bv-team-name { font-size: 12px; }
        .bv-team-flag { font-size: 14px; width: 22px; height: 14px; flex: 0 0 22px; }
        .bv-team-score { flex: 0 0 26px; font-size: 12px; line-height: 1; }
        .bv-team-from { flex: 0 0 14px; width: 14px; font-size: 10px; }
        .bv-card { padding: 0 8px; height: 96px; grid-template-rows: 16px 1fr; }
        .bv-card-meta { height: 16px; line-height: 16px; font-size: 9px; gap: 4px; }
        .bv-card-status { font-size: 8px; padding: 2px 4px; }
        .bv-card-date { font-size: 9px; }
        .bv-card-preview { height: 96px; padding: 0 8px; }
      }
      @media (max-width: 640px) {
        .bv-title { font-size: 14px; }
        .bv-page { padding: 12px 4px; }
        /* On narrow screens, hide the preview column and make the
         * from column use the full container width. The user can switch
         * pages via the tabs and see the connector preview in the page
         * header text instead of as a sibling card column. */
        .bv-col-next-preview { display: none !important; }
        .bv-columns { grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: 'from' !important; }
        .bv-connectors { display: none !important; }
        .bv-team { grid-template-columns: 22px minmax(0, 1fr) 28px; gap: 6px; }
        .bv-team-name { font-size: 13px; }
        .bv-team-flag { font-size: 16px; width: 22px; height: 16px; flex: 0 0 22px; }
        .bv-team-score { flex: 0 0 28px; font-size: 13px; line-height: 1; }
        .bv-team-from { flex: 0 0 16px; width: 16px; font-size: 11px; }
        .bv-card { padding: 0 10px; height: 96px; grid-template-rows: 16px 1fr; }
        .bv-card-meta { height: 16px; line-height: 16px; font-size: 10px; gap: 6px; }
        .bv-card-status { font-size: 9px; padding: 2px 6px; }
        .bv-card-date { font-size: 10px; }
        .bv-card-preview { height: 96px; padding: 0 10px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .bv-card, .bv-team, .connector, .bv-tab { transition: none !important; }
        .match, .match-card, .team-row, .connector { transition: none !important; }
        .match.focus, .bv-card.focus { transform: none !important; }
        .bv-track { scroll-behavior: auto; }
      }
    `;
  }
}

customElements.define('bracket-view', BracketView);
export default BracketView;
