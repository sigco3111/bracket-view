// Sample rendering of the SAME 8-team bracket using 5 different open-source
// libraries' design patterns. Each renderer is a self-contained function that
// writes DOM into a target element. Data shape comes from window.SAMPLE_DATA.
(function () {
  const DATA = window.SAMPLE_DATA;
  const PARTICIPANTS = DATA.participants; // 8 teams
  const NAME = (id) => (PARTICIPANTS.find((p) => p.id === id) || {}).name || '—';
  const FINAL_WINNER = DATA.reactBV.matches.find((m) => !m.next);

  // Convert data.reactBV into a tree: each match knows its parents
  const matches = DATA.reactBV.matches;
  const byId = (id) => matches.find((m) => m.id === id);

  // ---------------------------------------------------------------
  // 1. brackets-viewer.js style (DOM, hover, connector via CSS)
  // ---------------------------------------------------------------
  function renderBracketsViewer(target) {
    const root = document.createElement('div');
    root.className = 'bv-root bv-style';
    const rounds = [
      matches.filter((m) => m.id.startsWith('m') && parseInt(m.id.slice(1)) <= 4),
      matches.filter((m) => ['m9', 'm10'].includes(m.id)),
      matches.filter((m) => m.id === 'm11'),
    ];

    rounds.forEach((round, r) => {
      const roundEl = document.createElement('div');
      roundEl.className = 'bv-round';
      const h = document.createElement('h4');
      h.textContent = ['Quarterfinals', 'Semifinals', 'Final'][r];
      roundEl.appendChild(h);
      round.forEach((m, i) => {
        const card = document.createElement('div');
        card.className = 'bv-card';
        m.players.forEach((p, side) => {
          const row = document.createElement('div');
          const isWinner =
            (m.result === 0 && side === 0) || (m.result === 1 && side === 1);
          row.className = 'bv-team' + (isWinner ? ' winner' : '');
          row.textContent = p.name || '—';
          card.appendChild(row);
        });
        roundEl.appendChild(card);
      });
      root.appendChild(roundEl);
    });
    target.appendChild(root);
  }

  // ---------------------------------------------------------------
  // 2. vue-tournament-bracket style (Vue-flavored markup, templated)
  // ---------------------------------------------------------------
  function renderVue(target) {
    const root = document.createElement('div');
    root.className = 'vue-root';
    const rounds = DATA.vueBV.rounds;
    const labels = ['Quarterfinals', 'Semifinals', 'Final'];
    rounds.forEach((rs, r) => {
      const col = document.createElement('div');
      col.className = 'vue-round';
      const h = document.createElement('div');
      h.className = 'vue-round-label';
      h.textContent = labels[r];
      col.appendChild(h);
      rs.forEach(([a, b]) => {
        const card = document.createElement('div');
        card.className = 'vue-card';
        card.innerHTML = `
          <div class="vue-side">${NAME('p' + a)}</div>
          <div class="vue-side">${NAME('p' + b)}</div>
        `;
        col.appendChild(card);
      });
      root.appendChild(col);
    });
    target.appendChild(root);
  }

  // ---------------------------------------------------------------
  // 3. jquery-bracket style (big jQuery-era editor with edit clicks)
  // ---------------------------------------------------------------
  function renderJqBracket(target) {
    const root = document.createElement('div');
    root.className = 'jq-root';
    const label = document.createElement('div');
    label.className = 'jq-stage-label';
    label.textContent = 'World Cup (Elimination)';
    root.appendChild(label);
    const teamBox = document.createElement('div');
    teamBox.className = 'jq-teams';
    PARTICIPANTS.forEach((p, i) => {
      const team = document.createElement('div');
      team.className = 'jq-team';
      team.dataset.seed = i + 1;
      team.innerHTML = `<span class="jq-name">${p.name}</span>`;
      teamBox.appendChild(team);
    });
    root.appendChild(teamBox);
    const rounds = [
      matches.filter((m) => parseInt(m.id.slice(1)) <= 4),
      matches.filter((m) => ['m9', 'm10'].includes(m.id)),
      matches.filter((m) => m.id === 'm11'),
    ];
    const grid = document.createElement('div');
    grid.className = 'jq-grid';
    rounds.forEach((r, idx) => {
      const col = document.createElement('div');
      col.className = 'jq-col';
      const labels = ['Quarterfinals', 'Semifinals', 'Final'];
      col.innerHTML = `<div class="jq-rd">${labels[idx]}</div>`;
      r.forEach((m) => {
        const match = document.createElement('div');
        match.className = 'jq-match';
        const a = m.players[0].name || '—';
        const b = m.players[1].name || '—';
        match.innerHTML = `
          <div class="jq-side">${a}</div>
          <div class="jq-side">${b}</div>
        `;
        col.appendChild(match);
      });
      grid.appendChild(col);
    });
    root.appendChild(grid);
    target.appendChild(root);
  }

  // ---------------------------------------------------------------
  // 4. react-tournament-bracket style (SVG connectors + crisp lines)
  // ---------------------------------------------------------------
  function renderReact(target) {
    const root = document.createElement('div');
    root.className = 'rt-root';
    const teamMap = Object.fromEntries(PARTICIPANTS.map((p) => [p.id, p]));
    const layers = [
      matches.filter((m) => parseInt(m.id.slice(1)) <= 4),
      matches.filter((m) => ['m9', 'm10'].includes(m.id)),
      matches.filter((m) => m.id === 'm11'),
    ];

    const W = 700;
    const colW = 200;
    const cardH = 56;
    const gapY = 24;
    // pre-measure so vertical offsets are predictable
    const colCounts = layers.map((l) => l.length);
    const totalH = colCounts.reduce((h, n, i) => h + Math.max(n, 1) * (cardH + gapY), 0);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${Math.max(totalH, 250)}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', Math.max(totalH, 250));
    svg.classList.add('rt-svg');

    layers.forEach((layer, ci) => {
      const x = ci * (colW + 30);
      layer.forEach((m, mi) => {
        const y = 16 + mi * (cardH + gapY) * (ci === 0 ? 1 : ci === 1 ? 2 : 4);
        // card group
        const card = document.createElementNS(svgNS, 'g');
        card.setAttribute('transform', `translate(${x},${y})`);
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('width', colW);
        rect.setAttribute('height', cardH);
        rect.setAttribute('rx', 6);
        rect.classList.add('rt-rect');
        card.appendChild(rect);
        const tA = document.createElementNS(svgNS, 'text');
        tA.setAttribute('x', 12);
        tA.setAttribute('y', 22);
        tA.classList.add('rt-name');
        tA.textContent = m.players[0].name || '—';
        const tB = document.createElementNS(svgNS, 'text');
        tB.setAttribute('x', 12);
        tB.setAttribute('y', 44);
        tB.classList.add('rt-name');
        tB.textContent = m.players[1].name || '—';
        card.appendChild(tA);
        card.appendChild(tB);
        svg.appendChild(card);
      });
    });

    // connector lines L-shape between rounds
    const colYs = (ci) => {
      const n = layers[ci].length;
      return Array.from({ length: n }, (_, i) => 16 + i * (cardH + gapY) * (ci === 0 ? 1 : ci === 1 ? 2 : 4) + cardH / 2);
    };
    for (let ci = 0; ci < layers.length - 1; ci++) {
      const fromYs = colYs(ci);
      const toYs = colYs(ci + 1);
      fromYs.forEach((fy, i) => {
        const ty = toYs[Math.floor(i / 2)];
        const x = ci * (colW + 30);
        const x2 = (ci + 1) * (colW + 30);
        const mid = (x + colW + x2) / 2;
        const line = document.createElementNS(svgNS, 'path');
        line.setAttribute('d', `M ${x + colW} ${fy} H ${mid} V ${ty} H ${x2}`);
        line.classList.add('rt-line');
        svg.appendChild(line);
      });
    }

    root.appendChild(svg);
    target.appendChild(root);
  }

  // ---------------------------------------------------------------
  // 5. CSS-only baseline (Google style — done with HTML + flex column)
  // ---------------------------------------------------------------
  function renderCssOnly(target) {
    const root = document.createElement('div');
    root.className = 'css-root';
    root.innerHTML = `
      <div class="round r1">
        <div class="rd">Quarterfinals</div>
        <div class="card"><div class="name winner">Brazil</div></div>
        <div class="card"><div class="name loser">Croatia</div></div>
        <div class="card"><div class="name loser">Argentina</div></div>
        <div class="card"><div class="name winner">Netherlands</div></div>
        <div class="card"><div class="name loser">France</div></div>
        <div class="card"><div class="name winner">Poland</div></div>
        <div class="card"><div class="name loser">England</div></div>
        <div class="card"><div class="name winner">Senegal</div></div>
      </div>
      <div class="round r2">
        <div class="rd">Semifinals</div>
        <div class="card"><div class="name winner">Brazil</div></div>
        <div class="card"><div class="name loser">Netherlands</div></div>
        <div class="card"><div class="name winner">Poland</div></div>
        <div class="card"><div class="name loser">Senegal</div></div>
      </div>
      <div class="round r3">
        <div class="rd">Final</div>
        <div class="card"><div class="name loser">Brazil</div></div>
        <div class="card"><div class="name winner">Poland</div></div>
      </div>
      <div class="round r4">
        <div class="rd">Champion</div>
        <div class="card champ"><div class="name">🏆 Poland</div></div>
      </div>
    `;
    target.appendChild(root);
  }

  // ---------------------------------------------------------------
  // Mount each renderer into its target
  // ---------------------------------------------------------------
  document.querySelectorAll('[data-sample]').forEach((el) => {
    const which = el.dataset.sample;
    if (which === 'bv') renderBracketsViewer(el);
    else if (which === 'vue') renderVue(el);
    else if (which === 'jq') renderJqBracket(el);
    else if (which === 'react') renderReact(el);
    else if (which === 'css') renderCssOnly(el);
  });
})();
