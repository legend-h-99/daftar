-- Run ONLY against the dedicated operations database, never the accounting DB.
CREATE TABLE IF NOT EXISTS ops_settings (
 id integer PRIMARY KEY CHECK (id=1), paused boolean NOT NULL DEFAULT true,
 paid_enabled boolean NOT NULL DEFAULT false, monthly_cap_micro bigint NOT NULL DEFAULT 0 CHECK(monthly_cap_micro>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ops_settings(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ops_goals (
 id text PRIMARY KEY, title text NOT NULL, approved boolean NOT NULL DEFAULT false,
 week_start date NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ops_settings ADD COLUMN IF NOT EXISTS support_goal_id text REFERENCES ops_goals;
CREATE TABLE IF NOT EXISTS ops_tasks (
 id text PRIMARY KEY, goal_id text REFERENCES ops_goals, parent_id text REFERENCES ops_tasks,
 title text NOT NULL, department text NOT NULL, agent text NOT NULL, reviewer text NOT NULL CHECK (agent<>reviewer),
 acceptance text NOT NULL, context text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','ready','running','review','approval','done','blocked')),
 evidence jsonb, review_evidence text, error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_tickets (
 id text PRIMARY KEY, email text NOT NULL, description text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','resolved')),
 task_id text REFERENCES ops_tasks, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_jobs (
 id text PRIMARY KEY, task_id text REFERENCES ops_tasks, kind text NOT NULL,
 dedupe_key text UNIQUE NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed','cancelled','uncertain')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_token text, lease_until timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_jobs_ready ON ops_jobs(status,available_at);
CREATE TABLE IF NOT EXISTS ops_runs (
 id text PRIMARY KEY, task_id text REFERENCES ops_tasks, agent text NOT NULL,
 status text NOT NULL, output jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_actions (
 id text PRIMARY KEY, task_id text REFERENCES ops_tasks, kind text NOT NULL,
 payload jsonb NOT NULL, digest text NOT NULL, revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','executing','done','uncertain','cancelled')),
 approved_digest text, approved_at timestamptz, receipt text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_usage (
 id text PRIMARY KEY, job_id text REFERENCES ops_jobs, provider text NOT NULL,
 reserved_micro bigint NOT NULL CHECK(reserved_micro>=0), actual_micro bigint CHECK(actual_micro>=0),
 input_tokens integer, output_tokens integer, month text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_audit (
 id text PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_reports (
 id text PRIMARY KEY, day date UNIQUE NOT NULL, body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_sessions (id text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS ops_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
-- No browser/PostgREST access. Application connects using a dedicated server role.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ops_%' LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON %I FROM anon',t); END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON %I FROM authenticated',t); END IF;
 END LOOP;
END $$;
