import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const docType = pgEnum("doc_type", ["schedule", "minutes", "requirements", "other"]);
export const convertStatus = pgEnum("convert_status", ["ok", "needs_ocr", "unsupported", "error"]);
export const sourceFormat = pgEnum("source_format", ["p6_pdf", "p6_xer"]);
export const actionStatus = pgEnum("action_status", ["foreslagen", "oppen", "klar", "avvisad"]);
export const actionPriority = pgEnum("action_priority", ["hog", "medel", "lag"]);
export const actionSource = pgEnum("action_source", ["manuell", "protokoll", "tidplan"]);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status"),
  startDate: date("start_date"),
  endDate: date("end_date"),
});

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    driveFileId: text("drive_file_id").notNull().unique(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    folderPath: text("folder_path").notNull(),
    driveModifiedTime: timestamp("drive_modified_time", { withTimezone: true }).notNull(),
    md5Checksum: text("md5_checksum"),
    docType: docType("doc_type").notNull(),
    convertStatus: convertStatus("convert_status").notNull(),
    importError: text("import_error"),
    markdown: text("markdown"),
    removed: boolean("removed").notNull().default(false),
    /** Vilken bearbetning filen senast gick igenom (läsarversion, AI). Annan signatur ⇒ läs om. */
    processedWith: text("processed_with"),
    /** Innehållshash för tidplanen i filen (samma som schedule_versions.content_hash). */
    contentHash: text("content_hash"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('swedish', coalesce(name, '') || ' ' || coalesce(markdown, ''))`,
    ),
  },
  (t) => [index("documents_search_idx").using("gin", t.searchVector)],
);

export const scheduleVersions = pgTable(
  "schedule_versions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id),
    sourceFormat: sourceFormat("source_format").notNull(),
    dataDate: date("data_date").notNull(),
    baselineName: text("baseline_name"),
    printDate: date("print_date"),
    contentHash: text("content_hash").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("schedule_versions_uniq").on(t.projectId, t.dataDate, t.contentHash)],
);

export const scheduleActivities = pgTable(
  "schedule_activities",
  {
    id: serial("id").primaryKey(),
    versionId: integer("version_id")
      .notNull()
      .references(() => scheduleVersions.id, { onDelete: "cascade" }),
    activityCode: text("activity_code").notNull(),
    name: text("name").notNull(),
    wbsPath: text("wbs_path").array().notNull().default(sql`'{}'::text[]`),
    remainingDays: integer("remaining_days"),
    startDate: date("start_date"),
    finishDate: date("finish_date"),
    startActual: boolean("start_actual").notNull().default(false),
    finishActual: boolean("finish_actual").notNull().default(false),
    constrained: boolean("constrained").notNull().default(false),
    isMilestone: boolean("is_milestone").notNull().default(false),
    baselineStart: date("baseline_start"),
    baselineFinish: date("baseline_finish"),
    totalFloat: integer("total_float"),
    predecessors: text("predecessors").array(),
  },
  (t) => [unique("schedule_activities_uniq").on(t.versionId, t.activityCode)],
);

export const actions = pgTable("actions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  owner: text("owner"),
  status: actionStatus("status").notNull(),
  priority: actionPriority("priority").notNull().default("medel"),
  dueDate: date("due_date"),
  subproject: text("subproject"),
  source: actionSource("source").notNull(),
  documentId: integer("document_id").references(() => documents.id),
  activityCode: text("activity_code"),
  sourceKey: text("source_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ScheduleVersionRow = typeof scheduleVersions.$inferSelect;
export type ScheduleActivityRow = typeof scheduleActivities.$inferSelect;
export type ActionRow = typeof actions.$inferSelect;
