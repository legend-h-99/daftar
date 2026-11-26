---
id: AgDR-0005
timestamp: 2026-11-26T12:00:00Z
agent: claude-code
model: claude-opus-5-5
session: cdd62c5a-b266-477b-9bc2-0ea030c7ab0f
trigger: user-prompt
status: executed
category: integrations
projects: [daftar1]
---

# Daily GitHub Actions job keeps the database active and stores an age-encrypted backup

> In the context of #99, facing a free-tier Supabase project that pauses when idle and has no automatic backups, I decided to run one scheduled GitHub Actions job that queries the database and uploads an age-encrypted `pg_dump`, to keep production up and hold 30 days of restorable backups at no cost, accepting that the keep-alive effect is unverified and that storage files are not backed up.

## Context

- The production project `daftar` runs on the Supabase free plan. On 2026-11-26 it was paused, and the production API host did not resolve.
- The free plan has no automatic backups. #46 asks for a working backup and restore path.
- The repository `legend-h-99/daftar` is public. A signed-in GitHub user can download its workflow artifacts. The dump holds personal and financial data.
- The direct database host is IPv6-only. GitHub-hosted runners have no IPv6, so the job must use the Session pooler URI.
- The founder asked for a free solution.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Supabase Pro plan | No pausing. Daily managed backups. | Monthly cost. The founder asked for free. |
| Plain `pg_dump` uploaded as an artifact | Simple. | The repository is public. Anyone signed in could read user data. Rejected. |
| `pg_dump` committed to a private repository | Long retention. | Needs a second repository and a write token. Backups grow the git history forever. |
| `pg_dump` piped into `age`, uploaded as an artifact | Free. Plaintext never touches the disk. Only the holder of the private key can read it. | 30-day artifact retention. Losing the private key makes every backup unreadable. |
| An external keep-alive pinger only | No secrets in GitHub. | Gives no backup. |

## Decision

Chosen: **`pg_dump` piped into `age`, uploaded as a 30-day artifact, in the same daily job as a `select 1` keep-alive query**, because it costs nothing, closes the backup gap from #46, and keeps user data unreadable in a public repository.

The job runs in the `postgres:17` container, so `pg_dump` matches the server major version. It dumps the `public` and `auth` schemas.

## Consequences

- Production gets one database query a day. The assumption that this prevents pausing is not yet verified. Watch the project status for two weeks.
- The founder must keep the age private key outside GitHub. Without it, no backup can be restored.
- Supabase Storage objects are not in the dump. Only table data is.
- GitHub disables scheduled workflows in a public repository after 60 days with no repository activity. The keep-alive then stops, and the project can pause again. The guide tells the founder how to re-enable it.
- Each step receives only the secrets it uses. `apt-get` and the upload action never see the database URL.
- The job uses a database role that can write. A read-only backup role is a possible later hardening step.
- A restore must be tested in a separate local database. The steps are in `docs/DB_BACKUP_RESTORE_AR.md`.
- When the project moves to Supabase Pro, this job can remain as an off-site copy or be removed.

## Artifacts

- `.github/workflows/db-keepalive-backup.yml`
- `docs/DB_BACKUP_RESTORE_AR.md`
- Issue #99, parent #46
