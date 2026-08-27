CREATE TYPE "puff_content_type" AS ENUM ('page', 'product', 'post', 'category', 'global');
CREATE TYPE "puff_content_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "puff_media_storage_provider" AS ENUM ('object-storage', 'external');

CREATE TABLE "migration_provenance" (
  "id" text PRIMARY KEY NOT NULL,
  "source_system" text NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "source_url" text,
  "source_modified_at" timestamptz,
  "archive_sha256" text,
  "payload_sha256" text,
  "import_batch" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "imported_at" timestamptz NOT NULL,
  CONSTRAINT "migration_provenance_archive_sha256_check" CHECK ("archive_sha256" IS NULL OR "archive_sha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "migration_provenance_payload_sha256_check" CHECK ("payload_sha256" IS NULL OR "payload_sha256" ~ '^[0-9a-fA-F]{64}$')
);

CREATE UNIQUE INDEX "migration_provenance_source_uidx" ON "migration_provenance" ("source_system", "source_kind", "source_id");
CREATE INDEX "migration_provenance_batch_idx" ON "migration_provenance" ("import_batch");

CREATE TABLE "content_records" (
  "id" text PRIMARY KEY NOT NULL,
  "type" "puff_content_type" NOT NULL,
  "path" text NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "excerpt" text,
  "body_html" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "seo" jsonb NOT NULL,
  "status" "puff_content_status" DEFAULT 'draft' NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "provenance_id" text,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "content_records_provenance_id_migration_provenance_id_fk" FOREIGN KEY ("provenance_id") REFERENCES "migration_provenance"("id") ON DELETE SET NULL,
  CONSTRAINT "content_records_path_check" CHECK (left("path", 1) = '/' AND left("path", 2) <> '//'),
  CONSTRAINT "content_records_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "content_records_path_uidx" ON "content_records" ("path");
CREATE INDEX "content_records_type_status_idx" ON "content_records" ("type", "status");
CREATE INDEX "content_records_slug_idx" ON "content_records" ("slug");
CREATE INDEX "content_records_updated_at_idx" ON "content_records" ("updated_at");

CREATE TABLE "content_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "content_id" text NOT NULL,
  "revision" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "change_summary" text,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "content_versions_content_id_content_records_id_fk" FOREIGN KEY ("content_id") REFERENCES "content_records"("id") ON DELETE RESTRICT,
  CONSTRAINT "content_versions_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "content_versions_content_revision_uidx" ON "content_versions" ("content_id", "revision");
CREATE INDEX "content_versions_created_at_idx" ON "content_versions" ("created_at");

CREATE TABLE "redirects" (
  "id" text PRIMARY KEY NOT NULL,
  "source_path" text NOT NULL,
  "target_path" text NOT NULL,
  "status_code" integer NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "provenance_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "redirects_provenance_id_migration_provenance_id_fk" FOREIGN KEY ("provenance_id") REFERENCES "migration_provenance"("id") ON DELETE SET NULL,
  CONSTRAINT "redirects_source_path_check" CHECK (left("source_path", 1) = '/' AND left("source_path", 2) <> '//'),
  CONSTRAINT "redirects_target_path_check" CHECK (left("target_path", 1) = '/' AND left("target_path", 2) <> '//'),
  CONSTRAINT "redirects_not_self_check" CHECK ("source_path" <> "target_path"),
  CONSTRAINT "redirects_status_code_check" CHECK ("status_code" IN (301, 308)),
  CONSTRAINT "redirects_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "redirects_source_path_uidx" ON "redirects" ("source_path");
CREATE INDEX "redirects_enabled_idx" ON "redirects" ("enabled");

CREATE TABLE "media_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" "puff_media_storage_provider" NOT NULL,
  "storage_key" text,
  "public_url" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_name" text NOT NULL,
  "alt_text" text DEFAULT '' NOT NULL,
  "caption" text,
  "width" integer,
  "height" integer,
  "bytes" bigint,
  "sha256" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "provenance_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_provenance_id_migration_provenance_id_fk" FOREIGN KEY ("provenance_id") REFERENCES "migration_provenance"("id") ON DELETE SET NULL,
  CONSTRAINT "media_assets_storage_check" CHECK ("provider" <> 'object-storage' OR ("storage_key" IS NOT NULL AND length("storage_key") > 0)),
  CONSTRAINT "media_assets_dimensions_check" CHECK (("width" IS NULL OR "width" >= 0) AND ("height" IS NULL OR "height" >= 0) AND ("bytes" IS NULL OR "bytes" >= 0)),
  CONSTRAINT "media_assets_sha256_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "media_assets_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "media_assets_provider_storage_key_uidx" ON "media_assets" ("provider", "storage_key");
CREATE INDEX "media_assets_mime_type_idx" ON "media_assets" ("mime_type");
CREATE INDEX "media_assets_sha256_idx" ON "media_assets" ("sha256");

CREATE TABLE "admin_login_throttles" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamptz NOT NULL,
  "locked_until" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "admin_login_throttles_key_hash_check" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "admin_login_throttles_scope_check" CHECK ("scope" IN ('ip', 'identity')),
  CONSTRAINT "admin_login_throttles_attempt_count_check" CHECK ("attempt_count" >= 0)
);

CREATE INDEX "admin_login_throttles_updated_at_idx" ON "admin_login_throttles" ("updated_at");

CREATE TABLE "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "actor_id" text NOT NULL,
  "request_id" text,
  "reason" text,
  "previous" jsonb,
  "next" jsonb,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "audit_events_entity_type_check" CHECK ("entity_type" IN ('content', 'redirect', 'media', 'migration-provenance'))
);

CREATE INDEX "audit_events_entity_idx" ON "audit_events" ("entity_type", "entity_id");
CREATE INDEX "audit_events_actor_idx" ON "audit_events" ("actor_id");
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events" ("occurred_at");

CREATE FUNCTION "puff_reject_immutable_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "content_versions_append_only"
BEFORE UPDATE OR DELETE ON "content_versions"
FOR EACH ROW EXECUTE FUNCTION "puff_reject_immutable_mutation"();

CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION "puff_reject_immutable_mutation"();
