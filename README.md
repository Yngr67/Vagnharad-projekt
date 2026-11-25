# Vagnharad-projekt – Projektstöd

Personligt projektstödsystem för Vagnharad-uppdraget. Det synkar Google Drive-mappen
"Vagnharad projekt", gör om alla dokument till sökbar Markdown, läser Primavera-tidplaner
(PDF), hanterar actions och visar översikt, tidplan och sök.

```
Google Drive ──synk──► Markdown + sökindex ──► Databas (PostgreSQL)
(Word, PDF)            (varje fil, en gång)      │
                                                 ├─ Tidplanversioner (en serie per projekt-ID)
                                                 ├─ Actions (manuella / från tidplan / AI-förslag*)
                                                 └─ Dokument
                                                        │
             Webbapp:  Översikt · Tidplan · Actions · Dokument · Sök
             * AI-förslag ur protokoll är avstängt tills AI_ENABLED=true
```

- Design: `docs/superpowers/specs/2026-11-25-projektstod-design.md`
- Byggplan: `docs/superpowers/plans/2026-11-25-etapp1-grund.md`

---

## Driftsättning på kupp-server (steg för steg)

Du behöver: kupp-server med **Docker** och **Git** installerat, samt tillgång till
ditt Google-konto. Varje steg nedan är ett kommando du kopierar och klistrar in i
terminalen på servern. Inget av stegen raderar något.

### Steg 1 – Skapa ett Google "robotkonto" (service account)

Appen läser Drive med ett eget konto som bara får **läsa**.

1. Gå till <https://console.cloud.google.com/> och logga in.
2. Skapa ett nytt projekt, t.ex. `projektstod`.
3. Sök efter **Google Drive API** och klicka **Aktivera**.
4. Gå till **IAM och admin → Tjänstkonton → Skapa tjänstkonto**. Namn: `projektstod-reader`.
   Hoppa över rollerna (klicka Klar).
5. Klicka på kontot → fliken **Nycklar → Lägg till nyckel → Skapa ny nyckel → JSON**.
   En fil laddas ner. **Behandla den som ett lösenord.**
6. Kopiera kontots e-postadress (slutar på `.iam.gserviceaccount.com`).

### Steg 2 – Dela Drive-mappen med robotkontot

Öppna mappen **Vagnharad projekt** i Google Drive → **Dela** → klistra in robotkontots
e-postadress → behörighet **Läsare** → Skicka.

### Steg 3 – Hämta koden till servern

```bash
git clone https://github.com/Yngr67/Vagnharad-projekt.git
```

```bash
cd Vagnharad-projekt
```

### Steg 4 – Lägg in nyckelfilen

```bash
mkdir -p secrets
```

Flytta JSON-filen från steg 1 till `secrets/google-service-account.json`
(mappen `secrets/` checkas aldrig in i Git).

### Steg 5 – Skapa inställningsfilen `.env`

```bash
cp .env.example .env
```

Skapa ditt inloggningslösenord som hash (byt ut texten mot ditt eget lösenord, minst 8 tecken):

```bash
docker run --rm -i -v "$PWD":/app -w /app node:22-slim sh -c "npm ci --silent && echo -n 'MITT-LÖSENORD' | npx tsx scripts/hash-password.ts"
```

Skapa tre slumpmässiga nycklar (kör tre gånger, spara varje rad):

```bash
openssl rand -hex 24
```

Öppna `.env` i en texteditor (t.ex. `nano .env`) och fyll i:

| Rad | Värde |
|---|---|
| `POSTGRES_PASSWORD=` | slumpnyckel 1 |
| `SESSION_SECRET=` | slumpnyckel 2 |
| `SYNC_TOKEN=` | slumpnyckel 3 |
| `APP_PASSWORD_HASH=` | raden som började med `scrypt:` |
| `INSECURE_COOKIE=` | `true` (appen nås via http över Tailscale) |
| `AI_ENABLED=` | `false` tills du kontrollerat uppdragsavtalet |

### Steg 6 – Starta

```bash
docker compose up -d --build
```

Första gången tar det några minuter. Öppna sedan i webbläsaren (på en enhet i ditt
Tailscale-nät): <http://kupp-server.tail9e651d.ts.net:3000>

Logga in och tryck **Synka nu**.

### Steg 7 – Kontrollera tidplanläsaren mot den riktiga PDF:en

Läsaren är byggd efter textutdrag och testad mot påhittade filer. Kontrollera den mot
den riktiga Ålberga-tidplanen: öppna **Dokument**. Står det "Varning: N rader kunde inte
tolkas" vid tidplanen, klicka på raden och skicka listan till Claude så justeras läsaren.

---

## Vardagskommandon

| Vad | Kommando |
|---|---|
| Se om allt kör | `docker compose ps` |
| Se appens logg | `docker compose logs -f app` |
| Se nattliga synkar | `docker compose logs scheduler` |
| Uppdatera till senaste koden | `git pull && docker compose up -d --build` |
| Stoppa (data ligger kvar) | `docker compose down` |
| Säkerhetskopiera databasen | `docker compose exec db pg_dump -U projektstod projektstod > backup-$(date +%F).sql` |

Synken körs automatiskt varje natt kl. 02 (tjänsten `scheduler`).

---

## Utveckling (för Claude eller en utvecklare)

Kräver Node 22 och PostgreSQL 16.

1. `cp .env.example .env.local` och justera `DATABASE_URL`, `SESSION_SECRET`, `APP_PASSWORD_HASH`.
2. `npm ci`
3. `npm run db:migrate`
4. `npm run dev` → http://localhost:3000 (med `DRIVE_CLIENT=fake` används påhittade testfiler)
5. Tester: `npm test` (enhet/integration) och `npm run test:e2e` (webbläsare)

Regler: ingen verklig Trafikverket-data i repot (testfiler är påhittade), inga hemligheter
i koden, affärslogik i `src/lib/`, synken ska vara idempotent.
