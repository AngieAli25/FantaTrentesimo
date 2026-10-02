# FantaTrentesimo

Gioco a punti stile FantaSanremo per i 30 anni di Martina.

- `index.html`: pagina per gli invitati, in sola lettura (classifica, ultimi punti, regolamento)
- `admin.html`: area admin protetta da PIN (invitati, regole, assegnazione e annullamento punti, impostazioni)

Il sito è statico (HTML + JS, senza build) e usa **Supabase** come database con aggiornamenti in tempo reale.

## Setup Supabase
1. Crea un progetto su supabase.com.
2. SQL Editor → incolla `supabase/schema.sql` → Run.
3. Cambia subito il PIN provvisorio con una query a parte, da **non** salvare nella repo:
   ```sql
   update admin_config set pin = 'IL-TUO-PIN' where id = 1;
   ```
4. Inserisci Project URL e chiave publishable/anon in `js/config.js`. Sono chiavi pubbliche.

## Avvio in locale
```bash
python3 -m http.server 5173
```
Poi apri http://localhost:5173 (invitati) e http://localhost:5173/admin.html (admin).

## Pubblicazione
Su Vercel: importa la repository GitHub e clicca Deploy, senza configurazioni.

Icone: [Heroicons](https://heroicons.com) (MIT).
