// Pagina admin
(() => {
  const app = document.getElementById('app');
  const bar = document.getElementById('bar');
  const nav = document.getElementById('nav');
  let state = null;
  let tab = 'assegna';
  let needsRender = false;
  const sel = { rule: null, guests: new Set(), q: '', sign: 1, pts: '', note: '' };

  const TABS = [['assegna', 'sparkles', 'Assegna'], ['storico', 'clock', 'Storico'], ['invitati', 'users', 'Invitati'], ['regole', 'clipboard-document-list', 'Regole'], ['impostazioni', 'cog-6-tooth', 'Evento']];
  const guestName = id => state.guests.find(g => g.id === id)?.nome ?? '—';
  const guestAv = id => state.guests.find(g => g.id === id)?.avatar ?? '❔';

  // ---------- login ----------
  function renderLogin() {
    nav.hidden = true; bar.innerHTML = '';
    app.innerHTML = `<form class="pin-wrap" id="pin">
      <div class="hero-30" style="font-size:90px">30</div>
      <h2>Area admin</h2><p class="muted" style="margin:0">Inserisci il PIN per gestire il gioco</p>
      <input class="input pin-input" name="pin" type="password" inputmode="numeric" autocomplete="off" required autofocus>
      <p class="error" id="err"></p>
      <button class="btn btn-primary btn-block">Entra</button></form>`;
    const f = document.getElementById('pin');
    f.onsubmit = async e => {
      e.preventDefault();
      let ok = false;
      try { ok = await Store.login(new FormData(f).get('pin')); } catch { toast(`${icon('exclamation-triangle')} Connessione assente, riprova`); return; }
      if (ok) start();
      else { document.getElementById('err').textContent = 'PIN sbagliato'; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
    };
  }

  // ---------- struttura ----------
  function header() {
    const s = state.settings;
    return `<header class="top"><div class="brand"><div class="brand-badge">30</div>
      <div class="brand-text"><h1>${esc(s.titolo)}</h1><p>Admin · ${state.guests.length} invitati</p></div></div>
      <a class="btn btn-ghost btn-sm" href="./" target="_blank">${icon('eye')} Vista</a></header>`;
  }

  function renderNav() {
    nav.hidden = false;
    nav.innerHTML = TABS.map(([k, i, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${icon(i, "i")}${l}</button>`).join('');
    nav.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; window.scrollTo(0, 0); render(); });
  }

  function render() {
    renderNav();
    const views = { assegna: renderAssign, storico: renderHistory, invitati: renderGuests, regole: renderRules, impostazioni: renderSettings };
    views[tab]();
    if (tab !== 'assegna') bar.innerHTML = '';
  }

  // ---------- ASSEGNA ----------
  function renderAssign() {
    app.innerHTML = `${header()}
      <div class="step">1 · Cosa è successo?</div>
      <div class="rule-grid" id="ruleGrid"></div>
      <div class="card" id="manualBox" style="margin-top:10px" hidden>
        <div class="pm-toggle">
          <label><input type="radio" name="sign" value="1" ${sel.sign > 0 ? 'checked' : ''}><span class="b">${icon('plus-circle')} Bonus</span></label>
          <label><input type="radio" name="sign" value="-1" ${sel.sign < 0 ? 'checked' : ''}><span class="m">${icon('minus-circle')} Malus</span></label>
        </div>
        <label class="field"><span>Punti</span><input class="input" id="mPts" type="number" inputmode="numeric" min="1" placeholder="Es. 15" value="${esc(sel.pts)}"></label>
        <label class="field" style="margin:0"><span>Motivo</span><input class="input" id="mNote" maxlength="80" placeholder="Es. Ha fatto il discorso migliore" value="${esc(sel.note)}"></label>
      </div>
      <div class="step">2 · A chi?</div>
      <div class="tools">
        <label class="search">${icon('magnifying-glass')}<input class="input" id="search" placeholder="Cerca invitato" value="${esc(sel.q)}" autocomplete="off"></label>
        <button class="btn btn-ghost btn-sm" id="allBtn" type="button">Tutti</button>
      </div>
      <div class="guest-grid" id="guestGrid"></div>`;

    app.querySelectorAll('[name=sign]').forEach(r => r.onchange = () => { sel.sign = Number(r.value); renderBar(); });
    document.getElementById('mPts').oninput = e => { sel.pts = e.target.value; renderBar(); };
    document.getElementById('mNote').oninput = e => { sel.note = e.target.value; };
    document.getElementById('search').oninput = e => { sel.q = e.target.value; renderAssignLists(); };
    document.getElementById('allBtn').onclick = () => {
      const visible = filteredGuests();
      const allOn = visible.every(g => sel.guests.has(g.id));
      visible.forEach(g => allOn ? sel.guests.delete(g.id) : sel.guests.add(g.id));
      renderAssignLists();
    };
    renderAssignLists();
  }

  const filteredGuests = () => {
    const q = sel.q.trim().toLowerCase();
    return Calc.ranking(state).sort((a, b) => a.nome.localeCompare(b.nome)).filter(g => !q || g.nome.toLowerCase().includes(q));
  };

  function renderAssignLists() {
    // pulizia selezioni non più valide
    if (sel.rule && sel.rule !== 'manual' && !state.rules.some(r => r.id === sel.rule)) sel.rule = null;
    sel.guests.forEach(id => { if (!state.guests.some(g => g.id === id)) sel.guests.delete(id); });

    const rules = [...state.rules].sort((a, b) => b.punti - a.punti);
    document.getElementById('ruleGrid').innerHTML = rules.map(r => `
      <button type="button" class="rule-pick ${sel.rule === r.id ? 'on' : ''}" data-rule="${r.id}">
        <span class="e">${esc(r.emoji)}</span><span class="n">${esc(r.nome)}</span><span class="p ${ptsClass(r.punti)}">${fmtPts(r.punti)}</span>
      </button>`).join('') + `
      <button type="button" class="rule-pick manual ${sel.rule === 'manual' ? 'on' : ''}" data-rule="manual">
        <span class="e">${icon('adjustments-horizontal')}</span><span class="n">Punti manuali</span><span class="p muted">± ?</span></button>
      <button type="button" class="rule-pick manual" id="newRule">
        <span class="e">${icon('plus-circle')}</span><span class="n">Nuova regola</span><span class="p muted">crea al volo</span></button>`;
    document.getElementById('newRule').onclick = () => ruleDialog();
    document.querySelectorAll('[data-rule]').forEach(b => b.onclick = () => {
      sel.rule = sel.rule === b.dataset.rule ? null : b.dataset.rule;
      renderAssignLists();
      if (sel.rule === 'manual') document.getElementById('mPts').focus();
    });
    document.getElementById('manualBox').hidden = sel.rule !== 'manual';

    const guests = filteredGuests();
    document.getElementById('guestGrid').innerHTML = guests.length ? guests.map(g => `
      <button type="button" class="guest-pick ${sel.guests.has(g.id) ? 'on' : ''}" data-guest="${g.id}">
        <span class="a">${esc(g.avatar)}</span><span class="n">${esc(g.nome)}</span><span class="s">${g.punti} pt</span>
      </button>`).join('') : `<div class="empty" style="grid-column:1/-1">${state.guests.length ? 'Nessun invitato trovato' : 'Nessun invitato ancora: aggiungili dalla scheda Invitati'}</div>`;
    document.querySelectorAll('[data-guest]').forEach(b => b.onclick = () => {
      const id = b.dataset.guest;
      sel.guests.has(id) ? sel.guests.delete(id) : sel.guests.add(id);
      b.classList.toggle('on');
      renderBar();
    });
    const visible = guests.length && guests.every(g => sel.guests.has(g.id));
    document.getElementById('allBtn').textContent = visible ? 'Nessuno' : 'Tutti';
    renderBar();
  }

  function currentPoints() {
    if (!sel.rule) return null;
    if (sel.rule === 'manual') { const n = Math.abs(parseInt(sel.pts, 10)); return n ? n * sel.sign : null; }
    return state.rules.find(r => r.id === sel.rule)?.punti ?? null;
  }

  function renderBar() {
    if (tab !== 'assegna') return;
    const pts = currentPoints();
    const n = sel.guests.size;
    const ok = pts !== null && n > 0;
    let label = 'Scegli azione e invitati';
    if (pts === null && n) label = sel.rule === 'manual' ? 'Inserisci i punti' : 'Scegli un’azione';
    else if (pts !== null && !n) label = 'Scegli almeno un invitato';
    else if (ok) label = `Assegna ${fmtPts(pts)} a ${n === 1 ? guestName([...sel.guests][0]) : `${n} invitati`}`;
    bar.innerHTML = `<div class="confirm-bar"><div class="inner"><button class="btn ${ok ? (pts < 0 ? 'btn-danger' : 'btn-primary') : 'btn-ghost'}" id="go" ${ok ? '' : 'disabled'}>${esc(label)}</button></div></div>`;
    document.getElementById('go').onclick = doAssign;
  }

  async function doAssign() {
    const pts = currentPoints();
    const guestIds = [...sel.guests];
    const isManual = sel.rule === 'manual';
    const ids = await Store.assign({ guestIds, ruleId: isManual ? null : sel.rule, punti: pts, nota: isManual ? sel.note.trim() : '' });
    const names = guestIds.map(guestName);
    toast(`${icon('check-circle')} ${fmtPts(pts)} a ${esc(names.length > 3 ? `${names.slice(0, 3).join(', ')} e altri ${names.length - 3}` : names.join(', '))}`, {
      actionText: 'Annulla', duration: 6000,
      onAction: async () => { await Store.setAnnullato(ids, true); toast(`${icon('arrow-uturn-left')} Assegnazione annullata`); },
    });
    Object.assign(sel, { rule: null, q: '', sign: 1, pts: '', note: '' });
    sel.guests.clear();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderAssign();
  }

  // ---------- STORICO ----------
  function renderHistory() {
    const ev = [...state.events].sort((a, b) => b.created_at.localeCompare(a.created_at));
    app.innerHTML = `${header()}
      <div class="section-title"><h2>Storico assegnazioni</h2><span class="muted">${ev.length}</span></div>
      ${ev.length ? `<div class="list">${ev.map(e => `
        <div class="row ${e.annullato ? 'void' : ''}">
          <span class="av">${esc(e.emoji)}</span>
          <div class="main"><div class="title">${esc(guestAv(e.guest_id))} ${esc(guestName(e.guest_id))} · ${esc(e.nome)}</div>
            <div class="sub">${fmtTime(e.created_at)}${e.nota ? ` · ${esc(e.nota)}` : ''}${e.annullato ? ' · annullato' : ''}</div></div>
          <span class="pts ${ptsClass(e.punti)}">${fmtPts(e.punti)}</span>
          <button class="icon-btn" data-ev="${e.id}" data-void="${e.annullato}" title="${e.annullato ? 'Ripristina' : 'Annulla'}">${icon(e.annullato ? 'arrow-path' : 'arrow-uturn-left')}</button>
        </div>`).join('')}</div>`
        : `<div class="empty">${icon('clock', 'big')}Nessuna assegnazione ancora</div>`}`;
    app.querySelectorAll('[data-ev]').forEach(b => b.onclick = async () => {
      const wasVoid = b.dataset.void === 'true';
      if (!wasVoid && !(await confirmBox('Annullare questa assegnazione?', 'I punti verranno tolti dal saldo. Potrai ripristinarla.', 'Annulla punti'))) return;
      await Store.setAnnullato([b.dataset.ev], !wasVoid);
      toast(wasVoid ? `${icon('arrow-path')} Assegnazione ripristinata` : `${icon('arrow-uturn-left')} Assegnazione annullata`);
    });
  }

  // ---------- INVITATI ----------
  function renderGuests() {
    const ranking = Calc.ranking(state);
    app.innerHTML = `${header()}
      <div class="section-title"><h2>Invitati (${ranking.length})</h2><button class="btn btn-gold btn-sm" id="add">${icon('user-plus')} Aggiungi</button></div>
      ${ranking.length ? `<div class="list">${ranking.map(g => `
        <div class="row">
          <span class="rank-pos">${g.pos <= 3 ? medal(g.pos) : g.pos}</span>
          <span class="av">${esc(g.avatar)}</span>
          <div class="main"><div class="title">${esc(g.nome)}</div></div>
          <span class="pts ${ptsClass(g.punti)}">${g.punti}</span>
          <button class="icon-btn" data-edit="${g.id}" title="Modifica">${icon('pencil-square')}</button>
          <button class="icon-btn danger" data-del="${g.id}" title="Elimina">${icon('trash')}</button>
        </div>`).join('')}</div>`
        : `<div class="empty">${icon('users', 'big')}Nessun invitato ancora.<br>Aggiungili con il pulsante <b>Aggiungi</b>.</div>`}`;
    document.getElementById('add').onclick = () => guestDialog();
    app.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => guestDialog(state.guests.find(g => g.id === b.dataset.edit)));
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const g = state.guests.find(x => x.id === b.dataset.del);
      if (await confirmBox(`Eliminare ${esc(g.nome)}?`, 'Verranno cancellati anche tutti i suoi punti. Non si può annullare.', 'Elimina')) {
        await Store.deleteGuest(g.id);
        toast(`${icon('trash')} ${esc(g.nome)} eliminato`);
      }
    });
  }

  async function guestDialog(g = null) {
    const r = await modal({
      title: g ? 'Modifica invitato' : 'Nuovo invitato',
      okText: g ? 'Salva' : 'Aggiungi',
      cancelText: g ? 'Annulla' : 'Fine',
      body: `<label class="field"><span>Nome</span><input class="input" name="nome" maxlength="24" required value="${esc(g?.nome ?? '')}"></label>
        <div class="field"><span>Emoji</span>${avatarPicker(g?.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)])}</div>`,
    });
    if (!r) return;
    try {
      await Store.saveGuest({ id: g?.id, nome: r.nome, avatar: r.avatar });
      toast(g ? `${icon('check-circle')} Invitato aggiornato` : `${icon('check-circle')} ${esc(r.nome.trim())} aggiunto`);
      if (!g) guestDialog(); // pronto per il prossimo
    } catch (err) { toast(`${icon('exclamation-triangle')} ${esc(err.message)}`); }
  }

  // ---------- REGOLE ----------
  function renderRules() {
    const rules = [...state.rules].sort((a, b) => b.punti - a.punti);
    app.innerHTML = `${header()}
      <div class="section-title"><h2>Regolamento (${rules.length})</h2><button class="btn btn-gold btn-sm" id="add">${icon('plus')} Nuova</button></div>
      ${rules.length ? `<div class="list">${rules.map(r => `
        <div class="row wrap">
          <span class="av">${esc(r.emoji)}</span>
          <div class="main"><div class="title">${esc(r.nome)}</div><div class="sub">${esc(r.descrizione) || '&nbsp;'}</div></div>
          <span class="pts ${ptsClass(r.punti)}">${fmtPts(r.punti)}</span>
          <button class="icon-btn" data-rule="${r.id}" title="Modifica">${icon('pencil-square')}</button>
          <button class="icon-btn danger" data-delrule="${r.id}" title="Elimina">${icon('trash')}</button>
        </div>`).join('')}</div>`
        : `<div class="empty">${icon('clipboard-document-list', 'big')}Nessuna regola. Creane una!</div>`}`;
    document.getElementById('add').onclick = () => ruleDialog();
    app.querySelectorAll('[data-rule]').forEach(b => b.onclick = () => ruleDialog(state.rules.find(r => r.id === b.dataset.rule)));
    app.querySelectorAll('[data-delrule]').forEach(b => b.onclick = () => deleteRule(state.rules.find(r => r.id === b.dataset.delrule)));
  }

  async function deleteRule(rule) {
    if (await confirmBox(`Eliminare “${esc(rule.nome)}”?`, 'Le assegnazioni già fatte restano nello storico.', 'Elimina')) {
      await Store.deleteRule(rule.id); toast(`${icon('trash')} Regola eliminata`);
    }
  }

  async function ruleDialog(rule = null) {
    const quick = ['🎉', '💃', '🥂', '🎤', '📸', '🎂', '🍾', '😂', '❤️', '🍷', '⏰', '📱', '🤦', '💤', '🔥', '👑'];
    const malus = rule && rule.punti < 0;
    const r = await modal({
      title: rule ? 'Modifica regola' : 'Nuova regola',
      okText: 'Salva',
      extraText: rule ? 'Elimina' : null,
      body: `
        <div class="field"><span>Emoji</span>
          <input class="input" name="emoji" id="emo" maxlength="8" required value="${esc(rule?.emoji ?? '🎉')}" style="font-size:26px;text-align:center;width:84px">
          <div class="quick">${quick.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div></div>
        <label class="field"><span>Nome</span><input class="input" name="nome" maxlength="40" required value="${esc(rule?.nome ?? '')}" placeholder="Es. Primo a ballare"></label>
        <label class="field"><span>Descrizione (facoltativa)</span><input class="input" name="descrizione" maxlength="80" value="${esc(rule?.descrizione ?? '')}"></label>
        <div class="pm-toggle">
          <label><input type="radio" name="tipo" value="1" ${!malus ? 'checked' : ''}><span class="b">${icon('plus-circle')} Bonus</span></label>
          <label><input type="radio" name="tipo" value="-1" ${malus ? 'checked' : ''}><span class="m">${icon('minus-circle')} Malus</span></label>
        </div>
        <label class="field" style="margin:0"><span>Punti</span><input class="input" name="punti" type="number" inputmode="numeric" min="1" max="999" required value="${rule ? Math.abs(rule.punti) : ''}" placeholder="Es. 10"></label>`,
      onOpen: d => d.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { d.querySelector('#emo').value = b.dataset.q; }),
    });
    if (!r) return;
    if (r.__extra) return deleteRule(rule);
    await Store.saveRule({
      id: rule?.id, emoji: r.emoji.trim(), nome: r.nome.trim(), descrizione: r.descrizione.trim(),
      punti: Math.abs(parseInt(r.punti, 10)) * Number(r.tipo),
    });
    toast(`${icon('check-circle')} ${rule ? 'Regola aggiornata' : 'Regola creata'}`);
  }

  // ---------- IMPOSTAZIONI EVENTO ----------
  function renderSettings() {
    const s = state.settings;
    const link = new URL('./', location.href).href;
    app.innerHTML = `${header()}
      <div class="stack">
        <form class="card" id="setForm">
          <h3 class="h-icon" style="margin-bottom:14px">${icon('cake')} La festa</h3>
          <label class="field"><span>Nome della festeggiata</span><input class="input" name="festeggiato" maxlength="30" required value="${esc(s.festeggiato)}"></label>
          <label class="field"><span>Titolo della serata</span><input class="input" name="titolo" maxlength="40" required value="${esc(s.titolo)}"></label>
          <button class="btn btn-primary btn-block">Salva</button>
        </form>
        <div class="card switch-row">
          <div><h3 class="h-icon">${icon('trophy')} Classifica visibile</h3><p class="muted" style="margin:4px 0 0;font-size:14px">${s.classificaVisibile ? 'Gli invitati vedono la classifica' : 'Nascosta fino alla premiazione'}</p></div>
          <label class="switch"><input type="checkbox" id="vis" ${s.classificaVisibile ? 'checked' : ''}><span></span></label>
        </div>
        <div class="card">
          <h3 class="h-icon" style="margin-bottom:8px">${icon('link')} Link per gli invitati</h3>
          <p class="muted" style="margin:0 0 12px;word-break:break-all;font-size:14px">${esc(link)}</p>
          <button class="btn btn-ghost btn-block" id="copy">${icon('document-duplicate')} Copia link</button>
        </div>
        <div class="card danger-zone stack">
          <h3 class="h-icon neg">${icon('exclamation-triangle')} Zona pericolosa</h3>
          <button class="btn btn-ghost btn-block" id="resetPts">Azzera tutti i punti</button>
          <button class="btn btn-ghost btn-block" id="resetAll">Cancella invitati e punti</button>
        </div>
        <button class="btn btn-ghost btn-block" id="logout">${icon('arrow-right-start-on-rectangle')} Esci dall’area admin</button>
      </div>`;

    const f = document.getElementById('setForm');
    f.onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); await Store.saveSettings({ festeggiato: d.festeggiato.trim(), titolo: d.titolo.trim() }); toast(`${icon('check-circle')} Salvato`); };
    document.getElementById('vis').onchange = async e => {
      await Store.saveSettings({ classificaVisibile: e.target.checked });
      toast(e.target.checked ? `${icon('trophy')} Classifica svelata!` : `${icon('eye-slash')} Classifica nascosta`);
    };
    document.getElementById('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(link); toast(`${icon('document-duplicate')} Link copiato`); } catch { toast('Copia non riuscita, selezionalo a mano'); }
    };
    const twice = async (title, text, fn, done) => {
      if (!(await confirmBox(title, text, 'Continua'))) return;
      if (!(await confirmBox('Sei proprio sicuro?', 'Questa operazione non si può annullare.', 'Sì, procedi'))) return;
      await fn(); toast(done);
    };
    document.getElementById('resetPts').onclick = () => twice('Azzerare tutti i punti?', 'Gli invitati restano, lo storico viene cancellato.', Store.resetPoints, `${icon('check-circle')} Punti azzerati`);
    document.getElementById('resetAll').onclick = () => twice('Cancellare tutto?', 'Verranno eliminati tutti gli invitati e i punti. Le regole restano.', Store.resetAll, `${icon('check-circle')} Tutto cancellato`);
    document.getElementById('logout').onclick = () => { Store.logout(); renderLogin(); };
  }

  // ---------- avvio e tempo reale ----------
  function onUpdate(s) {
    state = s;
    if (!Store.isLogged()) return;
    if (tab === 'assegna' && document.getElementById('ruleGrid')) {
      renderAssignLists();
      app.querySelector('.brand-text p').textContent = `Admin · ${state.guests.length} invitati`;
      app.querySelector('.brand-text h1').textContent = state.settings.titolo;
      return;
    }
    // non ridisegnare mentre si sta scrivendo in un campo
    if (app.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea')) { needsRender = true; return; }
    render();
  }
  document.addEventListener('focusout', () => setTimeout(() => {
    if (needsRender && !(app.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea'))) { needsRender = false; render(); }
  }, 0));

  async function start() { state = await Store.get(); render(); }

  // errori dal database (es. PIN cambiato, rete assente)
  window.addEventListener('unhandledrejection', e => {
    const msg = e.reason?.message || 'Errore';
    if (msg.includes('PIN errato')) { Store.logout(); renderLogin(); toast(`${icon('lock-closed')} PIN non più valido, rientra`); }
    else toast(`${icon('exclamation-triangle')} ${esc(msg)}`);
  });

  Store.subscribe(onUpdate);
  if (Store.isLogged()) start(); else Store.get().then(s => { state = s; renderLogin(); });
})();
