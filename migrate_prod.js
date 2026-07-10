const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not defined.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes('railway') ? { rejectUnauthorized: false } : undefined
});

const sql = `
BEGIN;

-- Agregar columnas faltantes a la tabla de visitas
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_connection_id" uuid;
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_id" varchar(255);
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_event_id" varchar(255);
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_event_etag" varchar(255);
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_html_link" text;
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_sync_status" varchar(30) DEFAULT 'PENDING';
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_last_sync_at" timestamp;
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_last_error" text;
ALTER TABLE "visitas" ADD COLUMN IF NOT EXISTS "google_calendar_sync_attempts" integer DEFAULT 0;

-- Agregar columnas faltantes a incidentes_salud
ALTER TABLE "incidentes_salud" ADD COLUMN IF NOT EXISTS "external_incident_id" varchar(150);

-- Crear las dos tablas nuevas para Google Calendar
CREATE TABLE IF NOT EXISTS "profesional_google_calendar_connections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "profesional_salud_id" uuid NOT NULL,
  "usuario_id" uuid NOT NULL,
  "google_account_id" varchar(255),
  "google_account_email" varchar(255),
  "calendar_id" varchar(255) NOT NULL DEFAULT 'primary',
  "access_token_ciphertext" text NOT NULL,
  "refresh_token_ciphertext" text,
  "token_encryption_alg" varchar(30) NOT NULL DEFAULT 'AES-256-GCM',
  "token_encryption_iv" varchar(100) NOT NULL,
  "token_encryption_tag" varchar(100) NOT NULL,
  "token_encryption_key_id" varchar(100) NOT NULL DEFAULT 'default',
  "scopes" text,
  "expires_at" timestamp,
  "sync_enabled" boolean NOT NULL DEFAULT true,
  "last_sync_at" timestamp,
  "last_sync_error" text,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp,
  CONSTRAINT "PK_prof_gcal_conn" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "google_calendar_sync_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "visita_id" uuid,
  "connection_id" uuid,
  "action" varchar(30) NOT NULL,
  "status" varchar(30) NOT NULL,
  "request_payload" jsonb,
  "response_payload" jsonb,
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gcal_sync_logs" PRIMARY KEY ("id")
);

COMMIT;
`;

async function run() {
  try {
    await client.connect();
    console.log("Connected to production DB.");
    await client.query(sql);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Error executing migration. Rolling back...");
    console.error(err);
    try {
        await client.query('ROLLBACK;');
    } catch (e) {}
  } finally {
    await client.end();
  }
}

run();
