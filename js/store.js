// Livello dati — Supabase (database condiviso + aggiornamenti in tempo reale)
const Store = (() => {
  const PIN_KEY = 'ft_pin';
  const listeners = new Set();
  const configured = !/INSERISCI/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_KEY);
  const sb = configured ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;
  let cache = null;
  let timer = null;

  if (!configured) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = `<main class="app"><div class="card empty">
        Manca il collegamento a Supabase.<br>Compila <b>js/config.js</b> con URL e chiave del progetto.</div></main>`;
    });
  }

  async function fetchAll() {
    const [s, g, r, e] = await Promise.all([
      sb.from('settings').select('*').eq('id', 1).single(),
      sb.from('guests').select('*').order('created_at'),
      sb.from('rules').select('*').order('created_at'),
      sb.from('point_events').select('*').order('created_at'),
    ]);
    const err = s.error || g.error || r.error || e.error;
    if (err) throw err;
    cache = {
      settings: { festeggiato: s.data.festeggiato, titolo: s.data.titolo, classificaVisibile: s.data.classifica_visibile },
      guests: g.data, rules: r.data, events: e.data,
    };
    return cache;
  }

  async function refreshNow() {
    try {
      const s = await fetchAll();
      listeners.forEach(fn => fn(s));
    } catch (err) {
      console.error(err);
      setTimeout(refresh, 3000); // connessione assente: riprova
    }
  }
  // più modifiche ravvicinate → un solo ricaricamento
  function refresh() { clearTimeout(timer); timer = setTimeout(refreshNow, 150); }

  if (sb) {
    sb.channel('fantatrentesimo')
      .on('postgres_changes', { event: '*', schema: 'public' }, refresh)
      .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    // il telefono si riaccende o torna la rete → riallinea
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('online', refresh);
  }

  async function rpc(fn, args = {}) {
    const { data, error } = await sb.rpc(fn, { p_pin: localStorage.getItem(PIN_KEY), ...args });
    if (error) throw new Error(error.message);
    await refreshNow();
    return data;
  }

  return {
    // --- lettura ---
    get: async () => cache ?? fetchAll(),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // --- admin ---
    async login(pin) {
      const { data, error } = await sb.rpc('admin_login', { p_pin: pin });
      if (error) throw new Error(error.message);
      if (data) localStorage.setItem(PIN_KEY, pin);
      return data;
    },
    logout() { localStorage.removeItem(PIN_KEY); },
    isLogged: () => !!localStorage.getItem(PIN_KEY),

    assign: ({ guestIds, ruleId = null, punti = null, nota = '' }) =>
      rpc('admin_assign', { p_guest_ids: guestIds, p_rule_id: ruleId, p_punti: ruleId ? null : punti, p_nota: nota }),
    setAnnullato: (ids, annullato) => rpc('admin_set_annullato', { p_ids: ids, p_annullato: annullato }),

    saveRule: r => rpc('admin_save_rule', { p_id: r.id ?? null, p_emoji: r.emoji, p_nome: r.nome, p_descrizione: r.descrizione, p_punti: r.punti }),
    deleteRule: id => rpc('admin_delete_rule', { p_id: id }),

    saveGuest: g => rpc('admin_save_guest', { p_id: g.id ?? null, p_nome: g.nome, p_avatar: g.avatar }),
    deleteGuest: id => rpc('admin_delete_guest', { p_id: id }),

    saveSettings: patch => rpc('admin_save_settings', {
      p_festeggiato: patch.festeggiato ?? null, p_titolo: patch.titolo ?? null, p_classifica_visibile: patch.classificaVisibile ?? null,
    }),
    resetPoints: () => rpc('admin_reset_points'),
    resetAll: () => rpc('admin_reset_all'),
  };
})();

// --- utilità condivise ---
const Calc = {
  balances(s) {
    const b = Object.fromEntries(s.guests.map(g => [g.id, 0]));
    s.events.forEach(e => { if (!e.annullato && e.guest_id in b) b[e.guest_id] += e.punti; });
    return b;
  },
  ranking(s) {
    const b = Calc.balances(s);
    const sorted = [...s.guests].sort((a, c) => b[c.id] - b[a.id] || a.nome.localeCompare(c.nome));
    let lastPts = null, lastPos = 0;
    return sorted.map((g, i) => {
      if (b[g.id] !== lastPts) { lastPos = i + 1; lastPts = b[g.id]; }
      return { ...g, punti: b[g.id], pos: lastPos };
    });
  },
};

const AVATARS = ['😎', '🥳', '🦄', '🐯', '🍕', '🍾', '👑', '🌵', '🐙', '🦊', '🍩', '🚀', '💃', '🕺', '🐸', '🌈', '🔥', '👽', '🐼', '🍉'];
