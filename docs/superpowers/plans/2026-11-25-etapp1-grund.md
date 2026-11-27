# Etapp 1 – Grund: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-user web app that syncs the "Vagnharad projekt" Drive folder, converts every file to Markdown, reads Primavera P6 PDF schedules into versioned activity tables, manages actions, and shows an overview, schedule, actions, documents and search view.

**Architecture:** Next.js App Router app with all business logic in `src/lib/` (pure, tested with Vitest against a real local PostgreSQL), thin pages in `src/app/`. Drive access goes through a `DriveClient` interface (googleapis implementation in production, fake in tests). Runs on kupp-server as Docker Compose (app + db + scheduler).

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS 4, PostgreSQL 16, Drizzle ORM + drizzle-kit + `postgres` driver, Vitest, Playwright (one e2e smoke), `googleapis`, `mammoth` + `turndown` + `turndown-plugin-gfm`, `pdfjs-dist`, `jose`, `bcryptjs`, `@anthropic-ai/sdk`. Dev-only: `docx`, `pdf-lib` (to generate synthetic fixtures).

**Spec:** `docs/superpowers/specs/2026-11-25-projektstod-design.md`

## Global Constraints

- TypeScript `strict: true`; no `any` in `src/lib/`.
- Business logic only in `src/lib/`; pages/route handlers call it, never the other way.
- Never hardcode secrets. Every env var used is listed in `.env.example` with a comment.
- **No real Trafikverket data in the repo.** All fixtures are synthetic (made-up names, IDs, dates). Real PDFs may be read into the session scratchpad only.
- Drive folder ID default: `1lwRXzjFeMqyTWVt2iBrNuJHTtTvoovPJ` (env `DRIVE_ROOT_FOLDER_ID`). Scope: `https://www.googleapis.com/auth/drive.readonly`.
- `AI_ENABLED` defaults to `false`; when false no AI client is constructed or called.
- Sync is idempotent: running it twice on unchanged Drive content changes no row counts.
- Upcoming-milestone window: **14 days**. Stale schedule warning: data date older than **35 days**.
- "Today" is computed in `Europe/Stockholm`; all schedule dates are stored as SQL `date` (no time zone).
- UI text in Swedish. The schedule's data date (avstämningsdatum) is always visible wherever schedule data is shown.
- Single user: password hash in `APP_PASSWORD_HASH`, session cookie signed with `SESSION_SECRET`.

## Review Focus

1. **Repeated page headers/legends in P6 PDFs** (every page repeats title, baseline line, column header, legend, "Sida N av M") must never become activities or WBS rows → Task 4 test `ignores repeated page furniture`.
2. **Same schedule uploaded twice under different names** (same project ID, same data date) must not create a fake trend point; the current version is deterministic → Task 5 test `same project and data date under new file name is deduplicated`.
3. **Activities with only a start or only a finish date** (milestones in P6 print one date) must parse and not crash milestone/overdue logic → Task 4 test `single-date milestone`, Task 6 test `milestone with only start date`.
4. **Late-evening time zone edge:** at 23:30 UTC on 2026-11-30 it is already 1 Dec in Stockholm → Task 6 test `today uses Europe/Stockholm`.
5. **File removed or trashed in Drive** → document marked `removed`, history kept, its versions not "current" → Task 5 test `trashed file is marked removed`.

---

## File Structure

```
.env.example                      all env vars, commented
docker-compose.yml                app, db, scheduler
Dockerfile                        Next.js standalone build
drizzle.config.ts
src/lib/db/schema.ts              all tables, enums, indexes
src/lib/db/client.ts              getDb(): Drizzle instance from DATABASE_URL
src/lib/auth/                     password.ts, session.ts
src/middleware.ts                 route protection
src/lib/convert/                  to-markdown.ts, pdf-lines.ts, docx.ts
src/lib/schedule/                 types.ts, p6-pdf.ts, dates.ts
src/lib/drive/                    types.ts, google-client.ts, fake-client.ts
src/lib/sync/                     classify.ts, run-sync.ts
src/lib/overview/                 get-overview.ts, today.ts
src/lib/actions/                  service.ts
src/lib/search/                   search.ts
src/lib/ai/                       extract-actions.ts
src/app/(app)/…                   page per view; src/app/login; src/app/api/sync
scripts/scheduler.ts              nightly sync caller
tests/…                           mirrors src/lib; tests/fixtures/ synthetic only
tests/helpers/db.ts               fresh schema per test file
```

---

### Task 1: Project scaffold, database and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`, `.env.example`, `src/lib/db/client.ts`, `src/lib/db/schema.ts` (empty export for now), `tests/helpers/db.ts`, `tests/db/smoke.test.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/health/route.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: `getDb(): PostgresJsDatabase<typeof schema>`; `tests/helpers/db.ts` exports `setupTestDb(): Promise<{ db, cleanup(): Promise<void> }>` that creates a uniquely named schema, runs migrations into it, and drops it on cleanup. Env `DATABASE_URL`, `TEST_DATABASE_URL`.

- [ ] **Step 1:** `npx create-next-app@15` — remove `next/font/google` usage (it downloads fonts at build time, which the dev network blocks); use a system font stack. Then (TypeScript, Tailwind, App Router, `src/` dir, no ESLint prompt changes), add Drizzle, `postgres`, Vitest. Scripts: `dev`, `build`, `test` (`vitest run`), `db:generate`, `db:migrate`.
- [ ] **Step 2: Write failing test** `tests/db/smoke.test.ts` → `it('connects and runs migrations')`: `setupTestDb()` then `select 1` returns `1`.
- [ ] **Step 3:** Run `npm test` — Expected: FAIL (helper missing).
- [ ] **Step 4:** Implement `getDb` and `setupTestDb`. `/api/health` returns `{ ok: true }` without auth.
- [ ] **Step 5:** Run `npm test` — Expected: PASS. Run `npm run build` — Expected: success.
- [ ] **Step 6:** README: section "Kom igång lokalt" (Node 22, PostgreSQL 16, `cp .env.example .env.local`, `npm ci`, `npm run db:migrate`, `npm run dev`). Commit `chore: scaffold Next.js app with Drizzle and Vitest`.

### Task 2: Database schema

**Files:**
- Modify: `src/lib/db/schema.ts`; Create: migration under `drizzle/`; Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces tables (Drizzle names → SQL snake_case):
  - `projects` { id serial, code text unique, name text, status text, startDate date?, endDate date? }
  - `documents` { id serial, driveFileId text unique, name, mimeType, folderPath text, driveModifiedTime timestamptz, md5Checksum text?, docType enum `schedule|minutes|requirements|other`, convertStatus enum `ok|needs_ocr|unsupported|error`, importError text?, markdown text?, removed boolean default false, lastSyncedAt timestamptz, searchVector tsvector GENERATED ALWAYS AS `to_tsvector('swedish', coalesce(name,'') || ' ' || coalesce(markdown,''))` STORED + GIN index }
  - `schedule_versions` { id serial, projectId → projects, documentId → documents, sourceFormat enum `p6_pdf|p6_xer`, dataDate date, baselineName text?, printDate date?, contentHash text, importedAt timestamptz; unique(projectId, dataDate, contentHash) }
  - `schedule_activities` { id serial, versionId → schedule_versions cascade, activityCode text, name text, wbsPath text[], remainingDays int?, startDate date?, finishDate date?, startActual bool, finishActual bool, constrained bool, isMilestone bool, baselineStart date?, baselineFinish date?, totalFloat int?, predecessors text[]? ; unique(versionId, activityCode) }
  - `actions` { id serial, projectId → projects, title text, description text?, owner text?, status enum `foreslagen|oppen|klar|avvisad`, priority enum `hog|medel|lag` default `medel`, dueDate date?, subproject text?, source enum `manuell|protokoll|tidplan`, documentId → documents?, activityCode text?, sourceKey text unique (nullable; unique when set), createdAt, updatedAt }

- [ ] **Step 1: Write failing tests:** `driveFileId is unique`, `actions.sourceKey is unique when set and nullable for manual actions` (two manual actions with null key both insert), `schedule version unique on project+dataDate+contentHash`, `search_vector matches Swedish stem` (insert doc with markdown "Milstolparna försenades" → `search_vector @@ plainto_tsquery('swedish','milstolpe')` is true).
- [ ] **Step 2:** `npm test` — Expected: FAIL.
- [ ] **Step 3:** Implement schema; generated column via `sql` custom type; `npm run db:generate`.
- [ ] **Step 4:** `npm test` — Expected: PASS. Commit `feat: database schema`.

### Task 3: Single-user login

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `scripts/hash-password.ts`; Test: `tests/auth/*.test.ts`

**Interfaces:**
- Produces: `verifyPassword(plain: string, hash: string): Promise<boolean>`; `createSessionToken(): Promise<string>` (HS256 via `jose`, 30-day expiry); `verifySessionToken(token: string): Promise<boolean>`; cookie name `ps_session` (httpOnly, sameSite=lax, secure when `NODE_ENV=production`). Middleware allows `/login`, `/api/health`, `/api/sync` (that route checks its own auth, Task 7) and static assets; everything else redirects to `/login`.

- [ ] **Step 1: Failing tests:** `verifyPassword accepts correct and rejects wrong`; `session token round-trips`; `tampered token is rejected`; `expired token is rejected` (fake timers); middleware: `unauthenticated GET / redirects to /login`, `GET /api/health passes`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. `scripts/hash-password.ts` prints a bcrypt hash for a password read from stdin.
- [ ] **Step 4:** Run — PASS. Add `APP_PASSWORD_HASH`, `SESSION_SECRET` to `.env.example`. Commit `feat: single-user login`.

### Task 4: Markdown conversion and P6 PDF parser

**Files:**
- Create: `src/lib/convert/pdf-lines.ts`, `src/lib/convert/docx.ts`, `src/lib/convert/to-markdown.ts`, `src/lib/schedule/types.ts`, `src/lib/schedule/dates.ts`, `src/lib/schedule/p6-pdf.ts`, `tests/fixtures/make-fixtures.ts`, `tests/fixtures/p6-synthetic.txt`; Test: `tests/convert/*.test.ts`, `tests/schedule/p6-pdf.test.ts`

**Interfaces:**
- Produces:
  - `pdfToLines(buf: Uint8Array): Promise<string[][]>` — pages → text lines, items grouped by y (±2pt) and sorted by x.
  - `toMarkdown(buf: Uint8Array, mimeType: string): Promise<{ status: 'ok'|'needs_ocr'|'unsupported'; markdown: string }>` — docx via mammoth→turndown(gfm tables); pdf via `pdfToLines`, one `## Sida N` per page; `text/*` passthrough; a PDF with < 20 non-whitespace chars per page on average → `needs_ocr`.
  - `parseP6Date(s: string): { date: string /* YYYY-MM-DD */, actual: boolean, constrained: boolean } | null` for `dd-Mon-yy` with optional ` A` and `*` (English month abbreviations).
  - `ParsedSchedule = { projectCode: string; dataDate: string; baselineName: string|null; printDate: string|null; activities: ParsedActivity[]; unparsedLines: string[] }`, `ParsedActivity = { activityCode, name, wbsPath: string[], remainingDays: number|null, startDate, finishDate: string|null, startActual, finishActual, constrained, isMilestone }`.
  - `parseP6Pdf(pages: string[][]): ParsedSchedule` — throws `P6ParseError` if `Project ID:` or `Avstämningslinje:` is missing.

Parsing rules (from the real layout, documented in the spec §6.5): header fields `Avstämningslinje: dd-Mon-yy`, `Baseline: …`, `Project ID: XXX`, `Utskriftsdatum: dd-Mon-yy`. A row begins with a row number then either an activity code (pattern `[A-Za-z][A-Za-z0-9\-]*\d` possibly glued to the name) or a WBS title whose words are printed twice ("Projektledning Projektledning" → "Projektledning"). Trailing tokens are `remaining [start [A|*]] [finish [A|*]]`. WBS depth follows order of appearance: a WBS row's remaining/start/finish span contains following rows; implementer may instead use a stack reset by span end date—either is fine if tests pass. A line that only repeats the previous activity's name is skipped. `isMilestone = remainingDays === 0 && (startDate === null || finishDate === null || startDate === finishDate)`.

- [ ] **Step 1:** Write `tests/fixtures/make-fixtures.ts` (run in `globalSetup`) that generates into `tests/fixtures/out/` (git-ignored): `protokoll.docx` (heading, bullet list, 2×3 table) with `docx`; `p6-synthetic.pdf` rendering `p6-synthetic.txt` lines on 2 pages with repeated headers, using `pdf-lib`; `scanned.pdf` with only a rectangle drawn. `p6-synthetic.txt` uses invented names (e.g. project `XX99`, "Testbro", "Provmilstolpe").
- [ ] **Step 2: Failing tests:**
  - convert: `docx keeps heading, list and table` (markdown contains `# `, `- `, `| --- |`); `pdf without text is needs_ocr`; `unknown mime is unsupported`.
  - dates: `parses 05-Nov-26 → 2026-11-05`; `parses '03-Dec-24 A' as actual`; `parses '03-May-27*' as constrained`; `returns null for garbage`.
  - p6: `reads header` (projectCode `XX99`, dataDate, baselineName, printDate); `reads activity with actual start`; `reads glued code+name`; `single-date milestone` (one date → isMilestone true, finishDate = that date); `builds WBS path from doubled titles`; `ignores repeated page furniture` (activity count equals fixture's count, no activity named "Sida"/"Remaining"); `reports unparseable lines in unparsedLines`; `throws P6ParseError without Project ID`.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Implement.
- [ ] **Step 5:** Run — PASS.
- [ ] **Step 6: Real-file check (not committed):** fetch the real OL41 PDF via the Drive connector into the session scratchpad, run `npx tsx scripts/dev-parse.ts <path>` (prints counts and `unparsedLines`). Expected: ~260 rows, projectCode `OL41`, `unparsedLines` empty or only explainable noise. Fix rules + add a synthetic test case for each fix. Never copy real names into fixtures.
- [ ] **Step 7:** Commit `feat: markdown conversion and P6 PDF parser`.

### Task 5: Drive client and sync

**Files:**
- Create: `src/lib/drive/types.ts`, `src/lib/drive/google-client.ts`, `src/lib/drive/fake-client.ts`, `src/lib/sync/classify.ts`, `src/lib/sync/run-sync.ts`; Test: `tests/sync/*.test.ts`

**Interfaces:**
- Consumes: `toMarkdown`, `parseP6Pdf`, `pdfToLines` (Task 4); schema (Task 2).
- Produces:
  - `DriveFile = { id, name, mimeType, folderPath: string, modifiedTime: string, md5Checksum: string|null, trashed: boolean }`
  - `interface DriveClient { listTree(rootFolderId: string): Promise<DriveFile[]>; download(id: string): Promise<Uint8Array>; exportMarkdown(id: string): Promise<string> }` — `exportMarkdown` for `application/vnd.google-apps.document` (export mime `text/markdown`).
  - `createGoogleDriveClient(serviceAccountJson: string): DriveClient` (env `GOOGLE_SERVICE_ACCOUNT_JSON`, scope readonly).
  - `classify(file: DriveFile): DocType` — folderPath contains `Tidplaner` → `schedule`; name matches `/protokoll|minnesanteckning/i` → `minutes`; folderPath contains `krav` (case-insensitive) → `requirements`; else `other`.
  - `runSync(db, drive: DriveClient, opts: { rootFolderId: string; onMinutes?: (doc) => Promise<void> }): Promise<SyncReport>`; `SyncReport = { scanned, changed, skipped, removed, errors: { fileId, message }[], newScheduleVersions: number }`.

Behaviour: upsert `documents` by `driveFileId`; unchanged when both `md5Checksum` (or `modifiedTime` if no checksum) match → skip conversion. Changed → convert, store markdown/status. For `schedule` + PDF whose text contains `Project ID:` (graphic one-page programme plans do not; they are stored as documents only, no error): parse; upsert project by `projectCode` (name = code until edited); insert version with `contentHash` = sha256 of normalized activity rows, `ON CONFLICT DO NOTHING`; activities in the same transaction. Parse errors set `importError`, never abort the run. Files present in DB but absent or `trashed` → `removed = true`. `onMinutes` is called for changed `minutes` docs (Task 9 hooks in).

- [ ] **Step 1: Failing tests** (FakeDriveClient + synthetic fixtures): `schedule pdf without Project ID is stored without version or error`; `first sync imports documents and one schedule version`; `second sync on unchanged tree changes nothing` (row counts equal, `skipped` = total); `changed file creates a new version`; `new file with same project ID joins the same project`; `same project and data date under new file name is deduplicated`; `broken pdf records importError and others still import`; `trashed file is marked removed`; `scanned pdf stored with needs_ocr`; `classify` table test.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Add `GOOGLE_SERVICE_ACCOUNT_JSON`, `DRIVE_ROOT_FOLDER_ID` to `.env.example`. Commit `feat: Drive sync with markdown conversion and schedule import`.

### Task 6: Overview queries, actions service and search

**Files:**
- Create: `src/lib/overview/today.ts`, `src/lib/overview/get-overview.ts`, `src/lib/actions/service.ts`, `src/lib/search/search.ts`; Test: `tests/overview/*.test.ts`, `tests/actions/*.test.ts`, `tests/search/*.test.ts`

**Interfaces:**
- Produces:
  - `todayInStockholm(now?: Date): string` (YYYY-MM-DD).
  - `getCurrentVersion(db, projectId): Promise<ScheduleVersionRow|null>` — latest `dataDate`, tie → latest `importedAt`; ignores versions whose document is `removed`.
  - `getOverview(db, { projectId, today, owner?, status?, subproject? }): Promise<Overview>`; `Overview = { project, version: { dataDate, ageDays, stale: boolean } | null, actionCounts: { open, overdue, done }, upcomingMilestones: Milestone[] /* today ≤ date ≤ today+14 */, passedWithoutActual: Milestone[] /* dataDate < date < today and not actual */, recentDocuments: Doc[] /* 5 by lastSyncedAt */, recentActions: Action[] /* 5 by createdAt */ }`. Milestone date = `finishDate ?? startDate`. Overdue = status `oppen` and `dueDate < today`. `foreslagen` and `avvisad` are excluded from counts.
  - Actions: `createAction(db, input)`, `updateAction(db, id, patch)`, `createActionFromActivity(db, { projectId, activityCode, versionId }): Promise<Action>` (sourceKey `tidplan:<projectCode>:<activityCode>`; returns the existing row if key exists), `approveProposal(db, id)` (→ `oppen`), `rejectProposal(db, id)` (→ `avvisad`).
  - `searchDocuments(db, q: string, limit = 20): Promise<{ documentId, name, driveFileId, snippet }[]>` using `websearch_to_tsquery('swedish', q)` and `ts_headline`, excluding removed docs.

- [ ] **Step 1: Failing tests:** `today uses Europe/Stockholm` (2026-11-30T23:30Z → `2026-12-01`); `current version is latest data date`; `stale when data date older than 35 days`; `upcoming milestones within 14 days only`; `passedWithoutActual excludes actual and dates before data date`; `milestone with only start date` appears correctly; `proposals not counted`; `overdue counts open actions past due`; `filters by owner/status/subproject`; `createActionFromActivity twice returns same row`; `approve/reject transitions`; `search finds Swedish inflection and excludes removed`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS. Commit `feat: overview, actions service and search`.

### Task 7: UI – Översikt, Dokument, Sök and sync endpoint

**Files:**
- Create: `src/app/(app)/layout.tsx` (nav: Översikt · Tidplan · Actions · Dokument · Sök), `src/app/(app)/page.tsx`, `src/app/(app)/dokument/page.tsx`, `src/app/(app)/sok/page.tsx`, `src/app/api/sync/route.ts`, `src/components/…`; Test: `e2e/smoke.spec.ts`, `playwright.config.ts`, `tests/api/sync-route.test.ts`

**Interfaces:**
- Consumes: `getOverview`, `searchDocuments`, `runSync`, `createGoogleDriveClient`, session helpers.
- Produces: `POST /api/sync` — authorized by valid session cookie **or** header `Authorization: Bearer <SYNC_TOKEN>`; returns `SyncReport` JSON; 401 otherwise. Env `SYNC_TOKEN`, `DRIVE_CLIENT=fake` switches to `FakeDriveClient` seeded from `tests/fixtures/out` (dev/e2e only).

Overview layout follows the spec §6.7 sketch: header with project and "tidplan per <dataDate> (N dagar)" plus warning badge when stale; three count cards; two lists (kommande 14 dagar / passerade utan rapporterat utfall); recent documents and actions; filter bar. "Synka nu" button posts to `/api/sync` and shows the report. Dokument: table with name, type, status, importError, Drive link. Sök: query box, results with highlighted snippet and Drive link. Mobile-readable (single column below `md`).

- [ ] **Step 1: Failing tests:** `sync route rejects without auth`; `sync route accepts bearer token` (fake client); e2e `login → overview shows synthetic milestone and data date → Synka nu → search finds 'Provmilstolpe'` (with `DRIVE_CLIENT=fake`).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** `npm test` and `npx playwright test --trace off` — PASS. Commit `feat: overview, documents and search views`.

### Task 8: UI – Tidplan and Actions

**Files:**
- Create: `src/app/(app)/tidplan/page.tsx`, `src/components/gantt.tsx`, `src/app/(app)/actions/page.tsx`, `src/app/(app)/actions/actions.ts` (server actions); Test: `e2e/actions.spec.ts`

**Interfaces:**
- Consumes: `getCurrentVersion`, actions service.
- Produces: Tidplan page with version selector (all versions of the project, newest first, each labelled with dataDate), filters (WBS, "bara milstolpar", date window, text search), table + Gantt (plain SVG/CSS bars; milestones as diamonds; a vertical line at data date and at today). Each row has "Skapa action" → `createActionFromActivity`. Actions page: list with filters, create/edit form, "Inkorg" tab for `foreslagen` with Godkänn/Avvisa.

- [ ] **Step 1: Failing e2e:** `create action from milestone then it appears in Actions and in overview counts`; `manual action create and close`; `version selector shows both synthetic versions`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS. Commit `feat: schedule and actions views`.

### Task 9: AI proposals from meeting minutes (off by default)

**Files:**
- Create: `src/lib/ai/extract-actions.ts`; Modify: sync wiring where `runSync` is called (`onMinutes`); Test: `tests/ai/extract-actions.test.ts`

Load the `claude-api` skill before writing this task's code.

**Interfaces:**
- Produces: `interface ActionExtractor { extract(markdown: string): Promise<ProposedAction[]> }`, `ProposedAction = { title, owner: string|null, dueDate: string|null, description: string|null }`; `createAnthropicExtractor(apiKey: string, model: string): ActionExtractor` (structured output via a single tool definition); `proposeActionsFromMinutes(db, extractor, doc): Promise<{ created: number; skipped: number }>` — sourceKey `protokoll:<driveFileId>:<sha1(normalize(title)+'|'+(owner??''))>`, normalize = lowercase, collapse whitespace, strip punctuation; status `foreslagen`; existing key (any status, incl. `avvisad`) is skipped.
- Env: `AI_ENABLED` (default `false`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`).

- [ ] **Step 1: Failing tests** (fake extractor): `creates proposals with status foreslagen`; `re-running on same minutes creates nothing`; `rejected proposal is not recreated`; `reworded whitespace/punctuation maps to same key`; `when AI_ENABLED=false sync never constructs extractor` (spy).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS. Commit `feat: AI action proposals from minutes (disabled by default)`.

### Task 10: Docker deployment, scheduler and README

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `scripts/scheduler.ts`, `.dockerignore`; Modify: `README.md`, `.env.example`

**Interfaces:**
- Compose services: `db` (postgres:16, volume `pgdata`), `app` (runs `db:migrate` then `node server.js`, port `3000`), `scheduler` (same image, runs `scripts/scheduler.ts`: at 02:00 Europe/Stockholm POSTs `http://app:3000/api/sync` with `SYNC_TOKEN`; logs report). All three `restart: unless-stopped`.

- [ ] **Step 1:** Write files. **Step 2:** `docker compose config` — Expected: valid, no missing variables when `.env` is copied from `.env.example`. (No Docker daemon in the dev cloud; full `up` is verified on kupp-server.)
- [ ] **Step 3:** README sections in Swedish, step-by-step for a non-programmer: (a) skapa Google service account och JSON-nyckel, (b) dela Drive-mappen med service-kontots e-post (Läsare), (c) skapa `.env` (inkl. `npx tsx scripts/hash-password.ts`), (d) `docker compose up -d` på kupp-server, (e) öppna `http://kupp-server.tail9e651d.ts.net:3000`, (f) uppdatera: `git pull && docker compose up -d --build`, (g) säkerhetskopiera databasen.
- [ ] **Step 4:** `npm test && npm run build` — PASS. Commit `chore: docker deployment and nightly sync`.
