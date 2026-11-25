# Vagnharad-projekt – Projektstöd

Personligt projektstödsystem för Vagnharad-uppdraget: synkar Google Drive,
gör om dokument till Markdown, läser Primavera-tidplaner, hanterar actions och
visar översikt, tidplan och sök.

- Design: `docs/superpowers/specs/2026-11-25-projektstod-design.md`
- Byggplan: `docs/superpowers/plans/2026-11-25-etapp1-grund.md`

## Kom igång lokalt

Kräver Node 22 och PostgreSQL 16.

1. Kopiera miljöfilen: `cp .env.example .env.local` och justera `DATABASE_URL`.
2. Installera paket: `npm ci`
3. Skapa tabeller: `npm run db:migrate`
4. Starta: `npm run dev` och öppna http://localhost:3000
5. Kör tester: `npm test`
