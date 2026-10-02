// Pagina invitati — sola visualizzazione (gli invitati li crea l'admin)
(() => {
  const ME_KEY = 'ft_me';          // id dell'invitato scelto, oppure 'spettatore'
  const app = document.getElementById('app');
  let state = null;
  let meId = localStorage.getItem(ME_KEY);
  let tab = 'classifica';
  let seen = null;                 // eventi già visti: "id:annullato"
  let lastBalance = null;

  const me = () => state.guests.find(g => g.id === meId);
  const guestById = id => state.guests.find(g => g.id === id);

  function header(showSwitch) {
    const s = state.settings;
    return `<header class="top"><div class="brand">
      <div class="brand-badge">30</div>
      <div class="brand-text"><h1>${esc(s.titolo)}</h1><p>I 30 anni di ${esc(s.festeggiato)} 🎉</p></div></div>
      ${showSwitch ? `<button class="btn btn-ghost btn-sm" id="switch">${me() ? `${icon('arrows-right-left')} Cambia` : `${icon('user-plus')} Chi sei?`}</button>` : ''}
    </header>`;
  }

  // ---------- scelta "chi sei" ----------
  function renderPick() {
    const guests = [...state.guests].sort((a, b) => a.nome.localeCompare(b.nome));
    app.innerHTML = `${header(false)}
      <div class="hero-30">30</div>
      <div class="welcome"><h2>Chi sei?</h2><p>Tocca il tuo nome per seguire i tuoi punti.</p></div>
      ${guests.length ? `<div class="guest-grid">${guests.map(g => `
        <button class="guest-pick" data-id="${g.id}"><span class="a">${esc(g.avatar)}</span><span class="n">${esc(g.nome)}</span></button>`).join('')}</div>`
        : `<div class="card empty">${icon('users', 'big')}Gli invitati non sono ancora stati inseriti.<br>Riprova tra poco!</div>`}
      <button class="link-btn" id="watch">${icon('eye')} Voglio solo guardare la classifica</button>`;
    app.querySelectorAll('[data-id]').forEach(b => b.onclick = () => setMe(b.dataset.id));
    document.getElementById('watch').onclick = () => setMe('spettatore');
  }

  function setMe(id) {
    meId = id;
    localStorage.setItem(ME_KEY, id);
    seen = null; lastBalance = null;
    checkNewPoints();
    renderMain();
  }

  // ---------- pagina principale ----------
  function renderMain() {
    const g = me();
    const ranking = Calc.ranking(state);
    const visible = state.settings.classificaVisibile;
    let balance = '';
    if (g) {
      const mine = ranking.find(r => r.id === g.id);
      const bump = lastBalance !== null && lastBalance !== mine.punti;
      lastBalance = mine.punti;
      balance = `<section class="card balance">
        <div class="who"><span class="av">${esc(g.avatar)}</span>${esc(g.nome)}</div>
        <div class="num ${bump ? 'bump' : ''} ${ptsClass(mine.punti)}">${mine.punti}</div>
        <div class="label">punti</div>
        ${visible
          ? `<div class="rank">${mine.pos === 1 ? '👑 ' : ''}${mine.pos}° posto su ${ranking.length}</div>`
          : `<div class="rank">${icon('eye-slash')} Classifica segreta</div>`}
      </section>`;
    }

    app.innerHTML = `${header(true)}${balance}
      <nav class="seg">
        ${[['classifica', 'Classifica'], ['ultimi', 'Ultimi punti'], ['regole', 'Regolamento']]
          .map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
      </nav>
      <section>${tab === 'classifica' ? viewRanking(ranking) : tab === 'ultimi' ? viewFeed() : viewRules()}</section>`;

    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderMain(); });
    document.getElementById('switch').onclick = () => { meId = null; localStorage.removeItem(ME_KEY); renderPick(); };
  }

  function viewFeed() {
    const ev = state.events.filter(e => guestById(e.guest_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
    if (!ev.length) return `<div class="empty">${icon('sparkles', 'big')}Ancora nessun punto.<br>La serata è appena iniziata!</div>`;
    return `<div class="list">${ev.map(e => {
      const g = guestById(e.guest_id);
      return `<div class="row ${e.annullato ? 'void' : ''} ${e.guest_id === meId ? 'me' : ''}">
        <span class="av">${esc(e.emoji)}</span>
        <div class="main"><div class="title">${esc(g.avatar)} ${esc(g.nome)} · ${esc(e.nome)}</div>
          <div class="sub">${fmtTime(e.created_at)}${e.nota ? ` · ${esc(e.nota)}` : ''}${e.annullato ? ' · annullato' : ''}</div></div>
        <span class="pts ${ptsClass(e.punti)}">${fmtPts(e.punti)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function viewRanking(ranking) {
    if (!state.settings.classificaVisibile) {
      return `<div class="card frozen">${icon('eye-slash', 'big')}<h3>Classifica nascosta</h3>
        <p class="muted">Sarà svelata durante la premiazione!</p></div>`;
    }
    if (!ranking.length) return `<div class="empty">${icon('users', 'big')}Nessun invitato ancora.</div>`;
    const top = ranking.slice(0, 3);
    const podium = top.length === 3 ? `<div class="podium">${[top[1], top[0], top[2]].map(g => `
      <div class="p ${g.pos === 1 ? 'first' : ''}"><div class="m">${medal(g.pos)}</div><div class="a">${esc(g.avatar)}</div>
        <div class="n">${esc(g.nome)}</div><div class="s ${ptsClass(g.punti)}">${g.punti}</div></div>`).join('')}</div>` : '';
    const rest = top.length === 3 ? ranking.slice(3) : ranking;
    return podium + `<div class="list">${rest.map(g => `
      <div class="row ${g.id === meId ? 'me' : ''}">
        <span class="rank-pos">${g.pos <= 3 ? medal(g.pos) : g.pos}</span>
        <span class="av">${esc(g.avatar)}</span>
        <div class="main"><div class="title">${esc(g.nome)}${g.id === meId ? ' (tu)' : ''}</div></div>
        <span class="pts ${ptsClass(g.punti)}">${g.punti}</span>
      </div>`).join('')}</div>`;
  }

  function viewRules() {
    const rules = [...state.rules].sort((a, b) => b.punti - a.punti);
    const block = (title, list) => list.length ? `<div class="section-title"><h2>${title}</h2></div>
      <div class="list">${list.map(r => `
        <div class="row wrap"><span class="av">${esc(r.emoji)}</span>
          <div class="main"><div class="title">${esc(r.nome)}</div><div class="sub">${esc(r.descrizione)}</div></div>
          <span class="pts ${ptsClass(r.punti)}">${fmtPts(r.punti)}</span></div>`).join('')}</div>` : '';
    return block(`${icon('plus-circle')} Bonus`, rules.filter(r => r.punti >= 0)) + block(`${icon('minus-circle')} Malus`, rules.filter(r => r.punti < 0))
      || `<div class="empty">${icon('clipboard-document-list', 'big')}Il regolamento arriva a breve…</div>`;
  }

  // ---------- notifiche punti (solo per "me") ----------
  function checkNewPoints() {
    if (!me()) { seen = null; return; }
    const mine = state.events.filter(e => e.guest_id === meId);
    const keys = new Set(mine.map(e => `${e.id}:${e.annullato}`));
    if (seen) {
      const fresh = mine.filter(e => !seen.has(`${e.id}:${e.annullato}`));
      if (fresh.length) {
        const e = fresh[fresh.length - 1];
        const total = fresh.reduce((t, x) => t + (x.annullato ? -x.punti : x.punti), 0);
        showPop(total, e.annullato ? '↩️' : e.emoji, e.annullato ? `Annullato: ${e.nome}` : e.nome);
      }
    }
    seen = keys;
  }

  function showPop(punti, emoji, text) {
    const p = document.createElement('div');
    p.className = 'pop';
    p.innerHTML = `<div class="box"><div class="e">${esc(emoji)}</div>
      <div class="v ${ptsClass(punti)}">${fmtPts(punti)}</div><div class="t">${esc(text)}</div></div>`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2700);
    if (punti > 0) burst(['🎉', '✨', '🥳', '🍾', '💙']);
    else if (punti < 0) { burst(['😬', '💥'], 8); app.classList.add('shake'); setTimeout(() => app.classList.remove('shake'), 500); }
    navigator.vibrate?.(punti > 0 ? [60, 40, 60] : 200);
  }

  // ---------- avvio ----------
  function update(s) {
    state = s;
    document.title = s.settings.titolo;
    if (meId && meId !== 'spettatore' && !me()) { meId = null; localStorage.removeItem(ME_KEY); }
    if (!meId) return renderPick();
    checkNewPoints();
    renderMain();
  }

  Store.subscribe(update);
  Store.get().then(update);
})();
