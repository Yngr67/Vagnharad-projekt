CREATE TYPE "public"."action_priority" AS ENUM('hog', 'medel', 'lag');--> statement-breakpoint
CREATE TYPE "public"."action_source" AS ENUM('manuell', 'protokoll', 'tidplan');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('foreslagen', 'oppen', 'klar', 'avvisad');--> statement-breakpoint
CREATE TYPE "public"."convert_status" AS ENUM('ok', 'needs_ocr', 'unsupported', 'error');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('schedule', 'minutes', 'requirements', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_format" AS ENUM('p6_pdf', 'p6_xer');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner" text,
	"status" "action_status" NOT NULL,
	"priority" "action_priority" DEFAULT 'medel' NOT NULL,
	"due_date" date,
	"subproject" text,
	"source" "action_source" NOT NULL,
	"document_id" integer,
	"activity_code" text,
	"source_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actions_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"drive_file_id" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"folder_path" text NOT NULL,
	"drive_modified_time" timestamp with time zone NOT NULL,
	"md5_checksum" text,
	"doc_type" "doc_type" NOT NULL,
	"convert_status" "convert_status" NOT NULL,
	"import_error" text,
	"markdown" text,
	"removed" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('swedish', coalesce(name, '') || ' ' || coalesce(markdown, ''))) STORED,
	CONSTRAINT "documents_drive_file_id_unique" UNIQUE("drive_file_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "schedule_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"activity_code" text NOT NULL,
	"name" text NOT NULL,
	"wbs_path" text[] DEFAULT '{}'::text[] NOT NULL,
	"remaining_days" integer,
	"start_date" date,
	"finish_date" date,
	"start_actual" boolean DEFAULT false NOT NULL,
	"finish_actual" boolean DEFAULT false NOT NULL,
	"constrained" boolean DEFAULT false NOT NULL,
	"is_milestone" boolean DEFAULT false NOT NULL,
	"baseline_start" date,
	"baseline_finish" date,
	"total_float" integer,
	"predecessors" text[],
	CONSTRAINT "schedule_activities_uniq" UNIQUE("version_id","activity_code")
);
--> statement-breakpoint
CREATE TABLE "schedule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"source_format" "source_format" NOT NULL,
	"data_date" date NOT NULL,
	"baseline_name" text,
	"print_date" date,
	"content_hash" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_versions_uniq" UNIQUE("project_id","data_date","content_hash")
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin ("search_vector");