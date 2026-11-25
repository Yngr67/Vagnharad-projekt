# Design: Projektstödsystem för Vagnharad-uppdraget

Datum: 2026-11-25 · Status: utkast för godkännande

## 1. Syfte och varför

Ett personligt arbetsverktyg för Peter (projektlednings­konsult) i uppdraget
Ostlänken, delen Ålberga/Vagnhärad (Trafikverket, projekt-ID **OL41**).
En vanlig vecka ska verktyget ge:

1. Överblick över vad som är på gång – actions och milstolpar.
2. Möjlighet att titta på tidplanen.
3. Tidiga varningar på att något håller på att spåra ur.
4. Analys av data och tidplaner.
5. Stöd i kravhantering.
6. Stöd i att identifiera kostnadsbesparingar.

Peter har valt en egen webbapp (framför att bara använda Claude mot Drive),
eftersom han vill öppna verktyget och direkt se läget, med historik över tid.

## 2. Mål, icke-mål, anti-mål

**Mål (helheten, byggs i etapper – se §5):** punkterna 1–6 ovan.

**Icke-mål:**
- Fler användare, roller eller kundinloggning. Peter är enda användaren.
- Att redigera Primavera-tidplanen eller skriva tillbaka till Drive.
- Mobilapp (webbläsare räcker; ska vara läsbar på mobil).

**Anti-mål (misslyckande även om det "fungerar"):**
- AI skapar actions som räknas utan att Peter har godkänt dem.
- Dashboarden visar gammal tidplandata som om den vore aktuell
  (avstämningsdatum måste alltid synas).
- Projektdata lämnar Peters server utan att han uttryckligen slagit på det.
- Verklig Trafikverket-data hamnar i GitHub-repot.

## 3. Förutsättningar och begränsningar

- **Källdata** i Google Drive-mappen "Vagnharad projekt"
  (`1lwRXzjFeMqyTWVt2iBrNuJHTtTvoovPJ`), ägd av Peters privata Gmail.
  Undermappar i dag: `Tidplaner`, `Styrande dokument`,
  `Projekt och kontrakt krav`, `Kostnadsbesparingar`.
- **Tidplaner** kommer från Primavera P6, i dag som PDF-utskrift
  (layout "OL 201 Projekttidplan Standard_min"). Exempel:
  `OL41 - Ålberga Projekttidplan.pdf` och `Programtidplan 5.0_signerad.pdf`.
  PDF:en innehåller per aktivitet: radnr, aktivitets-ID, namn, kvarvarande
  dagar, start, slut, markering `A` (utfört/actual) och `*` (låst datum),
  samt WBS-rubriker. Huvudet innehåller **avstämningslinje** (data date),
  **baslinjenamn** och utskriftsdatum. PDF:en saknar beroenden, slack/float
  och baslinjedatum.
- **XER/Excel-export från Primavera** kan Peter få senare. Den ska kunna
  läggas till utan att resten av systemet ändras.
- **Actions** finns i mötesprotokoll (fri text), i tidplanen, eller förs in
  manuellt.
- **Driftmiljö:** Peters egen server `kupp-server`, endast nåbar via Peters
  Tailscale-nät. Äldre PC: AMD Ryzen 5 (x86-64), GTX 1060 4 GB. OS och
  Docker-status utreds vid driftsättning. Grafikkortet kan i teorin köra en
  liten lokal AI-modell, men 4 GB räcker sannolikt inte för pålitlig
  utplockning på svenska; etapp 1 förutsätter ingen lokal AI.
  Utvecklingsmiljön (Claude-molnet) når **inte** servern.
- **Sekretess:** Trafikverkets data. Peter kontrollerar själv vad
  uppdragsavtalet tillåter. Tills dess är AI-anrop avstängda som standard.

## 4. Valda angreppssätt

| Alternativ | Bedömning |
|---|---|
| **A. Egen webbapp, egen databas, egen server** – *vald* | Enda varianten som ger en alltid aktuell vy, historik och regelbaserade varningar. Data stannar på Peters server. |
| B. Webbapp där Claude matar in data i sessioner | Dashboarden blir bara så färsk som senaste session. |
| C. Google Sheets + Looker Studio | För svagt för varningar och analys. |

Inom A valdes Peters egen server framför Supabase + Vercel: ingen
månadskostnad och data lämnar inte hans kontroll.

## 5. Etapper

| Etapp | Innehåll | Detaljnivå i denna design |
|---|---|---|
| **1. Grund** | Databas, Drive-synk, PDF-tidplanläsning, actions, översikt, tidplanvy, inloggning | **Fullt specificerad nedan** |
| 2. Varningsindikatorer | Regler för glidning, passerade milstolpar utan utfall, trend mellan tidplanversioner, försenade actions | Skiss |
| 3. AI-analys + rapporter | Frågor på naturligt språk (endast läsrätt), statusrapporter/export | Skiss |
| 4. Kravhantering | Krav ur kravdokument (t.ex. AKJ), status, spårbarhet | Egen design senare |
| 5. Kostnadsbesparingar | Underlag ur PM (OLE3110-Design-PM 01–10) | Egen design senare |

## 6. Etapp 1 – design

### 6.1 Teknik

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS.
- PostgreSQL med **Drizzle ORM** (byggarens val: SQL-nära, enkelt att senare
  ge AI:n läsrätt via vyer).
- Drift: **Docker Compose** med två tjänster (app + postgres) på kupp-server.
- Affärslogik i `src/lib/` (Drive, parsing, sync, varningar), UI i `src/app/`.
- Konfiguration via `.env.local`; `.env.example` hålls uppdaterad.

### 6.2 Inloggning

En användare. Lösenordet anges som hash i miljövariabel
(`APP_PASSWORD_HASH`), sessionen i en signerad, http-only cookie
(`SESSION_SECRET`). Tailscale är första skyddet, inloggningen det andra.

### 6.3 Datamodell

- `projects` – id, kod (t.ex. `OL41`), namn, status, start, slut.
- `documents` – Drive file_id (unik), namn, mimeType, mappväg, Drive
  `modifiedTime`, `md5Checksum`, senast synkad, typ (`schedule`, `minutes`,
  `requirements`, `other`), importstatus/felmeddelande, samt **`markdown`**
  (filens innehåll konverterat till Markdown) och ett fulltextindex
  (PostgreSQL `tsvector`, svensk ordlista) över det.
- `schedule_versions` – en rad per inläst tidplanfil och version:
  projekt, dokument, källformat (`p6_pdf`, senare `p6_xer`), avstämningsdatum,
  baslinjenamn, utskriftsdatum, **projekt-ID ur filens innehåll** (t.ex.
  "Project ID: OL41"). Unik på (dokument, checksum).
- `schedule_activities` – per version: aktivitets-ID, namn, WBS-sökväg,
  kvarvarande dagar, start, slut, `start_actual`, `finish_actual` (från `A`),
  låst datum (`*`), är_milstolpe (kvarvarande 0 och start = slut eller saknas).
  Fält för baslinjedatum, total float och föregångare finns men är tomma för
  PDF.
- `actions` – titel, beskrivning, ansvarig, status (`föreslagen`, `öppen`,
  `klar`, `avvisad`), prioritet, deadline, delprojekt, källa (`manuell`,
  `protokoll`, `tidplan`), länk till dokument och ev. aktivitets-ID,
  `source_key` (för dubblettskydd), skapad/ändrad.

Historik: Peter laddar upp **en ny fil** för varje ny tidplanversion (filer
ersätts inte). Versioner grupperas därför till en serie på **projekt-ID ur
PDF-huvudet** (inte filnamnet) och ordnas efter avstämningsdatum. Senaste
versionen i serien är "aktuell". Äldre versioner raderas inte – det ger
trendjämförelse i etapp 2.

### 6.4 Drive-synk

- Google **service account** med scope `drive.readonly`. Peter delar
  "Vagnharad projekt" med service-kontots e-post (läsbehörighet).
- Synken listar mappen rekursivt, upsertar `documents` på file_id och
  hoppar över filer vars `md5Checksum`/`modifiedTime` är oförändrade.
- Typ bestäms av undermapp (`Tidplaner` → schedule) och filnamn
  (innehåller "protokoll"/"minnesanteckningar" → minutes).
- Körs manuellt via knapp "Synka nu" och automatiskt en gång per natt.
- **Idempotent:** att köra synken två gånger ger inga nya rader.

### 6.4b Konvertering till Markdown och sökning

- **Alla** synkade filer konverteras till Markdown vid synk (Peters krav, för
  snabbare sökning och hantering). Word (`.docx`) → Markdown med rubriker,
  listor och tabeller bevarade. PDF → Markdown ur textlagret. Google Docs →
  export som Markdown/text.
- Markdown lagras i databasen (`documents.markdown`), inte i Drive.
  *(Byggarens val:)* service-konton kan normalt inte skapa filer i en privat
  Drive, och skrivrätt till Drive vore en onödig risk. Export av Markdown som
  filer kan läggas till senare.
- Fulltextsökning över alla dokument i en sökvy, med träffutdrag och länk
  till originalet i Drive.
- Tidplan-, protokoll- och AI-tolkning läser från Markdown/text, inte från
  originalfilen, så konverteringen görs en gång per filversion.
- Inskannade PDF:er utan textlager markeras "kräver OCR" och hoppas över i
  etapp 1.

### 6.5 Tidplaninläsning

- Gränssnitt `ScheduleImporter` med `parse(file) → ScheduleVersion + Activity[]`.
  Implementation 1: `P6PdfImporter`. Senare: `P6XerImporter`.
- PDF-text extraheras, sid­huvud/-fot och legend filtreras bort, rader tolkas
  med mönster för ID, namn, dagar, datum (`dd-Mon-yy`, med `A`/`*`).
  WBS-rubriker (rader utan aktivitets-ID, med dubblerade ord i utskriften)
  bygger WBS-sökvägen.
- Rader som inte går att tolka loggas och visas i importrapporten – de
  tappas aldrig tyst.
- Testas mot **syntetiska** testfiler i repot som efterliknar layouten.
  *(Byggarens val:)* Under utveckling hämtas den riktiga OL41-PDF:en via
  Drive-kopplingen till sessionens tillfälliga scratchpad för att ta fram
  tolkningsreglerna; den committas aldrig. Känt från riktig text: engelska
  månadsnamn (`dd-Mon-yy`), WBS-rubriker med dubblerade ord
  ("Rubrik Rubrik"), aktivitets-ID ibland ihopskrivet med namnet,
  långa namn upprepas på egen rad.
- **Programtidplanen** (`Programtidplan 5.0_signerad.pdf`) är en grafisk
  en-sidesbild: texten innehåller rubriker men inga datum. *(Byggarens val:)*
  Den tolkas inte i etapp 1 utan lagras som dokument med länk. Kan tolkas
  först om en P6-export av programplanen finns.
- **OL41-projekttidplanen styr** översikt och varningar.

### 6.6 Actions

- **Manuella:** skapa/redigera/stäng i UI.
- **Ur tidplan:** Peter kan markera en aktivitet/milstolpe som action
  (länkas via aktivitets-ID; `source_key` = `tidplan:<projekt>:<aktivitets-ID>`).
- **Ur protokoll (Word eller PDF):** AI läser protokollets Markdown och skapar actions med status
  `föreslagen`. De räknas inte förrän Peter godkänt dem.
  `source_key` = `protokoll:<file_id>:<hash av normaliserad text>`;
  en redan föreslagen/godkänd/avvisad nyckel skapas aldrig igen.
  Om protokollet ändras jämförs nya förslag mot befintliga och endast nya
  läggs till. **Funktionen är avstängd** (`AI_ENABLED=false`) tills Peter
  slagit på den.

### 6.7 Vyer

**Översikt (startsida)**
```
┌ <Projekt> ─ tidplan per <avstämningsdatum> (NN dagar gammal ⚠) ─ [Synka]┐
│ Actions:  12 öppna   3 försenade   20 klara                           │
│ Milstolpar närmaste 14 dagar          Passerade utan rapporterat utfall│
│  • <datum> <milstolpe>                • <datum> <milstolpe>             │
│  • <datum> <milstolpe>                • <datum> <milstolpe>             │
│ Senast synkade dokument   │  Nyligen tillagda actions                 │
└ Filter: ansvarig · status · delprojekt (WBS) ─────────────────────────┘
```
- "Passerade utan rapporterat utfall" = milstolpe med slut < idag, utan
  `A`, och slut > avstämningsdatum. (Första enkla varningen redan i etapp 1.)
- Varning när senaste tidplan är äldre än 35 dagar.

**Tidplan:** tabell + enkelt Gantt-diagram per WBS, filter "bara
milstolpar", tidsfönster, sök. Väljare för tidplanversion.

**Actions:** lista med filter, inkorg för `föreslagna`.

**Dokument:** synkade filer, typ, importstatus och fel.

**Sök:** fulltextsökning i alla dokuments Markdown.

### 6.8 Felhantering

Synk- och importfel sparas per dokument och visas i Dokument-vyn; en trasig
fil stoppar inte synken av övriga.

## 7. Utvecklings- och driftmiljö

- **Utveckling (Claude-molnet):** setup-skript installerar PostgreSQL och
  Node-beroenden. Inga Google- eller Trafikverket-uppgifter lagras i
  molnmiljön. Drive-synken testas mot en mock; riktig Drive-koppling
  verifieras på servern.
- **Drift (kupp-server):** `docker compose up -d`. Hemligheter
  (`GOOGLE_SERVICE_ACCOUNT_JSON`, `APP_PASSWORD_HASH`, `SESSION_SECRET`,
  senare `ANTHROPIC_API_KEY`) i `.env` på servern, aldrig i Git.
  Driftsättning sker antingen via Remote Control (Claude på servern) eller
  med steg-för-steg-instruktion i README.
- README beskriver uppsättning av databas, service account och delning av
  Drive-mappen.

## 8. Lämnas till byggaren

Exakt PDF-textbibliotek, UI-komponenter, Gantt-bibliotek, schemaläggning av
nattlig synk, migreringsupplägg, mappstruktur under `src/`.

## 9. Etapp 2–3 (skiss, specificeras senare)

- **Varningar:** glidning av samma aktivitet mellan versioner, milstolpar som
  flyttats flera gånger, aktiviteter som borde ha startat men saknar `A`,
  försenade actions per ansvarig; med XER: float som krymper, kritisk linje,
  glidning mot baslinje.
- **AI-analys:** chatt med endast SELECT-rätt via databasvyer, svar redovisar
  källor (tabell/dokument).
- **Rapporter:** veckorapport, försenat, klart – export CSV/Excel/utskrift.
