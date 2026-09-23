# OMPRA · Test Irrigazione

PWA (React + Vite + Tailwind CSS) per digitalizzare il test di uniformità di
irrigazione (catch-cup test con pluviometri) svolto da un agrotecnico OMPRA
presso i giardini dei clienti: censimento punti su mappa, sessioni di
lettura sul campo o da foto, calcolo automatico degli indici di uniformità
(DU, CU di Christiansen), programmazione consigliata della centralina ed
export PDF.

Condivide backend, autenticazione e anagrafica clienti con il resto del
gestionale OMPRA (progetto Supabase `eoswkplehhmtxtattsha`), ma è
un'applicazione e un deploy Vercel separati e indipendenti.

## Funzionalità principali

- **Login** con Supabase Auth (email/password) — nessun ruolo separato,
  un utente autenticato ha accesso completo.
- **Elenco giardini** con ricerca cliente/luogo e indicatore colorato
  (verde/giallo/rosso) dell'uniformità dell'ultimo test registrato.
- **Nuovo giardino**: cliente da anagrafica condivisa (`clienti`) con
  autocomplete o creazione al volo, upload immagine mappa/planimetria,
  centralina (facoltativa), collegamento opzionale a un sopralluogo
  esistente. Supporta deep link `?giardino=<uuid>` (apre la scheda) e
  `?sopralluogo=<uuid>&cliente=<uuid>` (precompila il form) dall'app
  Sopralluogo.
- **Scheda giardino**: mappa con pan/zoom, pin dei punti colorati per
  stazione, tap per aggiungere un punto, drag per riposizionarlo, pannello
  di modifica/eliminazione, gestione stazioni/elettrovalvole, strumento
  "Distribuisci punti" (disegna un poligono a mano libera e genera N punti
  distribuiti uniformemente al suo interno), layer opzionale "irrigatori"
  (annotazioni visive, salvate solo in locale sul dispositivo).
- **Nuova sessione di lettura**: modalità "Sul campo" (tastierino numerico
  grande, un punto alla volta) o "Da foto" (carica una o più foto e
  compila i valori a fianco), nota con dettatura nativa della tastiera +
  pulsante microfono che trascrive tramite la Edge Function Gemini già
  in uso nel resto del gestionale.
- **Riepilogo sessione**: media/min/max, DU (quarto inferiore), CU di
  Christiansen con etichetta qualitativa, mappa a colori (heatmap),
  programmazione consigliata della centralina (minuti stagionali) con
  parametri regolabili, export PDF singola stazione o riepilogo intera
  visita (tutte le stazioni testate lo stesso giorno).
- **Storico giardino**: elenco sessioni passate con grafico
  dell'andamento del DU nel tempo.
- **Impostazioni**: tabella fabbisogno idrico mensile editabile.

## Stack tecnico

- React 19 + Vite
- Tailwind CSS v4
- react-router-dom
- @supabase/supabase-js (DB, Auth, Storage, Edge Functions)
- jspdf + jspdf-autotable
- vite-plugin-pwa (installabile, funziona offline per le pagine già visitate)

Nessuna libreria di state management esterna: stato locale con React hooks
e Context (`AuthContext`, `ToastContext`).

## Avvio in locale

Richiede Node.js 20+.

```bash
npm install
npm run dev
```

L'app userà automaticamente le variabili d'ambiente nel file `.env.local`
(già presente in locale con i valori del progetto Supabase reale — **non è
committato su git**, vedi `.gitignore`).

Per fare una build di produzione e verificarla:

```bash
npm run build
npm run preview
```

## Struttura del progetto

```
src/
  components/       componenti riutilizzabili (form, mappa, top bar, microfono…)
    common/         componenti UI generici (Button, Modal, Spinner, FormField…)
    mappa/          MapView: visualizzatore mappa con pan/zoom, pin, heatmap, poligono
  contexts/         AuthContext, ToastContext
  hooks/            useLocalStorage (usato solo dal layer opzionale "irrigatori")
  lib/              supabaseClient.js, api.js (accesso dati), storage.js (upload file)
  pages/            una pagina per ciascuna schermata dell'app
  utils/            calcoli (uniformità, programmazione centralina, poligono), export PDF, formattazione
```

## Deploy su Vercel

1. Crea un nuovo repository su GitHub e pusha questo codice:

   ```bash
   git remote add origin <url-del-tuo-repo>
   git branch -M main
   git push -u origin main
   ```

2. Vai su [vercel.com](https://vercel.com), importa il repository appena
   creato. Vercel riconosce automaticamente che è un progetto Vite
   (comando di build `npm run build`, cartella di output `dist`).

3. Prima del primo deploy (o subito dopo, poi ridistribuisci), apri le
   **Settings → Environment Variables** del progetto Vercel e aggiungi le
   due variabili con gli stessi valori del file `.env.local` locale:

   | Nome                       | Valore                                              |
   | --------------------------- | ---------------------------------------------------- |
   | `VITE_SUPABASE_URL`        | `https://eoswkplehhmtxtattsha.supabase.co`          |
   | `VITE_SUPABASE_ANON_KEY`   | *(la anon key del progetto Supabase, vedi `.env.local`)* |

4. Rideploya (o attendi il primo deploy automatico). L'app sarà
   raggiungibile all'URL assegnato da Vercel ed è installabile come PWA
   da smartphone (Chrome/Safari → "Aggiungi a schermata Home").

## Note su backend e dati

- Le tabelle Supabase (`irrigazione_giardini`, `irrigazione_stazioni`,
  `irrigazione_punti`, `irrigazione_sessioni`, `irrigazione_letture`,
  `irrigazione_fabbisogno_mensile`) e il bucket Storage
  `irrigazione-media` sono già stati creati e configurati (RLS
  `authenticated`-only) — questa app non genera né richiede migrazioni.
- L'anagrafica clienti (`clienti`) è condivisa con il resto del
  gestionale OMPRA: un nuovo cliente creato da questa app è visibile
  anche nelle altre applicazioni, e viceversa.
- Il layer "irrigatori" (pin + cerchio di annotazione, puramente visivo)
  non ha una tabella dedicata sul backend: è salvato solo nel
  `localStorage` del dispositivo/browser usato, per giardino (scelta
  dettata dal fatto che la specifica non prevede una tabella per questo
  layer facoltativo — vedi il riepilogo finale per i dettagli).
