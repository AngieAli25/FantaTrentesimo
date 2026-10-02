# Progetto: FantaTrentesimo — web app stile FantaSanremo per una festa di 30 anni

## Contesto
Sto organizzando una festa per un trentesimo compleanno. Voglio una web app in stile FantaSanremo: durante la serata gli invitati guadagnano o perdono punti in base a delle azioni (bonus/malus) definite in un regolamento. **Solo io (admin)** assegno o tolgo i punti. Gli invitati hanno un link pubblico, senza login, dove inseriscono il proprio nome e vedono in tempo reale il loro saldo e lo storico delle azioni.

L'app verrà usata quasi esclusivamente da **smartphone**, durante una festa, da persone non tecniche: deve essere semplicissima, veloce e divertente.

## Stack richiesto
- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Supabase** come database (Postgres) con **Realtime** attivo, così saldi e classifica si aggiornano da soli senza ricaricare la pagina
- Deploy su **Vercel**
- Niente sistemi di autenticazione complessi (vedi sezione Sicurezza)

Se ritieni che uno stack più semplice sia migliore per questo caso d'uso, proponimelo **prima** di iniziare, motivando in due righe.

## Ruoli

### 1. Invitato (link pubblico, es. `/`)
- Al primo accesso inserisce il proprio **nome** (eventualmente un emoji/avatar a scelta da una lista).
- Il nome viene salvato sul database e il suo ID nel `localStorage` del telefono, così se riapre il link ritrova il suo profilo senza reinserire nulla.
- Impedire nomi duplicati (controllo case-insensitive) e mostrare un messaggio chiaro.
- Una volta registrato vede:
  - **Saldo punti** grande e ben visibile
  - **Storico** delle azioni ricevute (nome azione, +/− punti, orario), dalla più recente
  - **Classifica** generale di tutti gli invitati
  - **Regolamento** con l'elenco di bonus e malus
- Tutto si aggiorna in tempo reale. Quando riceve punti, mostra una piccola animazione/notifica (es. "+10 🎉" o "−5 😬").
- L'invitato **non può** modificare nulla tranne il proprio nome/avatar al momento della registrazione.

### 2. Admin (io, es. `/admin`)
- **Gestione regolamento**: creare, modificare, eliminare azioni. Ogni azione ha: nome, descrizione breve, punti (positivi = bonus, negativi = malus), categoria opzionale, emoji.
- **Lista invitati**: vedo in tempo reale chi si è registrato, con saldo attuale. Posso rinominare o eliminare un invitato (con conferma).
- **Assegnazione punti** (la funzione più importante, deve essere rapidissima da telefono):
  - Seleziono un'azione dal regolamento → seleziono uno **o più** invitati → confermo
  - In alternativa: punti manuali personalizzati con una nota libera (es. "+15 — ha fatto il discorso migliore")
  - Ricerca/filtro rapido per nome invitato
- **Annulla**: posso annullare un'assegnazione dallo storico (in caso di errore).
- **Storico globale** di tutte le assegnazioni.
- **Impostazioni evento**: nome del festeggiato, titolo della serata, possibilità di "congelare" la classifica (gli invitati vedono un messaggio tipo "Classifica nascosta fino alla premiazione!") e di riattivarla.
- **Reset** completo dei punti (con doppia conferma), utile per i test prima della festa.

## Sicurezza (semplice ma sufficiente)
- Nessun login per gli invitati.
- L'area admin è protetta da un **PIN/password** salvato in variabile d'ambiente (`ADMIN_PIN`). Dopo l'inserimento, sessione mantenuta con cookie httpOnly.
- **Tutte le scritture** (assegnazione punti, modifica regole, ecc.) passano da API route server-side che verificano la sessione admin e usano la `service_role` key di Supabase lato server. Il client pubblico usa solo la `anon` key in **sola lettura**, più l'inserimento del proprio profilo invitato.
- Configura le **Row Level Security** di Supabase di conseguenza.

## Modello dati (proposta, modificabile)
- `event_settings` — nome festeggiato, titolo, classifica_visibile (bool)
- `guests` — id, nome, avatar, created_at
- `rules` — id, nome, descrizione, punti, categoria, emoji, attiva (bool)
- `point_events` — id, guest_id, rule_id (nullable), punti, nota, created_at, annullato (bool)

Il saldo di ogni invitato si calcola come somma dei `point_events` non annullati (vista o query aggregata).

## Design
- Mobile-first, pulsanti grandi, leggibile anche con luci basse (tema scuro di default).
- Stile festoso ma elegante: colori vivaci, emoji, micro-animazioni. Il tema "30 anni" deve essere riconoscibile.
- Testi dell'interfaccia **in italiano**.
- Il nome del festeggiato e il titolo della serata devono essere configurabili dall'admin, non scritti nel codice.

## Dati di esempio
Precarica circa 10 regole di esempio divertenti per una festa di 30 anni (es. "Primo a ballare +10", "Rovescia un drink −5", "Fa un brindisi commosso +15", "Arriva in ritardo −10"), che potrò poi modificare.

## Modalità di lavoro
1. **Prima di scrivere codice**, mostrami un piano sintetico: struttura delle cartelle, schema del database e pagine previste. Aspetta il mio ok.
2. Poi procedi **un passo alla volta**, fermandoti dopo ogni blocco principale (setup + DB → area invitato → area admin → realtime → rifiniture grafiche) per farmi testare.
3. Fornisci lo **script SQL** completo per Supabase (tabelle, RLS, seed) da incollare nel SQL editor.
4. Crea un file `.env.example` e un `README.md` con istruzioni brevi per: setup Supabase, avvio in locale, deploy su Vercel.
5. Alla fine, una checklist di test da fare prima della festa (es. 3 telefoni diversi, assegnazione multipla, annullamento, classifica nascosta).

Comunicazione: diretta e concisa, niente spiegazioni superflue.
